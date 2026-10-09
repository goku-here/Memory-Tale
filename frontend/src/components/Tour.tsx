import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { tour, useTour } from '../lib/tour'

interface Step {
  /** element to spotlight: [data-tour="..."] */
  target?: string
  title: string
  body: string
  /** the tour moves on by itself when the user does this */
  until?: string
  /** label of the button that moves on (omit for steps that wait for the user to act) */
  next?: string
  /** no target: where the card sits */
  place?: 'center' | 'top'
}

const STEPS: Step[] = [
  { place: 'center', title: 'Your memories deserve more than a camera roll ✨', body: "Take a 30-second tour? You'll make your first book, and I'll show you a few tricks most people find by accident.", next: 'Show me' },
  { target: 'add', title: 'Every story starts with a blank page', body: 'Tap here to start your first memory book.', until: 'create-open' },
  { place: 'top', title: 'Make it yours', body: 'Pick a vibe, name it, tap Create. Watch what happens 👀', until: 'memory-created' },
  { target: 'photo', title: 'Drop in a few photos', body: 'Tap here, then take one now or pick from your gallery. They land on the canvas like polaroids.', until: 'photo-added', next: 'Maybe later' },
  { target: 'sticker', title: 'Now for the fun part', body: 'Little Beans with moods, comic bursts, doodles. You can even cut yourself out of a photo and turn it into a sticker.', next: 'Next' },
  { target: 'more', title: "There's a secret drawer here", body: 'Sticky notes, chat bubbles, a polaroid washing line, map pins… and Story mode, which turns your canvas into a ready-to-post Instagram story.', next: 'Next' },
  { target: 'menu', title: 'Better with company', body: 'Invite friends or family with a link. They can add photos too, and you decide who stays.', next: 'Next' },
  { place: 'center', title: "That's the tour 🎉", body: 'Tip: on your phone, press and hold a photo to pick it up, then drag. Two fingers pinch, resize and rotate. Now go make something worth keeping.', next: 'Start creating' },
]

interface Rect { x: number; y: number; w: number; h: number }

/** Coach marks: a spotlight on the real button, a short card, and a Skip button at every step. */
export function Tour() {
  const { active, step } = useTour()
  const calm = useReducedMotion()
  const s = STEPS[step]
  const [rect, setRect] = useState<Rect | null>(null)

  // react to what the user does
  useEffect(() => {
    if (!active) return
    const on = (e: Event) => {
      const ev = (e as CustomEvent<string>).detail
      if (s?.until === ev) tour.go(step + 1)
      else if (ev === 'create-close' && step === 2) tour.go(1)
    }
    window.addEventListener('mt-tour', on)
    return () => window.removeEventListener('mt-tour', on)
  }, [active, step, s])

  // follow the target while it animates in or the page moves
  useEffect(() => {
    if (!active || !s?.target) { setRect(null); return }
    let raf = 0
    let last = ''
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${s.target}"]`)
      const r = el?.getBoundingClientRect()
      const next = r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
      const key = next ? `${Math.round(next.x)},${Math.round(next.y)},${Math.round(next.w)},${Math.round(next.h)}` : ''
      if (key !== last) { last = key; setRect(next) }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [active, s])

  if (!active || !s) return null
  if (s.target && !rect) return null // the screen it points at is still opening

  const pad = 7
  const vh = window.innerHeight
  const vw = window.innerWidth
  const cardW = Math.min(320, vw - 32)
  const cardStyle: React.CSSProperties = { width: cardW, left: Math.max(16, Math.min(vw - cardW - 16, (rect ? rect.x + rect.w / 2 : vw / 2) - cardW / 2)) }
  if (rect) {
    if (rect.y + rect.h / 2 > vh * 0.5) cardStyle.bottom = vh - rect.y + pad + 14
    else cardStyle.top = rect.y + rect.h + pad + 14
  } else if (s.place === 'top') cardStyle.top = 'calc(var(--safe-top) + 18px)'
  else { cardStyle.top = '50%'; cardStyle.transform = 'translateY(-50%)' }

  const spring = calm ? { duration: 0 } : { type: 'spring' as const, stiffness: 320, damping: 30 }
  const centered = !rect && s.place === 'center'

  return (
    <div className="pointer-events-none fixed inset-0 z-[92]" aria-live="polite">
      {centered && <motion.div className="pointer-events-auto absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />}
      {rect && (
        <motion.div
          className="pointer-events-none absolute rounded-[22px]"
          initial={false} animate={{ left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2 }} transition={spring}
          style={{ boxShadow: '0 0 0 9999px rgba(10,12,24,.58), 0 0 0 3px rgba(255,255,255,.95)' }}
        >
          {!calm && <motion.span className="absolute inset-0 rounded-[22px] border-2 border-white" animate={{ scale: [1, 1.14], opacity: [0.8, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }} />}
        </motion.div>
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={step} role="dialog" aria-label={s.title}
          className="pointer-events-auto absolute rounded-[26px] bg-white p-5 shadow-[0_18px_50px_rgba(10,12,24,.35)]"
          style={cardStyle}
          initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }} transition={spring}
        >
          <div className="mb-1.5 flex items-center justify-between text-[11.5px] font-extrabold uppercase tracking-wider text-neutral-400">
            <span>{step + 1} of {STEPS.length}</span>
          </div>
          <h2 className="m-0 text-[19px] font-extrabold leading-tight text-[#17171a]">{s.title}</h2>
          <p className="m-0 mt-2 text-[14.5px] leading-relaxed text-neutral-600">{s.body}</p>
          <div className="mt-4 flex items-center justify-between gap-3">
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={() => tour.stop()} className="h-11 rounded-full border-0 bg-transparent px-2 text-[14px] font-bold text-neutral-400">Skip tour</button>
            ) : <span />}
            {s.next && (
              <button type="button" onClick={() => (step === STEPS.length - 1 ? tour.stop() : tour.go(step + 1))} className="h-11 rounded-full border-0 bg-[#17171a] px-6 text-[14.5px] font-semibold text-white">{s.next}</button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
