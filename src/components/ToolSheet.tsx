import { animate, motion, useDragControls, useMotionValue, useTransform } from 'framer-motion'
import { useEffect, useRef, useState, type ReactNode } from 'react'

function useViewportHeight() {
  const [h, setH] = useState(() => window.innerHeight)
  useEffect(() => {
    const on = () => setH(window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return h
}

const SPRING = { type: 'spring', stiffness: 420, damping: 38, mass: 0.9 } as const

export interface ToolSheetProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  title?: string
  /** visible-height snap points as fractions of the viewport, ascending. */
  snaps?: number[]
  initialSnap?: number
  /** backdrop darkness 0..1 */
  dim?: number
  z?: number
  /** reports how many px of the screen the sheet currently covers (0 when closed) */
  onVisibleHeight?: (px: number) => void
  /** let taps on the backdrop through to what is underneath (tool sheets over the canvas) */
  passThrough?: boolean
}

/**
 * Bottom sheet with a drag handle, dimmed backdrop and snap points.
 * Springs up, swipe down on the handle/header to snap or dismiss.
 */
export function ToolSheet({
  open, onClose, children, title, snaps = [0.5, 0.92], initialSnap = 0,
  dim = 0.32, z = 50, onVisibleHeight, passThrough,
}: ToolSheetProps) {
  const vh = useViewportHeight()
  const top = snaps[snaps.length - 1]
  const H = Math.round(vh * top)
  const yFor = (i: number) => H - Math.round(vh * snaps[i])
  const y = useMotionValue(H)
  const controls = useDragControls()
  const [mounted, setMounted] = useState(open)
  const [idx, setIdx] = useState(initialSnap)
  const idxRef = useRef(idx)
  idxRef.current = idx
  const backdrop = useTransform(y, [H, yFor(snaps.length - 1)], [0, dim])

  useEffect(() => {
    if (open) {
      setMounted(true)
      setIdx(initialSnap)
      y.set(H)
      const c = animate(y, yFor(initialSnap), SPRING)
      return () => c.stop()
    }
    if (mounted) {
      const c = animate(y, H, { type: 'tween', duration: 0.24, ease: [0.4, 0, 1, 1] })
      c.then(() => setMounted(false))
      return () => c.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // keep the position correct when the viewport changes (rotation / keyboard)
  useEffect(() => {
    if (open && mounted) animate(y, yFor(idxRef.current), SPRING)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vh])

  useEffect(() => {
    onVisibleHeight?.(open ? Math.round(vh * snaps[idx]) : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx, vh])

  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])

  if (!mounted) return null

  const hidden = Math.round(vh * (top - snaps[idx]))

  return (
    <div className="fixed inset-0" style={{ zIndex: z, pointerEvents: 'none' }}>
      <motion.div
        aria-hidden
        className="absolute inset-0 bg-black"
        style={{ opacity: backdrop, pointerEvents: open && !passThrough ? 'auto' : 'none' }}
        onPointerDown={() => open && onClose()}
      />
      <motion.div
        role="dialog"
        aria-modal={!passThrough}
        aria-label={title ?? 'Sheet'}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-w-[520px] flex-col rounded-t-[30px] bg-white"
        style={{
          y, height: H, pointerEvents: 'auto',
          boxShadow: '0 -10px 40px rgba(20,24,40,.18)',
        }}
        drag="y"
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: H }}
        dragElastic={{ top: 0.04, bottom: 0.15 }}
        dragMomentum={false}
        onDragEnd={(_, info) => {
          const projected = y.get() + info.velocity.y * 0.2
          const targets = [...snaps.map((_, i) => yFor(i)), H]
          let best = targets[0], bi = 0
          targets.forEach((t, i) => { if (Math.abs(t - projected) < Math.abs(best - projected)) { best = t; bi = i } })
          if (bi === targets.length - 1) { onClose(); return }
          setIdx(bi)
          animate(y, best, SPRING)
        }}
      >
        <div
          className="no-select shrink-0 cursor-grab touch-none"
          onPointerDown={(e) => controls.start(e)}
        >
          <div className="mx-auto mt-2.5 h-[5px] w-10 rounded-full bg-neutral-300" />
          {title ? (
            <div className="px-6 pb-2 pt-3 text-center text-[15px] font-extrabold">{title}</div>
          ) : (
            <div className="h-3" />
          )}
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{ paddingBottom: hidden + 24 + 0, touchAction: 'pan-y' }}
        >
          {children}
          <div style={{ height: 'var(--safe-bottom)' }} />
        </div>
      </motion.div>
    </div>
  )
}
