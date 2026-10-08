import { animate, motion, useMotionValue, useTransform } from 'framer-motion'
import { ChevronLeft, ChevronRight, Loader2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { downloadOriginal } from '../lib/supabase'
import { resolveRef } from '../lib/assets'

export interface ViewerImage {
  key: string
  src: string
  thumb?: string
  /** storage path of the full-quality original, if there is one */
  original?: string
  caption?: string
}

interface Props {
  memoryId: string
  images: ViewerImage[]
  start: number
  onClose: () => void
}

const MAX_SCALE = 5
const DOUBLE_TAP_SCALE = 2.5
const SPRING = { type: 'spring', stiffness: 380, damping: 36 } as const
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Full-screen photo viewer on a dark backdrop.
 * Pinch / wheel / double-tap to zoom, drag to pan when zoomed, swipe sideways for the next photo,
 * swipe down (or tap the dark area, or press Esc) to close.
 */
export function Lightbox({ memoryId, images, start, onClose }: Props) {
  const [i, setI] = useState(Math.min(start, images.length - 1))
  const [dir, setDir] = useState(0)
  const [zoomed, setZoomed] = useState(false)
  const [shown, setShown] = useState<string | null>(null)
  const cur = images[i]

  const scale = useMotionValue(1)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const dim = useMotionValue(0.92)
  const bg = useTransform(dim, (v) => `rgba(0,0,0,${v})`)
  const imgRef = useRef<HTMLImageElement>(null)
  const openedAt = useRef(performance.now())
  /** touches in the first moments belong to the tap that opened the viewer */
  const settling = () => performance.now() - openedAt.current < 450

  // the synced copy may still be an `asset:` reference: resolve it, showing the blurred preview meanwhile
  useEffect(() => {
    let alive = true
    setShown(null)
    void resolveRef(memoryId, cur.src).then((d) => { if (alive && d) setShown(d) })
    return () => { alive = false }
  }, [memoryId, cur.src])

  /* ---- full-quality original replaces the synced copy when it arrives ---- */
  const originals = useRef(new Map<string, string>())
  const [full, setFull] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    const path = cur.original
    setFull(path ? originals.current.get(path) ?? null : null)
    if (!path || originals.current.has(path)) { setLoading(false); return }
    let alive = true
    setLoading(true)
    void downloadOriginal(path).then((b) => {
      if (b) originals.current.set(path, URL.createObjectURL(b))
      if (alive) { setFull(originals.current.get(path) ?? null); setLoading(false) }
    })
    return () => { alive = false }
  }, [cur.original])
  useEffect(() => () => { originals.current.forEach((u) => URL.revokeObjectURL(u)) }, [])

  /* ---- zoom helpers ---- */
  const clampPan = useCallback((nx: number, ny: number, s: number) => {
    const w = (imgRef.current?.offsetWidth ?? window.innerWidth) * s
    const h = (imgRef.current?.offsetHeight ?? window.innerHeight) * s
    const mx = Math.max(0, (w - window.innerWidth) / 2)
    const my = Math.max(0, (h - window.innerHeight) / 2)
    return { x: Math.min(mx, Math.max(-mx, nx)), y: Math.min(my, Math.max(-my, ny)) }
  }, [])

  const resetView = useCallback((animated = true) => {
    if (animated) {
      animate(scale, 1, SPRING); animate(x, 0, SPRING); animate(y, 0, SPRING); animate(dim, 0.92, { duration: 0.2 })
    } else { scale.set(1); x.set(0); y.set(0); dim.set(0.92) }
    setZoomed(false)
  }, [scale, x, y, dim])

  const zoomAt = useCallback((px: number, py: number, to: number, animated = true) => {
    const s0 = scale.get()
    const s = Math.min(MAX_SCALE, Math.max(1, to))
    const fx = px - window.innerWidth / 2
    const fy = py - window.innerHeight / 2
    const p = clampPan(fx - (fx - x.get()) * (s / s0), fy - (fy - y.get()) * (s / s0), s)
    if (animated) { animate(scale, s, SPRING); animate(x, p.x, SPRING); animate(y, p.y, SPRING) }
    else { scale.set(s); x.set(p.x); y.set(p.y) }
    setZoomed(s > 1.02)
  }, [scale, x, y, clampPan])

  const go = useCallback((delta: number) => {
    const n = i + delta
    if (n < 0 || n >= images.length) { animate(x, 0, SPRING); return }
    setDir(delta)
    setI(n)
    resetView(false)
  }, [i, images.length, resetView, x])

  /* ---- keyboard ---- */
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
      else if (e.key === '+' || e.key === '=') zoomAt(window.innerWidth / 2, window.innerHeight / 2, scale.get() * 1.5)
      else if (e.key === '-') { const s = scale.get() / 1.5; if (s <= 1.05) resetView(); else zoomAt(window.innerWidth / 2, window.innerHeight / 2, s) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [go, onClose, resetView, scale, zoomAt])

  /* ---- pointer gestures ---- */
  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const g = useRef({
    mode: 'none' as 'none' | 'undecided' | 'swipe' | 'close' | 'pan' | 'pinch',
    sx: 0, sy: 0, x0: 0, y0: 0, s0: 1, d0: 1, m0x: 0, m0y: 0, t0: 0,
  })
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)

  const mid = () => {
    const p = [...ptrs.current.values()]
    return { x: (p[0].x + p[1].x) / 2, y: (p[0].y + p[1].y) / 2 }
  }
  const baselinePan = () => {
    const p = [...ptrs.current.values()][0]
    Object.assign(g.current, { mode: 'pan', sx: p.x, sy: p.y, x0: x.get(), y0: y.get() })
  }

  const onDown = (e: React.PointerEvent) => {
    if (settling() || (e.target as HTMLElement).closest('button')) return
    e.currentTarget.setPointerCapture(e.pointerId)
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const st = g.current
    if (ptrs.current.size === 1) {
      Object.assign(st, { sx: e.clientX, sy: e.clientY, x0: x.get(), y0: y.get(), t0: performance.now(), mode: scale.get() > 1.02 ? 'pan' : 'undecided' })
    } else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()]
      const m = mid()
      Object.assign(st, { mode: 'pinch', s0: scale.get(), d0: Math.max(10, dist(a, b)), m0x: m.x, m0y: m.y, x0: x.get(), y0: y.get() })
    }
  }

  const onMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const st = g.current
    if (st.mode === 'pinch' && ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()]
      const s = Math.min(MAX_SCALE * 1.15, Math.max(0.6, st.s0 * (dist(a, b) / st.d0)))
      const m = mid()
      const fx = st.m0x - window.innerWidth / 2
      const fy = st.m0y - window.innerHeight / 2
      scale.set(s)
      x.set(fx - (fx - st.x0) * (s / st.s0) + (m.x - st.m0x))
      y.set(fy - (fy - st.y0) * (s / st.s0) + (m.y - st.m0y))
      return
    }
    const dx = e.clientX - st.sx
    const dy = e.clientY - st.sy
    if (st.mode === 'undecided' && Math.hypot(dx, dy) > 9) st.mode = Math.abs(dx) > Math.abs(dy) ? 'swipe' : 'close'
    if (st.mode === 'swipe') {
      const edge = (dx > 0 && i === 0) || (dx < 0 && i === images.length - 1)
      x.set(edge ? dx * 0.25 : dx)
    } else if (st.mode === 'close') {
      y.set(dy)
      dim.set(0.92 - Math.min(0.6, Math.abs(dy) / 420))
    } else if (st.mode === 'pan') {
      const p = clampPan(st.x0 + dx, st.y0 + dy, scale.get())
      x.set(p.x); y.set(p.y)
    }
  }

  const onUp = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return
    if (settling()) { ptrs.current.delete(e.pointerId); g.current.mode = 'none'; return }
    ptrs.current.delete(e.pointerId)
    const st = g.current
    if (st.mode === 'pinch') {
      if (ptrs.current.size === 1) { baselinePan(); return }
      if (scale.get() < 1.08) resetView()
      else {
        const s = Math.min(MAX_SCALE, scale.get())
        const p = clampPan(x.get(), y.get(), s)
        animate(scale, s, SPRING); animate(x, p.x, SPRING); animate(y, p.y, SPRING)
        setZoomed(true)
      }
      st.mode = 'none'
      return
    }
    if (ptrs.current.size > 0) return
    const dx = e.clientX - st.sx
    const dy = e.clientY - st.sy
    const dt = Math.max(1, performance.now() - st.t0)
    if (st.mode === 'swipe') {
      if (Math.abs(dx) > 70 || Math.abs(dx / dt) > 0.5) go(dx < 0 ? 1 : -1)
      else animate(x, 0, SPRING)
    } else if (st.mode === 'close') {
      if (Math.abs(dy) > 110 || Math.abs(dy / dt) > 0.6) onClose()
      else { animate(y, 0, SPRING); animate(dim, 0.92, { duration: 0.2 }) }
    } else if (st.mode === 'undecided' || (st.mode === 'pan' && Math.hypot(dx, dy) < 6)) {
      // a tap: double-tap zooms, a tap on the dark area closes
      const now = performance.now()
      const lt = lastTap.current
      const onImage = (e.target as HTMLElement).tagName === 'IMG'
      if (lt && now - lt.t < 320 && Math.hypot(e.clientX - lt.x, e.clientY - lt.y) < 30) {
        lastTap.current = null
        if (scale.get() > 1.05) resetView()
        else zoomAt(e.clientX, e.clientY, DOUBLE_TAP_SCALE)
      } else {
        lastTap.current = { t: now, x: e.clientX, y: e.clientY }
        if (!onImage && scale.get() <= 1.02) onClose()
      }
    }
    st.mode = 'none'
  }

  const onWheel = (e: React.WheelEvent) => {
    const s = scale.get() * Math.exp(-e.deltaY * 0.0018)
    if (s <= 1.02) resetView()
    else zoomAt(e.clientX, e.clientY, s, false)
  }

  return (
    <motion.div
      role="dialog" aria-modal aria-label="Photo viewer"
      className="fixed inset-0 z-[85] select-none overflow-hidden"
      style={{ background: bg, touchAction: 'none' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
    >
      <div className="absolute inset-0 grid place-items-center">
        <motion.figure
          key={cur.key}
          className="m-0 flex max-w-full flex-col items-center px-2"
          initial={{ opacity: 0, x: dir * 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.22 }}
        >
          <motion.img
            ref={imgRef}
            src={full ?? shown ?? cur.thumb ?? ''} alt={cur.caption || `Photo ${i + 1}`} draggable={false}
            className="max-h-[86vh] max-w-full rounded-lg object-contain shadow-2xl"
            style={{ scale, x, y, cursor: zoomed ? 'grab' : 'zoom-in', transformOrigin: 'center', filter: full || shown ? undefined : 'blur(10px)', minWidth: 120, minHeight: 120 }}
          />
          {cur.caption && !zoomed && (
            <figcaption className="mt-3 text-center text-white/80" style={{ fontFamily: "'Caveat', cursive", fontSize: 20 }}>{cur.caption}</figcaption>
          )}
        </motion.figure>
      </div>

      <button
        type="button" aria-label="Close" onClick={() => { if (!settling()) onClose() }}
        className="absolute right-4 grid h-11 w-11 place-items-center rounded-full border-0 bg-white/15 text-white backdrop-blur active:scale-95"
        style={{ top: 'calc(var(--safe-top) + 14px)' }}
      >
        <X size={22} />
      </button>

      {images.length > 1 && (
        <div className="pointer-events-none absolute left-4 flex h-11 items-center rounded-full bg-white/15 px-3.5 text-[13px] font-bold text-white backdrop-blur" style={{ top: 'calc(var(--safe-top) + 14px)' }}>
          {i + 1} / {images.length}
        </div>
      )}

      {/* arrows for mouse users; phones swipe */}
      {images.length > 1 && (
        <>
          <button type="button" aria-label="Previous photo" onClick={() => go(-1)} disabled={i === 0}
            className="absolute left-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full border-0 bg-white/15 text-white backdrop-blur disabled:opacity-25 [@media(hover:hover)]:grid">
            <ChevronLeft size={26} />
          </button>
          <button type="button" aria-label="Next photo" onClick={() => go(1)} disabled={i === images.length - 1}
            className="absolute right-3 top-1/2 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full border-0 bg-white/15 text-white backdrop-blur disabled:opacity-25 [@media(hover:hover)]:grid">
            <ChevronRight size={26} />
          </button>
        </>
      )}

      {loading && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-[12.5px] font-semibold text-white backdrop-blur" role="status">
          <Loader2 size={14} className="animate-spin" /> Loading full quality…
        </div>
      )}
    </motion.div>
  )
}
