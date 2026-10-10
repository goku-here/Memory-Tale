/** Sizes the story frame can take. Safe zones are the parts of the picture an app covers with its own buttons. */
export interface StorySize {
  id: string
  name: string
  /** where it is used */
  note: string
  w: number
  h: number
  /** fractions of the height covered by the app's UI (0 = nothing) */
  safeTop: number
  safeBottom: number
  /** names of the covered areas, top and bottom */
  zones?: [string, string]
}

export const STORY_SIZES: StorySize[] = [
  { id: 'story', name: 'Story / Reel', note: 'Instagram, WhatsApp status, TikTok, Shorts', w: 1080, h: 1920, safeTop: 0.13, safeBottom: 0.18, zones: ['Profile bar', 'Reply bar'] },
  { id: 'portrait', name: 'Instagram post', note: 'Portrait 4:5', w: 1080, h: 1350, safeTop: 0, safeBottom: 0 },
  { id: 'square', name: 'Square', note: 'Instagram, Facebook, WhatsApp', w: 1080, h: 1080, safeTop: 0, safeBottom: 0 },
  { id: 'pin', name: 'Pinterest pin', note: 'Tall 2:3', w: 1000, h: 1500, safeTop: 0, safeBottom: 0 },
  { id: 'wallpaper', name: 'Phone wallpaper', note: 'Lock or home screen', w: 1170, h: 2532, safeTop: 0.1, safeBottom: 0.1, zones: ['Clock and date', 'Lock-screen buttons'] },
  { id: 'video', name: 'YouTube thumbnail', note: 'Wide 16:9', w: 1280, h: 720, safeTop: 0, safeBottom: 0 },
  { id: 'link', name: 'Link post', note: 'Facebook, X, LinkedIn 1.91:1', w: 1200, h: 630, safeTop: 0, safeBottom: 0 },
  { id: 'banner', name: 'Cover banner', note: 'X header, wide 3:1', w: 1500, h: 500, safeTop: 0, safeBottom: 0 },
]

export const getSize = (id?: string | null) => STORY_SIZES.find((s) => s.id === id) ?? STORY_SIZES[0]

/** the frame is as wide as the canvas; its height follows the chosen shape */
export const frameHeightFor = (canvasW: number, size: StorySize) => (canvasW * size.h) / size.w

export const ratioLabel = (s: StorySize) => {
  const g = (a: number, b: number): number => (b ? g(b, a % b) : a)
  const d = g(s.w, s.h)
  const rw = s.w / d, rh = s.h / d
  // odd ratios (1170x2532) read better as a rounded decimal
  return rw > 16 || rh > 16 ? `${(s.w / s.h).toFixed(2)}:1` : `${rw}:${rh}`
}
