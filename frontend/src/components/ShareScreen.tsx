import { motion } from 'framer-motion'
import { Download, Eye, Loader2, Send } from 'lucide-react'
import { useState } from 'react'
import type { Memory } from '../types'
import { exportMemoryPng } from '../lib/exportImage'
import { useAuth } from '../data/useAuth'
import { createInvite, reportError } from '../data/sync'
import { ShareLayout } from './ShareLayout'
import { toast } from './ui'

export function ShareScreen({ memory, onClose }: { memory: Memory; onClose: () => void }) {
  const { user, signIn, configured } = useAuth()
  const [busy, setBusy] = useState(false)
  const [sharing, setSharing] = useState(false)

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
      const url = await createInvite({ uid: who.uid, name: who.name, photo: who.photo }, memory)
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

  return (
    <ShareLayout
      book={memory} onClose={onClose}
      heading="Your memory is ready!"
      sub="Share this memory with someone you love."
    >
      <motion.button
        type="button" whileTap={{ scale: 0.96 }} onClick={() => void share()} disabled={sharing}
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
  )
}
