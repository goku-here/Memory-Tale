import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useTransform } from 'framer-motion'
import { X } from 'lucide-react'
import { useDesktop } from '../lib/useDesktop'
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
  /** move to this snap point while the sheet is open (e.g. a page inside it needs more room) */
  snapTo?: number
}

/**
 * Bottom sheet with a drag handle, dimmed backdrop and snap points.
 * Springs up, swipe down on the handle/header to snap or dismiss.
 */
export function ToolSheet({
  open, onClose, children, title, snaps = [0.5, 0.92], initialSnap = 0,
  dim = 0.32, z = 50, onVisibleHeight, passThrough, snapTo,
}: ToolSheetProps) {
  const vh = useViewportHeight()
  const desk = useDesktop()
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

  // a page inside the sheet asks for another height
  useEffect(() => {
    if (!open || !mounted || snapTo === undefined || snapTo === idxRef.current) return
    setIdx(snapTo)
    const c = animate(y, yFor(snapTo), SPRING)
    return () => c.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapTo])

  // keep the position correct when the viewport changes (rotation / keyboard)
  useEffect(() => {
    if (open && mounted) animate(y, yFor(idxRef.current), SPRING)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vh])

  useEffect(() => {
    // a side panel or dialog does not cover the bottom of the page
    onVisibleHeight?.(open && !desk ? Math.round(vh * snaps[idx]) : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idx, vh, desk])

  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])

  if (desk) {
    // tool sheets (little dimming) sit beside the page so the page stays in reach; the rest are dialogs in the middle
    const side = dim <= 0.2
    return (
      <AnimatePresence>
        {open && (
          <div key="sheet" className="fixed inset-0" style={{ zIndex: z, pointerEvents: 'none' }}>
            {!side && (
              <motion.div
                aria-hidden className="absolute inset-0 bg-black" style={{ pointerEvents: passThrough ? 'none' : 'auto' }}
                initial={{ opacity: 0 }} animate={{ opacity: dim }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
                onPointerDown={() => onClose()}
              />
            )}
            <motion.div
              role="dialog" aria-modal={!side && !passThrough} aria-label={title ?? 'Sheet'}
              className={side
                ? 'absolute bottom-3 right-3 top-3 flex w-[400px] max-w-[92vw] flex-col overflow-hidden rounded-[24px] bg-white'
                : 'absolute left-1/2 top-1/2 flex max-h-[88vh] w-[540px] max-w-[94vw] flex-col overflow-hidden rounded-[28px] bg-white'}
              style={{ pointerEvents: 'auto', boxShadow: '0 24px 70px rgba(20,24,40,.28), 0 0 0 1px rgba(20,24,40,.06)', ...(side ? {} : { x: '-50%', y: '-50%' }) }}
              initial={side ? { x: 60, opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={side ? { x: 0, opacity: 1 } : { opacity: 1, scale: 1 }}
              exit={side ? { x: 60, opacity: 0 } : { opacity: 0, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            >
              <div className="flex shrink-0 items-center justify-between px-5 pb-1 pt-4">
                <div className="text-[16px] font-extrabold">{title ?? ''}</div>
                <button type="button" aria-label="Close" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full border-0 bg-neutral-100 text-neutral-600 hover:bg-neutral-200"><X size={17} /></button>
              </div>
              <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6 pt-1">{children}</div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    )
  }

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
          className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain"
          style={{ paddingBottom: hidden + 24 + 0, touchAction: 'pan-y' }}
        >
          {children}
          <div style={{ height: 'var(--safe-bottom)' }} />
        </div>
      </motion.div>
    </div>
  )
}
