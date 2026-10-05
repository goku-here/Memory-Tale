import { AnimatePresence, motion } from 'framer-motion'
import { BringToFront, Copy, Frame, MapPin, Pencil, RotateCw, SendToBack, Trash2 } from 'lucide-react'
import { memo, useLayoutEffect, useRef, type PointerEvent as RPE } from 'react'
import type { CanvasItem } from '../types'
import { DrawItem } from './DrawLayer'
import { MapCard } from './MapCard'
import { PhotoFrame } from './PhotoFrame'
import { StickerArt } from './stickers'
import { StickyNote } from './StickyNote'

interface ItemProps {
  item: CanvasItem
  dragging: boolean
  editing: boolean
  onPointerDown: (e: RPE, id: string) => void
  onMeasure: (id: string, h: number) => void
  onEditText: (id: string, text: string) => void
  onEditDone: () => void
}

function TextBody({ item, onMeasure }: { item: Extract<CanvasItem, { type: 'text' }>; onMeasure: ItemProps['onMeasure'] }) {
  const ref = useRef<HTMLDivElement>(null)
  const p = item.props
  useLayoutEffect(() => {
    const h = ref.current?.offsetHeight
    if (h && Math.abs(h - item.height) > 1) onMeasure(item.id, h)
  }, [p.text, p.font, p.size, item.width, item.height, item.id, onMeasure])
  return (
    <div
      ref={ref}
      style={{
        fontFamily: p.font, fontSize: p.size, color: p.color, textAlign: p.align, lineHeight: 1.15,
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', width: '100%',
        textShadow: '0 1px 0 rgba(255,255,255,.5)',
      }}
    >
      {p.text || ' '}
    </div>
  )
}

function DividerBody({ item, editing, onEditText, onEditDone }: { item: Extract<CanvasItem, { type: 'divider' }> } & Pick<ItemProps, 'editing' | 'onEditText' | 'onEditDone'>) {
  const { label, color } = item.props
  return (
    <div className="relative flex h-full w-full items-center" style={{ containerType: 'inline-size' }}>
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2" style={{ borderTop: `3px dashed ${color}`, opacity: 0.7 }} />
      <div
        className="relative mx-auto flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-extrabold"
        style={{ color, boxShadow: `0 2px 8px rgba(30,30,50,.14), inset 0 0 0 2px ${color}` }}
      >
        <MapPin size={14} strokeWidth={2.6} />
        {editing ? (
          <input
            autoFocus data-ui value={label} maxLength={28}
            onChange={(e) => onEditText(item.id, e.target.value)}
            onBlur={onEditDone}
            onKeyDown={(e) => e.key === 'Enter' && onEditDone()}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-32 border-0 bg-transparent p-0 text-[13px] font-extrabold outline-none"
            style={{ color }}
          />
        ) : (
          label || 'Next stop'
        )}
      </div>
    </div>
  )
}

/** One item on the canvas. Positioned by centre (x in %, y in px). */
export const CanvasItemView = memo(function CanvasItemView({ item, dragging, editing, onPointerDown, onMeasure, onEditText, onEditDone }: ItemProps) {
  let body
  switch (item.type) {
    case 'photo': body = <PhotoFrame photo={item.props} width={item.width} />; break
    case 'sticker': body = <StickerArt sticker={item.props} width={item.width} />; break
    case 'text': body = <TextBody item={item} onMeasure={onMeasure} />; break
    case 'note': body = <StickyNote text={item.props.text} color={item.props.color} editing={editing} onChange={(t) => onEditText(item.id, t)} onDone={onEditDone} />; break
    case 'draw': body = <DrawItem draw={item.props} />; break
    case 'map': body = <MapCard map={item.props} />; break
    case 'divider': body = <DividerBody item={item} editing={editing} onEditText={onEditText} onEditDone={onEditDone} />; break
  }

  return (
    <motion.div
      data-item={item.id}
      className="no-select absolute"
      style={{
        left: `${item.x}%`, top: item.y, width: item.width, height: item.type === 'text' ? 'auto' : item.height,
        x: '-50%', y: '-50%', rotate: item.rotation, zIndex: item.zIndex, touchAction: 'none',
        cursor: dragging ? 'grabbing' : 'grab',
      }}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 22 }}
      onPointerDown={(e) => { if (!editing) onPointerDown(e, item.id) }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <motion.div
        className="h-full w-full"
        animate={{ scale: dragging ? 1.05 : 1, rotate: dragging ? 2.5 : 0 }}
        transition={{ type: 'spring', stiffness: 500, damping: 26 }}
        style={{ filter: dragging ? 'drop-shadow(0 16px 16px rgba(20,20,40,.2))' : undefined, willChange: dragging ? 'transform' : undefined }}
      >
        {body}
      </motion.div>
    </motion.div>
  )
})

/* ---------------- selection chrome ---------------- */

export interface SelectionActions {
  onHandle: (e: RPE, kind: 'resize' | 'rotate') => void
  onDuplicate: () => void
  onDelete: () => void
  onForward: () => void
  onBackward: () => void
  onEdit?: () => void
  onFrame?: () => void
}

function TB({ label, onClick, children, danger }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <motion.button
      type="button" aria-label={label} title={label} whileTap={{ scale: 0.9 }} onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      className={`grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent ${danger ? 'text-[#d6455d]' : 'text-[#17171a]'}`}
    >
      {children}
    </motion.button>
  )
}

export function SelectionOverlay({
  item, canvasW, topLimit, accent, actions, hideToolbar,
}: { item: CanvasItem; canvasW: number; topLimit: number; accent: string; actions: SelectionActions; hideToolbar?: boolean }) {
  const cx = (item.x / 100) * canvasW
  const rad = (item.rotation * Math.PI) / 180
  const hh = (Math.abs(item.width * Math.sin(rad)) + Math.abs(item.height * Math.cos(rad))) / 2
  const nButtons = 4 + (actions.onEdit ? 1 : 0) + (actions.onFrame ? 1 : 0)
  const tbW = nButtons * 44 + 16
  const above = item.y - hh - 62
  const placeAbove = above > topLimit
  const tbY = placeAbove ? above : item.y + hh + 16
  const tbX = Math.min(Math.max(cx, tbW / 2 + 6), canvasW - tbW / 2 - 6)

  return (
    <>
      {/* frame + handles, rotated with the item */}
      <div
        aria-hidden={false}
        className="pointer-events-none absolute"
        style={{
          left: `${item.x}%`, top: item.y, width: item.width, height: item.height,
          transform: `translate(-50%,-50%) rotate(${item.rotation}deg)`, zIndex: 9500,
        }}
      >
        <div className="absolute -inset-1 rounded-[6px]" style={{ border: `1.5px solid ${accent}`, boxShadow: '0 0 0 1px rgba(255,255,255,.9)' }} />
        {[[-1, -1], [1, -1], [-1, 1]].map(([sx, sy]) => (
          <i
            key={`${sx}${sy}`} className="absolute h-3 w-3 rounded-full bg-white"
            style={{ left: sx < 0 ? -10 : 'auto', right: sx > 0 ? -10 : 'auto', top: sy < 0 ? -10 : 'auto', bottom: sy > 0 ? -10 : 'auto', border: `2px solid ${accent}` }}
          />
        ))}
        {/* resize + rotate */}
        <button
          type="button" data-ui aria-label="Resize and rotate"
          className="pointer-events-auto absolute grid h-11 w-11 touch-none place-items-center border-0 bg-transparent"
          style={{ right: -26, bottom: -26 }}
          onPointerDown={(e) => actions.onHandle(e, 'resize')}
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white shadow" style={{ border: `2px solid ${accent}` }}>
            <RotateCw size={12} color={accent} strokeWidth={3} />
          </span>
        </button>
        {/* rotate only */}
        <button
          type="button" data-ui aria-label="Rotate"
          className="pointer-events-auto absolute grid h-11 w-11 touch-none place-items-center border-0 bg-transparent"
          style={{ left: '50%', top: -52, marginLeft: -22 }}
          onPointerDown={(e) => actions.onHandle(e, 'rotate')}
        >
          <span className="h-3 w-3 rounded-full bg-white" style={{ border: `2px solid ${accent}` }} />
        </button>
        <i className="absolute left-1/2 -ml-px w-0.5" style={{ top: -30, height: 26, background: accent, opacity: 0.6 }} />
      </div>

      {/* mini toolbar */}
      <AnimatePresence>
        {!hideToolbar && <motion.div
          key={item.id}
          data-ui
          className="absolute flex items-center rounded-full bg-white px-2"
          style={{ left: tbX, top: tbY, x: '-50%', zIndex: 9600, boxShadow: '0 6px 22px rgba(20,24,40,.2), 0 0 0 1px rgba(20,24,40,.05)' }}
          initial={{ opacity: 0, scale: 0.85, y: placeAbove ? 8 : -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          {actions.onFrame && <TB label="Frame" onClick={actions.onFrame}><Frame size={19} /></TB>}
          {actions.onEdit && <TB label="Edit" onClick={actions.onEdit}><Pencil size={18} /></TB>}
          <TB label="Duplicate" onClick={actions.onDuplicate}><Copy size={18} /></TB>
          <TB label="Bring forward" onClick={actions.onForward}><BringToFront size={19} /></TB>
          <TB label="Send backward" onClick={actions.onBackward}><SendToBack size={19} /></TB>
          <TB label="Delete" onClick={actions.onDelete} danger><Trash2 size={18} /></TB>
        </motion.div>}
      </AnimatePresence>
    </>
  )
}
