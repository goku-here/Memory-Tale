import { motion } from 'framer-motion'
import { Check, Download, Eye, Loader2, Pencil, Send } from 'lucide-react'
import { useState } from 'react'
import type { Memory } from '../types'
import { exportMemoryPng } from '../lib/exportImage'
import { useAuth } from '../data/useAuth'
import { createInvite, reportError } from '../data/sync'
import { ShareLayout } from './ShareLayout'
import { ToolSheet } from './ToolSheet'
import { toast } from './ui'

const SHARE_COPY: Record<Memory['themeId'], string> = {
  romantic: 'Share this memory with someone you love.',
  trip: 'Take your travel buddies back on the road.',
  dinner: 'Pass the table around. Share it with everyone who was there.',
  friends: 'Send it to the crew and relive the chaos.',
  family: 'Share it with the family who made it special.',
  birthday: 'Let everyone relive the party.',
  anniversary: 'Share this milestone with the people who cheered you on.',
}

export function ShareScreen({ memory, onClose }: { memory: Memory; onClose: () => void }) {
  const { user, signIn, configured } = useAuth()
  const [busy, setBusy] = useState(false)
  const [sharing, setSharing] = useState(false)
  /** what people who open the link may do */
  const [role, setRole] = useState<'edit' | 'view'>('edit')
  const [asking, setAsking] = useState(false)
  /** only the owner can hand out edit access; everyone else's links are view-only */
  const isOwner = !user || !memory.ownerId || memory.ownerId === user.uid

  /** the owner first picks what the link allows, then sends it; anyone else sends straight away (view-only) */
  const onShare = () => {
    if (isOwner) { setAsking(true); return }
    void share()
  }

  const share = async () => {
    if (sharing) return
    setSharing(true)
    try {
      let who = user
      if (!who) {
        if (!configured) { toast('Cloud sharing is not set up'); return }
        who = await signIn() // the sender needs an account so the book can live in the cloud
        if (!who) return
      }
      const url = await createInvite({ uid: who.uid, name: who.name, photo: who.photo }, memory, isOwner ? role : 'view')
      const data = {
        title: memory.title,
        text: `${who.name.split(' ')[0]} saved a memory for you on Memory Tale: “${memory.title}”`,
        url,
      }
      try {
        if (navigator.share) await navigator.share(data)
        else throw new Error('no-share')
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        try { await navigator.clipboard.writeText(url); toast('Invite link copied') } catch { toast(url) }
      }
    } catch (e) {
      reportError(e)
      const code = (e as { code?: string }).code ?? (e as Error).message
      toast(code === 'permission-denied'
        ? 'Publish the latest Firestore rules, then try again'
        : `Couldn't create the link (${code})`)
    } finally {
      setSharing(false)
    }
  }

  const exportImage = async () => {
    if (busy) return
    setBusy(true)
    try {
      const blob = await exportMemoryPng(memory)
      const file = new File([blob], `${memory.title.replace(/[^\w-]+/g, '-') || 'memory'}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: memory.title }); return } catch (e) { if ((e as Error).name === 'AbortError') return }
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
      toast('Image saved')
    } catch {
      toast("Couldn't export the image")
    } finally {
      setBusy(false)
    }
  }

  const OPTIONS = [
    { id: 'edit', title: 'Can edit', text: 'They can add photos, move things around and change the book.', icon: Pencil },
    { id: 'view', title: 'View only', text: 'They can look at the book, but not change anything.', icon: Eye },
  ] as const

  return (
    <>
    <ShareLayout
      book={memory} onClose={onClose}
      heading="Your memory is ready!"
      sub={SHARE_COPY[memory.themeId] ?? 'Share this memory with the people who were there.'}
    >
      <motion.button
        type="button" whileTap={{ scale: 0.96 }} onClick={onShare} disabled={sharing}
        className="flex h-14 items-center justify-center gap-2.5 rounded-2xl border-0 bg-[#17171a] text-[16px] font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,.35)] disabled:opacity-70"
      >
        {sharing ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />} {sharing ? 'Creating your link…' : 'Share memory'}
      </motion.button>
      <motion.button
        type="button" whileTap={{ scale: 0.96 }} onClick={onClose}
        className="flex h-14 items-center justify-center gap-2.5 rounded-2xl border-0 bg-white text-[16px] font-semibold text-[#17171a] shadow-[0_8px_24px_rgba(0,0,0,.18)]"
      >
        <Eye size={19} /> View memory
      </motion.button>
      <motion.button
        type="button" whileTap={{ scale: 0.96 }} onClick={() => void exportImage()} disabled={busy}
        className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-0 bg-transparent text-[14.5px] font-bold text-white/85"
      >
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />}
        {busy ? 'Preparing image…' : 'Export as image'}
      </motion.button>
    </ShareLayout>

    {/* the owner chooses what the link allows, in a sheet over the whole screen so the page behind stays as it is */}
    <ToolSheet open={asking} onClose={() => setAsking(false)} title="Who can open it?" snaps={[0.56]} z={75}>
      <div className="space-y-2.5 px-5 pb-6">
        <div role="radiogroup" aria-label="What people with the link can do" className="space-y-2.5">
          {OPTIONS.map(({ id, title, text, icon: Icon }) => {
            const on = role === id
            return (
              <button
                key={id} type="button" role="radio" aria-checked={on} onClick={() => setRole(id)}
                className="flex w-full items-center gap-3.5 rounded-2xl border-0 p-3.5 text-left"
                style={on ? { background: '#f1f1f6', boxShadow: 'inset 0 0 0 2px #17171a' } : { background: '#f6f6f8', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)' }}
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full" style={on ? { background: '#17171a', color: '#fff' } : { background: '#e6e6ec', color: '#55555f' }}><Icon size={21} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[16px] font-extrabold text-[#17171a]">{title}</span>
                  <span className="block text-[13px] leading-snug text-neutral-500">{text}</span>
                </span>
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full" style={on ? { background: '#17171a', color: '#fff' } : { boxShadow: 'inset 0 0 0 2px #c9c9d2' }}>{on && <Check size={14} strokeWidth={3.4} />}</span>
              </button>
            )
          })}
        </div>
        <p className="m-0 px-1 text-center text-[12.5px] leading-snug text-neutral-400">You can change this for each person later in People.</p>
        <motion.button
          type="button" whileTap={{ scale: 0.97 }} disabled={sharing} onClick={() => { setAsking(false); void share() }}
          className="flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-full border-0 bg-[#17171a] text-[15.5px] font-semibold text-white disabled:opacity-60"
        ><Send size={18} /> Send link</motion.button>
      </div>
    </ToolSheet>
    </>
  )
}