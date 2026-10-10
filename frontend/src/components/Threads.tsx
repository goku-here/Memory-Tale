import { useId } from 'react'
import type { CanvasItem } from '../types'

export const THREAD_COLORS = ['#6B4FBB', '#E5486F', '#2F7BE5', '#2E9E6B', '#F28C38', '#17171A']

/** Where a thread attaches: just inside the item's top edge, rotated with it. */
export function anchorOf(it: CanvasItem, W: number, offsetY = 0) {
  const lx = 0
  const ly = -it.height / 2 + Math.min(16, it.height * 0.12)
  const r = (it.rotation * Math.PI) / 180
  return {
    x: (it.x / 100) * W + lx * Math.cos(r) - ly * Math.sin(r),
    y: it.y - offsetY + lx * Math.sin(r) + ly * Math.cos(r),
  }
}

interface Props {
  items: CanvasItem[]
  canvasW: number
  offsetY?: number
  selectedId?: string | null
  onSelect?: (id: string, e: React.MouseEvent) => void
}

/** Threads (with pins) tying items together. Re-computed from item positions, so they follow drags. */
export function ThreadsSvg({ items, canvasW, offsetY = 0, selectedId, onSelect }: Props) {
  const gid = useId().replace(/:/g, '')
  const byId = new Map(items.map((i) => [i.id, i]))
  const threads = items.filter((i): i is Extract<CanvasItem, { type: 'thread' }> => i.type === 'thread')
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 8000, overflow: 'visible' }}>
      <defs>
        {THREAD_COLORS.map((c) => (
          <radialGradient key={c} id={`${gid}${c.slice(1)}`} cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#fff" stopOpacity=".85" />
            <stop offset=".35" stopColor={c} />
            <stop offset="1" stopColor={c} stopOpacity=".78" />
          </radialGradient>
        ))}
      </defs>
      {threads.map((t) => {
        const A = byId.get(t.props.a)
        const B = byId.get(t.props.b)
        if (!A || !B) return null
        const a = anchorOf(A, canvasW, offsetY)
        const b = anchorOf(B, canvasW, offsetY)
        const sel = selectedId === t.id
        const fill = `url(#${gid}${(THREAD_COLORS.includes(t.props.color) ? t.props.color : THREAD_COLORS[0]).slice(1)})`
        return (
          <g key={t.id}>
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(0,0,0,.18)" strokeWidth="4" strokeLinecap="round" transform="translate(0 2)" />
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={t.props.color} strokeWidth={sel ? 4.5 : 3} strokeLinecap="round" />
            {onSelect && (
              <line
                data-ui x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth="26" strokeLinecap="round"
                style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                onClick={(e) => onSelect(t.id, e)}
              />
            )}
            {[a, b].map((p, i) => (
              <g key={i}>
                <circle cx={p.x + 1} cy={p.y + 3} r="8" fill="rgba(0,0,0,.25)" />
                <circle cx={p.x} cy={p.y} r="8" fill={fill} stroke={t.props.color} strokeWidth=".8" />
                <circle cx={p.x - 2.4} cy={p.y - 2.6} r="2" fill="#fff" fillOpacity=".7" />
              </g>
            ))}
          </g>
        )
      })}
    </svg>
  )
}

export function threadMid(items: CanvasItem[], t: Extract<CanvasItem, { type: 'thread' }>, W: number) {
  const A = items.find((i) => i.id === t.props.a)
  const B = items.find((i) => i.id === t.props.b)
  if (!A || !B) return null
  const a = anchorOf(A, W)
  const b = anchorOf(B, W)
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}
