/**
 * Turning a book private (end-to-end encrypted), and the key travelling in an invite link.
 *
 * The link looks like  https://…/join/<token>#k=<book key>.  Everything after the "#" stays in the browser: it is
 * never sent to any server, so only people who were given the link get the key.
 */
import { doc, updateDoc } from 'firebase/firestore'
import { exportKey, importKey, newBookKey } from '../lib/crypto'
import { getDb } from '../lib/firebase'
import type { CanvasItem, Memory } from '../types'
import { db } from './db'
import { lockOldOriginals } from './originals'
import { ensureIdentity, getBookKey, getBookKeyRaw, saveBookKey, shareNewKey, takeNewKey } from './keys'
import { PRIVATE_COVER, PRIVATE_TITLE, pushCanvas, rekeyCloud, resetBookCache, sealLeftovers, sealMeta } from './sync'

/** Owner only. Locks the book: new key, everything re-uploaded encrypted, readable copies removed from the cloud. */
export async function makeBookPrivate(uid: string, memory: Memory, onStep?: (what: string) => void): Promise<string[]> {
  const d = getDb()
  if (!d) throw new Error('Cloud is not configured')
  if (memory.ownerId && memory.ownerId !== uid) throw new Error('Only the owner can do this')
  onStep?.('Making the key')
  const raw = (await getBookKeyRaw(memory.id)) ?? (await exportKey(await newBookKey()))
  await saveBookKey(uid, memory.id, raw)
  // this phone first, so from here on everything it uploads is encrypted
  await db.memories.update(memory.id, { e2ee: true })
  onStep?.('Locking your pictures')
  resetBookCache(memory.id)
  const items = ((await db.canvases.get(memory.id))?.items ?? []) as CanvasItem[]
  await pushCanvas(memory.id, items)
  onStep?.('Removing readable copies')
  const key = (await getBookKey(memory.id))!
  await sealLeftovers(memory.id, key, items)
  // only now tell everyone the book is private (and lock its title and cover)
  onStep?.('Locking the full-quality originals')
  const fixes = await lockOldOriginals(memory.id, uid, items, (n, t) => onStep?.(`Locking the originals (${n} of ${t})`))
  if (fixes.length) {
    const cur = ((await db.canvases.get(memory.id))?.items ?? []) as CanvasItem[]
    const next = cur.map((it) => { const f = fixes.find((x) => x.id === it.id); return f && it.type === 'photo' ? { ...it, props: { ...it.props, ...f.props } } : it })
    await db.canvases.update(memory.id, { items: next, updatedAt: Date.now() })
    await pushCanvas(memory.id, next)
  }
  onStep?.('Locking the title and cover')
  await updateDoc(doc(d, 'memories', memory.id), { e2ee: true, meta: await sealMeta(key, memory), title: PRIVATE_TITLE, cover: PRIVATE_COVER, updatedAt: Date.now() })
  window.dispatchEvent(new Event('mt-local-changed'))
  // readable files left in Supabase (their locked copies now exist): the owner of the project can delete these
  return fixes.flatMap((f) => (f.oldPath ? [f.oldPath] : []))
}

/* ---------- the key in the link ---------- */

/** the part of an invite link after "#k=", read once when the page opens */
export function keyFromHash(): string | null {
  const m = /[#&]k=([A-Za-z0-9_-]{40,})(?:&e=(\d+))?/.exec(window.location.hash)
  return m ? (m[2] ? `${m[1]}.${m[2]}` : m[1]) : null
}
const keep = (token: string) => `mt-invite-key:${token}`
/** remember the key for the length of this tab (a Google sign-in redirect reloads the page) and clear it from the address bar */
export function stashInviteKey(token: string) {
  const k = keyFromHash()
  if (k) {
    try { sessionStorage.setItem(keep(token), k) } catch { /* private mode */ }
    history.replaceState(null, '', window.location.pathname + window.location.search)
  }
}
export function takeInviteKey(token: string): string | null {
  try { return sessionStorage.getItem(keep(token)) } catch { return null }
}
export function dropInviteKey(token: string) { try { sessionStorage.removeItem(keep(token)) } catch { /* ignore */ } }

/**
 * Owner only, right after someone is removed from a private book: the book gets a new key, handed to everyone who is
 * left, and everything in the cloud is locked again with it. The person who was removed keeps only what they
 * already had; whatever is added from now on is out of their reach.
 * Returns the people who could not be handed the key yet (they have not opened the app since the update): the owner
 * sends them a fresh invite link, which carries the new key.
 */
export async function rotateBookKey(uid: string, memory: Memory, remaining: string[], onStep?: (what: string) => void): Promise<string[]> {
  const d = getDb()
  if (!d || !memory.e2ee) return []
  const oldKey = await getBookKey(memory.id)
  if (!oldKey) throw new Error('locked')
  await ensureIdentity(uid)
  const raw = await exportKey(await newBookKey())
  const newKey = await importKey(raw)
  const epoch = (memory.keyEpoch ?? 0) + 1
  onStep?.('Handing the new key to everyone left')
  const missed = await shareNewKey(uid, memory.id, raw, epoch, remaining)
  await rekeyCloud(memory.id, oldKey, newKey, onStep)
  await saveBookKey(uid, memory.id, raw, epoch)
  resetBookCache(memory.id)
  await db.memories.update(memory.id, { keyEpoch: epoch })
  await updateDoc(doc(d, 'memories', memory.id), { keyEpoch: epoch, updatedAt: Date.now() })
  return missed
}

/** A member's phone: the book has a newer key than this phone holds, so fetch it from the owner's hand-over. */
export async function catchUpKey(uid: string, memory: Memory): Promise<boolean> {
  if (!memory.e2ee || !memory.keyEpoch) return false
  const got = await takeNewKey(uid, memory.id, memory.keyEpoch)
  if (got) window.dispatchEvent(new CustomEvent('mt-rekeyed', { detail: memory.id }))
  return got
}
