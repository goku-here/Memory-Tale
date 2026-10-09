import { motion } from 'framer-motion'
import { ImagePlus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { StickerProps } from '../types'
import { compressImage } from '../lib/image'
import { db } from '../data/db'
import { uid } from '../lib/id'
import { StickerMaker } from './StickerMaker'
import { AnimatePresence } from 'framer-motion'
import { Scissors, X } from 'lucide-react'
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
  const makeInput = useRef<HTMLInputElement>(null)
  const [making, setMaking] = useState<File | null>(null)
  const [mine, setMine] = useState<{ id: string; dataUrl: string; ratio: number }[]>([])
  const loadMine = useCallback(async () => setMine((await db.myStickers.orderBy('createdAt').reverse().toArray()).map(({ id, dataUrl, ratio }) => ({ id, dataUrl, ratio }))), [])
  useEffect(() => { void loadMine() }, [loadMine])
  const sections = useRef<Partial<Record<StickerCategory, HTMLElement | null>>>({})
  const chips = useRef<Partial<Record<StickerCategory, HTMLElement | null>>>({})
  const lock = useRef(0)

  const root = useRef<HTMLDivElement>(null)
  const scroller = () => {
    let el = root.current?.parentElement ?? null
    while (el && getComputedStyle(el).overflowY !== 'auto') el = el.parentElement
    return el
  }

  // follow the scroll position (works at any sheet height, unlike viewport-based observers)
  useEffect(() => {
    const sc = scroller()
    if (!sc) return
    const onScroll = () => {
      if (performance.now() < lock.current) return
      const top = sc.getBoundingClientRect().top + 90
      let cur: StickerCategory = STICKER_CATEGORIES[0]
      for (const c of STICKER_CATEGORIES) {
        const el = sections.current[c]
        if (el && el.getBoundingClientRect().top <= top) cur = c
      }
      setActive(cur)
    }
    sc.addEventListener('scroll', onScroll, { passive: true })
    return () => sc.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    chips.current[active]?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])

  const jump = (c: StickerCategory) => {
    const sc = scroller()
    const el = sections.current[c]
    setActive(c)
    if (!sc || !el) return
    lock.current = performance.now() + 600
    const y = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 58
    sc.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
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
    <div ref={root}>
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

      <div className="flex gap-2 px-5 pt-1">
        <motion.button
          type="button" whileTap={{ scale: 0.97 }} onClick={() => makeInput.current?.click()}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-0 text-[14.5px] font-bold text-white"
          style={{ background: accent }}
        >
          <Scissors size={18} /> Cut out from photo
        </motion.button>
        <motion.button
          type="button" whileTap={{ scale: 0.97 }} onClick={() => file.current?.click()} disabled={busy}
          className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-transparent text-[14.5px] font-bold"
          style={{ borderColor: accent, color: accent }}
        >
          <ImagePlus size={18} /> {busy ? 'Preparing…' : 'Add a PNG'}
        </motion.button>
        <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
        <input ref={makeInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setMaking(f); e.target.value = '' }} />
      </div>

      {mine.length > 0 && (
        <section className="px-4 pt-5" style={{ scrollMarginTop: 60 }}>
          <h3 className="m-0 mb-1 px-1 text-[13px] font-extrabold uppercase tracking-wider text-neutral-400">My stickers</h3>
          <div className="grid grid-cols-4 gap-1">
            {mine.map((s) => (
              <div key={s.id} className="relative">
                <motion.button
                  type="button" aria-label="Add my sticker" whileTap={{ scale: 0.88 }} onClick={() => onPick({ kind: 'image', value: s.dataUrl, ratio: s.ratio })}
                  className="grid aspect-square w-full place-items-center rounded-2xl border-0 bg-transparent p-2"
                >
                  <div style={{ width: s.ratio >= 1 ? '100%' : `${s.ratio * 100}%`, aspectRatio: `${s.ratio}` }}>
                    <StickerArt sticker={{ kind: 'image', value: s.dataUrl, ratio: s.ratio }} width={60} preview />
                  </div>
                </motion.button>
                <button type="button" aria-label="Delete my sticker" onClick={() => { void db.myStickers.delete(s.id).then(loadMine) }}
                  className="absolute right-0 top-0 grid h-7 w-7 place-items-center rounded-full border-0 bg-black/55 text-white"><X size={14} /></button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* rendered on <body>: the sheet is transformed, which would shrink "full screen" to the sheet's area */}
      {createPortal(
      <AnimatePresence>
        {making && (
          <StickerMaker
            key="maker" file={making} onClose={() => setMaking(null)}
            onSave={(dataUrl, ratio) => {
              setMaking(null)
              void db.myStickers.put({ id: uid(), dataUrl, ratio, createdAt: Date.now() }).then(loadMine)
              onPick({ kind: 'image', value: dataUrl, ratio })
            }}
          />
        )}
      </AnimatePresence>,
      document.body,
      )}

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
