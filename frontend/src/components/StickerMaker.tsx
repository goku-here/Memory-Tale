import { motion } from 'framer-motion'
import { Check, Eraser, Loader2, Paintbrush, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { composite, cutout, exportSticker, type CutoutResult } from '../lib/cutout'
import { dieCut } from './stickers'

interface Props {
  file: File
  onClose: () => void
  onSave: (dataUrl: string, ratio: number) => void
}

type Stage = 'model' | 'analyzing' | 'ready' | 'error'

const CHECKER = 'conic-gradient(#e6e6ea 25%, #f7f7f9 0 50%, #e6e6ea 0 75%, #f7f7f9 0) 0 0 / 22px 22px'

/** Cut the subject out of a photo, touch it up with Erase / Restore brushes, and save it as a sticker. */
export function StickerMaker({ file, onClose, onSave }: Props) {
  const [stage, setStage] = useState<Stage>('model')
  const [progress, setProgress] = useState(0)
  const [mode, setMode] = useState<'erase' | 'restore'>('erase')
  const [brush, setBrush] = useState(26)
  const [outline, setOutline] = useState(true)
  const [error, setError] = useState('')
  const [undoCount, setUndoCount] = useState(0)
  const res = useRef<CutoutResult | null>(null)
  const view = useRef<HTMLCanvasElement>(null)
  const history = useRef<ImageData[]>([])
  const drawing = useRef<{ x: number; y: number } | null>(null)

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

  const down = (e: React.PointerEvent) => {
    if (stage !== 'ready' || !res.current) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const m = res.current.mask
    history.current.push(m.getContext('2d')!.getImageData(0, 0, m.width, m.height))
    if (history.current.length > 12) history.current.shift()
    setUndoCount(history.current.length)
    drawing.current = null
    const p = toCanvas(e)
    stroke(p.x, p.y, p.scale)
  }
  const move = (e: React.PointerEvent) => {
    if (!(e.buttons & 1) && e.pointerType === 'mouse') return
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    const p = toCanvas(e)
    stroke(p.x, p.y, p.scale)
  }
  const up = () => { drawing.current = null }

  const undo = () => {
    const m = res.current?.mask
    const prev = history.current.pop()
    if (!m || !prev) return
    m.getContext('2d')!.putImageData(prev, 0, 0)
    setUndoCount(history.current.length)
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
            className="block max-h-[62vh] max-w-full touch-none select-none"
            style={{ cursor: 'crosshair', background: 'transparent', filter: outline ? dieCut(260) : undefined }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          />
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

      <div className="space-y-3 px-4 pt-2" style={{ paddingBottom: 'calc(var(--safe-bottom) + 16px)', opacity: stage === 'ready' ? 1 : 0.35, pointerEvents: stage === 'ready' ? 'auto' : 'none' }}>
        <div className="flex items-center justify-center gap-2">
          {([['erase', 'Erase', Eraser], ['restore', 'Restore', Paintbrush]] as const).map(([id, label, Icon]) => (
            <motion.button
              key={id} type="button" whileTap={{ scale: 0.95 }} aria-pressed={mode === id} onClick={() => setMode(id)}
              className="flex h-11 items-center gap-2 rounded-full border-0 px-5 text-[14.5px] font-semibold"
              style={mode === id ? { background: '#fff', color: '#17171a' } : { background: 'rgba(255,255,255,.12)', color: '#fff' }}
            >
              <Icon size={17} /> {label}
            </motion.button>
          ))}
          <motion.button type="button" whileTap={{ scale: 0.92 }} aria-label="Undo" onClick={undo} disabled={!undoCount} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/12 text-white disabled:opacity-30"><Undo2 size={18} /></motion.button>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-12 text-[12px] font-bold uppercase tracking-wider text-white/50">Brush</span>
          <input type="range" min={8} max={90} value={brush} onChange={(e) => setBrush(+e.target.value)} aria-label="Brush size" className="h-11 flex-1" style={{ accentColor: '#fff' }} />
        </div>
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
