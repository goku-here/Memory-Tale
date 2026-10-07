import { motion } from 'framer-motion'
import { ImagePlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { StickerProps } from '../types'
import { compressImage } from '../lib/image'
import { STICKER_CATEGORIES, STICKERS, StickerArt, stickerRatio, type StickerCategory } from './stickers'

interface Props {
  accent: string
  onPick: (s: StickerProps) => void
}

/** All stickers in labelled sections; the chips jump between sections. */
export function StickerTray({ accent, onPick }: Props) {
  const [active, setActive] = useState<StickerCategory>('Love')
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const sections = useRef<Partial<Record<StickerCategory, HTMLElement | null>>>({})
  const chips = useRef<Partial<Record<StickerCategory, HTMLElement | null>>>({})
  const lock = useRef(0)

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        if (performance.now() < lock.current) return
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (vis) setActive((vis.target as HTMLElement).dataset.cat as StickerCategory)
      },
      { rootMargin: '-15% 0px -75% 0px' },
    )
    Object.values(sections.current).forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    chips.current[active]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])

  const jump = (c: StickerCategory) => {
    setActive(c)
    lock.current = performance.now() + 700
    sections.current[c]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

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
            key={c} ref={(el) => { chips.current[c] = el }} role="tab" type="button" aria-selected={active === c} whileTap={{ scale: 0.94 }}
            onClick={() => jump(c)}
            className="h-11 shrink-0 rounded-full border-0 px-5 text-[14px] font-bold"
            style={active === c ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#55555f' }}
          >
            {c}
          </motion.button>
        ))}
      </div>

      <div className="px-5 pt-1">
        <motion.button
          type="button" whileTap={{ scale: 0.97 }} onClick={() => file.current?.click()} disabled={busy}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-transparent text-[15px] font-bold"
          style={{ borderColor: accent, color: accent }}
        >
          <ImagePlus size={19} /> {busy ? 'Preparing…' : 'Add my own sticker'}
        </motion.button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
      </div>

      {STICKER_CATEGORIES.map((c) => (
        <section
          key={c} data-cat={c} ref={(el) => { sections.current[c] = el }}
          className="px-4 pt-5" style={{ scrollMarginTop: 60 }}
        >
          <h3 className="m-0 mb-1 px-1 text-[13px] font-extrabold uppercase tracking-wider text-neutral-400">{c}</h3>
          <div className="grid grid-cols-4 gap-1">
            {STICKERS[c].map((s, i) => {
              const wide = s.kind === 'svg' && (s.value.startsWith('w-') || s.value.startsWith('c-') || s.value.startsWith('tape') || s.value === 'ticket' || s.value === 'p-postmark' || s.value === 'd-wave')
              return (
                <motion.button
                  key={s.value + i} type="button" aria-label={s.label ?? s.value} whileTap={{ scale: 0.88 }} onClick={() => onPick(s)}
                  className={`grid place-items-center rounded-2xl border-0 bg-transparent p-2 ${wide ? 'col-span-2' : ''}`}
                  style={{ aspectRatio: wide ? '2 / 1' : '1' }}
                >
                  <div style={{ width: s.kind === 'svg' ? '100%' : '78%', maxHeight: '100%', aspectRatio: s.kind === 'svg' ? `${stickerRatio(s)}` : '1' }}>
                    <StickerArt sticker={s} width={60} preview />
                  </div>
                </motion.button>
              )
            })}
          </div>
        </section>
      ))}
      <p className="m-0 px-5 pb-2 pt-5 text-center text-[12px] text-neutral-400">Transparent PNGs make the best stickers.</p>
    </div>
  )
}
