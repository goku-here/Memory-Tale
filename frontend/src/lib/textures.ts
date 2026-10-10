/**
 * Seamless background textures drawn once with the canvas API (no image files). Each result is a data URL that
 * repeats without visible seams, so the canvas can scroll forever.
 */
const cache = new Map<string, string>()

/** small deterministic random numbers so a texture always looks the same */
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const make = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** Drawing something that crosses an edge: draw it again shifted by one tile so the edges meet. */
function wrapped(w: number, h: number, x: number, y: number, r: number, draw: (x: number, y: number) => void) {
  for (const dx of [-w, 0, w]) {
    for (const dy of [-h, 0, h]) {
      const px = x + dx, py = y + dy
      if (px + r > 0 && px - r < w && py + r > 0 && py - r < h) draw(px, py)
    }
  }
}

/** A blue-sky tile with soft, puffy white clouds that are shaded underneath. Transparent, so the sky colour comes from the canvas. */
export function cloudsTile(): string {
  const hit = cache.get('clouds')
  if (hit) return hit
  const W = 640, H = 960
  const out = make(W, H)
  const ctx = out.getContext('2d')!
  const rnd = rng(42)

  const clusters = 8
  for (let k = 0; k < clusters; k++) {
    const cw = 190 + rnd() * 250
    const ch = 80 + rnd() * 70
    const pad = 130
    const cc = make(Math.ceil(cw + pad * 2), Math.ceil(ch + pad * 2))
    const c2 = cc.getContext('2d')!
    const ox = cc.width / 2, oy = pad + ch
    const puff = (x: number, y: number, r: number) => {
      const g = c2.createRadialGradient(x, y, r * 0.15, x, y, r)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.55, 'rgba(255,255,255,.95)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      c2.fillStyle = g
      c2.beginPath()
      c2.arc(x, y, r, 0, Math.PI * 2)
      c2.fill()
    }
    // a flat base, a domed top, and lots of small bumps along the top edge
    const n = 22 + Math.floor(rnd() * 12)
    for (let i = 0; i < n; i++) {
      const u = (rnd() - 0.5) * 2
      const env = Math.pow(1 - u * u, 0.8)
      puff(ox + u * (cw / 2), oy - rnd() * env * ch, (20 + rnd() * 44) * (0.55 + 0.65 * env))
    }
    for (let i = 0; i < 10; i++) {
      const u = (rnd() - 0.5) * 1.7
      const env = Math.pow(1 - u * u, 0.8)
      puff(ox + u * (cw / 2), oy - env * ch * (0.55 + rnd() * 0.45), 9 + rnd() * 17)
    }
    // shade the underside with cool blue-grey
    c2.globalCompositeOperation = 'source-atop'
    const sh = c2.createLinearGradient(0, pad * 0.6, 0, oy + 10)
    sh.addColorStop(0, 'rgba(255,255,255,0)')
    sh.addColorStop(0.5, 'rgba(235,242,252,.25)')
    sh.addColorStop(1, 'rgba(140,172,222,.7)')
    c2.fillStyle = sh
    c2.fillRect(0, 0, cc.width, cc.height)
    const cx = rnd() * W
    const cy = ((k + 0.5) / clusters) * H + (rnd() - 0.5) * 50
    wrapped(W, H, cx, cy, Math.max(cc.width, cc.height) / 2, (x, y) => ctx.drawImage(cc, x - cc.width / 2, y - oy))
  }
  // a little film grain on the soft edges, like a photo of the sky
  const img = ctx.getImageData(0, 0, W, H)
  const gr = rng(5)
  for (let i = 3; i < img.data.length; i += 4) {
    const a = img.data[i]
    if (a > 6 && a < 250) img.data[i] = Math.max(0, Math.min(255, a * (0.8 + 0.4 * gr())))
  }
  ctx.putImageData(img, 0, 0)
  const url = out.toDataURL('image/png')
  cache.set('clouds', url)
  return url
}

/**
 * Crumpled white paper: many small facets with their own brightness, bent creases of different strength where
 * they meet, and fine paper grain. Greyscale, to be multiplied over the background colour.
 */
export function crumpleTile(): string {
  const hit = cache.get('crumple')
  if (hit) return hit
  const S = 380 // computed small, then scaled up so the creases come out soft
  const rnd = rng(13)
  const N = 72
  const seeds = Array.from({ length: N }, () => ({ x: rnd() * S, y: rnd() * S, v: rnd(), tx: rnd() - 0.5, ty: rnd() - 0.5 }))
  const strength = (a: number, b: number) => {
    // the same fold always has the same strength, whichever side it is seen from
    const lo = Math.min(a, b), hi = Math.max(a, b)
    const h = Math.sin(lo * 127.1 + hi * 311.7) * 43758.5453
    return h - Math.floor(h)
  }
  const small = make(S, S)
  const sctx = small.getContext('2d')!
  const img = sctx.createImageData(S, S)
  const wrapD = (a: number) => (a > S / 2 ? a - S : a < -S / 2 ? a + S : a)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // bend the cell borders a little so the folds are not ruler-straight
      const wx = x + Math.sin(y * 0.045 + 1.3) * 5 + Math.sin(y * 0.11) * 2
      const wy = y + Math.sin(x * 0.04 + 0.4) * 5 + Math.sin(x * 0.12) * 2
      let d1 = 1e9, d2 = 1e9, b1 = 0, b2 = 0
      for (let i = 0; i < N; i++) {
        const dx = wrapD(wx - seeds[i].x), dy = wrapD(wy - seeds[i].y)
        const d = dx * dx + dy * dy
        if (d < d1) { d2 = d1; b2 = b1; d1 = d; b1 = i } else if (d < d2) { d2 = d; b2 = i }
      }
      const s = seeds[b1]
      const dx = wrapD(wx - s.x), dy = wrapD(wy - s.y)
      const k = 0.35 + strength(b1, b2) * 0.9
      const crease = Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) / (5 + 7 * k))
      const tilt = (dx * s.tx + dy * s.ty) / 22
      let v = 0.9 + s.v * 0.08 + tilt * 0.11 - (1 - crease) * (1 - crease) * 0.11 * k
      // a thin bright edge on the lit side of a fold
      v += Math.max(0, tilt) * (1 - crease) * 0.05
      v = Math.max(0.6, Math.min(1, v))
      const o = (y * S + x) * 4
      img.data[o] = img.data[o + 1] = img.data[o + 2] = v * 255
      img.data[o + 3] = 255
    }
  }
  sctx.putImageData(img, 0, 0)
  const out = make(S * 2, S * 2)
  const ctx = out.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(small, 0, 0, S * 2, S * 2)
  // paper grain
  const g = ctx.getImageData(0, 0, S * 2, S * 2)
  const r2 = rng(99)
  for (let i = 0; i < g.data.length; i += 4) {
    const n = (r2() - 0.5) * 14
    g.data[i] += n
    g.data[i + 1] += n
    g.data[i + 2] += n
  }
  ctx.putImageData(g, 0, 0)
  const url = out.toDataURL('image/jpeg', 0.9)
  cache.set('crumple', url)
  return url
}
