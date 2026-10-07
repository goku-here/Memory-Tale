import Dexie, { type Table } from 'dexie'
import type { Memory } from '../types'

export interface CanvasDoc {
  memoryId: string
  items: unknown[]
  height?: number
  /** canvas width in px when saved (reference for exports) */
  width?: number
  updatedAt: number
}

class KeepsakeDB extends Dexie {
  memories!: Table<Memory, string>
  canvases!: Table<CanvasDoc, string>
  /** images pulled from the cloud, keyed by content id */
  assets!: Table<{ id: string; data: string }, string>
  constructor() {
    super('keepsake')
    this.version(1).stores({
      memories: 'id, createdAt',
      canvases: 'memoryId',
    })
    this.version(2).stores({ memories: 'id, createdAt', canvases: 'memoryId', assets: 'id' })
  }
}

export const db = new KeepsakeDB()
