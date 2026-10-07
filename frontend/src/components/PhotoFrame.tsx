import { useId, type CSSProperties } from 'react'
import type { FrameId, PhotoProps } from '../types'
import { clamp, frameHeight } from '../lib/items'

export const FRAMES: { id: FrameId; label: string }[] = [
  { id: 'polaroid', label: 'Polaroid' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'circle', label: 'Circle' },
  { id: 'heart', label: 'Heart' },
  { id: 'arch', label: 'Arch' },
  { id: 'film', label: 'Film strip' },
  { id: 'stamp', label: 'Stamp' },
  { id: 'none', label: 'No frame' },
]

/** frames whose outline honours the corner-radius slider */
export const RADIUS_FRAMES: FrameId[] = ['polaroid', 'rounded', 'film', 'none']

const HEART = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 29.6'><path d='M23.6 0c-3.4 0-6.3 2.7-7.6 5.6C14.7 2.7 11.8 0 8.4 0 3.8 0 0 3.8 0 8.4c0 9.4 9.5 11.9 16 21.2 6.1-9.3 16-12.1 16-21.2C32 3.8 28.2 0 23.6 0z'/></svg>\")"

const SOFT = '0 1px 2px rgba(40,30,30,.14), 0 8px 18px rgba(40,30,30,.16)'

const imgStyle: CSSProperties = {
  display: 'block', width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none', userSelect: 'none',
}

function Img({ src, style }: { src: string; style?: CSSProperties }) {
  return <img src={src} alt="" draggable={false} style={{ ...imgStyle, ...style }} />
}

/** Perforated stamp edge, drawn as an SVG so the holes are real transparency. */
function StampBg({ w, h }: { w: number; h: number }) {
  const uid = useId().replace(/:/g, '')
  const maskId = `stamp-${uid}`
  const vbH = (100 * h) / w
  const cols = 10
  const rows = Math.max(3, Math.round((cols * h) / w))
  const holes: [number, number][] = []
  for (let i = 0; i <= cols; i++) { holes.push([(i * 100) / cols, 0]); holes.push([(i * 100) / cols, vbH]) }
  for (let j = 1; j < rows; j++) { holes.push([0, (j * vbH) / rows]); holes.push([100, (j * vbH) / rows]) }
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox={`0 0 100 ${vbH}`} aria-hidden>
      <defs>
        <mask id={maskId}>
          <rect width="100" height={vbH} fill="#fff" />
          {holes.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.3" fill="#000" />)}
        </mask>
      </defs>
      <rect width="100" height={vbH} fill="#fffdf8" mask={`url(#${maskId})`} />
    </svg>
  )
}

/**
 * Renders a photo inside a frame. Fills its parent (which is sized with `frameHeight`)
 * and expresses every metric in cqw so it scales with the item.
 */
export function PhotoFrame({ photo, width }: { photo: PhotoProps; width: number }) {
  const { src, frame, caption } = photo
  const a = clamp(photo.aspect || 1, 0.66, 1.5)
  const r = (photo.radius * width) / 200
  const h = frameHeight(frame, width, photo.aspect)
  const wrap: CSSProperties = { containerType: 'inline-size', position: 'relative', width: '100%', height: '100%' }

  switch (frame) {
    case 'polaroid':
      return (
        <div style={{ ...wrap, background: '#fff', borderRadius: r, boxShadow: SOFT }}>
          <div className="absolute overflow-hidden" style={{ left: '5.5cqw', top: '5.5cqw', width: '89cqw', height: `${89 / a}cqw`, borderRadius: Math.max(0, r * 0.4), background: '#eee' }}>
            <Img src={src} />
          </div>
          <div
            className="absolute inset-x-0 flex items-center justify-center overflow-hidden px-[6cqw] text-center"
            style={{ bottom: 0, height: '20cqw', fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: '10.5cqw', color: '#4a4a55', lineHeight: 1 }}
          >
            <span className="max-h-full overflow-hidden whitespace-pre-wrap break-words">{caption}</span>
          </div>
        </div>
      )
    case 'rounded':
      return (
        <div style={{ ...wrap, background: '#fff', borderRadius: r, padding: '2.2cqw', boxShadow: SOFT }}>
          <Img src={src} style={{ borderRadius: Math.max(0, r - width * 0.02) }} />
        </div>
      )
    case 'none':
      return (
        <div style={{ ...wrap, borderRadius: r, overflow: 'hidden', boxShadow: '0 1px 2px rgba(40,30,30,.12), 0 6px 14px rgba(40,30,30,.14)' }}>
          <Img src={src} />
        </div>
      )
    case 'circle':
      return (
        <div style={{ ...wrap, background: '#fff', borderRadius: '50%', padding: '3.5cqw', boxShadow: SOFT }}>
          <Img src={src} style={{ borderRadius: '50%' }} />
        </div>
      )
    case 'heart':
      return (
        <div style={{ ...wrap, filter: 'drop-shadow(0 1px 2px rgba(40,30,30,.18)) drop-shadow(0 8px 12px rgba(40,30,30,.18))' }}>
          <div style={{ position: 'absolute', inset: 0, background: '#fff', WebkitMaskImage: HEART, maskImage: HEART, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }} />
          <div style={{ position: 'absolute', inset: '4cqw 4cqw 4cqw 4cqw', WebkitMaskImage: HEART, maskImage: HEART, WebkitMaskSize: '100% 100%', maskSize: '100% 100%' }}>
            <Img src={src} />
          </div>
        </div>
      )
    case 'arch':
      return (
        <div style={{ ...wrap, background: '#fff', padding: '3.5cqw', borderRadius: '50cqw 50cqw 4cqw 4cqw', boxShadow: SOFT }}>
          <Img src={src} style={{ borderRadius: '47cqw 47cqw 1cqw 1cqw' }} />
        </div>
      )
    case 'film':
      return (
        <div style={{ ...wrap, background: '#17171b', borderRadius: r, boxShadow: SOFT }}>
          {(['left', 'right'] as const).map((side) => (
            <div
              key={side} className="absolute"
              style={{
                [side]: '2.4cqw', top: '3cqw', bottom: '3cqw', width: '5cqw', borderRadius: 1,
                background: 'repeating-linear-gradient(to bottom, #efe9da 0 3cqw, transparent 3cqw 6cqw)',
              }}
            />
          ))}
          <div className="absolute overflow-hidden" style={{ left: '10cqw', right: '10cqw', top: '5cqw', bottom: '5cqw', borderRadius: 2 }}>
            <Img src={src} />
          </div>
        </div>
      )
    case 'stamp':
      return (
        <div style={{ ...wrap, filter: 'drop-shadow(0 1px 2px rgba(40,30,30,.2)) drop-shadow(0 7px 10px rgba(40,30,30,.16))' }}>
          <StampBg w={width} h={h} />
          <div className="absolute overflow-hidden" style={{ left: '7cqw', right: '7cqw', top: '7cqw', bottom: '7cqw' }}>
            <Img src={src} />
          </div>
        </div>
      )
  }
}
