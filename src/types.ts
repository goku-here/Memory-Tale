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
  members?: Member[]
}
