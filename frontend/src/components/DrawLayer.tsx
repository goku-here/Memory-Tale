import { useRef, type RefObject } from 'react'
import type { BrushId, DrawProps, Stroke } from '../types'

export function strokePath(pts: [number, number][]) {
  if (!pts.length) return ''
  if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}l.01 0`
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2
    const my = (pts[i][1] + pts[i + 1][1]) / 2
    d += `Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`
  }
  const l = pts[pts.length - 1]
  return d + `L${l[0]} ${l[1]}`
}

export const BRUSHES: { id: BrushId; label: string }[] = [
  { id: 'pen', label: 'Pen' },
  { id: 'marker', label: 'Marker' },
  { id: 'highlighter', label: 'Highlight' },
  { id: 'pencil', label: 'Pencil' },
]

/** how a stroke of this brush is drawn */
export function brushLook(s: { size: number; brush?: BrushId }) {
  switch (s.brush) {
    case 'marker': return { width: s.size * 1.9, opacity: 0.88, cap: 'round' as const, filter: undefined, blend: undefined }
    case 'highlighter': return { width: s.size * 3.2, opacity: 0.38, cap: 'square' as const, filter: undefined, blend: 'multiply' as const }
    case 'pencil': return { width: Math.max(1.4, s.size * 0.62), opacity: 0.82, cap: 'round' as const, filter: 'url(#mt-pencil)', blend: undefined }
    default: return { width: s.size, opacity: 1, cap: 'round' as const, filter: undefined, blend: undefined }
  }
}

/** a grainy edge for the pencil */
const PencilFilter = () => (
  <defs>
    <filter id="mt-pencil" x="-5%" y="-5%" width="110%" height="110%">
      <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="3" result="n" />
      <feDisplacementMap in="SourceGraphic" in2="n" scale="2.2" />
    </filter>
  </defs>
)

function Strokes({ strokes }: { strokes: Stroke[] }) {
  return (
    <>
      <PencilFilter />
      {strokes.map((s, i) => {
        const l = brushLook(s)
        return (
          <path
            key={i} d={strokePath(s.points)} stroke={s.color} strokeWidth={l.width} strokeOpacity={l.opacity} fill="none"
            strokeLinecap={l.cap} strokeLinejoin="round" filter={l.filter} style={l.blend ? { mixBlendMode: l.blend } : undefined}
          />
        )
      })}
    </>
  )
}

/** Stored drawing, scaled with its item box. */
export function DrawItem({ draw }: { draw: DrawProps }) {
  return (
    <svg viewBox={`0 0 ${draw.w} ${draw.h}`} width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      <Strokes strokes={draw.strokes} />
    </svg>
  )
}

/** Strokes in canvas coordinates, rendered inside the canvas surface while drawing. */
export function DrawStrokes({ strokes }: { strokes: Stroke[] }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 9000 }} aria-hidden>
      <Strokes strokes={strokes} />
    </svg>
  )
}

interface Props {
  surfaceRef: RefObject<HTMLDivElement | null>
  strokes: Stroke[]
  color: string
  size: number
  brush: BrushId
  /** rub strokes out instead of drawing */
  erase: boolean
  onChange: (s: Stroke[]) => void
  /** a new stroke (or a rub) is about to start: lets the caller remember the picture for Undo */
  onBegin: () => void
  /** px at the bottom the sheet covers (pen input is ignored there) */
  bottomInset: number
  /** canvas zoom (1 = fit to width) */
  zoom?: number
}

/** takes `radius` px of every stroke around (x, y) away, splitting a stroke in two when the rub goes through the middle */
function rub(strokes: Stroke[], x: number, y: number, radius: number): Stroke[] {
  let changed = false
  const out: Stroke[] = []
  for (const s of strokes) {
    const r = radius + brushLook(s).width / 2
    if (!s.points.some(([px, py]) => Math.hypot(px - x, py - y) <= r)) { out.push(s); continue }
    changed = true
    let run: [number, number][] = []
    for (const p of s.points) {
      if (Math.hypot(p[0] - x, p[1] - y) <= r) { if (run.length) out.push({ ...s, points: run }); run = [] } else run.push(p)
    }
    if (run.length) out.push({ ...s, points: run })
  }
  return changed ? out : strokes
}

/** Transparent pointer-capture layer for freehand drawing (page scroll is locked while active). */
export function DrawLayer({ surfaceRef, strokes, color, size, brush, erase, onChange, onBegin, bottomInset, zoom = 1 }: Props) {
  const drawing = useRef(false)
  const lastRub = useRef<[number, number] | null>(null)
  const live = useRef<Stroke[]>(strokes)
  live.current = strokes

  const pos = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = surfaceRef.current!.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / zoom) * 10) / 10, Math.round(((e.clientY - r.top) / zoom) * 10) / 10]
  }
  const rubRadius = Math.max(10, size * 1.6)

  return (
    <div
      data-ui
      aria-label="Drawing area"
      className="fixed inset-x-0 top-0 touch-none"
      style={{ bottom: bottomInset, zIndex: 46, cursor: 'crosshair' }}
      onPointerDown={(e) => {
        if (e.button > 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        drawing.current = true
        onBegin()
        const p = pos(e)
        if (erase) { lastRub.current = p; const next = rub(live.current, p[0], p[1], rubRadius); if (next !== live.current) onChange(next); return }
        onChange([...live.current, { color, size, brush, points: [p] }])
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return
        const co = e.nativeEvent.getCoalescedEvents?.()
        const evs = co && co.length ? co : [e.nativeEvent]
        if (erase) {
          let cur = live.current
          for (const ev of evs) {
            const p = pos(ev)
            const from = lastRub.current ?? p
            // a fast rub skips points: rub along the whole way so nothing is left between them
            const steps = Math.max(1, Math.ceil(Math.hypot(p[0] - from[0], p[1] - from[1]) / (rubRadius * 0.6)))
            for (let i = 1; i <= steps; i++) cur = rub(cur, from[0] + ((p[0] - from[0]) * i) / steps, from[1] + ((p[1] - from[1]) * i) / steps, rubRadius)
            lastRub.current = p
          }
          if (cur !== live.current) onChange(cur)
          return
        }
        const cur = live.current
        const last = cur[cur.length - 1]
        if (!last) return
        const pts = [...last.points]
        for (const ev of evs) {
          const p = pos(ev)
          const q = pts[pts.length - 1]
          if (!q) { pts.push(p); continue }
          const d = Math.hypot(p[0] - q[0], p[1] - q[1])
          if (d <= 1.6) continue
          // a quick flick skips points: fill them in so every stroke is evenly dotted (the eraser relies on it)
          const n = Math.ceil(d / 6)
          for (let i = 1; i <= n; i++) pts.push([Math.round((q[0] + ((p[0] - q[0]) * i) / n) * 10) / 10, Math.round((q[1] + ((p[1] - q[1]) * i) / n) * 10) / 10])
        }
        onChange([...cur.slice(0, -1), { ...last, points: pts }])
      }}
      onPointerUp={() => { drawing.current = false }}
      onPointerCancel={() => { drawing.current = false }}
    />
  )
}

/** Normalises strokes (canvas coords) into a draw item box. */
export function strokesToItem(strokes: Stroke[], canvasW: number) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of strokes) {
    const pad = brushLook(s).width / 2 + 3
    for (const [x, y] of s.points) {
      minX = Math.min(minX, x - pad); minY = Math.min(minY, y - pad)
      maxX = Math.max(maxX, x + pad); maxY = Math.max(maxY, y + pad)
    }
  }
  const w = Math.max(20, maxX - minX)
  const h = Math.max(20, maxY - minY)
  const draw: DrawProps = {
    w, h,
    strokes: strokes.map((s) => ({ ...s, points: s.points.map(([x, y]) => [Math.round((x - minX) * 10) / 10, Math.round((y - minY) * 10) / 10] as [number, number]) })),
  }
  return { draw, width: w, height: h, x: ((minX + w / 2) / canvasW) * 100, y: minY + h / 2 }
}
