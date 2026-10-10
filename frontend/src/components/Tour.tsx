import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Image as ImageIcon, MoreHorizontal, Plus, Pointer, RectangleVertical, Smile, Sparkles, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { tour, useTour } from '../lib/tour'

type Goto = { to: number; phase?: 'intro' | 'doing' }
/** a little looping picture of a finger tapping the thing */
interface Demo { icon: LucideIcon; label?: string; kind?: 'pill' | 'round' | 'row' }

interface Step {
  /** element to spotlight: [data-tour="..."] */
  target?: string
  title: string
  body: string
  demo?: Demo
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
  /** while doing: point at something that only exists mid-action (an item in an open menu) */
  doingTarget?: { target: string; title: string; body: string; demo?: Demo }
}

const STEPS: Step[] = [
  { center: true, title: 'Your memories deserve more than a camera roll ✨', body: "Take a 30-second tour? You'll make your first book, and I'll show you a few tricks most people find by accident.", cta: { label: 'Show me', does: 'next' } },
  { target: 'add', title: 'Every story starts with a blank page', body: 'Tap here to start your first memory book.', demo: { icon: Plus, label: 'Add memory' }, on: { 'create-open': { to: 2 } } },
  {
    center: true, title: 'Make it yours', body: 'Pick a vibe, give it a name, then tap Create. Each vibe changes the look, the fonts, even the stickers. Watch what happens 👀',
    cta: { label: 'Try it', does: 'try' }, on: { 'memory-created': { to: 3 }, 'create-close': { to: 1 } },
  },
  {
    target: 'photo', title: 'Drop in a few photos', body: 'Tap the photo button, then take one now or pick from your gallery. They land on the canvas like polaroids.',
    demo: { icon: ImageIcon, kind: 'round' }, tap: true, later: 'Maybe later', on: { 'photo-added': { to: 4 } },
  },
  {
    target: 'sticker', title: 'Now for the fun part', body: 'Tap the smiley to open the sticker tray.', demo: { icon: Smile, kind: 'round' }, tap: true, later: 'Maybe later',
    on: { 'sticker-added': { to: 5 } },
    doing: { title: 'Try it ✨', body: 'Scroll the tray (little Beans, comic bursts, doodles, your own cut-outs) and tap one to drop it on your canvas.' },
  },
  {
    target: 'more', title: "There's a secret drawer here", body: 'Tap ⋯ to open it. Sticky notes, chat bubbles, a polaroid washing line, map pins… pick any one to try it.',
    demo: { icon: MoreHorizontal, kind: 'round' }, tap: true, later: 'Maybe later', on: { 'more-used': { to: 6 }, 'story-open': { to: 6, phase: 'doing' } },
  },
  {
    target: 'more', title: 'Turn it into an Instagram story', body: 'Open ⋯ again. Story mode is in there: it puts a frame over your canvas so you can share the best part.',
    demo: { icon: MoreHorizontal, kind: 'round' }, tap: true, later: 'Maybe later', on: { 'story-open': { to: 6, phase: 'doing' }, 'story-close': { to: 7 } },
    doingTarget: { target: 'story-item', title: 'There it is', body: 'Tap Story mode.', demo: { icon: RectangleVertical, label: 'Story mode', kind: 'row' } },
    doing: { when: 'story-open', title: 'This is your story frame', body: 'Drag the bar on the frame to move it, arrange your items inside, then tap Done to share. Tap ✕ when you are finished exploring.' },
  },
  {
    target: 'menu', title: 'Better with company', body: 'Tap here. Invite friends or family with a link, see who is in the book, and download all the photos.',
    demo: { icon: MoreHorizontal, kind: 'round' }, tap: true, later: 'Maybe later', on: { 'menu-close': { to: 8 } },
  },
  { center: true, title: "That's the tour 🎉", body: 'Tip: on your phone, press and hold a photo to pick it up, then drag. Two fingers pinch, resize and rotate. Now go make something worth keeping.', cta: { label: 'Start creating', does: 'next' } },
]

/** after the user finishes something, let them enjoy the result for a few seconds before the next card */
const ENJOY: Record<string, number> = { 'memory-created': 3500, 'photo-added': 3500, 'sticker-added': 3500, 'more-used': 3500, 'story-close': 3000, 'menu-close': 1800 }

interface Rect { x: number; y: number; w: number; h: number }

/** A looping mini-animation: a finger taps a mock of the control. */
function TapDemo({ d, calm }: { d: Demo; calm: boolean }) {
  const Icon = d.icon
  const loop = { duration: 2.4, repeat: Infinity, times: [0, 0.35, 0.5, 0.65, 1], ease: 'easeInOut' as const }
  const mock =
    d.kind === 'row' ? (
      <div className="w-[170px] rounded-2xl bg-white p-1 shadow-[0_4px_14px_rgba(20,24,40,.14)]">
        <div className="mx-2 my-1.5 h-2 w-16 rounded-full bg-neutral-200" />
        <motion.div className="flex h-9 items-center gap-2 rounded-xl bg-[#17171a]/[.07] px-2 text-[13px] font-semibold text-[#17171a]" animate={calm ? undefined : { scale: [1, 1, 0.94, 1, 1] }} transition={loop}>
          <Icon size={16} /> {d.label}
        </motion.div>
        <div className="mx-2 my-1.5 h-2 w-24 rounded-full bg-neutral-200" />
      </div>
    ) : (
      <motion.div
        className={`flex items-center justify-center gap-2 text-[13.5px] font-semibold shadow-[0_4px_14px_rgba(20,24,40,.14)] ${d.kind === 'round' ? 'h-12 w-12 rounded-full bg-white text-[#17171a]' : 'h-11 rounded-full bg-[#17171a] px-4 text-white'}`}
        animate={calm ? undefined : { scale: [1, 1, 0.9, 1, 1] }} transition={loop}
      >
        <Icon size={d.kind === 'round' ? 22 : 18} /> {d.kind !== 'round' && d.label}
      </motion.div>
    )
  return (
    <div className="relative mb-3 grid h-[84px] place-items-center overflow-hidden rounded-2xl bg-neutral-100" aria-hidden>
      {mock}
      <motion.span
        className="absolute text-[#17171a] drop-shadow-[0_2px_3px_rgba(0,0,0,.35)]"
        style={{ left: 'calc(50% + 2px)', top: 'calc(50% + 2px)' }}
        initial={false}
        animate={calm ? { x: 0, y: 0 } : { x: [46, 0, 0, 0, 46], y: [40, 0, 0, 0, 40], opacity: [0, 1, 1, 1, 0], scale: [1, 1, 0.85, 1, 1] }}
        transition={loop}
      >
        <Pointer size={28} fill="#fff" strokeWidth={1.8} />
      </motion.span>
    </div>
  )
}

/** Coach marks: a spotlight on the real button and a short card. While the person is acting the card steps aside. */
export function Tour() {
  const { active, step, phase } = useTour()
  const calm = useReducedMotion() ?? false
  const s = STEPS[step]
  const [rect, setRect] = useState<Rect | null>(null)
  const [seen, setSeen] = useState<string[]>([])
  const pending = useRef(0)

  useEffect(() => { setSeen([]) }, [step, phase])
  useEffect(() => () => window.clearTimeout(pending.current), [])
  useEffect(() => { if (!active) window.clearTimeout(pending.current) }, [active])

  const hint = phase === 'doing' && s?.doing && (!s.doing.when || seen.includes(s.doing.when) || (s.doing.when === 'story-open' && seen.length > 0)) ? s.doing : null
  const trackName = phase === 'intro' ? s?.target : phase === 'doing' && !hint ? s?.doingTarget?.target : undefined

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
    if (!active || !trackName) { setRect(null); return }
    let raf = 0
    let last = ''
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${trackName}"]`)
      const r = el?.getBoundingClientRect()
      const next = r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
      const key = next ? `${Math.round(next.x)},${Math.round(next.y)},${Math.round(next.w)},${Math.round(next.h)}` : ''
      if (key !== last) { last = key; setRect(next) }
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [active, trackName])

  if (!active || !s) return null

  const spring = calm ? { duration: 0 } : { type: 'spring' as const, stiffness: 320, damping: 30 }
  const vh = window.innerHeight
  const vw = window.innerWidth
  const cardW = Math.min(320, vw - 32)
  const top = 'calc(var(--safe-top) + 12px)'
  const last = step === STEPS.length - 1
  const next = () => (last ? tour.stop() : tour.go(step + 1))
  const left = (cx: number) => Math.max(16, Math.min(vw - cardW - 16, cx - cardW / 2))

  const card = (key: string, title: string, body: string, style: React.CSSProperties, buttons: React.ReactNode, o: { counter?: boolean; demo?: Demo } = {}) => (
    <motion.div
      key={key} role="dialog" aria-label={title}
      className={`pointer-events-auto rounded-[26px] bg-white p-5 shadow-[0_18px_50px_rgba(10,12,24,.35)] ${style.position === 'relative' ? 'relative' : 'absolute'}`}
      style={{ width: cardW, ...style }}
      initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }} transition={spring}
    >
      {o.demo && <TapDemo d={o.demo} calm={calm} />}
      {o.counter !== false && <div className="mb-1.5 text-[11.5px] font-extrabold uppercase tracking-wider text-neutral-400">{step + 1} of {STEPS.length}</div>}
      <h2 className="m-0 text-[19px] font-extrabold leading-tight text-[#17171a]">{title}</h2>
      <p className="m-0 mt-2 text-[14.5px] leading-relaxed text-neutral-600">{body}</p>
      <div className="mt-4 flex items-center justify-between gap-3">{buttons}</div>
    </motion.div>
  )
  const skipTour = <button type="button" onClick={() => tour.stop()} className="h-11 rounded-full border-0 bg-transparent px-2 text-[14px] font-bold text-neutral-400">Skip tour</button>
  const primary = (label: string, fn: () => void) => <button type="button" onClick={fn} className="h-11 rounded-full border-0 bg-[#17171a] px-6 text-[14.5px] font-semibold text-white">{label}</button>
  const spot = (r: Rect, pad = 7) => (
    <motion.div
      key="spot" className="pointer-events-none absolute rounded-[22px]"
      initial={false} animate={{ left: r.x - pad, top: r.y - pad, width: r.w + pad * 2, height: r.h + pad * 2 }} transition={spring}
      style={{ boxShadow: '0 0 0 9999px rgba(10,12,24,.58), 0 0 0 3px rgba(255,255,255,.95)' }}
    >
      {!calm && <motion.span className="absolute inset-0 rounded-[22px] border-2 border-white" animate={{ scale: [1, 1.14], opacity: [0.8, 0] }} transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }} />}
    </motion.div>
  )
  const placeBy = (r: Rect, pad = 7): React.CSSProperties => (r.y + r.h / 2 > vh * 0.5 ? { left: left(r.x + r.w / 2), bottom: vh - r.y + pad + 14 } : { left: left(r.x + r.w / 2), top: r.y + r.h + pad + 14 })

  /** the small tag that says "this is the tour": tap it to bring the current card back */
  const tag = (interactive: boolean) => (
    <motion.button
      key="tag" type="button" disabled={!interactive} onClick={() => tour.go(step, 'intro')}
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={spring}
      className="pointer-events-auto absolute left-1/2 flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-full border-0 bg-[#17171a]/85 px-3.5 text-[12.5px] font-bold text-white shadow-lg backdrop-blur disabled:pointer-events-none"
      style={{ top: 'calc(var(--safe-top) + 4px)' }}
    >
      <Sparkles size={14} /> Guided tour · {step + 1} of {STEPS.length}{interactive && <span className="font-semibold text-white/60"> · tap to continue</span>}
    </motion.button>
  )

  let body: React.ReactNode = null
  let dim = false

  if (phase === 'wait') {
    body = tag(false)
  } else if (phase === 'doing') {
    if (hint) body = card('hint', hint.title, hint.body, { top, left: left(vw / 2) }, <>{skipTour}<button type="button" onClick={next} className="h-11 rounded-full border-0 bg-neutral-100 px-5 text-[14px] font-bold text-[#17171a]">Skip step</button></>, { counter: false })
    else if (s.doingTarget && rect) {
      const dt = s.doingTarget
      body = <>{spot(rect, 5)}{card(`dt${step}`, dt.title, dt.body, placeBy(rect, 5), <span />, { counter: false, demo: dt.demo })}</>
    } else body = tag(true)
  } else if (s.target) {
    if (!rect) return null // the screen it points at is still opening
    body = (
      <>
        {spot(rect)}
        {card(`s${step}`, s.title, s.body, placeBy(rect), <>
          {skipTour}
          {s.later && <button type="button" onClick={next} className="h-11 rounded-full border-0 bg-neutral-100 px-5 text-[14px] font-bold text-[#17171a]">{s.later}</button>}
          {s.cta && primary(s.cta.label, next)}
        </>, { demo: s.demo })}
      </>
    )
  } else {
    dim = true
    body = (
      <div key={`c${step}`} className="absolute inset-0 grid place-items-center">
        {card(`c${step}`, s.title, s.body, { position: 'relative' }, <>
          {!last ? skipTour : <span />}
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
