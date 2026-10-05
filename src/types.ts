export type CategoryId =
  | 'romantic'
  | 'trip'
  | 'dinner'
  | 'friends'
  | 'family'
  | 'birthday'
  | 'anniversary'

export interface Member {
  id: string
  name: string
  color: string
}

export interface Cover {
  type: 'color' | 'image'
  /** hex colour, or an image data URL */
  value: string
  /** readable text tone for the title printed on the cover */
  tone?: 'light' | 'dark'
  /** average colour of an image cover (used to tint band / ribbon) */
  avg?: string
}

export interface Memory {
  id: string
  title: string
  category: CategoryId
  themeId: CategoryId
  cover: Cover
  /** ISO date, yyyy-mm-dd */
  date: string
  createdAt: number
  /** position on the home shelf (lower = earlier) */
  order?: number
  members?: Member[]
}

/* ---------------- canvas items ---------------- */

export type FrameId = 'polaroid' | 'rounded' | 'circle' | 'heart' | 'arch' | 'film' | 'stamp' | 'none'

export interface PhotoProps {
  src: string
  /** natural width / height of the photo */
  aspect: number
  frame: FrameId
  /** corner radius in px at a 200px-wide item (scales with the item) */
  radius: number
  caption: string
}
export interface StickerProps {
  kind: 'emoji' | 'svg' | 'image'
  /** emoji character, svg sticker id, or image data URL */
  value: string
}
export interface TextProps {
  text: string
  font: string
  size: number
  color: string
  align: 'left' | 'center' | 'right'
}
export interface NoteProps {
  text: string
  color: string
}
export interface Stroke {
  color: string
  size: number
  points: [number, number][]
}
export interface DrawProps {
  strokes: Stroke[]
  /** the box (px) the stroke points are expressed in */
  w: number
  h: number
}
export interface Place {
  name: string
  lat: number
  lng: number
}
export interface MapProps {
  from: Place
  to: Place
  /** route polyline as [lat, lng] pairs (road route or a curved arc) */
  route?: [number, number][]
}
export interface DividerProps {
  label: string
  color: string
}

export type BubbleShape = 'speech' | 'thought' | 'shout' | 'whisper' | 'box'
export interface BubbleProps {
  text: string
  shape: BubbleShape
  /** which side the tail points to */
  tail: 'left' | 'right' | 'none'
  font: string
  size: number
}
export interface ClotheslineProps {
  /** three photo slots (data URLs, '' = empty) */
  photos: [string, string, string]
}
export interface ThreadProps {
  /** ids of the two connected items */
  a: string
  b: string
  color: string
}

export interface ItemBase {
  id: string
  /** centre, in percent of the canvas width */
  x: number
  /** centre, in px from the top of the canvas */
  y: number
  width: number
  height: number
  rotation: number
  zIndex: number
}

export type CanvasItem = ItemBase &
  (
    | { type: 'photo'; props: PhotoProps }
    | { type: 'sticker'; props: StickerProps }
    | { type: 'text'; props: TextProps }
    | { type: 'note'; props: NoteProps }
    | { type: 'draw'; props: DrawProps }
    | { type: 'map'; props: MapProps }
    | { type: 'divider'; props: DividerProps }
    | { type: 'bubble'; props: BubbleProps }
    | { type: 'clothesline'; props: ClotheslineProps }
    | { type: 'thread'; props: ThreadProps }
  )

export type ItemType = CanvasItem['type']

/** Partial update for any item: base fields + a partial props bag. */
export type ItemPatch = Partial<ItemBase> & { props?: Record<string, unknown> }
