import { AnimatePresence, motion } from 'framer-motion'
import { ImagePlus, Scissors, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { StickerProps } from '../types'
import { compressImage } from '../lib/image'
import { db } from '../data/db'
import { uid } from '../lib/id'
import { StickerMaker } from './StickerMaker'
import { STICKER_GROUPS, STICKERS, StickerArt, stickerRatio, type StickerCategory } from './stickers'

interface Props {
  accent: string
  onPick: (s: StickerProps) => void
}

type GroupId = (typeof STICKER_GROUPS)[number]['id'] | 'mine'
const TABS: { id: GroupId; label: string }[] = [...STICKER_GROUPS.map((g) => ({ id: g.id as GroupId, label: g.label })), { id: 'mine', label: 'Mine' }]

const isWide = (s: StickerProps) => s.kind === 'svg' && (s.value.startsWith('w-') || s.value.startsWith('c-') || s.value.startsWith('tape') || s.value === 'ticket' || s.value === 'p-postmark' || s.value === 'd-wave')

/**
 * Stickers in three groups (Characters, Emoji, Packs) plus your own. Tapping a category chip jumps to
 * that section; picking a sticker adds it and closes the sheet.
 */
export function StickerTray({ accent, onPick }: Props) {
  const [group, setGroup] = useState<GroupId>('characters')
  const cats: readonly StickerCategory[] = STICKER_GROUPS.find((g) => g.id === group)?.categories ?? []
  const [active, setActive] = useState<StickerCategory>(cats[0])
  const [busy, setBusy] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const makeInput = useRef<HTMLInputElement>(null)
  const [making, setMaking] = useState<File | null>(null)
  const [mine, setMine] = useState<{ id: string; dataUrl: string; ratio: number }[]>([])
  const loadMine = useCallback(async () => setMine((await db.myStickers.orderBy('createdAt').reverse().toArray()).map(({ id, dataUrl, ratio }) => ({ id, dataUrl, ratio }))), [])
  useEffect(() => { void loadMine() }, [loadMine])

  const sections = useRef<Partial<Record<StickerCategory, HTMLElement | null>>>({})
  const chipBar = useRef<HTMLDivElement>(null)
  const root = useRef<HTMLDivElement>(null)
  const lock = useRef(0)

  /** the sheet's own scrolling element */
  const scroller = useCallback(() => {
    let el = root.current?.parentElement ?? null
    while (el && getComputedStyle(el).overflowY !== 'auto') el = el.parentElement
    return el
  }, [])

  // keep the highlighted chip in step with the scroll position
  useEffect(() => {
    const sc = scroller()
    if (!sc) return
    const onScroll = () => {
      if (performance.now() < lock.current) return
      const top = sc.getBoundingClientRect().top + 110
      let cur = cats[0]
      for (const c of cats) { const el = sections.current[c]; if (el && el.getBoundingClientRect().top <= top) cur = c }
      setActive(cur)
    }
    sc.addEventListener('scroll', onScroll, { passive: true })
    return () => sc.removeEventListener('scroll', onScroll)
  }, [scroller, cats])

  // slide the chip row sideways so the active chip is visible (only that row: scrollIntoView would fight the vertical scroll)
  useEffect(() => {
    const bar = chipBar.current
    const chip = bar?.querySelector<HTMLElement>(`[data-chip="${active}"]`)
    if (bar && chip) bar.scrollTo({ left: chip.offsetLeft - bar.clientWidth / 2 + chip.clientWidth / 2, behavior: 'smooth' })
  }, [active])

  const chooseGroup = (g: GroupId) => {
    setGroup(g)
    const first = STICKER_GROUPS.find((x) => x.id === g)?.categories[0]
    if (first) setActive(first)
    scroller()?.scrollTo({ top: 0 })
  }

  const jump = (c: StickerCategory) => {
    const sc = scroller()
    const el = sections.current[c]
    setActive(c)
    if (!sc || !el) return
    lock.current = performance.now() + 700
    const bar = sc.querySelector<HTMLElement>('[data-sticky-bar]')
    const offset = (bar?.offsetHeight ?? 100) + 6
    const y = el.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - offset
    sc.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
  }

  const upload = async (f?: File) => {
    if (!f) return
    setBusy(true)
    try {
      const { dataUrl, width, height } = await compressImage(f, { maxSize: 700, type: 'image/png' })
      onPick({ kind: 'image', value: dataUrl, ratio: width / height })
    } finally { setBusy(false) }
  }

  return (
    <div ref={root}>
      <div data-sticky-bar className="sticky top-0 z-10 bg-white pb-2">
        {/* group tabs */}
        <div className="flex gap-1.5 px-5 pb-2 pt-1" role="tablist" aria-label="Sticker groups">
          {TABS.map((t) => (
            <motion.button
              key={t.id} role="tab" type="button" aria-selected={group === t.id} whileTap={{ scale: 0.95 }} onClick={() => chooseGroup(t.id)}
              className="h-11 flex-1 rounded-full border-0 px-2 text-[14px] font-extrabold"
              style={group === t.id ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#55555f' }}
            >
              {t.label}
            </motion.button>
          ))}
        </div>
        {/* category chips for the group */}
        {cats.length > 0 && (
          <div ref={chipBar} className="no-scrollbar flex gap-2 overflow-x-auto px-5" role="tablist" aria-label="Sticker categories" style={{ touchAction: 'pan-x' }}>
            {cats.map((c) => (
              <motion.button
                key={c} data-chip={c} role="tab" type="button" aria-selected={active === c} whileTap={{ scale: 0.94 }} onClick={() => jump(c)}
                className="h-10 shrink-0 rounded-full border-0 px-4 text-[13.5px] font-bold"
                style={active === c ? { background: accent, color: '#fff' } : { background: '#f6f6f8', color: '#55555f', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)' }}
              >
                {c}
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {group === 'mine' ? (
        <div className="px-5 pt-3">
          <div className="flex gap-2">
            <motion.button
              type="button" whileTap={{ scale: 0.97 }} onClick={() => makeInput.current?.click()}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-0 text-[14.5px] font-bold text-white" style={{ background: accent }}
            >
              <Scissors size={18} /> Cut out from photo
            </motion.button>
            <motion.button
              type="button" whileTap={{ scale: 0.97 }} onClick={() => file.current?.click()} disabled={busy}
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-dashed bg-transparent text-[14.5px] font-bold" style={{ borderColor: accent, color: accent }}
            >
              <ImagePlus size={18} /> {busy ? 'Preparing…' : 'Add a PNG'}
            </motion.button>
          </div>
          {mine.length === 0 ? (
            <p className="m-0 px-2 pb-4 pt-6 text-center text-[14px] leading-relaxed text-neutral-500">
              Turn any photo into a sticker: pick a pet, a person or a favourite thing and the background disappears. Your stickers will live here.
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-1 pt-4">
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
          )}
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
          <input ref={makeInput} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) setMaking(f); e.target.value = '' }} />
        </div>
      ) : (
        cats.map((c) => (
          <section key={c} data-cat={c} ref={(el) => { sections.current[c] = el }} className="px-4 pt-4">
            <h3 className="m-0 mb-1 px-1 text-[13px] font-extrabold uppercase tracking-wider text-neutral-400">{c}</h3>
            <div className="grid grid-cols-4 gap-1">
              {STICKERS[c].map((s, i) => {
                const wide = isWide(s)
                return (
                  <motion.button
                    key={s.value + i} type="button" aria-label={s.label ?? s.value} whileTap={{ scale: 0.88 }} onClick={() => onPick(s)}
                    className={`grid place-items-center rounded-2xl border-0 bg-transparent p-2 ${wide ? 'col-span-2' : ''}`}
                    style={{ aspectRatio: wide ? '2 / 1' : '1' }}
                  >
                    <div style={{ width: s.kind === 'svg' ? (stickerRatio(s) < 1 ? `${stickerRatio(s) * 100}%` : '100%') : '78%', maxHeight: '100%', aspectRatio: s.kind === 'svg' ? `${stickerRatio(s)}` : '1' }}>
                      <StickerArt sticker={s} width={60} preview />
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </section>
        ))
      )}

      <p className="m-0 px-5 pb-2 pt-5 text-center text-[12px] text-neutral-400">All stickers are free to use. The Beans are drawn for Memory Tale.</p>

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
    </div>
  )
}
