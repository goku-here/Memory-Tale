// Generates PWA PNG icons with zero dependencies (software rasteriser + zlib).
import zlib from 'node:zlib'
import fs from 'node:fs'

const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const rr = (x, y, x0, y0, x1, y1, r) => {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false
  const cx = Math.min(Math.max(x, x0 + r), x1 - r)
  const cy = Math.min(Math.max(y, y0 + r), y1 - r)
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r
}
const heart = (x, y, cx, cy, s) => {
  const u = (x - cx) / s, v = -(y - cy) / s
  return (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0
}

function render(size, { maskable, scale }) {
  const SS = 3
  const px = Buffer.alloc(size * size * 4)
  const bx = (v) => 0.5 + (v - 0.5) * scale
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sj = 0; sj < SS; sj++) for (let si = 0; si < SS; si++) {
        const x = (i + (si + 0.5) / SS) / size
        const y = (j + (sj + 0.5) / SS) / size
        let c = null
        if (maskable || rr(x, y, 0, 0, 1, 1, 0.22)) {
          const t = y
          c = [169 - 22 * t, 192 - 22 * t, 219 - 15 * t]
          // ribbon
          const rx0 = bx(0.31), rx1 = bx(0.36)
          if (x >= rx0 && x <= rx1 && y >= bx(0.78) && y <= bx(0.9) - ((x - rx0) / (rx1 - rx0) > 0.5 ? 0 : 0) && !(y > bx(0.86) && Math.abs(x - (rx0 + rx1) / 2) < (y - bx(0.86)) * 0.9)) c = hex('#E9A8A0')
          if (rr(x, y, bx(0.24), bx(0.14), bx(0.76), bx(0.84), 0.05 * scale)) {
            c = hex('#F6F1E7')
            if (x < bx(0.285)) c = hex('#E4DCCB')
            if (x >= bx(0.63) && x <= bx(0.68)) c = hex('#D6CBB4')
            if (heart(x, y, bx(0.45), bx(0.46), 0.075 * scale)) c = hex('#E58E8E')
          }
        }
        if (c) { r += c[0]; g += c[1]; b += c[2]; a += 1 }
      }
      const n = SS * SS, o = (j * size + i) * 4
      if (a) { px[o] = r / a; px[o + 1] = g / a; px[o + 2] = b / a }
      px[o + 3] = Math.round((a / n) * 255)
    }
  }
  return px
}

function png(size, px) {
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  const chunk = (t, d) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length)
    const td = Buffer.concat([Buffer.from(t), d])
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td) >>> 0)
    return Buffer.concat([len, td, crc])
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const out = (name, size, opts) => fs.writeFileSync(`public/${name}`, png(size, render(size, opts)))
out('pwa-192.png', 192, { maskable: false, scale: 1 })
out('pwa-512.png', 512, { maskable: false, scale: 1 })
out('pwa-maskable-512.png', 512, { maskable: true, scale: 0.78 })
out('apple-touch-icon.png', 180, { maskable: true, scale: 0.86 })
fs.writeFileSync('public/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" rx="22" fill="#A0B8D8"/><rect x="31" y="78" width="5" height="12" fill="#E9A8A0"/><rect x="24" y="14" width="52" height="70" rx="5" fill="#F6F1E7"/><rect x="63" y="14" width="5" height="70" fill="#D6CBB4"/><path d="M45 56 C30 46 36 36 45 43 C54 36 60 46 45 56Z" fill="#E58E8E"/></svg>`)
console.log('icons ok')
