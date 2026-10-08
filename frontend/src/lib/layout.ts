import type { CanvasItem } from '../types'

interface Box { l: number; t: number; r: number; b: number }

/** axis-aligned bounds of an item (px), including its rotation */
export function boundsOf(it: Pick<CanvasItem, 'x' | 'y' | 'width' | 'height' | 'rotation'>, canvasW: number, pad = 0): Box {
  const rad = (it.rotation * Math.PI) / 180
  const hw = (Math.abs(it.width * Math.cos(rad)) + Math.abs(it.height * Math.sin(rad))) / 2 + pad
  const hh = (Math.abs(it.width * Math.sin(rad)) + Math.abs(it.height * Math.cos(rad))) / 2 + pad
  const cx = (it.x / 100) * canvasW
  return { l: cx - hw, r: cx + hw, t: it.y - hh, b: it.y + hh }
}

const hit = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t

/**
 * Places new items in reading order (left to right, top to bottom) starting at `startY`,
 * never overlapping each other or anything already on the canvas, with `gap` px between them.
 * Returns centre positions in the same order as `sizes`.
 */
export function placeInOrder(
  sizes: { width: number; height: number; rotation: number }[],
  existing: CanvasItem[],
  canvasW: number,
  startY: number,
  gap = 28,
  vExtra = 16,
): { x: number; y: number }[] {
  const taken: Box[] = existing.filter((i) => i.type !== 'thread').map((i) => boundsOf(i, canvasW))
  const cols = sizes.length === 1 ? [0.5] : [0.25, 0.75]
  const out: { x: number; y: number }[] = []
  let y = startY
  let col = 0
  for (const s of sizes) {
    let placed = false
    for (let guard = 0; guard < 600 && !placed; guard++) {
      const cx = canvasW * cols[col]
      const cy = y + s.height / 2
      const b0 = boundsOf({ x: (cx / canvasW) * 100, y: cy, width: s.width, height: s.height, rotation: s.rotation }, canvasW, gap / 2)
      const box = { ...b0, t: b0.t - vExtra, b: b0.b + vExtra } // extra breathing room between rows
      if (!taken.some((t) => hit(box, t))) {
        taken.push(box)
        out.push({ x: (cx / canvasW) * 100, y: cy })
        placed = true
      }
      col++
      if (col >= cols.length) { col = 0; y += 30 } // next row: step down until there is room
      if (placed && col !== 0) y = Math.max(y, cy - s.height / 2) // stay on the same row for the next column
    }
    if (!placed) out.push({ x: 50, y: y + s.height / 2 })
  }
  return out
}
