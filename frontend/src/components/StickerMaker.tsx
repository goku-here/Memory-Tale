import { motion } from 'framer-motion'
import { Brush, Check, Eraser, Loader2, MousePointerClick, Paintbrush, Pentagon, Slash, Sparkles, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cleanMask, composite, cutout, exportSticker, removePieceAt, type CutoutResult } from '../lib/cutout'

interface Props {
  file: File
  onClose: () => void
  onSave: (dataUrl: string, ratio: number) => void
}

type Stage = 'model' | 'analyzing' | 'ready' | 'error'
type Tool = 'brush' | 'line' | 'shape' | 'piece'
interface Pt { x: number; y: number }

const CHECKER = 'conic-gradient(#e6e6ea 25%, #f7f7f9 0 50%, #e6e6ea 0 75%, #f7f7f9 0) 0 0 / 22px 22px'

const TOOLS: { id: Tool; label: string; icon: typeof Brush }[] = [
  { id: 'brush', label: 'Brush', icon: Brush },
  { id: 'line', label: 'Line', icon: Slash },
  { id: 'shape', label: 'Shape', icon: Pentagon },
  { id: 'piece', label: 'Piece', icon: MousePointerClick },
]

/** Cut the subject out of a photo, touch it up with brushes, straight lines or outlined shapes, and save it as a sticker. */
export function StickerMaker({ file, onClose, onSave }: Props) {
  const [stage, setStage] = useState<Stage>('model')
  const [progress, setProgress] = useState(0)
  const [mode, setMode] = useState<'erase' | 'restore'>('erase')
  const [tool, setTool] = useState<Tool>('brush')
  const [brush, setBrush] = useState(26)
  const [outline, setOutline] = useState(true)
  const [error, setError] = useState('')
  const [undoCount, setUndoCount] = useState(0)
  const [dims, setDims] = useState({ w: 1, h: 1 })
  const [line, setLine] = useState<{ a: Pt; b: Pt } | null>(null)
  const [poly, setPoly] = useState<Pt[]>([])
  const [closed, setClosed] = useState(false)
  const res = useRef<CutoutResult | null>(null)
  const view = useRef<HTMLCanvasElement>(null)
  const history = useRef<ImageData[]>([])
  const drawing = useRef<{ x: number; y: number } | null>(null)
  const lineStart = useRef<Pt | null>(null)

  const render = useCallback(() => {
    const r = res.current
    const v = view.current
    if (r && v) composite(r.photo, r.mask, v)
  }, [])

  useEffect(() => {
    let alive = true
    cutout(file, (s) => alive && setStage(s), (f) => alive && setProgress(f))
      .then((r) => {
        if (!alive) return
        res.current = r
        const v = view.current
        if (v) { v.width = r.photo.width; v.height = r.photo.height }
        setDims({ w: r.photo.width, h: r.photo.height })
        render()
        setStage('ready')
      })
      .catch((e) => { if (alive) { setError((e as Error).message || 'Something went wrong'); setStage('error') } })
    return () => { alive = false }
  }, [file, render])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const toCanvas = (e: React.PointerEvent) => {
    const v = view.current!
    const r = v.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * v.width, y: ((e.clientY - r.top) / r.height) * v.height, scale: v.width / r.width }
  }

  const snapshot = () => {
    const m = res.current?.mask
    if (!m) return
    history.current.push(m.getContext('2d')!.getImageData(0, 0, m.width, m.height))
    if (history.current.length > 14) history.current.shift()
    setUndoCount(history.current.length)
  }
  const undoSnapshot = () => { history.current.pop(); setUndoCount(history.current.length) }

  const stroke = (x: number, y: number, scale: number) => {
    const m = res.current?.mask
    if (!m) return
    const ctx = m.getContext('2d')!
    const r = (brush / 2) * scale
    const last = drawing.current
    ctx.save()
    ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over'
    ctx.fillStyle = ctx.strokeStyle = '#fff'
    ctx.lineWidth = r * 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    if (last) { ctx.moveTo(last.x, last.y); ctx.lineTo(x, y); ctx.stroke() }
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    drawing.current = { x, y }
    render()
  }

  /** a ruler line: keeps to 0, 45 or 90 degrees when you are close to them */
  const straighten = (a: Pt, p: Pt): Pt => {
    const dx = p.x - a.x, dy = p.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 8) return p
    const ang = Math.atan2(dy, dx)
    const step = Math.PI / 4
    const near = Math.round(ang / step) * step
    if (Math.abs(ang - near) < (5 * Math.PI) / 180) return { x: a.x + Math.cos(near) * len, y: a.y + Math.sin(near) * len }
    return p
  }

  const applyLine = (a: Pt, b: Pt, scale: number) => {
    const m = res.current?.mask
    if (!m) return
    const ctx = m.getContext('2d')!
    ctx.save()
    ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = brush * scale
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.restore()
    render()
  }

  const down = (e: React.PointerEvent) => {
    if (stage !== 'ready' || !res.current) return
    const p = toCanvas(e)
    if (tool === 'shape') {
      if (closed) return
      const first = poly[0]
      if (first && poly.length >= 3 && Math.hypot(p.x - first.x, p.y - first.y) < 20 * p.scale) { setClosed(true); return }
      setPoly((l) => [...l, { x: p.x, y: p.y }])
      return
    }
    if (tool === 'piece') {
      snapshot()
      if (removePieceAt(res.current.mask, p.x, p.y)) render()
      else undoSnapshot()
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    if (tool === 'line') {
      lineStart.current = { x: p.x, y: p.y }
      setLine({ a: { x: p.x, y: p.y }, b: { x: p.x, y: p.y } })
      return
    }
    snapshot()
    drawing.current = null
    stroke(p.x, p.y, p.scale)
  }
  const move = (e: React.PointerEvent) => {
    if (!(e.buttons & 1) && e.pointerType === 'mouse') return
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const p = toCanvas(e)
    if (tool === 'line') {
      const a = lineStart.current
      if (a) setLine({ a, b: straighten(a, { x: p.x, y: p.y }) })
      return
    }
    stroke(p.x, p.y, p.scale)
  }
  const up = (e: React.PointerEvent) => {
    drawing.current = null
    if (tool === 'line' && line && lineStart.current) {
      const { a, b } = line
      lineStart.current = null
      setLine(null)
      if (Math.hypot(b.x - a.x, b.y - a.y) > 3) {
        snapshot()
        applyLine(a, b, toCanvas(e).scale)
      }
    }
  }

  const undo = () => {
    const m = res.current?.mask
    const prev = history.current.pop()
    if (!m || !prev) return
    m.getContext('2d')!.putImageData(prev, 0, 0)
    setUndoCount(history.current.length)
    render()
  }

  const polyAction = (op: 'erase' | 'keep' | 'restore') => {
    const m = res.current?.mask
    if (!m || poly.length < 3) return
    snapshot()
    const ctx = m.getContext('2d')!
    const trace = (c: CanvasRenderingContext2D) => { c.beginPath(); poly.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath() }
    if (op === 'keep') {
      const tmp = document.createElement('canvas')
      tmp.width = m.width
      tmp.height = m.height
      const t = tmp.getContext('2d')!
      t.fillStyle = '#fff'
      trace(t)
      t.fill()
      ctx.save()
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(tmp, 0, 0)
      ctx.restore()
    } else {
      ctx.save()
      ctx.globalCompositeOperation = op === 'erase' ? 'destination-out' : 'source-over'
      ctx.fillStyle = '#fff'
      trace(ctx)
      ctx.fill()
      ctx.restore()
    }
    setPoly([])
    setClosed(false)
    render()
  }

  const tidy = () => {
    const m = res.current?.mask
    if (!m) return
    snapshot()
    cleanMask(m)
    render()
  }

  const save = () => {
    const r = res.current
    if (!r) return
    const out = exportSticker(r.photo, r.mask)
    if (!out) { setError('Nothing is left of the picture. Use Restore to bring some back.'); return }
    onSave(out.dataUrl, out.ratio)
  }

  const busy = stage === 'model' || stage === 'analyzing'
  const k = view.current && view.current.getBoundingClientRect().width ? view.current.width / view.current.getBoundingClientRect().width : 1
  const lineColor = mode === 'erase' ? '#ff4d6d' : '#34d399'
  const showBrushSize = tool === 'brush' || tool === 'line'

  return (
    <motion.div
      role="dialog" aria-modal aria-label="Make a sticker"
      className="fixed inset-0 z-[95] flex flex-col bg-[#101014] text-white"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <header className="flex items-center justify-between px-3" style={{ paddingTop: 'calc(var(--safe-top) + 10px)' }}>
        <button type="button" aria-label="Cancel" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/10 text-white"><X size={21} /></button>
        <div className="text-[16px] font-extrabold">Make a sticker</div>
        <motion.button
          type="button" whileTap={{ scale: 0.95 }} onClick={save} disabled={stage !== 'ready'}
          className="flex h-11 items-center gap-1.5 rounded-full border-0 bg-white px-4 text-[14.5px] font-semibold text-[#17171a] disabled:opacity-30"
        >
          <Check size={17} strokeWidth={3} /> Add
        </motion.button>
      </header>

      <div className="relative grid min-h-0 flex-1 place-items-center px-4 py-3">
        <div className="relative max-h-full max-w-full" style={{ background: CHECKER, borderRadius: 14, visibility: stage === 'ready' ? 'visible' : 'hidden' }}>
          <canvas
            ref={view}
            className="block max-h-[56vh] max-w-full touch-none select-none"
            style={{ cursor: tool === 'piece' ? 'pointer' : 'crosshair', background: 'transparent', filter: outline ? 'url(#mt-outline)' : undefined }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          />
          {/* guides while drawing a line or outlining a shape (same coordinates as the picture) */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 ${dims.w} ${dims.h}`} preserveAspectRatio="none" aria-hidden>
            {line && (
              <>
                <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} stroke={lineColor} strokeOpacity=".35" strokeWidth={brush * k} strokeLinecap="round" />
                <line x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y} stroke="#fff" strokeWidth={1.6 * k} strokeDasharray={`${6 * k} ${5 * k}`} />
              </>
            )}
            {poly.length > 0 && (
              <>
                <path d={`${poly.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('')}${closed ? 'Z' : ''}`} fill={closed ? lineColor : 'none'} fillOpacity=".22" stroke="#fff" strokeWidth={2.4 * k} strokeLinejoin="round" />
                <path d={`${poly.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('')}${closed ? 'Z' : ''}`} fill="none" stroke={lineColor} strokeWidth={1.4 * k} strokeDasharray={`${6 * k} ${5 * k}`} strokeLinejoin="round" />
                {poly.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={(i === 0 && poly.length >= 3 && !closed ? 10 : 6) * k} fill={i === 0 ? lineColor : '#fff'} stroke="#101014" strokeWidth={1.5 * k} />)}
              </>
            )}
          </svg>
        </div>

        {busy && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex w-[260px] flex-col items-center gap-3 rounded-3xl bg-white/10 px-6 py-7 text-center backdrop-blur">
              <Loader2 size={30} className="animate-spin" />
              <div className="text-[15px] font-extrabold">{stage === 'model' ? 'Getting the cut-out tool ready…' : 'Finding your subject…'}</div>
              {stage === 'model' && (
                <>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                  <div className="text-[12px] text-white/60">One-time download, about 19 MB. Your photo stays on this phone.</div>
                </>
              )}
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div className="absolute inset-0 grid place-items-center px-8 text-center">
            <div>
              <div className="text-4xl">😕</div>
              <p className="mx-auto my-3 max-w-[280px] text-[14.5px] leading-snug text-white/80">{error || 'We could not cut that out.'}</p>
              <button type="button" onClick={onClose} className="h-11 rounded-full border-0 bg-white px-6 text-[14.5px] font-semibold text-[#17171a]">Close</button>
            </div>
          </div>
        )}
        {stage === 'ready' && error && <p role="alert" className="absolute bottom-2 m-0 rounded-full bg-[#d6455d] px-4 py-2 text-[13px] font-semibold">{error}</p>}
      </div>

      <div className="space-y-2.5 px-4 pt-2" style={{ paddingBottom: 'calc(var(--safe-bottom) + 14px)', opacity: stage === 'ready' ? 1 : 0.35, pointerEvents: stage === 'ready' ? 'auto' : 'none' }}>
        {/* how to touch it up */}
        <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-white/10 p-1" role="radiogroup" aria-label="Tool">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id} type="button" role="radio" aria-checked={tool === id} onClick={() => { setTool(id); setLine(null); if (id !== 'shape') { setPoly([]); setClosed(false) } }}
              className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border-0 text-[11px] font-bold"
              style={tool === id ? { background: '#fff', color: '#17171a' } : { background: 'transparent', color: 'rgba(255,255,255,.8)' }}
            ><Icon size={16} />{label}</button>
          ))}
        </div>

        {tool === 'shape' && (
          <div className="flex items-center gap-2">
            {!closed ? (
              <>
                <p className="m-0 min-w-0 flex-1 text-[12.5px] leading-snug text-white/70">Tap points around the area. Tap the first dot to close the shape.</p>
                <button type="button" onClick={() => setPoly((l) => l.slice(0, -1))} disabled={!poly.length} className="h-10 rounded-full border-0 bg-white/12 px-3.5 text-[13px] font-semibold text-white disabled:opacity-30">Undo point</button>
                <button type="button" onClick={() => setClosed(true)} disabled={poly.length < 3} className="h-10 rounded-full border-0 bg-white px-3.5 text-[13px] font-semibold text-[#17171a] disabled:opacity-30">Close</button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => polyAction('erase')} className="h-11 flex-1 rounded-full border-0 bg-[#ff4d6d] px-2 text-[13px] font-bold text-white">Erase inside</button>
                <button type="button" onClick={() => polyAction('keep')} className="h-11 flex-1 rounded-full border-0 bg-white px-2 text-[13px] font-bold text-[#17171a]">Keep inside</button>
                <button type="button" onClick={() => polyAction('restore')} className="h-11 flex-1 rounded-full border-0 bg-[#34d399] px-2 text-[13px] font-bold text-[#0b3b2a]">Restore</button>
                <button type="button" aria-label="Cancel the shape" onClick={() => { setPoly([]); setClosed(false) }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-0 bg-white/12 text-white"><X size={17} /></button>
              </>
            )}
          </div>
        )}
        {tool === 'piece' && <p className="m-0 text-center text-[12.5px] leading-snug text-white/70">Tap any leftover bit to remove the whole piece.</p>}

        <div className="flex items-center justify-center gap-2">
          {tool !== 'piece' && tool !== 'shape' && ([['erase', 'Erase', Eraser], ['restore', 'Restore', Paintbrush]] as const).map(([id, label, Icon]) => (
            <motion.button
              key={id} type="button" whileTap={{ scale: 0.95 }} aria-pressed={mode === id} onClick={() => setMode(id)}
              className="flex h-11 items-center gap-2 rounded-full border-0 px-5 text-[14.5px] font-semibold"
              style={mode === id ? { background: '#fff', color: '#17171a' } : { background: 'rgba(255,255,255,.12)', color: '#fff' }}
            >
              <Icon size={17} /> {label}
            </motion.button>
          ))}
          <motion.button type="button" whileTap={{ scale: 0.92 }} aria-label="Undo" onClick={undo} disabled={!undoCount} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/12 text-white disabled:opacity-30"><Undo2 size={18} /></motion.button>
          <motion.button type="button" whileTap={{ scale: 0.92 }} aria-label="Clean up specks and holes" title="Clean up" onClick={tidy} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/12 text-white"><Sparkles size={18} /></motion.button>
        </div>
        {showBrushSize && (
          <div className="flex items-center gap-3">
            <span className="w-12 text-[12px] font-bold uppercase tracking-wider text-white/50">{tool === 'line' ? 'Width' : 'Brush'}</span>
            <input type="range" min={8} max={90} value={brush} onChange={(e) => setBrush(+e.target.value)} aria-label="Brush size" className="h-11 flex-1" style={{ accentColor: '#fff' }} />
          </div>
        )}
        <button type="button" role="switch" aria-checked={outline} onClick={() => setOutline((v) => !v)} className="flex min-h-11 w-full items-center justify-between rounded-2xl border-0 bg-transparent px-1 text-left text-white">
          <span className="text-[14px] font-semibold">Preview the white sticker outline</span>
          <span className="relative h-7 w-12 rounded-full transition-colors" style={{ background: outline ? '#fff' : 'rgba(255,255,255,.25)' }}>
            <motion.span className="absolute top-0.5 h-6 w-6 rounded-full" style={{ background: outline ? '#17171a' : '#fff' }} animate={{ left: outline ? 22 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
          </span>
        </button>
      </div>
    </motion.div>
  )
}
