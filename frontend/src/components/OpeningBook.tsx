import { animate, motion, useTransform, type MotionValue } from 'framer-motion'
import { useEffect } from 'react'
import type { Memory } from '../types'
import { bookPose } from '../lib/bookTransition'
import { BookCover } from './BookCard'

/**
 * Book ⇄ canvas transition. The book lifts off its shelf slot and flies to the middle of the screen, then opens from
 * there: the cover swings away on its spine (3D rotateY) while the page grows to fill the screen. Closing plays it
 * backwards. The canvas itself is revealed through a matching clip-path (see Canvas `reveal`).
 */
export function OpeningBook({
  memory, rect, mode, progress, onDone,
}: { memory: Memory; rect: DOMRect; mode: 'open' | 'close'; progress: MotionValue<number>; onDone: () => void }) {
  const x = useTransform(progress, (v) => bookPose(rect, v).x)
  const y = useTransform(progress, (v) => bookPose(rect, v).y)
  const scale = useTransform(progress, (v) => bookPose(rect, v).scale)
  const rotateY = useTransform(progress, (v) => bookPose(rect, v).swing)

  useEffect(() => {
    const c = animate(progress, mode === 'open' ? 1 : 0, { duration: 1.3, ease: 'linear' })
    c.then(onDone)
    return () => c.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="pointer-events-none fixed inset-0 z-[100]" style={{ perspective: 1500 }}>
      <motion.div
        style={{
          position: 'absolute', left: rect.left, top: rect.top, width: rect.width, height: rect.height,
          x, y, scale, transformStyle: 'preserve-3d', willChange: 'transform',
        }}
      >
        <motion.div className="absolute inset-0" style={{ rotateY, transformOrigin: 'left center', transformStyle: 'preserve-3d' }}>
          <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
            <BookCover memory={memory} />
          </div>
          <div
            className="absolute inset-0"
            style={{
              transform: 'rotateY(180deg)', backfaceVisibility: 'hidden',
              background: 'linear-gradient(270deg,#efe8da,#f7f2e8)',
              borderRadius: `${rect.width * 0.05}px ${rect.width * 0.022}px ${rect.width * 0.022}px ${rect.width * 0.05}px`,
            }}
          />
        </motion.div>
      </motion.div>
    </div>
  )
}
