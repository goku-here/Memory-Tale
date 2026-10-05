/**
 * Data layer. The UI only talks to `repo` (the `Repository` interface),
 * so swapping Dexie for Firebase later means writing one new implementation.
 */
import { db, type CanvasDoc } from './db'
import type { Memory } from '../types'

export interface Repository {
  listMemories(): Promise<Memory[]>
  getMemory(id: string): Promise<Memory | undefined>
  saveMemory(memory: Memory): Promise<void>
  deleteMemory(id: string): Promise<void>
  loadCanvas(memoryId: string): Promise<CanvasDoc | undefined>
  saveCanvas(doc: CanvasDoc): Promise<void>
  duplicateCanvas(fromId: string, toId: string): Promise<void>
}

export const localRepo: Repository = {
  async listMemories() {
    const all = await db.memories.toArray()
    return all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || b.createdAt - a.createdAt)
  },
  getMemory: (id) => db.memories.get(id),
  async saveMemory(m) {
    await db.memories.put(m)
  },
  async deleteMemory(id) {
    await db.transaction('rw', db.memories, db.canvases, async () => {
      await db.memories.delete(id)
      await db.canvases.delete(id)
    })
  },
  loadCanvas: (id) => db.canvases.get(id),
  async saveCanvas(doc) {
    await db.canvases.put(doc)
  },
  async duplicateCanvas(fromId, toId) {
    const src = await db.canvases.get(fromId)
    if (src) await db.canvases.put({ ...src, memoryId: toId, updatedAt: Date.now() })
  },
}

export const repo: Repository = localRepo
