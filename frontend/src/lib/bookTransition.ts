import { cubicBezier } from 'framer-motion'

export const bookEase = cubicBezier(0.5, 0, 0.12, 1)
const flyEase = cubicBezier(0.3, 0.1, 0.2, 1)
export const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

/** the first part of the timeline: the book flies to the middle of the screen; the rest: it opens from there */
const FLY = 0.3

/** progress of the opening part alone, 0 .. 1 */
const openAt = (v: number) => bookEase(clamp01((v - FLY) / (1 - FLY)))

/**
 * Where the book is at progress `v` (0 = on the shelf, 1 = open and filling the screen):
 *  - 0 .. FLY   it lifts off its slot and flies to the middle of the screen, growing to a comfortable size
 *  - FLY .. 1   it opens from the middle: the cover swings away on its spine, and the page grows to fill the screen
 * Going back (v from 1 to 0) plays the same thing in reverse.
 */
export function bookPose(rect: DOMRect, v: number) {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const full = Math.max(vh / rect.height, vw / rect.width) * 1.06
  const rest = Math.min((vw * 0.64) / rect.width, (vh * 0.6) / rect.height)
  const dx = vw / 2 - (rect.left + rect.width / 2)
  const dy = vh / 2 - (rect.top + rect.height / 2)
  const fly = flyEase(clamp01(v / FLY))
  const open = openAt(v)
  const scale = v < FLY ? 1 + (rest - 1) * fly : rest + (full - rest) * open
  // the cover starts swinging a little after the page begins to grow
  const swing = -172 * bookEase(clamp01((open - 0.04) / 0.86))
  return { x: dx * fly, y: dy * fly, scale, swing, vw, vh }
}

/**
 * clip-path that makes the real canvas visible exactly through the (moving) book,
 * so the inside is already on the page while the cover swings open.
 */
export function clipAt(rect: DOMRect, v: number) {
  const { x, y, scale, vw, vh } = bookPose(rect, v)
  const cx = rect.left + rect.width / 2 + x
  const cy = rect.top + rect.height / 2 + y
  const w = rect.width * scale
  const h = rect.height * scale
  const f = (n: number) => `${Math.max(0, n).toFixed(1)}px`
  const rs = rect.width * 0.05 * scale
  const rl = rect.width * 0.022 * scale
  return `inset(${f(cy - h / 2)} ${f(vw - (cx + w / 2))} ${f(vh - (cy + h / 2))} ${f(cx - w / 2)} round ${rl}px ${rs}px ${rs}px ${rl}px)`
}
