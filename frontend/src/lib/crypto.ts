/**
 * End-to-end encryption helpers (Web Crypto only, nothing is sent anywhere).
 *
 *  - every private book has its own random AES-256-GCM key
 *  - what goes to the cloud for that book is `e1.<base64 of iv + ciphertext>`
 *  - the person's recovery code never leaves the phone: it is stretched with PBKDF2 into a "vault key" that locks
 *    a backup copy of each book key (so a new phone can get them back after typing the code)
 */

const enc = new TextEncoder()
const dec = new TextDecoder()

/* ---------- base64 ---------- */
function toB64(u: Uint8Array) {
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}
function fromB64(s: string) {
  const bin = atob(s)
  const u = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i)
  return u
}
/** url-safe, no padding: for keys that travel in a link */
export const b64u = (u: Uint8Array) => toB64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export const unb64u = (s: string) => fromB64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))

/* ---------- book keys ---------- */
export const newBookKey = () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
export const exportKey = async (k: CryptoKey) => b64u(new Uint8Array(await crypto.subtle.exportKey('raw', k)))
export const importKey = (raw: string) => crypto.subtle.importKey('raw', unb64u(raw), 'AES-GCM', true, ['encrypt', 'decrypt'])

export const isEncrypted = (v: unknown): v is string => typeof v === 'string' && v.startsWith('e1.')

export async function encryptText(key: CryptoKey, text: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)))
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv); out.set(ct, iv.length)
  return 'e1.' + toB64(out)
}

export async function decryptText(key: CryptoKey, packed: string): Promise<string> {
  const all = fromB64(packed.slice(3))
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) }, key, all.subarray(12))
  return dec.decode(pt)
}

/* ---------- the person's recovery code ---------- */
// no 0/O/1/I/L/U: easy to read out and to type
const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'

/** 25 characters in five groups of five (about 120 bits) */
export function makeRecoveryCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(25))
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length])
  return Array.from({ length: 5 }, (_, i) => chars.slice(i * 5, i * 5 + 5).join('')).join('-')
}
export const normaliseCode = (c: string) => c.toUpperCase().replace(/[^A-Z0-9]/g, '')

export const newSalt = () => b64u(crypto.getRandomValues(new Uint8Array(16)))

/** the code, slowed down on purpose, becomes the key that locks the backup of the book keys */
export async function vaultKeyFromCode(code: string, salt: string) {
  const base = await crypto.subtle.importKey('raw', enc.encode(normaliseCode(code)), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: unb64u(salt), iterations: 250_000 }, base, 256)
  return importKey(b64u(new Uint8Array(bits)))
}

/* ---------- original photos: each file gets its own key ---------- */
export const newFileKey = () => b64u(crypto.getRandomValues(new Uint8Array(32)))

/** iv + ciphertext, as one blob: this is all the cloud ever receives */
export async function sealBlob(rawKey: string, blob: Blob): Promise<Blob> {
  const k = await importKey(rawKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, await blob.arrayBuffer()))
  const out = new Uint8Array(iv.length + ct.length)
  out.set(iv); out.set(ct, iv.length)
  return new Blob([out], { type: 'application/octet-stream' })
}

export async function openBlob(rawKey: string, sealed: Blob, type = 'image/jpeg'): Promise<Blob> {
  const k = await importKey(rawKey)
  const all = new Uint8Array(await sealed.arrayBuffer())
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: all.subarray(0, 12) }, k, all.subarray(12))
  return new Blob([pt], { type })
}

/* ---------- a key pair per person: hand a book key to one person without anything else seeing it ---------- */
export const newIdentity = () => crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])
export const exportJwk = async (k: CryptoKey) => JSON.stringify(await crypto.subtle.exportKey('jwk', k))
export const importPublic = (jwk: string) => crypto.subtle.importKey('jwk', JSON.parse(jwk), { name: 'ECDH', namedCurve: 'P-256' }, true, [])
export const importPrivate = (jwk: string) => crypto.subtle.importKey('jwk', JSON.parse(jwk), { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey'])

const pairKey = (mine: CryptoKey, theirs: CryptoKey) =>
  crypto.subtle.deriveKey({ name: 'ECDH', public: theirs }, mine, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])

/** lock a book key so only the person with the matching private key can open it */
export async function giveKey(myPrivate: CryptoKey, theirPublic: CryptoKey, rawBookKey: string) {
  return encryptText(await pairKey(myPrivate, theirPublic), rawBookKey)
}
export async function takeKey(myPrivate: CryptoKey, theirPublic: CryptoKey, packed: string) {
  return decryptText(await pairKey(myPrivate, theirPublic), packed)
}
