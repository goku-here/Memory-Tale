import { COLLAGES, type CollageKind } from './collages'

/**
 * Page templates. A template is not one locked picture: it puts a handful of ordinary items on the page (a paper,
 * photo frames, stickers, text), so every piece can afterwards be moved, edited, replaced or deleted, and more can
 * be added. Positions are in units of the template's width, from the middle of its box.
 */

export type TemplatePiece =
  | { type: 'collage'; kind: CollageKind; dx: number; dy: number; w: number; rot?: number }
  | { type: 'sticker'; id: string; dx: number; dy: number; w: number; rot?: number }
  | { type: 'text'; text: string; dx: number; dy: number; w: number; size: number; color: string; align: 'left' | 'center' | 'right'; rot?: number; font: 'display' | 'body' }

export interface TemplateDef {
  id: string
  label: string
  /** height / width of the whole design */
  aspect: number
  /** what the design is built from, back to front */
  pieces: TemplatePiece[]
  photos: number
}

const T = (id: string, label: string, aspect: number, pieces: TemplatePiece[]): TemplateDef => ({
  id, label, aspect, pieces, photos: pieces.reduce((n, p) => n + (p.type === 'collage' ? COLLAGES[p.kind].slots.length : 0), 0),
})

export const TEMPLATES: TemplateDef[] = [
  T('love-letter', 'Love letter', 1.32, [
    { type: 'collage', kind: 'paperLetter', dx: 0, dy: 0, w: 1 },
    { type: 'collage', kind: 'stamp', dx: 0.17, dy: -0.27, w: 0.5, rot: 5 },
    { type: 'collage', kind: 'stamp', dx: -0.14, dy: 0.19, w: 0.46, rot: -6 },
    { type: 'collage', kind: 'cameraDeco', dx: 0.07, dy: 0.0, w: 0.27, rot: -4 },
    { type: 'sticker', id: 'pin', dx: 0.17, dy: -0.52, w: 0.11, rot: 6 },
    { type: 'sticker', id: 'bow', dx: 0.35, dy: -0.04, w: 0.2, rot: -10 },
    { type: 'sticker', id: 'heart', dx: 0.34, dy: 0.5, w: 0.12, rot: -8 },
    { type: 'sticker', id: 'tape-pink', dx: -0.1, dy: 0.5, w: 0.3, rot: -4 },
    { type: 'text', text: 'Love!\nLove!\nLove!', dx: -0.27, dy: -0.37, w: 0.3, size: 26, color: '#ffffff', align: 'center', rot: -4, font: 'display' },
    { type: 'text', text: 'Can I say I love you today? If not, can I ask you again tomorrow?', dx: 0.2, dy: 0.3, w: 0.38, size: 11.5, color: '#f6e9e6', align: 'left', font: 'body' },
  ]),
  T('photo-board', 'Photo board', 1.12, [
    { type: 'collage', kind: 'corkBoard', dx: 0, dy: 0, w: 1 },
    { type: 'collage', kind: 'polaroid', dx: -0.24, dy: -0.22, w: 0.42, rot: -4 },
    { type: 'collage', kind: 'polaroid', dx: 0.23, dy: -0.24, w: 0.42, rot: 3.5 },
    { type: 'collage', kind: 'polaroid', dx: -0.22, dy: 0.26, w: 0.42, rot: 3 },
    { type: 'collage', kind: 'polaroid', dx: 0.24, dy: 0.25, w: 0.42, rot: -3.5 },
    { type: 'sticker', id: 'tape-yellow', dx: -0.24, dy: -0.4, w: 0.22, rot: -8 },
    { type: 'sticker', id: 'tape-pink', dx: 0.23, dy: -0.42, w: 0.22, rot: 6 },
    { type: 'text', text: 'our little moments', dx: 0, dy: 0.02, w: 0.6, size: 18, color: '#4a3622', align: 'center', rot: -2, font: 'display' },
  ]),
  T('ticket-stubs', 'Ticket stubs', 1.1, [
    { type: 'collage', kind: 'creamSheet', dx: 0, dy: 0, w: 1 },
    { type: 'collage', kind: 'ticketPink', dx: -0.02, dy: -0.24, w: 0.86, rot: -4 },
    { type: 'collage', kind: 'ticketTeal', dx: 0.03, dy: 0.24, w: 0.86, rot: 3 },
    { type: 'sticker', id: 'tape-yellow', dx: 0, dy: -0.5, w: 0.26, rot: -3 },
    { type: 'sticker', id: 'star', dx: 0.38, dy: 0.42, w: 0.14, rot: 12 },
    { type: 'text', text: 'admit one', dx: 0, dy: 0.0, w: 0.5, size: 17, color: '#5a4a35', align: 'center', rot: 2, font: 'display' },
  ]),
  T('camera-day', 'A day to remember', 1.1, [
    { type: 'collage', kind: 'creamSheet', dx: 0, dy: 0, w: 1 },
    { type: 'collage', kind: 'camera3', dx: -0.2, dy: 0, w: 0.4 },
    { type: 'text', text: 'a day to remember', dx: 0.24, dy: -0.26, w: 0.44, size: 21, color: '#3e3a35', align: 'left', rot: -2, font: 'display' },
    { type: 'text', text: 'Write the story of this day here: where you were, who made you laugh, what you want to remember.', dx: 0.24, dy: 0.04, w: 0.42, size: 11, color: '#6d665c', align: 'left', font: 'body' },
    { type: 'sticker', id: 'tape-blue', dx: 0.26, dy: 0.34, w: 0.26, rot: -5 },
  ]),
  T('film-reel', 'Film night', 1.1, [
    { type: 'collage', kind: 'creamSheet', dx: 0, dy: 0, w: 1 },
    { type: 'collage', kind: 'film4', dx: 0, dy: -0.2, w: 0.94, rot: -2 },
    { type: 'collage', kind: 'film4', dx: 0, dy: 0.1, w: 0.94, rot: 1.5 },
    { type: 'text', text: 'scenes from us', dx: 0, dy: 0.38, w: 0.7, size: 20, color: '#3e3a35', align: 'center', font: 'display' },
  ]),
]

/**
 * The creamSheet piece is 100 wide and 110 tall, so templates built on it take that height unless they say otherwise
 * (the film template trims it to its own height by scaling the sheet).
 */
