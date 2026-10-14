import { motion } from 'framer-motion'
import { useEffect, useRef, type ReactNode } from 'react'
import type { BubbleProps, BubbleShape } from '../types'

export const BUBBLE_FONTS: { label: string; css: string }[] = [
  { label: 'Comic', css: "'Comic Neue', 'Comic Sans MS', cursive" },
  { label: 'Hand', css: "'Patrick Hand', cursive" },
  { label: 'Bangers', css: "'Bangers', cursive" },
  { label: 'Gochi', css: "'Gochi Hand', cursive" },
  { label: 'Luckiest', css: "'Luckiest Guy', cursive" },
]

/** every kind of bubble: its name, whether it can have a tail, and how tall it is compared with its width */
export const BUBBLE_SHAPES: { id: BubbleShape; label: string; tail: boolean; ratio: number; hidden?: boolean }[] = [
  { id: 'speech', label: 'Speech', tail: true, ratio: 0.72 },
  { id: 'tall', label: 'Tall', tail: true, ratio: 1.35 },
  // no longer offered, but bubbles that were already made with them still draw
  { id: 'squircle', label: 'Rounded', tail: true, ratio: 0.66, hidden: true },
  { id: 'two', label: 'Two parts', tail: false, ratio: 0.72, hidden: true },
  { id: 'offscreen', label: 'Off panel', tail: false, ratio: 0.95 },
  { id: 'shout', label: 'Shout', tail: false, ratio: 0.82 },
  { id: 'announce', label: 'Announce', tail: false, ratio: 0.9 },
  { id: 'fade', label: 'Fading', tail: true, ratio: 0.7 },
  { id: 'whisper', label: 'Whisper', tail: true, ratio: 0.72 },
  { id: 'think', label: 'Thinking', tail: false, ratio: 0.72 },
  { id: 'thought', label: 'Thought', tail: true, ratio: 0.8 },
  { id: 'dream', label: 'Daydream', tail: true, ratio: 0.82 },
  { id: 'box', label: 'Caption', tail: false, ratio: 0.5 },
  { id: 'dark', label: 'Dark', tail: false, ratio: 0.72 },
]

const INK = '#17171a'
export const BUBBLE_STROKE_COLORS = ['#17171A', '#FFFFFF', '#E5486F', '#F28C38', '#FFC93C', '#2F7BE5', '#2E9E6B', '#6B4FBB']

/** a jagged burst: `jag` makes the points uneven (shouting) or all the same (an announcement) */
function burst(cx: number, cy: number, rx: number, ry: number, n: number, jag: number) {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    const outer = i % 2 === 0
    const wobble = 1 + Math.sin(i * 12.9898 + 1.3) * jag
    const k = outer ? wobble : 0.74
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(2)},${(cy + Math.sin(a) * ry * k).toFixed(2)}`)
  }
  return pts.join(' ')
}

/** a cloud: a ring of round bumps around an ellipse */
function cloud(cx: number, cy: number, rx: number, ry: number, n: number) {
  const pt = (i: number) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2
    return [cx + Math.cos(a) * rx * 0.9, cy + Math.sin(a) * ry * 0.9] as const
  }
  let d = ''
  for (let i = 0; i < n; i++) {
    const [x0, y0] = pt(i)
    const [x1, y1] = pt(i + 1)
    const r = Math.hypot(x1 - x0, y1 - y0) * 0.62
    d += `${i ? 'L' : 'M'}${x0.toFixed(2)} ${y0.toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
  }
  return d + 'Z'
}

/** Comic bubble drawn as SVG (stroke stays crisp when scaled) with text laid on top. */
export function BubbleBody({
  bubble, width, height, editing = false, onChange, onDone,
}: { bubble: BubbleProps; width: number; height: number; editing?: boolean; onChange?: (t: string) => void; onDone?: () => void }) {
  const { shape, tail, text, font, size } = bubble
  const ink = bubble.strokeColor ?? INK
  const sw = bubble.stroke ?? 2.2
  const H = (100 * height) / Math.max(1, width)
  const canTail = BUBBLE_SHAPES.find((s) => s.id === shape)?.tail ?? false
  const hasTail = canTail && tail !== 'none'
  const tailH = hasTail ? Math.min(17, H * 0.2) : 0
  const Hb = H - tailH
  const rx = 48.6
  const ry = (Hb - 2.6) / 2
  const cx = 50
  const cy = Hb / 2
  const P = (deg: number, k = 1) => {
    const a = (deg * Math.PI) / 180
    return [cx + rx * k * Math.cos(a), cy + ry * k * Math.sin(a)] as const
  }
  const flip = tail === 'right' ? 'translate(100 0) scale(-1 1)' : undefined
  const dark = shape === 'dark'
  const fill = dark ? ink : '#fff'
  const dash = shape === 'whisper' ? '5 4' : undefined

  /** parts of one outline: drawn once fat in ink, then once in white, so where parts overlap there is no line between them */
  const union = (parts: ((p: Record<string, unknown>) => ReactNode)[]) => (
    <g transform={flip} strokeLinejoin="round" strokeLinecap="round">
      <g>{parts.map((f, i) => <g key={i}>{f({ fill: ink, stroke: ink, strokeWidth: sw * 2, vectorEffect: 'non-scaling-stroke' })}</g>)}</g>
      <g>{parts.map((f, i) => <g key={i}>{f({ fill, stroke: 'none' })}</g>)}</g>
    </g>
  )

  /** a thin, curved, pointed tail (a swoosh) hanging from the bottom left of the body */
  const swoosh = (p: Record<string, unknown>) => {
    const [x1, y1] = P(105, 0.985)
    const [x2, y2] = P(121, 0.985)
    const tx = 19, ty = H - 0.8
    return (
      <path
        d={`M${x1.toFixed(2)} ${y1.toFixed(2)}C${(x1 - 1.5).toFixed(2)} ${(y1 + tailH * 0.5).toFixed(2)} ${(tx + 9).toFixed(2)} ${(ty - tailH * 0.18).toFixed(2)} ${tx} ${ty.toFixed(2)}C${(tx + 6).toFixed(2)} ${(ty - tailH * 0.1).toFixed(2)} ${(x2 + 1).toFixed(2)} ${(y2 + tailH * 0.25).toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}Z`}
        {...p}
      />
    )
  }
  const body = (p: Record<string, unknown>) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...p} />

  let art: ReactNode
  let inset = '12% 12%'
  if (shape === 'box') {
    inset = '6% 6%'
    art = <rect x="1.5" y="1.5" width="97" height={Hb - 3} rx="1.8" fill="#fff" stroke={ink} strokeWidth={sw} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
  } else if (shape === 'squircle') {
    art = union([(p) => <rect x="1.6" y="1.6" width="96.8" height={Hb - 3.2} rx={Math.min(46, (Hb - 3.2) * 0.46)} {...p} />, ...(hasTail ? [swoosh] : [])])
  } else if (shape === 'two') {
    // a longer speech made of two bubbles, each with its own small tail
    inset = '10% 12%'
    const w = (p: Record<string, unknown>) => <ellipse cx="33" cy={Hb * 0.34} rx="31" ry={Hb * 0.3} {...p} />
    const v = (p: Record<string, unknown>) => <ellipse cx="66" cy={Hb * 0.68} rx="32" ry={Hb * 0.3} {...p} />
    const t1 = (p: Record<string, unknown>) => <path d={`M30 ${Hb * 0.6}Q27 ${Hb * 0.74} 21 ${Hb * 0.8}Q33 ${Hb * 0.78} 38 ${Hb * 0.6}Z`} {...p} />
    art = union([w, v, t1])
  } else if (shape === 'offscreen') {
    // a round bubble with a small bite taken out of the bottom: the speaker is outside the picture
    const [a1x, a1y] = P(52)
    const [a2x, a2y] = P(84)
    const [bx, by] = P(68, 0.55)
    art = (
      <path
        d={`M${a2x.toFixed(2)} ${a2y.toFixed(2)}A${rx} ${ry} 0 1 1 ${a1x.toFixed(2)} ${a1y.toFixed(2)}L${bx.toFixed(2)} ${by.toFixed(2)}Z`}
        fill="#fff" stroke={ink} strokeWidth={sw} vectorEffect="non-scaling-stroke" strokeLinejoin="round"
      />
    )
  } else if (shape === 'shout') {
    inset = '19% 15%'
    art = <polygon points={burst(50, Hb / 2, 49, Hb / 2 - 1, 12, 0.14)} fill="#fff" stroke={ink} strokeWidth={sw} vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
  } else if (shape === 'announce') {
    inset = '20% 16%'
    art = <polygon points={burst(50, Hb / 2, 49.4, Hb / 2 - 0.8, 24, 0)} fill="#fff" stroke={ink} strokeWidth={sw} vectorEffect="non-scaling-stroke" strokeLinejoin="miter" />
  } else if (shape === 'fade') {
    inset = '15% 14%'
    art = union([(p) => <path d={cloud(cx, cy, rx + 1, ry + 1, 16)} {...p} />, ...(hasTail ? [swoosh] : [])])
  } else if (shape === 'dream') {
    inset = '18% 16%'
    art = (
      <g transform={flip} strokeLinejoin="round">
        <path d={cloud(cx, cy, rx + 1, ry + 1, 9)} fill="#fff" stroke={ink} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
        {hasTail && (
          <>
            <circle cx="30" cy={Hb + tailH * 0.3} r={Math.min(4.4, tailH * 0.3)} fill="#fff" stroke={ink} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
            <circle cx="21" cy={H - Math.min(2.8, tailH * 0.18) - 0.6} r={Math.min(2.6, tailH * 0.18)} fill="#fff" stroke={ink} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </g>
    )
  } else if (shape === 'thought') {
    art = (
      <g transform={flip} strokeLinejoin="round">
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="#fff" stroke={ink} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
        {hasTail && (
          <>
            <circle cx="30" cy={Hb + tailH * 0.32} r={Math.min(4.2, tailH * 0.3)} fill="#fff" stroke={ink} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
            <circle cx="21" cy={H - Math.min(2.8, tailH * 0.18) - 0.8} r={Math.min(2.6, tailH * 0.18)} fill="#fff" stroke={ink} strokeWidth={sw} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </g>
    )
  } else if (shape === 'whisper') {
    if (hasTail) {
      // one open outline: the dashes run all the way round and out along the tail, so the ring is not closed where the tail grows
      const [x1, y1] = P(105)
      const [x2, y2] = P(121)
      const tx = 19, ty = H - 0.8
      art = (
        <path
          transform={flip} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={dash} fill="#fff" stroke={ink} strokeWidth={sw} vectorEffect="non-scaling-stroke"
          d={`M${x2.toFixed(2)} ${y2.toFixed(2)}A${rx} ${ry} 0 1 1 ${x1.toFixed(2)} ${y1.toFixed(2)}C${(x1 - 1.5).toFixed(2)} ${(y1 + tailH * 0.5).toFixed(2)} ${(tx + 9).toFixed(2)} ${(ty - tailH * 0.18).toFixed(2)} ${tx} ${ty.toFixed(2)}C${(tx + 6).toFixed(2)} ${(ty - tailH * 0.1).toFixed(2)} ${(x2 + 1).toFixed(2)} ${(y2 + tailH * 0.25).toFixed(2)} ${x2.toFixed(2)} ${y2.toFixed(2)}Z`}
        />
      )
    } else {
      art = body({ fill: '#fff', stroke: ink, strokeWidth: sw, vectorEffect: 'non-scaling-stroke', strokeDasharray: dash })
    }
  } else if (shape === 'think' || shape === 'dark') {
    art = body({ fill, stroke: ink, strokeWidth: sw, vectorEffect: 'non-scaling-stroke' })
  } else {
    // speech and tall: an oval with a thin tail
    art = union([body, ...(hasTail ? [swoosh] : [])])
  }

  const textStyle = {
    fontFamily: font, fontWeight: 700, fontSize: `${size}cqw`, lineHeight: 1.12, color: dark ? '#fff' : INK, textTransform: 'uppercase',
    textAlign: 'center', whiteSpace: 'pre-wrap', wordBreak: 'break-word', width: '100%',
  } as const
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing) { ta.current?.focus(); ta.current?.select() }
  }, [editing])

  return (
    <div className="relative h-full w-full" style={{ containerType: 'inline-size', filter: 'drop-shadow(2.5px 3px 0 rgba(30,30,40,.17))' }}>
      <svg viewBox={`0 0 100 ${H}`} className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden>
        {art}
      </svg>
      <div className="absolute flex items-center justify-center overflow-hidden" style={{ left: 0, right: 0, top: 0, height: `${(Hb / H) * 100}%`, padding: inset }}>
        {editing ? (
          <textarea
            ref={ta} value={text} data-ui
            onChange={(e) => onChange?.(e.target.value)} onBlur={onDone}
            onPointerDown={(e) => e.stopPropagation()}
            className="h-full w-full resize-none border-0 bg-transparent p-0 outline-none" style={textStyle}
          />
        ) : (
          <div style={textStyle}>{text || <span style={{ opacity: 0.35 }}>…</span>}</div>
        )}
      </div>
    </div>
  )
}

interface EditorProps {
  value: BubbleProps
  accent: string
  /** the bubble's box on the page, so the preview has the same proportions */
  box: { width: number; height: number }
  onChange: (p: Partial<BubbleProps>) => void
}

const label = 'mb-2.5 block text-[12px] font-extrabold uppercase tracking-wider text-neutral-400'

export function BubbleEditor({ value, accent, box, onChange }: EditorProps) {
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const t = setTimeout(() => { ta.current?.focus(); ta.current?.select() }, 420)
    return () => clearTimeout(t)
  }, [])
  const tails: { id: BubbleProps['tail']; label: string }[] = [
    { id: 'left', label: 'Left' }, { id: 'right', label: 'Right' }, { id: 'none', label: 'None' },
  ]
  const tailOk = BUBBLE_SHAPES.find((s) => s.id === value.shape)?.tail ?? false
  // the preview shows the bubble the way it sits on the page, shrunk to fit the card
  const k = Math.min(1, 250 / box.width, 150 / box.height)
  const pw = Math.round(box.width * k)
  const ph = Math.round(box.height * k)
  const shapes = BUBBLE_SHAPES.filter((s) => !s.hidden || s.id === value.shape)

  return (
    <div className="px-5 pb-10">
      {/* stays in view while the options below are changed */}
      <div className="sticky top-0 z-10 -mx-5 bg-white px-5 pb-3 pt-1">
        <div
          className="grid h-[188px] place-items-center overflow-hidden rounded-3xl"
          style={{ background: '#f4f3ef', backgroundImage: 'radial-gradient(rgba(23,23,26,.13) 1.2px, transparent 1.6px)', backgroundSize: '18px 18px', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)' }}
          aria-label="How the bubble looks"
        >
          <div style={{ width: pw, height: ph }}>
            <BubbleBody bubble={value} width={pw} height={ph} />
          </div>
        </div>
      </div>

      <div className="space-y-7 pt-3">
        <section>
          <label className={label} htmlFor="bubble-text">Words</label>
          <textarea
            id="bubble-text" ref={ta} rows={2} value={value.text} onChange={(e) => onChange({ text: e.target.value })}
            placeholder="What are they saying?"
            className="w-full resize-none rounded-2xl border-0 bg-neutral-100 px-4 py-3.5 text-[17px] leading-snug text-[#17171a] outline-none"
          />
        </section>

        <section>
          <span className={label}>Shape</span>
          <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Bubble shape">
            {shapes.map((s) => {
              const on = value.shape === s.id
              const w = s.ratio > 1 ? 34 : 54
              const h = Math.min(44, w * s.ratio)
              return (
                <motion.button
                  key={s.id} type="button" role="radio" aria-checked={on} whileTap={{ scale: 0.94 }} onClick={() => onChange({ shape: s.id })}
                  className="flex flex-col items-center gap-1.5 rounded-2xl border-0 px-1 pb-2 pt-2.5"
                  style={{ background: on ? `${accent}18` : '#f6f6f8', boxShadow: on ? `inset 0 0 0 2px ${accent}` : 'none' }}
                >
                  <div className="grid h-[48px] w-full place-items-center">
                    <div style={{ width: w, height: h }}>
                      <BubbleBody bubble={{ ...value, shape: s.id, text: '', tail: s.tail ? (value.tail === 'none' ? 'left' : value.tail) : 'none' }} width={w} height={h} />
                    </div>
                  </div>
                  <span className="text-[11px] font-bold leading-tight text-neutral-500">{s.label}</span>
                </motion.button>
              )
            })}
          </div>
        </section>

        {tailOk && (
          <section>
            <span className={label}>Tail</span>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tail">
              {tails.map((t) => (
                <motion.button
                  key={t.id} type="button" role="radio" aria-checked={value.tail === t.id} whileTap={{ scale: 0.95 }}
                  onClick={() => onChange({ tail: t.id })}
                  className="h-12 rounded-2xl border-0 text-[14px] font-bold"
                  style={value.tail === t.id ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#55555f' }}
                >
                  {t.label}
                </motion.button>
              ))}
            </div>
          </section>
        )}

        <section>
          <span className={label}>Letters</span>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" style={{ touchAction: 'pan-x' }} role="radiogroup" aria-label="Font">
            {BUBBLE_FONTS.map((f) => {
              const on = value.font === f.css
              return (
                <motion.button
                  key={f.css} type="button" role="radio" aria-checked={on} whileTap={{ scale: 0.94 }} onClick={() => onChange({ font: f.css })}
                  className="h-12 shrink-0 rounded-full border-0 px-5 text-[17px]"
                  style={{ fontFamily: f.css, ...(on ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#333' }) }}
                >
                  {f.label}
                </motion.button>
              )
            })}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="w-16 text-[13px] font-bold text-neutral-500">Size</span>
            <input
              type="range" min={5} max={18} step={0.5} value={value.size} aria-label="Text size"
              onChange={(e) => onChange({ size: +e.target.value })} className="h-11 flex-1" style={{ accentColor: accent }}
            />
          </div>
        </section>

        <section>
          <span className={label}>Outline</span>
          <div className="flex items-center gap-3">
            <span className="w-16 text-[13px] font-bold text-neutral-500">Thickness</span>
            <input
              type="range" min={0} max={10} step={0.5} value={value.stroke ?? 2.2} aria-label="Outline thickness"
              onChange={(e) => onChange({ stroke: +e.target.value })} className="h-11 flex-1" style={{ accentColor: accent }}
            />
          </div>
          <div className="no-scrollbar -mx-4 mt-1 flex gap-1 overflow-x-auto px-4" style={{ touchAction: 'pan-x' }} role="radiogroup" aria-label="Outline colour">
            {BUBBLE_STROKE_COLORS.map((c) => {
              const on = (value.strokeColor ?? INK).toLowerCase() === c.toLowerCase()
              return (
                <motion.button
                  key={c} type="button" role="radio" aria-checked={on} aria-label={`Outline ${c}`} whileTap={{ scale: 0.88 }}
                  onClick={() => onChange({ strokeColor: c })}
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-0 bg-transparent"
                >
                  <span className="h-8 w-8 rounded-full" style={{ background: c, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${accent}` : 'inset 0 0 0 1px rgba(0,0,0,.18)' }} />
                </motion.button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}
