/**
 * Sends an idea or a problem report from the app straight to the owner's inbox.
 *
 *   POST /api/feedback  { kind, message, replyTo?, name?, build?, device?, idToken?, website? }
 *
 * Needs the environment variable RESEND_API_KEY (a free key from resend.com). Mail goes to FEEDBACK_TO
 * (default: the contact address in the privacy policy). The function stores nothing.
 */

interface Req { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown }
interface Res { status: (n: number) => Res; json: (b: unknown) => void; setHeader: (k: string, v: string) => void }

const KINDS: Record<string, string> = { idea: 'Idea', problem: 'Problem', other: 'Message' }

export default async function handler(req: Req, res: Res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' })

  const key = process.env.RESEND_API_KEY
  if (!key) return res.status(501).json({ error: 'not-configured' })

  // only this site's own pages may use it
  const origin = String(req.headers.origin ?? '')
  const host = String(req.headers['x-forwarded-host'] ?? req.headers.host ?? '')
  if (origin && !origin.endsWith(`//${host}`)) return res.status(403).json({ error: 'origin' })

  let b: Record<string, unknown>
  try { b = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown> } catch { return res.status(400).json({ error: 'bad-request' }) }
  if (!b || typeof b !== 'object') return res.status(400).json({ error: 'bad-request' })
  if (b.website) return res.status(200).json({ ok: true }) // a bot filled the hidden field: pretend it worked

  const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const message = text(b.message, 2000)
  if (message.length < 3) return res.status(400).json({ error: 'empty' })
  const kind = KINDS[text(b.kind, 10)] ?? 'Message'

  // who it is from: the verified Google account when the person is signed in, otherwise only what they typed
  let who = ''
  let replyTo = text(b.replyTo, 200)
  const idToken = text(b.idToken, 4000)
  const apiKey = process.env.VITE_FIREBASE_API_KEY
  if (idToken && apiKey) {
    try {
      const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) })
      const u = r.ok ? ((await r.json()) as { users?: { email?: string; displayName?: string; localId?: string }[] }).users?.[0] : undefined
      if (u) who = `${u.displayName ?? ''} <${u.email ?? ''}> (verified Google account ${u.localId ?? ''})`
    } catch { /* unverified */ }
  }
  if (!who) who = `${text(b.name, 80) || 'Someone'} (not verified)`
  if (replyTo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) replyTo = ''

  const body = [
    message, '', '--',
    `From: ${who}`,
    `Reply to: ${replyTo || 'they chose not to share an email'}`,
    `App build: ${text(b.build, 60)}`,
    `Device: ${text(b.device, 200)}`,
  ].join('\n')

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.FEEDBACK_FROM || 'Memory Tale <onboarding@resend.dev>',
        to: [process.env.FEEDBACK_TO || 'gokulkrishnanu019@gmail.com'],
        subject: `[Memory Tale] ${kind}: ${message.replace(/\s+/g, ' ').slice(0, 60)}`,
        text: body,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    })
    if (!r.ok) {
      const j = (await r.json().catch(() => ({}))) as { message?: string; name?: string }
      return res.status(502).json({ error: 'mail', detail: String(j.message ?? j.name ?? r.status).slice(0, 200) })
    }
    return res.status(200).json({ ok: true })
  } catch {
    return res.status(502).json({ error: 'network' })
  }
}
