import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { tour, useTour } from '../lib/tour'

type Goto = { to: number; phase?: 'intro' | 'doing' }

interface Step {
  /** element to spotlight: [data-tour="..."] */
  target?: string
  title: string
  body: string
  /** centred card over a dimmed screen (no spotlight) */
  center?: boolean
  /** primary button: moves on, or (try) hides the card so the person can do the thing */
  cta?: { label: string; does: 'next' | 'try' }
  /** secondary button that moves on without doing the step */
  later?: string
  /** tapping the spotlighted element counts as starting the step: the card hides until they finish */
  tap?: boolean
  /** what the app reports -> where the tour goes */
  on?: Record<string, Goto>
  /** a short card shown while they are doing the step (for example, once the sticker tray is open) */
  doing?: { when?: string; title: string; body: string }
}

const STEPS: Step[] = [
  { center: true, title: 'Your memories deserve more than a camera roll ✨', body: "Take a 30-second tour? You'll make your first book, and I'll show you a few tricks most people find by accident.", cta: { label: 'Show me', does: 'next' } },
  { target: 'add', title: 'Every story starts with a blank page', body: 'Tap here to start your first memory book.', on: { 'create-open': { to: 2 } } },
  {
    center: true, title: 'Make it yours', body: 'Pick a vibe, give it a name, then tap Create. Each vibe changes the look, the fonts, even the stickers. Watch what happens 👀',
    cta: { label: 'Try it', does: 'try' }, on: { 'memory-created': { to: 3 }, 'create-close': { to: 1 } },
  },
  {
    target: 'photo', title: 'Drop in a few photos', body: 'Tap the photo button, then take one now or pick from your gallery. They land on the canvas like polaroids.',
    tap: true, later: 'Maybe later', on: { 'photo-added': { to: 4 } },
  },
  {
    target: 'sticker', title: 'Now for the fun part', body: 'Tap the smiley to open the sticker tray.', tap: true, later: 'Maybe later',
    on: { 'sticker-added': { to: 5 } },
    doing: { title: 'So many to explore ✨', body: 'Little Beans with moods, comic bursts, doodles, or cut yourself out of a photo. Pick one to add it.' },
  },
  {
    target: 'more', title: "There's a secret drawer here", body: 'Tap ⋯ and open it. Sticky notes, chat bubbles, a polaroid washing line, map pins… pick any one to try it.',
    tap: true, later: 'Maybe later', on: { 'more-used': { to: 6 }, 'story-open': { to: 6, phase: 'doing' } },
  },
  {
    target: 'more', title: 'Turn it into an Instagram story', body: 'Open ⋯ again and tap Story mode. A frame appears: place it over the part you love, then tap Done to share.',
    tap: true, later: 'Maybe later', on: { 'story-open': { to: 6, phase: 'doing' }, 'story-close': { to: 7 } },
    doing: { when: 'story-open', title: 'This is your story frame', body: 'Drag the bar on the frame to move it, arrange your items inside, then tap Done to share. Tap ✕ when you are finished exploring.' },
  },
  { target: 'menu', title: 'Better with company', body: 'Invite friends or family with a link from this menu. They can add photos too, and you decide who stays.', cta: { label: 'Next', does: 'next' } },
  { center: true, title: "That's the tour 🎉", body: 'Tip: on your phone, press and hold a photo to pick it up, then drag. Two fingers pinch, resize and rotate. Now go make something worth keeping.', cta: { label: 'Start creating', does: 'next' } },
]

/** after the user finishes something, let them enjoy the result for a few seconds before the next card */
const ENJOY: Record<string, number> = { 'memory-created': 3500, 'photo-added': 3500, 'sticker-added': 3500, 'more-used': 3500, 'story-close': 3000 }

interface Rect { x: number; y: number; w: number; h: number }

/** Coach marks: a spotlight on the real button and a short card. While the person is acting the card steps aside. */
export function Tour() {
  const { active, step, phase } = useTour()
  const calm = useReducedMotion()
  const s = STEPS[step]
  const [rect, setRect] = useState<Rect | null>(null)
  const [seen, setSeen] = useState<string[]>([])

  const pending = useRef(0)
  useEffect(() => { setSeen([]) }, [step, phase])
  useEffect(() => () => window.clearTimeout(pending.current), [])
  useEffect(() => { if (!active) window.clearTimeout(pending.current) }, [active])

  // react to what the user does
  useEffect(() => {
    if (!active || !s) return
    const on = (e: Event) => {
      const ev = (e as CustomEvent<string>).detail
      if (phase === 'wait') return
      const dest = s.on?.[ev]
      if (dest && ENJOY[ev]) {
        tour.go(step, 'wait') // nothing on screen: they look at what they just made
        window.clearTimeout(pending.current)
        pending.current = window.setTimeout(() => tour.go(dest.to, dest.phase ?? 'intro'), ENJOY[ev])
      } else if (dest) tour.go(dest.to, dest.phase ?? 'intro')
      else setSeen((l) => [...l, ev])
    }
    window.addEventListener('mt-tour', on)
    return () => window.removeEventListener('mt-tour', on)
  }, [active, step, s, phase])

  // tapping the spotlighted button starts the step: hide the card and let them get on with it
  useEffect(() => {
    if (!active || !s?.tap || phase !== 'intro' || !s.target) return
    const down = (e: PointerEvent) => {
      const el = document.querySelector(`[data-tour="${s.target}"]`)
      if (el && e.target instanceof Node && el.contains(e.target)) tour.go(step, 'doing')
    }
    window.addEventListener('pointerdown', down, true)
    return () => window.removeEventListener('pointerdown', down, true)
  }, [active, step, phase, s])

  // follow the target while it animates in or the page moves
  useEffect(() => {
    if (!active || !s?.target || phase !== 'intro') { setRect(null); return }
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
  }, [active, s, phase])

  if (!active || !s || phase === 'wait') return null

  const spring = calm ? { duration: 0 } : { type: 'spring' as const, stiffness: 320, damping: 30 }
  const vh = window.innerHeight
  const vw = window.innerWidth
  const cardW = Math.min(320, vw - 32)
  const top = 'calc(var(--safe-top) + 12px)'

  const card = (key: string, title: string, body: string, style: React.CSSProperties, buttons: React.ReactNode, counter = true) => (
    <motion.div
      key={key} role="dialog" aria-label={title}
      className={`pointer-events-auto rounded-[26px] bg-white p-5 shadow-[0_18px_50px_rgba(10,12,24,.35)] ${style.position === 'relative' ? 'relative' : 'absolute'}`}
      style={{ width: cardW, ...style }}
      initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }} transition={spring}
    >
      {counter && <div className="mb-1.5 text-[11.5px] font-extrabold uppercase tracking-wider text-neutral-400">{step + 1} of {STEPS.length}</div>}
      <h2 className="m-0 text-[19px] font-extrabold leading-tight text-[#17171a]">{title}</h2>
      <p className="m-0 mt-2 text-[14.5px] leading-relaxed text-neutral-600">{body}</p>
      <div className="mt-4 flex items-center justify-between gap-3">{buttons}</div>
    </motion.div>
  )
  const skipTour = (label = 'Skip tour') => <button type="button" onClick={() => tour.stop()} className="h-11 rounded-full border-0 bg-transparent px-2 text-[14px] font-bold text-neutral-400">{label}</button>
  const primary = (label: string, fn: () => void) => <button type="button" onClick={fn} className="h-11 rounded-full border-0 bg-[#17171a] px-6 text-[14.5px] font-semibold text-white">{label}</button>
  const last = step === STEPS.length - 1
  const next = () => (last ? tour.stop() : tour.go(step + 1))

  const left = (cx: number) => Math.max(16, Math.min(vw - cardW - 16, cx - cardW / 2))
  let body: React.ReactNode = null
  let dim = false

  if (phase === 'doing') {
    const hint = s.doing && (!s.doing.when || seen.includes(s.doing.when) || (s.doing.when === 'story-open' && seen.length > 0)) ? s.doing : null
    body = hint
      ? card('hint', hint.title, hint.body, { top, left: left(vw / 2) }, <>{skipTour('Skip tour')}<button type="button" onClick={next} className="h-11 rounded-full border-0 bg-neutral-100 px-5 text-[14px] font-bold text-[#17171a]">Skip step</button></>, false)
      : (
        <motion.button
          key="pill" type="button" onClick={next} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={spring}
          className="pointer-events-auto absolute left-1/2 h-9 -translate-x-1/2 rounded-full border-0 bg-black/70 px-4 text-[12.5px] font-bold text-white backdrop-blur"
          style={{ top: 'calc(var(--safe-top) + 4px)' }}
        >
          Tour · skip this step
        </motion.button>
      )
  } else if (s.target) {
    if (!rect) return null // the screen it points at is still opening
    const pad = 7
    const style: React.CSSProperties = { left: left(rect.x + rect.w / 2) }
    if (rect.y + rect.h / 2 > vh * 0.5) style.bottom = vh - rect.y + pad + 14
    else style.top = rect.y + rect.h + pad + 14
    body = (
      <>
        <motion.div
          key="spot" className="pointer-events-none absolute rounded-[22px]"
          initial={false} animate={{ left: rect.x - pad, top: rect.y - pad, width: rect.w + pad * 2, height: rect.h + pad * 2 }} transition={spring}
          style={{ boxShadow: '0 0 0 9999px rgba(10,12,24,.58), 0 0 0 3px rgba(255,255,255,.95)' }}
        >
          {!calm && <motion.span className="absolute inset-0 rounded-[22px] border-2 border-white" animate={{ scale: [1, 1.14], opacity: [0.8, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }} />}
        </motion.div>
        {card(`s${step}`, s.title, s.body, style, <>
          {skipTour()}
          {s.later && <button type="button" onClick={next} className="h-11 rounded-full border-0 bg-neutral-100 px-5 text-[14px] font-bold text-[#17171a]">{s.later}</button>}
          {s.cta && primary(s.cta.label, next)}
        </>)}
      </>
    )
  } else {
    dim = true
    body = (
      <div key={`c${step}`} className="absolute inset-0 grid place-items-center">
        {card(`c${step}`, s.title, s.body, { position: 'relative' }, <>
          {!last ? skipTour() : <span />}
          {s.cta && primary(s.cta.label, s.cta.does === 'try' ? () => tour.go(step, 'doing') : next)}
        </>)}
      </div>
    )
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[92]" aria-live="polite">
      {dim && <motion.div className="pointer-events-auto absolute inset-0 bg-black/45" initial={{ opacity: 0 }} animate={{ opacity: 1 }} />}
      <AnimatePresence mode="wait">{body}</AnimatePresence>
    </div>
  )
}
