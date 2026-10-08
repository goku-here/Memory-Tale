import { motion } from 'framer-motion'
import { Eye, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { getInvite, joinMemory, reportError, type Invite } from '../data/sync'
import { useAuth, type Profile } from '../data/useAuth'
import { getTheme } from './ThemeEngine'
import { rise, ShareLayout } from './ShareLayout'
import { toast } from './ui'

const FLAG = 'mt-autojoin'

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

interface Props {
  token: string
  /** ids of memories this device already has (so opening your own / an already-joined link needs no join) */
  knownIds: Set<string>
  onJoined: (memoryId: string) => void
  onDismiss: () => void
}

/** What someone sees after tapping an invite link: the book, a warm note, and Google sign-in. */
export function InviteScreen({ token, knownIds, onJoined, onDismiss }: Props) {
  const { user, signIn, configured, loading: authLoading } = useAuth()
  const [invite, setInvite] = useState<Invite | null | undefined>(undefined)
  const [joining, setJoining] = useState(false)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')
  const tried = useRef(false)

  useEffect(() => {
    let alive = true
    getInvite(token).then((i) => alive && setInvite(i)).catch((e) => { reportError(e); if (alive) setInvite(null) })
    return () => { alive = false }
  }, [token])

  const join = async (who: Profile) => {
    if (!invite || joining) return
    setJoining(true)
    setError('')
    try {
      if (!knownIds.has(invite.memoryId)) {
        await joinMemory(token, invite.memoryId, { uid: who.uid, name: who.name, photo: who.photo }, getTheme(invite.themeId).palette[0])
      }
      sessionStorage.removeItem(FLAG)
      onJoined(invite.memoryId)
    } catch (e) {
      reportError(e)
      setError("We couldn't open it just yet. Please try once more, or ask for a fresh link.")
      setJoining(false)
    }
  }

  // came back from a Google redirect, or just signed in with the button: continue straight in
  useEffect(() => {
    if (!user || !invite || tried.current) return
    if (sessionStorage.getItem(FLAG) === token) { tried.current = true; void join(user) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, invite])

  const start = async () => {
    setSigning(true)
    sessionStorage.setItem(FLAG, token)
    try {
      const who = await signIn()
      if (who) { tried.current = true; await join(who) }
    } catch {
      toast("Couldn't sign in. Please try again.")
    } finally {
      setSigning(false)
    }
  }

  /* ---- loading / expired ---- */
  if (invite === undefined) {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-[#f6f5f2]" role="status" aria-label="Opening your invite">
        <Loader2 size={30} className="animate-spin text-neutral-400" />
      </div>
    )
  }
  if (invite === null) {
    return (
      <div className="fixed inset-0 z-[60] grid place-items-center bg-[#f6f5f2] px-8 text-center">
        <div>
          <div className="text-5xl">🍂</div>
          <h1 className="m-0 mt-4 text-[24px] font-extrabold">This link has gone quiet</h1>
          <p className="mx-auto mb-6 mt-2 max-w-[280px] text-[15px] leading-snug text-neutral-500">
            It may have been mistyped or removed. Ask whoever sent it to share the memory again.
          </p>
          <button type="button" onClick={onDismiss} className="h-12 rounded-full border-0 bg-[#17171a] px-8 text-[15px] font-semibold text-white">Go to Memory Tale</button>
        </div>
      </div>
    )
  }

  const first = (invite.ownerName || 'Someone').split(' ')[0]
  const busy = signing || joining
  const book = { title: invite.title, themeId: invite.themeId, cover: invite.cover, date: invite.date }

  return (
    <ShareLayout
      book={book} onClose={onDismiss}
      heading={<>{first} saved a memory<br />for you</>}
      sub="There are photos inside and a story still being written. Open the book and see what's waiting."
      extra={
        <motion.div {...rise(-1)} className="mb-3 flex items-center gap-2 rounded-full bg-white/15 py-1.5 pl-1.5 pr-3.5 text-[13px] font-semibold text-white backdrop-blur">
          {invite.ownerPhoto ? (
            <img src={invite.ownerPhoto} alt="" referrerPolicy="no-referrer" className="h-6 w-6 rounded-full object-cover" />
          ) : (
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/80 text-[12px] font-bold text-[#17171a]">{first.slice(0, 1).toUpperCase()}</span>
          )}
          Shared by {invite.ownerName || 'a friend'}
        </motion.div>
      }
    >
      {user ? (
        <motion.button
          type="button" whileTap={{ scale: 0.96 }} onClick={() => void join(user)} disabled={busy}
          className="flex h-14 items-center justify-center gap-2.5 rounded-2xl border-0 bg-white text-[16px] font-semibold text-[#17171a] shadow-[0_8px_24px_rgba(0,0,0,.18)] disabled:opacity-80"
        >
          {busy ? <Loader2 size={19} className="animate-spin" /> : <Eye size={19} />} {busy ? 'Opening the book…' : 'View memory'}
        </motion.button>
      ) : (
        <>
          <motion.button
            type="button" whileTap={{ scale: 0.96 }} onClick={() => void start()} disabled={busy || authLoading || !configured}
            className="flex h-14 items-center justify-center gap-3 rounded-2xl border-0 bg-[#17171a] text-[16px] font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,.35)] disabled:opacity-70"
          >
            {busy ? <Loader2 size={19} className="animate-spin" /> : <span className="grid h-7 w-7 place-items-center rounded-full bg-white"><GoogleG /></span>}
            {busy ? 'Opening the book…' : 'Continue with Google'}
          </motion.button>
          <p className="m-0 text-center text-[12.5px] leading-snug text-white/60">Sign in once to open this memory and add your own photos to it.</p>
        </>
      )}
      {error && <p className="m-0 text-center text-[13px] font-semibold text-[#ffd5d5]" role="alert">{error}</p>}
    </ShareLayout>
  )
}
