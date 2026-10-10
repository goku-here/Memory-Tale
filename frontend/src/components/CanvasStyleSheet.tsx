import { motion } from 'framer-motion'
import { Check, RotateCcw } from 'lucide-react'
import { inkChoices, isTexture, PATTERNS, resolveCanvas, swatchesFor } from '../lib/canvasStyle'
import type { CanvasStyle } from '../types'
import { getTheme } from './ThemeEngine'
import { ToolSheet } from './ToolSheet'
import type { Memory } from '../types'

const Label = ({ children }: { children: string }) => <div className="px-5 pb-2 pt-4 text-[12px] font-extrabold uppercase tracking-wider text-neutral-400">{children}</div>

/** Pick the canvas pattern, the background colour (chosen for the mood of this kind of memory) and the pattern colour. */
export function CanvasStyleSheet({ open, onClose, memory, value, onChange, onHeight }: {
  open: boolean; onClose: () => void; memory: Memory; value: CanvasStyle | undefined; onChange: (v: CanvasStyle) => void; onHeight?: (px: number) => void
}) {
  const theme = getTheme(memory.themeId)
  const cur = resolveCanvas(theme, value)
  const swatches = swatchesFor(theme)
  const bgNow = value?.bg ?? theme.canvasBg
  const active = swatches.find((s) => s.value.toLowerCase() === bgNow.toLowerCase())
  const pick = (patch: Partial<CanvasStyle>) => onChange({ ...value, ...patch })
  const showInk = !isTexture(cur.pattern) && cur.pattern !== 'plain'

  return (
    <ToolSheet open={open} onClose={onClose} title="Canvas style" snaps={[0.58, 0.9]} dim={0.1} z={60} onVisibleHeight={onHeight}>
      <div className="pb-6">
        <Label>Pattern</Label>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1" style={{ touchAction: 'pan-x' }}>
          {PATTERNS.map((p) => {
            const on = cur.pattern === p.id
            const prev = resolveCanvas(theme, { ...value, pattern: p.id })
            return (
              <motion.button
                key={p.id} type="button" whileTap={{ scale: 0.94 }} aria-pressed={on} aria-label={p.name} onClick={() => pick({ pattern: p.id })}
                className="flex w-[84px] shrink-0 flex-col items-center gap-1.5 border-0 bg-transparent p-0"
              >
                <span className="block h-[84px] w-full rounded-2xl" style={{ ...prev.css, boxShadow: on ? `inset 0 0 0 2.5px ${theme.palette[0]}` : 'inset 0 0 0 1px rgba(0,0,0,.1)' }} />
                <span className="text-[12px] font-bold text-neutral-600">{p.name}</span>
              </motion.button>
            )
          })}
        </div>

        <Label>Background</Label>
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1" style={{ touchAction: 'pan-x' }}>
          {swatches.map((s) => {
            const on = s.value.toLowerCase() === bgNow.toLowerCase()
            return (
              <motion.button
                key={s.value} type="button" whileTap={{ scale: 0.9 }} aria-pressed={on} aria-label={s.name} onClick={() => pick({ bg: s.value === theme.canvasBg ? undefined : s.value })}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-0 p-0"
                style={{ background: s.value, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${theme.palette[0]}` : 'inset 0 0 0 1px rgba(0,0,0,.14)' }}
              >
                {on && <Check size={18} strokeWidth={3.2} color={cur.dark && s.value === bgNow ? '#fff' : '#17171a'} />}
              </motion.button>
            )
          })}
        </div>
        {active && (
          <p className="m-0 px-5 pt-2.5 text-[13.5px] leading-snug text-neutral-500"><b className="text-[#17171a]">{active.name}.</b> {active.why}</p>
        )}

        {showInk && (
          <>
            <Label>Pattern colour</Label>
            <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-1" style={{ touchAction: 'pan-x' }}>
              {inkChoices(theme).map((c) => {
                const on = (value?.ink ?? undefined) === c.value
                return (
                  <motion.button
                    key={c.name} type="button" whileTap={{ scale: 0.9 }} aria-pressed={on} aria-label={c.name} onClick={() => pick({ ink: c.value })}
                    className="flex w-[58px] shrink-0 flex-col items-center gap-1 border-0 bg-transparent p-0"
                  >
                    <span
                      className="grid h-10 w-10 place-items-center rounded-full text-[11px] font-extrabold"
                      style={{ background: c.value ?? `conic-gradient(${cur.ink} 0 50%, #fff 0)`, color: '#17171a', boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${theme.palette[0]}` : 'inset 0 0 0 1px rgba(0,0,0,.16)' }}
                    >
                      {on && <Check size={16} strokeWidth={3.2} color={c.value === '#FFFFFF' || !c.value ? '#17171a' : '#fff'} />}
                    </span>
                    <span className="text-[11.5px] font-bold text-neutral-500">{c.name}</span>
                  </motion.button>
                )
              })}
            </div>
          </>
        )}

        <div className="px-5 pt-5">
          <button type="button" onClick={() => onChange({})} className="flex h-11 items-center gap-2 rounded-full border-0 bg-neutral-100 px-5 text-[14px] font-bold text-[#17171a]">
            <RotateCcw size={16} /> Back to the theme look
          </button>
        </div>
      </div>
    </ToolSheet>
  )
}
