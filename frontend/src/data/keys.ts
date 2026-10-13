/**
 * Keys for private (end-to-end encrypted) books.
 *
 *  - each private book has a key, kept on this phone (IndexedDB)
 *  - the person also has a recovery code, shown once. It never leaves the phone; it is stretched into a "vault key"
 *    that locks a backup of every book key in the cloud (users/{uid}/keys/{bookId}), so a new phone can get them
 *    back by typing the code
 *  - every 30 days the app asks for the code again so it does not get forgotten
 */
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { decryptText, encryptText, exportKey, importKey, makeRecoveryCode, newSalt, vaultKeyFromCode } from '../lib/crypto'
import { getDb } from '../lib/firebase'
import { db } from './db'

const CHECK_TEXT = 'memory-tale-vault-v1'
const bookKeys = new Map<string, CryptoKey>()
let vaultKey: CryptoKey | null = null

const meta = {
  get: async (k: string) => (await db.meta.get(k))?.value as string | undefined,
  set: (k: string, value: string) => db.meta.put({ key: k, value }),
  del: (k: string) => db.meta.delete(k),
}

/* ---------- book keys ---------- */

export async function getBookKey(memoryId: string): Promise<CryptoKey | null> {
  const hit = bookKeys.get(memoryId)
  if (hit) return hit
  const row = await db.keys.get(memoryId)
  if (!row) return null
  const k = await importKey(row.raw)
  bookKeys.set(memoryId, k)
  return k
}
export async function getBookKeyRaw(memoryId: string) { return (await db.keys.get(memoryId))?.raw ?? null }

/** keep a book's key on this phone, and in the person's cloud backup when their recovery code is set up */
export async function saveBookKey(uid: string | undefined, memoryId: string, raw: string) {
  await db.keys.put({ memoryId, raw })
  bookKeys.set(memoryId, await importKey(raw))
  window.dispatchEvent(new CustomEvent('mt-key', { detail: memoryId }))
  if (uid) await backupBookKey(uid, memoryId, raw).catch(() => {})
}

async function backupBookKey(uid: string, memoryId: string, raw: string) {
  const d = getDb()
  const vk = await loadVaultKey()
  if (!d || !vk) return
  await setDoc(doc(d, 'users', uid, 'keys', memoryId), { wrapped: await encryptText(vk, raw), at: Date.now() })
}

/* ---------- the vault (recovery code) ---------- */

async function loadVaultKey() {
  if (vaultKey) return vaultKey
  const raw = await meta.get('vaultKey')
  if (raw) vaultKey = await importKey(raw)
  return vaultKey
}

export type VaultState = 'unknown' | 'none' | 'locked' | 'ready'

/** none: no recovery code yet · locked: there is one in the cloud but this phone does not have it · ready: this phone has it */
export async function vaultState(uid: string): Promise<VaultState> {
  const d = getDb()
  if (!d) return 'unknown'
  if (await loadVaultKey()) {
    if ((await meta.get('vaultUid')) === uid) return 'ready'
  }
  try {
    const snap = await getDoc(doc(d, 'users', uid))
    return snap.exists() && snap.data().vault ? 'locked' : 'none'
  } catch { return 'unknown' }
}

/** Makes the person's recovery code and the backup of every key this phone holds. Returns the code to show once. */
export async function createVault(uid: string): Promise<string> {
  const d = getDb()
  if (!d) throw new Error('Cloud is not configured')
  const code = makeRecoveryCode()
  await installVault(uid, code, newSalt())
  return code
}

async function installVault(uid: string, code: string, salt: string) {
  const d = getDb()!
  const vk = await vaultKeyFromCode(code, salt)
  await setDoc(doc(d, 'users', uid), { vault: { salt, check: await encryptText(vk, CHECK_TEXT) }, updatedAt: Date.now() }, { merge: true })
  vaultKey = vk
  await meta.set('vaultKey', await exportKey(vk))
  await meta.set('vaultUid', uid)
  await meta.set('codeAskedAt', String(Date.now()))
  // back up every book key this phone has
  for (const row of await db.keys.toArray()) await backupBookKey(uid, row.memoryId, row.raw).catch(() => {})
}

async function codeKey(uid: string, code: string): Promise<{ vk: CryptoKey; salt: string } | null> {
  const d = getDb()
  if (!d) return null
  const snap = await getDoc(doc(d, 'users', uid))
  const v = snap.data()?.vault as { salt: string; check: string } | undefined
  if (!v) return null
  try {
    const vk = await vaultKeyFromCode(code, v.salt)
    return (await decryptText(vk, v.check)) === CHECK_TEXT ? { vk, salt: v.salt } : null
  } catch { return null }
}

/** New phone (or a wiped one): the right code brings back every book key. */
export async function unlockVault(uid: string, code: string): Promise<boolean> {
  const d = getDb()
  const ck = await codeKey(uid, code)
  if (!d || !ck) return false
  vaultKey = ck.vk
  await meta.set('vaultKey', await exportKey(ck.vk))
  await meta.set('vaultUid', uid)
  await meta.set('codeAskedAt', String(Date.now()))
  const snap = await getDocs(collection(d, 'users', uid, 'keys'))
  for (const x of snap.docs) {
    try {
      const raw = await decryptText(ck.vk, x.data().wrapped as string)
      await db.keys.put({ memoryId: x.id, raw })
      bookKeys.set(x.id, await importKey(raw))
      window.dispatchEvent(new CustomEvent('mt-key', { detail: x.id }))
    } catch { /* a key that cannot be read is skipped */ }
  }
  return true
}

/** The regular "type your code" check. Right code: the clock restarts. */
export async function verifyCode(uid: string, code: string): Promise<boolean> {
  const ok = !!(await codeKey(uid, code))
  if (ok) await meta.set('codeAskedAt', String(Date.now()))
  return ok
}

/** Lost the code but still signed in on a phone with the keys: make a new one (the old one stops working). */
export async function replaceCode(uid: string): Promise<string> {
  const code = makeRecoveryCode()
  await installVault(uid, code, newSalt())
  return code
}

const DAYS = 30
/** has it been about a month since the person last typed the code? (people who never set one up are never asked) */
export async function codeCheckDue(uid: string): Promise<boolean> {
  if ((await meta.get('vaultUid')) !== uid) return false
  const at = Number(await meta.get('codeAskedAt')) || 0
  return Date.now() - at > DAYS * 86_400_000
}
export const snoozeCodeCheck = () => meta.set('codeAskedAt', String(Date.now() - (DAYS - 3) * 86_400_000))

/** Signing out wipes what this phone knows about the vault and the keys. */
export async function forgetKeys() {
  bookKeys.clear()
  vaultKey = null
  await db.keys.clear().catch(() => {})
  await db.meta.clear().catch(() => {})
}
