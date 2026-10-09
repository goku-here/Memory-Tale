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

/** An original photo waiting to be saved to the user's Google Drive (survives closing the app). */
export interface UploadJob {
  /** the photo's originalId */
  id: string
  memoryId: string
  name: string
  mime: string
  blob: Blob
  tries: number
  createdAt: number
  /** set once the file is in Drive, so a retry never uploads it twice */
  fileId?: string
}

class KeepsakeDB extends Dexie {
  memories!: Table<Memory, string>
  canvases!: Table<CanvasDoc, string>
  /** images pulled from the cloud, keyed by content id */
  assets!: Table<{ id: string; data: string }, string>
  uploads!: Table<UploadJob, string>
  /** stand-in for Google Drive while developing (VITE_DRIVE_MOCK=1) */
  mockDrive!: Table<{ id: string; blob: Blob; shared: boolean }, string>
  /** stickers the person made from their own photos (this device) */
  myStickers!: Table<{ id: string; dataUrl: string; ratio: number; createdAt: number }, string>
  constructor() {
    super('keepsake')
    this.version(1).stores({
      memories: 'id, createdAt',
      canvases: 'memoryId',
    })
    this.version(2).stores({ memories: 'id, createdAt', canvases: 'memoryId', assets: 'id' })
    this.version(3).stores({
      memories: 'id, createdAt', canvases: 'memoryId', assets: 'id', uploads: 'id, memoryId', mockDrive: 'id',
    })
    this.version(5).stores({
      memories: 'id, createdAt', canvases: 'memoryId', assets: 'id', uploads: 'id, memoryId, createdAt', mockDrive: 'id', myStickers: 'id, createdAt',
    })
    this.version(4).stores({
      memories: 'id, createdAt', canvases: 'memoryId', assets: 'id', uploads: 'id, memoryId, createdAt', mockDrive: 'id',
    })
  }
}

export const db = new KeepsakeDB()
