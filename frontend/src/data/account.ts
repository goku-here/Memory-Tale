import { disconnectDrive } from '../lib/drive'
import { db } from './db'

/**
 * Books are kept on the device so the app works offline, so signing out (or signing in as someone else)
 * has to clear them: they belong to the account, and stay safe in the cloud.
 */
const LAST = 'mt-last-uid'
const PER_BOOK = ['mt-copy:', 'mt-asked:', 'mt-discard:', 'mt-story-y:']

/** Remove this account's books, photos and Drive link from the device. */
export async function wipeLocalAccount() {
  await Promise.all([db.memories.clear(), db.canvases.clear(), db.assets.clear(), db.uploads.clear()])
  for (const k of Object.keys(localStorage)) if (PER_BOOK.some((p) => k.startsWith(p))) localStorage.removeItem(k)
  disconnectDrive()
  localStorage.removeItem(LAST)
  window.dispatchEvent(new Event('mt-local-changed'))
}

/**
 * Called when someone signs in. If it is a different person than last time, books that came from the other
 * account are removed first; books made on this device before any sign-in (no owner yet) stay and are adopted.
 */
export async function adoptAccount(uid: string) {
  const last = localStorage.getItem(LAST)
  if (last !== uid) {
    for (const m of await db.memories.toArray()) {
      if ((m.ownerId || m.memberIds) && !(m.memberIds ?? []).includes(uid)) {
        await db.memories.delete(m.id)
        await db.canvases.delete(m.id)
      }
    }
    await db.uploads.clear()
    disconnectDrive()
    window.dispatchEvent(new Event('mt-local-changed'))
  }
  localStorage.setItem(LAST, uid)
}
