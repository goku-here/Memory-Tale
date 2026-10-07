/**
 * Cloud sync on Firestore (free Spark plan, no Storage needed).
 *
 *   memories/{id}                  the memory (cover image inline) + ownerId / memberIds / updatedAt
 *   memories/{id}/items/{itemId}   { json, updatedAt }  one doc per canvas item (nested arrays are not
 *                                  allowed in Firestore, so the item is stored as a JSON string)
 *   memories/{id}/assets/{hash}    { data }             compressed photos, referenced as "asset:<hash>"
 *
 * Dexie stays the app's primary store (works offline); this module mirrors it to the cloud.
 */
import {
  collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, where, writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '../lib/firebase'
import type { CanvasItem, Memory } from '../types'
import { db as local } from './db'

/* ---------- status shown in Settings ---------- */
export type SyncStatus = { state: 'off' | 'syncing' | 'synced' | 'error'; message?: string }
let status: SyncStatus = { state: 'off' }
const listeners = new Set<(s: SyncStatus) => void>()
export const getSyncStatus = () => status
export const onSyncStatus = (fn: (s: SyncStatus) => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }
export function setSyncStatus(s: SyncStatus) { status = s; listeners.forEach((f) => f(s)) }

export function reportError(e: unknown) {
  const code = (e as { code?: string }).code ?? ''
  const message = code === 'permission-denied'
    ? 'Firestore rules block sync. Publish the rules from backend/firestore.rules (see README).'
    : code === 'unavailable' ? 'Offline. Changes will sync when you are back online.'
    : (e as Error).message || 'Sync failed'
  console.warn('[sync]', e)
  setSyncStatus({ state: 'error', message })
}

/* ---------- assets ---------- */
const REF = 'asset:'
const isData = (v: unknown): v is string => typeof v === 'string' && v.startsWith('data:')
const idCache = new Map<string, string>()
const uploaded = new Set<string>()

function fnv(s: string) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36)
}
export function assetId(data: string) {
  let id = idCache.get(data)
  if (!id) { id = `${data.length.toString(36)}${fnv(data)}${fnv(data.slice(0, 4096) + data.slice(-4096))}`; idCache.set(data, id) }
  return id
}

function swapAssets(item: CanvasItem, f: (v: string) => string): CanvasItem {
  if (item.type === 'photo') return { ...item, props: { ...item.props, src: f(item.props.src) } }
  if (item.type === 'sticker' && item.props.kind === 'image') return { ...item, props: { ...item.props, value: f(item.props.value) } }
  if (item.type === 'clothesline') return { ...item, props: { photos: item.props.photos.map((p) => (p ? f(p) : p)) as [string, string, string] } }
  return item
}

function dataUrlsOf(item: CanvasItem) {
  const out: string[] = []
  swapAssets(item, (v) => { if (isData(v)) out.push(v); return v })
  return out
}

const toJson = (item: CanvasItem) => JSON.stringify(swapAssets(item, (v) => (isData(v) ? REF + assetId(v) : v)))

/** Re-encode an oversized image so it fits in a 1 MB Firestore document. */
async function fit(data: string): Promise<string> {
  if (data.length < 900_000) return data
  const img = new Image()
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = data })
  let scale = 0.8, out = data
  for (let i = 0; i < 5 && out.length >= 900_000; i++) {
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * scale)
    c.height = Math.round(img.naturalHeight * scale)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    out = c.toDataURL(data.startsWith('data:image/png') ? 'image/png' : 'image/jpeg', 0.75)
    scale *= 0.8
  }
  return out
}

async function uploadAssets(memoryId: string, urls: string[]) {
  const d = getDb()
  if (!d) return
  for (const url of urls) {
    const id = assetId(url)
    const key = `${memoryId}/${id}`
    if (uploaded.has(key)) continue
    await setDoc(doc(d, 'memories', memoryId, 'assets', id), { data: await fit(url) })
    uploaded.add(key)
  }
}

async function loadAsset(memoryId: string, id: string): Promise<string | null> {
  const cached = await local.assets.get(id)
  if (cached) { idCache.set(cached.data, id); return cached.data }
  const d = getDb()
  if (!d) return null
  const snap = await getDoc(doc(d, 'memories', memoryId, 'assets', id))
  const data = snap.exists() ? (snap.data().data as string) : null
  if (data) {
    idCache.set(data, id) // so re-hashing the pulled image yields the same id (no ping-pong)
    uploaded.add(`${memoryId}/${id}`)
    await local.assets.put({ id, data })
  }
  return data
}

async function resolveItem(memoryId: string, json: string): Promise<CanvasItem> {
  const item = JSON.parse(json) as CanvasItem
  const refs = new Set<string>()
  swapAssets(item, (v) => { if (v.startsWith(REF)) refs.add(v.slice(REF.length)); return v })
  const map = new Map<string, string>()
  await Promise.all([...refs].map(async (id) => { const data = await loadAsset(memoryId, id); if (data) map.set(id, data) }))
  return swapAssets(item, (v) => (v.startsWith(REF) ? map.get(v.slice(REF.length)) ?? '' : v))
}

/* ---------- memories ---------- */
const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o))

export function subscribeMemories(
  uid: string,
  onChange: (changes: { type: 'added' | 'modified' | 'removed'; memory: Memory }[], first: boolean) => void,
): Unsubscribe {
  const d = getDb()
  if (!d) return () => {}
  let first = true
  setSyncStatus({ state: 'syncing' })
  return onSnapshot(
    query(collection(d, 'memories'), where('memberIds', 'array-contains', uid)),
    (snap) => {
      onChange(snap.docChanges().map((c) => ({ type: c.type, memory: { ...(c.doc.data() as Memory), id: c.doc.id } })), first)
      first = false
      setSyncStatus({ state: snap.metadata.hasPendingWrites ? 'syncing' : 'synced' })
    },
    reportError,
  )
}

export async function pushMemory(uid: string, m: Memory) {
  const d = getDb()
  if (!d) return
  setSyncStatus({ state: 'syncing' })
  const full: Memory = { ...m, ownerId: m.ownerId ?? uid, memberIds: m.memberIds ?? [uid], updatedAt: m.updatedAt ?? Date.now() }
  await setDoc(doc(d, 'memories', m.id), clean(full))
}

export async function deleteRemoteMemory(id: string) {
  const d = getDb()
  if (!d) return
  for (const sub of ['items', 'assets']) {
    const docs = await getDocs(collection(d, 'memories', id, sub))
    for (let i = 0; i < docs.docs.length; i += 400) {
      const b = writeBatch(d)
      docs.docs.slice(i, i + 400).forEach((x) => b.delete(x.ref))
      await b.commit()
    }
  }
  await deleteDoc(doc(d, 'memories', id))
}

/* ---------- canvas items ---------- */
/** last JSON we know the cloud holds (written by us or received) per memory/item */
const known = new Map<string, Map<string, string>>()
const knownFor = (memoryId: string) => { let m = known.get(memoryId); if (!m) known.set(memoryId, (m = new Map())); return m }

export async function pushCanvas(memoryId: string, items: CanvasItem[]) {
  const d = getDb()
  if (!d) return
  const k = knownFor(memoryId)
  const changed: { item: CanvasItem; json: string }[] = []
  for (const item of items) {
    const json = toJson(item)
    if (k.get(item.id) !== json) changed.push({ item, json })
  }
  const gone = [...k.keys()].filter((id) => !items.some((i) => i.id === id))
  if (!changed.length && !gone.length) return
  setSyncStatus({ state: 'syncing' })
  await uploadAssets(memoryId, changed.flatMap((c) => dataUrlsOf(c.item)))
  const ops = [
    ...changed.map((c) => ({ id: c.item.id, json: c.json as string | null })),
    ...gone.map((id) => ({ id, json: null })),
  ]
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(d)
    for (const op of ops.slice(i, i + 400)) {
      const ref = doc(d, 'memories', memoryId, 'items', op.id)
      if (op.json === null) b.delete(ref)
      else b.set(ref, { json: op.json, updatedAt: Date.now() })
    }
    await b.commit()
  }
  for (const c of changed) k.set(c.item.id, c.json)
  for (const id of gone) k.delete(id)
  setSyncStatus({ state: 'synced' })
}

export function subscribeCanvas(
  memoryId: string,
  onChange: (upserts: CanvasItem[], removedIds: string[], first: boolean, remoteUpdatedAt: number) => void,
): Unsubscribe {
  const d = getDb()
  if (!d) return () => {}
  const k = knownFor(memoryId)
  let first = true
  return onSnapshot(
    collection(d, 'memories', memoryId, 'items'),
    async (snap) => {
      const isFirst = first
      first = false
      const upserts: { json: string; at: number }[] = []
      const removed: string[] = []
      for (const c of snap.docChanges()) {
        if (c.type === 'removed') { k.delete(c.doc.id); removed.push(c.doc.id); continue }
        const data = c.doc.data({ serverTimestamps: 'estimate' }) as { json: string; updatedAt: number }
        if (k.get(c.doc.id) === data.json) continue // our own write echoing back
        k.set(c.doc.id, data.json)
        upserts.push({ json: data.json, at: data.updatedAt })
      }
      if (!upserts.length && !removed.length) return
      try {
        const items = await Promise.all(upserts.map((u) => resolveItem(memoryId, u.json)))
        onChange(items, removed, isFirst, Math.max(0, ...upserts.map((u) => u.at)))
      } catch (e) { reportError(e) }
    },
    reportError,
  )
}

/** Push a whole local memory (used to upload existing books on first sign-in). */
export async function pushWholeMemory(uid: string, m: Memory) {
  await pushMemory(uid, m)
  const doc = await local.canvases.get(m.id)
  if (doc) await pushCanvas(m.id, doc.items as CanvasItem[])
}
