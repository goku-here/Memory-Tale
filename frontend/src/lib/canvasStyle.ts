import type { CSSProperties } from 'react'
import type { CanvasStyle, CategoryId, PatternId } from '../types'
import { alpha, luminance, shade } from './color'
import type { Theme } from '../components/ThemeEngine'

export const PATTERNS: { id: PatternId; name: string; texture?: boolean }[] = [
  { id: 'dots', name: 'Dots' },
  { id: 'grid', name: 'Grid' },
  { id: 'graph', name: 'Graph paper' },
  { id: 'cross', name: 'Blueprint' },
  { id: 'lines', name: 'Ruled' },
  { id: 'plain', name: 'Plain' },
  { id: 'paper', name: 'Paper', texture: true },
  { id: 'crumple', name: 'Crumpled', texture: true },
  { id: 'clouds', name: 'Clouds', texture: true },
]
export const isTexture = (p: PatternId) => !!PATTERNS.find((x) => x.id === p)?.texture

export interface Swatch { value: string; name: string; why: string }
const W: Swatch = { value: '#FFFFFF', name: 'White', why: 'Clean and calm: lets your photos do the talking.' }

/**
 * Background colours for each kind of memory, chosen for the mood people want to remember it in.
 * The first entry is always the theme's own colour (filled in by `swatchesFor`).
 */
const EXTRA: Record<CategoryId, { first: Omit<Swatch, 'value'>; list: Swatch[] }> = {
  romantic: {
    first: { name: 'Blush', why: 'Soft pink feels tender and affectionate.' },
    list: [
      { value: '#F6D5DD', name: 'Rose', why: 'Deeper pink deepens the romance.' },
      { value: '#FCE5DA', name: 'Peach', why: 'Warm peach feels like a glow.' },
      { value: '#EDE4F6', name: 'Lavender', why: 'Lavender is dreamy and calming.' },
      { value: '#FBF6EC', name: 'Ivory', why: 'Ivory feels timeless and gentle.' },
      { value: '#5A2335', name: 'Wine', why: 'Deep wine feels intimate and moody.' },
    ],
  },
  trip: {
    first: { name: 'Sky', why: 'Open sky blue feels free and adventurous.' },
    list: [
      { value: '#DDF3EE', name: 'Sea foam', why: 'Sea green is calm and refreshing.' },
      { value: '#F6EBD5', name: 'Sand', why: 'Sand feels relaxed and sun-warmed.' },
      { value: '#FDE3CF', name: 'Sunset', why: 'Sunset orange is energy and excitement.' },
      { value: '#E9EDF1', name: 'Mist', why: 'Grey-blue gives a focused travel-journal feel.' },
      { value: '#2A6FB0', name: 'Ocean', why: 'Deep blue says trust, depth and distance.' },
    ],
  },
  dinner: {
    first: { name: 'Cream', why: 'Cream is warm and inviting, like a set table.' },
    list: [
      { value: '#F3DCCF', name: 'Terracotta', why: 'Warm earthy reds stir the appetite.' },
      { value: '#F1D9DE', name: 'Wine blush', why: 'A hint of wine feels elegant and indulgent.' },
      { value: '#F5E8C8', name: 'Gold', why: 'Gold says celebration and a special night.' },
      { value: '#E6E9D5', name: 'Olive', why: 'Soft olive feels fresh, from the garden.' },
      { value: '#2E2A28', name: 'Candlelight', why: 'Dark charcoal feels like an evening by candlelight.' },
    ],
  },
  friends: {
    first: { name: 'Mint', why: 'Mint is fresh, friendly and relaxed.' },
    list: [
      { value: '#FFF3C4', name: 'Sunshine', why: 'Yellow is joy, laughter and good energy.' },
      { value: '#FFE0DC', name: 'Coral', why: 'Coral is playful and full of life.' },
      { value: '#DDEEFB', name: 'Sky', why: 'Light blue is easy, open and sociable.' },
      { value: '#EEE5FA', name: 'Lilac', why: 'Lilac is fun and creative.' },
      { value: '#2F7D4F', name: 'Chalkboard', why: 'Chalkboard green is focus, nostalgia and school days.' },
    ],
  },
  family: {
    first: { name: 'Linen', why: 'Linen feels cosy and familiar.' },
    list: [
      { value: '#E3EFDD', name: 'Soft green', why: 'Green is growth and togetherness.' },
      { value: '#FBEFC8', name: 'Butter', why: 'Butter yellow is warm, happy mornings.' },
      { value: '#F3DDD3', name: 'Clay', why: 'Clay tones say home and comfort.' },
      { value: '#E1EEF6', name: 'Sky', why: 'Pale blue is calm and trust.' },
      { value: '#4A3B2A', name: 'Walnut', why: 'Dark walnut feels like heritage and old photo albums.' },
    ],
  },
  birthday: {
    first: { name: 'Lilac', why: 'Lilac is joyful and playful.' },
    list: [
      { value: '#FFDDEB', name: 'Bubblegum', why: 'Pink is sweet, festive and fun.' },
      { value: '#FFF4C2', name: 'Lemon', why: 'Lemon yellow is pure happiness.' },
      { value: '#D9F3F5', name: 'Aqua', why: 'Aqua is fresh and cheerful.' },
      { value: '#FFE6D5', name: 'Peach', why: 'Peach is a warm party glow.' },
      { value: '#2C2350', name: 'Midnight', why: 'Midnight blue is a party at night.' },
    ],
  },
  anniversary: {
    first: { name: 'Champagne', why: 'Champagne says celebration and elegance.' },
    list: [
      { value: '#F8E4E4', name: 'Blush', why: 'Blush is romance, quietly.' },
      { value: '#F3E3B0', name: 'Gold', why: 'Gold marks milestones and things of value.' },
      { value: '#E4EBDD', name: 'Sage', why: 'Sage feels calm, steady commitment.' },
      { value: '#E4E8EE', name: 'Slate', why: 'Slate is quiet confidence.' },
      { value: '#5B1A2B', name: 'Burgundy', why: 'Deep red is passion and depth.' },
    ],
  },
}

export function swatchesFor(theme: Theme): Swatch[] {
  const e = EXTRA[theme.id] ?? EXTRA.romantic
  return [{ value: theme.canvasBg, ...e.first }, ...e.list, W]
}

export const isDark = (hex: string) => luminance(hex) < 0.3

/** the (up to) six colours offered for dots, lines and grids */
export function inkChoices(theme: Theme): { value: string | undefined; name: string }[] {
  return [
    { value: undefined, name: 'Auto' },
    { value: '#FFFFFF', name: 'White' },
    { value: '#3A3A46', name: 'Charcoal' },
    ...theme.palette.slice(0, 3).map((v, i) => ({ value: v, name: ['Main', 'Accent', 'Soft'][i] })),
  ]
}

const svg = (body: string, w: number, h: number) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>${body}</svg>`)}")`

const PAPER = svg(
  "<filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .35  0 0 0 0 .32  0 0 0 0 .28  0 0 0 .8 -.2'/></filter><rect width='100%' height='100%' filter='url(#n)'/>",
  240, 240,
)
const CRUMPLE = svg(
  "<filter id='c' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.011' numOctaves='4' seed='7' stitchTiles='stitch' result='n'/><feDiffuseLighting in='n' lighting-color='#fff' surfaceScale='4' diffuseConstant='1.1'><feDistantLight azimuth='225' elevation='56'/></feDiffuseLighting></filter><rect width='100%' height='100%' filter='url(#c)'/>",
  480, 480,
)
const CLOUDS = svg(
  "<filter id='k' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.007 .011' numOctaves='5' seed='11' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  3.4 0 0 0 -1.45'/></filter><rect width='100%' height='100%' filter='url(#k)'/>",
  640, 640,
)

export interface ResolvedCanvas {
  bg: string
  pattern: PatternId
  ink: string
  dark: boolean
  /** background layers for the canvas surface (the page colour is `bg`) */
  css: CSSProperties
  /** how far the pattern repeats vertically (so exports can line it up with the canvas) */
  period: number
}

export function resolveCanvas(theme: Theme, cs?: CanvasStyle): ResolvedCanvas {
  const pattern = cs?.pattern ?? 'dots'
  const bg = cs?.bg ?? theme.canvasBg
  const dark = isDark(bg)
  // untouched colours keep the theme's own dot colour; otherwise pick something readable on the new background
  const auto = cs?.bg ? (dark ? shade(bg, -0.5) : shade(bg, 0.14)) : theme.dot
  const ink = cs?.ink ?? auto
  const a = (n: number) => alpha(ink, n)
  let css: CSSProperties = {}
  let period = 22
  switch (pattern) {
    case 'dots':
      css = { backgroundImage: `radial-gradient(${ink} 1.5px, transparent 1.7px)`, backgroundSize: '22px 22px' }
      break
    case 'grid':
      period = 24
      css = { backgroundImage: `linear-gradient(${a(0.7)} 1px, transparent 1px), linear-gradient(90deg, ${a(0.7)} 1px, transparent 1px)`, backgroundSize: '24px 24px' }
      break
    case 'graph':
      period = 72
      css = {
        backgroundImage: `linear-gradient(${a(0.85)} 1.2px, transparent 1.2px), linear-gradient(90deg, ${a(0.85)} 1.2px, transparent 1.2px), linear-gradient(${a(0.4)} 1px, transparent 1px), linear-gradient(90deg, ${a(0.4)} 1px, transparent 1px)`,
        backgroundSize: '72px 72px, 72px 72px, 12px 12px, 12px 12px',
      }
      break
    case 'cross':
      period = 40
      css = {
        backgroundImage: `${svg(`<path d='M20 16v8M16 20h8' stroke='${ink}' stroke-width='1.3' fill='none' stroke-linecap='round'/>`, 40, 40)}, linear-gradient(${a(0.3)} 1px, transparent 1px), linear-gradient(90deg, ${a(0.3)} 1px, transparent 1px)`,
        backgroundSize: '40px 40px, 8px 8px, 8px 8px',
        backgroundPosition: '0 0, 0 0, 0 0',
      }
      break
    case 'lines':
      period = 30
      css = { backgroundImage: `linear-gradient(transparent 29px, ${a(0.7)} 29px, ${a(0.7)} 30px)`, backgroundSize: '100% 30px' }
      break
    case 'paper':
      period = 240
      css = { backgroundImage: PAPER, backgroundSize: '240px 240px' }
      break
    case 'crumple':
      period = 480
      css = { backgroundImage: CRUMPLE, backgroundSize: '480px 480px', backgroundBlendMode: 'multiply' }
      break
    case 'clouds':
      period = 640
      css = { backgroundImage: CLOUDS, backgroundSize: '640px 640px' }
      break
    default:
      css = {}
  }
  css.backgroundColor = bg
  return { bg, pattern, ink, dark, css, period }
}

/** the same background, shifted up by `offset` px (used when only part of the canvas is drawn, as in exports) */
export function shiftedCss(r: ResolvedCanvas, offset: number): CSSProperties {
  return { ...r.css, backgroundPosition: `0 ${-(offset % r.period)}px` }
}
