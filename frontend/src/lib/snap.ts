import type { CanvasItem } from '../types'

/** how close (px) an edge or centre must come to another item's before it snaps */
export const SNAP = 4

export interface Guides {
  v: { x: number; y1: number; y2: number }[]
  h: { y: number; x1: number; x2: number }[]
}

interface Box { l: number; r: number; t: number; b: number }

function box(it: CanvasItem, cx: number, cy: number): Box {
  const a = (it.rotation * Math.PI) / 180
  const w = Math.abs(it.width * Math.cos(a)) + Math.abs(it.height * Math.sin(a))
  const h = Math.abs(it.width * Math.sin(a)) + Math.abs(it.height * Math.cos(a))
  return { l: cx - w / 2, r: cx + w / 2, t: cy - h / 2, b: cy + h / 2 }
}

const xs = (b: Box) => [b.l, (b.l + b.r) / 2, b.r]
const ys = (b: Box) => [b.t, (b.t + b.b) / 2, b.b]

/**
 * While dragging `item` to (nx, ny) (centre, px): nudge it onto nearby items' edges/centres (and the
 * canvas centre line) and report the alignment lines to draw. Stateless, so letting go of the snap
 * just means dragging past the threshold.
 */
export function snapDrag(item: CanvasItem, nx: number, ny: number, W: number, items: CanvasItem[]): { x: number; y: number; guides: Guides } {
  const near = items
    .filter((o) => o.id !== item.id && o.type !== 'thread' && Math.abs(o.y - ny) < 900)
    .map((o) => box(o, (o.x / 100) * W, o.y))
  const me = box(item, nx, ny)

  const pick = (mine: number[], targets: number[]) => {
    let best: number | null = null
    for (const a of mine) for (const t of targets) {
      const d = t - a
      if (Math.abs(d) <= SNAP && (best === null || Math.abs(d) < Math.abs(best))) best = d
    }
    return best ?? 0
  }
  const dx = pick(xs(me), [W / 2, ...near.flatMap(xs)])
  const dy = pick(ys(me), near.flatMap(ys))
  const fin = { l: me.l + dx, r: me.r + dx, t: me.t + dy, b: me.b + dy }

  const guides: Guides = { v: [], h: [] }
  const vmap = new Map<number, { x: number; y1: number; y2: number }>()
  const hmap = new Map<number, { y: number; x1: number; x2: number }>()
  if (dx !== 0 || Math.abs(W / 2 - (xs(fin)[1])) < 0.75) {
    for (const a of xs(fin)) {
      if (Math.abs(a - W / 2) < 0.75) vmap.set(Math.round(a), { x: a, y1: fin.t - 24, y2: fin.b + 24 })
    }
  }
  for (const o of near) {
    for (const a of xs(fin)) for (const t of xs(o)) {
      if (Math.abs(a - t) < 0.75) {
        const k = Math.round(t), e = vmap.get(k)
        const y1 = Math.min(fin.t, o.t) - 12, y2 = Math.max(fin.b, o.b) + 12
        vmap.set(k, e ? { x: t, y1: Math.min(e.y1, y1), y2: Math.max(e.y2, y2) } : { x: t, y1, y2 })
      }
    }
    for (const a of ys(fin)) for (const t of ys(o)) {
      if (Math.abs(a - t) < 0.75) {
        const k = Math.round(t), e = hmap.get(k)
        const x1 = Math.min(fin.l, o.l) - 12, x2 = Math.max(fin.r, o.r) + 12
        hmap.set(k, e ? { y: t, x1: Math.min(e.x1, x1), x2: Math.max(e.x2, x2) } : { y: t, x1, x2 })
      }
    }
  }
  guides.v = [...vmap.values()]
  guides.h = [...hmap.values()]
  return { x: nx + dx, y: ny + dy, guides }
}
