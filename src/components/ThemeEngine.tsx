import { motion, useReducedMotion } from 'framer-motion'
import type { CSSProperties } from 'react'
import type { CategoryId } from '../types'

export interface Theme {
  id: CategoryId
  name: string
  emoji: string
  /** CSS font-family for headings / cover titles */
  font: string
  /** theme colours, first = most prominent (used first in colour pickers) */
  palette: string[]
  accent: string
  /** canvas background tint */
  canvasBg: string
  /** dotted grid colour */
  dot: string
  /** default cover colour */
  cover: string
  /** decorative floating shapes */
  shapes: string[]
  blurb: string
}

export const THEMES: Record<CategoryId, Theme> = {
  romantic: {
    id: 'romantic', name: 'Romantic Date', emoji: '💕', font: "'Dancing Script', cursive",
    palette: ['#C94F6D', '#E8879C', '#F7C6D0', '#7A2E45', '#FFFFFF'], accent: '#E8879C',
    canvasBg: '#FBF1F3', dot: '#EBBFC9', cover: '#E8B4BC', shapes: ['💗', '🌹', '✨', '💌'],
    blurb: 'Blush and rose, for tender moments',
  },
  trip: {
    id: 'trip', name: 'Trip', emoji: '✈️', font: "'Permanent Marker', cursive",
    palette: ['#2F8FD0', '#F28C38', '#FFC93C', '#1F4E79', '#FFFFFF'], accent: '#F28C38',
    canvasBg: '#EFF6FB', dot: '#B9D7EC', cover: '#9DB7D5', shapes: ['☁️', '🌅', '🧭', '✈️'],
    blurb: 'Sky blue and sunset orange',
  },
  dinner: {
    id: 'dinner', name: 'Dinner', emoji: '🍷', font: "'Playfair Display', serif",
    palette: ['#7B1E3A', '#C9A24B', '#3B0F1E', '#E8D9B5', '#FFFFFF'], accent: '#C9A24B',
    canvasBg: '#F8F2EC', dot: '#DAC6AC', cover: '#C98F7E', shapes: ['🍷', '🕯️', '🍝', '✨'],
    blurb: 'Burgundy and gold, candle-lit',
  },
  friends: {
    id: 'friends', name: 'Friends Hangout', emoji: '🎉', font: "'Bangers', cursive",
    palette: ['#1FA595', '#FFB627', '#FF6B6B', '#2D3A5A', '#FFFFFF'], accent: '#FFB627',
    canvasBg: '#EEF8F5', dot: '#B5E2DA', cover: '#9CC5C4', shapes: ['🎈', '⭐', '🎶', '🍕'],
    blurb: 'Teal and sunshine, loud and happy',
  },
  family: {
    id: 'family', name: 'Family Function', emoji: '🏡', font: "'Caveat', cursive",
    palette: ['#5F8650', '#D9803F', '#E8B65A', '#4A3B2A', '#FFFFFF'], accent: '#D9803F',
    canvasBg: '#F6F3EA', dot: '#D4CDB3', cover: '#A8C3A6', shapes: ['🌿', '🍂', '🏡', '🌻'],
    blurb: 'Warm greens and earthy oranges',
  },
  birthday: {
    id: 'birthday', name: 'Birthday', emoji: '🎂', font: "'Pacifico', cursive",
    palette: ['#8F5BD0', '#FF7EB6', '#FFC72C', '#3D2A6B', '#FFFFFF'], accent: '#FF7EB6',
    canvasBg: '#F6F0FB', dot: '#D8C6F0', cover: '#BDB1DB', shapes: ['🎈', '🎂', '🎁', '🎊'],
    blurb: 'Lilac, pink and confetti yellow',
  },
  anniversary: {
    id: 'anniversary', name: 'Anniversary', emoji: '🥂', font: "'Special Elite', monospace",
    palette: ['#8E2B3D', '#B8860B', '#4A1B26', '#E9D8A6', '#FFFFFF'], accent: '#B8860B',
    canvasBg: '#FAF5EA', dot: '#E3D5AB', cover: '#EBD9A0', shapes: ['🥂', '💍', '🕊️', '✨'],
    blurb: 'Champagne and deep red, like a love letter',
  },
}

export const CATEGORY_ORDER: CategoryId[] = [
  'romantic', 'trip', 'dinner', 'friends', 'family', 'birthday', 'anniversary',
]

export const getTheme = (id: CategoryId | string | undefined): Theme =>
  THEMES[id as CategoryId] ?? THEMES.romantic

export const COVER_COLORS: { name: string; value: string }[] = [
  { name: 'Dusty blue', value: '#9DB7D5' },
  { name: 'Blush', value: '#E8B4BC' },
  { name: 'Sage', value: '#A8C3A6' },
  { name: 'Butter', value: '#EBD9A0' },
  { name: 'Lavender', value: '#BDB1DB' },
  { name: 'Peach', value: '#F1B99B' },
  { name: 'Clay', value: '#C98F7E' },
  { name: 'Mist teal', value: '#9CC5C4' },
]

/** CSS custom properties for a theme, applied to a screen's root element. */
export function themeVars(theme: Theme): CSSProperties {
  return {
    ['--t-bg' as string]: theme.canvasBg,
    ['--t-dot' as string]: theme.dot,
    ['--t-accent' as string]: theme.accent,
    ['--t-font' as string]: theme.font,
  }
}

/** Decorative shapes drifting slowly in the background of themed screens. */
export function FloatingShapes({ theme, count = 6 }: { theme: Theme; count?: number }) {
  const reduce = useReducedMotion()
  const spots = [
    { l: '8%', t: '14%' }, { l: '84%', t: '22%' }, { l: '16%', t: '58%' },
    { l: '78%', t: '66%' }, { l: '46%', t: '86%' }, { l: '60%', t: '8%' },
  ].slice(0, count)
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {spots.map((s, i) => (
        <motion.span
          key={i}
          className="absolute select-none opacity-[0.16]"
          style={{ left: s.l, top: s.t, fontSize: 28 + (i % 3) * 10 }}
          animate={reduce ? undefined : { y: [0, -14, 0], rotate: [-6, 6, -6] }}
          transition={{ duration: 6 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
        >
          {theme.shapes[i % theme.shapes.length]}
        </motion.span>
      ))}
    </div>
  )
}
