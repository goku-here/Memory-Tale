import type { CanvasItem, FrameId } from '../types'
import { uid } from './id'

export const MIN_HEIGHT = 2400

export function nextZ(items: CanvasItem[]) {
  return items.reduce((m, i) => Math.max(m, i.zIndex), 0) + 1
}

/** Distribute z-indexes 1..n following the current stacking order. */
export function normalizeZ(items: CanvasItem[]) {
  const order = [...items].sort((a, b) => a.zIndex - b.zIndex)
  const map = new Map(order.map((it, i) => [it.id, i + 1]))
  return items.map((it) => (map.get(it.id) === it.zIndex ? it : { ...it, zIndex: map.get(it.id)! }))
}

export function cloneItem(item: CanvasItem, z: number): CanvasItem {
  return { ...structuredClone(item), id: uid(), x: Math.min(95, item.x + 5), y: item.y + 36, zIndex: z }
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const rnd = (a: number, b: number) => a + Math.random() * (b - a)

/** Height of a photo item for a frame at the given width. */
export function frameHeight(frame: FrameId, w: number, aspect: number) {
  const a = clamp(aspect || 1, 0.66, 1.5)
  switch (frame) {
    case 'polaroid': return w * (0.055 + 0.2) + (w * 0.89) / a
    case 'rounded': return w / a + w * 0.044
    case 'none': return w / a
    case 'circle':
    case 'heart': return w
    case 'arch': return w * 1.3
    case 'film': return (w * 0.8) / a + w * 0.1
    case 'stamp': return (w * 0.86) / a + w * 0.14
  }
}
