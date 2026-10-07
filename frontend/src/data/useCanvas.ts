import { useCallback, useEffect, useRef, useState } from 'react'
import { repo } from './repo'
import { pushCanvas, reportError, subscribeCanvas } from './sync'
import type { CanvasItem } from '../types'
import { MIN_HEIGHT } from '../lib/items'

type Updater = (items: CanvasItem[]) => CanvasItem[]

const same = (a: CanvasItem[], b: CanvasItem[]) => a === b || (a.length === b.length && a.every((x, i) => x === b[i]))

/**
 * Canvas state for one memory: items + undo/redo history + debounced auto-save.
 *  - commit(): a discrete change that is recorded in history
 *  - begin()/live()/end(): a continuous gesture (drag, pinch) → one history entry
 */
export function useCanvas(memoryId: string, uid?: string) {
  const [items, setItems] = useState<CanvasItem[]>([])
  const [height, setHeightState] = useState(MIN_HEIGHT)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState<'saved' | 'saving'>('saved')
  const [, bump] = useState(0)

  const ref = useRef<CanvasItem[]>([])
  const heightRef = useRef(MIN_HEIGHT)
  const widthRef = useRef(390)
  const past = useRef<CanvasItem[][]>([])
  const future = useRef<CanvasItem[][]>([])
  const base = useRef<CanvasItem[] | null>(null)
  const dirty = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  const apply = useCallback((next: CanvasItem[]) => {
    ref.current = next
    dirty.current = true
    setItems(next)
    setStatus('saving')
  }, [])

  const flush = useCallback(async () => {
    window.clearTimeout(timer.current)
    if (!dirty.current) return
    dirty.current = false
    const items = ref.current
    await repo.saveCanvas({ memoryId, items, height: heightRef.current, width: widthRef.current, updatedAt: Date.now() })
    if (uid) void pushCanvas(memoryId, items).catch(reportError)
    setStatus('saved')
  }, [memoryId, uid])

  const schedule = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => void flush(), 600)
  }, [flush])

  useEffect(() => {
    let alive = true
    void repo.loadCanvas(memoryId).then((doc) => {
      if (!alive) return
      ref.current = (doc?.items as CanvasItem[]) ?? []
      heightRef.current = Math.max(MIN_HEIGHT, doc?.height ?? MIN_HEIGHT)
      setItems(ref.current)
      setHeightState(heightRef.current)
      setLoaded(true)
    })
    return () => {
      alive = false
      void flush() // never lose the last edit when leaving the canvas
    }
  }, [memoryId, flush])

  useEffect(() => { if (loaded && dirty.current) schedule() }, [items, height, loaded, schedule])

  useEffect(() => {
    const onHide = () => void flush()
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => { window.removeEventListener('pagehide', onHide); document.removeEventListener('visibilitychange', onHide) }
  }, [flush])

  /* ---- cloud: apply other people's / devices' changes ---- */
  useEffect(() => {
    if (!uid || !loaded) return
    return subscribeCanvas(memoryId, async (upserts, removed, first, remoteAt) => {
      const mine = await repo.loadCanvas(memoryId)
      const localAt = mine?.updatedAt ?? 0
      let next = ref.current
      for (const it of upserts) {
        const at = next.findIndex((x) => x.id === it.id)
        // first snapshot: only take remote versions that are newer than what this device saved
        if (at >= 0 && first && remoteAt <= localAt) continue
        next = at >= 0 ? next.map((x, i) => (i === at ? it : x)) : [...next, it]
      }
      if (removed.length) next = next.filter((x) => !removed.includes(x.id))
      if (next === ref.current) return
      ref.current = next
      setItems(next)
      await repo.saveCanvas({ memoryId, items: next, height: heightRef.current, width: widthRef.current, updatedAt: Math.max(Date.now(), remoteAt) })
    })
  }, [uid, loaded, memoryId])

  const commit = useCallback((fn: Updater) => {
    const cur = ref.current
    const next = fn(cur)
    if (next === cur) return
    past.current.push(cur)
    if (past.current.length > 100) past.current.shift()
    future.current = []
    apply(next)
    bump((n) => n + 1)
  }, [apply])

  const begin = useCallback(() => { base.current = ref.current }, [])
  const live = useCallback((fn: Updater) => {
    const next = fn(ref.current)
    if (next !== ref.current) apply(next)
  }, [apply])
  const end = useCallback(() => {
    if (base.current && !same(base.current, ref.current)) {
      past.current.push(base.current)
      if (past.current.length > 100) past.current.shift()
      future.current = []
      bump((n) => n + 1)
    }
    base.current = null
  }, [])

  const undo = useCallback(() => {
    const prev = past.current.pop()
    if (!prev) return
    future.current.push(ref.current)
    apply(prev)
    bump((n) => n + 1)
  }, [apply])
  const redo = useCallback(() => {
    const nxt = future.current.pop()
    if (!nxt) return
    past.current.push(ref.current)
    apply(nxt)
    bump((n) => n + 1)
  }, [apply])

  const setHeight = useCallback((h: number) => {
    heightRef.current = h
    dirty.current = true
    setHeightState(h)
    setStatus('saving')
  }, [])

  const setWidth = useCallback((w: number) => { widthRef.current = w }, [])

  return {
    setWidth, items, itemsRef: ref, height, loaded, status, commit, begin, live, end, undo, redo, setHeight,
    canUndo: past.current.length > 0, canRedo: future.current.length > 0,
  }
}
