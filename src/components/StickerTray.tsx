import { motion } from 'framer-motion'
import { ImagePlus } from 'lucide-react'
import { useRef, useState } from 'react'
import type { StickerProps } from '../types'
import { compressImage } from '../lib/image'
import { STICKER_CATEGORIES, STICKERS, StickerArt, type StickerCategory } from './stickers'

interface Props {
  accent: string
  onPick: (s: StickerProps) => void
}

export function StickerTray({ accent, onPick }: Props) {
  const [cat, setCat] = useState<StickerCategory>('Love')
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)

  const upload = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try {
      const { dataUrl } = await compressImage(f, { maxSize: 700, type: 'image/png' })
      onPick({ kind: 'image', value: dataUrl })
    } finally { setBusy(false) }
  }

  return (
    <div>
      <div className="no-scrollbar sticky top-0 z-10 flex gap-2 overflow-x-auto bg-white px-5 pb-3 pt-1" role="tablist" style={{ touchAction: 'pan-x' }}>
        {STICKER_CATEGORIES.map((c) => (
          <motion.button
            key={c} role="tab" type="button" aria-selected={cat === c} whileTap={{ scale: 0.94 }} onClick={() => setCat(c)}
            className="h-11 shrink-0 rounded-full border-0 px-5 text-[14px] font-bold"
            style={cat === c ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#55555f' }}
          >
            {c}
          </motion.button>
        ))}
      </div>

      <motion.div key={cat} className="grid grid-cols-4 gap-1 px-4" initial="h" animate="s" transition={{ staggerChildren: 0.02 }}>
        {STICKERS[cat].map((s, i) => (
          <motion.button
            key={s.value + i} type="button" aria-label={s.label ?? s.value}
            variants={{ h: { opacity: 0, scale: 0.7 }, s: { opacity: 1, scale: 1 } }}
            whileTap={{ scale: 0.88 }}
            onClick={() => onPick(s)}
            className="grid aspect-square place-items-center rounded-2xl border-0 bg-transparent p-2"
          >
            <div className="w-full" style={{ aspectRatio: '1', display: 'grid', placeItems: 'center' }}>
              <div style={{ width: '100%', height: s.kind === 'svg' ? undefined : '100%', aspectRatio: s.kind === 'svg' ? undefined : '1' }}>
                <StickerArt sticker={s} width={60} />
              </div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      <div className="px-5 pt-4">
        <motion.button
          type="button" whileTap={{ scale: 0.97 }} onClick={() => file.current?.click()} disabled={busy}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-transparent text-[15px] font-bold"
          style={{ borderColor: accent, color: accent }}
        >
          <ImagePlus size={19} /> {busy ? 'Preparing…' : 'Add my own'}
        </motion.button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
        <p className="m-0 mt-2 text-center text-[12px] text-neutral-400">Transparent PNGs make the best stickers.</p>
      </div>
    </div>
  )
}
