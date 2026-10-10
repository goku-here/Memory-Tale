import type { ReactNode } from 'react'

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

export const IcLine = () => (
  <S>
    <defs><G id="ic-line" a="#CFE2FF" b="#5C93FF" /></defs>
    <path d="M3 9.5V19.5a1.5 1.5 0 0 0 1.5 1.5H14" stroke="#8FAEF5" strokeWidth="2.2" strokeLinecap="round" />
    <rect x="8" y="3" width="13.5" height="12.5" rx="3" fill="url(#ic-line)" />
    <circle cx="12.4" cy="7.3" r="1.7" fill="#2F62F0" />
    <path d="M8.6 15.5l3.6-3.8a1.2 1.2 0 0 1 1.8 0l3.7 3.8Z" fill="#2F62F0" />
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
