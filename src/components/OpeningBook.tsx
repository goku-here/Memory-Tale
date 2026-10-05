import { motion } from 'framer-motion'
import { useEffect } from 'react'
import type { Memory } from '../types'
import { BookCover } from './BookCard'
import { getTheme } from './ThemeEngine'

const EASE = [0.5, 0, 0.12, 1] as const

/**
 * Shared-element book → canvas transition: the book grows from its grid slot to fill the
 * screen while the cover swings open from the spine (3D rotateY), then the overlay fades
 * away to reveal the canvas that is already mounted underneath.
 */
export function OpeningBook({
  memory, rect, mode, onReveal, onDone,
}: { memory: Memory; rect: DOMRect; mode: 'open' | 'close'; onReveal?: () => void; onDone: () => void }) {
  const closing = mode === 'close'
  useEffect(() => {
    if (closing) return
    const t = window.setTimeout(() => onReveal?.(), 760)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
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
      animate={{ opacity: closing ? 1 : [1, 1, 0] }}
      transition={closing ? { duration: 0.95 } : { duration: 1.1, times: [0, 0.74, 1], ease: 'linear' }}
      onAnimationComplete={closing ? undefined : onDone}
    >
      <motion.div
        style={{
          position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height,
          transformStyle: 'preserve-3d', willChange: 'transform',
        }}
        initial={closing ? { x: dx, y: dy, scale } : { x: 0, y: 0, scale: 1 }}
        animate={closing ? { x: 0, y: 0, scale: 1 } : { x: dx, y: dy, scale }}
        transition={{ duration: 0.85, ease: EASE }}
        onAnimationComplete={closing ? onDone : undefined}
      >
        {/* first page under the cover */}
        <div className="absolute inset-0" style={{ background: `radial-gradient(${theme.dot} ${rect.width * 0.009}px, transparent ${rect.width * 0.0105}px) 0 0 / ${rect.width * 0.056}px ${rect.width * 0.056}px, ${theme.canvasBg}`, borderRadius: `${rect.width * 0.022}px ${rect.width * 0.05}px ${rect.width * 0.05}px ${rect.width * 0.022}px` }} />
        {/* cover + inside face, hinged on the spine */}
        <motion.div
          className="absolute inset-0"
          style={{ transformOrigin: 'left center', transformStyle: 'preserve-3d' }}
          initial={{ rotateY: closing ? -172 : 0 }}
          animate={{ rotateY: closing ? 0 : -172 }}
          transition={{ delay: closing ? 0.08 : 0.12, duration: 0.75, ease: EASE }}
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
