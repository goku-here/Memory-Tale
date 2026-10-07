import { useCallback, useEffect, useRef, useState } from 'react'
import { repo } from './repo'
import { db } from './db'
import type { Memory } from '../types'
import { uid as newId } from '../lib/id'
import { useAuth } from './useAuth'
import { deleteRemoteMemory, pushMemory, pushWholeMemory, reportError, setSyncStatus, subscribeMemories } from './sync'

export function useMemories() {
  const { user } = useAuth()
  const uid = user?.uid
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const memRef = useRef<Memory[]>([])
  memRef.current = memories

  const refresh = useCallback(async () => {
    setMemories(await repo.listMemories())
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  /* ---- cloud: pull changes, upload existing local books on first sign-in ---- */
  useEffect(() => {
    if (!uid) { setSyncStatus({ state: 'off' }); return }
    const unsub = subscribeMemories(uid, async (changes, first) => {
      try {
        for (const { type, memory } of changes) {
          if (type === 'removed') { await repo.deleteMemory(memory.id); continue }
          const mine = await db.memories.get(memory.id)
          if (!mine || (memory.updatedAt ?? 0) > (mine.updatedAt ?? 0)) await db.memories.put(memory)
        }
        if (first) {
          const remoteIds = new Set(changes.map((c) => c.memory.id))
          const locals = await db.memories.toArray()
          for (const m of locals) {
            if (!remoteIds.has(m.id) && (!m.ownerId || m.ownerId === uid)) await pushWholeMemory(uid, m)
          }
        }
        await refresh()
      } catch (e) { reportError(e) }
    })
    return unsub
  }, [uid, refresh])

  const push = useCallback((m: Memory) => { if (uid) void pushMemory(uid, m).catch(reportError) }, [uid])

  const save = useCallback(async (m: Memory) => {
    const next = { ...m, updatedAt: Date.now() }
    await repo.saveMemory(next)
    push(next)
    await refresh()
  }, [refresh, push])

  const remove = useCallback(async (id: string) => {
    await repo.deleteMemory(id)
    if (uid) void deleteRemoteMemory(id).catch(reportError)
    await refresh()
  }, [refresh, uid])

  const duplicate = useCallback(async (m: Memory) => {
    const copy: Memory = { ...m, id: newId(), title: `${m.title} (copy)`, createdAt: Date.now(), order: (m.order ?? 0) + 0.5, updatedAt: Date.now() }
    await repo.saveMemory(copy)
    await repo.duplicateCanvas(m.id, copy.id)
    if (uid) void pushWholeMemory(uid, copy).catch(reportError)
    await refresh()
    return copy
  }, [refresh, uid])

  const reorder = useCallback(async (ids: string[]) => {
    const byId = new Map(memRef.current.map((m) => [m.id, m]))
    const now = Date.now()
    const next = ids.map((id, i) => ({ ...byId.get(id)!, order: i, updatedAt: now })).filter((m) => m.id)
    setMemories(next)
    await Promise.all(next.map((m) => repo.saveMemory(m)))
    next.forEach(push)
  }, [push])

  return { memories, loading, save, remove, duplicate, reorder, refresh }
}
