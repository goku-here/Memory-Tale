/**
 * Keeps Google Drive connected without asking again.
 *
 * Google only hands out long-lived "refresh tokens" to a server that knows the app's client secret, so this tiny
 * function does the two exchanges and nothing else (it stores nothing):
 *
 *   GET  /api/drive-token                      -> { ready: true } when GOOGLE_CLIENT_SECRET is set
 *   POST /api/drive-token {action:'code'}      -> trades the one-time code from the sign-in popup for tokens
 *   POST /api/drive-token {action:'refresh'}   -> trades a refresh token for a fresh one-hour access token
 *
 * Needs the environment variable GOOGLE_CLIENT_SECRET (and VITE_GOOGLE_CLIENT_ID, which the app already has).
 * The phone keeps the refresh token; it only reaches Drive files this app created (the `drive.file` scope).
 */

interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface Res { status: (n: number) => Res; json: (b: unknown) => void; setHeader: (k: string, v: string) => void }

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

export default async function handler(req: Req, res: Res) {
  const secret = process.env.GOOGLE_CLIENT_SECRET
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') return res.status(200).json({ ready: Boolean(secret && clientId) })
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })
  if (!secret || !clientId) return res.status(501).json({ error: 'not-configured' })

  // only this site's own pages may use it
  const origin = String(req.headers.origin ?? '')
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '')
  if (origin && !origin.endsWith(`//${host}`)) return res.status(403).json({ error: 'origin' })

  const b = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as { action?: string; code?: string; refresh_token?: string } | undefined
  const form = new URLSearchParams({ client_id: clientId, client_secret: secret })
  if (b?.action === 'code' && b.code) { form.set('grant_type', 'authorization_code'); form.set('code', b.code); form.set('redirect_uri', 'postmessage') }
  else if (b?.action === 'refresh' && b.refresh_token) { form.set('grant_type', 'refresh_token'); form.set('refresh_token', b.refresh_token) }
  else return res.status(400).json({ error: 'bad-request' })

  try {
    const r = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form })
    const j = (await r.json()) as { access_token?: string; expires_in?: number; refresh_token?: string; error?: string }
    if (!r.ok || !j.access_token) return res.status(r.status === 400 || r.status === 401 ? 400 : 502).json({ error: j.error ?? 'google' })
    return res.status(200).json({ access_token: j.access_token, expires_in: j.expires_in, refresh_token: j.refresh_token })
  } catch {
    return res.status(502).json({ error: 'network' })
  }
}
