import { useRef, type RefObject } from 'react'
import type { DrawProps, Stroke } from '../types'

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

/** Stored drawing, scaled with its item box. */
export function DrawItem({ draw }: { draw: DrawProps }) {
  return (
    <svg viewBox={`0 0 ${draw.w} ${draw.h}`} width="100%" height="100%" preserveAspectRatio="none" style={{ overflow: 'visible' }}>
      {draw.strokes.map((s, i) => (
        <path key={i} d={strokePath(s.points)} stroke={s.color} strokeWidth={s.size} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

/** Strokes in canvas coordinates, rendered inside the canvas surface while drawing. */
export function DrawStrokes({ strokes }: { strokes: Stroke[] }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 9000 }} aria-hidden>
      {strokes.map((s, i) => (
        <path key={i} d={strokePath(s.points)} stroke={s.color} strokeWidth={s.size} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}

interface Props {
  surfaceRef: RefObject<HTMLDivElement | null>
  strokes: Stroke[]
  color: string
  size: number
  onChange: (s: Stroke[]) => void
  /** px at the bottom the sheet covers (pen input is ignored there) */
  bottomInset: number
  /** canvas zoom (1 = fit to width) */
  zoom?: number
}

/** Transparent pointer-capture layer for freehand drawing (page scroll is locked while active). */
export function DrawLayer({ surfaceRef, strokes, color, size, onChange, bottomInset, zoom = 1 }: Props) {
  const drawing = useRef(false)
  const live = useRef<Stroke[]>(strokes)
  live.current = strokes

  const pos = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = surfaceRef.current!.getBoundingClientRect()
    return [Math.round(((e.clientX - r.left) / zoom) * 10) / 10, Math.round(((e.clientY - r.top) / zoom) * 10) / 10]
  }

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
        onChange([...live.current, { color, size, points: [pos(e)] }])
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return
        const co = e.nativeEvent.getCoalescedEvents?.()
        const evs = co && co.length ? co : [e.nativeEvent]
        const cur = live.current
        const last = cur[cur.length - 1]
        if (!last) return
        const pts = [...last.points]
        for (const ev of evs) {
          const p = pos(ev)
          const q = pts[pts.length - 1]
          if (!q || Math.hypot(p[0] - q[0], p[1] - q[1]) > 1.6) pts.push(p)
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
    const pad = s.size / 2 + 2
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
