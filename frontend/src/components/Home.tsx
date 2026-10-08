import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Palette, PenLine, Plus, Trash2, User } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Memory } from '../types'
import { BookCard, BookCover } from './BookCard'
import { ToolSheet } from './ToolSheet'
import { useAuth } from '../data/useAuth'
import { ConfirmDialog, IconButton } from './ui'

interface HomeProps {
  memories: Memory[]
  loading: boolean
  hiddenId?: string | null
  onAdd: () => void
  onSettings: () => void
  onReorder: (ids: string[]) => void
  onOpen: (m: Memory, rect: DOMRect) => void
  onEdit: (m: Memory) => void
  onTheme: (m: Memory) => void
  onDuplicate: (m: Memory) => void
  onDelete: (m: Memory) => void
}

function MenuRow({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97, backgroundColor: 'rgba(0,0,0,.05)' }}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-4 rounded-2xl border-0 bg-transparent px-4 text-left text-[16px] font-semibold ${
        danger ? 'text-[#d6455d]' : 'text-[#17171a]'
      }`}
    >
      <span className="grid h-9 w-9 place-items-center rounded-full bg-black/5">{icon}</span>
      {label}
    </motion.button>
  )
}

export function Home({ memories, loading, hiddenId, onAdd, onSettings, onReorder, onOpen, onEdit, onTheme, onDuplicate, onDelete }: HomeProps) {
  const { user } = useAuth()
  const [menu, setMenu] = useState<Memory | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm, setConfirm] = useState<Memory | null>(null)

  const openMenu = (m: Memory) => { setMenu(m); setMenuOpen(true) }

  /* ---- press / long-press-to-drag reordering ---- */
  const [order, setOrder] = useState<string[]>([])
  const [dragId, setDragId] = useState<string | null>(null)
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null)
  const orderRef = useRef<string[]>([])
  const press = useRef<{
    id: string; sx: number; sy: number; timer: number; active: boolean; moved: boolean
    slots: DOMRect[]; idx: number; gx: number; gy: number
  } | null>(null)
  const cb = useRef({ onOpen, openMenu, onReorder })
  cb.current = { onOpen, openMenu, onReorder }
  const memRef = useRef(memories)
  memRef.current = memories

  useEffect(() => {
    if (press.current?.active) return
    const ids = memories.map((m) => m.id)
    orderRef.current = ids
    setOrder(ids)
  }, [memories])

  const ordered = useMemo(() => {
    const map = new Map(memories.map((m) => [m.id, m]))
    const list = order.map((id) => map.get(id)).filter((m): m is Memory => !!m)
    return list.length === memories.length ? list : memories
  }, [order, memories])

  const stable = useRef({
    move: (e: PointerEvent) => onMoveRef.current(e),
    up: (e: PointerEvent) => onUpRef.current(e),
    cancel: (e: PointerEvent) => onCancelRef.current(e),
    touch: (e: TouchEvent) => onTouchRef.current(e),
  })

  const endPress = useCallback(() => {
    const st = press.current
    if (!st) return
    window.clearTimeout(st.timer)
    window.removeEventListener('pointermove', stable.current.move)
    window.removeEventListener('pointerup', stable.current.up)
    window.removeEventListener('pointercancel', stable.current.cancel)
    window.removeEventListener('touchmove', stable.current.touch)
    press.current = null
    setDragId(null)
    setOffset(null)
  }, [])

  const onMoveRef = useRef<(e: PointerEvent) => void>(() => {})
  const onUpRef = useRef<(e: PointerEvent) => void>(() => {})
  const onCancelRef = useRef<(e: PointerEvent) => void>(() => {})
  const onTouchRef = useRef<(e: TouchEvent) => void>(() => {})

  onTouchRef.current = (e) => { if (press.current?.active && e.cancelable) e.preventDefault() }
  onMoveRef.current = (e) => {
    const st = press.current
    if (!st) return
    const d = Math.hypot(e.clientX - st.sx, e.clientY - st.sy)
    if (!st.active) { if (d > 9) endPress(); return }
    if (d > 8) st.moved = true
    // nearest slot to the pointer
    let best = st.idx, bd = Infinity
    st.slots.forEach((r, i) => {
      const dd = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2))
      if (dd < bd) { bd = dd; best = i }
    })
    if (best !== st.idx) {
      const next = [...orderRef.current]
      const [it] = next.splice(st.idx, 1)
      next.splice(best, 0, it)
      orderRef.current = next
      st.idx = best
      navigator.vibrate?.(8)
      setOrder(next)
    }
    const slot = st.slots[st.idx]
    setOffset({ x: e.clientX - st.gx - slot.left, y: e.clientY - st.gy - slot.top })
  }
  onUpRef.current = () => {
    const st = press.current
    if (!st) return
    const m = memRef.current.find((x) => x.id === st.id)
    if (!st.active) {
      const el = document.querySelector(`[data-book-id="${st.id}"]`)
      const r = el?.getBoundingClientRect()
      endPress()
      if (m && r) cb.current.onOpen(m, r)
      return
    }
    const moved = st.moved
    const ids = orderRef.current
    // keep the order we show until the saved list comes back
    press.current = { ...st, active: false }
    endPress()
    if (!moved) { if (m) cb.current.openMenu(m) }
    else if (ids.join() !== memRef.current.map((x) => x.id).join()) cb.current.onReorder(ids)
  }
  onCancelRef.current = () => endPress()

  const onPress = useCallback((e: React.PointerEvent, m: Memory) => {
    if (press.current || (e.pointerType === 'mouse' && e.button !== 0)) return
    const idx = orderRef.current.indexOf(m.id)
    const st = {
      id: m.id, sx: e.clientX, sy: e.clientY, active: false, moved: false, slots: [] as DOMRect[], idx, gx: 0, gy: 0,
      timer: window.setTimeout(() => {
        const s = press.current
        if (!s) return
        s.slots = [...document.querySelectorAll('[data-book-wrap]')].map((el) => el.getBoundingClientRect())
        const r = s.slots[s.idx]
        if (!r) return endPress()
        s.gx = s.sx - r.left
        s.gy = s.sy - r.top
        s.active = true
        navigator.vibrate?.(14)
        setDragId(s.id)
        setOffset({ x: 0, y: 0 })
      }, 450),
    }
    press.current = st
    window.addEventListener('pointermove', stable.current.move)
    window.addEventListener('pointerup', stable.current.up)
    window.addEventListener('pointercancel', stable.current.cancel)
    window.addEventListener('touchmove', stable.current.touch, { passive: false })
  }, [endPress])

  useEffect(() => endPress, [endPress])
  const closeMenu = () => setMenuOpen(false)
  const act = (fn: (m: Memory) => void) => () => { if (menu) fn(menu); closeMenu() }

  return (
    <div className="relative mx-auto min-h-full max-w-[520px]" style={{ background: 'linear-gradient(180deg,#fff 0%,#fff 55%,#f1f3f8 100%)' }}>
      <header className="flex items-center justify-between px-6" style={{ paddingTop: 'calc(var(--safe-top) + 28px)' }}>
        <h1 className="m-0 text-[34px] font-extrabold leading-none tracking-tight">Memories</h1>
        <IconButton label={user ? `Profile and settings (${user.name})` : 'Sign in and settings'} onClick={onSettings} className={user ? '!p-0 overflow-hidden' : ''}>
          {user ? (
            user.photo ? (
              <img src={user.photo} alt="" referrerPolicy="no-referrer" className="h-full w-full rounded-full object-cover" />
            ) : (
              <span className="grid h-full w-full place-items-center rounded-full bg-[#17171a] text-[16px] font-bold text-white">{user.name.slice(0, 1).toUpperCase()}</span>
            )
          ) : (
            <User size={21} strokeWidth={2} />
          )}
        </IconButton>
      </header>

      <main className="px-6 pt-8" style={{ paddingBottom: 'calc(var(--safe-bottom) + 150px)' }}>
        {!loading && memories.length === 0 ? (
          <motion.div
            className="flex flex-col items-center px-6 pt-10 text-center"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
          >
            <motion.div
              className="w-[46%]"
              animate={{ y: [0, -8, 0], rotate: [-2, 2, -2] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
            >
              <BookCover memory={{ title: 'Our first memory', themeId: 'romantic', cover: { type: 'color', value: '#9DB7D5' }, date: new Date().toISOString().slice(0, 10) }} />
            </motion.div>
            <h2 className="mb-1 mt-10 text-[22px] font-extrabold">Your shelf is empty</h2>
            <p className="m-0 max-w-[260px] text-[14.5px] leading-relaxed text-neutral-500">
              Start a scrapbook for a date, a trip or a hangout. Tap <b className="text-[#17171a]">Add memory</b> below.
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-x-5 gap-y-12">
            <AnimatePresence mode="popLayout">
              {ordered.map((m, i) => (
                <BookCard
                  key={m.id} memory={m} index={i} hidden={hiddenId === m.id}
                  dragging={dragId === m.id} offset={dragId === m.id ? offset : null}
                  onPress={onPress} onKeyOpen={onOpen}
                />
              ))}
            </AnimatePresence>
          </div>
        )}
      </main>

      <div className="pointer-events-none fixed inset-x-0 z-30 flex justify-center" style={{ bottom: 'calc(var(--safe-bottom) + 22px)' }}>
        <motion.button
          type="button"
          onClick={onAdd}
          className="no-select pointer-events-auto flex h-14 items-center gap-2.5 rounded-full border-0 bg-[#17171a] pl-5 pr-6 text-[16px] font-semibold text-white outline-none"
          style={{ boxShadow: '0 12px 32px rgba(10,12,24,.32), 0 2px 6px rgba(10,12,24,.2)' }}
          initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24, delay: 0.25 }}
          whileTap={{ scale: 0.96 }}
        >
          <Plus size={20} strokeWidth={2.6} aria-hidden /> Add memory
        </motion.button>
      </div>

      <ToolSheet open={menuOpen} onClose={closeMenu} snaps={[0.44]} title={menu?.title} z={60}>
        <div className="px-3 pb-2">
          <MenuRow icon={<PenLine size={19} />} label="Edit book" onClick={act(onEdit)} />
          <MenuRow icon={<Palette size={19} />} label="Change theme" onClick={act(onTheme)} />
          <MenuRow icon={<Copy size={19} />} label="Duplicate" onClick={act(onDuplicate)} />
          <MenuRow danger icon={<Trash2 size={19} />} label="Delete" onClick={() => { setConfirm(menu); closeMenu() }} />
        </div>
      </ToolSheet>

      <ConfirmDialog
        open={!!confirm}
        title="Delete this book?"
        message={`“${confirm?.title ?? ''}” and everything on its canvas will be removed. This can't be undone.`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => { if (confirm) onDelete(confirm); setConfirm(null) }}
      />
    </div>
  )
}
