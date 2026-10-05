import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { ArrowLeft, Check, MoreHorizontal, Palette, PenLine, Share2, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Memory } from '../types'
import { formatDate } from './BookCard'
import { FloatingShapes, getTheme, themeVars } from './ThemeEngine'
import { IconButton } from './ui'

interface CanvasProps {
  memory: Memory
  onBack: () => void
  onEdit: () => void
  onTheme: () => void
  onShare: () => void
  onDelete: () => void
}

function MenuItem({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <motion.button
      type="button" role="menuitem" whileTap={{ scale: 0.97 }} onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left text-[15px] font-semibold ${danger ? 'text-[#d6455d]' : 'text-[#17171a]'}`}
    >
      {icon}
      {label}
    </motion.button>
  )
}

export function Canvas({ memory, onBack, onEdit, onTheme, onShare, onDelete }: CanvasProps) {
  const theme = getTheme(memory.themeId)
  const scroller = useRef<HTMLDivElement>(null)
  const scrollY = useMotionValue(0)
  const [menu, setMenu] = useState(false)
  const [photos] = useState(0)

  useEffect(() => { scroller.current?.scrollTo(0, 0) }, [])

  // header parallax: title shrinks and drifts, subtitle fades
  const titleScale = useTransform(scrollY, [0, 120], [1, 0.78])
  const titleY = useTransform(scrollY, [0, 120], [0, -6])
  const subOpacity = useTransform(scrollY, [0, 80], [1, 0])

  const run = (fn: () => void) => () => { setMenu(false); fn() }

  return (
    <motion.div
      className="fixed inset-0 z-40"
      style={{ ...themeVars(theme), background: theme.canvasBg }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
    >
      <div
        ref={scroller}
        className="absolute inset-0 overflow-y-auto overflow-x-hidden"
        onScroll={(e) => scrollY.set(e.currentTarget.scrollTop)}
      >
        <div className="relative mx-auto max-w-[520px]" style={{ minHeight: '100%' }}>
          {/* header */}
          <header
            className="sticky top-0 z-30 px-4 pb-4"
            style={{
              paddingTop: 'calc(var(--safe-top) + 12px)',
              background: `linear-gradient(${theme.canvasBg} 72%, ${theme.canvasBg}00)`,
            }}
          >
            <div className="relative flex items-center justify-between">
              <IconButton label="Back" onClick={onBack}><ArrowLeft size={21} /></IconButton>
              <motion.h1
                className="absolute inset-x-14 m-0 truncate text-center text-[26px] font-extrabold leading-tight tracking-tight"
                style={{ scale: titleScale, y: titleY }}
              >
                {memory.title}
              </motion.h1>
              <div className="relative">
                <IconButton label="More options" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
                  <MoreHorizontal size={21} />
                </IconButton>
                <AnimatePresence>
                  {menu && (
                    <>
                      <div className="fixed inset-0 z-40" onPointerDown={() => setMenu(false)} />
                      <motion.div
                        role="menu"
                        className="absolute right-0 top-[52px] z-50 w-52 origin-top-right rounded-2xl bg-white p-1.5 shadow-[0_14px_40px_rgba(20,24,40,.22)]"
                        initial={{ opacity: 0, scale: 0.85, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                      >
                        <MenuItem icon={<PenLine size={18} />} label="Edit book" onClick={run(onEdit)} />
                        <MenuItem icon={<Palette size={18} />} label="Change theme" onClick={run(onTheme)} />
                        <MenuItem icon={<Share2 size={18} />} label="Share" onClick={run(onShare)} />
                        <MenuItem danger icon={<Trash2 size={18} />} label="Delete" onClick={run(onDelete)} />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <motion.p
              className="m-0 mt-[52px] text-center text-[14px] font-semibold text-neutral-400"
              style={{ opacity: subOpacity }}
            >
              {photos} {photos === 1 ? 'Photo' : 'Photos'} <span className="mx-1">•</span> {formatDate(memory.date)}
            </motion.p>
            <div className="mt-2 flex items-center justify-center gap-1 text-[12px] font-bold text-neutral-400">
              <Check size={13} strokeWidth={3} /> Saved
            </div>
          </header>

          {/* the infinite canvas surface */}
          <div
            className="relative"
            style={{
              height: 2400,
              backgroundImage: `radial-gradient(${theme.dot} 1.5px, transparent 1.7px)`,
              backgroundSize: '22px 22px',
              marginTop: -40,
            }}
          >
            <FloatingShapes theme={theme} />
          </div>
        </div>
      </div>
    </motion.div>
  )
}
