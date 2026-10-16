import { motion } from 'framer-motion'
import { Check, Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'

const RAINBOW = 'conic-gradient(from 0deg, #ff3b3b, #ffb300, #e6ff2e, #2ee86b, #2ed1ff, #3b5bff, #b13bff, #ff3bb4, #ff3b3b)'

/* ---------- colour maths ---------- */
type Hsv = { h: number; s: number; v: number }
function hexToHsv(hex: string): Hsv {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  const n = m ? parseInt(m[1], 16) : 0x2f8fd0
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max }
}
function hsvToHex({ h, s, v }: Hsv) {
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)) }
  const to = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0')
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`.toUpperCase()
}

/** A colour of your own: pick the shade in the square, the hue on the bar, or type a code. */
function PickerPanel({ initial, accent, onUse, onClose }: { initial: string; accent: string; onUse: (hex: string) => void; onClose: () => void }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(initial))
  const [code, setCode] = useState(() => hsvToHex(hexToHsv(initial)))
  const box = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const hex = hsvToHex(hsv)
  const set = (n: Hsv) => { setHsv(n); setCode(hsvToHex(n)) }
  const fromBox = (e: React.PointerEvent) => {
    const r = box.current!.getBoundingClientRect()
    set({ ...hsv, s: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), v: 1 - Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) })
  }
  const fromBar = (e: React.PointerEvent) => {
    const r = bar.current!.getBoundingClientRect()
    set({ ...hsv, h: Math.min(359.9, Math.max(0, ((e.clientX - r.left) / r.width) * 360)) })
  }
  const drag = (fn: (e: React.PointerEvent) => void) => ({
    onPointerDown: (e: React.PointerEvent) => { e.currentTarget.setPointerCapture(e.pointerId); fn(e) },
    onPointerMove: (e: React.PointerEvent) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) fn(e) },
  })
  return createPortal(
    <div className="fixed inset-0 z-[300]" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Pick your own colour">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden />
      <motion.div
        className="absolute inset-x-0 bottom-0 mx-auto max-w-[460px] rounded-t-[28px] bg-white px-5 pb-6 pt-4 shadow-[0_-10px_40px_rgba(20,24,40,.25)]"
        style={{ paddingBottom: 'calc(var(--safe-bottom) + 20px)' }}
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 340, damping: 32 }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-[16px] font-extrabold text-[#17171a]">Your own colour</h3>
          <span className="h-8 w-8 rounded-full" style={{ background: hex, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.18)' }} aria-hidden />
        </div>
        <div
          ref={box} {...drag(fromBox)} role="slider" aria-label="Shade"
          className="relative h-[170px] w-full touch-none overflow-hidden rounded-2xl"
          style={{ background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))` }}
        >
          <span className="absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex, boxShadow: '0 0 0 3px #fff, 0 2px 8px rgba(0,0,0,.4)' }} />
        </div>
        <div ref={bar} {...drag(fromBar)} role="slider" aria-label="Hue" className="relative mt-4 h-8 w-full touch-none rounded-full" style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}>
          <span className="absolute top-1/2 h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)`, boxShadow: '0 0 0 3px #fff, 0 2px 8px rgba(0,0,0,.4)' }} />
        </div>
        <div className="mt-4 flex items-center gap-3">
          <input
            value={code} aria-label="Colour code" maxLength={7} spellCheck={false} autoCapitalize="characters"
            onChange={(e) => { const v = e.target.value; setCode(v); if (/^#?[0-9a-f]{6}$/i.test(v.trim())) setHsv(hexToHsv(v)) }}
            className="h-12 w-32 rounded-2xl border-0 bg-neutral-100 px-4 text-[16px] font-bold uppercase tracking-wider text-[#17171a] outline-none"
          />
          <button type="button" onClick={() => onUse(hex)} className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-0 text-[15px] font-bold text-white" style={{ background: accent }}>
            <Check size={18} strokeWidth={3} /> Use this colour
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}

/**
 * The last circle of any colour list: a rainbow circle that opens a colour picker for a colour that is not in the list.
 * When the colour in use is one of your own (`listed` is false) the circle shows it, inside the rainbow ring.
 */
export function CustomColor({
  value, listed, onPick, accent, cell = 'h-12 w-12', dot = 32,
}: { value: string; listed: boolean; onPick: (hex: string) => void; accent: string; cell?: string; dot?: number }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        type="button" aria-label="Pick your own colour" aria-pressed={!listed} onClick={() => setOpen(true)} onPointerDown={(e) => e.stopPropagation()}
        className={`grid ${cell} shrink-0 place-items-center rounded-full border-0 bg-transparent`}
      >
        <span className="grid place-items-center rounded-full" style={{ width: dot, height: dot, background: RAINBOW, boxShadow: !listed ? `0 0 0 2px #fff, 0 0 0 4px ${accent}` : 'inset 0 0 0 1px rgba(0,0,0,.14)' }}>
          <span className="grid place-items-center rounded-full" style={{ width: dot * 0.56, height: dot * 0.56, background: listed ? '#fff' : value, boxShadow: listed ? 'none' : '0 0 0 1.5px #fff' }}>
            {listed && <Plus size={dot * 0.36} strokeWidth={3.2} color="#55555f" />}
          </span>
        </span>
      </button>
      {open && <PickerPanel initial={value} accent={accent} onUse={(c) => { setOpen(false); onPick(c) }} onClose={() => setOpen(false)} />}
    </>
  )
}
