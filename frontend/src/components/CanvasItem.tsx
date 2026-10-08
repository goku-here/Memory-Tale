import { AnimatePresence, motion } from 'framer-motion'
import { BringToFront, Check, Copy, Frame, Maximize2, MapPin, Palette, Pencil, Replace, RotateCw, SendToBack, Spline, Trash2 } from 'lucide-react'
import { memo, useLayoutEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import type { CanvasItem } from '../types'
import { BubbleBody } from './Bubble'
import { ClotheslineBody } from './Clothesline'
import { DrawItem } from './DrawLayer'
import { MapCard } from './MapCard'
import { PhotoFrame } from './PhotoFrame'
import { StickerArt } from './stickers'
import { NOTE_COLORS, StickyNote } from './StickyNote'

interface ItemProps {
  item: CanvasItem
  canvasW: number
  selected: boolean
  onSlot: (id: string, index: number) => void
  onViewSlot: (id: string, index: number) => void
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

/** The visual content of an item, shared by the live canvas and the PNG export. */
export function ItemBody({
  item, editing = false, selected = false, onSlot, onView, onMeasure = () => {}, onEditText = () => {}, onEditDone = () => {},
}: { item: CanvasItem; editing?: boolean; selected?: boolean; onSlot?: (i: number) => void; onView?: (i: number) => void; onMeasure?: ItemProps['onMeasure']; onEditText?: ItemProps['onEditText']; onEditDone?: ItemProps['onEditDone'] }) {
  switch (item.type) {
    case 'photo': return <PhotoFrame photo={item.props} width={item.width} />
    case 'sticker': return <StickerArt sticker={item.props} width={item.width} />
    case 'text': return <TextBody item={item} onMeasure={onMeasure} />
    case 'note': return <StickyNote text={item.props.text} color={item.props.color} editing={editing} onChange={(t) => onEditText(item.id, t)} onDone={onEditDone} />
    case 'draw': return <DrawItem draw={item.props} />
    case 'map': return <MapCard map={item.props} />
    case 'divider': return <DividerBody item={item} editing={editing} onEditText={onEditText} onEditDone={onEditDone} />
    case 'bubble': return <BubbleBody bubble={item.props} width={item.width} height={item.height} />
    case 'clothesline': return <ClotheslineBody line={item.props} selected={selected} onSlot={onSlot} onView={onView} />
    case 'thread': return null
  }
}

/** One item on the canvas. Positioned by centre (x in %, y in px). */
export const CanvasItemView = memo(function CanvasItemView({ item, canvasW, selected, onSlot, onViewSlot, dragging, editing, onPointerDown, onMeasure, onEditText, onEditDone }: ItemProps) {
  const body = (
    <ItemBody item={item} editing={editing} selected={selected} onSlot={(i) => onSlot(item.id, i)} onView={(i) => onViewSlot(item.id, i)} onMeasure={onMeasure} onEditText={onEditText} onEditDone={onEditDone} />
  )

  return (
    <motion.div
      data-item={item.id}
      className="no-select absolute"
      style={{
        // positioned with transforms only (no layout work while dragging)
        left: 0, top: 0, width: item.width, height: item.type === 'text' ? 'auto' : item.height,
        marginLeft: -item.width / 2, marginTop: -item.height / 2,
        x: (item.x / 100) * canvasW, y: item.y, rotate: item.rotation, zIndex: item.zIndex,
        touchAction: selected ? 'none' : 'pan-y', cursor: dragging ? 'grabbing' : 'grab', willChange: 'transform',
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
  onReplace?: () => void
  onConnect?: () => void
  onView?: () => void
  onColor?: (color: string) => void
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
  const [colorsOpen, setColorsOpen] = useState(false)
  const nButtons = 4 + (actions.onEdit ? 1 : 0) + (actions.onFrame ? 1 : 0) + (actions.onReplace ? 1 : 0) + (actions.onConnect ? 1 : 0) + (actions.onView ? 1 : 0) + (actions.onColor ? 1 : 0)
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
          left: 0, top: 0, width: item.width, height: item.height, marginLeft: -item.width / 2, marginTop: -item.height / 2,
          transform: `translate(${cx}px, ${item.y}px) rotate(${item.rotation}deg)`, zIndex: 9500, willChange: 'transform',
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
          {actions.onView && <TB label="View full size" onClick={actions.onView}><Maximize2 size={18} /></TB>}
          {actions.onFrame && <TB label="Frame" onClick={actions.onFrame}><Frame size={19} /></TB>}
          {actions.onReplace && <TB label="Change photo" onClick={actions.onReplace}><Replace size={19} /></TB>}
          {actions.onColor && <TB label="Note colour" onClick={() => setColorsOpen((v) => !v)}><Palette size={19} /></TB>}
          {actions.onEdit && <TB label="Edit" onClick={actions.onEdit}><Pencil size={18} /></TB>}
          {actions.onConnect && <TB label="Tie with thread" onClick={actions.onConnect}><Spline size={19} /></TB>}
          <TB label="Duplicate" onClick={actions.onDuplicate}><Copy size={18} /></TB>
          <TB label="Bring forward" onClick={actions.onForward}><BringToFront size={19} /></TB>
          <TB label="Send backward" onClick={actions.onBackward}><SendToBack size={19} /></TB>
          <TB label="Delete" onClick={actions.onDelete} danger><Trash2 size={18} /></TB>
        </motion.div>}
        {!hideToolbar && colorsOpen && actions.onColor && (
          <motion.div
            key="colors" data-ui
            className="absolute flex items-center gap-0.5 rounded-full bg-white px-2"
            style={{ left: tbX, top: placeAbove ? tbY - 54 : tbY + 56, x: '-50%', zIndex: 9600, boxShadow: '0 6px 22px rgba(20,24,40,.2), 0 0 0 1px rgba(20,24,40,.05)' }}
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          >
            {NOTE_COLORS.map((c) => (
              <motion.button
                key={c} type="button" aria-label={`Colour ${c}`} whileTap={{ scale: 0.88 }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => actions.onColor?.(c)}
                className="grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: c, boxShadow: 'inset 0 0 0 1.5px rgba(0,0,0,.12)' }}>
                  {item.type === 'note' && item.props.color === c && <Check size={15} strokeWidth={3.2} color="#4a4338" />}
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
