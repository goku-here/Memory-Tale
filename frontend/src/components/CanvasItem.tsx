import { AnimatePresence, motion } from 'framer-motion'
import { Check, MapPin, RotateCw } from 'lucide-react'
import { memo, useLayoutEffect, useRef, useState, type PointerEvent as RPE } from 'react'
import type { CanvasItem } from '../types'
import { BubbleBody } from './Bubble'
import { ClotheslineBody } from './Clothesline'
import { DrawItem } from './DrawLayer'
import { MapCard } from './MapCard'
import { IcCopy, IcDown, IcEdit, IcExpand, IcFrame, IcPalette, IcThread, IcTrash, IcUp } from './ToolIcons'
import { PhotoFrame } from './PhotoFrame'
import { StickerArt } from './stickers'
import { NOTE_COLORS, StickyNote } from './StickyNote'

interface ItemProps {
  item: CanvasItem
  canvasW: number
  selected: boolean
  onSlot: (id: string, index: number) => void
  onViewSlot: (id: string, index: number) => void
  onItemClick: (id: string) => void
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
export const CanvasItemView = memo(function CanvasItemView({ item, canvasW, selected, onSlot, onViewSlot, onItemClick, dragging, editing, onPointerDown, onMeasure, onEditText, onEditDone }: ItemProps) {
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
        touchAction: selected ? 'none' : 'pan-x pan-y', cursor: dragging ? 'grabbing' : 'grab', willChange: 'transform',
        // a background does not catch taps until it is chosen (from its "Background" tab)
        pointerEvents: item.type === 'photo' && item.props.background && !selected ? 'none' : undefined,
      }}
      initial={{ scale: 0.5, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.6, opacity: 0, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 22 }}
      onPointerDown={(e) => { if (!editing) onPointerDown(e, item.id) }}
      onClick={() => onItemClick(item.id)}
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
  onConnect?: () => void
  onView?: () => void
  onColor?: (color: string) => void
}

function TB({ label, onClick, children, danger, caption, w = 42 }: { label: string; onClick: () => void; children: React.ReactNode; danger?: boolean; caption: string; w?: number }) {
  return (
    <motion.button
      type="button" aria-label={label} title={label} whileTap={{ scale: 0.9 }} onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      style={{ width: w }} className={`grid h-[54px] place-items-center rounded-2xl border-0 bg-transparent ${danger ? 'text-[#d6455d]' : 'text-[#17171a]'}`}
    >
      <span className="flex flex-col items-center gap-1 leading-none">
        {children}
        <span className={`whitespace-nowrap text-[9px] font-extrabold tracking-tight ${danger ? 'text-[#d6455d]' : 'text-neutral-500'}`}>{caption}</span>
      </span>
    </motion.button>
  )
}

export function SelectionOverlay({
  item, canvasW, topLimit, accent, actions, hideToolbar, zoom = 1, locked = false,
}: { item: CanvasItem; canvasW: number; topLimit: number; accent: string; actions: SelectionActions; hideToolbar?: boolean; zoom?: number; locked?: boolean }) {
  const cx = (item.x / 100) * canvasW
  const rad = (item.rotation * Math.PI) / 180
  const hh = (Math.abs(item.width * Math.sin(rad)) + Math.abs(item.height * Math.cos(rad))) / 2
  const [colorsOpen, setColorsOpen] = useState(false)
  const nButtons = locked ? 2 : 4 + (actions.onEdit ? 1 : 0) + (actions.onFrame ? 1 : 0) + (actions.onConnect ? 1 : 0) + (actions.onView ? 1 : 0) + (actions.onColor ? 1 : 0)
  // the toolbar and handles keep their on-screen size however far the canvas is zoomed out
  const k = 1 / zoom
  // a little more room between the buttons on wider screens; phones need the tighter fit
  const bw = canvasW >= 440 ? 50 : 42
  const gap = canvasW >= 440 ? 8 : 4
  const tbW = (nButtons * bw + (nButtons - 1) * gap + 16) * k
  const bottomEdge = item.y - hh - 18 * k
  const placeAbove = bottomEdge - 54 * k > topLimit
  const tbY = placeAbove ? bottomEdge - 54 : item.y + hh + 16 * k
  const tbX = Math.min(Math.max(cx, tbW / 2 + 6 * k), canvasW - tbW / 2 - 6 * k)
  const origin = placeAbove ? '50% 100%' : '50% 0%'

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
        {!locked && <button
          type="button" data-ui aria-label="Resize and rotate"
          className="pointer-events-auto absolute grid h-11 w-11 touch-none place-items-center border-0 bg-transparent"
          style={{ right: -26, bottom: -26, transform: `scale(${k})` }}
          onPointerDown={(e) => actions.onHandle(e, 'resize')}
        >
          <span className="grid h-6 w-6 place-items-center rounded-full bg-white shadow" style={{ border: `2px solid ${accent}` }}>
            <RotateCw size={12} color={accent} strokeWidth={3} />
          </span>
        </button>}
        {/* rotate only */}
        {!locked && <button
          type="button" data-ui aria-label="Rotate"
          className="pointer-events-auto absolute grid h-11 w-11 touch-none place-items-center border-0 bg-transparent"
          style={{ left: '50%', top: -30 * k - 22, marginLeft: -22, transform: `scale(${k})` }}
          onPointerDown={(e) => actions.onHandle(e, 'rotate')}
        >
          <span className="h-3 w-3 rounded-full bg-white" style={{ border: `2px solid ${accent}` }} />
        </button>}
        {!locked && <i className="absolute left-1/2 -ml-px w-0.5" style={{ top: -30 * k, height: 26 * k, background: accent, opacity: 0.6 }} />}
      </div>

      {/* mini toolbar */}
      <AnimatePresence>
        {!hideToolbar && <div key={item.id} data-ui className="absolute" style={{ left: tbX, top: tbY, zIndex: 9600, transform: `translateX(-50%) scale(${k})`, transformOrigin: origin }}><motion.div
          className="flex items-center rounded-full bg-white px-2"
          style={{ gap, boxShadow: '0 6px 22px rgba(20,24,40,.2), 0 0 0 1px rgba(20,24,40,.05)' }}
          initial={{ opacity: 0, scale: 0.85, y: placeAbove ? 8 : -8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        >
          {!locked && actions.onView && <TB w={bw} label="View full size" caption="View" onClick={actions.onView}><IcExpand /></TB>}
          {actions.onFrame && <TB w={bw} label="Frame" caption="Frame" onClick={actions.onFrame}><IcFrame /></TB>}
          {!locked && actions.onColor && <TB w={bw} label="Note colour" caption="Colour" onClick={() => setColorsOpen((v) => !v)}><IcPalette /></TB>}
          {!locked && actions.onEdit && <TB w={bw} label="Edit" caption="Edit" onClick={actions.onEdit}><IcEdit /></TB>}
          {!locked && actions.onConnect && <TB w={bw} label="Tie with thread" caption="Thread" onClick={actions.onConnect}><IcThread /></TB>}
          {!locked && <TB w={bw} label="Duplicate" caption="Copy" onClick={actions.onDuplicate}><IcCopy /></TB>}
          {!locked && <TB w={bw} label="Bring forward" caption="Bring up" onClick={actions.onForward}><IcUp /></TB>}
          {!locked && <TB w={bw} label="Send backward" caption="Send down" onClick={actions.onBackward}><IcDown /></TB>}
          <TB w={bw} label="Delete" caption="Delete" onClick={actions.onDelete} danger><IcTrash /></TB>
        </motion.div></div>}
        {!hideToolbar && colorsOpen && actions.onColor && (
          <div key="colors" data-ui className="absolute" style={{ left: tbX, top: placeAbove ? tbY - 54 * k : tbY + 56 * k, zIndex: 9600, transform: `translateX(-50%) scale(${k})`, transformOrigin: origin }}><motion.div
            className="flex items-center gap-0.5 rounded-full bg-white px-2"
            style={{ boxShadow: '0 6px 22px rgba(20,24,40,.2), 0 0 0 1px rgba(20,24,40,.05)' }}
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
          </motion.div></div>
        )}
      </AnimatePresence>
    </>
  )
}
