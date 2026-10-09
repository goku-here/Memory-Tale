import type { ReactNode } from 'react'
import type { SvgSticker } from './stickerPacks'

/**
 * "Beans": an original character family drawn for Memory Tale (not based on any existing character).
 * Every sticker is generated from a few simple parts (body, face, arms, accessories) so there are many variations.
 */
const INK = '#26222c'
const S = { stroke: INK, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

type Mood = 'happy' | 'cry' | 'shout' | 'love' | 'sleepy' | 'shy' | 'angry' | 'surprised' | 'laugh' | 'cool' | 'sad' | 'think' | 'kiss' | 'party' | 'star' | 'cheeky' | 'tired'
type Acc = 'bow' | 'flower' | 'crown' | 'hat' | 'scarf' | 'note' | 'hearts' | 'sparkle'
type Arms = 'down' | 'up' | 'wave'

const heart = (cx: number, cy: number, s: number, fill = '#ff4d6d', stroke = false) => (
  <path
    d={`M${cx} ${cy + s * 0.95} C${cx - s * 1.7} ${cy - s * 0.1} ${cx - s * 0.9} ${cy - s * 1.35} ${cx} ${cy - s * 0.4} C${cx + s * 0.9} ${cy - s * 1.35} ${cx + s * 1.7} ${cy - s * 0.1} ${cx} ${cy + s * 0.95}Z`}
    fill={fill} {...(stroke ? { ...S, strokeWidth: 2 } : {})}
  />
)
const star = (cx: number, cy: number, r: number, fill = '#ffd23f') => {
  const p: string[] = []
  for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2; const k = i % 2 ? r * 0.45 : r; p.push(`${(cx + Math.cos(a) * k).toFixed(1)},${(cy + Math.sin(a) * k).toFixed(1)}`) }
  return <polygon points={p.join(' ')} fill={fill} {...S} strokeWidth={2} />
}
const spark = (cx: number, cy: number, r: number) => (
  <path d={`M${cx} ${cy - r} Q${cx} ${cy} ${cx + r} ${cy} Q${cx} ${cy} ${cx} ${cy + r} Q${cx} ${cy} ${cx - r} ${cy} Q${cx} ${cy} ${cx} ${cy - r}Z`} fill="#ffd23f" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
)

function eyes(m: Mood): ReactNode {
  const L = 45, R = 75, Y = 62
  const dot = (x: number) => <circle key={x} cx={x} cy={Y} r="3.8" fill={INK} />
  const arc = (x: number, up: boolean) => <path key={x} d={up ? `M${x - 6} ${Y + 2} Q${x} ${Y - 7} ${x + 6} ${Y + 2}` : `M${x - 6} ${Y - 1} Q${x} ${Y + 6} ${x + 6} ${Y - 1}`} fill="none" {...S} strokeWidth="3.6" />
  switch (m) {
    case 'happy': case 'laugh': case 'party': return <>{arc(L, true)}{arc(R, true)}</>
    case 'kiss': return <>{arc(L, true)}{arc(R, true)}</>
    case 'cry': case 'sleepy': case 'tired': return <>{arc(L, false)}{arc(R, false)}</>
    case 'love': return <>{heart(L, Y, 5.5)}{heart(R, Y, 5.5)}</>
    case 'star': return <>{star(L, Y, 8)}{star(R, Y, 8)}</>
    case 'surprised': return (
      <>{[L, R].map((x) => <g key={x}><circle cx={x} cy={Y} r="7.5" fill="#fff" {...S} strokeWidth="3" /><circle cx={x} cy={Y} r="3" fill={INK} /></g>)}</>
    )
    case 'angry': return <>{dot(L)}{dot(R)}<path d="M37 52 L52 58 M83 52 L68 58" fill="none" {...S} strokeWidth="3.6" /></>
    case 'sad': return <>{dot(L)}{dot(R)}<path d="M37 57 L52 51 M83 57 L68 51" fill="none" {...S} strokeWidth="3.4" /></>
    case 'cool': return (
      <g>
        <rect x="35" y="53" width="21" height="16" rx="7" fill="#2b2b36" {...S} strokeWidth="3" />
        <rect x="64" y="53" width="21" height="16" rx="7" fill="#2b2b36" {...S} strokeWidth="3" />
        <path d="M56 60 L64 60" fill="none" {...S} strokeWidth="3" />
        <path d="M39 57 L44 57 M68 57 L73 57" stroke="#fff" strokeOpacity=".6" strokeWidth="2.4" strokeLinecap="round" />
      </g>
    )
    case 'cheeky': return <>{dot(L)}{arc(R, true)}</>
    default: return <>{dot(L)}{dot(R)}</>
  }
}

function mouth(m: Mood): ReactNode {
  const open = '#b4536b'
  switch (m) {
    case 'laugh': case 'party': case 'star': return (
      <g><path d="M46 78 Q60 102 74 78Z" fill={open} {...S} strokeWidth="3.4" /><ellipse cx="60" cy="90" rx="6" ry="4" fill="#ff8fa3" /></g>
    )
    case 'shout': return (
      <g><ellipse cx="60" cy="89" rx="11" ry="15" fill={open} {...S} strokeWidth="3.6" /><ellipse cx="60" cy="98" rx="6.5" ry="4.5" fill="#ff8fa3" /></g>
    )
    case 'surprised': return <ellipse cx="60" cy="87" rx="6" ry="8" fill={open} {...S} strokeWidth="3.2" />
    case 'cry': return <path d="M47 92 Q51.5 83 56 92 Q60 83 64 92 Q68.5 83 73 92" fill="none" {...S} strokeWidth="3.4" />
    case 'angry': case 'sad': return <path d="M50 90 Q60 81 70 90" fill="none" {...S} strokeWidth="3.6" />
    case 'think': case 'tired': return <path d="M52 86 L68 86" fill="none" {...S} strokeWidth="3.6" />
    case 'sleepy': case 'shy': return <path d="M54 83 Q60 88 66 83" fill="none" {...S} strokeWidth="3.4" />
    case 'kiss': return <path d="M55 84 Q60 77 65 84 Q60 93 55 84Z" fill="#ff6f91" {...S} strokeWidth="2.6" />
    case 'cheeky': return (
      <g><path d="M49 80 Q60 92 71 80" fill="none" {...S} strokeWidth="3.6" /><path d="M56 87 Q60 99 65 87Z" fill="#ff8fa3" {...S} strokeWidth="2.6" /></g>
    )
    default: return <path d="M49 80 Q60 92 71 80" fill="none" {...S} strokeWidth="3.6" />
  }
}

function extras(m: Mood): ReactNode {
  const blush = <><ellipse cx="35" cy="76" rx="8" ry="5" fill="#ff9bb0" opacity=".8" /><ellipse cx="85" cy="76" rx="8" ry="5" fill="#ff9bb0" opacity=".8" /></>
  const tear = (x: number) => <path key={x} d={`M${x} 68 Q${x - 4} 77 ${x} 82 Q${x + 4} 77 ${x} 68Z`} fill="#6ec1ff" />
  const sweat = <path d="M94 36 Q89 45 94 50 Q99 45 94 36Z" fill="#8fd0ff" {...S} strokeWidth="1.8" />
  switch (m) {
    case 'happy': case 'love': case 'shy': case 'kiss': case 'party': case 'cheeky': case 'star': return blush
    case 'cry': return <>{tear(41)}{tear(79)}<path d="M41 68 L41 100 M79 68 L79 100" stroke="#6ec1ff" strokeWidth="3" strokeLinecap="round" opacity=".55" /></>
    case 'sad': return <>{tear(79)}</>
    case 'laugh': return <>{blush}{tear(33)}{tear(87)}</>
    case 'angry': return <path d="M30 24 L24 14 M60 12 L60 0 M90 24 L96 14" stroke="#ff5a5a" strokeWidth="4" strokeLinecap="round" fill="none" />
    case 'shout': return <path d="M22 30 L10 24 M98 30 L110 24 M20 50 L8 52 M100 50 L112 52" stroke={INK} strokeWidth="3.4" strokeLinecap="round" fill="none" />
    case 'surprised': return <><path d="M100 22 L100 38 M100 44 L100 46" stroke="#ff5a5a" strokeWidth="5" strokeLinecap="round" />{sweat}</>
    case 'sleepy': return <text x="92" y="30" fontFamily="'Comic Neue', 'Bangers', cursive" fontWeight="800" fontSize="22" fill="#6b4fbb" stroke="#fff" strokeWidth="3" paintOrder="stroke">Z<tspan fontSize="14" dx="2" dy="-12">z</tspan></text>
    case 'tired': return sweat
    case 'think': return (
      <g>
        <circle cx="88" cy="34" r="3" fill="#fff" {...S} strokeWidth="2" /><circle cx="96" cy="24" r="4.5" fill="#fff" {...S} strokeWidth="2" />
        <ellipse cx="108" cy="8" rx="13" ry="10" fill="#fff" {...S} strokeWidth="2.4" /><path d="M102 8 h12 M108 3 v10" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
      </g>
    )
    default: return null
  }
}

function accessory(a: Acc): ReactNode {
  switch (a) {
    case 'bow': return (
      <g {...S} strokeWidth="2.6" fill="#ff7fa8">
        <path d="M84 20 L70 12 L70 28Z" /><path d="M84 20 L98 12 L98 28Z" /><circle cx="84" cy="20" r="4.5" fill="#ff5c8d" />
      </g>
    )
    case 'flower': return (
      <g {...S} strokeWidth="2.2">
        {[0, 72, 144, 216, 288].map((r) => <ellipse key={r} cx="84" cy="12" rx="5.4" ry="8" fill="#ffb3c7" transform={`rotate(${r} 84 20)`} />)}
        <circle cx="84" cy="20" r="4.6" fill="#ffd23f" />
      </g>
    )
    case 'crown': return <path d="M42 24 L45 6 L53 17 L60 2 L67 17 L75 6 L78 24Z" fill="#ffd23f" {...S} strokeWidth="3" />
    case 'hat': return (
      <g {...S} strokeWidth="3">
        <path d="M44 22 L60 -10 L76 22Z" fill="#8f5bd0" /><circle cx="60" cy="-11" r="4.5" fill="#ffd23f" />
        <path d="M51 10 L69 10 M47 17 L73 17" stroke="#ffd23f" strokeWidth="3" />
      </g>
    )
    case 'scarf': return (
      <g {...S} strokeWidth="3" fill="#ff7a8a">
        <path d="M24 100 Q60 114 96 100 L97 112 Q60 126 23 112Z" />
        <path d="M80 112 L86 138 L74 136 L72 118Z" />
      </g>
    )
    case 'note': return (
      <g fill={INK}><path d="M96 38 L96 14 L110 10 L110 34" fill="none" {...S} strokeWidth="3.2" /><ellipse cx="92" cy="40" rx="6" ry="4.6" /><ellipse cx="106" cy="36" rx="6" ry="4.6" /></g>
    )
    case 'hearts': return <g>{heart(98, 20, 8, '#ff4d6d', true)}{heart(110, 42, 5, '#ff8fb0', true)}{heart(12, 30, 6, '#ff8fb0', true)}</g>
    case 'sparkle': return <g>{spark(100, 22, 9)}{spark(14, 40, 7)}{spark(106, 60, 5)}</g>
  }
}

function arms(kind: Arms): ReactNode {
  const p = { fill: 'none', ...S, strokeWidth: 4.6 } as const
  switch (kind) {
    case 'up': return <><path d="M20 78 Q5 62 11 42" {...p} /><path d="M100 78 Q115 62 109 42" {...p} /></>
    case 'wave': return (
      <><path d="M19 86 Q6 100 16 114" {...p} /><path d="M101 78 Q116 66 110 46" {...p} /><path d="M117 42 L121 36 M113 38 L115 31" {...p} strokeWidth={3} /></>
    )
    default: return <><path d="M19 86 Q6 100 16 114" {...p} /><path d="M101 86 Q114 100 104 114" {...p} /></>
  }
}

interface Def { id: string; label: string; mood: Mood; fill: string; arms: Arms; acc?: Acc[] }

function bean(d: Def): SvgSticker {
  const hatOnTop = d.acc?.includes('hat')
  return {
    label: d.label, ratio: 120 / 164,
    art: (
      <svg viewBox="0 -14 120 164" width="100%" height="100%" aria-label={d.label}>
        {arms(d.arms)}
        <path d="M47 128 L47 141 M73 128 L73 141" fill="none" {...S} strokeWidth="4.6" />
        <ellipse cx="42" cy="144" rx="7.5" ry="4" fill={INK} /><ellipse cx="78" cy="144" rx="7.5" ry="4" fill={INK} />
        <path d="M60 12 C32 12 19 46 19 84 C19 114 36 129 60 129 C84 129 101 114 101 84 C101 46 88 12 60 12Z" fill={d.fill} {...S} strokeWidth="4.8" />
        <path d="M30 40 Q34 26 46 20" fill="none" stroke="#fff" strokeOpacity={d.fill === '#FFFFFF' ? 0 : 0.55} strokeWidth="4" strokeLinecap="round" />
        {extras(d.mood)}
        {eyes(d.mood)}
        {mouth(d.mood)}
        {d.acc?.map((a) => <g key={a}>{accessory(a)}</g>)}
        {hatOnTop && null}
      </svg>
    ),
  }
}

const W = '#FFFFFF', PK = '#FFE0EA', MT = '#DDF4E8', BT = '#FFF1BF', LV = '#E7E0FF', SK = '#D8EBFF', PE = '#FFE2CF'

const DEFS: Def[] = [
  // feelings
  { id: 'happy', label: 'Happy bean', mood: 'happy', fill: W, arms: 'down', acc: ['bow'] },
  { id: 'cry', label: 'Crying bean', mood: 'cry', fill: SK, arms: 'up' },
  { id: 'shout', label: 'Shouting bean', mood: 'shout', fill: W, arms: 'up' },
  { id: 'love', label: 'Bean in love', mood: 'love', fill: PK, arms: 'down', acc: ['hearts'] },
  { id: 'sleepy', label: 'Sleepy bean', mood: 'sleepy', fill: LV, arms: 'down' },
  { id: 'shy', label: 'Shy bean', mood: 'shy', fill: PK, arms: 'wave' },
  { id: 'angry', label: 'Grumpy bean', mood: 'angry', fill: PE, arms: 'up' },
  { id: 'surprised', label: 'Surprised bean', mood: 'surprised', fill: BT, arms: 'down' },
  { id: 'laugh', label: 'Laughing bean', mood: 'laugh', fill: MT, arms: 'up' },
  { id: 'sad', label: 'Sad bean', mood: 'sad', fill: SK, arms: 'down' },
  // fun
  { id: 'cool', label: 'Cool bean', mood: 'cool', fill: W, arms: 'wave' },
  { id: 'think', label: 'Thinking bean', mood: 'think', fill: BT, arms: 'down' },
  { id: 'kiss', label: 'Kiss bean', mood: 'kiss', fill: PK, arms: 'down', acc: ['hearts'] },
  { id: 'party', label: 'Party bean', mood: 'party', fill: LV, arms: 'up', acc: ['hat'] },
  { id: 'star', label: 'Star-struck bean', mood: 'star', fill: BT, arms: 'up', acc: ['sparkle'] },
  { id: 'cheeky', label: 'Cheeky bean', mood: 'cheeky', fill: MT, arms: 'wave' },
  { id: 'tired', label: 'Tired bean', mood: 'tired', fill: LV, arms: 'down' },
  { id: 'wink-peach', label: 'Peach bean', mood: 'cheeky', fill: PE, arms: 'down' },
  // dress-up
  { id: 'crown', label: 'Birthday bean', mood: 'happy', fill: W, arms: 'up', acc: ['crown'] },
  { id: 'flower', label: 'Flower bean', mood: 'shy', fill: PK, arms: 'down', acc: ['flower'] },
  { id: 'music', label: 'Music bean', mood: 'happy', fill: MT, arms: 'wave', acc: ['note'] },
  { id: 'scarf', label: 'Cosy bean', mood: 'shy', fill: SK, arms: 'down', acc: ['scarf'] },
  { id: 'sparkle', label: 'Sparkle bean', mood: 'star', fill: W, arms: 'wave', acc: ['sparkle', 'bow'] },
  { id: 'bow-peach', label: 'Bow bean', mood: 'happy', fill: PE, arms: 'wave', acc: ['bow'] },
]

export const BEAN_SVGS: Record<string, SvgSticker> = Object.fromEntries(DEFS.map((d) => [`bn-${d.id}`, bean(d)]))
export const BEAN_FEELINGS = ['happy', 'cry', 'shout', 'love', 'sleepy', 'shy', 'angry', 'surprised', 'laugh', 'sad'].map((i) => `bn-${i}`)
export const BEAN_FUN = ['cool', 'think', 'kiss', 'party', 'star', 'cheeky', 'tired', 'wink-peach'].map((i) => `bn-${i}`)
export const BEAN_DRESSUP = ['crown', 'flower', 'music', 'scarf', 'sparkle', 'bow-peach'].map((i) => `bn-${i}`)
