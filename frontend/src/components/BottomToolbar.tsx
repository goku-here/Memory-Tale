import { AnimatePresence, motion } from 'framer-motion'
import { Camera, Image as ImageIcon } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { IcBubble, IcDraw, IcFlag, IcGrid, IcLine, IcMore, IcNote, IcPhoto, IcPhone, IcPin, IcSticker, IcText } from './ToolIcons'

export type ToolId = 'sticker' | 'draw' | 'text' | 'photo' | 'camera' | 'note' | 'location' | 'divider' | 'bubble' | 'line' | 'story' | 'canvas'

interface Props {
  visible: boolean
  accent: string
  onTool: (t: ToolId) => void
  /** story mode is already on: hide its menu entry */
  inStory?: boolean
}

function Btn({ label, active, onClick, children, tour }: { label: string; active?: boolean; onClick: () => void; children: ReactNode; tour?: string }) {
  return (
    <motion.button
      type="button" aria-label={label} title={label} aria-pressed={active} data-tour={tour} whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 500, damping: 28 }}
      onClick={onClick}
      className="grid h-[58px] w-[56px] place-items-center rounded-2xl border-0 bg-transparent text-[#17171a]"
      style={active ? { background: 'rgba(23,23,26,.08)' } : undefined}
    >
      <span className="flex flex-col items-center gap-1 leading-none">
        {children}
        <span className="text-[10px] font-extrabold tracking-tight text-neutral-500">{label}</span>
      </span>
    </motion.button>
  )
}

export function BottomToolbar({ visible, onTool, inStory }: Props) {
  const [more, setMore] = useState(false)
  const [photoMenu, setPhotoMenu] = useState(false)
  const pick = (t: ToolId) => { setMore(false); setPhotoMenu(false); onTool(t) }
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
          {(more || photoMenu) && <div className="pointer-events-auto fixed inset-0" onPointerDown={() => { setMore(false); setPhotoMenu(false) }} />}
          <div className="relative">
            <AnimatePresence>
              {photoMenu && (
                <motion.div
                  role="menu" aria-label="Add a photo"
                  className="pointer-events-auto absolute bottom-[84px] right-12 w-56 origin-bottom rounded-3xl bg-white p-1.5"
                  style={{ boxShadow: '0 14px 40px rgba(20,24,40,.22), 0 0 0 1px rgba(20,24,40,.04)' }}
                  initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 6 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 30 }}
                >
                  {([
                    ['camera', 'Take a photo', <Camera size={19} key="c" />],
                    ['photo', 'Choose from gallery', <ImageIcon size={19} key="g" />],
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
              {more && (
                <motion.div
                  role="menu"
                  className="pointer-events-auto absolute bottom-[84px] right-0 w-56 origin-bottom-right rounded-3xl bg-white p-1.5"
                  style={{ boxShadow: '0 14px 40px rgba(20,24,40,.22), 0 0 0 1px rgba(20,24,40,.04)' }}
                  initial={{ opacity: 0, scale: 0.8, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.85, y: 6 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 30 }}
                >
                  {([
                    ['note', 'Sticky note', <IcNote key="n" />],
                    ['bubble', 'Chat bubble', <IcBubble key="b" />],
                    ['line', 'Polaroid line', <IcLine key="p" />],
                    ['location', 'Location', <IcPin key="l" />],
                    ['divider', 'Stop divider', <IcFlag key="d" />],
                    ['canvas', 'Canvas style', <IcGrid key="g" />],
                    ['story', 'Story mode', <IcPhone key="s" />],
                  ] as [ToolId, string, ReactNode][]).filter(([id]) => !(inStory && id === 'story')).map(([id, label, icon]) => (
                    <motion.button
                      key={id} data-tour={id === 'story' ? 'story-item' : undefined} type="button" role="menuitem" whileTap={{ scale: 0.96 }} onClick={() => pick(id)}
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
              <Btn label="Sticker" tour="sticker" onClick={() => pick('sticker')}><IcSticker /></Btn>
              <Btn label="Draw" onClick={() => pick('draw')}><IcDraw /></Btn>
              <Btn label="Text" onClick={() => pick('text')}><IcText /></Btn>
              <Btn label="Photo" tour="photo" active={photoMenu} onClick={() => { setMore(false); setPhotoMenu((v) => !v) }}><IcPhoto /></Btn>
              <span className="mx-1 h-7 w-px bg-neutral-200" aria-hidden />
              <Btn label="More" tour="more" active={more} onClick={() => { setPhotoMenu(false); setMore((v) => !v) }}><IcMore /></Btn>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
