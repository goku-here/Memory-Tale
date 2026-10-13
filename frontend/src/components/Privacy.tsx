import { motion } from 'framer-motion'
import { Check, Copy, Loader2, Lock, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { codeCheckDue, createVault, replaceCode, snoozeCodeCheck, unlockVault, vaultState, verifyCode, type VaultState } from '../data/keys'
import { makeBookPrivate } from '../data/privacy'
import { hydrateMeta, reportError } from '../data/sync'
import { useAuth } from '../data/useAuth'
import { normaliseCode } from '../lib/crypto'
import type { Memory } from '../types'
import { ToolSheet } from './ToolSheet'
import { toast } from './ui'

/** shows what is typed as XXXXX-XXXXX-XXXXX-XXXXX-XXXXX */
const pretty = (v: string) => (normaliseCode(v).slice(0, 25).match(/.{1,5}/g) ?? []).join('-')

function CodeField({ value, onChange, onEnter }: { value: string; onChange: (v: string) => void; onEnter?: () => void }) {
  return (
    <input
      value={value} onChange={(e) => onChange(pretty(e.target.value))} onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
      inputMode="text" autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" aria-label="Recovery code"
      className="h-14 w-full rounded-2xl border-0 bg-[#f1f1f3] px-4 text-center font-mono text-[15px] font-bold tracking-wider text-[#17171a] outline-none placeholder:font-medium placeholder:text-neutral-400"
    />
  )
}

/** the one place the code is ever shown */
function ShowCode({ code, accent, onSaved, busy }: { code: string; accent: string; onSaved: () => void; busy?: boolean }) {
  const [saved, setSaved] = useState(false)
  const copy = async () => { try { await navigator.clipboard.writeText(code); toast('Code copied') } catch { toast('Could not copy: write it down instead') } }
  const share = async () => { try { await navigator.share?.({ title: 'Memory Tale recovery code', text: code }) } catch { /* cancelled */ } }
  return (
    <div className="space-y-3 px-5 pb-6">
      <p className="m-0 text-[14.5px] leading-snug text-neutral-600">
        This is your <b>recovery code</b>. It is the only way to open your private books on a new phone. We cannot see it and we cannot get it back for you, so save it now: a password manager, a note to yourself, or paper.
      </p>
      <div className="rounded-2xl bg-[#f1f1f3] px-4 py-5 text-center font-mono text-[18px] font-extrabold leading-snug tracking-wider text-[#17171a]" style={{ wordBreak: 'break-all' }}>{code}</div>
      <div className="flex gap-2">
        <button type="button" onClick={() => void copy()} className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border-0 bg-neutral-100 text-[14px] font-bold text-[#17171a]"><Copy size={16} /> Copy</button>
        {typeof navigator.share === 'function' && <button type="button" onClick={() => void share()} className="h-11 flex-1 rounded-full border-0 bg-neutral-100 text-[14px] font-bold text-[#17171a]">Save or send to myself</button>}
      </div>
      <button type="button" role="checkbox" aria-checked={saved} onClick={() => setSaved((v) => !v)} className="flex min-h-11 w-full items-center gap-3 rounded-2xl border-0 bg-transparent px-1 text-left text-[14.5px] font-semibold text-[#17171a]">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md" style={saved ? { background: accent, color: '#fff' } : { boxShadow: 'inset 0 0 0 2px #c9c9d2' }}>{saved && <Check size={15} strokeWidth={3.4} />}</span>
        I saved my recovery code somewhere safe
      </button>
      <motion.button
        type="button" whileTap={{ scale: 0.97 }} disabled={!saved || busy} onClick={onSaved}
        className="flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-full border-0 bg-[#17171a] text-[15.5px] font-semibold text-white disabled:opacity-35"
      >{busy ? <Loader2 size={18} className="animate-spin" /> : <Lock size={17} />} Continue</motion.button>
    </div>
  )
}

/** Make a book private, see its state, and manage the recovery code. */
export function PrivacySheet({ open, onClose, memory, accent }: { open: boolean; onClose: () => void; memory: Memory; accent: string }) {
  const { user } = useAuth()
  const isOwner = !!user && (memory.ownerId ?? user.uid) === user.uid
  const [vault, setVault] = useState<VaultState>('unknown')
  const [step, setStep] = useState<'info' | 'enter' | 'code' | 'working' | 'done'>('info')
  const [code, setCode] = useState('')
  const [typed, setTyped] = useState('')
  const [what, setWhat] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [checked, setChecked] = useState<'' | 'ok' | 'bad'>('')
  /** readable files that are still in Supabase after their locked copies were made */
  const [oldPaths, setOldPaths] = useState<string[]>([])

  useEffect(() => {
    if (!open || !user) return
    setStep('info'); setCode(''); setTyped(''); setErr(''); setChecked(''); setOldPaths([])
    void vaultState(user.uid).then(setVault)
  }, [open, user])

  const lockBook = useCallback(async () => {
    if (!user) return
    setStep('working'); setErr('')
    try {
      const old = await makeBookPrivate(user.uid, memory, setWhat)
      if (old.length) { setOldPaths(old); setStep('done') } else { toast('This book is now private'); onClose() }
    } catch (e) {
      reportError(e)
      const c = (e as { code?: string }).code
      setErr(c === 'permission-denied' ? 'The cloud rules need updating first: publish the latest backend/firestore.rules in Firebase, then try again.' : "Something went wrong while locking the book. Nothing was lost: try again.")
      setStep('info')
    }
  }, [user, memory, onClose])

  const start = async () => {
    if (!user) return
    setErr('')
    if (vault === 'none') {
      setBusy(true)
      try { setCode(await createVault(user.uid)); setVault('ready'); setStep('code') } catch (e) { reportError(e); setErr('Could not set up the recovery code. Check your connection and the Firebase rules.') } finally { setBusy(false) }
    } else if (vault === 'locked') setStep('enter')
    else void lockBook()
  }

  const submitCode = async () => {
    if (!user) return
    setBusy(true); setErr('')
    try {
      if (await unlockVault(user.uid, typed)) { setVault('ready'); void lockBook() } else setErr('That code does not match. Check it and try again.')
    } finally { setBusy(false) }
  }

  const check = async () => {
    if (!user) return
    setBusy(true)
    setChecked((await verifyCode(user.uid, typed)) ? 'ok' : 'bad')
    setBusy(false)
  }
  const newCode = async () => {
    if (!user) return
    setBusy(true)
    try { setCode(await replaceCode(user.uid)); setStep('code') } catch (e) { reportError(e); setErr('Could not make a new code.') } finally { setBusy(false) }
  }

  return (
    <ToolSheet open={open} onClose={onClose} title="Privacy" snaps={[0.7, 0.94]} z={70}>
      {!user ? (
        <p className="m-0 px-6 py-8 text-center text-[14.5px] text-neutral-500">Sign in to use private books.</p>
      ) : step === 'code' ? (
        <ShowCode code={code} accent={accent} busy={false} onSaved={() => (memory.e2ee ? (toast('New recovery code saved'), onClose()) : void lockBook())} />
      ) : step === 'done' ? (
        <div className="space-y-3 px-5 pb-6">
          <div className="flex items-center gap-3 rounded-2xl bg-[#eaf6ee] p-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#2db574] text-white"><ShieldCheck size={22} /></span>
            <div className="text-[15.5px] font-extrabold text-[#17171a]">This book is now private</div>
          </div>
          <p className="m-0 text-[13.5px] leading-snug text-neutral-600">
            {oldPaths.length} of its full-quality photos used to be stored readable in Supabase. Locked copies now exist, so the old ones can be deleted. Only the person who runs the Supabase project can do that: open Storage → Originals and delete these files.
          </p>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(oldPaths.join(String.fromCharCode(10))).then(() => toast('List copied')).catch(() => toast('Could not copy')) }} className="flex h-11 w-full items-center justify-center gap-2 rounded-full border-0 bg-neutral-100 text-[14px] font-bold text-[#17171a]"><Copy size={16} /> Copy the list of old files</button>
          <button type="button" onClick={onClose} className="h-12 w-full rounded-full border-0 bg-[#17171a] text-[15px] font-semibold text-white">Done</button>
        </div>
      ) : step === 'working' ? (
        <div className="grid place-items-center gap-3 px-6 py-12 text-center">
          <Loader2 size={30} className="animate-spin" style={{ color: accent }} />
          <div className="text-[15px] font-extrabold text-[#17171a]">{what || 'Locking this book…'}</div>
          <p className="m-0 text-[13px] text-neutral-500">Keep the app open. A big book can take a minute.</p>
        </div>
      ) : step === 'enter' ? (
        <div className="space-y-3 px-5 pb-6">
          <p className="m-0 text-[14.5px] leading-snug text-neutral-600">You already have a recovery code from another phone. Type it to continue.</p>
          <CodeField value={typed} onChange={setTyped} onEnter={() => void submitCode()} />
          {err && <p role="alert" className="m-0 text-[13px] font-semibold text-[#d6455d]">{err}</p>}
          <motion.button type="button" whileTap={{ scale: 0.97 }} disabled={busy || normaliseCode(typed).length < 25} onClick={() => void submitCode()} className="h-12 w-full rounded-full border-0 bg-[#17171a] text-[15px] font-semibold text-white disabled:opacity-35">
            {busy ? 'Checking…' : 'Continue'}
          </motion.button>
        </div>
      ) : (
        <div className="space-y-4 px-5 pb-6">
          <div className="flex items-center gap-3 rounded-2xl p-3.5" style={{ background: memory.e2ee ? '#eaf6ee' : '#f6f6f8' }}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ background: memory.e2ee ? '#2db574' : '#d9d9e0', color: '#fff' }}>{memory.e2ee ? <ShieldCheck size={22} /> : <Lock size={20} />}</span>
            <div>
              <div className="text-[15.5px] font-extrabold text-[#17171a]">{memory.e2ee ? 'This book is private' : 'This book is not private yet'}</div>
              <div className="text-[13px] leading-snug text-neutral-500">{memory.e2ee ? 'Its pictures and layout are locked. Only the people in the book can open them.' : 'Its pictures and layout are stored so the service can technically read them.'}</div>
            </div>
          </div>

          {!memory.e2ee ? (
            isOwner ? (
              <>
                <ul className="m-0 list-none space-y-2 p-0 text-[13.5px] leading-snug text-neutral-600">
                  <li>• Photos and the page layout are locked on your phone before they go to the cloud, so nobody else, not even us, can read them.</li>
                  <li>• People you invite with a link get the key inside the link. They do not type any code.</li>
                  <li>• You get a <b>recovery code</b> to open your private books on a new phone. We ask for it now and then so you do not forget it. If you lose both your phone and the code, the book cannot be recovered.</li>
                  <li>• The title, cover and the full-quality originals (Google Drive or Supabase) are locked too.</li>
                </ul>
                {err && <p role="alert" className="m-0 text-[13px] font-semibold text-[#d6455d]">{err}</p>}
                <motion.button type="button" whileTap={{ scale: 0.97 }} disabled={busy || vault === 'unknown'} onClick={() => void start()} className="flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-full border-0 bg-[#17171a] text-[15.5px] font-semibold text-white disabled:opacity-35">
                  {busy ? <Loader2 size={18} className="animate-spin" /> : <Lock size={17} />} Make this book private
                </motion.button>
              </>
            ) : <p className="m-0 text-[13.5px] text-neutral-500">Only the owner can make this book private.</p>
          ) : (
            <div className="space-y-3">
              <div className="text-[13px] font-extrabold uppercase tracking-wider text-neutral-400">Your recovery code</div>
              <p className="m-0 text-[13.5px] leading-snug text-neutral-600">Type it now to make sure you still have it. You can only see it again by making a new one.</p>
              <CodeField value={typed} onChange={(v) => { setTyped(v); setChecked('') }} onEnter={() => void check()} />
              {checked === 'ok' && <p className="m-0 text-[13px] font-bold text-[#1f9d63]">Correct. You still have it.</p>}
              {checked === 'bad' && <p role="alert" className="m-0 text-[13px] font-bold text-[#d6455d]">That is not your code.</p>}
              <div className="flex gap-2">
                <button type="button" disabled={busy || normaliseCode(typed).length < 25} onClick={() => void check()} className="h-11 flex-1 rounded-full border-0 bg-[#17171a] text-[14px] font-bold text-white disabled:opacity-35">Check</button>
                <button type="button" disabled={busy} onClick={() => void newCode()} className="h-11 flex-1 rounded-full border-0 bg-neutral-100 text-[14px] font-bold text-[#17171a]">Make a new code</button>
              </div>
              {err && <p role="alert" className="m-0 text-[13px] font-semibold text-[#d6455d]">{err}</p>}
            </div>
          )}
        </div>
      )}
    </ToolSheet>
  )
}

/**
 * Always mounted: asks for the recovery code now and then (so it does not get forgotten), and on a phone that has
 * private books but no keys yet.
 */
export function PrivacyGate() {
  const { user } = useAuth()
  const [mode, setMode] = useState<null | 'check' | 'restore'>(null)
  const [typed, setTyped] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  // the regular check
  useEffect(() => {
    if (!user) return
    let alive = true
    void codeCheckDue(user.uid).then((due) => { if (alive && due) setMode('check') })
    return () => { alive = false }
  }, [user])

  // a key arrived for a book: show its real title and cover
  useEffect(() => {
    if (!user) return
    const on = (e: Event) => { void hydrateMeta((e as CustomEvent<string>).detail).catch(() => {}) }
    window.addEventListener('mt-key', on)
    return () => window.removeEventListener('mt-key', on)
  }, [user])

  // the owner replaced a book's key (someone was removed) and this phone just received the new one
  useEffect(() => {
    if (!user) return
    const on = () => { toast('This book got a new key. Refreshing…'); window.setTimeout(() => window.location.reload(), 900) }
    window.addEventListener('mt-rekeyed', on)
    return () => window.removeEventListener('mt-rekeyed', on)
  }, [user])

  // a private book arrived and this phone has no key for it
  useEffect(() => {
    if (!user) return
    const on = () => setMode((m) => m ?? 'restore')
    window.addEventListener('mt-locked', on)
    return () => window.removeEventListener('mt-locked', on)
  }, [user])

  if (!user || !mode) return null

  const submit = async () => {
    setBusy(true); setErr('')
    try {
      const ok = mode === 'check' ? await verifyCode(user.uid, typed) : await unlockVault(user.uid, typed)
      if (ok) { setMode(null); setTyped(''); toast(mode === 'check' ? 'Thank you: your code is right' : 'Your private books are unlocked') } else setErr('That code does not match. Check it and try again.')
    } catch { setErr('Could not check it. Check your connection.') } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/45 px-6" role="dialog" aria-modal aria-label="Recovery code">
      <div className="w-full max-w-[360px] space-y-3 rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#eaf6ee] text-[#2db574]"><ShieldCheck size={20} /></span>
          <h2 className="m-0 text-[17px] font-extrabold text-[#17171a]">{mode === 'check' ? 'Type your recovery code' : 'Unlock your private books'}</h2>
        </div>
        <p className="m-0 text-[13.5px] leading-snug text-neutral-600">
          {mode === 'check'
            ? 'Every now and then we ask, so you never forget it. If you lose your phone, this code is the only way to get your private books back.'
            : 'This phone does not have the key for a private book yet. Type your recovery code to open it. (If someone invited you, open their invite link again instead.)'}
        </p>
        <CodeField value={typed} onChange={setTyped} onEnter={() => void submit()} />
        {err && <p role="alert" className="m-0 text-[13px] font-semibold text-[#d6455d]">{err}</p>}
        <motion.button type="button" whileTap={{ scale: 0.97 }} disabled={busy || normaliseCode(typed).length < 25} onClick={() => void submit()} className="h-12 w-full rounded-full border-0 bg-[#17171a] text-[15px] font-semibold text-white disabled:opacity-35">
          {busy ? 'Checking…' : mode === 'check' ? 'Check' : 'Unlock'}
        </motion.button>
        <button type="button" onClick={() => { if (mode === 'check') snoozeCodeCheck(); setMode(null) }} className="h-11 w-full rounded-full border-0 bg-transparent text-[14px] font-bold text-neutral-500">
          {mode === 'check' ? 'Ask me again in 3 days' : 'Not now'}
        </button>
      </div>
    </div>
  )
}
