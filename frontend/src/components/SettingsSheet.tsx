import { motion } from 'framer-motion'
import { Loader2, LogOut, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../data/useAuth'
import { getSyncStatus, onSyncStatus } from '../data/sync'
import { DriveSettings } from './DriveSettings'
import { ToolSheet } from './ToolSheet'
import { toast } from './ui'
import { tour } from '../lib/tour'

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { configured, loading, user, signIn, logOut } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sync, setSync] = useState(getSyncStatus())
  useEffect(() => onSyncStatus(setSync), [])

  const doSignIn = async () => {
    setBusy(true)
    try {
      await signIn()
    } catch (e) {
      const code = (e as { code?: string }).code ?? (e as Error).message
      console.error('Google sign-in failed:', e)
      setError(code)
      toast("Couldn't sign in")
    } finally { setBusy(false) }
  }

  return (
    <ToolSheet open={open} onClose={onClose} title="Settings" snaps={[0.62, 0.92]} z={65}>
      <div className="space-y-4 px-5 pb-4 pt-1">
        {user ? (
          <div className="flex items-center gap-4 rounded-3xl bg-neutral-50 p-4">
            {user.photo ? (
              <img src={user.photo} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-full object-cover" />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded-full bg-[#17171a] text-xl font-bold text-white">{user.name.slice(0, 1).toUpperCase()}</span>
            )}
            <div className="min-w-0">
              <div className="truncate text-[17px] font-extrabold">{user.name}</div>
              <div className="truncate text-[13px] text-neutral-500">{user.email}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-neutral-50 p-5 text-center">
            <p className="m-0 mb-4 text-[14.5px] leading-relaxed text-neutral-600">
              Sign in to put your name and photo on your books. Your books then sync across your devices.
            </p>
            <motion.button
              type="button" whileTap={{ scale: 0.96 }} onClick={() => void doSignIn()} disabled={!configured || busy || loading}
              className="mx-auto flex h-13 min-h-12 w-full items-center justify-center gap-3 rounded-full border-0 bg-white text-[15.5px] font-semibold text-[#17171a] shadow-[0_2px_10px_rgba(20,24,40,.12),0_0_0_1px_rgba(20,24,40,.08)] disabled:opacity-50"
            >
              {busy || loading ? <Loader2 size={19} className="animate-spin" /> : <GoogleG />}
              Continue with Google
            </motion.button>
            {error && (
              <p className="m-0 mt-3 break-words text-[12.5px] leading-snug text-[#d6455d]">
                Sign-in error: <b>{error}</b>
              </p>
            )}
            {!configured && (
              <p className="m-0 mt-3 text-[12.5px] leading-snug text-amber-700">
                Google sign-in isn't set up yet. Add your Firebase keys to <b>.env.local</b> (see README).
              </p>
            )}
          </div>
        )}

        {user && <DriveSettings />}

        {user && (
          <div className="rounded-2xl bg-neutral-50 px-4 py-3 text-[13.5px]" role="status">
            <div className="flex items-center gap-2 font-bold">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: sync.state === 'synced' ? '#2E9E6B' : sync.state === 'error' ? '#d6455d' : '#F5B921' }} />
              {sync.state === 'synced' ? 'Cloud sync on' : sync.state === 'error' ? 'Sync problem' : 'Syncing…'}
            </div>
            {sync.state === 'error' && <p className="m-0 mt-1 leading-snug text-neutral-600">{sync.message}</p>}
            {sync.state === 'synced' && <p className="m-0 mt-1 leading-snug text-neutral-500">Your books are backed up and available on every device you sign in on.</p>}
          </div>
        )}

        <motion.button
          type="button" whileTap={{ scale: 0.96 }} onClick={() => { onClose(); window.setTimeout(() => tour.start(), 350) }}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-0 bg-neutral-100 text-[15px] font-semibold text-[#17171a]"
        >
          <Sparkles size={18} /> Replay the tour
        </motion.button>

        {user && (
          <motion.button
            type="button" whileTap={{ scale: 0.96 }} onClick={() => void logOut()}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border-0 bg-neutral-100 text-[15px] font-semibold text-[#d6455d]"
          >
            <LogOut size={18} /> Sign out
          </motion.button>
        )}
        <p className="m-0 text-center text-[12px] text-neutral-400">
          Memory Tale · build {__BUILD__}<br />
          <a href="/privacy" className="text-neutral-500">Privacy</a> · <a href="/terms" className="text-neutral-500">Terms</a> · <a href="/licenses" className="text-neutral-500">Licenses</a>
        </p>
      </div>
    </ToolSheet>
  )
}
