import { motion } from 'framer-motion'
import { Check, ChevronDown, ChevronUp, Hand, Image as ImageIcon, Move, Redo2, Trash2, Undo2, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { shade } from '../lib/color'
import type { ResolvedCanvas } from '../lib/canvasStyle'
import type { BrushId, DrawProps, Stroke } from '../types'
import { DrawLayer, DrawStrokes } from './DrawLayer'
import { TRACE_ART, traceUrl } from '../lib/traceArt'
import { CustomColor } from './ColorPicker'
import { IcCalligraphyTool, IcCrayonTool, IcEraserTool, IcHighlighterTool, IcMarkerTool, IcPenTool, IcPencilTool } from './ToolIcons'

type ToolId = BrushId | 'eraser'
const TOOLS: { id: ToolId; label: string; icon: (c: string) => ReactNode }[] = [
  { id: 'pen', label: 'Pen', icon: (c) => <IcPenTool c={c} /> },
  { id: 'marker', label: 'Marker', icon: (c) => <IcMarkerTool c={c} /> },
  { id: 'highlighter', label: 'Highlighter', icon: (c) => <IcHighlighterTool c={c} /> },
  { id: 'pencil', label: 'Pencil', icon: (c) => <IcPencilTool c={c} /> },
  { id: 'crayon', label: 'Crayon', icon: (c) => <IcCrayonTool c={c} /> },
  { id: 'calligraphy', label: 'Calligraphy', icon: (c) => <IcCalligraphyTool c={c} /> },
  { id: 'eraser', label: 'Eraser', icon: () => <IcEraserTool /> },
]

/** thickness presets: the dot shown, and the pen size it stands for */
const SIZES = [{ dot: 5, size: 2.5 }, { dot: 9, size: 5 }, { dot: 14, size: 9 }, { dot: 20, size: 14 }, { dot: 28, size: 22 }]
/** shades of the picked colour, dark to light */
const SHADES = [0.62, 0.4, 0.2, 0, -0.25, -0.5, -0.75]
const EXTRA = ['#17171A', '#E5486F', '#F28C38', '#FFC93C', '#2F8FD0', '#5F8650', '#8F5BD0', '#FFFFFF']

const CHECKER = 'conic-gradient(#d9d9de 25%, #f4f4f6 0 50%, #d9d9de 0 75%, #f4f4f6 0) 0 0 / 12px 12px'

interface Props {
  /** the theme's colours (first = main) */
  palette: string[]
  accent: string
  /** the book's own canvas look, so the drawing page matches it */
  look: ResolvedCanvas
  /** a drawing being edited: its strokes, and how much bigger it is on the page than when it was made */
  seed?: { draw: DrawProps; scale: number }
  onDone: (strokes: Stroke[], pageW: number, pageH: number) => void
}

/** A page of its own for drawing: tools along the bottom, thickness and opacity, and the theme's colours with their shades. */
export function DrawStudio({ palette, accent, look, seed, onDone }: Props) {
  const page = useRef<HTMLDivElement>(null)
  const shelf = useRef<HTMLDivElement>(null)
  const [shelfH, setShelfH] = useState(150)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const strokesRef = useRef<Stroke[]>([])
  strokesRef.current = strokes
  const [past, setPast] = useState<Stroke[][]>([])
  const [future, setFuture] = useState<Stroke[][]>([])
  const [tool, setTool] = useState<ToolId>('pen')
  const [base, setBase] = useState(palette[0] ?? '#17171A')
  const [shadeAt, setShadeAt] = useState(3)
  const [size, setSize] = useState(SIZES[1].size)
  const [opacity, setOpacity] = useState(1)
  /** the page grows as you draw towards its bottom, and follows your finger when you reach an edge */
  const scroller = useRef<HTMLDivElement>(null)
  const [extra, setExtra] = useState(0)
  const touch = useRef<{ y: number; y0: number; moved: boolean } | null>(null)
  const raf = useRef(0)
  const shelfRef = useRef(150)
  /** hand on: a finger scrolls the page and nothing is drawn */
  const [hand, setHand] = useState(false)
  const [pop, setPop] = useState<null | 'tune' | 'color' | 'trace'>(null)
  /** a picture to trace over: shown faintly under the strokes, never part of the drawing */
  const [trace, setTrace] = useState<{ url: string; x: number; y: number; w: number; own?: boolean } | null>(null)
  const [traceOp, setTraceOp] = useState(0.4)
  const [pickOpen, setPickOpen] = useState(false)
  const [moveTrace, setMoveTrace] = useState(false)
  const own = useRef<HTMLInputElement>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)

  const color = shade(base, SHADES[shadeAt])
  const eraser = tool === 'eraser'
  const hues = [...new Set([EXTRA[0], ...palette.filter((c) => c.toUpperCase() !== '#FFFFFF'), ...EXTRA.slice(1)].map((c) => c.toUpperCase()))].slice(0, 12)

  /** an edited drawing is laid out in the middle of the page at the size it has on the canvas */
  useEffect(() => {
    const r = page.current?.getBoundingClientRect()
    if (!seed || !r) return
    const k = seed.scale, ox = r.width / 2 - (seed.draw.w * k) / 2, oy = r.height / 2 - (seed.draw.h * k) / 2
    setStrokes(seed.draw.strokes.map((s) => ({ ...s, size: s.size * k, points: s.points.map(([x, y]) => [Math.round((x * k + ox) * 10) / 10, Math.round((y * k + oy) * 10) / 10] as [number, number]) })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const el = shelf.current
    if (!el) return
    const ro = new ResizeObserver(() => setShelfH(el.offsetHeight))
    ro.observe(el)
    setShelfH(el.offsetHeight)
    return () => ro.disconnect()
  }, [])

  shelfRef.current = shelfH
  const tick = () => {
    const el = scroller.current, t = touch.current
    if (!el || !t) { raf.current = 0; return }
    const r = el.getBoundingClientRect()
    const low = r.bottom - shelfRef.current - 70, high = r.top + 80
    let v = 0
    if (!t.moved) v = 0
    else if (t.y > low) v = Math.min(9, (t.y - low) * 0.12 + 1.5)
    else if (t.y < high && el.scrollTop > 0) v = -Math.min(9, (high - t.y) * 0.12 + 1.5)
    if (v) {
      if (v > 0 && el.scrollTop + el.clientHeight > el.scrollHeight - 300) setExtra((x) => x + 600)
      el.scrollTop += v
    }
    raf.current = requestAnimationFrame(tick)
  }
  const track_ = (e: React.PointerEvent) => { const t = touch.current; if (t) { t.y = e.clientY; if (Math.abs(e.clientY - t.y0) > 8) t.moved = true } }
  const startTrack = (e: React.PointerEvent) => {
    // only a stroke in progress moves the page: a tap near the edge, or on a button, leaves it alone
    if (e.button > 0 || !(e.target as HTMLElement).closest('[aria-label="Drawing area"]')) return
    touch.current = { y: e.clientY, y0: e.clientY, moved: false }
    if (!raf.current) raf.current = requestAnimationFrame(tick)
  }
  const stopTrack = () => { touch.current = null }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const grow = (el: HTMLDivElement) => { if (el.scrollTop + el.clientHeight > el.scrollHeight - 300) setExtra((x) => x + 600) }
  /** the side arrows: a tap moves the page by half a screen, holding keeps it moving */
  const hold = useRef<{ t: number; r: number; on: boolean } | null>(null)
  const arrowDown = (dir: 1 | -1) => {
    const el = scroller.current
    if (!el) return
    const h = { t: 0, r: 0, on: false }
    hold.current = h
    const loop = () => { if (hold.current !== h) return; if (dir > 0) grow(el); el.scrollTop += dir * 11; h.r = requestAnimationFrame(loop) }
    h.t = window.setTimeout(() => { h.on = true; loop() }, 240)
  }
  const arrowUp = (dir: 1 | -1) => {
    const h = hold.current, el = scroller.current
    hold.current = null
    if (!h || !el) return
    clearTimeout(h.t); cancelAnimationFrame(h.r)
    if (!h.on) { if (dir > 0) grow(el); setTimeout(() => el.scrollBy({ top: dir * el.clientHeight * 0.5, behavior: 'smooth' }), 40) }
  }

  /** put a picture on the page, in the middle of what is on screen */
  const putTrace = (url: string, isOwn = false) => {
    const pw = page.current?.getBoundingClientRect().width ?? 360
    const w = Math.round(Math.min(pw * 0.8, 360))
    setTrace({ url, x: Math.round((pw - w) / 2), y: Math.round((scroller.current?.scrollTop ?? 0) + 110), w, own: isOwn })
    setPickOpen(false)
    setPop('trace')
    setMoveTrace(false)
  }
  const dropTrace = () => { if (trace?.own) URL.revokeObjectURL(trace.url); setTrace(null); setPop(null); setMoveTrace(false) }
  const onOwn = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) { if (trace?.own) URL.revokeObjectURL(trace.url); putTrace(URL.createObjectURL(f), true) }
  }
  const imageButton = () => { if (!trace) setPickOpen(true); else setPop((p) => (p === 'trace' ? null : 'trace')) }

  const begin = () => { setPop(null); setPast((p) => [...p.slice(-40), strokesRef.current]); setFuture([]) }
  const undo = () => { const prev = past[past.length - 1]; if (!prev) return; setFuture((f) => [...f, strokesRef.current]); setPast((p) => p.slice(0, -1)); setStrokes(prev) }
  const redo = () => { const next = future[future.length - 1]; if (!next) return; setPast((p) => [...p, strokesRef.current]); setFuture((f) => f.slice(0, -1)); setStrokes(next) }
  const clear = () => { if (!strokes.length) return; setPast((p) => [...p.slice(-40), strokes]); setFuture([]); setStrokes([]) }
  const done = () => { const r = page.current?.getBoundingClientRect(); onDone(strokes, r?.width ?? 360, r?.height ?? 640) }

  const pickTool = (id: ToolId) => {
    if (id === tool) setPop((p) => (p === 'tune' ? null : 'tune'))
    else { setTool(id); setPop(null) }
  }

  /** the opacity slider: drag anywhere on the track */
  const track = useRef<HTMLDivElement>(null)
  const setFrom = (clientX: number) => {
    const r = track.current?.getBoundingClientRect()
    if (r) setOpacity(Math.round(Math.max(0.1, Math.min(1, (clientX - r.left) / r.width)) * 100) / 100)
  }

  const card = 'rounded-[22px] bg-white shadow-[0_10px_34px_rgba(20,24,40,.2),0_0_0_1px_rgba(20,24,40,.05)]'

  return (
    <motion.div
      className="fixed inset-0 z-[62]" role="dialog" aria-label="Draw"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
      onPointerDown={startTrack} onPointerMove={track_} onPointerUp={stopTrack} onPointerCancel={stopTrack}
      onWheel={(e) => { const el = scroller.current; if (!el) return; if (e.deltaY > 0 && el.scrollTop + el.clientHeight > el.scrollHeight - 300) setExtra((x) => x + 600); el.scrollTop += e.deltaY }}
    >
      <div className="absolute inset-0 bg-black/35" aria-hidden />
      <motion.div
        className="absolute inset-x-0 bottom-0 mx-auto max-w-[520px] overflow-hidden rounded-t-[30px]"
        style={{ top: 'calc(var(--safe-top) + 6px)', background: look.bg }}
        initial={{ y: 60 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        {/* the page: your canvas look, strokes on top */}
        <div ref={scroller} onScroll={(e) => grow(e.currentTarget)} className="no-scrollbar absolute inset-0 overflow-y-auto" style={{ touchAction: hand ? 'pan-y' : 'none', overscrollBehavior: 'contain' }}>
          <div ref={page} className="relative" style={{ ...look.css, minHeight: `calc(100% + ${extra}px)` }}>
            {trace && (
              <img
                src={trace.url} alt="" draggable={false}
                onPointerDown={(e) => { if (!moveTrace) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, ox: trace.x, oy: trace.y } }}
                onPointerMove={(e) => { const d = drag.current; if (d) setTrace((t) => t && { ...t, x: Math.round(d.ox + e.clientX - d.x), y: Math.round(d.oy + e.clientY - d.y) }) }}
                onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}
                style={{ position: 'absolute', left: trace.x, top: trace.y, width: trace.w, height: 'auto', opacity: traceOp, pointerEvents: moveTrace ? 'auto' : 'none', touchAction: 'none', cursor: moveTrace ? 'grab' : undefined, outline: moveTrace ? `2px dashed ${accent}` : undefined, outlineOffset: 4 }}
              />
            )}
            <DrawStrokes strokes={strokes} />
          </div>
        </div>
        <DrawLayer
          surfaceRef={page} strokes={strokes} color={color} size={size} brush={eraser ? 'pen' : tool} opacity={opacity} erase={eraser}
          onChange={setStrokes} onBegin={begin} bottomInset={shelfH} off={hand || (moveTrace && pop === 'trace')}
        />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 z-[50] flex items-center gap-1 px-3 pt-3">
          <button type="button" aria-label="Undo" onClick={undo} disabled={!past.length} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/80 text-[#17171a] backdrop-blur disabled:opacity-30"><Undo2 size={20} /></button>
          <button type="button" aria-label="Redo" onClick={redo} disabled={!future.length} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/80 text-[#17171a] backdrop-blur disabled:opacity-30"><Redo2 size={20} /></button>
          <button
            type="button" aria-label={hand ? 'Back to drawing' : 'Scroll with your finger'} aria-pressed={hand} onClick={() => { setHand((v) => !v); setPop(null) }}
            className="ml-1 grid h-11 w-11 place-items-center rounded-full border-0 backdrop-blur"
            style={hand ? { background: '#17171a', color: '#fff' } : { background: 'rgba(255,255,255,.8)', color: '#17171a' }}
          ><Hand size={20} /></button>
          <button
            type="button" aria-label="Trace a picture" aria-pressed={!!trace} onClick={imageButton}
            className="ml-1 flex h-11 items-center gap-1.5 rounded-full border-0 px-3.5 text-[14px] font-bold backdrop-blur"
            style={trace ? { background: '#17171a', color: '#fff' } : { background: 'rgba(255,255,255,.8)', color: '#17171a' }}
          ><ImageIcon size={18} /> Image</button>
          <span className="flex-1" />
          <button type="button" aria-label="Clear the drawing" onClick={clear} disabled={!strokes.length} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/80 text-[#17171a] backdrop-blur disabled:opacity-30"><Trash2 size={19} /></button>
          <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={done} className="ml-1 flex h-11 items-center gap-1.5 rounded-full border-0 bg-[#17171a] px-5 text-[15px] font-semibold text-white">
            <Check size={18} strokeWidth={3} /> Done
          </motion.button>
        </div>

          <button
            type="button" aria-label="Scroll up" onPointerDown={(e) => { e.stopPropagation(); arrowDown(-1) }} onPointerUp={() => arrowUp(-1)} onPointerLeave={() => arrowUp(-1)} onPointerCancel={() => arrowUp(-1)}
            className="absolute right-3 z-[52] grid h-11 w-11 touch-none place-items-center rounded-full border-0 bg-white/90 text-[#17171a] shadow-[0_4px_14px_rgba(20,24,40,.22)] backdrop-blur" style={{ top: 72 }}
          ><ChevronUp size={22} strokeWidth={2.6} /></button>
          <button
            type="button" aria-label="Scroll down" onPointerDown={(e) => { e.stopPropagation(); arrowDown(1) }} onPointerUp={() => arrowUp(1)} onPointerLeave={() => arrowUp(1)} onPointerCancel={() => arrowUp(1)}
            className="absolute right-3 z-[52] grid h-11 w-11 touch-none place-items-center rounded-full border-0 bg-white/90 text-[#17171a] shadow-[0_4px_14px_rgba(20,24,40,.22)] backdrop-blur" style={{ bottom: shelfH + 14 }}
          ><ChevronDown size={22} strokeWidth={2.6} /></button>

        {/* the picture being traced: how faint, how big, where, or take it away */}
        {pop === 'trace' && trace && (
          <motion.div
            className="absolute inset-x-3 z-[55] mx-auto max-w-[400px]" style={{ bottom: shelfH + 10 }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onPointerDown={(e) => e.stopPropagation()}
          >
            <div className={`${card} space-y-1 px-4 pb-3 pt-3`}>
              <label className="flex items-center gap-3">
                <span className="w-14 text-[12px] font-extrabold uppercase tracking-wider text-neutral-400">Faint</span>
                <input type="range" min={10} max={90} value={Math.round(traceOp * 100)} aria-label="How faint the picture is" onChange={(e) => setTraceOp(+e.target.value / 100)} className="h-10 flex-1" style={{ accentColor: accent }} />
              </label>
              <label className="flex items-center gap-3">
                <span className="w-14 text-[12px] font-extrabold uppercase tracking-wider text-neutral-400">Size</span>
                <input
                  type="range" min={60} max={900} value={trace.w} aria-label="Picture size"
                  onChange={(e) => { const w = +e.target.value; setTrace((t) => t && { ...t, w, x: Math.round(t.x + (t.w - w) / 2), y: Math.round(t.y + (t.w - w) / 2) }) }}
                  className="h-10 flex-1" style={{ accentColor: accent }}
                />
              </label>
              <div className="flex gap-2 pt-1">
                <button type="button" aria-pressed={moveTrace} onClick={() => setMoveTrace((v) => !v)} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border-0 text-[13.5px] font-bold" style={moveTrace ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#17171a' }}><Move size={16} /> {moveTrace ? 'Drag it, then tap here' : 'Move'}</button>
                <button type="button" onClick={() => { setPop(null); setMoveTrace(false); setPickOpen(true) }} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full border-0 bg-[#f1f1f3] text-[13.5px] font-bold text-[#17171a]"><ImageIcon size={16} /> Change</button>
                <button type="button" aria-label="Remove the picture" onClick={dropTrace} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-[#fdecef] text-[#d6455d]"><Trash2 size={17} /></button>
              </div>
            </div>
          </motion.div>
        )}

        {/* choose a picture to trace */}
        {pickOpen && (
          <motion.div className="absolute inset-0 z-[70]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onPointerDown={(e) => e.stopPropagation()}>
            <div className="absolute inset-0 bg-black/30" onClick={() => setPickOpen(false)} aria-hidden />
            <motion.div
              className="absolute inset-x-0 bottom-0 max-h-[78%] overflow-y-auto rounded-t-[28px] bg-white pb-6" role="dialog" aria-label="Pick a picture to trace"
              initial={{ y: 80 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <div className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 pb-2 pt-4">
                <h3 className="m-0 text-[17px] font-extrabold text-[#17171a]">Trace a picture</h3>
                <button type="button" aria-label="Close" onClick={() => setPickOpen(false)} className="grid h-9 w-9 place-items-center rounded-full border-0 bg-neutral-100 text-neutral-600"><X size={17} /></button>
              </div>
              <p className="m-0 px-5 pb-3 text-[13px] leading-snug text-neutral-500">It shows faintly on your page so you can draw over it. It is never added to your drawing.</p>
              <div className="px-5 pb-3">
                <button type="button" onClick={() => own.current?.click()} className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-0 text-[14.5px] font-bold text-white" style={{ background: accent }}><ImageIcon size={18} /> Use one of my photos</button>
                <input ref={own} type="file" accept="image/*" className="hidden" onChange={onOwn} />
              </div>
              <div className="grid grid-cols-4 gap-2 px-4">
                {TRACE_ART.map((a) => (
                  <button key={a.id} type="button" aria-label={a.label} onClick={() => putTrace(traceUrl(a))} className="flex flex-col items-center gap-1 rounded-2xl border-0 bg-[#f6f6f8] px-1 pb-2 pt-2.5">
                    <img src={traceUrl(a)} alt="" className="h-14 w-14" draggable={false} />
                    <span className="text-[11px] font-bold text-neutral-500">{a.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* thickness and opacity */}
        {pop === 'tune' && (
          <motion.div
            className="absolute inset-x-3 z-[55] flex items-stretch justify-center gap-2" style={{ bottom: shelfH + 10 }}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} onPointerDown={(e) => e.stopPropagation()}
          >
            {!eraser && (
              <div className={`${card} flex min-w-0 flex-1 items-center px-4 py-3.5`}>
                <div
                  ref={track} role="slider" aria-label="Opacity" aria-valuemin={10} aria-valuemax={100} aria-valuenow={Math.round(opacity * 100)}
                  className="relative h-9 w-full touch-none rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${color}), ${CHECKER}` }}
                  onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setFrom(e.clientX) }}
                  onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) setFrom(e.clientX) }}
                >
                  <span className="absolute top-1/2 h-9 w-9 -translate-y-1/2 rounded-full bg-white shadow-[0_2px_8px_rgba(0,0,0,.3)]" style={{ left: `calc(${((opacity - 0.1) / 0.9) * 100}% - ${((opacity - 0.1) / 0.9) * 36}px)` }} />
                </div>
              </div>
            )}
            <div className={`${card} flex flex-1 items-center justify-around px-2 py-3.5`}>
              {SIZES.map((s) => {
                const on = Math.abs(size - s.size) < 0.01
                return (
                  <button key={s.size} type="button" aria-label={`Thickness ${s.size}`} onClick={() => setSize(s.size)} className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent">
                    <span className="rounded-full" style={{ width: s.dot, height: s.dot, background: eraser ? '#f0a3a3' : on ? '#17171a' : '#b9b9c1', boxShadow: on ? `0 0 0 3px #fff, 0 0 0 4.5px ${accent}` : 'none' }} />
                  </button>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* the theme's colours and their shades: the tools step out of the way while this is open */}
        {pop === 'color' && !eraser && (
          <motion.div
            className="absolute inset-x-3 z-[55] mx-auto max-w-[360px]" style={{ bottom: 'calc(var(--safe-bottom) + 18px)' }}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} onPointerDown={(e) => e.stopPropagation()}
          >
            <div className={`${card} px-4 pb-4 pt-3.5`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-extrabold uppercase tracking-wider text-neutral-400">Shade</span>
                <button type="button" aria-label="Close colours" onClick={() => setPop(null)} className="grid h-8 w-8 place-items-center rounded-full border-0 bg-neutral-100 text-neutral-600"><Check size={16} strokeWidth={3} /></button>
              </div>
              <div className="flex items-center justify-between">
                {SHADES.map((amt, i) => {
                  const c = shade(base, amt)
                  const on = i === shadeAt
                  return (
                    <button key={amt} type="button" aria-label={`Shade ${i + 1}`} aria-pressed={on} onClick={() => setShadeAt(i)} className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent">
                      <span className="h-8 w-8 rounded-full" style={{ background: c, boxShadow: on ? `0 0 0 2.5px #fff, 0 0 0 4.5px ${accent}` : 'inset 0 0 0 1px rgba(0,0,0,.14)' }} />
                    </button>
                  )
                })}
              </div>
              <div className="mb-2 mt-3 text-[12px] font-extrabold uppercase tracking-wider text-neutral-400">Colour</div>
              <div className="grid grid-cols-6 justify-items-center gap-y-2">
                {hues.map((h) => {
                  const on = h === base.toUpperCase()
                  return (
                    <button key={h} type="button" aria-label={`Colour ${h}`} aria-pressed={on} onClick={() => { setBase(h); setShadeAt(3) }} className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent">
                      <span className="h-8 w-8 rounded-full" style={{ background: h, boxShadow: on ? `0 0 0 2.5px #fff, 0 0 0 4.5px ${accent}` : 'inset 0 0 0 1px rgba(0,0,0,.14)' }} />
                    </button>
                  )
                })}
                <CustomColor value={base} listed={hues.includes(base.toUpperCase())} accent={accent} onPick={(c) => { setBase(c); setShadeAt(3) }} cell="h-10 w-10" dot={32} />
              </div>
            </div>
          </motion.div>
        )}

        {/* tools along the bottom */}
        <div ref={shelf} className="absolute inset-x-0 bottom-0 z-[50] flex items-end pl-3" style={{ paddingBottom: 'var(--safe-bottom)', transform: pop === 'color' ? 'translateY(130%)' : 'none', opacity: pop === 'color' ? 0 : 1, transition: 'transform .22s ease, opacity .18s', pointerEvents: pop === 'color' ? 'none' : 'auto' }}>
          <button
            type="button" aria-label="Colour" aria-pressed={pop === 'color'} disabled={eraser} onClick={() => setPop((p) => (p === 'color' ? null : 'color'))}
            className="mb-5 grid h-12 w-12 shrink-0 place-items-center rounded-full border-0 bg-transparent disabled:opacity-30"
          >
            <span className="h-10 w-10 rounded-full" style={{ background: color, boxShadow: '0 0 0 3px #fff, 0 3px 10px rgba(0,0,0,.28)' }} />
          </button>
          <div className="no-scrollbar flex flex-1 items-end gap-3 overflow-x-auto px-3 pt-3" style={{ touchAction: 'pan-x' }} role="radiogroup" aria-label="Drawing tool">
            {TOOLS.map((t) => {
              const on = t.id === tool
              return (
                <button
                  key={t.id} type="button" role="radio" aria-checked={on} aria-label={t.label} onClick={() => pickTool(t.id)}
                  className="relative h-[132px] w-[62px] shrink-0 overflow-hidden border-0 bg-transparent p-0"
                >
                  <span
                    className="absolute inset-x-0 top-0 flex justify-center [&_svg]:h-[124px] [&_svg]:w-[124px]"
                    style={{ transform: `translateY(${on ? 0 : 16}px)`, transition: 'transform .18s ease', filter: 'drop-shadow(0 4px 5px rgba(20,24,40,.3)) drop-shadow(0 0 1px rgba(20,24,40,.25))' }}
                  >{t.icon(color)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}
