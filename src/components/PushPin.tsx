import { shade } from '../lib/color'

/** Needle tip position inside the 60x80 viewBox (after the -18° tilt). */
export const PIN_TIP = { x: 41.4, y: 75.2 }

let n = 0
/** Glossy push-pin as an SVG string (used by Leaflet markers and stickers). */
export function pushPinSvg(color: string, width = 60, extra = '') {
  const id = `pp${++n}`
  const dark = shade(color, 0.28)
  const light = shade(color, -0.45)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 80" width="${width}" height="${(width * 80) / 60}" style="overflow:visible;${extra}">
  <defs>
    <linearGradient id="${id}b" x1="0" x2="1"><stop offset="0" stop-color="${light}"/><stop offset=".45" stop-color="${color}"/><stop offset="1" stop-color="${dark}"/></linearGradient>
    <linearGradient id="${id}n" x1="0" x2="1"><stop offset="0" stop-color="#f4f6f8"/><stop offset=".5" stop-color="#9aa3ad"/><stop offset="1" stop-color="#5d6670"/></linearGradient>
  </defs>
  <ellipse cx="44" cy="76" rx="10" ry="2.6" fill="rgba(0,0,0,.22)"/>
  <g transform="rotate(-18 30 40)">
    <path d="M28.4 50 L31.6 50 L30.3 77 Z" fill="url(#${id}n)"/>
    <path d="M12 47 C12 33 20 30 30 30 C40 30 48 33 48 47 C48 52 40 54 30 54 C20 54 12 52 12 47Z" fill="url(#${id}b)"/>
    <path d="M17 42 C19 36 24 34 29 34" stroke="#fff" stroke-opacity=".55" stroke-width="3" stroke-linecap="round" fill="none"/>
    <path d="M22 16 L38 16 L40 32 C36 35 24 35 20 32 Z" fill="url(#${id}b)"/>
    <path d="M25 18 L25 31" stroke="#fff" stroke-opacity=".4" stroke-width="2.4" stroke-linecap="round"/>
    <ellipse cx="30" cy="14" rx="19" ry="6.5" fill="url(#${id}b)"/>
    <ellipse cx="30" cy="12.6" rx="17" ry="4.8" fill="${light}" fill-opacity=".55"/>
  </g>
</svg>`
}

export function PushPinArt({ color = '#E5342F' }: { color?: string }) {
  return <div className="h-full w-full" dangerouslySetInnerHTML={{ __html: pushPinSvg(color, 60, 'width:100%;height:100%') }} />
}
