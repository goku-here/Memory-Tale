import type { ReactNode } from 'react'

export interface SvgSticker { label: string; ratio: number; art: ReactNode }

const FONT_COMIC = "Bangers, 'Comic Neue', cursive"

/* ---------- word stickers ---------- */
function word(label: string, bg: string, fg: string, font = FONT_COMIC, size = 26): SvgSticker {
  const w = Math.max(70, label.length * size * 0.52 + 30)
  return {
    label, ratio: w / 44,
    art: (
      <svg viewBox={`0 0 ${w} 44`} width="100%" height="100%">
        <rect x="2" y="2" width={w - 4} height="40" rx="12" fill={bg} stroke={fg} strokeOpacity=".18" strokeWidth="2" />
        <text x={w / 2} y="30" textAnchor="middle" fontFamily={font} fontSize={size} fill={fg} letterSpacing=".5">{label}</text>
      </svg>
    ),
  }
}

/* ---------- comic sound effects ---------- */
function burst(points = 14, rx = 58, ry = 28, cx = 60, cy = 32) {
  const pts: string[] = []
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2
    const k = i % 2 ? 0.7 : 1
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)},${(cy + Math.sin(a) * ry * k).toFixed(1)}`)
  }
  return pts.join(' ')
}
function sfx(label: string, color: string, opts: { bg?: string; rot?: number; size?: number; font?: string; stroke?: string } = {}): SvgSticker {
  const { bg, rot = -6, size = 30, font = FONT_COMIC, stroke = '#fff' } = opts
  return {
    label, ratio: 120 / 64,
    art: (
      <svg viewBox="0 0 120 64" width="100%" height="100%">
        {bg && <polygon points={burst()} fill={bg} stroke="#17171a" strokeWidth="2.4" strokeLinejoin="round" />}
        <g transform={`rotate(${rot} 60 34)`}>
          <text x="60" y="43" textAnchor="middle" fontFamily={font} fontSize={size} fill={color} stroke={stroke} strokeWidth="6" paintOrder="stroke" strokeLinejoin="round" letterSpacing="1">{label}</text>
        </g>
      </svg>
    ),
  }
}

/* ---------- paper & tape ---------- */
const TORN = 'M3 8 L12 4 L22 9 L33 3 L45 8 L58 3 L70 9 L84 4 L96 8 L117 5 L116 22 L119 38 L114 52 L118 66 L104 70 L92 65 L78 71 L64 66 L50 72 L36 66 L22 71 L8 65 L3 70 L5 52 L1 38 L5 22 Z'
function scrap(label: string, fill: string, lines = false): SvgSticker {
  return {
    label, ratio: 1.6,
    art: (
      <svg viewBox="0 0 120 76" width="100%" height="100%">
        <path d={TORN} fill={fill} />
        {lines && <g stroke="#9fb7d6" strokeWidth="1.3">{[22, 33, 44, 55].map((y) => <path key={y} d={`M9 ${y}H111`} />)}</g>}
      </svg>
    ),
  }
}

const TAPE_TORN = 'M2 14 L8 6 L5 20 L10 30 L4 40 L9 52 L3 60 L110 58 L116 46 L111 36 L117 24 L112 12 L118 4 L6 4 Z'

export const PACK_SVGS: Record<string, SvgSticker> = {
  /* words */
  'w-love': word('LOVE', '#E5486F', '#fff'),
  'w-best': word('Best day ever', '#FFE27A', '#6b4a00', "Caveat, cursive", 28),
  'w-xoxo': word('xoxo', '#F5B5C8', '#8a1f45', "'Permanent Marker', cursive", 24),
  'w-memories': word('memories', '#fff', '#17171a', "'Dancing Script', cursive", 30),
  'w-date': word('DATE NIGHT', '#17171a', '#fff', "'Bebas Neue', sans-serif", 26),
  'w-hello': word('Hello!', '#9CC5C4', '#14393a'),
  'w-forever': word('Forever', '#BDB1DB', '#2f2058', "'Pacifico', cursive", 24),
  'w-us': word('just us', '#FFD1DC', '#7a2e45', "'Gochi Hand', cursive", 28),
  'w-vibes': word('good vibes', '#A8C3A6', '#1f3d22', "'Patrick Hand', cursive", 28),
  'w-cheers': word('Cheers!', '#F1B99B', '#6b2d10'),
  'w-fav': word('favourite day', '#fff', '#E5486F', "Caveat, cursive", 28),
  'w-mine': word('MINE', '#2F7BE5', '#fff', "'Luckiest Guy', cursive", 24),
  /* comic */
  'c-bump': sfx('BUMP!', '#17171a', { rot: -8 }),
  'c-peek': sfx('peek', '#8c3b4a', { size: 34, font: "'Gochi Hand', cursive", rot: -5, stroke: 'transparent' }),
  'c-boom': sfx('BOOM!', '#E5342F', { bg: '#FFE27A', size: 28 }),
  'c-pow': sfx('POW!', '#2F7BE5', { bg: '#FFD1DC', size: 30, rot: 6 }),
  'c-wow': sfx('WOW!', '#F28C38', { bg: '#fff', size: 30, rot: -4 }),
  'c-gasp': sfx('GASP!', '#6B4FBB', { rot: 5 }),
  'c-sigh': sfx('sigh...', '#555', { size: 30, font: "'Gochi Hand', cursive", rot: -4, stroke: 'transparent' }),
  'c-mwah': sfx('MWAH', '#E5486F', { rot: -7 }),
  'c-gulp': sfx('GULP', '#2E9E6B', { rot: 4 }),
  'c-zzz': sfx('Zzz', '#2F7BE5', { size: 36, rot: -10 }),
  'c-shock': sfx('!!', '#E5342F', { size: 46, rot: -6 }),
  'c-what': sfx('?!', '#6B4FBB', { size: 46, rot: 6 }),
  /* doodles */
  'd-loop': {
    label: 'Curl', ratio: 1.3,
    art: <svg viewBox="0 0 130 100" width="100%" height="100%"><path d="M8 70 C20 20 50 10 60 40 C68 66 30 70 38 42 C46 14 90 8 100 36 C108 60 90 84 120 80" fill="none" stroke="#17171a" strokeWidth="7" strokeLinecap="round" /></svg>,
  },
  'd-rings': {
    label: 'Rings', ratio: 1.2,
    art: <svg viewBox="0 0 120 100" width="100%" height="100%" fill="none" stroke="#17171a" strokeWidth="2.6" strokeLinecap="round"><ellipse cx="60" cy="50" rx="52" ry="38" /><ellipse cx="60" cy="50" rx="55" ry="36" transform="rotate(8 60 50)" /><ellipse cx="58" cy="52" rx="50" ry="40" transform="rotate(-6 60 50)" /></svg>,
  },
  'd-hearts': {
    label: 'Black hearts', ratio: 1.4,
    art: <svg viewBox="0 0 120 86" width="100%" height="100%"><path d="M34 70 C6 48 12 22 32 28 C42 31 44 40 44 40 C44 40 50 24 66 32 C84 42 60 62 34 70Z" fill="#17171a" /><path d="M86 74 C66 60 72 42 86 46 C92 48 94 54 94 54 C96 44 106 42 112 50 C118 60 102 68 86 74Z" fill="#17171a" transform="translate(-4 -8) scale(.95)" /></svg>,
  },
  'd-wave': {
    label: 'Wave line', ratio: 3,
    art: <svg viewBox="0 0 150 50" width="100%" height="100%"><path d="M6 28 C20 4 34 4 46 26 S72 48 84 26 S110 4 122 26 S138 40 144 24" fill="none" stroke="#17171a" strokeWidth="5" strokeLinecap="round" /></svg>,
  },
  'd-bolt': {
    label: 'Lightning', ratio: 0.7,
    art: <svg viewBox="0 0 70 100" width="100%" height="100%"><path d="M42 4 L8 56 H32 L22 96 L62 38 H38 Z" fill="#FFD84D" stroke="#17171a" strokeWidth="5" strokeLinejoin="round" /></svg>,
  },
  'd-crown': {
    label: 'Crown', ratio: 1.2,
    art: <svg viewBox="0 0 120 100" width="100%" height="100%"><path d="M10 84 L6 30 L36 54 L60 14 L84 54 L114 30 L110 84 Z" fill="#FFD84D" stroke="#17171a" strokeWidth="5" strokeLinejoin="round" /><circle cx="60" cy="68" r="7" fill="#E5486F" /></svg>,
  },
  'd-spiral': {
    label: 'Spiral', ratio: 1,
    art: <svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 50 m0 0 c4-6 12-4 12 3 s-10 14-20 8 s-8-24 10-28 s36 6 32 28 s-30 36-52 22 s-22-46 2-60" fill="none" stroke="#17171a" strokeWidth="5" strokeLinecap="round" /></svg>,
  },
  'd-check': {
    label: 'Check', ratio: 1,
    art: <svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M14 54 L40 80 L88 20" fill="none" stroke="#2E9E6B" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" /></svg>,
  },
  'd-cross': {
    label: 'Cross', ratio: 1,
    art: <svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M18 18 L82 82 M82 18 L18 82" fill="none" stroke="#E5342F" strokeWidth="14" strokeLinecap="round" /></svg>,
  },
  'd-circle': {
    label: 'Highlight circle', ratio: 1.4,
    art: <svg viewBox="0 0 140 100" width="100%" height="100%"><path d="M70 10 C28 8 6 30 10 54 C14 80 56 92 94 86 C128 80 136 52 124 30 C112 10 80 6 52 12" fill="none" stroke="#E5486F" strokeWidth="6" strokeLinecap="round" /></svg>,
  },
  'd-star': {
    label: 'Star outline', ratio: 1,
    art: <svg viewBox="0 0 100 100" width="100%" height="100%"><path d="M50 8 L62 38 L94 40 L69 60 L78 92 L50 74 L22 92 L31 60 L6 40 L38 38Z" fill="none" stroke="#17171a" strokeWidth="5" strokeLinejoin="round" /></svg>,
  },
  /* paper & tape */
  'p-kraft': scrap('Kraft paper', '#d9b98a'),
  'p-pink': scrap('Pink paper', '#f6c4d2'),
  'p-blue': scrap('Blue paper', '#bcd7ef'),
  'p-lined': scrap('Lined paper', '#fffdf3', true),
  'p-green': scrap('Sage paper', '#c3d3b4'),
  'tape-green-torn': {
    label: 'Torn tape', ratio: 1.9,
    art: <svg viewBox="0 0 120 64" width="100%" height="100%"><path d={TAPE_TORN} fill="#b5c28e" fillOpacity=".92" /><path d="M10 20 L100 16 M10 34 L104 30 M12 48 L98 46" stroke="#fff" strokeOpacity=".25" strokeWidth="2" /></svg>,
  },
  'tape-black': {
    label: 'Black tape', ratio: 2.6,
    art: <svg viewBox="0 0 130 50" width="100%" height="100%"><path d="M4 6 L10 10 L4 15 L10 20 L4 25 L10 30 L4 35 L10 40 L4 45 L126 45 L120 40 L126 35 L120 30 L126 25 L120 20 L126 15 L120 10 L126 5 Z" fill="#2b2b33" /><path d="M16 14h96M16 26h96M16 38h96" stroke="#fff" strokeOpacity=".12" strokeWidth="2" /></svg>,
  },
  'p-tag': {
    label: 'Gift tag', ratio: 0.62,
    art: <svg viewBox="0 0 62 100" width="100%" height="100%"><path d="M16 4 H46 L58 22 V94 H4 V22 Z" fill="#fff6e3" stroke="#c9a572" strokeWidth="3" strokeLinejoin="round" /><circle cx="31" cy="20" r="5" fill="#d9d2c2" stroke="#c9a572" strokeWidth="2" /><path d="M31 15 C26 2 14 2 10 10" fill="none" stroke="#c9a572" strokeWidth="2.4" /></svg>,
  },
  'p-clip': {
    label: 'Paper clip', ratio: 0.42,
    art: <svg viewBox="0 0 42 100" width="100%" height="100%"><path d="M30 28 V74 a14 14 0 0 1 -28 0 V24 a10 10 0 0 1 20 0 V70 a6 6 0 0 1 -12 0 V30" fill="none" stroke="#8d95a3" strokeWidth="5" strokeLinecap="round" /></svg>,
  },
  'p-corners': {
    label: 'Photo corners', ratio: 1,
    art: <svg viewBox="0 0 100 100" width="100%" height="100%" fill="#2b2b33"><path d="M4 4 H34 L4 34Z" /><path d="M96 4 H66 L96 34Z" /><path d="M4 96 H34 L4 66Z" /><path d="M96 96 H66 L96 66Z" /></svg>,
  },
  'p-postmark': {
    label: 'Postmark', ratio: 1.8,
    art: <svg viewBox="0 0 140 78" width="100%" height="100%" fill="none" stroke="#5b4b8a" strokeWidth="2.6"><circle cx="40" cy="39" r="30" /><circle cx="40" cy="39" r="23" strokeWidth="1.4" /><text x="40" y="36" textAnchor="middle" fontFamily="Bebas Neue, sans-serif" fontSize="14" fill="#5b4b8a" stroke="none">KEEP</text><text x="40" y="51" textAnchor="middle" fontFamily="Bebas Neue, sans-serif" fontSize="12" fill="#5b4b8a" stroke="none">SAKE</text><path d="M78 24 Q92 14 104 24 T130 24 M78 39 Q92 29 104 39 T130 39 M78 54 Q92 44 104 54 T130 54" /></svg>,
  },
}
