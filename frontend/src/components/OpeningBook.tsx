import { animate, motion, useTransform, type MotionValue } from 'framer-motion'
import { useEffect } from 'react'
import type { Memory } from '../types'
import { bookPose, LEAVES, leafSwing } from '../lib/bookTransition'
import { BookCover } from './BookCard'

/**
 * Book ⇄ canvas transition. The book lifts off its shelf slot and flies to the middle of the screen, then opens from
 * there: the cover swings away on its spine (3D rotateY) while the page grows to fill the screen. Closing plays it
 * backwards. The canvas itself is revealed through a matching clip-path (see Canvas `reveal`).
 */
export function OpeningBook({
  memory, rect, mode, progress, onDone,
}: { memory: Memory; rect: DOMRect; mode: 'open' | 'close'; progress: MotionValue<number>; onDone: () => void }) {
  /** ?slowbook=4 plays the animation four times slower (for checking how it looks) */
  const slow = Math.min(8, Number(new URLSearchParams(window.location.search).get('slowbook')) || 1)
  const x = useTransform(progress, (v) => bookPose(rect, v).x)
  const y = useTransform(progress, (v) => bookPose(rect, v).y)
  const scale = useTransform(progress, (v) => bookPose(rect, v).scale)
  const rotateY = useTransform(progress, (v) => bookPose(rect, v).swing)

  useEffect(() => {
    const c = animate(progress, mode === 'open' ? 1 : 0, { duration: 2.4 * slow, ease: 'linear' })
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
        {/* the pages under the cover: they turn one after another once it has opened */}
        {Array.from({ length: LEAVES }, (_, k) => LEAVES - 1 - k).map((i) => (
          <Leaf key={i} i={i} rect={rect} progress={progress} />
        ))}
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

/** one page of paper that swings on the spine: ruled paper on both sides, shaded as it turns so it looks like it has depth */
function Leaf({ i, rect, progress }: { i: number; rect: DOMRect; progress: MotionValue<number> }) {
  const rotateY = useTransform(progress, (v) => leafSwing(v, i))
  // darker while it stands up edge-on, lighter when it lies flat
  const shade = useTransform(rotateY, (a) => 0.22 * Math.abs(Math.sin((a * Math.PI) / 180)))
  const radius = `${rect.width * 0.05}px ${rect.width * 0.022}px ${rect.width * 0.022}px ${rect.width * 0.05}px`
  const lines = 'repeating-linear-gradient(180deg, transparent 0 15px, rgba(120,100,70,.09) 15px 16px)'
  const face = (dir: string) => `${lines}, linear-gradient(${dir}, #e2dac7 0%, #f5efe3 10%, #fbf8f1 100%)`
  const side = { position: 'absolute' as const, inset: 0, backfaceVisibility: 'hidden' as const, borderRadius: radius }
  return (
    <motion.div className="absolute inset-0" style={{ rotateY, transformOrigin: 'left center', transformStyle: 'preserve-3d' }}>
      <div style={{ ...side, background: face('90deg'), boxShadow: 'inset -1px 0 0 rgba(0,0,0,.08)' }}>
        <motion.div className="absolute inset-0" style={{ background: '#2a2118', opacity: shade, borderRadius: radius }} />
      </div>
      <div style={{ ...side, transform: 'rotateY(180deg)', background: face('270deg') }}>
        <motion.div className="absolute inset-0" style={{ background: '#2a2118', opacity: shade, borderRadius: radius }} />
      </div>
    </motion.div>
  )
}
