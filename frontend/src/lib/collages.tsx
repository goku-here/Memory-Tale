import type { ReactNode } from 'react'
import { SVG_STICKERS } from '../components/stickers'

/**
 * Photo frames and page templates that hold the person's own pictures.
 * Everything is drawn here in SVG (no outside artwork): a drawing in a 100-wide box plus "slots", the spots where a
 * photo goes. Tapping an empty slot on the canvas adds a picture.
 */

export type SlotShape = 'polaroid' | 'stamp' | 'plain' | 'film' | 'bare'
export interface Slot {
  /** the picture area, in the drawing's own units */
  x: number
  y: number
  w: number
  h: number
  /** degrees, turned around the picture area's centre */
  rot?: number
  shape: SlotShape
  /** a polaroid-style slot also has a line of writing under the picture */
  caption?: boolean
}

export interface CollageDef {
  label: string
  /** frames are offered in the tray; pieces are what page templates are built from */
  group: 'frames' | 'pieces'
  /** artwork images (png/svg in /public) drawn under / over the pictures: the way to use designer-made frames */
  underImg?: string
  overImg?: string
  /** drawing size (the item's box has the same proportions) */
  w: number
  h: number
  slots: Slot[]
  /** drawn behind the pictures */
  under?: ReactNode
  /** drawn over the pictures (camera body, bows, pins, tape) */
  over?: ReactNode
}

/* ---------- small pieces of art ---------- */

/** a postage-stamp outline: the rectangle with round bites along every edge */
function stampPath(x0: number, y0: number, x1: number, y1: number, r = 1.15) {
  let d = `M${x0} ${y0}`
  const side = (ax: number, ay: number, bx: number, by: number) => {
    const len = Math.hypot(bx - ax, by - ay)
    const k = Math.max(2, Math.round(len / 4.4))
    const ux = (bx - ax) / len, uy = (by - ay) / len, seg = len / k
    for (let i = 0; i < k; i++) {
      const sx = ax + ux * seg * i, sy = ay + uy * seg * i
      d += `L${(sx + ux * (seg / 2 - r)).toFixed(2)} ${(sy + uy * (seg / 2 - r)).toFixed(2)}A${r} ${r} 0 0 0 ${(sx + ux * (seg / 2 + r)).toFixed(2)} ${(sy + uy * (seg / 2 + r)).toFixed(2)}`
    }
    d += `L${bx} ${by}`
  }
  side(x0, y0, x1, y0); side(x1, y0, x1, y1); side(x1, y1, x0, y1); side(x0, y1, x0, y0)
  return d + 'Z'
}

const SHADOW = 'drop-shadow(0 .7px 1px rgba(40,30,30,.28)) drop-shadow(0 3px 4px rgba(40,30,30,.22))'

/** the white card around a picture */
function FrameArt({ s }: { s: Slot }) {
  const cx = s.x + s.w / 2, cy = s.y + s.h / 2
  const g = (child: ReactNode) => <g transform={`rotate(${s.rot ?? 0} ${cx} ${cy})`} style={{ filter: SHADOW }}>{child}</g>
  if (s.shape === 'polaroid') {
    const pad = s.w * 0.075
    return g(
      <>
        <rect x={s.x - pad} y={s.y - pad} width={s.w + pad * 2} height={s.h + pad + pad * 3.4} rx=".7" fill="#fdfcf9" />
        <rect x={s.x - pad} y={s.y - pad} width={s.w + pad * 2} height={s.h + pad + pad * 3.4} rx=".7" fill="none" stroke="#e4e0d6" strokeWidth=".25" />
        <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="#e8e8ec" />
      </>,
    )
  }
  if (s.shape === 'stamp') {
    const p = Math.min(s.w, s.h) * 0.085
    return g(
      <>
        <path d={stampPath(s.x - p, s.y - p, s.x + s.w + p, s.y + s.h + p)} fill="#fdfcf9" />
        <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="#e8e8ec" />
      </>,
    )
  }
  if (s.shape === 'bare') return null
  if (s.shape === 'film') return <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="#dcdce1" />
  return <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="1.2" fill="#ececef" transform={`rotate(${s.rot ?? 0} ${cx} ${cy})`} />
}

/** a decorative sticker from the sticker set, placed in the drawing */
function Deco({ id, x, y, w, rot = 0 }: { id: string; x: number; y: number; w: number; rot?: number }) {
  const d = SVG_STICKERS[id]
  if (!d) return null
  const h = w / d.ratio
  return (
    <g transform={`rotate(${rot} ${x + w / 2} ${y + h / 2})`} style={{ filter: 'drop-shadow(0 1px 1.2px rgba(30,20,20,.35))' }}>
      <svg x={x} y={y} width={w} height={h} viewBox={`0 0 ${w} ${h}`} overflow="visible">{d.art}</svg>
    </g>
  )
}

const PAPER_NOISE = (id: string) => (
  <filter id={id} x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="5" result="n" />
    <feColorMatrix in="n" values="0 0 0 0 .25  0 0 0 0 .2  0 0 0 0 .15  0 0 0 .18 0" />
  </filter>
)

/* ---------- the instant camera ---------- */

function Camera({ x, y, w }: { x: number; y: number; w: number }) {
  const k = w / 100
  return (
    <g transform={`translate(${x} ${y}) scale(${k})`} style={{ filter: 'drop-shadow(0 2px 3px rgba(20,20,30,.35))' }}>
      <defs>
        <linearGradient id="cam-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#dcdde3" /></linearGradient>
        <linearGradient id="cam-dark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3a3b42" /><stop offset="1" stopColor="#17171b" /></linearGradient>
        <radialGradient id="cam-glass" cx=".4" cy=".35" r=".7"><stop offset="0" stopColor="#7fd3b8" /><stop offset=".4" stopColor="#245a55" /><stop offset="1" stopColor="#0c1418" /></radialGradient>
        <radialGradient id="cam-lens" cx=".5" cy=".5" r=".5"><stop offset=".6" stopColor="#25252b" /><stop offset="1" stopColor="#0d0d10" /></radialGradient>
      </defs>
      {/* body */}
      <rect x="0" y="7" width="100" height="36" rx="5" fill="url(#cam-body)" />
      <path d="M0 40h100v18a5 5 0 0 1-5 5H5a5 5 0 0 1-5-5Z" fill="url(#cam-dark)" />
      <rect x="9" y="47" width="82" height="4.4" rx="1" fill="#0b0b0e" />
      <rect x="40" y="36" width="20" height="6" rx="2" fill="#2a2b31" />
      {/* flash */}
      <rect x="8" y="12" width="21" height="22" rx="2.2" fill="#c9ccd4" />
      <rect x="9.6" y="13.6" width="17.8" height="18.8" rx="1.4" fill="#eef0f4" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <path key={i} d={`M10 ${15 + i * 2.2}h17`} stroke="#b4b8c2" strokeWidth=".35" />)}
      {/* lens */}
      <circle cx="53" cy="25" r="17" fill="url(#cam-dark)" />
      <circle cx="53" cy="25" r="13.6" fill="url(#cam-lens)" />
      <circle cx="53" cy="25" r="10.4" fill="#18181d" stroke="#3b3c44" strokeWidth=".6" />
      <circle cx="53" cy="25" r="7.4" fill="url(#cam-glass)" />
      <ellipse cx="50.6" cy="22.4" rx="2.6" ry="1.6" fill="#fff" opacity=".55" transform="rotate(-30 50.6 22.4)" />
      {/* viewfinder */}
      <rect x="74" y="11" width="18" height="17" rx="2.4" fill="url(#cam-dark)" />
      <rect x="76" y="13" width="14" height="13" rx="1.6" fill="#242a30" />
      <rect x="77.4" y="14.4" width="5" height="4" rx=".8" fill="#fff" opacity=".28" />
      {/* little details */}
      <circle cx="33.5" cy="14" r="2.6" fill="#f1f2f5" stroke="#cfd2da" strokeWidth=".5" />
      <circle cx="35" cy="23" r="2.1" fill="#16161a" />
      <circle cx="75" cy="36" r="2.8" fill="#24242a" />
      <rect x="78" y="31.4" width="11" height="3.4" rx="1.7" fill="#f4b53f" />
      <circle cx="86" cy="33.1" r="1.4" fill="#ffd25f" />
      <circle cx="14" cy="36.4" r="5.2" fill="#d83a2a" />
      <circle cx="14" cy="36.4" r="5.2" fill="none" stroke="#fff" strokeWidth=".7" opacity=".6" />
      {/* colour stripes */}
      {['#3b8fd9', '#37b86a', '#f6c23a', '#f2873a', '#dd3b3b'].map((c, i) => <rect key={c} x="8" y={53.4 + i * 1.5} width="12" height="1.2" fill={c} />)}
    </g>
  )
}

/** three pictures coming out of the camera, one under the other */
const CAMERA_W = 100
function cameraDef(n: 1 | 3): CollageDef {
  const inner = 58
  const slots: Slot[] = [
    { x: 21, y: 46, w: inner, h: inner, rot: -2.5, shape: 'polaroid', caption: true },
    { x: 21, y: 122, w: inner, h: inner, rot: 2.2, shape: 'polaroid', caption: true },
    { x: 21, y: 198, w: inner, h: inner, rot: -1.6, shape: 'polaroid', caption: true },
  ].slice(0, n) as Slot[]
  return {
    label: n === 3 ? 'Camera with 3 photos' : 'Camera with a photo', group: 'frames', w: CAMERA_W, h: n === 3 ? 276 : 124,
    slots, over: <Camera x={0} y={0} w={100} />,
  }
}

/* ---------- tickets ---------- */

type TicketKind = 'cream' | 'pink' | 'teal' | 'mustard' | 'lilac'
const TICKET_COLORS: Record<TicketKind, [string, string, string]> = {
  cream: ['#f4e6c4', '#e9d6a6', '#6b5a3c'],
  pink: ['#f0b7ac', '#e3a094', '#7a4a44'],
  teal: ['#8fb8b0', '#79a39b', '#2f4f4a'],
  mustard: ['#efbf5a', '#e0a93b', '#6e5316'],
  lilac: ['#cdb6d9', '#b9a0c8', '#4f3d5c'],
}

function ticketOutline(kind: TicketKind, w: number, h: number) {
  if (kind === 'cream') {
    // scalloped left and right edges
    let d = 'M2 0H98'
    const n = 11, st = h / n
    for (let i = 0; i < n; i++) d += `Q100.6 ${i * st + st / 2} 98 ${(i + 1) * st}`
    d += 'H2'
    for (let i = n; i > 0; i--) d += `Q-.6 ${i * st - st / 2} 2 ${(i - 1) * st}`
    return d + 'Z'
  }
  if (kind === 'lilac') {
    // a zigzag left edge, straight on the right
    let d = 'M3 0H100'
    d += `V${h}H3`
    const n = 12, st = h / n
    for (let i = n; i > 0; i--) d += `L${i % 2 ? 0.2 : 3} ${i * st - st / 2}L3 ${(i - 1) * st}`
    return d + 'Z'
  }
  if (kind === 'pink') {
    const r = 4.2
    return `M${r} 0H${w - r}A${r} ${r} 0 0 0 ${w} ${r}V${h - r}A${r} ${r} 0 0 0 ${w - r} ${h}H${r}A${r} ${r} 0 0 0 0 ${h - r}V${r}A${r} ${r} 0 0 0 ${r} 0Z`
  }
  if (kind === 'teal') {
    const c = 6
    return `M${c} 0H${w - c}L${w} ${c}V${h - c}L${w - c} ${h}H${c}L0 ${h - c}V${c}Z`
  }
  // mustard: a half-round bite out of each short side
  const r = 7
  return `M0 0H${w}V${h / 2 - r}A${r} ${r} 0 0 0 ${w} ${h / 2 + r}V${h}H0V${h / 2 + r}A${r} ${r} 0 0 0 0 ${h / 2 - r}Z`
}

function Ticket({ kind, x, y, w, h, rot = 0, id }: { kind: TicketKind; x: number; y: number; w: number; h: number; rot?: number; id: string }) {
  const [c1, c2, ink] = TICKET_COLORS[kind]
  const sx = w / 100, sy = h / 44
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot} ${w / 2} ${h / 2}) scale(${sx} ${sy})`} style={{ filter: 'drop-shadow(0 .8px 1px rgba(40,30,20,.3)) drop-shadow(0 3px 4px rgba(40,30,20,.2))' }}>
      <defs>
        <linearGradient id={`tk-${id}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} /></linearGradient>
        {PAPER_NOISE(`tkn-${id}`)}
      </defs>
      <path d={ticketOutline(kind, 100, 44)} fill={`url(#tk-${id})`} />
      <path d={ticketOutline(kind, 100, 44)} fill="#000" filter={`url(#tkn-${id})`} opacity=".9" />
      <rect x="3.4" y="3.4" width="93.2" height="37.2" rx="1.4" fill="none" stroke={ink} strokeWidth=".35" opacity=".7" />
      {/* barcode and perforation */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <rect key={i} x={7 + i * 1.8} y="9" width={i % 3 === 0 ? 1.2 : .7} height="15" fill={ink} opacity=".75" />)}
      <path d="M24 5v34" stroke={ink} strokeWidth=".35" strokeDasharray="1 1.1" opacity=".7" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x="92" y={10 + i * 2.2} width="1.4" height="1" fill={ink} opacity=".7" />)}
    </g>
  )
}

function ticketDef(kind: TicketKind, label: string): CollageDef {
  return {
    label, group: 'frames', w: 100, h: 44,
    slots: [{ x: 28, y: 6.6, w: 60, h: 30.8, shape: 'bare' }],
    under: <Ticket kind={kind} x={0} y={0} w={100} h={44} id={kind} />,
  }
}

/* ---------- single frames ---------- */

const stampDef: CollageDef = {
  label: 'Stamp frame', group: 'frames', w: 100, h: 122,
  slots: [{ x: 11, y: 11, w: 78, h: 100, rot: -3, shape: 'stamp' }],
  over: <Deco id="pin" x={44} y={-4} w={13} rot={4} />,
}
const stampWideDef: CollageDef = {
  label: 'Stamp, wide', group: 'frames', w: 100, h: 82,
  slots: [{ x: 10, y: 10, w: 80, h: 62, rot: 3, shape: 'stamp' }],
  over: <Deco id="bow" x={70} y={52} w={28} rot={-8} />,
}
const polaroidDef: CollageDef = {
  label: 'Polaroid', group: 'frames', w: 100, h: 116,
  slots: [{ x: 11, y: 10, w: 78, h: 78, rot: -3, shape: 'polaroid', caption: true }],
  over: <Deco id="tape-yellow" x={28} y={-2} w={44} rot={-4} />,
}

/* ---------- page templates ---------- */

/** points along a ragged paper edge going down from y = 0 to y = h */
function tornPoints(x: number, h: number, dir: 1 | -1, seed: number): [number, number][] {
  let s = seed
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280 }
  const pts: [number, number][] = []
  for (let y = 0; y <= h; y += 2.4) pts.push([+(x + dir * rnd() * 3.4).toFixed(1), +y.toFixed(1)])
  return pts
}
const poly = (pts: [number, number][]) => `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`

/* ---------- film strips ---------- */

/** a strip of 35mm film: black, with sprocket holes you can see the page through, and a window for each picture */
function filmDef(n: number, vertical: boolean, label: string): CollageDef {
  const thick = 26, pitch = 24.6, win = 21.6, short = 15.8
  const len = +(n * pitch + 2.2).toFixed(1)
  const W = vertical ? thick : len, H = vertical ? len : thick
  const slots: Slot[] = Array.from({ length: n }, (_, i) => {
    const a = 2.2 + i * pitch + (pitch - 2.2 - win) / 2 + 0.4, b = (thick - short) / 2
    return vertical ? { x: b, y: a, w: short, h: win, shape: 'film' as const } : { x: a, y: b, w: win, h: short, shape: 'film' as const }
  })
  // outer strip with the sprocket holes cut out (even-odd), and the pictures' windows cut out too
  const holes: string[] = []
  const hole = (x: number, y: number, w: number, h: number) => `M${x + 0.7} ${y}h${w - 1.4}a.7 .7 0 0 1 .7 .7v${h - 1.4}a.7 .7 0 0 1 -.7 .7h${-(w - 1.4)}a.7 .7 0 0 1 -.7 -.7v${-(h - 1.4)}a.7 .7 0 0 1 .7 -.7Z`
  const count = Math.round(len / 4.9)
  const step = len / count
  for (let i = 0; i < count; i++) {
    const p = i * step + (step - 2.8) / 2
    if (vertical) { holes.push(hole(1.5, p, 2.2, 2.8)); holes.push(hole(thick - 3.7, p, 2.2, 2.8)) } else { holes.push(hole(p, 1.5, 2.8, 2.2)); holes.push(hole(p, thick - 3.7, 2.8, 2.2)) }
  }
  const wins = slots.map((s) => `M${s.x} ${s.y}h${s.w}v${s.h}h${-s.w}Z`)
  const d = `M0 0H${W}V${H}H0Z ${holes.join(' ')} ${wins.join(' ')}`
  return {
    label, group: 'frames', w: W, h: H, slots,
    over: (
      <g style={{ filter: 'drop-shadow(0 1px 1.4px rgba(0,0,0,.35)) drop-shadow(0 3px 4px rgba(0,0,0,.2))' }}>
        <defs>
          <linearGradient id={`fl-${n}${vertical ? 'v' : 'h'}`} x1="0" y1="0" x2={vertical ? 1 : 0} y2={vertical ? 0 : 1}>
            <stop offset="0" stopColor="#2b2b31" /><stop offset=".5" stopColor="#141417" /><stop offset="1" stopColor="#222228" />
          </linearGradient>
        </defs>
        <path d={d} fillRule="evenodd" fill={`url(#fl-${n}${vertical ? 'v' : 'h'})`} />
      </g>
    ),
  }
}

/* ---------- pieces: backgrounds and decorations that page templates are built from ---------- */

const paperLetterDef: CollageDef = {
  label: 'Letter paper', group: 'pieces', w: 100, h: 132, slots: [],
  under: (
    <g>
      <defs>
        <linearGradient id="ll-red" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7a2a2d" /><stop offset="1" stopColor="#5b1c20" /></linearGradient>
        {PAPER_NOISE('ll-n')}
      </defs>
      <rect x="0" y="0" width="100" height="132" fill="#f3efe7" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.3))' }} />
      <path d={poly([...tornPoints(7, 132, 1, 8), ...tornPoints(93, 132, -1, 11).reverse()])} fill="url(#ll-red)" />
      <path d={poly([...tornPoints(7, 132, 1, 8), ...tornPoints(93, 132, -1, 11).reverse()])} fill="#000" filter="url(#ll-n)" opacity=".7" />
      {Array.from({ length: 13 }, (_, i) => (
        <g key={i} transform={`translate(0 ${6 + i * 10})`}>
          <ellipse cx="10" cy="0" rx="6.4" ry="1.7" fill="none" stroke="#b9bcc4" strokeWidth="1.1" />
          <ellipse cx="10" cy="-.3" rx="6.4" ry="1.7" fill="none" stroke="#f4f5f8" strokeWidth=".5" />
          <circle cx="14.4" cy="0" r="1" fill="#2a1416" />
        </g>
      ))}
    </g>
  ),
}

const corkBoardDef: CollageDef = {
  label: 'Kraft board', group: 'pieces', w: 100, h: 112, slots: [],
  under: (
    <g>
      <defs>
        <linearGradient id="pb-kraft" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9b98c" /><stop offset="1" stopColor="#c79f6e" /></linearGradient>
        {PAPER_NOISE('pb-n')}
      </defs>
      <rect x="0" y="0" width="100" height="112" rx="2" fill="url(#pb-kraft)" style={{ filter: 'drop-shadow(0 2px 4px rgba(60,40,20,.3))' }} />
      <rect x="0" y="0" width="100" height="112" rx="2" fill="#000" filter="url(#pb-n)" opacity=".8" />
      <path d="M4 4H96V108H4Z" fill="none" stroke="#fff" strokeOpacity=".35" strokeWidth=".5" strokeDasharray="2 1.6" />
    </g>
  ),
}

const creamSheetDef: CollageDef = {
  label: 'Cream paper', group: 'pieces', w: 100, h: 110, slots: [],
  under: (
    <g>
      <defs>
        <linearGradient id="ts-paper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f6f1e6" /><stop offset="1" stopColor="#ece4d2" /></linearGradient>
        {PAPER_NOISE('ts-n')}
      </defs>
      <rect x="0" y="0" width="100" height="110" rx="2" fill="url(#ts-paper)" style={{ filter: 'drop-shadow(0 2px 4px rgba(60,40,20,.25))' }} />
      <rect x="0" y="0" width="100" height="110" rx="2" fill="#000" filter="url(#ts-n)" opacity=".55" />
    </g>
  ),
}

const cameraDecoDef: CollageDef = { label: 'Instant camera', group: 'pieces', w: 100, h: 63, slots: [], over: <Camera x={0} y={0} w={100} /> }

/* ---------- the list ---------- */

export type CollageKind =
  | 'camera3' | 'camera1' | 'polaroid' | 'stamp' | 'stampWide' | 'film4' | 'film3v'
  | 'ticketCream' | 'ticketPink' | 'ticketTeal' | 'ticketMustard' | 'ticketLilac'
  | 'paperLetter' | 'corkBoard' | 'creamSheet' | 'cameraDeco'

export const COLLAGES: Record<CollageKind, CollageDef> = {
  camera3: cameraDef(3),
  camera1: cameraDef(1),
  polaroid: polaroidDef,
  stamp: stampDef,
  stampWide: stampWideDef,
  film4: filmDef(4, false, 'Film strip'),
  film3v: filmDef(3, true, 'Film strip, upright'),
  ticketCream: ticketDef('cream', 'Ticket, cream'),
  ticketPink: ticketDef('pink', 'Ticket, pink'),
  ticketTeal: ticketDef('teal', 'Ticket, green'),
  ticketMustard: ticketDef('mustard', 'Ticket, mustard'),
  ticketLilac: ticketDef('lilac', 'Ticket, lilac'),
  paperLetter: paperLetterDef,
  corkBoard: corkBoardDef,
  creamSheet: creamSheetDef,
  cameraDeco: cameraDecoDef,
}

export const FRAME_KINDS = (Object.keys(COLLAGES) as CollageKind[]).filter((k) => COLLAGES[k].group === 'frames')

export { FrameArt }
