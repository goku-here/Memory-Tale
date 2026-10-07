import { animate, motion, useTransform, type MotionValue } from 'framer-motion'
import { useEffect } from 'react'
import type { Memory } from '../types'
import { bookEase, bookGeom, clamp01 } from '../lib/bookTransition'
import { BookCover } from './BookCard'

/**
 * Book ⇄ canvas transition. The cover grows out of (or shrinks back into) its grid slot while
 * swinging on the spine (3D rotateY). The canvas itself is revealed through a matching clip-path
 * (see Canvas `reveal`), so the real content is visible as the cover opens.
 */
export function OpeningBook({
  memory, rect, mode, progress, onDone,
}: { memory: Memory; rect: DOMRect; mode: 'open' | 'close'; progress: MotionValue<number>; onDone: () => void }) {
  const { S, dx, dy } = bookGeom(rect)
  const e = useTransform(progress, (v) => bookEase(v))
  const x = useTransform(e, (v) => dx * v)
  const y = useTransform(e, (v) => dy * v)
  const scale = useTransform(e, (v) => 1 + (S - 1) * v)
  const rotateY = useTransform(progress, (v) => -172 * bookEase(clamp01((v - 0.08) / 0.82)))

  useEffect(() => {
    const c = animate(progress, mode === 'open' ? 1 : 0, { duration: 1.0, ease: 'linear' })
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
