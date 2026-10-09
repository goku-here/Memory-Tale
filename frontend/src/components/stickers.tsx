import type { ReactNode } from 'react'
import type { StickerProps } from '../types'
import { PushPinArt } from './PushPin'
import { AssetImg } from '../lib/assets'
import { PACK_SVGS } from './stickerPacks'

export type StickerCategory =
  | 'Love' | 'Comic' | 'Doodles' | 'Paper' | 'Words' | 'Travel' | 'Food' | 'Party' | 'Mood' | 'Nature' | 'Animals' | 'Decor'
export const STICKER_CATEGORIES: StickerCategory[] = [
  'Love', 'Comic', 'Doodles', 'Paper', 'Words', 'Travel', 'Food', 'Party', 'Mood', 'Nature', 'Animals', 'Decor',
]

/** Hand-drawn style SVG stickers. `ratio` is width / height. */
export const SVG_STICKERS: Record<string, { label: string; ratio: number; art: ReactNode }> = {
  pin: { label: 'Red pin', ratio: 0.75, art: <PushPinArt color="#E5342F" /> },
  'pin-blue': { label: 'Blue pin', ratio: 0.75, art: <PushPinArt color="#2F7BE5" /> },
  'pin-yellow': { label: 'Yellow pin', ratio: 0.75, art: <PushPinArt color="#F5B921" /> },
  'tape-yellow': {
    label: 'Yellow tape', ratio: 2.6,
    art: (
      <svg viewBox="0 0 130 50" width="100%" height="100%">
        <path d="M4 6 L10 10 L4 15 L10 20 L4 25 L10 30 L4 35 L10 40 L4 45 L126 45 L120 40 L126 35 L120 30 L126 25 L120 20 L126 15 L120 10 L126 5 Z" fill="#F7DE7A" />
        <path d="M14 14h100M14 26h100M14 38h100" stroke="#fff" strokeOpacity=".4" strokeWidth="2" />
      </svg>
    ),
  },
  'tape-pink': {
    label: 'Pink tape', ratio: 2.6,
    art: (
      <svg viewBox="0 0 130 50" width="100%" height="100%">
        <path d="M4 6 L10 10 L4 15 L10 20 L4 25 L10 30 L4 35 L10 40 L4 45 L126 45 L120 40 L126 35 L120 30 L126 25 L120 20 L126 15 L120 10 L126 5 Z" fill="#F5B5C8" />
        <g fill="#fff" fillOpacity=".55"><circle cx="30" cy="25" r="4" /><circle cx="52" cy="25" r="4" /><circle cx="74" cy="25" r="4" /><circle cx="96" cy="25" r="4" /></g>
      </svg>
    ),
  },
  'tape-blue': {
    label: 'Blue tape', ratio: 2.6,
    art: (
      <svg viewBox="0 0 130 50" width="100%" height="100%">
        <path d="M4 6 L10 10 L4 15 L10 20 L4 25 L10 30 L4 35 L10 40 L4 45 L126 45 L120 40 L126 35 L120 30 L126 25 L120 20 L126 15 L120 10 L126 5 Z" fill="#A9CBEA" />
        <path d="M16 8l12 34M40 8l12 34M64 8l12 34M88 8l12 34" stroke="#fff" strokeOpacity=".45" strokeWidth="5" />
      </svg>
    ),
  },
  bow: {
    label: 'Bow', ratio: 1.3,
    art: (
      <svg viewBox="0 0 120 92" width="100%" height="100%">
        <path d="M60 44 C40 10 6 8 8 40 C10 70 40 66 60 48Z" fill="#F29BB5" />
        <path d="M60 44 C80 10 114 8 112 40 C110 70 80 66 60 48Z" fill="#F29BB5" />
        <path d="M58 50 L38 86 L52 80 L60 90 L62 54Z" fill="#E67C9D" />
        <path d="M62 50 L82 86 L68 80 L60 90 L58 54Z" fill="#E67C9D" />
        <circle cx="60" cy="46" r="11" fill="#E0668C" />
        <path d="M22 30c8-6 18-4 26 4M98 30c-8-6-18-4-26 4" stroke="#fff" strokeOpacity=".6" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  'star-doodle': {
    label: 'Star', ratio: 1,
    art: (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <path d="M50 8 L61 36 L92 38 L68 58 L76 90 L50 72 L24 90 L32 58 L8 38 L39 36Z" fill="#FFD84D" stroke="#F2B705" strokeWidth="5" strokeLinejoin="round" />
      </svg>
    ),
  },
  'heart-doodle': {
    label: 'Heart', ratio: 1.08,
    art: (
      <svg viewBox="0 0 100 92" width="100%" height="100%">
        <path d="M50 88 C10 56 2 36 14 20 C28 4 46 14 50 28 C54 14 72 4 86 20 C98 36 90 56 50 88Z" fill="#FF6F91" stroke="#E5486F" strokeWidth="5" strokeLinejoin="round" />
        <path d="M22 28c4-6 12-8 18-2" stroke="#fff" strokeOpacity=".7" strokeWidth="5" strokeLinecap="round" fill="none" />
      </svg>
    ),
  },
  sparkle: {
    label: 'Sparkle', ratio: 1,
    art: (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        <path d="M50 4 C54 34 66 46 96 50 C66 54 54 66 50 96 C46 66 34 54 4 50 C34 46 46 34 50 4Z" fill="#FFE27A" stroke="#F4B63A" strokeWidth="4" strokeLinejoin="round" />
      </svg>
    ),
  },
  arrow: {
    label: 'Arrow', ratio: 1.7,
    art: (
      <svg viewBox="0 0 120 70" width="100%" height="100%">
        <path d="M8 50 C30 6 70 6 100 34" stroke="#3B3B4F" strokeWidth="6" fill="none" strokeLinecap="round" strokeDasharray="1 11" />
        <path d="M84 14 L106 36 L78 42" stroke="#3B3B4F" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  flower: {
    label: 'Flower', ratio: 1,
    art: (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {[0, 72, 144, 216, 288].map((r) => (
          <ellipse key={r} cx="50" cy="26" rx="15" ry="22" fill="#F8B7D0" transform={`rotate(${r} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="13" fill="#FFD84D" />
      </svg>
    ),
  },
  'speech-love': {
    label: 'Love bubble', ratio: 1.5,
    art: (
      <svg viewBox="0 0 120 80" width="100%" height="100%">
        <path d="M14 8h92a8 8 0 0 1 8 8v36a8 8 0 0 1-8 8H58L38 76V60H14a8 8 0 0 1-8-8V16a8 8 0 0 1 8-8Z" fill="#fff" stroke="#3B3B4F" strokeWidth="4" strokeLinejoin="round" />
        <path d="M60 46 C40 32 46 22 54 26 C58 28 60 32 60 32 C60 32 62 28 66 26 C74 22 80 32 60 46Z" fill="#FF6F91" />
      </svg>
    ),
  },
  ticket: {
    label: 'Ticket', ratio: 1.9,
    art: (
      <svg viewBox="0 0 130 68" width="100%" height="100%">
        <path d="M6 8h118v18a9 9 0 0 0 0 18v16H6V44a9 9 0 0 0 0-18Z" fill="#F7C873" stroke="#C9923A" strokeWidth="3" />
        <path d="M92 8v52" stroke="#C9923A" strokeWidth="3" strokeDasharray="4 5" />
        <text x="22" y="40" fontFamily="Bebas Neue, sans-serif" fontSize="22" fill="#6B4515" letterSpacing="2">ADMIT ONE</text>
        <text x="100" y="40" fontFamily="Bebas Neue, sans-serif" fontSize="16" fill="#6B4515">№7</text>
      </svg>
    ),
  },
  sun: {
    label: 'Sun', ratio: 1,
    art: (
      <svg viewBox="0 0 100 100" width="100%" height="100%">
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x="47" y="4" width="6" height="16" rx="3" fill="#FFB020" transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <circle cx="50" cy="50" r="24" fill="#FFD84D" stroke="#FFB020" strokeWidth="4" />
        <circle cx="42" cy="46" r="3" fill="#7A4A00" /><circle cx="58" cy="46" r="3" fill="#7A4A00" />
        <path d="M42 58q8 7 16 0" stroke="#7A4A00" strokeWidth="3" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
}

Object.assign(SVG_STICKERS, PACK_SVGS)

export interface StickerDef extends StickerProps { label?: string }

const emojis = (s: string): StickerDef[] => [...new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(s)]
  .map((x) => x.segment).filter((c) => c.trim()).map((c) => ({ kind: 'emoji' as const, value: c }))
const svgs = (...ids: string[]): StickerDef[] => ids.map((id) => ({ kind: 'svg' as const, value: id, label: SVG_STICKERS[id].label }))

export const STICKERS: Record<StickerCategory, StickerDef[]> = {
  Love: emojis('❤️💖💘💌💍🌹😍🥰💋💏🫶💞💕💝🧸'),
  Comic: [
    ...svgs('c-bump', 'c-peek', 'c-boom', 'c-pow', 'c-wow', 'c-gasp', 'c-sigh', 'c-mwah', 'c-gulp', 'c-zzz', 'c-shock', 'c-what'),
    ...emojis('💢💦💥💫😳😱🥵😤'),
  ],
  Doodles: svgs('d-loop', 'd-rings', 'd-hearts', 'd-wave', 'd-bolt', 'd-crown', 'd-spiral', 'd-check', 'd-cross', 'd-circle', 'd-star', 'arrow', 'star-doodle', 'sparkle'),
  Paper: svgs('tape-green-torn', 'tape-black', 'tape-yellow', 'tape-pink', 'tape-blue', 'p-kraft', 'p-pink', 'p-blue', 'p-lined', 'p-green', 'p-tag', 'p-clip', 'p-corners', 'p-postmark', 'ticket'),
  Words: svgs('w-love', 'w-best', 'w-xoxo', 'w-memories', 'w-date', 'w-hello', 'w-forever', 'w-us', 'w-vibes', 'w-cheers', 'w-fav', 'w-mine', 'speech-love'),
  Travel: [...svgs('pin', 'pin-blue', 'sun'), ...emojis('✈️🗺️🧳📸🏖️🌴⛰️🚗🚂🏝️🧭🎒⛵🗽🌅')],
  Food: emojis('🍕🍔🍣🍝🍷🥂☕🍰🍩🍦🍓🌮🍿🥐🍜🧋'),
  Party: emojis('🎉🎈🎂🎁🪩🥳🎊🍾🎶🎤✨🕺🎆🪅🎀'),
  Mood: emojis('😍🥰😂🥹😎🤗😴🤔🥳😭😘🙈😌🫠🤭😇'),
  Nature: emojis('🌿🌸🌻🍃🌙☀️⭐🌈🌲🍂🌊🔥❄️🌷🍄'),
  Animals: emojis('🐶🐱🐻🐼🦊🐰🐥🦄🐢🐬🦋🐝🐧🦉🐙'),
  Decor: [...svgs('pin-yellow', 'bow', 'heart-doodle', 'flower'), ...emojis('🌼🍀🕯️🪴🎞️📷🎧💌')],
}

export function stickerRatio(p: StickerProps) {
  return p.kind === 'svg' ? SVG_STICKERS[p.value]?.ratio ?? 1 : p.kind === 'image' ? p.ratio ?? 1 : 1
}

/** White die-cut outline + soft shadow, built from stacked drop-shadows. */
export function dieCut(width: number) {
  const t = Math.max(2, Math.min(5, width * 0.032))
  const d = t * 0.72
  const dirs: [number, number][] = [[t, 0], [-t, 0], [0, t], [0, -t], [d, d], [-d, -d]]
  return dirs.map(([x, y]) => `drop-shadow(${x}px ${y}px 0 #fff)`).join(' ') + ' drop-shadow(0 3px 5px rgba(30,25,40,.3))'
}

export function StickerArt({ sticker, width, preview }: { sticker: StickerProps; width: number; preview?: boolean }) {
  return (
    <div className="h-full w-full" style={{ containerType: 'inline-size', filter: preview ? 'drop-shadow(0 1px 2px rgba(30,25,40,.3))' : dieCut(width) }}>
      {sticker.kind === 'emoji' && (
        <div className="grid h-full w-full place-items-center leading-none" style={{ fontSize: '74cqw' }}>{sticker.value}</div>
      )}
      {sticker.kind === 'svg' && SVG_STICKERS[sticker.value]?.art}
      {sticker.kind === 'image' && (
        <AssetImg src={sticker.value} fit="contain" />
      )}
    </div>
  )
}
