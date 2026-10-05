import { useCallback, useEffect, useState } from 'react'
import { repo } from './repo'
import type { Memory } from '../types'
import { uid } from '../lib/id'

export function useMemories() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setMemories(await repo.listMemories())
    setLoading(false)
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const save = useCallback(async (m: Memory) => {
    await repo.saveMemory(m)
    await refresh()
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await repo.deleteMemory(id)
    await refresh()
  }, [refresh])

  const duplicate = useCallback(async (m: Memory) => {
    const copy: Memory = { ...m, id: uid(), title: `${m.title} (copy)`, createdAt: Date.now(), order: (m.order ?? 0) + 0.5 }
    await repo.saveMemory(copy)
    await repo.duplicateCanvas(m.id, copy.id)
    await refresh()
    return copy
  }, [refresh])

  const reorder = useCallback(async (ids: string[]) => {
    const byId = new Map(memories.map((m) => [m.id, m]))
    const next = ids.map((id, i) => ({ ...byId.get(id)!, order: i })).filter((m) => m.id)
    setMemories(next)
    await Promise.all(next.map((m) => repo.saveMemory(m)))
  }, [memories])

  return { memories, loading, save, remove, duplicate, reorder, refresh }
}
