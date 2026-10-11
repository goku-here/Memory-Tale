/**
 * On-device background removal.
 *
 * Model: U²-Net "u2netp" (Qin et al., Apache License 2.0), ONNX export as distributed by the rembg project (MIT).
 * Runtime: ONNX Runtime Web (MIT). Both files are served from this site (public/models, public/ort), nothing is sent
 * to any server: the photo never leaves the phone. See /licenses.
 */
import type { InferenceSession } from 'onnxruntime-web'
import { alphaOf, cleanMask, guidedFilter, writeAlpha } from './cutoutExtras'

const MODEL_URL = '/models/u2netp.onnx'
const SIZE = 320
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]
/** longest side of the working image (keeps memory and time sensible on phones) */
export const WORK_MAX = 1000

type Ort = typeof import('onnxruntime-web')
let ortP: Promise<Ort> | null = null
let sessionP: Promise<InferenceSession> | null = null

async function loadOrt(): Promise<Ort> {
  ortP ??= import('onnxruntime-web/wasm').then((m) => {
    const ort = m as unknown as Ort
    // absolute addresses: the dev server rewrites relative ones inside dynamic imports
    const base = `${window.location.origin}/ort/`
    ort.env.wasm.wasmPaths = { wasm: `${base}ort-wasm-simd-threaded.wasm`, mjs: `${base}ort-wasm-simd-threaded.mjs` }
    ort.env.wasm.numThreads = 1 // no cross-origin isolation needed
    return ort
  })
  return ortP
}

export { cleanMask, removePieceAt } from './cutoutExtras'

/** Downloads the model (with progress) and prepares it. Cached for the rest of the session and by the service worker. */
export function loadModel(onProgress?: (fraction: number) => void): Promise<InferenceSession> {
  sessionP ??= (async () => {
    const ort = await loadOrt()
    const res = await fetch(MODEL_URL)
    if (!res.ok || !res.body) throw new Error('Could not download the cut-out model')
    const total = Number(res.headers.get('content-length')) || 4_574_861
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let got = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      got += value.length
      onProgress?.(Math.min(1, got / total))
    }
    const buf = new Uint8Array(got)
    let o = 0
    for (const c of chunks) { buf.set(c, o); o += c.length }
    return ort.InferenceSession.create(buf, { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
  })().catch((e) => { sessionP = null; throw e })
  return sessionP
}

export interface CutoutResult {
  /** the photo, scaled to the working size */
  photo: HTMLCanvasElement
  /** same size; the matte lives in the alpha channel (white pixels) */
  mask: HTMLCanvasElement
}

const make = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export async function cutout(file: Blob, onStage?: (s: 'model' | 'analyzing') => void, onProgress?: (f: number) => void): Promise<CutoutResult> {
  onStage?.('model')
  const [ort, session] = await Promise.all([loadOrt(), loadModel(onProgress)])
  onStage?.('analyzing')

  // photo at working size (respects the camera's rotation flag)
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
  const k = Math.min(1, WORK_MAX / Math.max(bmp.width, bmp.height))
  const w = Math.max(1, Math.round(bmp.width * k))
  const h = Math.max(1, Math.round(bmp.height * k))
  const photo = make(w, h)
  photo.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  bmp.close?.()

  const plane = SIZE * SIZE
  /** one pass of the network over the photo (optionally mirrored), as 0..1 per pixel at 320 x 320 */
  const run = async (flip: boolean) => {
    const small = make(SIZE, SIZE)
    const sctx = small.getContext('2d', { willReadFrequently: true })!
    if (flip) { sctx.translate(SIZE, 0); sctx.scale(-1, 1) }
    sctx.drawImage(photo, 0, 0, SIZE, SIZE)
    const px = sctx.getImageData(0, 0, SIZE, SIZE).data
    let max = 1
    for (let i = 0; i < px.length; i += 4) max = Math.max(max, px[i], px[i + 1], px[i + 2])
    const input = new Float32Array(3 * plane)
    for (let i = 0; i < plane; i++) for (let c = 0; c < 3; c++) input[c * plane + i] = (px[i * 4 + c] / max - MEAN[c]) / STD[c]
    const out = await session.run({ [session.inputNames[0]]: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) })
    const pred = out[session.outputNames[0]].data as Float32Array
    let lo = Infinity, hi = -Infinity
    for (let i = 0; i < plane; i++) { lo = Math.min(lo, pred[i]); hi = Math.max(hi, pred[i]) }
    const range = hi - lo || 1
    const res = new Float32Array(plane)
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) res[y * SIZE + x] = (pred[y * SIZE + (flip ? SIZE - 1 - x : x)] - lo) / range
    return res
  }
  // looking at the photo twice (as is, and mirrored) and averaging steadies the shape of the subject
  const p1 = await run(false)
  const p2 = await run(true)
  const avg = new Float32Array(plane)
  for (let i = 0; i < plane; i++) avg[i] = (p1[i] + p2[i]) / 2
  const matte = make(SIZE, SIZE)
  writeAlpha(matte, avg)
  const soft = make(w, h)
  const sctx2 = soft.getContext('2d', { willReadFrequently: true })!
  sctx2.imageSmoothingQuality = 'high'
  sctx2.drawImage(matte, 0, 0, w, h)
  const rough = alphaOf(soft)

  // snap the rough shape to the photo's real edges
  const px = photo.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data
  const luma = new Float32Array(w * h)
  for (let i = 0; i < luma.length; i++) luma[i] = (0.299 * px[i * 4] + 0.587 * px[i * 4 + 1] + 0.114 * px[i * 4 + 2]) / 255
  const r = Math.max(5, Math.round(Math.min(w, h) * 0.014))
  const refined = guidedFilter(luma, rough, w, h, r, 0.0004)
  // crisp edge, still anti-aliased
  const finalA = new Float32Array(w * h)
  for (let i = 0; i < finalA.length; i++) finalA[i] = smooth(0.32, 0.68, 0.35 * rough[i] + 0.65 * refined[i])

  const mask = make(w, h)
  writeAlpha(mask, finalA)
  cleanMask(mask)
  return { photo, mask }
}

/** photo * mask -> a canvas with the background transparent */
export function composite(photo: HTMLCanvasElement, mask: HTMLCanvasElement, into?: HTMLCanvasElement) {
  const c = into ?? make(photo.width, photo.height)
  const ctx = c.getContext('2d')!
  ctx.globalCompositeOperation = 'source-over'
  ctx.clearRect(0, 0, c.width, c.height)
  ctx.drawImage(photo, 0, 0)
  ctx.globalCompositeOperation = 'destination-in'
  ctx.drawImage(mask, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  return c
}

/** Crops to the subject (plus a little air) and exports a PNG no larger than `max` px. */
export function exportSticker(photo: HTMLCanvasElement, mask: HTMLCanvasElement, max = 720) {
  const full = composite(photo, mask)
  const { width: w, height: h } = full
  const data = full.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, w, h).data
  let x0 = w, y0 = h, x1 = -1, y1 = -1
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (data[(y * w + x) * 4 + 3] > 12) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  if (x1 < 0) return null // nothing left
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.03)
  x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad)
  const cw = x1 - x0 + 1
  const ch = y1 - y0 + 1
  const s = Math.min(1, max / Math.max(cw, ch))
  const out = make(Math.max(1, Math.round(cw * s)), Math.max(1, Math.round(ch * s)))
  const octx = out.getContext('2d')!
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(full, x0, y0, cw, ch, 0, 0, out.width, out.height)
  // WebP keeps the transparency at a fraction of the size; Safari can't encode it, so fall back to a smaller PNG there
  const webp = out.toDataURL('image/webp', 0.88)
  if (webp.startsWith('data:image/webp')) return { dataUrl: webp, ratio: out.width / out.height }
  const small = make(Math.max(1, Math.round(out.width * 0.8)), Math.max(1, Math.round(out.height * 0.8)))
  small.getContext('2d')!.drawImage(out, 0, 0, small.width, small.height)
  return { dataUrl: small.toDataURL('image/png'), ratio: small.width / small.height }
}
