import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Palette, PenLine, Plus, Settings, Trash2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { Memory } from '../types'
import { BookCard, BookCover } from './BookCard'
import { ToolSheet } from './ToolSheet'
import { ConfirmDialog, IconButton, toast } from './ui'

interface HomeProps {
  memories: Memory[]
  loading: boolean
  hiddenId?: string | null
  onAdd: () => void
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

export function Home({ memories, loading, hiddenId, onAdd, onOpen, onEdit, onTheme, onDuplicate, onDelete }: HomeProps) {
  const [menu, setMenu] = useState<Memory | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirm, setConfirm] = useState<Memory | null>(null)

  const openMenu = (m: Memory) => { setMenu(m); setMenuOpen(true) }
  const closeMenu = () => setMenuOpen(false)
  const act = (fn: (m: Memory) => void) => () => { if (menu) fn(menu); closeMenu() }

  return (
    <div className="relative mx-auto min-h-full max-w-[520px]" style={{ background: 'linear-gradient(180deg,#fff 0%,#fff 55%,#f1f3f8 100%)' }}>
      <header className="flex items-center justify-between px-6" style={{ paddingTop: 'calc(var(--safe-top) + 28px)' }}>
        <h1 className="m-0 text-[34px] font-extrabold leading-none tracking-tight">Memories</h1>
        <IconButton label="Settings" onClick={() => toast('Settings are coming soon')}>
          <Settings size={21} strokeWidth={2} />
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
              {memories.map((m, i) => (
                <BookCard key={m.id} memory={m} index={i} hidden={hiddenId === m.id} onOpen={onOpen} onLongPress={openMenu} />
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
