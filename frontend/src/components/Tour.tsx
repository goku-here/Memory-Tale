import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { BringToFront, Frame, Image as ImageIcon, MoreHorizontal, Plus, Pointer, RectangleVertical, Smile, Sparkles, Spline, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { tour, useTour, type Script } from '../lib/tour'

type Goto = { to: number; phase?: 'intro' | 'doing' }
/** a little looping picture of a finger tapping the thing */
interface Demo { icon: LucideIcon; label?: string; kind?: 'pill' | 'round' | 'row'; art?: 'thread' | 'layers' | 'frame' }

interface Step {
  /** element to spotlight: [data-tour="..."], or a raw selector starting with "[" */
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
  /** skip this step by itself when the target is missing while this other element is on screen (e.g. no Frame button on a sticker) */
  skipIfMissing?: string
}

const TRY = { label: 'Try it', does: 'try' } as const

const MAIN: Step[] = [
  { center: true, title: 'Your memories deserve more than a camera roll ✨', body: "Take a 30-second tour? You'll make your first book, and I'll show you a few tricks most people find by accident.", cta: { label: 'Show me', does: 'next' } },
  { target: 'add', title: 'Every story starts with a blank page', body: 'Tap here to start your first memory book.', demo: { icon: Plus, label: 'Add memory' }, on: { 'create-open': { to: 2 } } },
  {
    center: true, title: 'Make it yours', body: 'Pick a vibe, give it a name, then tap Create. Each vibe changes the look, the fonts, even the stickers. Watch what happens 👀',
    cta: TRY, on: { 'memory-created': { to: 3 }, 'create-close': { to: 1 } },
  },
  {
    target: 'photo', title: 'Drop in a few photos', body: 'Tap the photo button, then take one now or pick from your gallery. They land on the canvas like polaroids.',
    demo: { icon: ImageIcon, kind: 'round' }, tap: true, cta: TRY, later: 'Maybe later', on: { 'photo-added': { to: 4 } },
  },
  {
    target: 'sticker', title: 'Now for the fun part', body: 'Tap the smiley to open the sticker tray.', demo: { icon: Smile, kind: 'round' }, tap: true, cta: TRY, later: 'Maybe later',
    on: { 'sticker-added': { to: 5 } },
    doing: { title: 'So many to explore ✨', body: 'Little Beans with moods, comic bursts, doodles, or cut yourself out of a photo. Pick one to add it.' },
  },
  {
    target: 'more', title: "There's a secret drawer here", body: 'Tap ⋯ to open it. Sticky notes, chat bubbles, a polaroid washing line, map pins… pick any one to try it.',
    demo: { icon: MoreHorizontal, kind: 'round' }, tap: true, cta: TRY, later: 'Maybe later', on: { 'more-used': { to: 6 }, 'story-open': { to: 6, phase: 'doing' } },
  },
  {
    target: 'more', title: 'Turn it into an Instagram story', body: 'Open ⋯ again. Story mode is in there: it puts a frame over your canvas so you can share the best part.',
    demo: { icon: MoreHorizontal, kind: 'round' }, tap: true, cta: TRY, later: 'Maybe later', on: { 'story-open': { to: 6, phase: 'doing' }, 'story-close': { to: 7 } },
    doingTarget: { target: 'story-item', title: 'There it is', body: 'Tap Story mode.', demo: { icon: RectangleVertical, label: 'Story mode', kind: 'row' } },
    doing: { when: 'story-open', title: 'This is your story frame', body: 'Drag the bar on the frame to move it, arrange your items inside, then tap Done to share. Tap ✕ when you are finished exploring.' },
  },
  {
    target: 'menu', title: 'Better with company', body: 'Tap here. Invite friends or family with a link, see who is in the book, and download all the photos.',
    demo: { icon: MoreHorizontal, kind: 'round' }, tap: true, cta: TRY, later: 'Maybe later', on: { 'menu-close': { to: 8 } },
  },
  { center: true, title: "That's the tour 🎉", body: 'Tip: on your phone, press and hold a photo to pick it up, then drag. Two fingers pinch, resize and rotate. Now go make something worth keeping.', cta: { label: 'Start creating', does: 'next' } },
]

/** shown the first time someone selects something: what the little toolbar does */
const BAR = '[aria-label="Duplicate"]'
const SELECT: Step[] = [
  {
    target: '[aria-label="Frame"]', skipIfMissing: BAR, title: 'Give it a new shape', body: 'Frames turn a photo into a polaroid, a heart, an arch or a film strip. Tap Frame to browse them.',
    demo: { icon: Frame, kind: 'round', art: 'frame' }, tap: true, cta: TRY, later: 'Maybe later', on: { 'frame-close': { to: 1 } },
  },
  {
    target: '[aria-label="Tie with thread"]', skipIfMissing: BAR, title: 'Tie memories together', body: 'Tap the thread, then tap another item. A string ties them together, like a pin board.',
    demo: { icon: Spline, kind: 'round', art: 'thread' }, tap: true, cta: TRY, later: 'Maybe later', on: { 'thread-made': { to: 2 } },
  },
  {
    target: '[aria-label="Bring forward"]', skipIfMissing: BAR, title: 'On top, or underneath?', body: 'Bring forward puts it on top of everything else. Send backward tucks it underneath. Tap either one.',
    demo: { icon: BringToFront, kind: 'round', art: 'layers' }, tap: true, cta: TRY, later: 'Maybe later', on: { reorder: { to: 3 } },
  },
  { center: true, title: "That's your toolbar ✨", body: 'Tip: double-tap a photo to change its frame and caption. Drag the round handles to resize and rotate.', cta: { label: 'Got it', does: 'next' } },
]

const SCRIPTS: Record<Script, Step[]> = { main: MAIN, select: SELECT }

/** after the user finishes something, let them enjoy the result for a few seconds before the next card */
const ENJOY: Record<string, number> = { 'memory-created': 3500, 'photo-added': 3500, 'sticker-added': 3500, 'more-used': 3500, 'story-close': 3000, 'menu-close': 1800, 'frame-close': 1500, 'thread-made': 3000, reorder: 2000 }

interface Rect { x: number; y: number; w: number; h: number }
const sel = (t: string) => (t.startsWith('[') ? t : `[data-tour="${t}"]`)

const LOOP = { duration: 2.4, repeat: Infinity, ease: 'easeInOut' as const }

/** Looping mini-animations: a finger taps a mock of the control (or shows what the control does). */
function TapDemo({ d, calm }: { d: Demo; calm: boolean }) {
  const Icon = d.icon
  const btn = (extra = '') => `grid h-10 w-10 place-items-center rounded-full bg-white text-[#17171a] shadow-[0_4px_14px_rgba(20,24,40,.16)] ${extra}`

  if (d.art === 'thread') {
    const t = [0, 0.14, 0.24, 0.4, 0.5, 0.66, 0.76, 1]
    return (
      <div className="relative mb-3 h-[120px] overflow-hidden rounded-2xl bg-neutral-100" aria-hidden>
        <div className={`absolute left-1/2 top-3 -translate-x-1/2 ${btn()}`}><Icon size={18} /></div>
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 280 120">
          <motion.path d="M78 86 Q140 120 202 86" fill="none" stroke="#c4577a" strokeWidth="3" strokeLinecap="round" initial={false}
            animate={calm ? { pathLength: 1 } : { pathLength: [0, 0, 0, 0, 0, 1, 1, 0] }} transition={{ ...LOOP, times: t }} />
        </svg>
        <div className="absolute h-12 w-12 -translate-x-1/2 rounded-lg bg-white shadow-md" style={{ left: 78, top: 62 }}><div className="m-1.5 h-[calc(100%-12px)] rounded bg-[#e8d9c4]" /></div>
        <div className="absolute h-12 w-12 -translate-x-1/2 rounded-lg bg-white shadow-md" style={{ left: 202, top: 62 }}><div className="m-1.5 h-[calc(100%-12px)] rounded bg-[#cfe0e8]" /></div>
        <motion.span
          className="absolute text-[#17171a] drop-shadow-[0_2px_3px_rgba(0,0,0,.35)]" style={{ left: 140, top: 28 }} initial={false}
          animate={calm ? { x: 0, y: 0 } : { x: [90, 0, 0, -62, -62, 62, 62, 90], y: [80, 0, 0, 44, 44, 44, 44, 80], opacity: [0, 1, 1, 1, 1, 1, 1, 0] }} transition={{ ...LOOP, times: t }}
        ><Pointer size={28} fill="#fff" strokeWidth={1.8} /></motion.span>
      </div>
    )
  }
  if (d.art === 'layers') {
    const t = [0, 0.2, 0.32, 0.5, 0.8, 1]
    return (
      <div className="relative mb-3 h-[120px] overflow-hidden rounded-2xl bg-neutral-100" aria-hidden>
        <div className={`absolute left-1/2 top-3 -translate-x-1/2 ${btn()}`}><Icon size={18} /></div>
        <motion.div className="absolute h-14 w-14 rounded-lg bg-[#f2b8c6] shadow-md" style={{ left: 100, top: 58 }} initial={false}
          animate={calm ? undefined : { zIndex: [1, 1, 3, 3, 3, 1], scale: [1, 1, 1.06, 1, 1, 1] }} transition={{ ...LOOP, times: t }} />
        <motion.div className="absolute h-14 w-14 rounded-lg bg-[#a9cdf0] shadow-md" style={{ left: 128, top: 70 }} initial={false}
          animate={calm ? undefined : { zIndex: [2, 2, 2, 2, 2, 2] }} transition={{ ...LOOP, times: t }} />
        <motion.span
          className="absolute text-[#17171a] drop-shadow-[0_2px_3px_rgba(0,0,0,.35)]" style={{ left: 140, top: 28 }} initial={false}
          animate={calm ? { x: 0, y: 0 } : { x: [90, 0, 0, 0, 0, 90], y: [80, 0, 0, 0, 0, 80], opacity: [0, 1, 1, 1, 0, 0], scale: [1, 1, 0.85, 1, 1, 1] }} transition={{ ...LOOP, times: t }}
        ><Pointer size={28} fill="#fff" strokeWidth={1.8} /></motion.span>
      </div>
    )
  }
  if (d.art === 'frame') {
    const t = [0, 0.2, 0.32, 0.5, 0.7, 0.9, 1]
    return (
      <div className="relative mb-3 h-[120px] overflow-hidden rounded-2xl bg-neutral-100" aria-hidden>
        <div className={`absolute left-1/2 top-3 -translate-x-1/2 ${btn()}`}><Icon size={18} /></div>
        <motion.div className="absolute left-1/2 top-[62px] h-[52px] w-[52px] -translate-x-1/2 bg-[#e8d9c4] shadow-md" initial={false}
          animate={calm ? undefined : { borderRadius: ['6px', '6px', '6px', '50%', '12px 12px 26px 26px', '6px', '6px'] }} transition={{ ...LOOP, times: t }} />
        <motion.span
          className="absolute text-[#17171a] drop-shadow-[0_2px_3px_rgba(0,0,0,.35)]" style={{ left: 140, top: 28 }} initial={false}
          animate={calm ? { x: 0, y: 0 } : { x: [90, 0, 0, 0, 0, 90, 90], y: [80, 0, 0, 0, 0, 80, 80], opacity: [0, 1, 1, 1, 0, 0, 0], scale: [1, 1, 0.85, 1, 1, 1, 1] }} transition={{ ...LOOP, times: t }}
        ><Pointer size={28} fill="#fff" strokeWidth={1.8} /></motion.span>
      </div>
    )
  }

  const loop = { ...LOOP, times: [0, 0.35, 0.5, 0.65, 1] }
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
  const { active, script, step, phase } = useTour()
  const calm = useReducedMotion() ?? false
  const STEPS = SCRIPTS[script]
  const s = STEPS[step]
  const [rect, setRect] = useState<Rect | null>(null)
  const [seen, setSeen] = useState<string[]>([])
  /** "Try it" was tapped: keep pointing at the button (no card) until they tap it */
  const [trying, setTrying] = useState(false)
  const [hintOff, setHintOff] = useState(false)
  const pending = useRef(0)

  useEffect(() => { setSeen([]); setTrying(false); setHintOff(false) }, [script, step, phase])
  useEffect(() => () => window.clearTimeout(pending.current), [])
  useEffect(() => { if (!active) window.clearTimeout(pending.current) }, [active])

  const hint = phase === 'doing' && s?.doing && !hintOff && (!s.doing.when || seen.includes(s.doing.when) || (s.doing.when === 'story-open' && seen.length > 0)) ? s.doing : null
  const trackName = phase === 'intro' ? s?.target : phase === 'doing' && !hint ? (s?.doingTarget?.target ?? (trying ? s?.target : undefined)) : undefined

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
    if (!active || !s?.target || !(s.tap || trying) || !(phase === 'intro' || trying)) return
    const down = (e: PointerEvent) => {
      const el = document.querySelector(sel(s.target!))
      if (el && e.target instanceof Node && el.contains(e.target)) { setTrying(false); if (phase === 'intro') tour.go(step, 'doing') }
    }
    window.addEventListener('pointerdown', down, true)
    return () => window.removeEventListener('pointerdown', down, true)
  }, [active, step, phase, s, trying])

  // follow the target while it animates in or the page moves
  useEffect(() => {
    if (!active || !trackName) { setRect(null); return }
    let raf = 0
    let last = ''
    let missingSince = 0
    const tick = () => {
      const el = document.querySelector<HTMLElement>(sel(trackName))
      const r = el?.getBoundingClientRect()
      const next = r && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
      const key = next ? `${Math.round(next.x)},${Math.round(next.y)},${Math.round(next.w)},${Math.round(next.h)}` : ''
      if (key !== last) { last = key; setRect(next) }
      // a step that does not apply here (no Frame button on a sticker): move on by itself
      if (!next && s?.skipIfMissing && phase === 'intro' && document.querySelector(s.skipIfMissing)) {
        missingSince ||= performance.now()
        if (performance.now() - missingSince > 700) { tour.go(step + 1); return }
      } else missingSince = 0
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [active, trackName, s, phase, step])

  if (!active || !s) return null

  const spring = calm ? { duration: 0 } : { type: 'spring' as const, stiffness: 320, damping: 30 }
  const vh = window.innerHeight
  const vw = window.innerWidth
  const cardW = Math.min(320, vw - 32)
  const top = 'calc(var(--safe-top) + 12px)'
  const last = step === STEPS.length - 1
  const next = () => (last ? tour.stop() : tour.go(step + 1))
  const left = (cx: number) => Math.max(16, Math.min(vw - cardW - 16, cx - cardW / 2))
  const label = script === 'main' ? 'Guided tour' : 'Quick tip'

  const card = (key: string, title: string, body: string, style: React.CSSProperties, buttons: React.ReactNode, o: { counter?: boolean; demo?: Demo } = {}) => (
    <motion.div
      key={key} role="dialog" aria-label={title}
      className={`pointer-events-auto rounded-[26px] bg-white p-5 shadow-[0_18px_50px_rgba(10,12,24,.35)] ${style.position === 'relative' ? 'relative' : 'absolute'}`}
      style={{ width: cardW, ...style }}
      initial={{ opacity: 0, y: 10, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.12 } }} transition={spring}
    >
      {o.demo && <TapDemo d={o.demo} calm={calm} />}
      {o.counter !== false && <div className="mb-1.5 text-[11.5px] font-extrabold uppercase tracking-wider text-neutral-400">{script === 'select' ? `Tip ${step + 1} of ${STEPS.length}` : `${step + 1} of ${STEPS.length}`}</div>}
      <h2 className="m-0 text-[19px] font-extrabold leading-tight text-[#17171a]">{title}</h2>
      <p className="m-0 mt-2 text-[14.5px] leading-relaxed text-neutral-600">{body}</p>
      <div className="mt-4 flex items-center justify-between gap-3">{buttons}</div>
    </motion.div>
  )
  const textBtn = (text: string, fn: () => void) => <button type="button" onClick={fn} className="h-11 rounded-full border-0 bg-transparent px-2 text-[14px] font-bold text-neutral-400">{text}</button>
  const skipTour = textBtn(script === 'main' ? 'Skip tour' : 'Skip tips', () => tour.stop())
  const primary = (text: string, fn: () => void, full = false) => <button type="button" onClick={fn} className={`h-11 rounded-full border-0 bg-[#17171a] px-6 text-[14.5px] font-semibold text-white ${full ? 'w-full' : ''}`}>{text}</button>
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
      className="pointer-events-auto absolute left-1/2 flex h-9 -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border-0 bg-[#17171a]/85 px-3.5 text-[12.5px] font-bold text-white shadow-lg backdrop-blur disabled:pointer-events-none"
      style={{ top: 'calc(var(--safe-top) + 4px)' }}
    >
      <Sparkles size={14} /> {label} · {step + 1} of {STEPS.length}{interactive && <span className="font-semibold text-white/60"> · tap to continue</span>}
    </motion.button>
  )

  let body: React.ReactNode = null
  let dim = false

  if (phase === 'wait') {
    body = tag(false)
  } else if (phase === 'doing') {
    if (hint) {
      body = card('hint', hint.title, hint.body, { top, left: left(vw / 2) }, (
        <div className="flex w-full flex-col gap-1">
          {primary('Try it', () => setHintOff(true), true)}
          <div className="flex justify-between">{skipTour}{textBtn('Skip step', next)}</div>
        </div>
      ), { counter: false })
    } else if (s.doingTarget && rect) {
      const dt = s.doingTarget
      body = <>{spot(rect, 5)}{card(`dt${step}`, dt.title, dt.body, placeBy(rect, 5), <span />, { counter: false, demo: dt.demo })}</>
    } else if (trying && rect) {
      body = <>{spot(rect)}{tag(true)}</>
    } else body = tag(true)
  } else if (s.target) {
    if (!rect) return null // the screen it points at is still opening
    const buttons = s.cta ? (
      <div className="flex w-full flex-col gap-1">
        {primary(s.cta.label, s.cta.does === 'try' ? () => { setTrying(true); tour.go(step, 'doing') } : next, true)}
        <div className="flex justify-between">{skipTour}{s.later && textBtn(s.later, next)}</div>
      </div>
    ) : <>{skipTour}{s.later && textBtn(s.later, next)}</>
    body = <>{spot(rect)}{card(`s${step}`, s.title, s.body, placeBy(rect), buttons, { demo: s.demo })}</>
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
