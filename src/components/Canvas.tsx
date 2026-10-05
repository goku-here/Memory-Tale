import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { ArrowLeft, Check, Loader2, MoreHorizontal, Palette, PenLine, Redo2, Share2, Trash2, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useCanvas } from '../data/useCanvas'
import { uid } from '../lib/id'
import { compressImage } from '../lib/image'
import { clamp, cloneItem, frameHeight, nextZ, normalizeZ, rnd } from '../lib/items'
import { useGestures } from '../lib/useGestures'
import type { CanvasItem, FrameId, ItemPatch, Stroke, StickerProps, TextProps } from '../types'
import { formatDate } from './BookCard'
import { BottomToolbar, type ToolId } from './BottomToolbar'
import { CanvasItemView, SelectionOverlay } from './CanvasItem'
import { DrawLayer, DrawStrokes, strokesToItem } from './DrawLayer'
import { DrawTool } from './DrawTool'
import { FramePicker } from './FramePicker'
import { NOTE_COLORS } from './StickyNote'
import { StickerTray } from './StickerTray'
import { stickerRatio } from './stickers'
import { TextEditor } from './TextEditor'
import { FloatingShapes, getTheme, themeVars } from './ThemeEngine'
import { ToolSheet } from './ToolSheet'
import { IconButton, toast } from './ui'
import type { Memory } from '../types'

interface CanvasProps {
  memory: Memory
  onBack: () => void
  onEdit: () => void
  onTheme: () => void
  onShare: () => void
  onDelete: () => void
}

type Sheet = 'frame' | 'sticker' | 'text' | 'draw' | 'location' | null

function MenuItem({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <motion.button
      type="button" role="menuitem" whileTap={{ scale: 0.97 }} onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left text-[15px] font-semibold ${danger ? 'text-[#d6455d]' : 'text-[#17171a]'}`}
    >
      {icon}
      {label}
    </motion.button>
  )
}

const HEADER_H = 116

export function Canvas({ memory, onBack, onEdit, onTheme, onShare, onDelete }: CanvasProps) {
  const theme = getTheme(memory.themeId)
  const accent = theme.palette[0]
  const scroller = useRef<HTMLDivElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const scrollY = useMotionValue(0)
  const cv = useCanvas(memory.id)
  const { items, itemsRef, height, commit, live, begin, end, setHeight } = cv
  const heightRef = useRef(height)
  heightRef.current = height

  const [menu, setMenu] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [sheetHs, setSheetHs] = useState<Record<string, number>>({})
  const [canvasW, setCanvasW] = useState(() => Math.min(window.innerWidth, 520))
  const [captionFocus, setCaptionFocus] = useState(false)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [pen, setPen] = useState({ color: accent, size: 6 })
  const sheetH = Math.max(0, ...Object.values(sheetHs))

  const selected = useMemo(() => items.find((i) => i.id === selectedId), [items, selectedId])
  const photoCount = useMemo(() => items.filter((i) => i.type === 'photo').length, [items])
  const drawing = sheet === 'draw'

  const titleScale = useTransform(scrollY, [0, 120], [1, 0.82])
  const titleY = useTransform(scrollY, [0, 120], [0, -4])
  const subOpacity = useTransform(scrollY, [0, 80], [1, 0])

  useEffect(() => { scroller.current?.scrollTo(0, 0) }, [])
  useEffect(() => {
    const el = surface.current
    if (!el) return
    const ro = new ResizeObserver(() => setCanvasW(el.getBoundingClientRect().width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  /* ---------- item helpers ---------- */

  const patch = useCallback((id: string, p: ItemPatch, record = false) => {
    const fn = (list: CanvasItem[]) =>
      list.map((i) => (i.id === id ? ({ ...i, ...p, props: p.props ? { ...i.props, ...p.props } : i.props } as CanvasItem) : i))
    record ? commit(fn) : live(fn)
  }, [commit, live])

  /** centre of the part of the canvas that is currently visible (above any open sheet) */
  const viewCenter = useCallback(() => {
    const r = surface.current!.getBoundingClientRect()
    const top = HEADER_H + 20
    const bottom = window.innerHeight - Math.max(sheetH, 110)
    return { x: 50, y: Math.max(160, (top + bottom) / 2 - r.top) }
  }, [sheetH])

  const addItem = useCallback((make: (z: number, c: { x: number; y: number }) => CanvasItem, opts: { record?: boolean } = {}) => {
    const c = viewCenter()
    const id = uid()
    const fn = (list: CanvasItem[]) => [...list, { ...make(nextZ(list), c), id }]
    opts.record === false ? live(fn) : commit(fn)
    setSelectedId(id)
    return id
  }, [commit, live, viewCenter])

  /* ---------- gestures ---------- */

  const { startItem, startHandle } = useGestures({
    surfaceRef: surface, scrollerRef: scroller, itemsRef, heightRef, live, begin, end,
    onSelect: setSelectedId, onDragging: setDraggingId,
    topInset: HEADER_H + 40, bottomInset: 130,
    onDoubleTap: (id) => {
      const it = itemsRef.current.find((i) => i.id === id)
      if (!it) return
      if (it.type === 'photo') openFrame(true)
      else if (it.type === 'text') openText()
      else if (it.type === 'note' || it.type === 'divider') { begin(); setEditingId(id) }
    },
  })

  /* ---------- sheets ---------- */

  const closeSheet = useCallback(() => {
    if (sheet === 'draw') finishDrawing()
    else if (sheet === 'text') {
      const it = itemsRef.current.find((i) => i.id === selectedId)
      if (it?.type === 'text' && !it.props.text.trim()) live((l) => l.filter((x) => x.id !== it.id))
      end()
      if (it?.type === 'text' && !it.props.text.trim()) setSelectedId(null)
    } else if (sheet === 'frame') end()
    setSheet(null)
    setCaptionFocus(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, selectedId, strokes, end, live])

  const openFrame = (focusCaption = false) => {
    begin()
    setCaptionFocus(focusCaption)
    setSheet('frame')
  }
  const openText = () => { begin(); setSheet('text') }

  function finishDrawing() {
    if (strokes.length) {
      const r = strokesToItem(strokes, canvasW)
      const id = uid()
      commit((list) => [...list, {
        id, type: 'draw', x: r.x, y: r.y, width: r.width, height: r.height, rotation: 0, zIndex: nextZ(list), props: r.draw,
      }])
      setSelectedId(id)
    }
    setStrokes([])
  }

  /* ---------- adding things ---------- */

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return
    try {
      const imgs = await Promise.all([...files].map((f) => compressImage(f, { maxSize: 1400, quality: 0.8 })))
      const w = Math.round(clamp(canvasW * 0.5, 150, 250))
      let lastId = ''
      commit((list) => {
        let z = nextZ(list)
        const c = viewCenter()
        const added = imgs.map((img, i) => {
          const aspect = img.width / img.height
          const cols = imgs.length === 1 ? 1 : 2
          const col = i % cols
          const row = Math.floor(i / cols)
          const h = frameHeight('polaroid', w, aspect)
          lastId = uid()
          return {
            id: lastId, type: 'photo', zIndex: z++, width: w, height: h, rotation: Math.round(rnd(-7, 7) * 10) / 10,
            x: cols === 1 ? c.x : col === 0 ? 29 + rnd(-3, 3) : 71 + rnd(-3, 3),
            y: c.y + row * (h + 26) + rnd(-6, 6),
            props: { src: img.dataUrl, aspect, frame: 'polaroid' as FrameId, radius: 4, caption: '' },
          } satisfies CanvasItem
        })
        return [...list, ...added]
      })
      setSelectedId(lastId)
    } catch {
      toast("Couldn't read that photo")
    }
  }

  const addSticker = (s: StickerProps) => {
    const w = s.kind === 'emoji' ? 96 : s.kind === 'image' ? 140 : s.value.startsWith('tape') ? 170 : 120
    const ratio = stickerRatio(s)
    addItem((z, c) => ({
      id: '', type: 'sticker', zIndex: z, x: c.x + rnd(-14, 14), y: c.y + rnd(-30, 30),
      width: w, height: w / ratio, rotation: Math.round(rnd(-12, 12)), props: s,
    }))
  }

  const addText = () => {
    begin()
    addItem((z, c) => ({
      id: '', type: 'text', zIndex: z, x: c.x, y: c.y, width: Math.round(canvasW * 0.7), height: 48, rotation: 0,
      props: { text: 'Your words', font: theme.font, size: 38, color: theme.palette[0], align: 'center' },
    }), { record: false })
    setSheet('text')
  }

  const addNote = () => {
    begin()
    const id = addItem((z, c) => ({
      id: '', type: 'note', zIndex: z, x: c.x + rnd(-8, 8), y: c.y, width: 176, height: 176,
      rotation: Math.round(rnd(-5, 5) * 10) / 10,
      props: { text: '', color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)] },
    }), { record: false })
    setEditingId(id)
  }

  const addDivider = () => {
    const n = itemsRef.current.filter((i) => i.type === 'divider').length + 1
    addItem((z, c) => ({
      id: '', type: 'divider', zIndex: z, x: 50, y: c.y, width: Math.round(canvasW * 0.9), height: 44, rotation: 0,
      props: { label: `Stop ${n}`, color: theme.palette[1] ?? accent },
    }))
  }

  const onTool = (t: ToolId) => {
    setSelectedId(null)
    switch (t) {
      case 'photo': fileInput.current?.click(); break
      case 'sticker': setSheet('sticker'); break
      case 'text': addText(); break
      case 'draw': setStrokes([]); setPen((p) => ({ ...p })); setSheet('draw'); break
      case 'note': addNote(); break
      case 'divider': addDivider(); break
      case 'location': toast('Locations arrive in the next step'); break
    }
  }

  /* ---------- selection actions ---------- */

  const reorder = (dir: 1 | -1) => {
    if (!selected) return
    commit((list) => {
      const order = [...list].sort((a, b) => a.zIndex - b.zIndex)
      const i = order.findIndex((x) => x.id === selected.id)
      const j = i + dir
      if (j < 0 || j >= order.length) return list
      ;[order[i], order[j]] = [order[j], order[i]]
      const z = new Map(order.map((x, k) => [x.id, k + 1]))
      return normalizeZ(list.map((x) => ({ ...x, zIndex: z.get(x.id)! })))
    })
  }

  const actions = selected && {
    onHandle: (e: React.PointerEvent, kind: 'resize' | 'rotate') => startHandle(e, selected.id, kind),
    onDuplicate: () => {
      let id = ''
      commit((list) => { const c = cloneItem(selected, nextZ(list)); id = c.id; return [...list, c] })
      setSelectedId(id)
    },
    onDelete: () => { commit((l) => l.filter((x) => x.id !== selected.id)); setSelectedId(null) },
    onForward: () => reorder(1),
    onBackward: () => reorder(-1),
    onFrame: selected.type === 'photo' ? () => openFrame() : undefined,
    onEdit:
      selected.type === 'text' ? openText
      : selected.type === 'note' || selected.type === 'divider' ? () => { begin(); setEditingId(selected.id) }
      : undefined,
  }

  /* ---------- canvas growth, scroll-to-reveal ---------- */

  useEffect(() => {
    const bottom = items.reduce((m, i) => Math.max(m, i.y + i.height / 2), 0)
    if (bottom > height - 500) setHeight(Math.ceil((bottom + 1400) / 100) * 100)
  }, [items, height, setHeight])

  useEffect(() => {
    if (!sheetH || !selected || sheet === 'draw' || !scroller.current || !surface.current) return
    const r = surface.current.getBoundingClientRect()
    const top = r.top + selected.y - selected.height / 2
    const bottom = r.top + selected.y + selected.height / 2
    const topLimit = HEADER_H + 24
    const bottomLimit = window.innerHeight - sheetH - 20
    if (bottom > bottomLimit || top < topLimit) {
      const delta = (top + bottom) / 2 - (topLimit + bottomLimit) / 2
      scroller.current.scrollBy({ top: delta, behavior: 'smooth' })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetH, selectedId, sheet])

  useEffect(() => {
    if (selectedId && !items.some((i) => i.id === selectedId)) setSelectedId(null)
  }, [items, selectedId])

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    scrollY.set(el.scrollTop)
    if (el.scrollTop + el.clientHeight > heightRef.current - 700) setHeight(heightRef.current + 1200)
  }

  const run = (fn: () => void) => () => { setMenu(false); fn() }

  /* ---------- edit text of notes / dividers / sticker captions ---------- */
  const onEditText = useCallback((id: string, text: string) => {
    live((list) => list.map((i) => {
      if (i.id !== id) return i
      if (i.type === 'note') return { ...i, props: { ...i.props, text } }
      if (i.type === 'divider') return { ...i, props: { ...i.props, label: text } }
      return i
    }))
  }, [live])
  const onEditDone = useCallback(() => { setEditingId(null); end() }, [end])
  const onMeasure = useCallback((id: string, h: number) => live((l) => l.map((i) => (i.id === id ? { ...i, height: h } : i))), [live])

  const textItem = selected?.type === 'text' ? selected : undefined
  const photoItem = selected?.type === 'photo' ? selected : undefined

  return (
    <motion.div
      className="fixed inset-0 z-40"
      style={{ ...themeVars(theme), background: theme.canvasBg }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
    >
      <div
        ref={scroller}
        className="absolute inset-0 overflow-x-hidden"
        style={{ overflowY: drawing ? 'hidden' : 'auto', touchAction: 'pan-y', overscrollBehavior: 'contain' }}
        onScroll={onScroll}
      >
        <div className="relative mx-auto max-w-[520px]">
          <header
            className="sticky top-0 z-30 px-4"
            style={{
              height: HEADER_H, paddingTop: 'calc(var(--safe-top) + 12px)', boxSizing: 'content-box',
              background: `linear-gradient(${theme.canvasBg} 78%, ${theme.canvasBg}00)`,
            }}
          >
            <div className="relative flex items-center justify-between">
              <IconButton label="Back" onClick={onBack}><ArrowLeft size={21} /></IconButton>
              <motion.h1
                className="pointer-events-none absolute inset-x-14 m-0 truncate text-center text-[26px] font-extrabold leading-tight tracking-tight"
                style={{ scale: titleScale, y: titleY }}
              >
                {memory.title}
              </motion.h1>
              <div className="relative">
                <IconButton label="More options" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((v) => !v)}>
                  <MoreHorizontal size={21} />
                </IconButton>
                <AnimatePresence>
                  {menu && (
                    <>
                      <div className="fixed inset-0 z-40" onPointerDown={() => setMenu(false)} />
                      <motion.div
                        role="menu"
                        className="absolute right-0 top-[52px] z-50 w-52 origin-top-right rounded-2xl bg-white p-1.5 shadow-[0_14px_40px_rgba(20,24,40,.22)]"
                        initial={{ opacity: 0, scale: 0.85, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 460, damping: 30 }}
                      >
                        <MenuItem icon={<PenLine size={18} />} label="Edit book" onClick={run(onEdit)} />
                        <MenuItem icon={<Palette size={18} />} label="Change theme" onClick={run(onTheme)} />
                        <MenuItem icon={<Share2 size={18} />} label="Share" onClick={run(onShare)} />
                        <MenuItem danger icon={<Trash2 size={18} />} label="Delete" onClick={run(onDelete)} />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center">
              <div className="flex gap-1">
                <button type="button" aria-label="Undo" disabled={!cv.canUndo} onClick={cv.undo}
                  className="grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent text-[#17171a] active:scale-95 disabled:opacity-25">
                  <Undo2 size={20} />
                </button>
                <button type="button" aria-label="Redo" disabled={!cv.canRedo} onClick={cv.redo}
                  className="grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent text-[#17171a] active:scale-95 disabled:opacity-25">
                  <Redo2 size={20} />
                </button>
              </div>
              <motion.p className="m-0 text-center text-[14px] font-semibold text-neutral-400" style={{ opacity: subOpacity }}>
                {photoCount} {photoCount === 1 ? 'Photo' : 'Photos'} <span className="mx-1">•</span> {formatDate(memory.date)}
              </motion.p>
              <div className="flex items-center justify-end gap-1 pr-1 text-[12px] font-bold text-neutral-400" role="status" aria-live="polite">
                {cv.status === 'saving' ? <><Loader2 size={13} className="animate-spin" /> Saving</> : <><Check size={13} strokeWidth={3} /> Saved</>}
              </div>
            </div>
          </header>

          {/* the infinite canvas surface */}
          <div
            ref={surface}
            className="relative isolate"
            style={{
              height,
              backgroundImage: `radial-gradient(${theme.dot} 1.5px, transparent 1.7px)`,
              backgroundSize: '22px 22px',
              touchAction: 'pan-y',
            }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('[data-item],[data-ui]')) return
              setSelectedId(null)
            }}
          >
            <FloatingShapes theme={theme} />
            <AnimatePresence initial={false}>
              {items.map((it) => (
                <CanvasItemView
                  key={it.id} item={it}
                  dragging={draggingId === it.id}
                  editing={editingId === it.id}
                  onPointerDown={startItem}
                  onMeasure={onMeasure}
                  onEditText={onEditText}
                  onEditDone={onEditDone}
                />
              ))}
            </AnimatePresence>

            {selected && actions && !drawing && editingId !== selected.id && draggingId !== selected.id && (
              <SelectionOverlay item={selected} canvasW={canvasW} topLimit={(scroller.current?.scrollTop ?? 0) + 8} accent={accent} actions={actions} hideToolbar={!!sheet} />
            )}
            {selected && actions && draggingId === selected.id && (
              <SelectionOverlay item={selected} canvasW={canvasW} topLimit={-9999} accent={accent} actions={{ ...actions, onFrame: undefined, onEdit: undefined }} hideToolbar />
            )}

            {drawing && <DrawStrokes strokes={strokes} />}

            {cv.loaded && items.length === 0 && !drawing && (
              <div className="pointer-events-none absolute inset-x-0 top-[180px] px-10 text-center">
                <div className="text-[44px]">{theme.emoji}</div>
                <p className="m-0 mt-2 text-[15px] font-semibold text-neutral-500">A blank page. Add photos, stickers, notes and doodles with the toolbar below.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {drawing && (
        <DrawLayer
          surfaceRef={surface} strokes={strokes} color={pen.color} size={pen.size} onChange={setStrokes}
          bottomInset={sheetH}
        />
      )}

      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = '' }} />

      <BottomToolbar visible={!sheet && !editingId} accent={accent} onTool={onTool} />

      {/* ---- tool sheets ---- */}
      <ToolSheet
        open={sheet === 'frame' && !!photoItem} onClose={closeSheet} title="Frame" snaps={[0.5, 0.88]} dim={0.18} z={55}
        onVisibleHeight={(h) => setSheetHs((s) => ({ ...s, frame: h }))}
      >
        {photoItem && (
          <FramePicker
            photo={photoItem.props} width={photoItem.width} accent={accent} focusCaption={captionFocus}
            onFrame={(frame) => patch(photoItem.id, { height: frameHeight(frame, photoItem.width, photoItem.props.aspect), props: { frame } })}
            onRadius={(radius) => patch(photoItem.id, { props: { radius } })}
            onCaption={(caption) => patch(photoItem.id, { props: { caption } })}
          />
        )}
      </ToolSheet>

      <ToolSheet
        open={sheet === 'sticker'} onClose={closeSheet} title="Stickers" snaps={[0.5, 0.88]} dim={0.18} z={55}
        onVisibleHeight={(h) => setSheetHs((s) => ({ ...s, sticker: h }))}
      >
        <StickerTray accent={accent} onPick={addSticker} />
      </ToolSheet>

      <ToolSheet
        open={sheet === 'text' && !!textItem} onClose={closeSheet} title="Text" snaps={[0.56, 0.88]} dim={0.18} z={55}
        onVisibleHeight={(h) => setSheetHs((s) => ({ ...s, text: h }))}
      >
        {textItem && (
          <TextEditor
            value={textItem.props as TextProps} colors={theme.palette} accent={accent}
            onChange={(p) => patch(textItem.id, { props: p })}
          />
        )}
      </ToolSheet>

      <ToolSheet
        open={drawing} onClose={closeSheet} title="Draw" snaps={[0.3]} dim={0} passThrough z={55}
        onVisibleHeight={(h) => setSheetHs((s) => ({ ...s, draw: h }))}
      >
        <DrawTool
          colors={theme.palette} color={pen.color} size={pen.size} strokeCount={strokes.length} accent={accent}
          onColor={(color) => setPen((p) => ({ ...p, color }))}
          onSize={(size) => setPen((p) => ({ ...p, size }))}
          onUndo={() => setStrokes((s) => s.slice(0, -1))}
          onClear={() => setStrokes([])}
          onDone={closeSheet}
        />
      </ToolSheet>
    </motion.div>
  )
}
