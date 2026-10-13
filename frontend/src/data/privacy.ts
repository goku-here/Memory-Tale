/**
 * Turning a book private (end-to-end encrypted), and the key travelling in an invite link.
 *
 * The link looks like  https://…/join/<token>#k=<book key>.  Everything after the "#" stays in the browser: it is
 * never sent to any server, so only people who were given the link get the key.
 */
import { doc, updateDoc } from 'firebase/firestore'
import { exportKey, newBookKey } from '../lib/crypto'
import { getDb } from '../lib/firebase'
import type { CanvasItem, Memory } from '../types'
import { db } from './db'
import { getBookKey, getBookKeyRaw, saveBookKey } from './keys'
import { pushCanvas, resetBookCache, sealLeftovers } from './sync'

/** Owner only. Locks the book: new key, everything re-uploaded encrypted, readable copies removed from the cloud. */
export async function makeBookPrivate(uid: string, memory: Memory, onStep?: (what: string) => void) {
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
  // only now tell everyone the book is private
  await updateDoc(doc(d, 'memories', memory.id), { e2ee: true, updatedAt: Date.now() })
  window.dispatchEvent(new Event('mt-local-changed'))
}

/* ---------- the key in the link ---------- */

/** the part of an invite link after "#k=", read once when the page opens */
export function keyFromHash(): string | null {
  const m = /[#&]k=([A-Za-z0-9_-]{40,})/.exec(window.location.hash)
  return m ? m[1] : null
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
