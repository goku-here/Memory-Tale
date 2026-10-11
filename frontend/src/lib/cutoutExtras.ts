/**
 * Mask clean-up and edge refinement for the cut-out tool (all on the phone, no model needed).
 *  - guidedFilter: snaps a soft mask to the real edges in the photo
 *  - cleanMask: drops stray specks and fills tiny holes
 *  - removePieceAt: removes one separate piece of the cut-out (tap a speck to get rid of it)
 */

/** moving-average over a (2r+1) window, both directions (edges use what is inside the picture) */
function boxMean(src: Float32Array, w: number, h: number, r: number) {
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    let sum = 0
    for (let x = 0; x <= Math.min(r, w - 1); x++) sum += src[row + x]
    for (let x = 0; x < w; x++) {
      const lo = Math.max(0, x - r), hi = Math.min(w - 1, x + r)
      tmp[row + x] = sum / (hi - lo + 1)
      if (x + r + 1 < w) sum += src[row + x + r + 1]
      if (x - r >= 0) sum -= src[row + x - r]
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let y = 0; y <= Math.min(r, h - 1); y++) sum += tmp[y * w + x]
    for (let y = 0; y < h; y++) {
      const lo = Math.max(0, y - r), hi = Math.min(h - 1, y + r)
      out[y * w + x] = sum / (hi - lo + 1)
      if (y + r + 1 < h) sum += tmp[(y + r + 1) * w + x]
      if (y - r >= 0) sum -= tmp[(y - r) * w + x]
    }
  }
  return out
}

/**
 * Guided filter (He et al.): the rough mask follows the photo's own edges, so the cut hugs hair, fur and
 * fine outlines instead of the blurry shape the network predicts at low resolution.
 */
export function guidedFilter(guide: Float32Array, p: Float32Array, w: number, h: number, r: number, eps: number) {
  const n = w * h
  const meanI = boxMean(guide, w, h, r)
  const meanP = boxMean(p, w, h, r)
  const ii = new Float32Array(n), ip = new Float32Array(n)
  for (let i = 0; i < n; i++) { ii[i] = guide[i] * guide[i]; ip[i] = guide[i] * p[i] }
  const corrI = boxMean(ii, w, h, r)
  const corrIp = boxMean(ip, w, h, r)
  const a = new Float32Array(n), b = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const varI = corrI[i] - meanI[i] * meanI[i]
    const cov = corrIp[i] - meanI[i] * meanP[i]
    a[i] = cov / (varI + eps)
    b[i] = meanP[i] - a[i] * meanI[i]
  }
  const ma = boxMean(a, w, h, r)
  const mb = boxMean(b, w, h, r)
  const q = new Float32Array(n)
  for (let i = 0; i < n; i++) q[i] = Math.min(1, Math.max(0, ma[i] * guide[i] + mb[i]))
  return q
}

/** reads a canvas's alpha channel as 0..1 */
export function alphaOf(c: HTMLCanvasElement) {
  const { width: w, height: h } = c
  const d = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data
  const out = new Float32Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4 + 3] / 255
  return out
}

/** writes 0..1 values into a canvas's alpha channel (white pixels) */
export function writeAlpha(c: HTMLCanvasElement, a: Float32Array) {
  const { width: w, height: h } = c
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  const id = ctx.createImageData(w, h)
  for (let i = 0; i < a.length; i++) {
    id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = 255
    id.data[i * 4 + 3] = Math.round(Math.min(1, Math.max(0, a[i])) * 255)
  }
  ctx.putImageData(id, 0, 0)
}

/** labels connected pieces of `on` (4-neighbour); returns the label per pixel (0 = none) and each piece's size */
function pieces(on: Uint8Array, w: number, h: number) {
  const label = new Int32Array(w * h)
  const sizes: number[] = [0]
  const stack = new Int32Array(w * h)
  let next = 0
  for (let s = 0; s < on.length; s++) {
    if (!on[s] || label[s]) continue
    next++
    let sp = 0, size = 0
    stack[sp++] = s
    label[s] = next
    while (sp) {
      const i = stack[--sp]
      size++
      const x = i % w
      if (x > 0 && on[i - 1] && !label[i - 1]) { label[i - 1] = next; stack[sp++] = i - 1 }
      if (x < w - 1 && on[i + 1] && !label[i + 1]) { label[i + 1] = next; stack[sp++] = i + 1 }
      if (i >= w && on[i - w] && !label[i - w]) { label[i - w] = next; stack[sp++] = i - w }
      if (i < on.length - w && on[i + w] && !label[i + w]) { label[i + w] = next; stack[sp++] = i + w }
    }
    sizes.push(size)
  }
  return { label, sizes }
}

/**
 * Tidies a mask: drops stray specks (pieces much smaller than the main subject) and fills tiny holes.
 * The soft edge of what is kept is left untouched.
 */
export function cleanMask(mask: HTMLCanvasElement) {
  const { width: w, height: h } = mask
  const a = alphaOf(mask)
  const on = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) on[i] = a[i] > 0.5 ? 1 : 0
  const fg = pieces(on, w, h)
  const biggest = Math.max(0, ...fg.sizes)
  for (let i = 0; i < a.length; i++) {
    const l = fg.label[i]
    if (l && fg.sizes[l] < biggest * 0.04) a[i] = 0 // a speck, not a part of the picture
  }
  // small holes inside the subject (not touching the picture's edge) are filled
  const off = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) off[i] = a[i] > 0.5 ? 0 : 1
  const bg = pieces(off, w, h)
  const touchesEdge = new Set<number>()
  for (let x = 0; x < w; x++) { touchesEdge.add(bg.label[x]); touchesEdge.add(bg.label[(h - 1) * w + x]) }
  for (let y = 0; y < h; y++) { touchesEdge.add(bg.label[y * w]); touchesEdge.add(bg.label[y * w + w - 1]) }
  for (let i = 0; i < a.length; i++) {
    const l = bg.label[i]
    if (l && !touchesEdge.has(l) && bg.sizes[l] < w * h * 0.0015) a[i] = 1
  }
  writeAlpha(mask, a)
}

/** Removes the piece of the cut-out under (x, y). Returns false when there is nothing there. */
export function removePieceAt(mask: HTMLCanvasElement, x: number, y: number) {
  const { width: w, height: h } = mask
  const ctx = mask.getContext('2d', { willReadFrequently: true })!
  const img = ctx.getImageData(0, 0, w, h)
  const px = Math.round(x), py = Math.round(y)
  if (px < 0 || py < 0 || px >= w || py >= h) return false
  const at = (i: number) => img.data[i * 4 + 3] > 24
  // a tap close to a piece counts: look around for the nearest filled pixel
  let start = -1
  for (let r = 0; r <= 14 && start < 0; r += 2) {
    for (let dy = -r; dy <= r && start < 0; dy += 2) {
      for (let dx = -r; dx <= r; dx += 2) {
        const xx = px + dx, yy = py + dy
        if (xx >= 0 && yy >= 0 && xx < w && yy < h && at(yy * w + xx)) { start = yy * w + xx; break }
      }
    }
  }
  if (start < 0) return false
  const stack = new Int32Array(w * h)
  const seen = new Uint8Array(w * h)
  let sp = 0
  stack[sp++] = start
  seen[start] = 1
  while (sp) {
    const i = stack[--sp]
    img.data[i * 4 + 3] = 0
    const xx = i % w
    if (xx > 0 && !seen[i - 1] && at(i - 1)) { seen[i - 1] = 1; stack[sp++] = i - 1 }
    if (xx < w - 1 && !seen[i + 1] && at(i + 1)) { seen[i + 1] = 1; stack[sp++] = i + 1 }
    if (i >= w && !seen[i - w] && at(i - w)) { seen[i - w] = 1; stack[sp++] = i - w }
    if (i < seen.length - w && !seen[i + w] && at(i + w)) { seen[i + w] = 1; stack[sp++] = i + w }
  }
  ctx.putImageData(img, 0, 0)
  return true
}
