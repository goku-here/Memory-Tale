import { motion } from 'framer-motion'
import { Check, Trash2, Undo2 } from 'lucide-react'
import type { BrushId } from '../types'
import { IcEraserTool, IcHighlighterTool, IcMarkerTool, IcPencilTool, IcPenTool } from './ToolIcons'

const PEN_EXTRA = ['#17171A', '#FFFFFF', '#E5486F', '#F28C38', '#FFC93C', '#2F8FD0', '#5F8650']

interface Props {
  colors: string[]
  color: string
  size: number
  brush: BrushId
  erase: boolean
  strokeCount: number
  accent: string
  onColor: (c: string) => void
  onSize: (n: number) => void
  onBrush: (b: BrushId) => void
  onErase: (on: boolean) => void
  onUndo: () => void
  onClear: () => void
  onDone: () => void
}

const TOOLS: { id: BrushId | 'eraser'; label: string; icon: React.ReactNode }[] = [
  { id: 'pen', label: 'Pen', icon: <IcPenTool /> },
  { id: 'marker', label: 'Marker', icon: <IcMarkerTool /> },
  { id: 'highlighter', label: 'Highlight', icon: <IcHighlighterTool /> },
  { id: 'pencil', label: 'Pencil', icon: <IcPencilTool /> },
  { id: 'eraser', label: 'Eraser', icon: <IcEraserTool /> },
]

export function DrawTool({ colors, color, size, brush, erase, strokeCount, accent, onColor, onSize, onBrush, onErase, onUndo, onClear, onDone }: Props) {
  const swatches = [...new Set([...colors.filter((c) => c !== '#FFFFFF'), ...PEN_EXTRA])]
  return (
    <div className="space-y-3 px-4 pb-2">
      <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Drawing tool">
        {TOOLS.map((t) => {
          const on = t.id === 'eraser' ? erase : !erase && brush === t.id
          return (
            <motion.button
              key={t.id} type="button" role="radio" aria-checked={on} aria-label={t.label} whileTap={{ scale: 0.92 }}
              onClick={() => (t.id === 'eraser' ? onErase(true) : (onErase(false), onBrush(t.id)))}
              className="flex h-[66px] flex-col items-center justify-end gap-0.5 overflow-hidden rounded-2xl border-0 pb-1.5"
              style={{ background: on ? `${accent}1f` : '#f6f6f8', boxShadow: on ? `inset 0 0 0 2px ${accent}` : 'none' }}
            >
              <span className="flex h-[34px] items-end" style={{ transform: on ? 'translateY(-3px)' : undefined, transition: 'transform .15s' }}>{t.icon}</span>
              <span className="text-[10.5px] font-extrabold text-neutral-600">{t.label}</span>
            </motion.button>
          )
        })}
      </div>
      <div className="no-scrollbar flex gap-1 overflow-x-auto" style={{ touchAction: 'pan-x', display: erase ? 'none' : undefined }} role="radiogroup" aria-label="Pen colour">
        {swatches.map((c) => {
          const on = c.toLowerCase() === color.toLowerCase()
          return (
            <motion.button
              key={c} type="button" role="radio" aria-checked={on} aria-label={c} whileTap={{ scale: 0.88 }} onClick={() => onColor(c)}
              className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-0 bg-transparent"
            >
              <span className="h-8 w-8 rounded-full" style={{ background: c, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${accent}` : 'inset 0 0 0 1px rgba(0,0,0,.14)' }} />
            </motion.button>
          )
        })}
      </div>
      <div className="flex items-center gap-3 px-1">
        <span className="grid h-11 w-11 shrink-0 place-items-center">
          <span className="rounded-full" style={{ width: Math.max(4, size), height: Math.max(4, size), background: erase ? '#f7b8b8' : color, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.12)' }} />
        </span>
        <input
          type="range" min={2} max={24} value={size} aria-label={erase ? 'Eraser size' : 'Pen thickness'} onChange={(e) => onSize(+e.target.value)}
          className="h-11 flex-1" style={{ accentColor: accent }}
        />
      </div>
      <div className="flex items-center gap-2">
        <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={onUndo} disabled={!strokeCount} aria-label="Undo stroke"
          className="grid h-12 w-12 place-items-center rounded-full border-0 bg-neutral-100 disabled:opacity-35">
          <Undo2 size={20} />
        </motion.button>
        <motion.button type="button" whileTap={{ scale: 0.94 }} onClick={onClear} disabled={!strokeCount} aria-label="Clear drawing"
          className="grid h-12 w-12 place-items-center rounded-full border-0 bg-neutral-100 disabled:opacity-35">
          <Trash2 size={19} />
        </motion.button>
        <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={onDone}
          className="ml-auto flex h-12 items-center gap-2 rounded-full border-0 bg-[#17171a] px-6 text-[15px] font-semibold text-white">
          <Check size={18} strokeWidth={3} /> Done
        </motion.button>
      </div>
    </div>
  )
}
