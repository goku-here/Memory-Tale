import Dexie, { type Table } from 'dexie'
import type { Memory } from '../types'

export interface CanvasDoc {
  memoryId: string
  items: unknown[]
  height?: number
  updatedAt: number
}

class KeepsakeDB extends Dexie {
  memories!: Table<Memory, string>
  canvases!: Table<CanvasDoc, string>
  constructor() {
    super('keepsake')
    this.version(1).stores({
      memories: 'id, createdAt',
      canvases: 'memoryId',
    })
  }
}

export const db = new KeepsakeDB()
