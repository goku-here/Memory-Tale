import { AnimatePresence, motion } from 'framer-motion'
import { Image as ImageIcon, MapPin, MoreHorizontal, Smile, StickyNote, Type, Flag } from 'lucide-react'
import { useState, type ReactNode } from 'react'

export type ToolId = 'sticker' | 'draw' | 'text' | 'photo' | 'note' | 'location' | 'divider'

interface Props {
  visible: boolean
  accent: string
  onTool: (t: ToolId) => void
}

function Btn({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <motion.button
      type="button" aria-label={label} title={label} aria-pressed={active} whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      onClick={onClick}
      className="grid h-12 w-12 place-items-center rounded-full border-0 bg-transparent text-[#17171a]"
      style={active ? { background: 'rgba(23,23,26,.08)' } : undefined}
    >
      {children}
    </motion.button>
  )
}

export function BottomToolbar({ visible, onTool }: Props) {
  const [more, setMore] = useState(false)
  const pick = (t: ToolId) => { setMore(false); onTool(t) }
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          data-ui
          className="pointer-events-none fixed inset-x-0 z-40 flex justify-center"
          style={{ bottom: 'calc(var(--safe-bottom) + 18px)' }}
          initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        >
          {more && <div className="pointer-events-auto fixed inset-0" onPointerDown={() => setMore(false)} />}
          <div className="relative">
            <AnimatePresence>
              {more && (
                <motion.div
                  role="menu"
                  className="pointer-events-auto absolute bottom-[68px] right-0 w-48 origin-bottom-right rounded-3xl bg-white p-1.5"
                  style={{ boxShadow: '0 14px 40px rgba(20,24,40,.22), 0 0 0 1px rgba(20,24,40,.04)' }}
                  initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 6 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 30 }}
                >
                  {([
                    ['note', 'Sticky note', <StickyNote size={19} key="n" />],
                    ['location', 'Location', <MapPin size={19} key="l" />],
                    ['divider', 'Stop divider', <Flag size={19} key="d" />],
                  ] as [ToolId, string, ReactNode][]).map(([id, label, icon]) => (
                    <motion.button
                      key={id} type="button" role="menuitem" whileTap={{ scale: 0.96 }} onClick={() => pick(id)}
                      className="flex min-h-12 w-full items-center gap-3 rounded-2xl border-0 bg-transparent px-3 text-left text-[15px] font-semibold text-[#17171a]"
                    >
                      {icon}{label}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
            <div
              className="pointer-events-auto flex items-center gap-1 rounded-full bg-white p-2"
              style={{ boxShadow: '0 10px 34px rgba(20,24,40,.2), 0 2px 6px rgba(20,24,40,.08), 0 0 0 1px rgba(20,24,40,.04)' }}
            >
              <Btn label="Sticker" onClick={() => pick('sticker')}><Smile size={23} strokeWidth={1.9} /></Btn>
              <Btn label="Draw" onClick={() => pick('draw')}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M15.2 3.6a2.1 2.1 0 0 1 3 3L8.4 16.4 4.6 17.4l1-3.8Z" />
                  <path d="m13.6 5.2 3 3" />
                  <path d="M3 21c2.2-2.2 3.6 1.2 6 0s3.6-2.6 5.4-1.2 3.2.4 4.6-.8" />
                </svg></Btn>
              <Btn label="Text" onClick={() => pick('text')}><Type size={23} strokeWidth={1.9} /></Btn>
              <Btn label="Photo" onClick={() => pick('photo')}><ImageIcon size={23} strokeWidth={1.9} /></Btn>
              <span className="mx-1 h-7 w-px bg-neutral-200" aria-hidden />
              <Btn label="More" active={more} onClick={() => setMore((v) => !v)}><MoreHorizontal size={23} strokeWidth={1.9} /></Btn>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
