import { cubicBezier } from 'framer-motion'

export const bookEase = cubicBezier(0.5, 0, 0.12, 1)
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** Geometry of the book growing from its grid slot to fill the screen. */
export function bookGeom(rect: DOMRect) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  return {
    vw, vh,
    S: Math.max(vh / rect.height, vw / rect.width) * 1.06,
    dx: vw / 2 - (rect.left + rect.width / 2),
    dy: vh / 2 - (rect.top + rect.height / 2),
  }
}

/**
 * clip-path that makes the real canvas visible exactly through the (growing) book,
 * so the inside is already on the page while the cover swings open.
 * `e` is the eased progress 0..1.
 */
export function clipAt(rect: DOMRect, e: number) {
  const { vw, vh, S, dx, dy } = bookGeom(rect)
  const s = 1 + (S - 1) * e
  const cx = rect.left + rect.width / 2 + dx * e
  const cy = rect.top + rect.height / 2 + dy * e
  const w = rect.width * s
  const h = rect.height * s
  const f = (n: number) => `${Math.max(0, n).toFixed(1)}px`
  const rs = rect.width * 0.05 * s
  const rl = rect.width * 0.022 * s
  return `inset(${f(cy - h / 2)} ${f(vw - (cx + w / 2))} ${f(vh - (cy + h / 2))} ${f(cx - w / 2)} round ${rl}px ${rs}px ${rs}px ${rl}px)`
}
