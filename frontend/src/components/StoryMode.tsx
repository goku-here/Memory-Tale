import { motion, useReducedMotion } from 'framer-motion'
import { Check, Download, Loader2, Share2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { exportStoryPng, storyPrefs } from '../lib/exportStory'
import { frameHeightFor, ratioLabel, STORY_SIZES, type StorySize } from '../lib/storySizes'
import type { CanvasItem, Memory } from '../types'
import { ToolSheet } from './ToolSheet'
import { toast } from './ui'

const HATCH = 'repeating-linear-gradient(135deg, rgba(255,255,255,.34) 0 6px, rgba(255,255,255,.08) 6px 12px)'
const MASK = 'rgba(14,16,26,.58)'

/** rotated bounding box of an item, in canvas pixels */
function bounds(it: CanvasItem, canvasW: number) {
  const r = (it.rotation * Math.PI) / 180
  const bw = Math.abs(it.width * Math.cos(r)) + Math.abs(it.height * Math.sin(r))
  const bh = Math.abs(it.width * Math.sin(r)) + Math.abs(it.height * Math.cos(r))
  const cx = (it.x / 100) * canvasW
  return { l: cx - bw / 2, r: cx + bw / 2, t: it.y - bh / 2, b: it.y + bh / 2 }
}

interface OverlayProps {
  surfaceRef: RefObject<HTMLDivElement | null>
  scrollerRef: RefObject<HTMLDivElement | null>
  canvasW: number
  surfaceH: number
  y: number
  onY: (y: number) => void
  items: CanvasItem[]
  accent: string
  headerH: number
  size: StorySize
  /** canvas zoom (1 = fit to width) */
  zoom: number
}

/** The 9:16 frame, dim mask, Instagram safe-zone guides and edge warnings. Taps pass through to the canvas. */
export function StoryOverlay({ surfaceRef, scrollerRef, canvasW, surfaceH, y, onY, items, accent, headerH, size, zoom }: OverlayProps) {
  const calm = useReducedMotion()
  const fh = frameHeightFor(canvasW, size)
  const spring = calm ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 26 }
  const drag = useRef<{ off: number; cy: number } | null>(null)
  const z = useRef(zoom)
  z.current = zoom
  const raf = useRef(0)
  const live = useRef({ onY })
  live.current.onY = onY

  const crossing = useMemo(() => items.filter((it) => {
    if (it.type === 'thread') return false
    const b = bounds(it, canvasW)
    if (b.b <= y || b.t >= y + fh) return false
    return b.t < y || b.b > y + fh || b.l < 0 || b.r > canvasW
  }), [items, canvasW, y, fh])

  const tick = () => {
    const d = drag.current
    const sc = scrollerRef.current
    const s = surfaceRef.current
    if (!d || !sc || !s) return
    const vh = window.innerHeight
    const topZone = headerH + 70
    const botZone = vh - 120
    if (d.cy < topZone) sc.scrollTop -= Math.min(18, (topZone - d.cy) / 4 + 2)
    else if (d.cy > botZone) sc.scrollTop += Math.min(18, (d.cy - botZone) / 4 + 2)
    const top = s.getBoundingClientRect().top
    live.current.onY(Math.max(0, (d.cy - d.off - top) / z.current))
    raf.current = requestAnimationFrame(tick)
  }
  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const top = surfaceRef.current!.getBoundingClientRect().top
    drag.current = { off: e.clientY - (top + y * z.current), cy: e.clientY }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick)
  }
  const move = (e: React.PointerEvent) => { if (drag.current) drag.current.cy = e.clientY }
  const stop = () => { drag.current = null; cancelAnimationFrame(raf.current) }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const handle = (pos: 'top' | 'bottom') => (
    <div
      data-ui role="slider" aria-label="Move the story frame" aria-valuenow={Math.round(y)}
      onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}
      className="absolute left-1/2 grid h-11 w-24 -translate-x-1/2 cursor-grab place-items-center"
      style={{ [pos]: 4, pointerEvents: 'auto', touchAction: 'none', zIndex: 9700 }}
    >
      <span className="h-[7px] w-14 rounded-full" style={{ background: '#fff', boxShadow: `0 0 0 1.5px ${accent}, 0 2px 8px rgba(0,0,0,.3)` }} />
    </div>
  )

  const label = (text: string, at: 'top' | 'bottom') => (
    <span className="absolute left-3 text-[11px] font-extrabold uppercase tracking-wider text-white" style={{ [at]: 8, textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{text}</span>
  )

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 8500 }} aria-hidden={false}>
      {/* dim everything outside the frame */}
      <motion.div className="absolute inset-x-0 top-0" style={{ height: y, background: MASK }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: calm ? 0 : 0.35 }} />
      <motion.div className="absolute inset-x-0" style={{ top: y + fh, height: Math.max(0, surfaceH - y - fh), background: MASK }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: calm ? 0 : 0.35 }} />

      {/* the frame itself */}
      <motion.div
        className="absolute inset-x-0" style={{ top: y, height: fh, boxShadow: `inset 0 0 0 2px ${accent}`, transformOrigin: '50% 0' }}
        initial={{ opacity: 0, scaleY: 0.94 }} animate={{ opacity: 1, scaleY: 1 }} transition={spring}
      >
        {size.safeTop > 0 && <div className="absolute inset-x-0 top-0" style={{ height: `${size.safeTop * 100}%`, background: HATCH, borderBottom: '1.5px dashed rgba(255,255,255,.85)' }}>{label(size.zones?.[0] ?? 'Covered', 'top')}</div>}
        {size.safeBottom > 0 && <div className="absolute inset-x-0 bottom-0" style={{ height: `${size.safeBottom * 100}%`, background: HATCH, borderTop: '1.5px dashed rgba(255,255,255,.85)' }}>{label(size.zones?.[1] ?? 'Covered', 'bottom')}</div>}
        {handle('top')}
        {handle('bottom')}
      </motion.div>

      {/* items that will be cut off */}
      {crossing.map((it) => {
        const b = bounds(it, canvasW)
        return <div key={it.id} className="absolute rounded-md" style={{ left: b.l, top: b.t, width: b.r - b.l, height: b.b - b.t, outline: '2px dashed #ff5d73', outlineOffset: 2, opacity: 0.9 }} />
      })}
    </div>
  )
}

export const storyFileName = (title: string, size: StorySize) => `memory-tale-${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'story'}-${size.id}.png`

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

/** A half-size copy for the preview: the browser's own 6x downscale of the full image makes thin strokes look faint. */
async function thumbnail(blob: Blob, size: StorySize): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(blob)
    const c = document.createElement('canvas')
    const tw = Math.min(540, size.w)
    const th = Math.round((tw * size.h) / size.w)
    c.width = tw
    c.height = th
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bmp, 0, 0, tw, th)
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? blob), 'image/png'))
  } catch { return blob }
}

interface PreviewProps {
  open: boolean
  onClose: () => void
  memory: Memory
  accent: string
  getItems: () => CanvasItem[]
  frameY: number
  canvasW: number
  size: StorySize
}

/** Renders the story and shows it before anything is shared. */
export function StoryPreview({ open, onClose, memory, accent, getItems, frameY, canvasW, size }: PreviewProps) {
  const [dots, setDots] = useState(storyPrefs.dots)
  const [mark, setMark] = useState(storyPrefs.mark)
  const [state, setState] = useState<{ blob: Blob; url: string } | null>(null)
  const [err, setErr] = useState(false)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    if (!open) return
    let alive = true
    let made = ''
    setState(null)
    setErr(false)
    exportStoryPng(memory, getItems(), { frameY, canvasW, dots, mark, size })
      .then(async (blob) => { const small = await thumbnail(blob, size); if (!alive) return; made = URL.createObjectURL(small); setState({ blob, url: made }) })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dots, mark, tries, size])

  const share = async () => {
    if (!state) return
    const file = new File([state.blob], storyFileName(memory.title, size), { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: memory.title }); return }
    } catch (e) { if ((e as Error).name === 'AbortError') return }
    downloadBlob(state.blob, file.name)
    toast('Saved the story image')
  }

  const Switch = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) => (
    <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-1 text-left text-[14.5px] font-semibold text-[#17171a]">
      {label}
      <span className="relative h-7 w-12 rounded-full transition-colors" style={{ background: on ? accent : '#d9d9df' }}>
        <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
      </span>
    </button>
  )

  return (
    <ToolSheet open={open} onClose={onClose} title="Story preview" snaps={[0.92]} z={85}>
      <div className="space-y-3 px-6 pb-5">
        <div className="mx-auto grid place-items-center overflow-hidden rounded-2xl bg-neutral-100" style={{ aspectRatio: `${size.w} / ${size.h}`, ...(size.w >= size.h ? { width: 'min(100%, 380px)' } : { height: 'min(52vh, 480px)' }), maxWidth: '100%' }}>
          {state ? <img src={state.url} alt="Your story" className="h-full w-full object-contain" />
            : err ? (
              <div className="px-4 text-center text-[13.5px] font-semibold text-neutral-500">
                Couldn&apos;t render the image.<br />
                <button type="button" onClick={() => setTries((n) => n + 1)} className="mt-2 h-10 rounded-full border-0 bg-[#17171a] px-5 text-white">Try again</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-[13px] font-semibold text-neutral-500"><Loader2 className="animate-spin" size={26} style={{ color: accent }} />Rendering your story…</div>
            )}
        </div>
        <Switch label="Show dots" on={dots} set={(v) => { storyPrefs.setDots(v); setDots(v) }} />
        <Switch label="“Made with Memory Tale” mark" on={mark} set={(v) => { if (storyPrefs.locked) return; storyPrefs.setMark(v); setMark(v) }} />
        <div className="flex gap-2">
          <button type="button" disabled={!state} onClick={() => state && downloadBlob(state.blob, storyFileName(memory.title, size))}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-0 bg-neutral-100 text-[15px] font-bold text-[#17171a] disabled:opacity-40"><Download size={18} />Download</button>
          <button type="button" disabled={!state} onClick={() => void share()}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-0 bg-[#17171a] text-[15px] font-bold text-white disabled:opacity-40"><Share2 size={18} />Share</button>
        </div>
      </div>
    </ToolSheet>
  )
}

/** Pick the shape of the story frame. */
export function SizeSheet({ open, onClose, value, onPick, accent }: { open: boolean; onClose: () => void; value: StorySize; onPick: (s: StorySize) => void; accent: string }) {
  return (
    <ToolSheet open={open} onClose={onClose} title="Frame size" snaps={[0.7, 0.92]} z={75}>
      <div className="px-4 pb-6">
        {STORY_SIZES.map((s) => {
          const on = s.id === value.id
          const r = s.w / s.h
          return (
            <motion.button
              key={s.id} type="button" whileTap={{ scale: 0.98 }} onClick={() => { onPick(s); onClose() }}
              className="flex min-h-[64px] w-full items-center gap-3.5 rounded-2xl border-0 bg-transparent px-2 py-2 text-left"
              style={on ? { background: `${accent}14` } : undefined} aria-pressed={on}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center">
                <span className="rounded-[4px]" style={{ width: r >= 1 ? 40 : 40 * r, height: r >= 1 ? 40 / r : 40, border: `2px solid ${on ? accent : '#b9b9c3'}`, background: on ? `${accent}22` : '#f3f3f6' }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-bold text-[#17171a]">{s.name}</span>
                <span className="block truncate text-[12.5px] text-neutral-500">{s.w} × {s.h} · {ratioLabel(s)} · {s.note}</span>
              </span>
              {on && <Check size={20} strokeWidth={3} style={{ color: accent }} />}
            </motion.button>
          )
        })}
        <p className="m-0 px-2 pt-3 text-[12.5px] leading-snug text-neutral-400">The frame is always as wide as your canvas; a shorter shape just makes it less tall. The shaded zones show where the app covers the picture with its own buttons.</p>
      </div>
    </ToolSheet>
  )
}
