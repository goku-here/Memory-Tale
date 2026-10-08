import { motion } from 'framer-motion'
import { Loader2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { downloadOriginal } from '../lib/supabase'

interface Props {
  src: string
  /** storage path of the full-quality original, if there is one */
  original?: string
  caption?: string
  onClose: () => void
}

/** Full-screen photo viewer on a dark backdrop. Tap anywhere, press Esc, or swipe down to close. */
export function Lightbox({ src, original, caption, onClose }: Props) {
  const [full, setFull] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!original)

  // show the synced copy straight away, then swap in the original when it arrives
  useEffect(() => {
    if (!original) return
    let url: string | null = null
    let alive = true
    void downloadOriginal(original).then((b) => {
      if (!alive) return
      if (b) { url = URL.createObjectURL(b); setFull(url) }
      setLoading(false)
    })
    return () => { alive = false; if (url) URL.revokeObjectURL(url) }
  }, [original])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  return (
    <motion.div
      role="dialog" aria-modal aria-label="Photo viewer"
      className="fixed inset-0 z-[85] grid place-items-center"
      style={{ background: 'rgba(0,0,0,.9)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
      onClick={onClose}
    >
      <motion.button
        type="button" aria-label="Close" whileTap={{ scale: 0.92 }}
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="absolute right-4 grid h-11 w-11 place-items-center rounded-full border-0 bg-white/15 text-white backdrop-blur"
        style={{ top: 'calc(var(--safe-top) + 14px)' }}
      >
        <X size={22} />
      </motion.button>

      <motion.figure
        className="m-0 flex max-w-full flex-col items-center px-3"
        drag="y" dragElastic={0.5} dragConstraints={{ top: 0, bottom: 0 }}
        onDragEnd={(_, info) => { if (Math.abs(info.offset.y) > 110 || Math.abs(info.velocity.y) > 700) onClose() }}
        initial={{ scale: 0.92 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        style={{ touchAction: 'none' }}
      >
        <img
          src={full ?? src} alt={caption || 'Photo'} draggable={false}
          className="max-h-[86vh] max-w-full select-none rounded-lg object-contain shadow-2xl"
        />
        {caption && <figcaption className="mt-3 text-center text-white/80" style={{ fontFamily: "'Caveat', cursive", fontSize: 20 }}>{caption}</figcaption>}
      </motion.figure>

      {loading && (
        <div className="absolute bottom-6 flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-[12.5px] font-semibold text-white backdrop-blur" role="status">
          <Loader2 size={14} className="animate-spin" /> Loading full quality…
        </div>
      )}
    </motion.div>
  )
}
