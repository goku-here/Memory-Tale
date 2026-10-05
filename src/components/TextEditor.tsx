import { motion } from 'framer-motion'
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { TextProps } from '../types'

export const TEXT_FONTS: { label: string; css: string }[] = [
  { label: 'Playfair', css: "'Playfair Display', serif" },
  { label: 'Dancing', css: "'Dancing Script', cursive" },
  { label: 'Pacifico', css: "'Pacifico', cursive" },
  { label: 'Caveat', css: "'Caveat', cursive" },
  { label: 'Marker', css: "'Permanent Marker', cursive" },
  { label: 'Bangers', css: "'Bangers', cursive" },
  { label: 'Bebas', css: "'Bebas Neue', sans-serif" },
  { label: 'Poppins', css: "'Poppins', sans-serif" },
  { label: 'Typewriter', css: "'Special Elite', monospace" },
]

interface Props {
  value: TextProps
  /** theme colours first */
  colors: string[]
  accent: string
  onChange: (patch: Partial<TextProps>) => void
}

const EXTRA = ['#17171A', '#FFFFFF', '#E5486F', '#F28C38', '#2F8FD0', '#5F8650']

export function TextEditor({ value, colors, accent, onChange }: Props) {
  const ta = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const t = setTimeout(() => { ta.current?.focus(); ta.current?.select() }, 380)
    return () => clearTimeout(t)
  }, [])
  const swatches = [...new Set([...colors.filter((c) => c !== '#FFFFFF'), ...EXTRA])]

  return (
    <div className="space-y-5 pb-2">
      <div className="px-5">
        <textarea
          ref={ta} rows={2} value={value.text} onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Type something lovely…" aria-label="Text"
          className="w-full resize-none rounded-2xl border-0 bg-neutral-100 p-4 text-[17px] text-[#17171a] outline-none"
        />
      </div>

      <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-5 pb-1" style={{ touchAction: 'pan-x' }} role="radiogroup" aria-label="Font">
        {TEXT_FONTS.map((f) => {
          const on = value.font === f.css
          return (
            <motion.button
              key={f.css} type="button" role="radio" aria-checked={on} whileTap={{ scale: 0.94 }} onClick={() => onChange({ font: f.css })}
              className="grid h-[72px] w-[96px] shrink-0 place-items-center rounded-2xl border-0"
              style={{ background: on ? `${accent}18` : '#f6f6f8', boxShadow: on ? `inset 0 0 0 2px ${accent}` : 'none' }}
            >
              <span className="text-[26px] leading-none" style={{ fontFamily: f.css, color: '#17171a' }}>Aa</span>
              <span className="text-[11px] font-bold text-neutral-500">{f.label}</span>
            </motion.button>
          )
        })}
      </div>

      <div className="flex items-center gap-4 px-5">
        <label className="flex flex-1 items-center gap-3">
          <span className="text-[12px] font-bold uppercase tracking-wider text-neutral-400">Size</span>
          <input
            type="range" min={14} max={96} value={value.size} aria-label="Font size"
            onChange={(e) => onChange({ size: +e.target.value })}
            className="h-11 flex-1" style={{ accentColor: accent }}
          />
        </label>
        <div className="flex rounded-full bg-neutral-100 p-1" role="group" aria-label="Alignment">
          {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
            <motion.button
              key={a} type="button" aria-label={`Align ${a}`} aria-pressed={value.align === a} whileTap={{ scale: 0.9 }}
              onClick={() => onChange({ align: a })}
              className="grid h-11 w-11 place-items-center rounded-full border-0"
              style={value.align === a ? { background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.15)' } : { background: 'transparent' }}
            >
              <Icon size={18} />
            </motion.button>
          ))}
        </div>
      </div>

      <div className="no-scrollbar flex gap-1 overflow-x-auto px-4" style={{ touchAction: 'pan-x' }} role="radiogroup" aria-label="Colour">
        {swatches.map((c) => {
          const on = value.color.toLowerCase() === c.toLowerCase()
          return (
            <motion.button
              key={c} type="button" role="radio" aria-checked={on} aria-label={c} whileTap={{ scale: 0.88 }} onClick={() => onChange({ color: c })}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-0 bg-transparent"
            >
              <span
                className="h-8 w-8 rounded-full"
                style={{ background: c, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${accent}` : 'inset 0 0 0 1px rgba(0,0,0,.14)' }}
              />
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
