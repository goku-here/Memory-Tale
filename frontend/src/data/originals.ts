/**
 * Full-quality originals live in members' own Google Drives.
 *
 *   uploads queue (IndexedDB)         photos waiting to be saved to my Drive; survives closing the app
 *   memories/{id}/originals/{photoId} { uploaderUid, name, mime, size, createdAt, copies: { [uid]: { fileId, at } } }
 *
 * Every member can keep their own copy ("replicate"); the record lists who holds which file, so a
 * deleted copy can be restored from someone else's.
 */
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
import { getDb } from '../lib/firebase'
import { DriveError, downloadOwn, downloadShared, isConnected, myFileExists, shareByLink, uploadToDrive, getToken } from '../lib/drive'
import { downloadOriginal } from '../lib/supabase'
import type { CanvasItem, PhotoProps } from '../types'
import { uid as newId } from '../lib/id'
import { db } from './db'
import { pushCanvas, reportError } from './sync'

export interface OriginalRecord {
  id: string
  uploaderUid: string
  name: string
  mime: string
  size: number
  createdAt: number
  copies: Record<string, { fileId: string; at: number }>
}

/* ---------- preferences (this device) ---------- */
const P = {
  backup: 'mt-pref-backup',
  copyShared: 'mt-pref-copyshared',
  wifi: 'mt-pref-wifi',
  paused: 'mt-pref-paused',
  asked: (m: string) => `mt-asked:${m}`,
  copyBook: (m: string) => `mt-copy:${m}`,
}
const flag = (k: string, d: boolean) => { const v = localStorage.getItem(k); return v === null ? d : v === '1' }
export const prefs = {
  backup: () => flag(P.backup, true),
  setBackup: (v: boolean) => localStorage.setItem(P.backup, v ? '1' : '0'),
  copyShared: () => flag(P.copyShared, false),
  setCopyShared: (v: boolean) => localStorage.setItem(P.copyShared, v ? '1' : '0'),
  paused: () => flag(P.paused, false),
  setPaused: (v: boolean) => localStorage.setItem(P.paused, v ? '1' : '0'),
  wifiOnly: () => flag(P.wifi, true),
  setWifiOnly: (v: boolean) => localStorage.setItem(P.wifi, v ? '1' : '0'),
  /** per book: 1 = keep copies, 0 = no, null = ask / use the default */
  copyBook: (m: string): boolean | null => { const v = localStorage.getItem(P.copyBook(m)); return v === null ? null : v === '1' },
  setCopyBook: (m: string, v: boolean) => localStorage.setItem(P.copyBook(m), v ? '1' : '0'),
  asked: (m: string) => localStorage.getItem(P.asked(m)) === '1',
  setAsked: (m: string) => localStorage.setItem(P.asked(m), '1'),
}

/* ---------- live status for the UI ---------- */
export interface DriveStatus {
  /** originals waiting to be saved to my Drive */
  queued: number
  /** progress of the current upload run */
  uploading: { done: number; total: number } | null
  /** why nothing is moving right now */
  blocked: 'paused' | 'wifi' | 'offline' | null
  replicating: { done: number; total: number; skipped: number } | null
  needsReconnect: boolean
  error?: string
}
let status: DriveStatus = { queued: 0, uploading: null, blocked: null, replicating: null, needsReconnect: false }
const subs = new Set<(s: DriveStatus) => void>()
export const getDriveStatus = () => status
export const onDriveStatus = (f: (s: DriveStatus) => void) => { subs.add(f); return () => { subs.delete(f) } }
const setStatus = (p: Partial<DriveStatus>) => { status = { ...status, ...p }; subs.forEach((f) => f(status)) }

const onCellular = () => (navigator as unknown as { connection?: { type?: string } }).connection?.type === 'cellular'
const wifiBlocked = () => prefs.wifiOnly() && onCellular()
const blockedReason = (): DriveStatus['blocked'] => (prefs.paused() ? 'paused' : navigator.onLine === false ? 'offline' : wifiBlocked() ? 'wifi' : null)

/* ---------- records ---------- */
const col = (memoryId: string) => { const d = getDb(); return d ? collection(d, 'memories', memoryId, 'originals') : null }

export async function getRecords(memoryId: string): Promise<OriginalRecord[]> {
  const c = col(memoryId)
  if (!c) return []
  return (await getDocs(c)).docs.map((x) => ({ ...(x.data() as OriginalRecord), id: x.id }))
}

async function getRecord(memoryId: string, id: string): Promise<OriginalRecord | null> {
  const d = getDb()
  if (!d) return null
  const s = await getDoc(doc(d, 'memories', memoryId, 'originals', id))
  return s.exists() ? { ...(s.data() as OriginalRecord), id } : null
}

/* ---------- upload queue (my own photos -> my Drive) ---------- */
let uidNow: string | null = null
let running = false
let retry: number | undefined

export function startOriginals(uid: string) {
  uidNow = uid
  void refreshQueued()
  kick()
  window.addEventListener('online', kick)
}
/** Pause or resume all saving of originals on this device. */
export function setOriginalsPaused(paused: boolean) {
  prefs.setPaused(paused)
  setStatus({ blocked: blockedReason() })
  if (!paused) { kick(); if (lastReplicate) void replicateBook(lastReplicate.memoryId, lastReplicate.uid, { repair: true }) }
}
/** "Try again now": clears the retry counters and runs the queue immediately. */
export async function retryOriginalsNow() {
  for (const j of await db.uploads.toArray()) await db.uploads.update(j.id, { tries: 0, createdAt: Math.min(j.createdAt, Date.now()) })
  setStatus({ error: undefined })
  kick()
}
let lastReplicate: { memoryId: string; uid: string } | null = null

export function stopOriginals() {
  uidNow = null
  window.removeEventListener('online', kick)
  window.clearTimeout(retry)
}
const kick = () => { processUploads().catch((e) => { console.warn('[originals]', e) }) }
async function refreshQueued() { setStatus({ queued: await db.uploads.count() }) }

/** Called when a photo is added: remember the untouched file and start saving it to Drive. */
export async function queueOriginal(file: Blob & { name?: string }, memoryId: string, photoId: string) {
  await db.uploads.put({
    id: photoId, memoryId, name: file.name || `${photoId}.jpg`, mime: file.type || 'image/jpeg', blob: file, tries: 0, createdAt: Date.now(),
  })
  await refreshQueued()
  kick()
}

export async function processUploads() {
  if (running || !uidNow || !isConnected()) return
  const reason = blockedReason()
  setStatus({ blocked: reason })
  if (reason) return
  running = true
  const uid = uidNow
  let done = 0
  const total = await db.uploads.count()
  try {
    for (;;) {
      const job = (await db.uploads.orderBy('createdAt').first())
      if (!job) break
      if (job.tries >= 6) { await db.uploads.update(job.id, { createdAt: Date.now() + 86_400_000 }); continue }
      if (blockedReason()) { setStatus({ blocked: blockedReason() }); break }
      setStatus({ uploading: { done, total: Math.max(total, done + 1) } })
      const t = await getToken(false)
      if (!t) { setStatus({ needsReconnect: true }); break }
      setStatus({ needsReconnect: false })
      try {
        let fileId = job.fileId
        if (!fileId) {
          fileId = await uploadToDrive(job.blob, job.name, job.mime)
          await shareByLink(fileId)
          await db.uploads.update(job.id, { fileId })
        }
        const d = getDb()
        if (d) {
          await setDoc(doc(d, 'memories', job.memoryId, 'originals', job.id), {
            uploaderUid: uid, name: job.name, mime: job.mime, size: job.blob.size, createdAt: Date.now(),
            copies: { [uid]: { fileId, at: Date.now() } },
          }, { merge: true })
        }
        await db.uploads.delete(job.id)
        done++
        setStatus({ error: undefined, uploading: { done, total: Math.max(total, done) } })
      } catch (e) {
        if (e instanceof DriveError && e.status === 401) { setStatus({ needsReconnect: true }); break }
        await db.uploads.update(job.id, { tries: job.tries + 1 })
        setStatus({ error: (e as Error).message })
        break
      }
      await refreshQueued()
    }
  } finally {
    running = false
    setStatus({ uploading: null })
    await refreshQueued()
    if (uidNow && (await db.uploads.count()) > 0 && isConnected()) {
      window.clearTimeout(retry)
      retry = window.setTimeout(kick, 45_000) // try again later (offline, expired sign-in, hiccup)
    }
  }
}

/* ---------- reading an original ---------- */
/** Best available full-quality file: queued on this phone, my Drive copy, a member's shared copy, or the old Supabase one. */
export async function loadOriginalBlob(memoryId: string, photo: PhotoProps, uid?: string): Promise<Blob | null> {
  if (photo.originalId) {
    const queued = await db.uploads.get(photo.originalId)
    if (queued) return queued.blob
    try {
      const rec = await getRecord(memoryId, photo.originalId)
      if (rec) {
        const mine = uid ? rec.copies[uid] : undefined
        if (mine) { const b = await downloadOwn(mine.fileId); if (b) return b }
        for (const [u, c] of Object.entries(rec.copies)) {
          if (u === uid) continue
          const b = await downloadShared(c.fileId)
          if (b) return b
        }
      }
    } catch (e) { reportError(e) }
  }
  if (photo.original) return downloadOriginal(photo.original)
  return null
}

/* ---------- copies for members ---------- */
/** How many originals in this book do I not have yet (and roughly how big)? */
export async function missingCopies(memoryId: string, uid: string) {
  const recs = await getRecords(memoryId)
  const missing = recs.filter((r) => !r.copies[uid] && r.uploaderUid !== uid && Object.keys(r.copies).length > 0)
  return { count: missing.length, bytes: missing.reduce((n, r) => n + (r.size || 0), 0), total: recs.length }
}

const replicating = new Set<string>()

/**
 * Saves every original I do not have into my own Drive, copying from another member's file.
 * With `repair` it also checks that my existing copies still exist and re-copies deleted ones.
 */
export async function replicateBook(memoryId: string, uid: string, opts: { repair?: boolean } = {}) {
  if (!isConnected() || replicating.has(memoryId)) return null
  lastReplicate = { memoryId, uid }
  if (blockedReason()) { setStatus({ blocked: blockedReason() }); return null }
  replicating.add(memoryId)
  const d = getDb()
  let done = 0
  let skipped = 0
  try {
    const recs = await getRecords(memoryId)
    const todo: OriginalRecord[] = []
    for (const r of recs) {
      const mine = r.copies[uid]
      if (!mine) { if (r.uploaderUid !== uid) todo.push(r) }
      else if (opts.repair && (await myFileExists(mine.fileId)) === false) todo.push({ ...r, copies: Object.fromEntries(Object.entries(r.copies).filter(([u]) => u !== uid)) })
    }
    if (!todo.length) return { done: 0, skipped: 0 }
    setStatus({ replicating: { done: 0, total: todo.length, skipped: 0 } })
    for (const r of todo) {
      if (blockedReason()) { setStatus({ blocked: blockedReason() }); break }
      let blob: Blob | null = null
      for (const c of Object.values(r.copies)) { blob = await downloadShared(c.fileId); if (blob) break }
      if (!blob) skipped++
      else {
        const fileId = await uploadToDrive(blob, r.name, r.mime)
        await shareByLink(fileId)
        if (d) await updateDoc(doc(d, 'memories', memoryId, 'originals', r.id), { [`copies.${uid}`]: { fileId, at: Date.now() } })
        done++
      }
      setStatus({ replicating: { done: done + skipped, total: todo.length, skipped } })
    }
    return { done, skipped }
  } catch (e) {
    if (e instanceof DriveError && e.status === 401) setStatus({ needsReconnect: true })
    else reportError(e)
    return { done, skipped }
  } finally {
    replicating.delete(memoryId)
    setStatus({ replicating: null })
  }
}

/* ---------- moving old Supabase originals to Drive ---------- */
export async function migrateLegacyOriginals(uid: string, onProgress?: (done: number, total: number) => void) {
  const docs = await db.canvases.toArray()
  const jobs: { memoryId: string; id: string; path: string }[] = []
  for (const d of docs) for (const it of d.items as CanvasItem[]) {
    if (it.type === 'photo' && it.props.original && it.props.original.startsWith(`${uid}/`) && !it.props.originalId) jobs.push({ memoryId: d.memoryId, id: it.id, path: it.props.original })
  }
  let n = 0
  for (const j of jobs) {
    const blob = await downloadOriginal(j.path)
    if (blob) {
      const photoId = newId()
      await queueOriginal(Object.assign(blob, { name: j.path.split('/').pop() }) as Blob & { name?: string }, j.memoryId, photoId)
      const cur = await db.canvases.get(j.memoryId)
      if (cur) {
        const items = (cur.items as CanvasItem[]).map((it) => (it.id === j.id && it.type === 'photo' ? { ...it, props: { ...it.props, originalId: photoId, original: undefined } } : it))
        await db.canvases.put({ ...cur, items, updatedAt: Date.now() })
        void pushCanvas(j.memoryId, items).catch(reportError)
      }
    }
    onProgress?.(++n, jobs.length)
  }
  return { moved: n, total: jobs.length }
}
