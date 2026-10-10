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

/** a photo that was turned into a background */
export const isBg = (i: CanvasItem) => i.type === 'photo' && !!i.props.background

/**
 * Backgrounds always span the canvas, whatever its width is on this device, so their size is worked out
 * when drawing (never stored): that way phones with different widths cannot fight over it.
 */
export function withBackground(items: CanvasItem[], canvasW: number): CanvasItem[] {
  return items.map((i) => (i.type === 'photo' && i.props.background
    ? { ...i, x: 50, rotation: 0, width: canvasW, height: canvasW / (i.props.aspect || 1), props: { ...i.props, frame: 'none' as const, radius: 0, caption: '' } }
    : i))
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
export const rnd = (a: number, b: number) => a + Math.random() * (b - a)

/** how many lines a polaroid caption takes (about 20 characters fit on a line), words kept whole */
export function captionLines(caption: string, perLine = 20) {
  if (!caption) return 1
  let n = 0
  for (const para of caption.split('\n')) {
    let l = 1
    let cur = 0
    for (const word of para.split(' ')) {
      let len = word.length
      if (cur === 0) cur = 0
      else if (cur + 1 + len <= perLine) { cur += 1 + len; continue }
      else { l++; cur = 0 }
      while (len > perLine) { l++; len -= perLine }
      cur = len
    }
    n += l
  }
  return n
}

/** the white strip under a polaroid's picture, as a fraction of its width: one line, or room for up to four */
export const polaroidBottom = (lines: number) => (lines <= 1 ? 0.2 : 0.075 + Math.min(4, lines) * 0.118)

/** Height of a photo item for a frame at the given width. */
export function frameHeight(frame: FrameId, w: number, aspect: number, caption = '') {
  const a = clamp(aspect || 1, 0.66, 1.5)
  switch (frame) {
    case 'polaroid': return w * (0.055 + polaroidBottom(captionLines(caption))) + (w * 0.89) / a
    case 'rounded': return w / a + w * 0.044
    case 'none': return w / a
    case 'circle':
    case 'heart': return w
    case 'arch': return w * 1.3
    case 'film': return (w * 0.8) / a + w * 0.1
    case 'stamp': return (w * 0.86) / a + w * 0.14
  }
}
