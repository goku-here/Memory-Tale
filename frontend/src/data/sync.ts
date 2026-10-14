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
  arrayRemove, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where, writeBatch,
  type Unsubscribe,
} from 'firebase/firestore'
import { getDb } from '../lib/firebase'
import type { CanvasItem, Memory } from '../types'
import { db as local } from './db'
import { decryptText, encryptText, isEncrypted } from '../lib/crypto'
import { getBookKey, getBookKeyRaw } from './keys'

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

/* ---------- private books ---------- */
/** what the cloud shows instead of a private book's title and cover */
export const PRIVATE_TITLE = 'Private book'
export const PRIVATE_COVER = { type: 'color' as const, value: '#8A8F9C', tone: 'light' as const }

/** the title and cover of a private book, locked into one string */
export const sealMeta = (key: CryptoKey, m: Pick<Memory, 'title' | 'cover'>) => encryptText(key, JSON.stringify({ title: m.title, cover: m.cover }))
export async function openMeta(key: CryptoKey, packed: string): Promise<{ title: string; cover: Memory['cover'] } | null> {
  try { return JSON.parse(await decryptText(key, packed)) } catch { return null }
}

/** the key of a private book on this phone: null for an ordinary book; throws when the book is private but the key is missing */
async function privateKey(memoryId: string): Promise<CryptoKey | null> {
  const m = await local.memories.get(memoryId)
  if (!m?.e2ee) return null
  const k = await getBookKey(memoryId)
  if (!k) { window.dispatchEvent(new CustomEvent('mt-locked', { detail: memoryId })); throw new Error('locked') }
  return k
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
  if (item.type === 'group') return { ...item, props: { ...item.props, children: item.props.children.map((c) => swapAssets(c, f)) } }
  if (item.type === 'collage') return { ...item, props: { ...item.props, photos: item.props.photos.map((p) => (p ? f(p) : p)) } }
  return item
}

function dataUrlsOf(item: CanvasItem) {
  const out: string[] = []
  swapAssets(item, (v) => { if (isData(v)) out.push(v); return v })
  return out
}

/** an item that did not change is the same object as before, so its JSON is reused instead of being rebuilt */
const jsonCache = new WeakMap<object, string>()
const toJson = (item: CanvasItem) => {
  const hit = jsonCache.get(item)
  if (hit !== undefined) return hit
  const out = JSON.stringify(swapAssets(item, (v) => (isData(v) ? REF + assetId(v) : v)))
  jsonCache.set(item, out)
  return out
}

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
  const key0 = await privateKey(memoryId)
  for (const url of urls) {
    const id = assetId(url)
    const key = `${memoryId}/${id}`
    if (uploaded.has(key)) continue
    const data = await fit(url)
    await setDoc(doc(d, 'memories', memoryId, 'assets', id), key0 ? { enc: await encryptText(key0, data) } : { data })
    uploaded.add(key)
  }
}

export async function loadAssetData(memoryId: string, id: string): Promise<string | null> {
  const cached = await local.assets.get(id)
  if (cached) { idCache.set(cached.data, id); return cached.data }
  const d = getDb()
  if (!d) return null
  const snap = await getDoc(doc(d, 'memories', memoryId, 'assets', id))
  let data: string | null = null
  if (snap.exists()) {
    const raw = snap.data() as { data?: string; enc?: string }
    if (raw.enc) { const k = await getBookKey(memoryId); data = k ? await decryptText(k, raw.enc).catch(() => null) : null } else data = raw.data ?? null
  }
  if (data) {
    idCache.set(data, id) // so re-hashing the pulled image yields the same id (no ping-pong)
    uploaded.add(`${memoryId}/${id}`)
    await local.assets.put({ id, data })
  }
  return data
}

/** Replaces `asset:` references with real images (used for exports). */
export async function resolveItemAssets(memoryId: string, item: CanvasItem): Promise<CanvasItem> {
  const refs = new Set<string>()
  swapAssets(item, (v) => { if (v.startsWith(REF)) refs.add(v.slice(REF.length)); return v })
  const map = new Map<string, string>()
  await Promise.all([...refs].map(async (id) => { const data = await loadAssetData(memoryId, id); if (data) map.set(id, data) }))
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
    async (snap) => {
      const changes = await Promise.all(snap.docChanges().map(async (c) => {
        const memory = { ...(c.doc.data() as Memory & { meta?: string }), id: c.doc.id }
        // a private book's title and cover arrive locked: open them with this phone's key (without it the placeholder stays)
        if (memory.meta) {
          const key = await getBookKey(memory.id)
          const opened = key ? await openMeta(key, memory.meta) : null
          if (opened) { memory.title = opened.title; memory.cover = opened.cover }
          delete memory.meta
        }
        return { type: c.type, memory: memory as Memory }
      }))
      onChange(changes, first)
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
  const ref = doc(d, 'memories', m.id)
  // never overwrite who is in the book with a possibly stale local copy: details only
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { memberIds, members, ownerId, viewerIds, ...details } = m as Memory & { joinToken?: string }
  void viewerIds
  delete (details as { joinToken?: string }).joinToken
  let exists = false
  try { exists = (await getDoc(ref)).exists() } catch { /* offline and not cached: treat as new */ }
  if (m.e2ee) {
    // a private book: the title and cover go up locked, never as readable text
    const key = await getBookKey(m.id)
    const d2 = details as Partial<Memory> & { meta?: string }
    if (key) { d2.meta = await sealMeta(key, m); d2.title = PRIVATE_TITLE; d2.cover = PRIVATE_COVER } else { delete d2.title; delete d2.cover } // no key: leave them as they are in the cloud
  }
  if (exists) {
    await setDoc(ref, clean({ ...details, updatedAt: m.updatedAt ?? Date.now() }), { merge: true })
  } else {
    await setDoc(ref, clean({
      ...details, ownerId: ownerId ?? uid, memberIds: memberIds ?? [uid], members: members ?? [], updatedAt: m.updatedAt ?? Date.now(),
    }))
  }
}

export async function deleteRemoteMemory(id: string) {
  const d = getDb()
  if (!d) return
  for (const sub of ['items', 'assets', 'originals']) {
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
  const refsIn = (json?: string) => new Set(json ? json.match(/asset:[A-Za-z0-9]+/g) ?? [] : [])
  for (const item of items) {
    const json = toJson(item)
    if (k.get(item.id) !== json) changed.push({ item, json })
  }
  const gone = [...k.keys()].filter((id) => !items.some((i) => i.id === id))
  if (!changed.length && !gone.length) return
  // shared copies that this change stops using (photo deleted or replaced): candidates for clean-up
  const stale = new Set<string>()
  for (const c of changed) { const now = refsIn(c.json); refsIn(k.get(c.item.id)).forEach((r) => { if (!now.has(r)) stale.add(r) }) }
  for (const id of gone) refsIn(k.get(id)).forEach((r) => stale.add(r))
  const key = await privateKey(memoryId)
  setSyncStatus({ state: 'syncing' })
  await uploadAssets(memoryId, changed.flatMap((c) => dataUrlsOf(c.item)))
  const sealed = new Map<string, string>()
  if (key) for (const c of changed) sealed.set(c.item.id, await encryptText(key, c.json))
  const ops = [
    ...changed.map((c) => ({ id: c.item.id, json: c.json as string | null })),
    ...gone.map((id) => ({ id, json: null })),
  ]
  // remember what we are sending *before* committing, so the local echo of our own write is recognised and ignored
  const prev = new Map<string, string | undefined>([...changed.map((c) => c.item.id), ...gone].map((id) => [id, k.get(id)]))
  for (const c of changed) k.set(c.item.id, c.json)
  for (const id of gone) k.delete(id)
  try {
    for (let i = 0; i < ops.length; i += 400) {
      const b = writeBatch(d)
      for (const op of ops.slice(i, i + 400)) {
        const ref = doc(d, 'memories', memoryId, 'items', op.id)
        if (op.json === null) b.delete(ref)
        else b.set(ref, key ? { enc: sealed.get(op.id)!, updatedAt: Date.now() } : { json: op.json, updatedAt: Date.now() })
      }
      await b.commit()
    }
  } catch (e) {
    prev.forEach((v, id) => (v === undefined ? k.delete(id) : k.set(id, v))) // allow a retry on the next save
    throw e
  }
  setSyncStatus({ state: 'synced' })
  if (stale.size) scheduleAssetCleanup(memoryId, [...stale])
}

/** which books have received their first snapshot (clean-up must never run on a half-loaded picture of a book) */
const loadedBooks = new Set<string>()

/** After a grace period (so Undo still works), delete shared copies that no item refers to any more. */
function scheduleAssetCleanup(memoryId: string, refs: string[]) {
  window.setTimeout(async () => {
    const d = getDb()
    if (!d || !loadedBooks.has(memoryId)) return
    const used = [...knownFor(memoryId).values()].join('\n')
    for (const ref of refs) {
      if (used.includes(ref)) continue
      const id = ref.slice(REF.length)
      try { await deleteDoc(doc(d, 'memories', memoryId, 'assets', id)) } catch (e) { reportError(e); continue }
      uploaded.delete(`${memoryId}/${id}`)
      await local.assets.delete(id).catch(() => {})
    }
  }, 60_000)
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
      loadedBooks.add(memoryId)
      const upserts: { json: string; at: number }[] = []
      const removed: string[] = []
      for (const c of snap.docChanges()) {
        if (c.type === 'removed') { k.delete(c.doc.id); removed.push(c.doc.id); continue }
        const raw = c.doc.data({ serverTimestamps: 'estimate' }) as { json?: string; enc?: string; updatedAt: number }
        let json = raw.json
        if (raw.enc) {
          const key = await getBookKey(memoryId)
          if (!key) { window.dispatchEvent(new CustomEvent('mt-locked', { detail: memoryId })); continue }
          try { json = await decryptText(key, raw.enc) } catch { continue }
        }
        if (json === undefined || isEncrypted(json)) continue
        if (k.get(c.doc.id) === json) continue // our own write echoing back
        k.set(c.doc.id, json)
        upserts.push({ json, at: raw.updatedAt })
      }
      if (!upserts.length && !removed.length) return
      try {
        // items keep their `asset:` references; the images load lazily when they come near the screen
        const items = upserts.map((u) => JSON.parse(u.json) as CanvasItem)
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

/* ---------- invites (sharing) ---------- */
export interface Invite {
  token: string
  memoryId: string
  createdBy: string
  title: string
  themeId: Memory['themeId']
  date: string
  cover: Memory['cover']
  ownerName: string
  ownerPhoto?: string
  /** the real accounts in the book when the link was made (shown on the cover) */
  members?: Memory['members']
  /** what the person who opens the link may do (older links: edit) */
  role?: 'edit' | 'view'
  /** private book: the real title and cover, locked (the link's key opens them) */
  meta?: string
}
interface Who { uid: string; name: string; photo?: string | null }

const rand = (n: number) => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(n))
  return [...bytes].map((b) => chars[b % chars.length]).join('')
}

/** Links must open on other people's phones, so local/dev addresses fall back to the live site. */
function publicBase() {
  const { hostname, origin } = window.location
  const isLocal = hostname === 'localhost' || /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname) || hostname.endsWith('.local')
  const configured = import.meta.env.VITE_PUBLIC_URL as string | undefined
  return isLocal ? (configured || 'https://memory-tale-seven.vercel.app').replace(/\/$/, '') : origin
}

/** A brand-new, unguessable link every time. The invite doc carries just enough to show a preview. */
export async function createInvite(who: Who, m: Memory, role: 'edit' | 'view' = 'edit'): Promise<string> {
  const d = getDb()
  if (!d) throw new Error('Cloud is not configured')
  await pushWholeMemory(who.uid, m) // the book has to exist in the cloud before anyone can join it
  const token = rand(24)
  // keep the preview small: a huge cover photo falls back to its average colour
  const cover = m.cover.type === 'image' && m.cover.value.length > 380_000
    ? { type: 'color' as const, value: m.cover.avg ?? '#9DB7D5', tone: m.cover.tone }
    : m.cover
  // books made before signing in carry a placeholder "You" avatar: swap it for the real account
  const color = m.members?.[0]?.color ?? '#17171a'
  const real = (m.members ?? []).filter((x) => x.id !== 'me' && x.name !== 'You')
  if (!real.some((x) => x.id === who.uid)) real.unshift({ id: who.uid, name: who.name, color, photo: who.photo ?? undefined })
  const members = real.slice(0, 6)
  try { await updateDoc(doc(d, 'memories', m.id), clean({ members, updatedAt: Date.now() })) } catch { /* guests can't rewrite the list; the invite still carries it */ }
  let preview: { title: string; cover: Memory['cover']; meta?: string } = { title: m.title, cover }
  if (m.e2ee) {
    const key = await getBookKey(m.id)
    if (!key) throw new Error('locked')
    // the preview is locked too: the link's own key opens it on the other person's phone
    preview = { title: PRIVATE_TITLE, cover: PRIVATE_COVER, meta: await sealMeta(key, { title: m.title, cover }) }
  }
  const invite = clean({
    memoryId: m.id, createdBy: who.uid, createdAt: Date.now(), ...preview, themeId: m.themeId, date: m.date,
    ownerName: who.name, ownerPhoto: who.photo ?? undefined, members, role,
  })
  await setDoc(doc(d, 'invites', token), invite)
  // a private book's key rides in the part of the link after #, which never reaches any server
  let tail = ''
  if (m.e2ee) {
    const raw = await getBookKeyRaw(m.id)
    if (!raw) throw new Error('locked')
    const epoch = (await local.keys.get(m.id))?.epoch ?? 0
    tail = `#k=${raw}${epoch ? `&e=${epoch}` : ''}`
  }
  return `${publicBase()}/join/${token}${tail}`
}

export async function getInvite(token: string): Promise<Invite | null> {
  const d = getDb()
  if (!d) return null
  const snap = await getDoc(doc(d, 'invites', token))
  return snap.exists() ? ({ ...(snap.data() as Invite), token }) : null
}

/** Adds the signed-in user to the book (allowed by the rules because the invite exists). */
export async function joinMemory(token: string, memoryId: string, who: Who, color: string, role: 'edit' | 'view' = 'edit') {
  const d = getDb()
  if (!d) return
  await updateDoc(doc(d, 'memories', memoryId), {
    memberIds: arrayUnion(who.uid),
    members: arrayUnion(clean({ id: who.uid, name: who.name, color, photo: who.photo ?? undefined })),
    ...(role === 'view' ? { viewerIds: arrayUnion(who.uid) } : {}),
    joinToken: token,
    updatedAt: Date.now(),
  })
}

export async function leaveMemory(uid: string, memoryId: string) {
  const d = getDb()
  if (!d) return
  await updateDoc(doc(d, 'memories', memoryId), { memberIds: arrayRemove(uid), updatedAt: Date.now() })
}

/* ---------- turning a book private ---------- */

/** forget what we believe the cloud holds for a book, so the next push writes every item and photo again */
export function resetBookCache(memoryId: string) {
  known.delete(memoryId)
  for (const k of [...uploaded]) if (k.startsWith(`${memoryId}/`)) uploaded.delete(k)
}

/**
 * After a book's items and photos were rewritten encrypted: lock whatever readable copies are left in the cloud
 * (photos other people added that this phone never held as data) and delete readable copies nothing refers to.
 */
export async function sealLeftovers(memoryId: string, key: CryptoKey, items: CanvasItem[]) {
  const d = getDb()
  if (!d) return
  const ids = new Set(items.map((i) => i.id))
  const used = JSON.stringify(items.map((i) => toJson(i)))
  const docs = await getDocs(collection(d, 'memories', memoryId, 'items'))
  for (const x of docs.docs) {
    const v = x.data() as { json?: string; enc?: string }
    if (v.enc && !v.json) continue
    if (ids.has(x.id) && v.json) await setDoc(x.ref, { enc: await encryptText(key, v.json), updatedAt: Date.now() })
    else await deleteDoc(x.ref)
  }
  const assets = await getDocs(collection(d, 'memories', memoryId, 'assets'))
  for (const x of assets.docs) {
    const v = x.data() as { data?: string; enc?: string }
    if (v.enc && !v.data) continue
    if (v.data && used.includes(x.id)) await setDoc(x.ref, { enc: await encryptText(key, v.data) })
    else await deleteDoc(x.ref)
  }
}

/** a new key for a private book: every item and photo in the cloud is opened with the old key and locked again with the new one */
export async function rekeyCloud(memoryId: string, oldKey: CryptoKey, newKey: CryptoKey, onStep?: (what: string) => void) {
  const d = getDb()
  if (!d) return
  onStep?.('Locking the layout with the new key')
  const items = await getDocs(collection(d, 'memories', memoryId, 'items'))
  for (const x of items.docs) {
    const v = x.data() as { enc?: string }
    if (!v.enc) continue
    const json = await decryptText(oldKey, v.enc)
    await setDoc(x.ref, { enc: await encryptText(newKey, json), updatedAt: Date.now() })
  }
  onStep?.('Locking the pictures with the new key')
  const assets = await getDocs(collection(d, 'memories', memoryId, 'assets'))
  for (const x of assets.docs) {
    const v = x.data() as { enc?: string }
    if (!v.enc) continue
    const data = await decryptText(oldKey, v.enc)
    await setDoc(x.ref, { enc: await encryptText(newKey, data) })
  }
}

/** a key just arrived for a private book: read its real title and cover from the cloud into the local copy */
export async function hydrateMeta(memoryId: string) {
  const d = getDb()
  const key = await getBookKey(memoryId)
  if (!d || !key) return
  const snap = await getDoc(doc(d, 'memories', memoryId))
  const meta = (snap.data() as { meta?: string } | undefined)?.meta
  const opened = meta ? await openMeta(key, meta) : null
  if (opened) { await local.memories.update(memoryId, { title: opened.title, cover: opened.cover }); window.dispatchEvent(new Event('mt-local-changed')) }
}
