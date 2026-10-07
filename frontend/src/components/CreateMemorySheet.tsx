import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronLeft, ImagePlus, Loader2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { CategoryId, Cover, Memory } from '../types'
import { uid } from '../lib/id'
import { makeCover } from '../lib/image'
import { toneFor } from '../lib/color'
import { BookCover } from './BookCard'
import { CATEGORY_ORDER, COVER_COLORS, THEMES, getTheme } from './ThemeEngine'
import { ToolSheet } from './ToolSheet'
import { PillButton } from './ui'

export type SheetState =
  | { mode: 'create' }
  | { mode: 'edit'; id: string }
  | { mode: 'theme'; id: string }

interface Props {
  state: SheetState | null
  memory?: Memory
  onClose: () => void
  onSubmit: (m: Memory, isNew: boolean) => void
}

const today = () => new Date().toISOString().slice(0, 10)

function Preview({ draft }: { draft: Pick<Memory, 'title' | 'themeId' | 'cover' | 'date'> }) {
  const theme = getTheme(draft.themeId)
  return (
    <div
      className="mx-4 grid place-items-center overflow-hidden rounded-[28px] py-6"
      style={{ background: `radial-gradient(circle at 50% 40%, #fff, ${theme.canvasBg})` }}
    >
      <motion.div
        key={draft.themeId + draft.cover.value.slice(-12)}
        initial={{ scale: 0.95, rotate: -2 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 18 }}
        className="w-[38%] pb-3"
      >
        <BookCover memory={draft} />
      </motion.div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block px-5">
      <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-neutral-400">{label}</span>
      {children}
    </label>
  )
}

const inputCls =
  'h-12 w-full rounded-2xl border-0 bg-neutral-100 px-4 text-[16px] font-semibold text-[#17171a] outline-none focus:bg-neutral-200/70'

function Form({ state, memory, onSubmit }: { state: SheetState } & Omit<Props, 'state' | 'onClose'>) {
  const isCreate = state.mode === 'create'
  const [step, setStep] = useState<'category' | 'details'>(state.mode === 'edit' ? 'details' : 'category')
  const [category, setCategory] = useState<CategoryId>(memory?.category ?? 'romantic')
  const [themeId, setThemeId] = useState<CategoryId>(memory?.themeId ?? 'romantic')
  const [title, setTitle] = useState(memory?.title ?? '')
  const [date, setDate] = useState(memory?.date ?? today())
  const [cover, setCover] = useState<Cover>(memory?.cover ?? { type: 'color', value: THEMES.romantic.cover, tone: 'dark' })
  const [coverTouched, setCoverTouched] = useState(!isCreate)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const theme = getTheme(themeId)

  const pickCategory = (id: CategoryId) => {
    setCategory(id)
    setThemeId(id)
    if (!coverTouched) setCover({ type: 'color', value: THEMES[id].cover, tone: toneFor(THEMES[id].cover) })
    setStep('details')
  }

  const pickColor = (value: string) => {
    setCoverTouched(true)
    setCover({ type: 'color', value, tone: toneFor(value) })
  }

  const upload = async (file?: File) => {
    if (!file) return
    setBusy(true)
    try {
      const c = await makeCover(file)
      setCoverTouched(true)
      setCover({ type: 'image', value: c.dataUrl, avg: c.avg, tone: c.tone })
    } finally {
      setBusy(false)
    }
  }

  const draft = { title: title.trim() || theme.name, themeId, cover, date }

  const submit = () => {
    const base: Memory = memory ?? { id: uid(), createdAt: Date.now(), category, themeId, title: '', date, cover }
    onSubmit(
      {
        ...base,
        category: isCreate ? category : base.category,
        themeId,
        title: draft.title,
        date,
        cover,
        members: base.members ?? [{ id: 'me', name: 'You', color: THEMES[themeId].palette[0] }],
      },
      isCreate,
    )
  }

  /* ---- theme-change mode ---- */
  if (state.mode === 'theme') {
    return (
      <div className="pb-4">
        <Preview draft={draft} />
        <div className="mt-4 space-y-2 px-4">
          {CATEGORY_ORDER.map((id) => {
            const t = THEMES[id]
            const on = themeId === id
            return (
              <motion.button
                key={id} type="button" whileTap={{ scale: 0.97 }} onClick={() => setThemeId(id)}
                className="flex min-h-16 w-full items-center gap-3 rounded-2xl border-2 border-solid px-4 text-left"
                style={{ background: t.canvasBg, borderColor: on ? t.palette[0] : 'transparent' }}
              >
                <span className="text-2xl">{t.emoji}</span>
                <span className="flex-1">
                  <span className="block text-[20px] leading-tight" style={{ fontFamily: t.font }}>{t.name}</span>
                  <span className="mt-1 flex gap-1">
                    {t.palette.slice(0, 4).map((c) => <i key={c} className="h-3 w-3 rounded-full" style={{ background: c }} />)}
                  </span>
                </span>
                {on && <Check size={20} color={t.palette[0]} strokeWidth={3} />}
              </motion.button>
            )
          })}
        </div>
        <div className="px-5 pt-5">
          <PillButton className="w-full" onClick={submit}>Apply theme</PillButton>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-x-hidden pb-4">
      <AnimatePresence mode="wait" initial={false}>
        {step === 'category' ? (
          <motion.div
            key="cat" initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.2 }} className="px-4"
          >
            <p className="m-0 mb-4 px-1 text-[14px] text-neutral-500">What kind of memory is it? This sets the look of your book and canvas.</p>
            <div className="grid grid-cols-2 gap-3">
              {CATEGORY_ORDER.map((id, i) => {
                const t = THEMES[id]
                return (
                  <motion.button
                    key={id} type="button"
                    initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, type: 'spring', stiffness: 300, damping: 24 }}
                    whileTap={{ scale: 0.96 }} onClick={() => pickCategory(id)}
                    className="flex min-h-[132px] flex-col items-start rounded-[24px] border-0 p-4 text-left"
                    style={{ background: t.canvasBg, boxShadow: `inset 0 0 0 1.5px ${t.dot}` }}
                  >
                    <span className="text-[26px]">{t.emoji}</span>
                    <span className="mt-2 text-[21px] leading-[1.05]" style={{ fontFamily: t.font, color: t.palette[3] }}>{t.name}</span>
                    <span className="mt-auto flex gap-1 pt-3">
                      {t.palette.slice(0, 4).map((c) => <i key={c} className="h-3.5 w-3.5 rounded-full" style={{ background: c }} />)}
                    </span>
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="det" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.2 }} className="space-y-5"
          >
            {isCreate && (
              <button
                type="button" onClick={() => setStep('category')}
                className="mx-4 flex min-h-11 items-center gap-1 rounded-full border-0 bg-transparent pr-3 text-[14px] font-bold text-neutral-500"
              >
                <ChevronLeft size={20} /> {theme.emoji} {THEMES[category].name}
              </button>
            )}
            <Preview draft={draft} />

            <Field label="Title">
              <input
                className={inputCls} value={title} maxLength={40} placeholder={`e.g. ${theme.id === 'trip' ? 'Goa with the gang' : 'Our special day'}`}
                onChange={(e) => setTitle(e.target.value)} enterKeyHint="done"
              />
            </Field>
            <Field label="Date">
              <input className={inputCls} type="date" value={date} onChange={(e) => setDate(e.target.value || today())} />
            </Field>

            <div className="px-5">
              <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-neutral-400">Cover</span>
              <div className="-mx-1 flex flex-wrap gap-x-0.5 gap-y-1">
                {COVER_COLORS.map((c) => {
                  const on = cover.type === 'color' && cover.value === c.value
                  return (
                    <motion.button
                      key={c.value} type="button" aria-label={c.name} aria-pressed={on} whileTap={{ scale: 0.92 }}
                      onClick={() => pickColor(c.value)}
                      className="grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent"
                    >
                      <span
                        className="grid h-[34px] w-[34px] place-items-center rounded-full"
                        style={{ background: c.value, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${c.value}` : 'inset 0 0 0 1px rgba(0,0,0,.08)' }}
                      >
                        {on && <Check size={16} strokeWidth={3.2} color={toneFor(c.value) === 'dark' ? '#333' : '#fff'} />}
                      </span>
                    </motion.button>
                  )
                })}
                <motion.button
                  type="button" aria-label="Upload cover image" whileTap={{ scale: 0.92 }}
                  onClick={() => fileRef.current?.click()}
                  className="grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent"
                >
                  <span
                    className="grid h-[34px] w-[34px] place-items-center overflow-hidden rounded-full bg-neutral-100 text-neutral-600"
                    style={{
                      boxShadow: cover.type === 'image' ? '0 0 0 2px #fff, 0 0 0 4px #17171a' : 'inset 0 0 0 1px rgba(0,0,0,.1)',
                      background: cover.type === 'image' ? `center / cover url(${cover.value})` : undefined,
                    }}
                  >
                    {busy ? <Loader2 size={16} className="animate-spin" /> : cover.type === 'image' ? null : <ImagePlus size={17} />}
                  </span>
                </motion.button>
                <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = '' }} />
              </div>
              <p className="m-0 mt-1 text-[12px] text-neutral-400">Photos are cropped to the 3:4 cover.</p>
            </div>

            <div className="px-5 pt-1">
              <PillButton className="w-full" onClick={submit} disabled={busy}>
                {isCreate ? 'Create memory' : 'Save changes'}
              </PillButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function CreateMemorySheet({ state, memory, onClose, onSubmit }: Props) {
  const title = !state ? '' : state.mode === 'create' ? 'New memory' : state.mode === 'edit' ? 'Edit book' : 'Change theme'
  // remember the last state so content doesn't vanish while the sheet slides away
  const last = useRef<SheetState | null>(null)
  if (state) last.current = state
  const shown = last.current
  return (
    <ToolSheet open={!!state} onClose={onClose} title={title} snaps={[0.92]} z={70}>
      {shown && <Form key={shown.mode + ('id' in shown ? shown.id : '')} state={shown} memory={memory} onSubmit={onSubmit} />}
    </ToolSheet>
  )
}
