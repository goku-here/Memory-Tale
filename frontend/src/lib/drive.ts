/**
 * Google Drive access with the narrow `drive.file` permission (the app only ever sees files it created).
 * Uses Google Identity Services for the access token and plain REST calls for files.
 * With VITE_DRIVE_MOCK=1 a local stand-in (IndexedDB) replaces Drive so the flows can be developed offline.
 */
import { db } from '../data/db'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY as string | undefined
export const driveMock = import.meta.env.VITE_DRIVE_MOCK === '1'
export const driveConfigured = driveMock || Boolean(CLIENT_ID && API_KEY)

const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const FOLDER_NAME = 'Memory Tale'
const KEY = { connected: 'mt-drive-connected', folder: 'mt-drive-folder', refresh: 'mt-drive-refresh', token: 'mt-drive-token' }

/* ---------- connection state ---------- */
export const isConnected = () => driveConfigured && localStorage.getItem(KEY.connected) === '1'

interface Token { value: string; exp: number }
let token: Token | null = null
let tokenClient: { requestAccessToken: (o?: { prompt?: string; hint?: string }) => void } | null = null
let pending: { resolve: (t: string | null) => void } | null = null

function loadGis(): Promise<void> {
  if ((window as unknown as { google?: unknown }).google && (window as unknown as { google: { accounts?: { oauth2?: unknown } } }).google.accounts?.oauth2) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('Could not load Google sign-in'))
    document.head.appendChild(s)
  })
}

async function client() {
  if (tokenClient) return tokenClient
  await loadGis()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (window as any).google
  tokenClient = g.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (r: { access_token?: string; expires_in?: number; error?: string }) => {
      if (r.access_token) {
        token = { value: r.access_token, exp: Date.now() + (r.expires_in ?? 3600) * 1000 - 60_000 }
        pending?.resolve(token.value)
      } else pending?.resolve(null)
      pending = null
    },
    error_callback: () => { pending?.resolve(null); pending = null },
  })
  return tokenClient!
}

/* ---------- staying connected: a refresh token, handled by /api/drive-token ---------- */
let codeFlow: boolean | null = null
/** is the little server function set up (it needs GOOGLE_CLIENT_SECRET)? Without it the older one-hour sign-in is used. */
async function codeFlowReady() {
  if (codeFlow !== null) return codeFlow
  try { const r = await fetch('/api/drive-token'); codeFlow = r.ok && (await r.json()).ready === true } catch { codeFlow = false }
  return codeFlow
}

const remember = (value: string, expiresIn?: number) => {
  token = { value, exp: Date.now() + (expiresIn ?? 3600) * 1000 - 60_000 }
  try { localStorage.setItem(KEY.token, JSON.stringify(token)) } catch { /* private mode */ }
  return value
}
function recall(): string | null {
  try {
    const t = JSON.parse(localStorage.getItem(KEY.token) || 'null') as Token | null
    if (t && t.exp > Date.now()) { token = t; return t.value }
  } catch { /* ignore */ }
  return null
}

async function viaRefresh(): Promise<string | null> {
  const rt = localStorage.getItem(KEY.refresh)
  if (!rt) return null
  try {
    const r = await fetch('/api/drive-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh', refresh_token: rt }) })
    if (r.status === 400) { localStorage.removeItem(KEY.refresh); return null } // revoked or expired: sign in once more
    if (!r.ok) return null
    const j = await r.json() as { access_token: string; expires_in?: number }
    return remember(j.access_token, j.expires_in)
  } catch { return null }
}

/** the one-time sign-in popup that gives the app a long-lived hold on the Drive folder */
async function connectWithCode(hint?: string): Promise<string | null> {
  await loadGis()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = (window as any).google
  const code = await new Promise<string | null>((resolve) => {
    const c = g.accounts.oauth2.initCodeClient({
      client_id: CLIENT_ID, scope: SCOPE, ux_mode: 'popup', hint,
      callback: (r: { code?: string }) => resolve(r.code ?? null),
      error_callback: () => resolve(null),
    })
    c.requestCode()
  })
  if (!code) return null
  try {
    const r = await fetch('/api/drive-token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'code', code }) })
    if (!r.ok) return null
    const j = await r.json() as { access_token: string; expires_in?: number; refresh_token?: string }
    if (j.refresh_token) localStorage.setItem(KEY.refresh, j.refresh_token)
    return remember(j.access_token, j.expires_in)
  } catch { return null }
}

/**
 * Returns a valid access token, or null if one cannot be had without the user
 * (interactive = true may open Google's permission popup, so call it from a tap).
 * With the server function set up the phone keeps a refresh token, so after the first sign-in this never asks again.
 */
export async function getToken(interactive = false, hint?: string): Promise<string | null> {
  if (driveMock) return 'mock'
  if (!driveConfigured) return null
  if (token && token.exp > Date.now()) return token.value
  const saved = recall()
  if (saved) return saved
  if (await codeFlowReady()) {
    const fresh = await viaRefresh()
    if (fresh) return fresh
    if (!interactive) return null
    return connectWithCode(hint)
  }
  // older way: a one-hour token from Google's popup (needs a tap)
  if (!interactive && !isConnected()) return null
  const c = await client()
  return new Promise((resolve) => {
    pending = { resolve }
    c.requestAccessToken({ prompt: interactive && !isConnected() ? 'consent' : '', hint })
  })
}

export async function connectDrive(hint?: string): Promise<boolean> {
  const t = await getToken(true, hint)
  if (t) localStorage.setItem(KEY.connected, '1')
  return !!t
}

export function disconnectDrive() {
  localStorage.removeItem(KEY.connected)
  localStorage.removeItem(KEY.refresh)
  localStorage.removeItem(KEY.token)
  localStorage.removeItem(KEY.folder)
  token = null
}

/* ---------- REST helpers ---------- */
const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const auth = (t: string) => ({ Authorization: `Bearer ${t}` })

export class DriveError extends Error {
  status: number
  constructor(status: number, msg: string) { super(msg); this.status = status }
}

async function check(res: Response) {
  if (!res.ok) throw new DriveError(res.status, `Drive ${res.status}: ${(await res.text().catch(() => '')).slice(0, 160)}`)
  return res
}

async function ensureFolder(t: string): Promise<string> {
  const cached = localStorage.getItem(KEY.folder)
  if (cached) {
    const r = await fetch(`${API}/files/${cached}?fields=id,trashed`, { headers: auth(t) })
    if (r.ok && !(await r.json()).trashed) return cached
  }
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const found = await (await check(await fetch(`${API}/files?q=${q}&fields=files(id)`, { headers: auth(t) }))).json()
  let id: string | undefined = found.files?.[0]?.id
  if (!id) {
    const created = await (await check(await fetch(`${API}/files?fields=id`, {
      method: 'POST', headers: { ...auth(t), 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    }))).json()
    id = created.id as string
  }
  localStorage.setItem(KEY.folder, id)
  return id
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'
const bookKey = (memoryId: string) => `mt-drive-book:${memoryId}`
const quote = (s: string) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

/**
 * The Drive folder of one book, inside "Memory Tale": found again later by the id this phone remembers, else by its
 * name, else created. If the book was renamed, the folder is renamed too.
 */
export async function ensureBookFolder(memoryId: string, title: string): Promise<string | undefined> {
  if (driveMock) return undefined
  const t = await getToken(false)
  if (!t) return undefined
  const name = (title || 'Untitled').replace(/[\\/]/g, '-').slice(0, 90)
  const root = await ensureFolder(t)
  try {
    const cached = localStorage.getItem(bookKey(memoryId))
    if (cached) {
      const r = await fetch(`${API}/files/${cached}?fields=id,name,trashed,parents`, { headers: auth(t) })
      if (r.ok) {
        const f = await r.json()
        if (!f.trashed) {
          if (f.name !== name) await fetch(`${API}/files/${cached}`, { method: 'PATCH', headers: { ...auth(t), 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
          return cached
        }
      }
    }
    const q = encodeURIComponent(`name='${quote(name)}' and '${root}' in parents and mimeType='${FOLDER_MIME}' and trashed=false`)
    const found = await (await check(await fetch(`${API}/files?q=${q}&fields=files(id)`, { headers: auth(t) }))).json()
    let id: string | undefined = found.files?.[0]?.id
    if (!id) {
      id = (await (await check(await fetch(`${API}/files?fields=id`, {
        method: 'POST', headers: { ...auth(t), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [root] }),
      }))).json()).id as string
    }
    localStorage.setItem(bookKey(memoryId), id)
    return id
  } catch (e) {
    if (e instanceof DriveError && e.status === 401) throw e
    return undefined // fall back to the main folder rather than failing the upload
  }
}

/** Moves one of the app's files into another folder of the app. */
export async function moveToFolder(fileId: string, folderId: string) {
  if (driveMock) return
  const t = await getToken(false)
  if (!t) return
  const info = await fetch(`${API}/files/${fileId}?fields=parents`, { headers: auth(t) })
  if (!info.ok) return
  const parents: string[] = (await info.json()).parents ?? []
  if (parents.includes(folderId)) return
  await fetch(`${API}/files/${fileId}?addParents=${folderId}${parents.length ? `&removeParents=${parents.join(',')}` : ''}`, { method: 'PATCH', headers: auth(t) })
}

/** Saves a file into a Drive folder (the book's, or the app's main one): resumable upload, fine for big photos. Returns the file id. */
export async function uploadToDrive(blob: Blob, name: string, mime: string, folderId?: string): Promise<string> {
  const t = await getToken(false)
  if (!t) throw new DriveError(401, 'Drive is not connected')
  if (driveMock) {
    const id = `mock-${crypto.randomUUID()}`
    await db.mockDrive.put({ id, blob, shared: false })
    return id
  }
  const folder = folderId ?? (await ensureFolder(t))
  const start = await check(await fetch(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
    method: 'POST',
    headers: { ...auth(t), 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(blob.size) },
    body: JSON.stringify({ name, parents: [folder], mimeType: mime }),
  }))
  const url = start.headers.get('Location')
  if (!url) throw new DriveError(500, 'Drive gave no upload address')
  const done = await check(await fetch(url, { method: 'PUT', headers: { 'Content-Type': mime }, body: blob }))
  return (await done.json()).id as string
}

/** "Anyone with the link can view" (the id is a long random string; this is what lets other members copy it). */
export async function shareByLink(fileId: string) {
  if (driveMock) { const r = await db.mockDrive.get(fileId); if (r) await db.mockDrive.put({ ...r, shared: true }); return }
  const t = await getToken(false)
  if (!t) throw new DriveError(401, 'Drive is not connected')
  await check(await fetch(`${API}/files/${fileId}/permissions`, {
    method: 'POST', headers: { ...auth(t), 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reader', type: 'anyone' }),
  }))
}

/** Download one of my own files. */
export async function downloadOwn(fileId: string): Promise<Blob | null> {
  if (driveMock) return (await db.mockDrive.get(fileId))?.blob ?? null
  const t = await getToken(false)
  if (!t) return null
  const r = await fetch(`${API}/files/${fileId}?alt=media`, { headers: auth(t) })
  return r.ok ? r.blob() : null
}

/** Download a file somebody shared by link (no sign-in needed, uses the public API key). */
export async function downloadShared(fileId: string): Promise<Blob | null> {
  if (driveMock) { const r = await db.mockDrive.get(fileId); return r?.shared ? r.blob : null }
  if (!API_KEY) return null
  const r = await fetch(`${API}/files/${fileId}?alt=media&key=${API_KEY}`)
  return r.ok ? r.blob() : null
}

/** Does my copy still exist (not deleted or in the bin)? null = could not tell (offline / no token). */
export async function myFileExists(fileId: string): Promise<boolean | null> {
  if (driveMock) return !!(await db.mockDrive.get(fileId))
  const t = await getToken(false)
  if (!t) return null
  try {
    const r = await fetch(`${API}/files/${fileId}?fields=id,trashed`, { headers: auth(t) })
    if (r.status === 404) return false
    if (!r.ok) return null
    return !(await r.json()).trashed
  } catch { return null }
}

/** Permanently delete one of my files (404 = already gone, which is fine). */
export async function deleteFromDrive(fileId: string) {
  if (driveMock) { await db.mockDrive.delete(fileId); return }
  const t = await getToken(false)
  if (!t) throw new DriveError(401, 'Drive is not connected')
  const r = await fetch(`${API}/files/${fileId}`, { method: 'DELETE', headers: auth(t) })
  if (!r.ok && r.status !== 404) throw new DriveError(r.status, `Drive ${r.status}`)
}
