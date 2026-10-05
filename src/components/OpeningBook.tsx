import { motion } from 'framer-motion'
import type { Memory } from '../types'
import { BookCover } from './BookCard'
import { getTheme } from './ThemeEngine'

const EASE = [0.5, 0, 0.12, 1] as const

/**
 * Shared-element book → canvas transition: the book grows from its grid slot to fill the
 * screen while the cover swings open from the spine (3D rotateY), then the overlay fades
 * away to reveal the canvas that is already mounted underneath.
 */
export function OpeningBook({ memory, rect, onDone }: { memory: Memory; rect: DOMRect; onDone: () => void }) {
  const theme = getTheme(memory.themeId)
  const vw = window.innerWidth
  const vh = window.innerHeight
  const scale = Math.max(vh / rect.height, vw / rect.width) * 1.06
  const dx = vw / 2 - (rect.left + rect.width / 2)
  const dy = vh / 2 - (rect.top + rect.height / 2)

  return (
    <motion.div
      className="fixed inset-0 z-[100]"
      style={{ perspective: 1500, pointerEvents: 'none' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: 1.05, times: [0, 0.78, 1], ease: 'linear' }}
      onAnimationComplete={onDone}
    >
      <motion.div
        style={{
          position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height,
          transformStyle: 'preserve-3d',
        }}
        initial={{ x: 0, y: 0, scale: 1 }}
        animate={{ x: dx, y: dy, scale }}
        transition={{ duration: 0.85, ease: EASE }}
      >
        {/* first page under the cover */}
        <div className="absolute inset-0" style={{ background: theme.canvasBg, borderRadius: `${rect.width * 0.022}px ${rect.width * 0.05}px ${rect.width * 0.05}px ${rect.width * 0.022}px` }} />
        {/* cover + inside face, hinged on the spine */}
        <motion.div
          className="absolute inset-0"
          style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d' }}
          initial={{ rotateY: 0 }}
          animate={{ rotateY: -172 }}
          transition={{ delay: 0.12, duration: 0.75, ease: EASE }}
        >
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
            <BookCover memory={memory} />
          </div>
          <div
            className="absolute inset-0"
            style={{
              transform: 'rotateY(180deg)', backfaceVisibility: 'hidden',
              background: 'linear-gradient(270deg,#efe8da,#f7f2e8)', borderRadius: `${rect.width * 0.05}px ${rect.width * 0.022}px ${rect.width * 0.022}px ${rect.width * 0.05}px`,
            }}
          />
        </motion.div>
      </motion.div>
    </motion.div>
  )
}
