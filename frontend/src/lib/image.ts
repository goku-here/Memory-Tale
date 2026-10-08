import { rgbToHex, toneFor } from './color'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export function readAsDataURL(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

/** Encode a canvas as WebP when the browser supports it (Safari silently falls back to PNG), else JPEG. */
function encode(c: HTMLCanvasElement, quality: number, type?: string) {
  if (type) return c.toDataURL(type, quality)
  const webp = c.toDataURL('image/webp', quality)
  return webp.startsWith('data:image/webp') ? webp : c.toDataURL('image/jpeg', quality)
}

/** ~30 px wide blurred stand-in (a few hundred bytes) shown while the real photo loads. */
function makeThumb(img: CanvasImageSource, w: number, h: number) {
  const k = 32 / Math.max(w, h)
  const c = document.createElement('canvas')
  c.width = Math.max(2, Math.round(w * k))
  c.height = Math.max(2, Math.round(h * k))
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.5)
}

/**
 * Downscale + re-encode a picked file in the browser.
 * Default is the small "shared copy": 1200 px WebP. Also returns a tiny blurred thumbnail.
 */
export async function compressImage(
  file: Blob,
  opts: { maxSize?: number; quality?: number; type?: string } = {},
): Promise<{ dataUrl: string; width: number; height: number; thumb: string }> {
  const { maxSize = 1200, quality = 0.78, type } = opts
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.round(img.naturalWidth * scale)
    const h = Math.round(img.naturalHeight * scale)
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d')!.drawImage(img, 0, 0, w, h)
    return { dataUrl: encode(c, quality, type), width: w, height: h, thumb: makeThumb(c, w, h) }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Crop to a 3:4 portrait frame (centre crop), compress, and report the average colour. */
export async function makeCover(file: Blob) {
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const W = 720, H = 960
    const target = W / H
    const srcRatio = img.naturalWidth / img.naturalHeight
    let sw = img.naturalWidth, sh = img.naturalHeight, sx = 0, sy = 0
    if (srcRatio > target) { sw = sh * target; sx = (img.naturalWidth - sw) / 2 }
    else { sh = sw / target; sy = (img.naturalHeight - sh) / 2 }
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')!
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H)
    // average colour from a tiny downsample
    const s = document.createElement('canvas')
    s.width = s.height = 12
    const sctx = s.getContext('2d')!
    sctx.drawImage(c, 0, 0, 12, 12)
    const d = sctx.getImageData(0, 0, 12, 12).data
    let r = 0, g = 0, b = 0
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2] }
    const n = d.length / 4
    const avg = rgbToHex(r / n, g / n, b / n)
    return { dataUrl: c.toDataURL('image/jpeg', 0.82), avg, tone: toneFor(avg) }
  } finally {
    URL.revokeObjectURL(url)
  }
}
