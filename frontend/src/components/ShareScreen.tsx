import { motion } from 'framer-motion'
import { Download, Eye, Loader2, Send, X } from 'lucide-react'
import { useState } from 'react'
import type { Memory } from '../types'
import { exportMemoryPng } from '../lib/exportImage'
import { shade } from '../lib/color'
import { BookCover, GRAIN } from './BookCard'
import { getTheme } from './ThemeEngine'
import { toast } from './ui'

/** Placeholder invite link until accounts / Firebase exist. */
export const inviteLink = (m: Memory) => `https://memorytale.app/invite/${m.id}`

export function ShareScreen({ memory, onClose }: { memory: Memory; onClose: () => void }) {
  const theme = getTheme(memory.themeId)
  const [busy, setBusy] = useState(false)
  const base = memory.cover.type === 'color' ? memory.cover.value : memory.cover.avg ?? theme.cover

  const share = async () => {
    const data = { title: memory.title, text: `Come see our memory “${memory.title}” on Memory Tale`, url: inviteLink(memory) }
    try {
      if (navigator.share) await navigator.share(data)
      else throw new Error('no-share')
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      try {
        await navigator.clipboard.writeText(data.url)
        toast('Invite link copied')
      } catch {
        toast(data.url)
      }
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

  const rise = (i: number) => ({
    initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 },
    transition: { type: 'spring' as const, stiffness: 260, damping: 24, delay: 0.25 + i * 0.07 },
  })

  return (
    <motion.div
      className="fixed inset-0 z-[60] overflow-hidden"
      style={{ background: shade(base, 0.35) }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
    >
      {/* blurred gradient from the cover */}
      <div aria-hidden className="absolute inset-0" style={{ transform: 'scale(1.5)', filter: 'blur(64px) saturate(1.35)' }}>
        {memory.cover.type === 'image' ? (
          <div className="absolute inset-0" style={{ background: `center / cover url(${memory.cover.value})` }} />
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 18%, ${shade(base, -0.35)}, transparent 55%)` }} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 80% 90%, ${theme.palette[0]}, transparent 60%)` }} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 10% 85%, ${theme.palette[1] ?? base}aa, transparent 55%)` }} />
          </>
        )}
      </div>
      <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(20,20,35,.15), rgba(20,10,20,.5))' }} />
      <div aria-hidden className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.2, mixBlendMode: 'overlay' }} />

      <div className="relative mx-auto flex h-full max-w-[520px] flex-col items-center px-8" style={{ paddingTop: 'calc(var(--safe-top) + 16px)', paddingBottom: 'calc(var(--safe-bottom) + 22px)' }}>
        <div className="flex w-full justify-end">
          <motion.button
            type="button" aria-label="Close" onClick={onClose} whileTap={{ scale: 0.92 }}
            initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
            className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white text-[#17171a] shadow-lg"
          >
            <X size={21} />
          </motion.button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <motion.div
            className="relative w-[min(58vw,240px)]"
            initial={{ opacity: 0, scale: 0.7, rotate: -14, y: 40 }}
            animate={{ opacity: 1, scale: 1, rotate: -4, y: 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 0.1 }}
          >
            <div aria-hidden className="absolute -inset-10 rounded-full" style={{ background: base, opacity: 0.55, filter: 'blur(46px)' }} />
            <motion.div animate={{ y: [0, -12, 0], rotate: [0, 1.6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
              <BookCover memory={memory} />
            </motion.div>
          </motion.div>
        </div>

        <motion.h1 {...rise(0)} className="m-0 text-center text-[30px] font-extrabold leading-tight tracking-tight text-white">
          Your memory is ready!
        </motion.h1>
        <motion.p {...rise(1)} className="mb-7 mt-2 max-w-[260px] text-center text-[15px] leading-snug text-white/70">
          Share this memory with someone you love.
        </motion.p>

        <motion.div {...rise(2)} className="flex w-full flex-col gap-3">
          <motion.button
            type="button" whileTap={{ scale: 0.96 }} onClick={() => void share()}
            className="flex h-14 items-center justify-center gap-2.5 rounded-2xl border-0 bg-[#17171a] text-[16px] font-semibold text-white shadow-[0_10px_30px_rgba(0,0,0,.35)]"
          >
            <Send size={19} /> Share memory
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
        </motion.div>
      </div>
    </motion.div>
  )
}
