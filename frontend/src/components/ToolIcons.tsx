import type { ReactNode } from 'react'
import { shade } from '../lib/color'

/**
 * The app's tool icons: soft blue/purple tones for editing, warm colours for places and decorations.
 * Each one draws on a 24 x 24 grid and carries its own gradients, so it can be dropped in anywhere.
 */
const S = ({ children, size = 26 }: { children: ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden style={{ overflow: 'visible' }}>{children}</svg>
)
const G = ({ id, a, b, vertical = true }: { id: string; a: string; b: string; vertical?: boolean }) => (
  <linearGradient id={id} x1="0" y1="0" x2={vertical ? 0 : 1} y2={vertical ? 1 : 1}>
    <stop offset="0" stopColor={a} />
    <stop offset="1" stopColor={b} />
  </linearGradient>
)

const Pencil = ({ x = 0, y = 0, s = 1, id }: { x?: number; y?: number; s?: number; id: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s}) rotate(45 12 12)`}>
    <defs><G id={id} a="#9DB7FF" b="#4F7BFF" /></defs>
    <rect x="9.3" y="1.5" width="5.4" height="15" rx="1.4" fill={`url(#${id})`} />
    <rect x="9.3" y="1.5" width="5.4" height="3.4" rx="1.4" fill="#3F6BF5" />
    <rect x="9.3" y="5.6" width="5.4" height="1.4" fill="#fff" opacity=".7" />
    <path d="M9.3 16.5 12 22.5l2.7-6Z" fill="#1B46D8" />
  </g>
)

export const IcEdit = () => <S><Pencil id="ic-pen" /></S>

export const IcThread = () => (
  <S>
    <path d="M5.5 17.5C5.8 10 10 6.8 17 6.2" stroke="#5B6477" strokeWidth="2.2" strokeLinecap="round" />
    <circle cx="18" cy="6" r="3.3" fill="#2F62F0" /><circle cx="18" cy="6" r="1.2" fill="#9DB7FF" />
    <circle cx="5.5" cy="18.5" r="3.3" fill="#2F62F0" /><circle cx="5.5" cy="18.5" r="1.2" fill="#9DB7FF" />
  </S>
)

export const IcCopy = () => (
  <S>
    <defs><G id="ic-copy" a="#5B8CFF" b="#2A5CF0" /></defs>
    <path d="M4.2 14.5V6.5A2.8 2.8 0 0 1 7 3.7h8" stroke="#A9BFF7" strokeWidth="2.2" strokeLinecap="round" />
    <rect x="8.5" y="8.5" width="12" height="12" rx="3" fill="url(#ic-copy)" />
  </S>
)

export const IcUp = () => (
  <S>
    <path d="M12 13 L20 17 L12 21 L4 17 Z" fill="#BCCBF2" stroke="#BCCBF2" strokeWidth="2" strokeLinejoin="round" />
    <path d="M12 9 L20 13 L12 17 L4 13 Z" fill="#2F62F0" stroke="#2F62F0" strokeWidth="2" strokeLinejoin="round" />
    <path d="M12 10.5V3M8.6 6.4 12 3l3.4 3.4" stroke="#1D4ED8" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const IcDown = () => (
  <S>
    <path d="M12 9 L20 13 L12 17 L4 13 Z" fill="#F59A23" stroke="#F59A23" strokeWidth="2" strokeLinejoin="round" />
    <path d="M12 3 L20 7 L12 11 L4 7 Z" fill="#D5D8DD" stroke="#D5D8DD" strokeWidth="2" strokeLinejoin="round" />
    <path d="M12 15.5V22M8.6 18.6 12 22l3.4-3.4" stroke="#EA7C0B" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const IcTrash = () => (
  <S>
    <defs><G id="ic-trash" a="#FFA3AB" b="#F2606D" /></defs>
    <rect x="9" y="2.6" width="6" height="3.6" rx="1.6" fill="#FF8A94" />
    <path d="M6 9h12l-.9 10.4a2.2 2.2 0 0 1-2.2 2H9.1a2.2 2.2 0 0 1-2.2-2Z" fill="url(#ic-trash)" />
    <rect x="3.8" y="5.6" width="16.4" height="2.6" rx="1.3" fill="#F0505C" />
    <rect x="9.3" y="11" width="1.9" height="7" rx=".95" fill="#E23B4E" /><rect x="12.8" y="11" width="1.9" height="7" rx=".95" fill="#E23B4E" />
  </S>
)

export const IcFrame = () => (
  <S>
    <defs><G id="ic-frame" a="#7FA3FF" b="#3F6BF5" /></defs>
    <path d="M3 8.2h18M3 15.8h18M8.2 3v18M15.8 3v18" stroke="url(#ic-frame)" strokeWidth="2.3" strokeLinecap="round" />
  </S>
)

export const IcExpand = () => (
  <S>
    <path d="M14 3.5h6.5V10M10 20.5H3.5V14M20.5 3.5l-7 7M3.5 20.5l7-7" stroke="#4F7BFF" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const IcPalette = () => (
  <S>
    <circle cx="12" cy="12" r="9.2" fill="#FFD27F" />
    <circle cx="8.3" cy="10" r="1.7" fill="#EF5B7B" /><circle cx="12.2" cy="7.2" r="1.7" fill="#5B8CFF" /><circle cx="16" cy="10.4" r="1.7" fill="#3FBF8A" />
    <circle cx="12" cy="15.8" r="2.3" fill="#fff" opacity=".9" />
  </S>
)

export const IcSticker = () => (
  <S>
    <defs><linearGradient id="ic-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFEB93" /><stop offset="1" stopColor="#FFC13A" /></linearGradient></defs>
    <circle cx="12" cy="12" r="9.6" fill="url(#ic-face)" />
    <circle cx="8.8" cy="10.2" r="1.25" fill="#8B4A12" /><circle cx="15.2" cy="10.2" r="1.25" fill="#8B4A12" />
    <path d="M7.8 14c1 2.6 7.4 2.6 8.4 0" stroke="#8B4A12" strokeWidth="1.8" strokeLinecap="round" />
  </S>
)

export const IcDraw = () => (
  <S>
    <Pencil x={2.5} y={-2.5} s={0.88} id="ic-pen2" />
    <path d="M2.6 21c1.6-1.9 3-1.9 4.5 0s3 1.9 4.5 0 3-1.9 4.5 0" stroke="#6B63E8" strokeWidth="2" strokeLinecap="round" />
  </S>
)

export const IcText = () => (
  <S>
    <path d="M5 7.2V5h14v2.2M12 5v14M9 19h6" stroke="#4B5568" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const IcPhoto = () => (
  <S>
    <defs><G id="ic-photo" a="#CFE2FF" b="#8CB0FF" /><G id="ic-hill" a="#5C93FF" b="#1F5BEF" /></defs>
    <rect x="2.5" y="3.5" width="19" height="17" rx="3.8" fill="url(#ic-photo)" />
    <circle cx="8.4" cy="8.8" r="2.3" fill="#2F62F0" />
    <path d="M4.2 20.5c0-.8.2-1.3.8-1.9l5.4-5.6a1.6 1.6 0 0 1 2.3 0L21.5 20v.5Z" fill="url(#ic-hill)" />
    <path d="M13.5 15.5l2.3-2.4a1.6 1.6 0 0 1 2.3 0l3.4 3.7V20.5H17Z" fill="#1F5BEF" opacity=".55" />
  </S>
)

export const IcMore = () => (
  <S><circle cx="4.6" cy="12" r="2.2" fill="#3A4358" /><circle cx="12" cy="12" r="2.2" fill="#3A4358" /><circle cx="19.4" cy="12" r="2.2" fill="#3A4358" /></S>
)

export const IcNote = () => (
  <S>
    <defs><G id="ic-note" a="#F1F4FF" b="#B9C6F5" /></defs>
    <path d="M6 3h8.6L20 8.4V19a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="url(#ic-note)" />
    <path d="M14.6 3v4a1.6 1.6 0 0 0 1.6 1.6H20Z" fill="#5B6EF0" />
  </S>
)

export const IcBubble = () => (
  <S>
    <defs><G id="ic-bub" a="#A9E7AE" b="#45B672" /></defs>
    <path d="M12 3.2a8.6 8 0 1 1-4.3 14.9L4.2 20.4l1.2-3.9A8.6 8 0 0 1 12 3.2Z" fill="url(#ic-bub)" />
  </S>
)

const Snap = ({ x, y, r, a, b, c }: { x: number; y: number; r: number; a: string; b: string; c: string }) => (
  <g transform={`translate(${x} ${y}) rotate(${r} 4.7 6) scale(1.32)`}>
    <rect width="7.2" height="9.2" rx="1.3" fill="#fff" stroke="#DCE2F0" strokeWidth=".45" />
    <rect x=".9" y=".9" width="5.4" height="5.6" rx=".8" fill={a} />
    <circle cx="2.7" cy="2.6" r=".9" fill={b} />
    <path d="M.9 6.5 3.1 4.1 4.1 5.2 5 4 6.3 5.4V6.5Z" fill={c} />
  </g>
)
const Peg = ({ x, y }: { x: number; y: number }) => <rect x={x} y={y} width="2.4" height="3.6" rx=".9" fill="#E9A23B" />

/** two little photos pegged to a line */
export const IcLine = () => (
  <S>
    <path d="M1 3.6Q12 8.2 23 3.6" stroke="#B07A4A" strokeWidth="1.7" strokeLinecap="round" />
    <Snap x={1.6} y={7.2} r={-8} a="#CFE0FF" b="#8FB0FF" c="#4F86F0" />
    <Snap x={12.8} y={7.6} r={8} a="#FFE2C4" b="#FFBE85" c="#F29B4D" />
    <Peg x={5.2} y={3.6} /><Peg x={16.4} y={4.6} />
  </S>
)

export const IcPin = () => (
  <S>
    <defs><G id="ic-pin" a="#FF7C89" b="#E8283F" /></defs>
    <path d="M12 22S4.8 14.4 4.8 9.4a7.2 7.2 0 0 1 14.4 0C19.2 14.4 12 22 12 22Z" fill="url(#ic-pin)" />
    <circle cx="12" cy="9.5" r="2.9" fill="#fff" />
  </S>
)

export const IcFlag = () => (
  <S>
    <defs><G id="ic-flag" a="#FFE48F" b="#FF9F2E" vertical={false} /></defs>
    <path d="M7.5 4.6c3.2-2.2 5 1.8 8 .2 1.6-.9 2.6-.6 3.2-.2V12c-.6-.4-1.6-.7-3.2.2-3 1.6-4.8-2.4-8-.2Z" fill="url(#ic-flag)" />
    <rect x="4.7" y="2.6" width="2.4" height="18.6" rx="1.2" fill="#F97316" />
  </S>
)

export const IcGrid = () => (
  <S>
    <defs><G id="ic-grid" a="#C3A9FF" b="#6B63E8" /></defs>
    {[0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => (
      <rect key={`${r}${c}`} x={3 + c * 6.2} y={3 + r * 6.2} width="5" height="5" rx="1.3" fill="url(#ic-grid)" opacity={(r + c) % 2 ? 0.75 : 1} />
    )))}
  </S>
)

export const IcPhone = () => (
  <S>
    <defs><G id="ic-phone" a="#F1ECFF" b="#C7BAFF" /></defs>
    <rect x="6" y="2.4" width="12" height="19.2" rx="3.4" fill="url(#ic-phone)" stroke="#6B63E8" strokeWidth="2.3" />
  </S>
)

export const IcCamera = () => (
  <S>
    <defs><G id="ic-cam" a="#8FAEFF" b="#3F6BF5" /></defs>
    <path d="M8.6 5.6l.9-1.7A1.3 1.3 0 0 1 10.7 3h2.6a1.3 1.3 0 0 1 1.2.9l.9 1.7H19A2.5 2.5 0 0 1 21.5 8v10a2.5 2.5 0 0 1-2.5 2.5H5A2.5 2.5 0 0 1 2.5 18V8A2.5 2.5 0 0 1 5 5.6Z" fill="url(#ic-cam)" />
    <circle cx="12" cy="12.6" r="4.6" fill="#fff" /><circle cx="12" cy="12.6" r="2.6" fill="#2F62F0" />
    <circle cx="18.2" cy="8.8" r="1" fill="#fff" opacity=".85" />
  </S>
)

export const IcGallery = () => (
  <S>
    <defs><G id="ic-gal" a="#CFE2FF" b="#8CB0FF" /><G id="ic-galh" a="#5C93FF" b="#1F5BEF" /></defs>
    <rect x="6" y="2.5" width="15.5" height="14" rx="3.2" fill="#C5D6FB" />
    <rect x="2.5" y="6.5" width="15.5" height="14.5" rx="3.4" fill="url(#ic-gal)" />
    <circle cx="7.4" cy="11.2" r="1.9" fill="#2F62F0" />
    <path d="M3.6 20.6c0-.6.2-1.1.7-1.6l4.2-4.4a1.4 1.4 0 0 1 2 0L18 20.5v.5H4.5Z" fill="url(#ic-galh)" />
  </S>
)

export const IcShare = () => (
  <S>
    <path d="M6.5 12 17.5 6M6.5 12l11 6" stroke="#8FAEF5" strokeWidth="2" strokeLinecap="round" />
    <circle cx="6" cy="12" r="3.4" fill="#2F62F0" /><circle cx="18" cy="5.6" r="3.2" fill="#5B8CFF" /><circle cx="18" cy="18.4" r="3.2" fill="#5B8CFF" />
  </S>
)

export const IcPeople = () => (
  <S>
    <circle cx="16.6" cy="8.4" r="3" fill="#B7C6F7" />
    <path d="M12.6 19.5c.2-3.1 1.9-5 4-5s3.8 1.9 4 5Z" fill="#B7C6F7" />
    <circle cx="9.4" cy="8" r="3.6" fill="#2F62F0" />
    <path d="M2.8 20.2c.3-3.8 2.7-6.2 6.6-6.2s6.3 2.4 6.6 6.2Z" fill="#3F6BF5" />
  </S>
)

export const IcDownload = () => (
  <S>
    <path d="M4 14.6v3.4A2.6 2.6 0 0 0 6.6 20.6h10.8A2.6 2.6 0 0 0 20 18v-3.4" stroke="#8FAEF5" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M12 3.4v11M7.4 10.2 12 14.8l4.6-4.6" stroke="#2F62F0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

export const IcDone = () => (
  <S size={20}>
    <defs><G id="ic-done" a="#7BEFAE" b="#1FB864" /></defs>
    <circle cx="12" cy="12" r="10" fill="url(#ic-done)" />
    <path d="M7.4 12.4l3.3 3.3 6-7" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)

/** the thread button while a thread is being tied: warm colours, a moving dashed line, a ring waiting for the second item */
export const IcThreadOn = () => (
  <S>
    <path d="M5.5 17.5C5.8 10 10 6.8 17 6.2" stroke="#F97316" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3.2 3.2">
      <animate attributeName="stroke-dashoffset" from="12.8" to="0" dur="0.9s" repeatCount="indefinite" />
    </path>
    <circle cx="5.5" cy="18.5" r="3.4" fill="#F97316" /><circle cx="5.5" cy="18.5" r="1.3" fill="#FFE2C4" />
    <circle cx="18" cy="6" r="3.2" fill="none" stroke="#F97316" strokeWidth="2" strokeDasharray="2.6 2">
      <animate attributeName="r" values="3.2;4.4;3.2" dur="1.1s" repeatCount="indefinite" />
    </circle>
  </S>
)

/* ---- drawing tools: upright 3D pieces with glossy white bodies; the tip and the little detail take the picked colour ---- */
type TP = { c?: string }
/** the round, shiny white body: soft at the edges, bright in the middle, with a highlight strip */
const Body = ({ id, x, y, w, h, r = 2 }: { id: string; x: number; y: number; w: number; h: number; r?: number }) => (
  <>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stopColor="#C9D0DE" /><stop offset=".22" stopColor="#F4F6FA" /><stop offset=".55" stopColor="#FFFFFF" /><stop offset="1" stopColor="#BFC7D6" />
      </linearGradient>
    </defs>
    <rect x={x} y={y} width={w} height={h} rx={r} fill={`url(#${id})`} />
    <rect x={x + w * 0.2} y={y + 1} width={w * 0.12} height={h - 2} rx={w * 0.06} fill="#fff" opacity=".85" />
  </>
)
/** a metal ring between the tip and the body */
const Ring = ({ id, x, y, w, h = 1.6 }: { id: string; x: number; y: number; w: number; h?: number }) => (
  <>
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#8E97AA" /><stop offset=".35" stopColor="#E6EAF2" /><stop offset="1" stopColor="#8A93A6" /></linearGradient>
    </defs>
    <rect x={x} y={y} width={w} height={h} rx=".5" fill={`url(#${id})`} />
  </>
)
/** a glossy coloured piece (tip, dot, stripe) */
const Gem = ({ id, c }: { id: string; c: string }) => (
  <defs>
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={shade(c, 0.45)} /><stop offset=".55" stopColor={c} /><stop offset="1" stopColor={shade(c, -0.32)} /></linearGradient>
  </defs>
)
export const IcPenTool = ({ c = '#2F8FD0' }: TP) => (
  <S size={30}>
    <defs><linearGradient id="t3-pn" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#555C70" /><stop offset=".4" stopColor="#8D95AA" /><stop offset="1" stopColor="#2A2F3C" /></linearGradient></defs>
    <path d="M9.2 9.6 12 1.4l2.8 8.2Z" fill="url(#t3-pn)" />
    <Ring id="t3-pr" x={8.4} y={9.2} w={7.2} />
    <Body id="t3-pb" x={8} y={10.8} w={8} h={14} />
    <Gem id="t3-pg" c={c} />
    <rect x="11.1" y="13.6" width="1.8" height="8" rx=".9" fill="url(#t3-pg)" />
  </S>
)
export const IcMarkerTool = ({ c = '#2F8FD0' }: TP) => (
  <S size={30}>
    <Gem id="t3-mg" c={c} />
    <path d="M12 1.2C14.8 4.8 15.8 7.6 14.8 9.8H9.2C8.2 7.6 9.2 4.8 12 1.2Z" fill="url(#t3-mg)" />
    <path d="M11 3.8C10 5.6 9.9 7.4 10.4 8.8" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" strokeLinecap="round" />
    <Ring id="t3-mr" x={8.6} y={9.6} w={6.8} />
    <Body id="t3-mb" x={8.2} y={11.2} w={7.6} h={14} r={1.8} />
    <circle cx="12" cy="15.6" r="1.3" fill="url(#t3-mg)" />
  </S>
)
export const IcHighlighterTool = ({ c = '#FFB020' }: TP) => (
  <S size={30}>
    <Gem id="t3-hg" c={c} />
    <path d="M8.6 8.8 9 4 14.4 1.4 15.2 8.8Z" fill="url(#t3-hg)" />
    <path d="M9.6 4.6 14 2.6" stroke="#fff" strokeOpacity=".55" strokeWidth=".8" strokeLinecap="round" />
    <path d="M9.2 8.8h6.2l.9 2.8H8.4Z" fill="#EDF0F6" />
    <Ring id="t3-hr" x={8} y={11.4} w={8} />
    <Body id="t3-hb" x={7.4} y={13} w={9.2} h={12} r={1.8} />
    <circle cx="12" cy="17.8" r="1.3" fill="url(#t3-hg)" />
  </S>
)
export const IcPencilTool = ({ c = '#2A2F3C' }: TP) => (
  <S size={30}>
    <defs><linearGradient id="t3-wd" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#E8B67A" /><stop offset=".5" stopColor="#FFDDB0" /><stop offset="1" stopColor="#D9A15F" /></linearGradient></defs>
    <Gem id="t3-pcg" c={c} />
    <path d="M8.2 10.8 10.5 5.4h3l2.3 5.4Z" fill="url(#t3-wd)" />
    <path d="M10.5 5.4 12 1.6l1.5 3.8Z" fill="url(#t3-pcg)" />
    <Body id="t3-pcb" x={8} y={10.6} w={8} h={14.4} r={1.2} />
    <path d="M12 11.6V25" stroke="#B9C1D1" strokeWidth=".5" opacity=".7" />
  </S>
)
export const IcEraserTool = () => (
  <S size={30}>
    <Body id="t3-eb" x={6.6} y={4.4} w={10.8} h={20.6} r={3} />
    <defs><linearGradient id="t3-eg" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#B4BBCB" /><stop offset=".4" stopColor="#E3E7EF" /><stop offset="1" stopColor="#A7AFC0" /></linearGradient></defs>
    <rect x="6.6" y="12.8" width="10.8" height="12.2" rx="2.4" fill="url(#t3-eg)" />
    <circle cx="11.4" cy="15.6" r=".7" fill="#8A93A6" /><circle cx="12.8" cy="16.8" r=".7" fill="#8A93A6" /><circle cx="11.2" cy="17.8" r=".7" fill="#8A93A6" />
    <path d="M12 19.4c1.2.8-.2 1.6.4 2.8" stroke="#8A93A6" strokeWidth=".8" fill="none" strokeLinecap="round" />
  </S>
)

/** a clapperboard: "make a story" */
export const IcClapper = () => (
  <S size={20}>
    <defs><G id="ic-clap" a="#9DB4FF" b="#4F6BFF" /></defs>
    <rect x="3" y="10" width="18" height="11" rx="2.6" fill="url(#ic-clap)" />
    <g transform="rotate(-9 4 9)">
      <rect x="3.2" y="4.2" width="17.6" height="5" rx="1.5" fill="#FFC857" />
      <path d="M7 4.2 9.6 9.2H6.2L4 4.2Z M13 4.2 15.6 9.2H12.2L10 4.2Z M19 4.2 20.8 8.4V9.2H18.2L16 4.2Z" fill="#2A2F3C" opacity=".85" />
    </g>
    <circle cx="12" cy="15.5" r="2" fill="#fff" opacity=".9" />
  </S>
)

export const IcCrayonTool = ({ c = '#E5486F' }: TP) => (
  <S size={30}>
    <Gem id="t3-cg" c={c} />
    <path d="M9 8.8 12 1.6l3 7.2Z" fill="url(#t3-cg)" />
    <path d="M10.8 6.4 12 3.4" stroke="#fff" strokeOpacity=".5" strokeWidth=".8" strokeLinecap="round" />
    <Body id="t3-cb" x={7.8} y={8.6} w={8.4} h={16.4} r={1.6} />
    <rect x="7.8" y="12.4" width="8.4" height="5.2" fill="url(#t3-cg)" />
    <rect x="9.4" y="12.6" width="1" height="4.8" rx=".5" fill="#fff" opacity=".45" />
  </S>
)
export const IcCalligraphyTool = ({ c = '#3FA84E' }: TP) => (
  <S size={30}>
    <defs><linearGradient id="t3-nb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#9AA3B5" /><stop offset=".45" stopColor="#F1F3F8" /><stop offset="1" stopColor="#8A93A6" /></linearGradient></defs>
    <path d="M12 1.6c1.2 2.4 3.6 4.2 4.6 6.6-1 1.4-2.5 2.2-4.6 2.6-2.1-.4-3.6-1.2-4.6-2.6C8.4 5.8 10.8 4 12 1.6Z" fill="url(#t3-nb)" />
    <path d="M12 2.6v8" stroke="#2A2F3C" strokeWidth=".6" />
    <Gem id="t3-ng" c={c} />
    <circle cx="12" cy="7.4" r="1.2" fill="url(#t3-ng)" />
    <Ring id="t3-nr" x={8.4} y={10.6} w={7.2} />
    <Body id="t3-nbd" x={8} y={12.2} w={8} h={12.8} />
    <rect x="11.1" y="15" width="1.8" height="8.4" rx=".9" fill="url(#t3-ng)" />
  </S>
)

/** a page layout: header band and two columns */
export const IcTemplates = () => (
  <S>
    <defs><G id="ic-tpl" a="#B9A4FF" b="#6A5CF0" /><G id="ic-tpl2" a="#FFD08A" b="#F59A2B" /></defs>
    <rect x="3" y="3" width="18" height="18" rx="3.4" fill="#fff" stroke="#D7DAF2" strokeWidth="1.2" />
    <rect x="5.4" y="5.4" width="13.2" height="4.4" rx="1.4" fill="url(#ic-tpl)" />
    <rect x="5.4" y="11.4" width="6" height="7.2" rx="1.4" fill="url(#ic-tpl2)" />
    <rect x="13" y="11.4" width="5.6" height="2.8" rx="1.1" fill="#C8CCE8" /><rect x="13" y="15.6" width="5.6" height="3" rx="1.1" fill="#C8CCE8" />
  </S>
)
export const IcLock = () => (
  <S>
    <defs><G id="ic-lock" a="#FFC66B" b="#F28A1E" /></defs>
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="#5B6477" strokeWidth="2.2" strokeLinecap="round" />
    <rect x="4.6" y="10" width="14.8" height="10.6" rx="3" fill="url(#ic-lock)" />
    <circle cx="12" cy="15" r="1.6" fill="#7A3E05" /><rect x="11.3" y="15.2" width="1.4" height="3" rx=".7" fill="#7A3E05" />
  </S>
)
export const IcUnlock = () => (
  <S>
    <defs><G id="ic-unlock" a="#9FE0BE" b="#2DB574" /></defs>
    <path d="M8 10.5V8a4 4 0 0 1 7.6-1.7" fill="none" stroke="#5B6477" strokeWidth="2.2" strokeLinecap="round" />
    <rect x="4.6" y="10" width="14.8" height="10.6" rx="3" fill="url(#ic-unlock)" />
    <circle cx="12" cy="15" r="1.6" fill="#0C5A37" /><rect x="11.3" y="15.2" width="1.4" height="3" rx=".7" fill="#0C5A37" />
  </S>
)

/* ---------- the text page's tabs ---------- */

export const IcFontTool = () => (
  <S size={28}>
    <defs><G id="tf-a" a="#B79CFF" b="#6B4DF0" /></defs>
    <rect x="2.5" y="2.5" width="19" height="19" rx="6" fill="url(#tf-a)" />
    <path d="M6.6 17.4 11 6.6h2l4.4 10.8M8.2 13.6h7.6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </S>
)
export const IcSizeTool = () => (
  <S size={28}>
    <defs><G id="ts-a" a="#8FE0C2" b="#27B38A" /></defs>
    <rect x="2.5" y="2.5" width="19" height="19" rx="6" fill="url(#ts-a)" />
    <path d="M5.4 17.6 8.6 9.2h.8l3.2 8.4M6.6 14.6h4.8" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M13.2 17.6l2.7-6.2h.7l2.7 6.2M14.2 15.4h3.8" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity=".85" />
  </S>
)
export const IcAlignTool = ({ align = 'left' }: { align?: 'left' | 'center' | 'right' }) => {
  const at = (w: number) => (align === 'left' ? 6 : align === 'right' ? 18 - w : 12 - w / 2)
  return (
    <S size={28}>
      <defs><G id="ta-a" a="#FFC38A" b="#F2873A" /></defs>
      <rect x="2.5" y="2.5" width="19" height="19" rx="6" fill="url(#ta-a)" />
      {[[6.5, 12], [10.2, 7.6], [13.9, 10], [17.6, 6]].map(([y, w]) => (
        <path key={y} d={`M${at(w)} ${y}h${w}`} stroke="#fff" strokeWidth="1.9" strokeLinecap="round" />
      ))}
    </S>
  )
}
export const IcColorTool = () => (
  <S size={28}>
    <defs><G id="tc-a" a="#FFE7A8" b="#FFC24D" /></defs>
    <circle cx="12" cy="12" r="9.6" fill="url(#tc-a)" />
    <circle cx="8" cy="10.2" r="2" fill="#EF5B7B" /><circle cx="12.4" cy="6.8" r="2" fill="#5B8CFF" /><circle cx="16.4" cy="10.6" r="2" fill="#3FBF8A" />
    <circle cx="12" cy="16.2" r="2.6" fill="#fff" opacity=".92" />
  </S>
)
