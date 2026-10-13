import { motion } from 'framer-motion'
import { Check, Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import { getFirebaseAuth } from '../lib/firebase'
import { useAuth } from '../data/useAuth'

const KINDS = [
  { id: 'idea', emoji: '💡', label: 'An idea' },
  { id: 'problem', emoji: '🐞', label: 'A problem' },
  { id: 'other', emoji: '💬', label: 'Something else' },
] as const
const MAILTO = 'gokulkrishnanu019@gmail.com'

/** A small form: what kind of message, what to say, and (optionally) where to reply. It goes straight to the owner's inbox. */
export function FeedbackForm({ accent }: { accent: string }) {
  const { user } = useAuth()
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('idea')
  const [message, setMessage] = useState('')
  const [reply, setReply] = useState(true)
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('') // hidden: only a bot fills it
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')
  const [why, setWhy] = useState('')

  const device = `${navigator.userAgent.slice(0, 120)} · ${window.innerWidth}x${window.innerHeight}`
  const replyTo = user ? (reply ? user.email : '') : email.trim()

  const send = async () => {
    if (message.trim().length < 3 || state === 'sending') return
    setState('sending')
    try {
      const idToken = await getFirebaseAuth()?.currentUser?.getIdToken().catch(() => undefined)
      const r = await fetch('/api/feedback', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, message, replyTo, name: user?.name, build: typeof __BUILD__ === 'string' ? __BUILD__ : '', device, idToken, website }),
      })
      if (r.status === 501) {
        // the mail service is not set up yet: hand the message to the person's own mail app instead
        const subject = encodeURIComponent(`[Memory Tale] ${KINDS.find((k) => k.id === kind)?.label}`)
        window.location.href = `mailto:${MAILTO}?subject=${subject}&body=${encodeURIComponent(message)}`
        setState('idle')
        return
      }
      if (!r.ok) { const j = await r.json().catch(() => null) as { error?: string; detail?: string } | null; setWhy(j?.detail || j?.error || `error ${r.status}`) }
      setState(r.ok ? 'sent' : 'failed')
    } catch { setWhy('no connection to the server'); setState('failed') }
  }

  if (state === 'sent') {
    return (
      <div className="grid place-items-center gap-3 rounded-3xl bg-neutral-50 px-6 py-10 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full text-white" style={{ background: accent }}><Check size={28} strokeWidth={3} /></span>
        <div className="text-[18px] font-extrabold text-[#17171a]">Thank you!</div>
        <p className="m-0 text-[14px] leading-snug text-neutral-500">Your message is on its way to us. We read every one.</p>
        <button type="button" onClick={() => { setMessage(''); setState('idle') }} className="mt-1 h-11 rounded-full border-0 bg-white px-6 text-[14px] font-bold text-[#17171a] shadow-[0_0_0_1px_rgba(0,0,0,.08)]">Send another</button>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-6">
      <p className="m-0 mb-6 px-1 text-[14.5px] leading-snug text-neutral-600">What would make Memory Tale better for you? Tell us in your own words. It goes straight to us.</p>
      <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="What kind of message">
        {KINDS.map((k) => (
          <button
            key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)}
            className="flex h-16 flex-col items-center justify-center gap-0.5 rounded-2xl border-0 text-[12.5px] font-bold"
            style={kind === k.id ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#55555f' }}
          ><span className="text-[20px] leading-none">{k.emoji}</span>{k.label}</button>
        ))}
      </div>
      <textarea
        value={message} onChange={(e) => setMessage(e.target.value)} maxLength={2000} rows={6} aria-label="Your message"
        placeholder={kind === 'problem' ? 'What went wrong? What were you doing when it happened?' : 'I wish I could…'}
        className="w-full resize-none rounded-2xl border-0 bg-[#f1f1f3] px-4 py-3.5 text-[16px] leading-snug text-[#17171a] outline-none placeholder:text-neutral-400"
      />
      {/* a hidden field that only bots fill in */}
      <input value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="absolute -left-[9999px] h-0 w-0 opacity-0" />

      {user ? (
        <button type="button" role="switch" aria-checked={reply} onClick={() => setReply((v) => !v)} className="flex min-h-12 w-full items-center gap-3 rounded-2xl border-0 bg-transparent px-1 text-left">
          <span className="min-w-0 flex-1">
            <span className="block text-[14.5px] font-bold text-[#17171a]">You can reply to me</span>
            <span className="block truncate text-[12.5px] text-neutral-500">{user.email}</span>
          </span>
          <span className="relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: reply ? '#17171a' : '#d4d4da' }}>
            <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: reply ? 22 : 2 }} />
          </span>
        </button>
      ) : (
        <input
          value={email} onChange={(e) => setEmail(e.target.value)} type="email" inputMode="email" autoComplete="email" placeholder="Your email, if you'd like a reply (optional)" aria-label="Your email"
          className="h-12 w-full rounded-2xl border-0 bg-[#f1f1f3] px-4 text-[15px] text-[#17171a] outline-none placeholder:text-neutral-400"
        />
      )}

      {state === 'failed' && (
        <p role="alert" className="m-0 text-[13px] font-semibold text-[#d6455d]">
          Couldn&apos;t send it just now. Check your connection and try again, or <a href={`mailto:${MAILTO}`} className="text-[#d6455d]">email the developer</a>.
          {why && <span className="mt-1 block text-[11.5px] font-medium opacity-80">Reason: {why}</span>}
        </p>
      )}
      <motion.button
        type="button" whileTap={{ scale: 0.97 }} disabled={message.trim().length < 3 || state === 'sending'} onClick={() => void send()}
        className="flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-full border-0 bg-[#17171a] text-[15.5px] font-semibold text-white disabled:opacity-35"
      >
        {state === 'sending' ? <Loader2 size={18} className="animate-spin" /> : <Send size={17} />} {state === 'sending' ? 'Sending…' : 'Send'}
      </motion.button>
      <p className="m-0 text-center text-[11.5px] text-neutral-400">We also include your app version and device type to help us.</p>
    </div>
  )
}
