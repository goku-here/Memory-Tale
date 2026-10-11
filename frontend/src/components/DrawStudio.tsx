import { motion } from 'framer-motion'
import { Check, Redo2, Trash2, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { shade } from '../lib/color'
import type { ResolvedCanvas } from '../lib/canvasStyle'
import type { BrushId, DrawProps, Stroke } from '../types'
import { DrawLayer, DrawStrokes } from './DrawLayer'
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
  const [pop, setPop] = useState<null | 'tune' | 'color'>(null)

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
    >
      <div className="absolute inset-0 bg-black/35" aria-hidden />
      <motion.div
        className="absolute inset-x-0 bottom-0 mx-auto max-w-[520px] overflow-hidden rounded-t-[30px]"
        style={{ top: 'calc(var(--safe-top) + 6px)', background: look.bg }}
        initial={{ y: 60 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
        {/* the page: your canvas look, strokes on top */}
        <div ref={page} className="absolute inset-0" style={look.css}>
          <DrawStrokes strokes={strokes} />
        </div>
        <DrawLayer
          surfaceRef={page} strokes={strokes} color={color} size={size} brush={eraser ? 'pen' : tool} opacity={opacity} erase={eraser}
          onChange={setStrokes} onBegin={begin} bottomInset={shelfH}
        />

        {/* top bar */}
        <div className="absolute inset-x-0 top-0 z-[50] flex items-center gap-1 px-3 pt-3">
          <button type="button" aria-label="Undo" onClick={undo} disabled={!past.length} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/80 text-[#17171a] backdrop-blur disabled:opacity-30"><Undo2 size={20} /></button>
          <button type="button" aria-label="Redo" onClick={redo} disabled={!future.length} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/80 text-[#17171a] backdrop-blur disabled:opacity-30"><Redo2 size={20} /></button>
          <span className="flex-1" />
          <button type="button" aria-label="Clear the drawing" onClick={clear} disabled={!strokes.length} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/80 text-[#17171a] backdrop-blur disabled:opacity-30"><Trash2 size={19} /></button>
          <motion.button type="button" whileTap={{ scale: 0.95 }} onClick={done} className="ml-1 flex h-11 items-center gap-1.5 rounded-full border-0 bg-[#17171a] px-5 text-[15px] font-semibold text-white">
            <Check size={18} strokeWidth={3} /> Done
          </motion.button>
        </div>

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
