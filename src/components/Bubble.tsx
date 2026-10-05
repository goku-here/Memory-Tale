import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { BubbleProps, BubbleShape } from '../types'

export const BUBBLE_FONTS: { label: string; css: string }[] = [
  { label: 'Comic', css: "'Comic Neue', 'Comic Sans MS', cursive" },
  { label: 'Hand', css: "'Patrick Hand', cursive" },
  { label: 'Bangers', css: "'Bangers', cursive" },
  { label: 'Gochi', css: "'Gochi Hand', cursive" },
  { label: 'Luckiest', css: "'Luckiest Guy', cursive" },
]

export const BUBBLE_SHAPES: { id: BubbleShape; label: string }[] = [
  { id: 'speech', label: 'Speech' },
  { id: 'thought', label: 'Thought' },
  { id: 'shout', label: 'Shout' },
  { id: 'whisper', label: 'Whisper' },
  { id: 'box', label: 'Narration' },
]

const INK = '#17171a'

function spikes(cx: number, cy: number, rx: number, ry: number, n = 18) {
  const pts: string[] = []
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2
    const outer = i % 2 === 0
    const j = 1 + Math.sin(i * 12.9898) * 0.05
    const k = outer ? 1 * j : 0.8
    pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(2)},${(cy + Math.sin(a) * ry * k).toFixed(2)}`)
  }
  return pts.join(' ')
}

/** Comic bubble drawn as SVG (stroke stays crisp when scaled) with text laid on top. */
export function BubbleBody({
  bubble, width, height, editing = false, onChange, onDone,
}: { bubble: BubbleProps; width: number; height: number; editing?: boolean; onChange?: (t: string) => void; onDone?: () => void }) {
  const { shape, tail, text, font, size } = bubble
  const H = (100 * height) / Math.max(1, width)
  const hasTail = (shape === 'speech' || shape === 'thought' || shape === 'whisper') && tail !== 'none'
  const tailH = hasTail ? Math.min(20, H * 0.22) : 0
  const Hb = H - tailH
  const rx = 48.4
  const ry = (Hb - 2.6) / 2
  const cx = 50
  const cy = Hb / 2
  const P = (deg: number) => {
    const a = (deg * Math.PI) / 180
    return `${(cx + rx * Math.cos(a)).toFixed(2)} ${(cy + ry * Math.sin(a)).toFixed(2)}`
  }
  const flip = tail === 'right' ? 'translate(100 0) scale(-1 1)' : undefined
  const common = { fill: '#fff', stroke: INK, strokeWidth: 2.6, vectorEffect: 'non-scaling-stroke' as const, strokeLinejoin: 'round' as const }

  let art
  if (shape === 'box') {
    art = <rect x="1.4" y="1.4" width="97.2" height={H - 2.8} rx="2.6" {...common} />
  } else if (shape === 'shout') {
    art = <polygon points={spikes(50, H / 2, 49, H / 2 - 1)} {...common} strokeLinejoin="miter" />
  } else if (shape === 'thought') {
    art = (
      <g transform={flip}>
        <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...common} />
        {hasTail && (
          <>
            <circle cx="30" cy={Hb + tailH * 0.32} r={Math.min(4.2, tailH * 0.3)} {...common} />
            <circle cx="21" cy={H - Math.min(2.8, tailH * 0.18) - 0.8} r={Math.min(2.6, tailH * 0.18)} {...common} />
          </>
        )}
      </g>
    )
  } else {
    const dash = shape === 'whisper' ? { strokeDasharray: '5 4' } : {}
    art = hasTail ? (
      <path transform={flip} d={`M ${P(103)} A ${rx} ${ry} 0 1 0 ${P(132)} L 24 ${H - 1.2} Z`} {...common} {...dash} />
    ) : (
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...common} {...dash} />
    )
  }

  const inset = shape === 'box' ? '5% 5%' : shape === 'shout' ? '17% 15%' : '12% 12%'
  const textStyle = {
    fontFamily: font, fontWeight: 700, fontSize: `${size}cqw`, lineHeight: 1.12, color: INK, textTransform: 'uppercase',
    textAlign: 'center', whiteSpace: 'pre-wrap', wordBreak: 'break-word', width: '100%',
  } as const
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing) { ta.current?.focus(); ta.current?.select() }
  }, [editing])

  return (
    <div className="relative h-full w-full" style={{ containerType: 'inline-size', filter: 'drop-shadow(0 3px 4px rgba(30,30,40,.22))' }}>
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
  onChange: (p: Partial<BubbleProps>) => void
}

export function BubbleEditor({ value, accent, onChange }: EditorProps) {
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const t = setTimeout(() => { ta.current?.focus(); ta.current?.select() }, 380)
    return () => clearTimeout(t)
  }, [])
  const tails: { id: BubbleProps['tail']; label: string }[] = [
    { id: 'left', label: 'Tail left' }, { id: 'right', label: 'Tail right' }, { id: 'none', label: 'No tail' },
  ]
  const tailOk = value.shape !== 'shout' && value.shape !== 'box'

  return (
    <div className="space-y-5 pb-2">
      <div className="px-5">
        <textarea
          ref={ta} rows={2} value={value.text} onChange={(e) => onChange({ text: e.target.value })}
          placeholder="What are they saying?" aria-label="Bubble text"
          className="w-full resize-none rounded-2xl border-0 bg-neutral-100 p-4 text-[17px] text-[#17171a] outline-none"
        />
      </div>

      <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-5" style={{ touchAction: 'pan-x' }} role="radiogroup" aria-label="Bubble shape">
        {BUBBLE_SHAPES.map((s) => {
          const on = value.shape === s.id
          return (
            <motion.button
              key={s.id} type="button" role="radio" aria-checked={on} whileTap={{ scale: 0.94 }} onClick={() => onChange({ shape: s.id })}
              className="flex w-[92px] shrink-0 flex-col items-center gap-1.5 rounded-2xl border-0 p-2"
              style={{ background: on ? `${accent}18` : '#f6f6f8', boxShadow: on ? `inset 0 0 0 2px ${accent}` : 'none' }}
            >
              <div style={{ width: 72, height: 54 }}>
                <BubbleBody bubble={{ ...value, shape: s.id, text: '', tail: s.id === 'speech' || s.id === 'thought' || s.id === 'whisper' ? (value.tail === 'none' ? 'left' : value.tail) : 'none' }} width={72} height={54} />
              </div>
              <span className="text-[11px] font-bold text-neutral-500">{s.label}</span>
            </motion.button>
          )
        })}
      </div>

      <div className="flex gap-2 px-5" role="radiogroup" aria-label="Tail" style={{ opacity: tailOk ? 1 : 0.4 }}>
        {tails.map((t) => (
          <motion.button
            key={t.id} type="button" role="radio" aria-checked={value.tail === t.id} disabled={!tailOk} whileTap={{ scale: 0.95 }}
            onClick={() => onChange({ tail: t.id })}
            className="h-11 flex-1 rounded-full border-0 text-[13px] font-bold"
            style={value.tail === t.id ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#55555f' }}
          >
            {t.label}
          </motion.button>
        ))}
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-5" style={{ touchAction: 'pan-x' }} role="radiogroup" aria-label="Font">
        {BUBBLE_FONTS.map((f) => {
          const on = value.font === f.css
          return (
            <motion.button
              key={f.css} type="button" role="radio" aria-checked={on} whileTap={{ scale: 0.94 }} onClick={() => onChange({ font: f.css })}
              className="h-11 shrink-0 rounded-full border-0 px-4 text-[16px]"
              style={{ fontFamily: f.css, ...(on ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#333' }) }}
            >
              {f.label}
            </motion.button>
          )
        })}
      </div>

      <label className="flex items-center gap-3 px-5">
        <span className="text-[12px] font-bold uppercase tracking-wider text-neutral-400">Size</span>
        <input
          type="range" min={5} max={18} step={0.5} value={value.size} aria-label="Text size"
          onChange={(e) => onChange({ size: +e.target.value })} className="h-11 flex-1" style={{ accentColor: accent }}
        />
      </label>
    </div>
  )
}
