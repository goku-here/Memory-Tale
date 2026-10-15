import { motion } from 'framer-motion'
import { AlignCenter, AlignLeft, AlignRight, Check, Palette, Type, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ResolvedCanvas } from '../lib/canvasStyle'
import type { TextProps } from '../types'
import { TEXT_FONTS } from './TextEditor'

const EXTRA = ['#17171A', '#FFFFFF', '#E5486F', '#F28C38', '#FFC93C', '#2F8FD0', '#5F8650', '#8F5BD0']
type Tool = 'font' | 'size' | 'align' | 'color'

interface Props {
  seed: TextProps
  /** theme colours first */
  palette: string[]
  accent: string
  /** the book's own canvas look, so the page matches it */
  look: ResolvedCanvas
  onDone: (p: TextProps) => void
  onCancel: () => void
}

/**
 * A page of its own for writing: an empty canvas where typing starts at once. Font, size, alignment and colour
 * sit above the keyboard and change the text while it is being typed; Done puts the whole block on the canvas.
 */
export function TextStudio({ seed, palette, accent, look, onDone, onCancel }: Props) {
  const [v, setV] = useState<TextProps>(seed)
  const [tool, setTool] = useState<Tool>('font')
  const [kb, setKb] = useState(0)
  const ta = useRef<HTMLTextAreaElement>(null)
  const swatches = [...new Set([...palette.filter((c) => c !== '#FFFFFF'), ...EXTRA])]
  const set = (p: Partial<TextProps>) => setV((x) => ({ ...x, ...p }))

  useEffect(() => {
    const t = setTimeout(() => { ta.current?.focus(); ta.current?.setSelectionRange(v.text.length, v.text.length) }, 120)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keep the tools right above the on-screen keyboard
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const on = () => setKb(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    on()
    vv.addEventListener('resize', on)
    vv.addEventListener('scroll', on)
    return () => { vv.removeEventListener('resize', on); vv.removeEventListener('scroll', on) }
  }, [])

  const tools: { id: Tool; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'font', label: 'Font', icon: Type },
    { id: 'size', label: 'Size', icon: () => <span className="text-[15px] font-extrabold leading-none">A<span className="text-[11px]">A</span></span> },
    { id: 'align', label: 'Align', icon: v.align === 'left' ? AlignLeft : v.align === 'right' ? AlignRight : AlignCenter },
    { id: 'color', label: 'Colour', icon: Palette },
  ]
  // tapping a tool puts the keyboard away; tapping the page brings it back
  const hideKeyboard = () => ta.current?.blur()
  const ink = v.color

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex flex-col" role="dialog" aria-label="Write text"
      style={{ ...look.css, background: look.bg, backgroundColor: look.bg, paddingTop: 'var(--safe-top)' }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}
    >
      <div className="flex items-center justify-between px-3 pt-3">
        <button type="button" aria-label="Cancel" onClick={onCancel} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/80 text-[#17171a] backdrop-blur"><X size={20} /></button>
        <motion.button
          type="button" whileTap={{ scale: 0.95 }} onClick={() => onDone(v)} disabled={!v.text.trim()}
          className="flex h-11 items-center gap-1.5 rounded-full border-0 bg-[#17171a] px-5 text-[15px] font-semibold text-white disabled:opacity-35"
        >
          <Check size={18} strokeWidth={3} /> Done
        </motion.button>
      </div>

      <textarea
        ref={ta} value={v.text} onChange={(e) => set({ text: e.target.value })}
        placeholder="Start typing…" aria-label="Your text" spellCheck
        className="min-h-0 w-full flex-1 resize-none border-0 bg-transparent px-7 pb-6 pt-8 outline-none"
        style={{ fontFamily: v.font, fontSize: v.size, color: ink, textAlign: v.align, lineHeight: 1.15, caretColor: accent, textShadow: '0 1px 0 rgba(255,255,255,.5)' }}
      />

      {/* tools: above the keyboard while typing, at the bottom once it is put away */}
      <div className="shrink-0" style={{ paddingBottom: kb > 0 ? kb : 'var(--safe-bottom)' }} onPointerDown={hideKeyboard}>
        <div className="mx-3 mb-2 overflow-hidden rounded-[22px] bg-white shadow-[0_10px_34px_rgba(20,24,40,.2),0_0_0_1px_rgba(20,24,40,.05)]">
          <div className="min-h-[84px] py-3">
            {tool === 'font' && (
              <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-3" style={{ touchAction: 'pan-x' }} role="radiogroup" aria-label="Font">
                {TEXT_FONTS.map((f) => {
                  const on = v.font === f.css
                  return (
                    <button
                      key={f.css} type="button" role="radio" aria-checked={on} onClick={() => set({ font: f.css })}
                      className="grid h-[66px] w-[88px] shrink-0 place-items-center rounded-2xl border-0"
                      style={{ background: on ? `${accent}18` : '#f6f6f8', boxShadow: on ? `inset 0 0 0 2px ${accent}` : 'none' }}
                    >
                      <span className="text-[24px] leading-none" style={{ fontFamily: f.css, color: '#17171a' }}>Aa</span>
                      <span className="text-[11px] font-bold text-neutral-500">{f.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {tool === 'size' && (
              <div className="flex items-center gap-3 px-5" style={{ minHeight: 66 }}>
                <span className="text-[13px] font-bold text-neutral-400">A</span>
                <input type="range" min={14} max={120} value={v.size} aria-label="Text size" onChange={(e) => set({ size: +e.target.value })} className="h-11 flex-1" style={{ accentColor: accent }} />
                <span className="text-[24px] font-bold text-neutral-500">A</span>
                <span className="w-9 text-right text-[13px] font-bold tabular-nums text-neutral-500">{Math.round(v.size)}</span>
              </div>
            )}
            {tool === 'align' && (
              <div className="flex items-center justify-center gap-3 px-5" style={{ minHeight: 66 }} role="group" aria-label="Alignment">
                {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
                  <button
                    key={a} type="button" aria-label={`Align ${a}`} aria-pressed={v.align === a} onClick={() => set({ align: a })}
                    className="grid h-14 w-24 place-items-center rounded-2xl border-0"
                    style={v.align === a ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#55555f' }}
                  >
                    <Icon size={22} />
                  </button>
                ))}
              </div>
            )}
            {tool === 'color' && (
              <div className="no-scrollbar flex gap-1 overflow-x-auto px-3" style={{ touchAction: 'pan-x', minHeight: 66 }} role="radiogroup" aria-label="Colour">
                {swatches.map((c) => {
                  const on = v.color.toLowerCase() === c.toLowerCase()
                  return (
                    <button key={c} type="button" role="radio" aria-checked={on} aria-label={c} onClick={() => set({ color: c })} className="grid h-14 w-12 shrink-0 place-items-center rounded-full border-0 bg-transparent">
                      <span className="h-9 w-9 rounded-full" style={{ background: c, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${accent}` : 'inset 0 0 0 1px rgba(0,0,0,.16)' }} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="flex border-t border-black/5" role="tablist" aria-label="Text tools">
            {tools.map((t) => {
              const on = tool === t.id
              const Icon = t.icon
              return (
                <button
                  key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setTool(t.id)}
                  className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 border-0 bg-transparent"
                  style={{ color: on ? accent : '#6b6b76' }}
                >
                  <Icon size={19} />
                  <span className="text-[11px] font-bold">{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
