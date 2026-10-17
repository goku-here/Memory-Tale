import { AnimatePresence, motion, useMotionValue, useTransform, type MotionValue } from 'framer-motion'
import { ArrowLeft, Check, ChevronDown, Eye, Image as ImageIcon, Loader2, Maximize2, MoreHorizontal, Redo2, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../data/useAuth'
import { canEdit } from '../data/people'
import { usePresence } from '../data/presence'
import { useCanvas } from '../data/useCanvas'
import { uid } from '../lib/id'
import { compressImage } from '../lib/image'
import { uploadOriginal } from '../lib/supabase'
import { lockOldOriginals } from '../data/originals'
import { newFileKey } from '../lib/crypto'
import { connectDrive, driveConfigured, isConnected } from '../lib/drive'
import { discardOriginal, loadOriginalBlob, markForDiscard, missingCopies, prefs, purgeFlagged, queueOriginal, replicateBook, runPendingDiscards, unmarkDiscard } from '../data/originals'
import { reportError } from '../data/sync'
import { downloadBookZip } from '../lib/zipBook'
import { AssetCtx } from '../lib/assets'
import { clipAt } from '../lib/bookTransition'
import { clamp, cloneItem, frameHeight, isBg, nextZ, rnd, withBackground } from '../lib/items'
import { placeInOrder } from '../lib/layout'
import { useGestures } from '../lib/useGestures'
import { tour, tourSeen } from '../lib/tour'
import type { Guides } from '../lib/snap'
import { frameHeightFor, getSize, ratioLabel, type StorySize } from '../lib/storySizes'
import type { CanvasStyle, PhotoProps, BubbleProps, CanvasItem, FrameId, ItemPatch, MapProps, Stroke, StickerProps, TextProps } from '../types'
import { formatDate } from './BookCard'
import { BottomToolbar, type ToolId } from './BottomToolbar'
import { CanvasItemView, SelectionOverlay } from './CanvasItem'
import { strokesToItem } from './DrawLayer'
import { DrawStudio } from './DrawStudio'
import { FramePicker } from './FramePicker'
import { NOTE_COLORS } from './StickyNote'
import { StickerTray } from './StickerTray'
import { CollageEditor } from './CollageEditor'
import { TemplateSheet } from './TemplateSheet'
import { PrivacySheet } from './Privacy'
import { COLLAGES, type CollageKind } from '../lib/collages'
import type { TemplateDef } from '../lib/templates'
import { SVG_STICKERS } from './stickers'
import { stickerRatio } from './stickers'
import { TextStudio } from './TextStudio'
import { FloatingShapes, getTheme, themeVars } from './ThemeEngine'
import { ToolSheet } from './ToolSheet'
import { BUBBLE_SHAPES, BubbleEditor } from './Bubble'
import { CameraCapture } from './CameraCapture'
import { Lightbox, type ViewerImage } from './Lightbox'
import { ToolSheet as Sheet } from './ToolSheet'
import { LocationTool } from './LocationTool'
import { PeopleSheet } from './PeopleSheet'
import { mapAspect } from '../lib/geo'
import { CanvasStyleSheet } from './CanvasStyleSheet'
import { IcClapper, IcDownload, IcEdit, IcLock, IcPages, IcPalette, IcPeople, IcShare, IcTrash } from './ToolIcons'
import { resolveCanvas } from '../lib/canvasStyle'
import { SizeSheet, StoryOverlay, StoryPreview } from './StoryMode'
import { useDesktop } from '../lib/useDesktop'
import { BAR_H, DeskBar, DeskFoot, DeskRail, FOOT_H, RAIL_W, type FileItem } from './DeskLayout'
import { PrintExportSheet, PrintOverlay, PrintSizeSheet, pagesNeeded } from './PrintMode'
import { getPrintSize, pageDims, type PrintSize } from '../lib/printSizes'
import { CustomColor } from './ColorPicker'
import { THREAD_COLORS, ThreadsSvg, threadMid } from './Threads'
import { IconButton, toast } from './ui'
import type { Memory } from '../types'

interface CanvasProps {
  memory: Memory
  onBack: () => void
  onEdit: () => void
  onTheme: () => void
  onShare: () => void
  onDelete: () => void
  onCanvasStyle: (cs: CanvasStyle) => void
  /** while the book opens/closes the canvas shows through a window shaped like the book */
  reveal?: { p: MotionValue<number>; rect: DOMRect }
  /** a book just made as private: open its Privacy sheet once it is on screen */
  askPrivacy?: boolean
  onAskedPrivacy?: () => void
}

type Sheet = 'templates' | 'collage' | 'frame' | 'sticker' | 'text' | 'draw' | 'location' | 'bubble' | null

function MenuItem({ icon, label, onClick, danger }: { icon: ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <motion.button
      type="button" role="menuitem" whileTap={{ scale: 0.97 }} onClick={onClick}
      className={`flex min-h-11 w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left text-[15px] font-semibold ${danger ? 'text-[#d6455d]' : 'text-[#17171a]'}`}
    >
      <span className="grid h-6 w-6 shrink-0 place-items-center [&_svg]:h-[22px] [&_svg]:w-[22px]">{icon}</span>
      {label}
    </motion.button>
  )
}

const HEADER_H = 116
/** 40% shows two and a half screens at once; 1 = fit to width; above 1 you zoom in to edit (and can scroll sideways). */
const ZMIN = 0.4
const ZMAX = 3
/** phones open photos with a tap; the expand button is only for mouse users */
const hasMouse = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(pointer: coarse)').matches

export function Canvas({ memory, onBack, onEdit, onTheme, onShare, onDelete, onCanvasStyle, reveal, askPrivacy, onAskedPrivacy }: CanvasProps) {
  const theme = getTheme(memory.themeId)
  const [cstyle, setCstyle] = useState<CanvasStyle | undefined>(memory.canvasStyle)
  const [styleOpen, setStyleOpen] = useState(false)
  const styleKey = JSON.stringify(memory.canvasStyle ?? null)
  // another device (or the theme being changed) updated the look
  useEffect(() => { setCstyle(memory.canvasStyle) }, [styleKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const rc = useMemo(() => resolveCanvas(theme, cstyle), [theme, cstyle])
  const styleSave = useRef(0)
  const changeStyle = (v: CanvasStyle) => {
    setCstyle(v)
    window.clearTimeout(styleSave.current)
    styleSave.current = window.setTimeout(() => onCanvasStyle(v), 500)
  }
  const accent = theme.palette[0]
  const scroller = useRef<HTMLDivElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  /** holds the (scaled) surface; scrolls sideways only when zoomed in */
  const wrap = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const scrollY = useMotionValue(0)
  const { user } = useAuth()
  /** view-only members can look around but not change anything */
  const readOnly = !!user && !canEdit(memory, user.uid)
  const cv = useCanvas(memory.id, user?.uid, readOnly, !!reveal)
  const here = usePresence(memory.id, theme.palette[0])
  const { items, itemsRef, height, commit, live, begin, end, setHeight } = cv
  const heightRef = useRef(height)
  heightRef.current = height

  // originals that were stored readable (an older version, or before this book was made private) get locked once, here
  const relocked = useRef('')
  useEffect(() => {
    if (!user || !cv.loaded || readOnly || relocked.current === memory.id) return
    relocked.current = memory.id
    const t = window.setTimeout(() => {
      void lockOldOriginals(memory.id, user.uid, itemsRef.current, undefined, !!memory.e2ee).then((fixes) => {
        if (!fixes.length) return
        live((list) => list.map((it) => { const f = fixes.find((x) => x.id === it.id); return f && it.type === 'photo' ? { ...it, props: { ...it.props, ...f.props } } : it }))
      }).catch(() => {})
    }, 4000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, cv.loaded, readOnly, memory.id])

  const [menu, setMenu] = useState(false)
  const desk = useDesktop()
  const deskRef = useRef(desk)
  deskRef.current = desk
  /** on a laptop the whole page (its frame) grows and shrinks with the zoom, not just what is drawn inside it */
  const col = useRef<HTMLDivElement>(null)
  const [story, setStory] = useState(false)
  /** print mode: the book laid out as pages (one image per page), for a scrapbook or a frame */
  const [printMode, setPrintMode] = useState(false)
  const [printY, setPrintYState] = useState(0)
  const printYRef = useRef(0)
  const setPrintY = useCallback((y: number) => { printYRef.current = y; setPrintYState(y) }, [])
  const [printSizeOpen, setPrintSizeOpen] = useState(false)
  const [printExportOpen, setPrintExportOpen] = useState(false)
  const [printPick, setPrintPick] = useState<{ id: string; landscape: boolean }>(() => {
    try { const v = localStorage.getItem(`mt-print-size:${memory.id}`); if (v) { const [id, o] = v.split(':'); return { id, landscape: o === 'l' } } } catch { /* ignore */ }
    return { id: 'a4', landscape: false }
  })
  const printSize: PrintSize = getPrintSize(printPick.id)
  const [zoom, setZoomState] = useState(1)
  const zoomRef = useRef(1)
  const zoomAnchor = useRef<{ y: number; screenY: number; x?: number; screenX?: number } | null>(null)
  const preStoryZoom = useRef(1)
  const [sizeId, setSizeId] = useState<string | null>(() => { try { return localStorage.getItem(`mt-story-size:${memory.id}`) } catch { return null } })
  const size: StorySize = getSize(sizeId)
  const [sizeOpen, setSizeOpen] = useState(false)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)
  useEffect(() => {
    if (!askPrivacy || reveal) return
    const t = window.setTimeout(() => { setPrivacyOpen(true); onAskedPrivacy?.() }, 500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askPrivacy, !!reveal])
  const [guides, setGuides] = useState<Guides | null>(null)
  const [storyPreview, setStoryPreview] = useState(false)
  const [storyY, setStoryYState] = useState(0)
  const storyYRef = useRef(0)
  const setStoryY = useCallback((y: number) => { storyYRef.current = y; setStoryYState(y) }, [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  /** the writing page: a new text block (no id) or an existing one being changed */
  const [textStudio, setTextStudio] = useState<{ id?: string; seed: TextProps; boxW: number } | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [sheetHs, setSheetHs] = useState<Record<string, number>>({})
  const [canvasW, setCanvasW] = useState(() => Math.min(window.innerWidth, 520))
  const canvasWRef = useRef(canvasW)
  canvasWRef.current = canvasW
  const [captionFocus, setCaptionFocus] = useState(false)
  const [editMapId, setEditMapId] = useState<string | null>(null)
  const [viewer, setViewer] = useState<{ images: ViewerImage[]; start: number } | null>(null)
  const lastPointer = useRef<string>('mouse')
  const suppressClick = useRef(false)
  const viewTimer = useRef(0)
  const [cameraOpen, setCameraOpen] = useState(false)
  const cameraInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<{ done: number; total: number; label?: string } | null>(null)
  const [drivePrompt, setDrivePrompt] = useState<{ count: number; bytes: number } | null>(null)
  const [connectFrom, setConnectFrom] = useState<string | null>(null)
  /** grouping: the item that was chosen first, waiting for the one to join it */
  const [groupFrom, setGroupFrom] = useState<string | null>(null)
  const slotInput = useRef<HTMLInputElement>(null)
  const slotTarget = useRef<{ id: string; index: number } | null>(null)
  const sheetH = Math.max(0, ...Object.values(sheetHs))

  selectedIdRef.current = selectedId
  const [scrollRoot, setScrollRoot] = useState<Element | null>(null)
  useEffect(() => { setScrollRoot(scroller.current) }, [])
  const assetCtx = useMemo(() => ({ memoryId: memory.id, root: scrollRoot }), [memory.id, scrollRoot])
  // backgrounds are sized to this device's canvas width when drawn (see withBackground)
  const vItems = useMemo(() => withBackground(items, canvasW), [items, canvasW])
  const selected = useMemo(() => (readOnly ? undefined : vItems.find((i) => i.id === selectedId && i.type !== 'thread')), [vItems, selectedId, readOnly])
  const [threadTap, setThreadTap] = useState<{ id: string; x: number; y: number } | null>(null)
  const selectedThread = useMemo(() => (readOnly ? undefined : items.find((i): i is Extract<CanvasItem, { type: 'thread' }> => i.id === selectedId && i.type === 'thread')), [items, selectedId, readOnly])
  const visibleItems = useMemo(() => vItems.filter((i) => i.type !== 'thread'), [vItems])
  /** the stretch of the page (canvas px) that is on screen or close to it: everything else is not drawn */
  const [range, setRange] = useState({ top: -1e9, bottom: 1e9 })
  const rangeRef = useRef(range)
  const updateRange = useCallback(() => {
    const sc = scroller.current
    if (!sc) return
    const z = zoomRef.current
    const vh = sc.clientHeight / z
    const top = (sc.scrollTop - (wrap.current?.offsetTop ?? 0)) / z
    const next = { top: top - vh * 1.3, bottom: top + vh * 2.3 }
    const cur = rangeRef.current
    // only redraw when the window has moved a good part of a screen
    if (Math.abs(next.top - cur.top) < vh * 0.45 && Math.abs(next.bottom - cur.bottom) < vh * 0.45) return
    rangeRef.current = next
    setRange(next)
  }, [])
  const photoCount = useMemo(() => items.filter((i) => i.type === 'photo').length, [items])
  const drawing = sheet === 'draw'
  const [editDrawId, setEditDrawId] = useState<string | null>(null)
  const drawingRef = useRef(false)
  drawingRef.current = drawing
  const draggingRef = useRef<string | null>(null)
  draggingRef.current = draggingId

  /** change the zoom, keeping the picked canvas point (`y`) under `screenY` */
  const applyZoom = useCallback((z: number, focal?: { y: number; screenY: number; x?: number; screenX?: number }) => {
    const nz = Math.round(clamp(z, ZMIN, ZMAX) * 1000) / 1000
    const sf = surface.current
    if (sf) {
      const r = sf.getBoundingClientRect()
      const mid = (HEADER_H + window.innerHeight - 110) / 2
      const scr = scroller.current?.getBoundingClientRect()
      const midX = scr ? scr.left + scr.width / 2 : window.innerWidth / 2
      // anything not given is the middle of what is on screen
      focal = {
        y: focal?.y ?? (mid - r.top) / zoomRef.current, screenY: focal?.screenY ?? mid,
        x: focal?.x ?? (midX - r.left) / zoomRef.current, screenX: focal?.screenX ?? midX,
      }
    }
    zoomAnchor.current = focal ?? null
    if (nz === zoomRef.current) {
      // same zoom: still honour the anchor (scroll to it)
      if (focal && sf && scroller.current && wrap.current) {
        scroller.current.scrollTop = wrap.current.offsetTop + focal.y * nz - focal.screenY
        if (deskRef.current) scroller.current.scrollLeft += sf.getBoundingClientRect().left + focal.x! * nz - focal.screenX!
        else wrap.current.scrollLeft = focal.x! * nz - (focal.screenX! - wrap.current.getBoundingClientRect().left)
      }
      zoomAnchor.current = null
      return
    }
    zoomRef.current = nz
    setZoomState(nz)
  }, [])
  /**
   * Zoom while a finger or wheel is moving: change the DOM directly (no React render per frame, which is what
   * made pinching feel sticky on phones) and let React catch up shortly after.
   */
  const commitTimer = useRef(0)
  const liveZoom = useCallback((z: number, f: { y: number; screenY: number; x: number; screenX: number }) => {
    const nz = Math.round(clamp(z, ZMIN, ZMAX) * 1000) / 1000
    const sf = surface.current, w = wrap.current, sc = scroller.current, box = inner.current
    if (!sf || !w || !sc || !box) return
    const cw = canvasWRef.current, h = heightRef.current
    zoomRef.current = nz
    const dk = deskRef.current
    box.style.width = `${cw * (dk ? nz : Math.max(1, nz))}px`
    box.style.height = `${h * nz}px`
    w.style.height = `${h * nz}px`
    if (dk && col.current) col.current.style.width = `${cw * nz}px`
    sf.style.left = `${!dk && nz < 1 ? (cw * (1 - nz)) / 2 : 0}px`
    sf.style.transform = nz !== 1 ? `scale(${nz})` : ''
    sc.scrollTop = w.offsetTop + f.y * nz - f.screenY
    if (dk) sc.scrollLeft += sf.getBoundingClientRect().left + f.x * nz - f.screenX
    else w.scrollLeft = Math.max(0, f.x * nz - (f.screenX - w.getBoundingClientRect().left))
    window.clearTimeout(commitTimer.current)
    commitTimer.current = window.setTimeout(() => setZoomState(zoomRef.current), 120)
  }, [])

  // once the page has the new size, scroll so the anchor stays where the fingers are
  useLayoutEffect(() => {
    const a = zoomAnchor.current
    const sc = scroller.current
    const w = wrap.current
    zoomAnchor.current = null
    if (a && sc && w) {
      sc.scrollTop = w.offsetTop + a.y * zoom - a.screenY
      if (a.x !== undefined && a.screenX !== undefined) {
        if (deskRef.current && surface.current) sc.scrollLeft += surface.current.getBoundingClientRect().left + a.x * zoom - a.screenX
        else w.scrollLeft = Math.max(0, a.x * zoom - (a.screenX - w.getBoundingClientRect().left))
      }
    }
  }, [zoom])

  // pinch with two fingers on the empty canvas, or Ctrl + wheel / trackpad pinch
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let g: { d: number; z: number; y: number; x: number } | null = null
    let locked: { y: string; x: string } | null = null
    const unlock = () => {
      if (!locked) return
      el.style.overflowY = locked.y
      if (wrap.current) wrap.current.style.overflowX = locked.x
      locked = null
      window.clearTimeout(commitTimer.current)
      setZoomState(zoomRef.current)
    }
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const mid = (t: TouchList) => (t[0].clientY + t[1].clientY) / 2
    const midX = (t: TouchList) => (t[0].clientX + t[1].clientX) / 2
    const start = (e: TouchEvent) => {
      g = null
      if (e.touches.length !== 2 || drawingRef.current || draggingRef.current) return
      if ([...e.touches].some((t) => (t.target as HTMLElement).closest?.('[data-ui]'))) return
      const sf = surface.current
      if (!sf) return
      // the browser must not also scroll while two fingers zoom: lock both scrollers until they lift
      locked = { y: el.style.overflowY, x: wrap.current?.style.overflowX ?? '' }
      el.style.overflowY = 'hidden'
      if (wrap.current) wrap.current.style.overflowX = 'hidden'
      const r = sf.getBoundingClientRect()
      g = { d: Math.max(1, dist(e.touches)), z: zoomRef.current, y: (mid(e.touches) - r.top) / zoomRef.current, x: (midX(e.touches) - r.left) / zoomRef.current }
    }
    const move = (e: TouchEvent) => {
      if (!g || e.touches.length !== 2) return
      if (e.cancelable) e.preventDefault()
      liveZoom(g.z * (dist(e.touches) / g.d), { y: g.y, screenY: mid(e.touches), x: g.x, screenX: midX(e.touches) })
    }
    const end = (e: TouchEvent) => { if (e.touches.length < 2) { g = null; unlock() } }
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey || drawingRef.current) return
      e.preventDefault()
      const sf = surface.current
      if (!sf) return
      const r = sf.getBoundingClientRect()
      liveZoom(zoomRef.current * Math.exp(-e.deltaY * 0.01), { y: (e.clientY - r.top) / zoomRef.current, screenY: e.clientY, x: (e.clientX - r.left) / zoomRef.current, screenX: e.clientX })
    }
    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end)
    el.addEventListener('touchcancel', end)
    el.addEventListener('wheel', wheel, { passive: false })
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
      el.removeEventListener('wheel', wheel)
      unlock()
    }
  }, [liveZoom])

  const idle = useMotionValue(1)
  const clip = useTransform(reveal?.p ?? idle, (v) => (reveal ? clipAt(reveal.rect, v) : 'none'))
  const titleScale = useTransform(scrollY, [0, 120], [1, 0.82])
  const titleY = useTransform(scrollY, [0, 120], [0, -4])
  const subOpacity = useTransform(scrollY, [0, 80], [1, 0])

  useEffect(() => { scroller.current?.scrollTo(0, 0) }, [])
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(() => { const w = deskRef.current ? 520 : el.clientWidth; setCanvasW(w); cv.setWidth(w) })
    ro.observe(el)
    return () => ro.disconnect()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------- item helpers ---------- */

  const patch = useCallback((id: string, p: ItemPatch, record = false) => {
    const fn = (list: CanvasItem[]) =>
      list.map((i) => (i.id === id ? ({ ...i, ...p, props: p.props ? { ...i.props, ...p.props } : i.props } as CanvasItem) : i))
    record ? commit(fn) : live(fn)
  }, [commit, live])

  /** centre of the part of the canvas that is currently visible (above any open sheet) */
  const viewCenter = useCallback((ignoreSheet = false) => {
    const r = surface.current!.getBoundingClientRect()
    const top = HEADER_H + 20
    const bottom = window.innerHeight - (ignoreSheet ? 110 : Math.max(sheetH, 110))
    // the middle of the page area (on a laptop a docked panel takes the left side of the window)
    const sr = scroller.current?.getBoundingClientRect()
    const midX = sr ? sr.left + sr.width / 2 : window.innerWidth / 2
    const x = ((midX - r.left) / zoomRef.current / Math.max(1, canvasWRef.current)) * 100
    return { x: clamp(x, 8, 92), y: Math.max(160, ((top + bottom) / 2 - r.top) / zoomRef.current) }
  }, [sheetH])

  const addItem = useCallback((make: (z: number, c: { x: number; y: number }) => CanvasItem, opts: { record?: boolean; ignoreSheet?: boolean } = {}) => {
    const c = viewCenter(opts.ignoreSheet)
    const id = uid()
    const fn = (list: CanvasItem[]) => [...list, { ...make(nextZ(list), c), id }]
    opts.record === false ? live(fn) : commit(fn)
    setSelectedId(id)
    return id
  }, [commit, live, viewCenter])

  /* ---------- gestures ---------- */

  const { startItem: rawStart, startHandle } = useGestures({
    surfaceRef: surface, scrollerRef: scroller, itemsRef, heightRef, zoomRef, live, begin, end,
    onSelect: setSelectedId, onDragging: setDraggingId, onGuides: setGuides,
    onHold: () => { suppressClick.current = true },
    isSelected: (id) => selectedIdRef.current === id,
    topInset: HEADER_H + 40, bottomInset: 130,
    onDoubleTap: (id) => {
      const it = itemsRef.current.find((i) => i.id === id)
      if (!it) return
      if (it.type === 'photo') openFrame(true)
      else if (it.type === 'text') openText()
      else if (it.type === 'note' || it.type === 'divider') { begin(); setEditingId(id) }
      else if (it.type === 'bubble') openBubble()
      else if (it.type === 'collage' && COLLAGES[it.props.kind]?.slots.length) { begin(); setSheet('collage') }
      window.clearTimeout(viewTimer.current)
    },
  })

  const startItem = (e: React.PointerEvent, id: string) => {
    if (groupFrom) {
      e.preventDefault()
      e.stopPropagation()
      suppressClick.current = true // the tap that picks the second item must not also open it
      const from = groupFrom
      setGroupFrom(null)
      const other = itemsRef.current.find((i) => i.id === id)
      if (id === from || !other || isBg(other) || other.type === 'thread') return
      makeGroup([from, id])
      toast('Grouped. They move together now; tap Ungroup to separate them.')
      return
    }
    if (connectFrom) {
      e.preventDefault()
      e.stopPropagation()
      suppressClick.current = true // the tap that picks the second item must not also open the photo
      const from = connectFrom
      setConnectFrom(null)
      if (id === from) return
      if (itemsRef.current.some((t) => t.type === 'thread' && ((t.props.a === from && t.props.b === id) || (t.props.a === id && t.props.b === from)))) {
        toast('Already tied together')
        return
      }
      commit((list) => [...list, { id: uid(), type: 'thread', x: 0, y: 0, width: 0, height: 0, rotation: 0, zIndex: 0, props: { a: from, b: id, color: THREAD_COLORS[0] } }])
      toast('Tied with a thread')
      tour.emit('thread-made')
      return
    }
    rawStart(e, id)
  }
  /** open a photo full-screen (photo items, or a filled slot of the polaroid line) */
  function openViewer(key: string) {
    // every photo on the canvas, in reading order (top to bottom, left to right)
    const images: (ViewerImage & { y: number; x: number })[] = []
    for (const it of itemsRef.current) {
      if (it.type === 'photo') {
        images.push({ key: it.id, src: it.props.src, thumb: it.props.thumb, photo: it.props, caption: it.props.frame === 'polaroid' ? it.props.caption : undefined, y: it.y, x: it.x })
      } else if (it.type === 'clothesline') {
        it.props.photos.forEach((src, n) => { if (src) images.push({ key: `${it.id}#${n}`, src, y: it.y, x: it.x - 30 + n * 30 }) })
      } else if (it.type === 'collage') {
        it.props.photos.forEach((src, n) => { if (src) images.push({ key: `${it.id}#${n}`, src, y: it.y + n, x: it.x }) })
      }
    }
    images.sort((a, b) => Math.round(a.y / 120) - Math.round(b.y / 120) || a.x - b.x)
    const start = Math.max(0, images.findIndex((m) => m.key === key))
    if (images.length) setViewer({ images, start })
  }
  function viewItem(id: string) {
    const it = itemsRef.current.find((i) => i.id === id)
    if (it?.type === 'photo') openViewer(id)
  }
  /** phones: a tap opens a photo (the click event, so nothing can race with it) */
  const onItemClick = useCallback((id: string) => {
    if (lastPointer.current !== 'touch' || suppressClick.current) return
    const it = itemsRef.current.find((i) => i.id === id)
    if (it?.type !== 'photo') return
    window.clearTimeout(viewTimer.current)
    // on an already-selected photo wait briefly: a double-tap means "edit frame" instead
    viewTimer.current = window.setTimeout(() => openViewer(id), selectedIdRef.current === id ? 320 : 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const startItemRef = useRef(startItem)
  startItemRef.current = startItem
  // stable identities keep the memoised items from re-rendering on every drag frame
  const noopPointer = useCallback(() => {}, [])
  const startItemStable = useCallback((e: React.PointerEvent, id: string) => startItemRef.current(e, id), [])
  const onViewSlot = useCallback((id: string, index: number) => {
    openViewer(`${id}#${index}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onSlot = useCallback((id: string, index: number) => { slotTarget.current = { id, index }; slotInput.current?.click() }, [])

  /* ---------- sheets ---------- */

  const closeSheet = useCallback(() => {
    if (sheet === 'text') {
      const it = itemsRef.current.find((i) => i.id === selectedId)
      if (it?.type === 'text' && !it.props.text.trim()) live((l) => l.filter((x) => x.id !== it.id))
      end()
      if (it?.type === 'text' && !it.props.text.trim()) setSelectedId(null)
    } else if (sheet === 'frame' || sheet === 'bubble' || sheet === 'collage') end()
    if (sheet === 'frame') tour.emit('frame-close')
    setSheet(null)
    setCaptionFocus(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet, selectedId, end, live])

  const openFrame = (focusCaption = false) => {
    begin()
    setCaptionFocus(focusCaption)
    setSheet('frame')
  }
  const openText = () => {
    const it = itemsRef.current.find((i) => i.id === selectedId)
    if (it?.type === 'text') setTextStudio({ id: it.id, seed: it.props, boxW: Math.round(clamp(canvasW - 40, 160, 520)) })
  }
  /** the writing page is done: the whole block lands on the canvas (or replaces the one that was being changed) */
  const finishText = (props: TextProps, width: number) => {
    const id = textStudio?.id
    setTextStudio(null)
    if (!props.text.trim()) return
    if (id) {
      patch(id, { props: { ...props, runs: props.runs }, width }, true); setSelectedId(id)
    } else {
      addItem((z, c) => ({ id: '', type: 'text', zIndex: z, x: c.x, y: c.y, width, height: Math.round(props.size * 1.2), rotation: 0, props }), { ignoreSheet: true })
    }
  }
  const openBubble = () => { begin(); setSheet('bubble') }

  /** the drawing from the drawing page becomes one item, placed in the middle of what is on screen */
  function addDrawing(strokes: Stroke[], pageW: number) {
    const editId = editDrawId
    setSheet(null)
    setEditDrawId(null)
    if (editId) {
      // edited drawing: it keeps its place, turn and layer; only the strokes (and so the size) change
      if (!strokes.length) { commit((l) => l.filter((x) => x.id !== editId)); setSelectedId(null); return }
      const e = strokesToItem(strokes, pageW)
      commit((list) => list.map((x) => (x.id === editId && x.type === 'draw' ? { ...x, width: e.width, height: e.height, props: e.draw } : x)))
      return
    }
    if (!strokes.length) return
    const r = strokesToItem(strokes, pageW)
    const c = viewCenter(true)
    const s = Math.min(1, (canvasW * 0.92) / r.width)
    const id = uid()
    // a doodle sits under the photos, notes and stickers (but above a background photo), so it never covers them
    commit((list) => {
      const solid = list.filter((x) => !isBg(x))
      const z = solid.length ? Math.min(...solid.map((x) => x.zIndex)) - 1 : nextZ(list)
      // a background photo sits right under the doodle: make sure it is still lower
      const moved = list.map((x) => (isBg(x) && x.zIndex >= z ? { ...x, zIndex: z - 1 } : x))
      return [...moved, { id, type: 'draw', x: c.x, y: c.y, width: r.width * s, height: r.height * s, rotation: 0, zIndex: z, props: r.draw }]
    })
    setSelectedId(id)
  }

  /* ---------- adding things ---------- */

  const addPhotos = async (files: FileList | File[] | null) => {
    if (!files?.length) return
    const list = [...files]
    try {
      // one at a time keeps memory low on phones and lets us show real progress
      const imgs: Awaited<ReturnType<typeof compressImage>>[] = []
      for (let i = 0; i < list.length; i++) {
        setBusy({ done: i, total: list.length })
        imgs.push(await compressImage(list[i]))
      }
      setBusy({ done: list.length, total: list.length })
      const w = Math.round(clamp(canvasW * (imgs.length === 1 ? 0.52 : 0.4), 140, 230))
      const ids = imgs.map(() => uid())
      const driveOn = !!user && isConnected() && prefs.backup()
      const pids = ids.map(() => uid())
      // a private book: every original gets its own key and is locked before it leaves this phone
      const fks = ids.map(() => (memory.e2ee ? newFileKey() : undefined))
      const sizes = imgs.map((img) => ({ width: w, height: frameHeight('polaroid', w, img.width / img.height), rotation: Math.round(rnd(-2, 2) * 10) / 10 }))
      // start under the header, at the top of what is visible, then flow downward in selection order
      const r = surface.current!.getBoundingClientRect()
      const startY = Math.max(140, (HEADER_H + 24 - r.top) / zoomRef.current)
      const spots = placeInOrder(sizes, itemsRef.current.filter((i) => !isBg(i)), canvasW, startY)
      commit((cur) => {
        let z = nextZ(cur)
        return [...cur, ...imgs.map((img, i) => ({
          id: ids[i], type: 'photo' as const, zIndex: z++, width: sizes[i].width, height: sizes[i].height, rotation: sizes[i].rotation,
          x: spots[i].x, y: spots[i].y,
          props: { src: img.dataUrl, thumb: img.thumb, aspect: img.width / img.height, frame: 'polaroid' as FrameId, radius: 4, caption: '', originalId: driveOn ? pids[i] : undefined, originalKey: fks[i] },
        }))]
      })
      setSelectedId(ids[0])
      tour.emit('photo-added')
      // bring the first photo into view
      const first = spots[0]
      const sc = scroller.current
      if (sc && first) {
        const topInView = r.top + (first.y - sizes[0].height / 2) * zoomRef.current
        if (topInView < HEADER_H + 10 || topInView > window.innerHeight - 220) {
          sc.scrollBy({ top: topInView - (HEADER_H + 30), behavior: 'smooth' })
        }
      }
      setBusy(null)
      // keep the untouched originals in the cloud, one by one, in the background
      if (driveOn) {
        for (let i = 0; i < list.length; i++) void queueOriginal(list[i], memory.id, pids[i], fks[i])
      } else if (user && !driveConfigured) {
        void (async () => {
          for (let i = 0; i < list.length; i++) {
            // Supabase only ever receives locked files, for every book
            const sk = newFileKey()
            const path = await uploadOriginal(list[i], `${user.uid}/${memory.id}`, sk)
            if (path) patch(ids[i], { props: { original: path, originalKey: sk } })
          }
        })()
      } else if (user && driveConfigured && !isConnected()) {
        toast('Tip: connect Google Drive in Settings to keep your original photos')
      }
    } catch {
      setBusy(null)
      toast("Couldn't read that photo")
    }
  }

  const saveOriginal = async (photo: PhotoProps) => {
    toast('Fetching the original…')
    const blob = await loadOriginalBlob(memory.id, photo, user?.uid)
    if (!blob) return toast("Couldn't find the original. Connect Google Drive or ask the person who added it.")
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `photo.${(blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg')}`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 4000)
  }

  /** every photo of this book as ZIP file(s), full quality where we can get it */
  const downloadBook = async () => {
    const photos = itemsRef.current.filter((i) => i.type === 'photo')
    if (!photos.length) return toast('No photos in this book yet')
    setBusy({ done: 0, total: photos.length, label: 'Gathering your photos…' })
    try {
      const r = await downloadBookZip(memory.title, memory.id, itemsRef.current, (p) => loadOriginalBlob(memory.id, p, user?.uid), (p) => setBusy({ done: p.done, total: p.total, label: 'Gathering your photos…' }))
      toast(r.fallback ? `Saved ${r.photos} photos (${r.fallback} without an original)` : `Saved ${r.photos} photos in full quality`)
    } catch {
      toast("Couldn't build the download")
    } finally { setBusy(null) }
  }

  const replacePhoto = async (file?: File) => {
    const target = itemsRef.current.find((i) => i.id === selectedId)
    if (!file || target?.type !== 'photo') return
    try {
      const img = await compressImage(file)
      const aspect = img.width / img.height
      patch(target.id, { height: frameHeight(target.props.frame, target.width, aspect), props: { src: img.dataUrl, thumb: img.thumb, aspect, original: undefined } }, true)
      if (user && isConnected() && prefs.backup()) {
        const pid = uid()
        const fk = memory.e2ee ? newFileKey() : undefined
        patch(target.id, { props: { originalId: pid, original: undefined, originalKey: fk } })
        void queueOriginal(file, memory.id, pid, fk)
      } else if (user && !driveConfigured) {
        const sk = newFileKey()
        void uploadOriginal(file, `${user.uid}/${memory.id}`, sk).then((path) => { if (path) patch(target.id, { props: { original: path, originalKey: sk } }) })
      }
    } catch {
      toast("Couldn't read that photo")
    }
  }

  /** photo <-> full-width background behind everything */
  const setAsBackground = (on: boolean) => {
    const t = itemsRef.current.find((i) => i.id === selectedId)
    if (t?.type !== 'photo') return
    const others = itemsRef.current.filter((i) => i.id !== t.id)
    if (on) {
      const low = others.reduce((m, i) => Math.min(m, i.zIndex), 1) - 1
      patch(t.id, { x: 50, rotation: 0, width: canvasW, height: canvasW / (t.props.aspect || 1), zIndex: low, props: { background: true, frame: 'none', radius: 0, caption: '' } })
    } else {
      const w = Math.round(clamp(canvasW * 0.52, 140, 230))
      patch(t.id, { x: 50, width: w, height: frameHeight('polaroid', w, t.props.aspect), zIndex: nextZ(others), props: { background: false, frame: 'polaroid', radius: 4 } })
    }
  }

  /** a grid collage <-> full-width background behind everything */
  const setCollageBackground = (on: boolean) => {
    const t = itemsRef.current.find((i) => i.id === selectedId)
    if (t?.type !== 'collage') return
    const d = COLLAGES[t.props.kind]
    const others = itemsRef.current.filter((i) => i.id !== t.id)
    if (on) {
      const low = others.reduce((m, i) => Math.min(m, i.zIndex), 1) - 1
      patch(t.id, { x: 50, rotation: 0, width: canvasW, height: Math.round((canvasW * d.h) / d.w), zIndex: low, props: { background: true } })
    } else {
      const w = Math.round(clamp(canvasW * 0.86, 150, 420))
      patch(t.id, { x: 50, width: w, height: Math.round((w * d.h) / d.w), zIndex: nextZ(others), props: { background: false } })
    }
  }

  /** several stickers from the tray's long-press selection: laid out in a loose row around the middle */
  const addStickers = (list: StickerProps[]) => {
    list.forEach((s, i) => addSticker(s, false, (i - (list.length - 1) / 2) * 34, (i % 2 ? 26 : -26)))
    setSheet(null)
    tour.emit('sticker-added')
  }

  const addSticker = (s: StickerProps, close = true, dx = 0, dy = 0) => {
    const ratio = stickerRatio(s)
    const w = s.kind === 'emoji' ? 96 : s.kind === 'image' ? 140 : ratio > 2.2 ? 190 : ratio > 1.5 ? 150 : 120
    addItem((z, c) => ({
      id: '', type: 'sticker', zIndex: z, x: c.x + (close ? rnd(-14, 14) : dx / 4), y: c.y + (close ? rnd(-30, 30) : dy * 2),
      width: w, height: w / ratio, rotation: Math.round(rnd(-12, 12)), props: s,
    }), { ignoreSheet: true })
    if (!close) return
    setSheet(null) // close the tray so the new sticker is visible
    tour.emit('sticker-added')
  }

  const addText = () => setTextStudio({ seed: { text: '', font: theme.font, size: 38, color: theme.palette[0], align: 'center' }, boxW: Math.round(clamp(canvasW - 40, 160, 520)) })

  const addNote = () => {
    begin()
    const id = addItem((z, c) => ({
      id: '', type: 'note', zIndex: z, x: c.x + rnd(-8, 8), y: c.y, width: 176, height: 176,
      rotation: Math.round(rnd(-5, 5) * 10) / 10,
      props: { text: '', color: NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)] },
    }), { record: false })
    setEditingId(id)
  }

  const addMap = (map: MapProps) => {
    // route-only and cut-out maps take the shape of the route, so they are as tall as it is
    const shaped = (map.style ?? 'card') !== 'card'
    const heightFor = (w: number) => (shaped ? Math.round(clamp(w / mapAspect(map), w * 0.6, w * 1.6)) : Math.round(w * 0.78))
    if (editMapId) {
      const cur = itemsRef.current.find((i) => i.id === editMapId)
      patch(editMapId, { ...(cur ? { height: heightFor(cur.width) } : {}), props: { ...map } }, true)
      setEditMapId(null)
      setSheet(null)
      return
    }
    const w = Math.round(clamp(canvasW * 0.78, 240, 340))
    setSheet(null)
    window.setTimeout(() => {
      addItem((z, c) => ({
        id: '', type: 'map', zIndex: z, x: c.x, y: c.y, width: w, height: heightFor(w),
        rotation: Math.round(rnd(-3, 3) * 10) / 10, props: map,
      }))
    }, 120)
  }

  const addBubble = () => {
    begin()
    addItem((z, c) => ({
      id: '', type: 'bubble', zIndex: z, x: c.x + rnd(-8, 8), y: c.y, width: 210, height: 150, rotation: Math.round(rnd(-4, 4)),
      props: { text: 'Hello!', shape: 'speech', tail: 'left', font: "'Comic Neue', 'Comic Sans MS', cursive", size: 11 },
    }), { record: false })
    setSheet('bubble')
  }

  const addLine = () => {
    const w = Math.round(clamp(canvasW * 0.86, 260, 380))
    const id = addItem((z, c) => ({
      id: '', type: 'clothesline', zIndex: z, x: c.x, y: c.y, width: w, height: Math.round(w * 0.64), rotation: 0,
      props: { photos: ['', '', ''] },
    }))
    slotTarget.current = { id, index: 0 }
    window.setTimeout(() => slotInput.current?.click(), 150)
  }

  const fillSlots = async (files: FileList | null) => {
    const t = slotTarget.current
    if (!files?.length || !t) return
    try {
      const target = itemsRef.current.find((i) => i.id === t.id)
      const room = target?.type === 'collage' ? (COLLAGES[target.props.kind]?.slots.length ?? 1) - t.index
        : target?.type === 'group' ? (() => { const c = target.props.children[Math.floor(t.index / 100)]; return c?.type === 'collage' ? (COLLAGES[c.props.kind]?.slots.length ?? 1) - (t.index % 100) : 1 })()
        : 3 - t.index
      const imgs = await Promise.all([...files].slice(0, Math.max(1, room)).map((f) => compressImage(f, { maxSize: 1000, quality: 0.82 })))
      commit((list) => list.map((i) => {
        if (i.id !== t.id) return i
        if (i.type === 'group') {
          const ci = Math.floor(t.index / 100), si = t.index % 100
          const kids = i.props.children.map((c, k) => {
            if (k !== ci || c.type !== 'collage') return c
            const photos = [...c.props.photos]
            imgs.forEach((m, n) => { photos[si + n] = m.dataUrl })
            return { ...c, props: { ...c.props, photos } }
          })
          return { ...i, props: { ...i.props, children: kids } }
        }
        if (i.type === 'collage') {
          const photos = [...i.props.photos]
          imgs.forEach((m, k) => { photos[t.index + k] = m.dataUrl })
          return { ...i, props: { ...i.props, photos } }
        }
        if (i.type !== 'clothesline') return i
        const photos = [...i.props.photos] as [string, string, string]
        imgs.forEach((m, k) => { photos[t.index + k] = m.dataUrl })
        return { ...i, props: { photos } }
      }))
    } catch {
      toast("Couldn't read that photo")
    }
  }

  /** a photo frame from the Frames tab: lands in the middle of the screen with empty slots to fill */
  const addCollage = (kind: CollageKind, close = true) => {
    const def = COLLAGES[kind]
    const w = Math.round(clamp(canvasW * (def.group === 'grids' ? 0.86 : def.w < def.h * 0.5 ? 0.3 : def.w >= 100 && def.h > 200 ? 0.5 : def.w / def.h > 3 ? 0.9 : kind.startsWith('ticket') ? 0.7 : 0.62), 150, 420))
    const id = addItem((z, c) => ({
      id: '', type: 'collage', zIndex: z, x: c.x, y: c.y, width: w, height: Math.round((w * def.h) / def.w), rotation: 0,
      props: { kind, photos: def.slots.map(() => '') },
    }), { ignoreSheet: true })
    if (close) setSheet(null)
    return id
  }
  /** the box an item covers on the canvas, in px (turned items use the box that holds them) */
  const boundsOf = (it: CanvasItem) => {
    const r = (it.rotation * Math.PI) / 180
    const bw = Math.abs(it.width * Math.cos(r)) + Math.abs(it.height * Math.sin(r))
    const bh = Math.abs(it.width * Math.sin(r)) + Math.abs(it.height * Math.cos(r))
    const cx = (it.x / 100) * canvasW
    return { l: cx - bw / 2, r: cx + bw / 2, t: it.y - bh / 2, b: it.y + bh / 2, cx }
  }

  /** the first empty stretch of the page, from the top of what is on screen downwards, that a w x h design fits in */
  const emptySpot = (w: number, h: number) => {
    const rects = itemsRef.current.filter((i) => !isBg(i) && i.type !== 'thread').map(boundsOf)
    const c = viewCenter(true)
    const x0 = (canvasW - w) / 2
    let y = Math.max(150, c.y - (window.innerHeight / 2 - 150) / zoomRef.current)
    const end = rects.reduce((m, r) => Math.max(m, r.b), 0) + 40
    for (; y < end; y += 20) {
      if (!rects.some((r) => r.b > y - 14 && r.t < y + h + 14 && r.r > x0 && r.l < x0 + w)) return y
    }
    return end
  }

  /** a template lands as one locked piece (like a frame in a design tool), in an empty spot, and the page scrolls to it */
  const addTemplate = (def: TemplateDef) => {
    const W = Math.round(clamp(canvasW * 0.9, 150, 420))
    const H = Math.round(W * def.aspect)
    const top = emptySpot(W, H)
    const gid = uid()
    const children: CanvasItem[] = def.pieces.map((p, i) => {
      const base = { id: uid(), x: p.dx * W, y: p.dy * W, rotation: p.rot ?? 0, zIndex: i + 1 }
      if (p.type === 'collage') {
        const d = COLLAGES[p.kind]
        const w = Math.round(p.w * W)
        return { ...base, type: 'collage', width: w, height: Math.round((w * d.h) / d.w), props: { kind: p.kind, photos: d.slots.map(() => '') } } as CanvasItem
      }
      if (p.type === 'sticker') {
        const ratio = SVG_STICKERS[p.id]?.ratio ?? 1
        const w = Math.round(p.w * W)
        return { ...base, type: 'sticker', width: w, height: Math.round(w / ratio), props: { kind: 'svg', value: p.id } } as CanvasItem
      }
      return {
        ...base, type: 'text', width: Math.round(p.w * W), height: Math.round(p.size * 1.4 * p.text.split('\n').length),
        props: { text: p.text, font: p.font === 'display' ? theme.font : "'Manrope', sans-serif", size: p.size, color: p.color, align: p.align },
      } as CanvasItem
    })
    commit((list) => [...list, { id: gid, type: 'group', x: 50, y: top + H / 2, width: W, height: H, rotation: 0, zIndex: nextZ(list), props: { w: W, h: H, children } }])
    setSheet(null)
    setSelectedId(gid)
    window.setTimeout(() => scroller.current?.scrollTo({ top: Math.max(0, (wrap.current?.offsetTop ?? 0) + top * zoomRef.current - HEADER_H - 90), behavior: 'smooth' }), 120)
  }

  /** unlock: the pieces become ordinary items (tagged with the group) at the places they had */
  const unlockGroup = (id: string, loose = false) => {
    commit((list) => {
      const g = list.find((i) => i.id === id)
      if (!g || g.type !== 'group') return list
      const s = g.width / g.props.w
      const th = (g.rotation * Math.PI) / 180
      const cs = Math.cos(th), sn = Math.sin(th)
      const gx = (g.x / 100) * canvasW
      const kids = [...g.props.children].sort((a, b) => a.zIndex - b.zIndex).map((c, i) => {
        const ox = c.x * s, oy = c.y * s
        const x = gx + ox * cs - oy * sn, y = g.y + ox * sn + oy * cs
        const out: CanvasItem = { ...c, x: (x / canvasW) * 100, y, width: c.width * s, height: c.height * s, rotation: c.rotation + g.rotation, zIndex: g.zIndex + i, groupId: loose ? undefined : id }
        if (out.type === 'text') out.props = { ...out.props, size: Math.round(out.props.size * s * 10) / 10 }
        return out
      })
      // stacking numbers must be whole: everything above the template moves up to make room for its pieces
      const room = kids.length - 1
      return [...list.filter((i) => i.id !== id).map((i) => (i.zIndex > g.zIndex ? { ...i, zIndex: i.zIndex + room } : i)), ...kids]
    })
    setSelectedId(null)
  }

  /** the pieces of a locked group as ordinary items at the places they have on the page */
  const groupPieces = (g: Extract<CanvasItem, { type: 'group' }>): CanvasItem[] => {
    const s = g.width / g.props.w
    const th = (g.rotation * Math.PI) / 180
    const cs = Math.cos(th), sn = Math.sin(th)
    const gx = (g.x / 100) * canvasW
    return [...g.props.children].sort((a, b) => a.zIndex - b.zIndex).map((c, i) => {
      const ox = c.x * s, oy = c.y * s
      const out: CanvasItem = { ...c, x: ((gx + ox * cs - oy * sn) / canvasW) * 100, y: g.y + ox * sn + oy * cs, width: c.width * s, height: c.height * s, rotation: c.rotation + g.rotation, zIndex: g.zIndex + i * 0.001, groupId: undefined }
      if (out.type === 'text') out.props = { ...out.props, size: Math.round(out.props.size * s * 10) / 10 }
      return out
    })
  }
  /** group: the chosen items (a group among them is opened up) become one piece that moves, turns and resizes together */
  const makeGroup = (ids: string[]) => {
    let made = ''
    commit((list) => {
      const chosen = ids.map((id) => list.find((i) => i.id === id)).filter((i): i is CanvasItem => !!i)
      if (chosen.length < 2) return list
      const flat = chosen.flatMap((c) => (c.type === 'group' ? groupPieces(c) : [c])).sort((a, b) => a.zIndex - b.zIndex)
      const bb = flat.map(boundsOf)
      const L = Math.min(...bb.map((b) => b.l)), R = Math.max(...bb.map((b) => b.r)), T = Math.min(...bb.map((b) => b.t)), B = Math.max(...bb.map((b) => b.b))
      const cx = (L + R) / 2, cy = (T + B) / 2
      const kids: CanvasItem[] = flat.map((c, i) => ({ ...c, groupId: undefined, x: (c.x / 100) * canvasW - cx, y: c.y - cy, zIndex: i + 1 }))
      const gone = new Set([...chosen.map((c) => c.id), ...flat.map((c) => c.id)])
      const rest = list.filter((i) => !gone.has(i.id) && !(i.type === 'thread' && (gone.has(i.props.a) || gone.has(i.props.b))))
      const W = Math.max(1, Math.round(R - L)), H = Math.max(1, Math.round(B - T))
      made = uid()
      return [...rest, { id: made, type: 'group', x: (cx / canvasW) * 100, y: cy, width: W, height: H, rotation: 0, zIndex: Math.max(...chosen.map((c) => c.zIndex)), props: { made: true, w: W, h: H, children: kids } } as CanvasItem]
    })
    if (made) setSelectedId(made)
  }

  /** lock: the pieces of the group, and anything dropped inside its area, join into one piece again */
  const lockGroup = (gid: string) => {
    commit((list) => {
      const members = list.filter((i) => i.groupId === gid)
      if (!members.length) return list
      const bb = members.map(boundsOf)
      const L = Math.min(...bb.map((b) => b.l)), R = Math.max(...bb.map((b) => b.r)), T = Math.min(...bb.map((b) => b.t)), B = Math.max(...bb.map((b) => b.b))
      const inside = list.filter((i) => !i.groupId && i.type !== 'thread' && i.type !== 'group' && !isBg(i) && (() => { const b = boundsOf(i); return b.cx > L && b.cx < R && i.y > T && i.y < B })())
      const all = [...members, ...inside].sort((a, b) => a.zIndex - b.zIndex)
      const cx = (L + R) / 2, cy = (T + B) / 2
      const kids: CanvasItem[] = all.map((c, i) => ({ ...c, groupId: undefined, x: (c.x / 100) * canvasW - cx, y: c.y - cy, zIndex: i + 1 }))
      const gone = new Set(all.map((c) => c.id))
      const rest = list.filter((i) => !gone.has(i.id) && !(i.type === 'thread' && (gone.has(i.props.a) || gone.has(i.props.b))))
      const W = Math.round(R - L), H = Math.round(B - T)
      return [...rest, { id: gid, type: 'group', x: (cx / canvasW) * 100, y: cy, width: W, height: H, rotation: 0, zIndex: Math.max(...all.map((c) => c.zIndex)), props: { w: W, h: H, children: kids } } as CanvasItem]
    })
    setSelectedId(gid)
  }

  const addDivider = () => {
    const n = itemsRef.current.filter((i) => i.type === 'divider').length + 1
    addItem((z, c) => ({
      id: '', type: 'divider', zIndex: z, x: c.x, y: c.y, width: Math.round(canvasW * 0.9), height: 44, rotation: 0,
      props: { label: `Stop ${n}`, color: theme.palette[1] ?? accent },
    }))
  }

  /* ---------- story mode: a 9:16 frame over the canvas ---------- */
  const storyKey = `mt-story-y:${memory.id}`
  const enterStory = () => {
    const sc = scroller.current
    const sf = surface.current
    if (!sc || !sf) return
    // the frame starts right where you are on the page (not where it was last time)
    const y = Math.max(0, (HEADER_H + 10 - sf.getBoundingClientRect().top) / zoomRef.current)
    setStoryY(y)
    setSelectedId(null)
    setStory(true)
    tour.emit('story-open')
    preStoryZoom.current = zoomRef.current
    fitFrame(y, size)
    sc.scrollTo({ top: Math.max(0, (wrap.current?.offsetTop ?? 0) + y * zoomRef.current - HEADER_H - 10), behavior: 'smooth' })
    try { if (!localStorage.getItem('mt-story-hint')) { localStorage.setItem('mt-story-hint', '1'); toast('Keep titles and faces out of the shaded zones.') } } catch { /* ignore */ }
  }
  /* ---------- print mode: the book as pages ---------- */
  const printDims = pageDims(printSize, printPick.landscape)
  const printPageH = (canvasW * printDims.h) / printDims.w
  const printMargin = Math.round(canvasW * 0.04)
  const printUsed = useMemo(() => (printMode ? pagesNeeded(vItems, canvasW, printY, printPageH) : 1), [printMode, vItems, canvasW, printY, printPageH])
  const fitPrintFrame = (y: number, ph: number) => {
    const z = clamp((window.innerHeight - HEADER_H - 150) / ph, ZMIN, 1)
    applyZoom(Math.min(zoomRef.current, z), { y, screenY: HEADER_H + 10 })
  }
  const enterPrint = () => {
    const sc = scroller.current
    const sf = surface.current
    if (!sc || !sf) return
    let y = 0
    try { const v = localStorage.getItem(`mt-print-y:${memory.id}`); if (v) y = Math.max(0, +v || 0) } catch { /* ignore */ }
    if (!y) {
      const tops = itemsRef.current.filter((i) => i.type !== 'thread' && !isBg(i)).map((i) => boundsOf(i).t)
      y = tops.length ? Math.max(0, Math.floor(Math.min(...tops) - printMargin)) : 0
    }
    setPrintY(y)
    setSelectedId(null)
    setPrintMode(true)
    preStoryZoom.current = zoomRef.current
    fitPrintFrame(y, printPageH)
    sc.scrollTo({ top: Math.max(0, (wrap.current?.offsetTop ?? 0) + y * zoomRef.current - HEADER_H - 10), behavior: 'smooth' })
    try { if (!localStorage.getItem('mt-print-hint')) { localStorage.setItem('mt-print-hint', '1'); toast('Each framed page is one picture. Keep things inside the dashed margin.') } } catch { /* ignore */ }
  }
  const leavePrint = () => { setPrintMode(false); setPrintExportOpen(false); applyZoom(preStoryZoom.current) }
  const pickPrint = (s: PrintSize, landscape: boolean) => {
    setPrintPick({ id: s.id, landscape })
    try { localStorage.setItem(`mt-print-size:${memory.id}`, `${s.id}:${landscape ? 'l' : 'p'}`) } catch { /* ignore */ }
    const d = pageDims(s, landscape)
    fitPrintFrame(printYRef.current, (canvasW * d.h) / d.w)
  }
  useEffect(() => { if (printMode) try { localStorage.setItem(`mt-print-y:${memory.id}`, String(Math.round(printY))) } catch { /* ignore */ } }, [printMode, printY, memory.id])
  useEffect(() => {
    if (!printMode) return
    const need = Math.ceil((printY + (printUsed + 1) * printPageH + 300) / 100) * 100
    if (need > heightRef.current) setHeight(need)
  }, [printMode, printY, printUsed, printPageH, setHeight])
  /** nudge every item that a page edge cuts (or that sticks out of the margin) so it sits inside its page */
  const fitToPages = () => {
    const m = printMargin
    let moved = 0
    const next = itemsRef.current.map((it) => {
      if (it.type === 'thread' || isBg(it)) return it
      const b = boundsOf(it)
      const h = b.b - b.t, w = b.r - b.l
      const p = Math.max(0, Math.floor((it.y - printY) / printPageH))
      const top = printY + p * printPageH + m, bot = printY + (p + 1) * printPageH - m
      let dy = 0, dx = 0
      if (h <= bot - top) { if (b.t < top) dy = top - b.t; else if (b.b > bot) dy = bot - b.b }
      if (w <= canvasW - 2 * m) { if (b.l < m) dx = m - b.l; else if (b.r > canvasW - m) dx = canvasW - m - b.r }
      if (!dx && !dy) return it
      moved++
      return { ...it, y: it.y + dy, x: it.x + (dx / canvasW) * 100 }
    })
    if (!moved) { toast('Everything already sits inside its page'); return }
    commit(() => next)
    toast(`Moved ${moved} item${moved > 1 ? 's' : ''} inside their pages`)
  }

  const leaveStory = () => { setStory(false); setStoryPreview(false); applyZoom(preStoryZoom.current); tour.emit('story-close') }
  /** zoom out just enough that the whole frame fits on screen */
  function fitFrame(y: number, sz: StorySize) {
    const z = clamp((window.innerHeight - HEADER_H - 150) / frameHeightFor(canvasW, sz), ZMIN, 1)
    if (z !== zoomRef.current) applyZoom(Math.min(zoomRef.current, z), { y, screenY: HEADER_H + 10 })
    else applyZoom(z, { y, screenY: HEADER_H + 10 })
  }
  const pickSize = (sz: StorySize) => {
    setSizeId(sz.id)
    try { localStorage.setItem(`mt-story-size:${memory.id}`, sz.id) } catch { /* ignore */ }
    fitFrame(storyYRef.current, sz)
  }
  useEffect(() => { if (story) try { localStorage.setItem(storyKey, String(Math.round(storyY))) } catch { /* ignore */ } }, [story, storyY, storyKey])
  useEffect(() => {
    if (!story) return
    const need = Math.ceil((storyY + frameHeightFor(canvasW, size) + 300) / 100) * 100
    if (need > heightRef.current) setHeight(need)
  }, [story, storyY, canvasW, size, setHeight])
  const onTool = (t: ToolId) => {
    setSelectedId(null)
    if (['note', 'bubble', 'line', 'location', 'divider'].includes(t)) tour.emit('more-used')
    switch (t) {
      case 'photo': fileInput.current?.click(); break
      case 'camera': setCameraOpen(true); break
      case 'sticker': setSheet('sticker'); break
      case 'templates': setSheet('templates'); break
      case 'text': addText(); break
      case 'draw': setSheet('draw'); break
      case 'note': addNote(); break
      case 'divider': addDivider(); break
      case 'location': setSheet('location'); break
      case 'bubble': addBubble(); break
      case 'line': addLine(); break
      case 'story': if (!story) enterStory(); break
      case 'print': if (!printMode) enterPrint(); break
      case 'canvas': setStyleOpen(true); break
    }
  }

  /* ---------- selection actions ---------- */

  /** ids of the items that overlap the selected one (backgrounds do not count: everything sits on them) */
  const overlap = useMemo(() => {
    const none = { ids: new Set<string>(), up: false, down: false }
    if (!selected) return none
    const box = (it: CanvasItem) => {
      const r = (it.rotation * Math.PI) / 180
      const w = Math.abs(it.width * Math.cos(r)) + Math.abs(it.height * Math.sin(r))
      const h = Math.abs(it.width * Math.sin(r)) + Math.abs(it.height * Math.cos(r))
      const cx = (it.x / 100) * canvasW
      return { l: cx - w / 2, r: cx + w / 2, t: it.y - h / 2, b: it.y + h / 2 }
    }
    const a = box(selected)
    const ids = new Set<string>()
    let up = false, down = false
    for (const o of vItems) {
      if (o.id === selected.id || o.type === 'thread' || isBg(o)) continue
      const c = box(o)
      if (!(a.l < c.r - 2 && a.r > c.l + 2 && a.t < c.b - 2 && a.b > c.t + 2)) continue
      ids.add(o.id)
      if (o.zIndex > selected.zIndex) up = true
      else down = true
    }
    return { ids, up, down }
  }, [selected, vItems, canvasW])

  const lastReorder = useRef(0)
  /** One tap: one level up (above the next overlapping item) or one level down. Very quick repeat taps count once. */
  const reorder = (dir: 1 | -1) => {
    if (!selected) return
    const now = performance.now()
    if (now - lastReorder.current < 250) return
    lastReorder.current = now
    tour.emit('reorder')
    const ids = overlap.ids
    commit((list) => {
      const order = list.filter((x) => x.type !== 'thread').sort((a, b) => a.zIndex - b.zIndex)
      const i = order.findIndex((x) => x.id === selected.id)
      if (i < 0) return list
      const me = order[i]
      let at = -1
      if (dir === 1) { for (let k = i + 1; k < order.length; k++) if (ids.has(order[k].id)) { at = k; break } }
      else { for (let k = i - 1; k >= 0; k--) if (ids.has(order[k].id)) { at = k; break } }
      if (at < 0) return list
      order.splice(i, 1)
      order.splice(at, 0, me) // just above the next overlapping item, or just below the one under it
      const z = new Map(order.map((x, k) => [x.id, k + 1]))
      return list.map((x) => (z.has(x.id) ? { ...x, zIndex: z.get(x.id)! } : x))
    })
  }

  const actions = selected && {
    onHandle: (e: React.PointerEvent, kind: 'resize' | 'rotate' | 'scale') => startHandle(e, selected.id, kind),
    onDuplicate: () => {
      let id = ''
      commit((list) => { const c = cloneItem(selected, nextZ(list)); id = c.id; return [...list, c] })
      setSelectedId(id)
    },
    onDelete: () => { commit((l) => l.filter((x) => x.id !== selected.id && !(x.type === 'thread' && (x.props.a === selected.id || x.props.b === selected.id)))); setSelectedId(null) },
    onConnect: () => { if (connectFrom) setConnectFrom(null); else setConnectFrom(selected.id) },
    onGroup: selected.type === 'group' ? { locked: true, made: !!selected.props.made, run: () => unlockGroup(selected.id, !!selected.props.made) } : undefined,
    onGather: selected.type !== 'thread' ? () => { setConnectFrom(null); setGroupFrom((g) => (g ? null : selected.id)) } : undefined,
    onForward: overlap.up ? () => reorder(1) : undefined,
    onBackward: overlap.down ? () => reorder(-1) : undefined,
    onView: selected.type === 'photo' && hasMouse() ? () => viewItem(selected.id) : undefined,
    onFrame: selected.type === 'photo' ? () => openFrame() : undefined,
    onColor: selected.type === 'note' ? (color: string) => patch(selected.id, { props: { color } }, true) : undefined,
    onEdit:
      selected.type === 'map' ? () => { setEditMapId(selected.id); setSheet('location') }
      : selected.type === 'text' ? openText
      : selected.type === 'bubble' ? openBubble
      : selected.type === 'collage' && COLLAGES[selected.props.kind]?.slots.length ? () => { begin(); setSheet('collage') }
      : selected.type === 'draw' ? () => { setEditDrawId(selected.id); setSheet('draw') }
      : selected.type === 'note' || selected.type === 'divider' ? () => { begin(); setEditingId(selected.id) }
      : undefined,
  }

  /* ---------- canvas growth, scroll-to-reveal ---------- */

  useEffect(() => {
    const bottom = vItems.reduce((m, i) => Math.max(m, i.y + i.height / 2), 0)
    if (bottom > height - 500) setHeight(Math.ceil((bottom + 1400) / 100) * 100)
  }, [vItems, height, setHeight])

  useEffect(() => {
    if (!sheetH || !selected || sheet === 'draw' || !scroller.current || !surface.current) return
    const r = surface.current.getBoundingClientRect()
    const top = r.top + (selected.y - selected.height / 2) * zoomRef.current
    const bottom = r.top + (selected.y + selected.height / 2) * zoomRef.current
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

  // keep the drawn window right when the page opens, is zoomed or changes size
  useEffect(() => { rangeRef.current = { top: -1e9, bottom: 1e9 }; updateRange() }, [zoom, canvasW, cv.loaded, updateRange])
  const isFar = (it: CanvasItem) => {
    if (it.id === selectedId || it.id === draggingId || it.id === editingId || (selected?.groupId && it.groupId === selected.groupId)) return false
    const half = Math.max(it.width, it.height) * 0.75
    return it.y + half < range.top || it.y - half > range.bottom
  }

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    scrollY.set(el.scrollTop)
    updateRange()
    if (el.scrollTop + el.clientHeight > heightRef.current * zoomRef.current - 700) setHeight(heightRef.current + 1200)
  }

  // laptop shortcut: Space opens the selected photo
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key !== ' ' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || sheet || viewer || cameraOpen) return
      if (selected?.type === 'photo') { e.preventDefault(); viewItem(selected.id) }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, sheet, viewer, cameraOpen])

  // laptop shortcuts: undo / redo, delete, duplicate, nudge with the arrow keys, Esc to let go
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (sheet || viewer || cameraOpen || textStudio || drawing || readOnly || printSizeOpen || printExportOpen) return
      const mod = e.ctrlKey || e.metaKey
      const key = e.key.toLowerCase()
      if (mod && key === 'z') { e.preventDefault(); if (e.shiftKey) cv.redo(); else cv.undo(); return }
      if (mod && key === 'y') { e.preventDefault(); cv.redo(); return }
      if (!selected) return
      if (key === 'escape') { setSelectedId(null); setConnectFrom(null); setGroupFrom(null); return }
      if (!actions || isBg(selected)) return
      if (key === 'delete' || key === 'backspace') { e.preventDefault(); actions.onDelete(); return }
      if (mod && key === 'd') { e.preventDefault(); actions.onDuplicate(); return }
      if (key === 'enter' && actions.onEdit) { e.preventDefault(); actions.onEdit(); return }
      if (key.startsWith('arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0
        const dy = key === 'arrowup' ? -step : key === 'arrowdown' ? step : 0
        patch(selected.id, { x: selected.x + (dx / canvasW) * 100, y: selected.y + dy }, true)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, actions, sheet, viewer, cameraOpen, textStudio, drawing, readOnly, printSizeOpen, printExportOpen, canvasW])

  const run = (fn: () => void) => () => { setMenu(false); fn() }

  // the first time something is selected, show what the little toolbar does (never over the main tour)
  useEffect(() => {
    if (!selectedId || story || sheet || tourSeen('select') || tour.isActive()) return
    const t = window.setTimeout(() => { if (!tour.isActive() && !tourSeen('select')) tour.start('select') }, 900)
    return () => window.clearTimeout(t)
  }, [selectedId, story, sheet])
  const wasMenu = useRef(false)
  useEffect(() => { if (wasMenu.current && !menu) tour.emit('menu-close'); wasMenu.current = menu }, [menu])

  /* ---------- a deleted/replaced photo takes its stored original with it ---------- */
  const prevPhotos = useRef(new Map<string, string | undefined>())
  const discardTimers = useRef(new Map<string, number>())
  const usedOriginal = useCallback((oid: string) => itemsRef.current.some((i) => i.type === 'photo' && i.props.originalId === oid), [itemsRef])

  useEffect(() => {
    if (!cv.loaded) return
    const cur = new Map<string, string | undefined>()
    for (const it of items) if (it.type === 'photo') cur.set(it.id, it.props.originalId)
    prevPhotos.current.forEach((oid, id) => {
      if (!oid || (cur.has(id) && cur.get(id) === oid)) return
      markForDiscard(memory.id, oid)
      window.clearTimeout(discardTimers.current.get(oid))
      // a minute of grace so Undo can bring it back
      discardTimers.current.set(oid, window.setTimeout(() => {
        discardTimers.current.delete(oid)
        if (!user || usedOriginal(oid)) { unmarkDiscard(memory.id, oid); return }
        void discardOriginal(memory.id, oid, user.uid).catch(reportError).finally(() => unmarkDiscard(memory.id, oid))
      }, 60_000))
    })
    // restored (Undo): cancel the clean-up
    cur.forEach((oid) => { if (oid && discardTimers.current.has(oid)) { window.clearTimeout(discardTimers.current.get(oid)); discardTimers.current.delete(oid); unmarkDiscard(memory.id, oid) } })
    prevPhotos.current = cur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, cv.loaded])

  // on open: finish clean-ups that were interrupted, and delete my copies of originals other members removed
  useEffect(() => {
    if (!user || !cv.loaded) return
    void runPendingDiscards(memory.id, user.uid, usedOriginal).catch(reportError)
    void purgeFlagged(memory.id, user.uid).catch(reportError)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cv.loaded, user?.uid, memory.id])

  /* ---------- originals: copy shared books' originals to my Drive (or ask first) ---------- */
  useEffect(() => {
    if (!user || !driveConfigured) return
    let alive = true
    void (async () => {
      const pref = prefs.copyBook(memory.id)
      const wanted = pref === true || (pref === null && prefs.copyShared())
      if (isConnected() && wanted) { void replicateBook(memory.id, user.uid, { repair: true }); return }
      if (pref !== null || prefs.asked(memory.id)) return
      const m = await missingCopies(memory.id, user.uid).catch(() => null)
      if (alive && m && m.count > 0) setDrivePrompt({ count: m.count, bytes: m.bytes })
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memory.id, user?.uid])

  const answerPrompt = async (yes: boolean) => {
    prefs.setAsked(memory.id)
    setDrivePrompt(null)
    if (!yes || !user) return
    const ok = isConnected() || (await connectDrive(user.email))
    if (!ok) return toast("Google Drive wasn't connected")
    prefs.setCopyBook(memory.id, true)
    void replicateBook(memory.id, user.uid, { repair: true })
  }

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

  const editMap = items.find((i) => i.id === editMapId)
  const bubbleItem = selected?.type === 'bubble' ? selected : undefined
  /** the dashed outline around the pieces of an unlocked template while one of them is selected */
  const groupFrame = (() => {
    const gid = selected?.groupId
    if (!gid) return null
    const bb = vItems.filter((i) => i.groupId === gid).map(boundsOf)
    if (!bb.length) return null
    return { l: Math.min(...bb.map((b) => b.l)), r: Math.max(...bb.map((b) => b.r)), t: Math.min(...bb.map((b) => b.t)), b: Math.max(...bb.map((b) => b.b)) }
  })()
  const collageItem = selected?.type === 'collage' ? selected : undefined
  const photoItem = selected?.type === 'photo' ? selected : undefined

  return (
    <AssetCtx.Provider value={assetCtx}>
    <motion.div
      className="fixed inset-0 z-40"
      onPointerDownCapture={(e) => { lastPointer.current = e.pointerType; suppressClick.current = false }}
      style={{ ...themeVars(theme), background: desk ? '#eceef2' : rc.bg, pointerEvents: reveal ? 'none' : undefined, clipPath: clip }}
      initial={{ opacity: reveal ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.06 } }}
      transition={{ duration: 0.22 }}
    >
      <div
        ref={scroller}
        className="absolute inset-0 overflow-x-hidden"
        style={{ overflowY: drawing ? 'hidden' : 'auto', touchAction: 'pan-y', overscrollBehavior: 'contain', ...(desk ? { overflowX: 'auto' } : {}), ...(desk ? { background: '#eceef2', top: BAR_H, bottom: FOOT_H, left: `calc(${RAIL_W}px + var(--dock-w, 0px))`, right: 0, transition: 'left .22s ease' } : {}) }}
        onScroll={onScroll}
        onDragOver={(e) => { if (!readOnly && e.dataTransfer.types.includes('Files')) e.preventDefault() }}
        onDrop={(e) => {
          if (readOnly) return
          const files = [...e.dataTransfer.files].filter((f) => f.type.startsWith('image/'))
          if (!files.length) return
          e.preventDefault()
          void addPhotos(files)
        }}
      >
        <div ref={col} className="relative mx-auto max-w-[520px]" style={desk ? { maxWidth: 'none', width: canvasW * zoom, background: rc.bg, minHeight: '100%', boxShadow: '0 0 0 1px rgba(0,0,0,.06), 0 18px 60px rgba(20,24,40,.14)' } : undefined}>
          <header
            className="sticky top-0 z-30 px-4"
            style={{
              height: HEADER_H, paddingTop: 'calc(var(--safe-top) + 12px)', boxSizing: 'content-box', ...(desk ? { display: 'none' } : {}),
              background: `linear-gradient(${rc.bg} 78%, ${rc.bg}00)`,
              color: rc.dark ? '#f4f4f6' : undefined,
            }}
          >
            <div className="relative flex items-center justify-between">
              <IconButton label={story ? 'Exit story mode' : 'Back'} onClick={story ? leaveStory : onBack}><ArrowLeft size={21} /></IconButton>
              <motion.h1
                className="pointer-events-none absolute inset-x-14 m-0 truncate text-center text-[26px] font-extrabold leading-tight tracking-tight"
                style={{ scale: titleScale, y: titleY }}
              >
                {memory.title}
              </motion.h1>
              <div className="relative" data-tour="menu">
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
                        <MenuItem icon={<IcPages />} label="Print pages" onClick={run(() => { if (!story && !printMode) enterPrint() })} />
                        {!readOnly && <MenuItem icon={<IcEdit />} label="Edit book" onClick={run(onEdit)} />}
                        {!readOnly && <MenuItem icon={<IcPalette />} label="Change theme" onClick={run(onTheme)} />}
                        <MenuItem icon={<IcShare />} label="Share" onClick={run(onShare)} />
                        {user && <MenuItem icon={<IcPeople />} label="People" onClick={run(() => setPeopleOpen(true))} />}
                        {user && <MenuItem icon={<IcLock />} label={memory.e2ee ? 'Private book' : 'Privacy'} onClick={run(() => setPrivacyOpen(true))} />}
                        <MenuItem icon={<IcDownload />} label="Download book" onClick={run(() => void downloadBook())} />
                        <MenuItem danger icon={<IcTrash />} label="Delete" onClick={run(onDelete)} />
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center">
 <div className="flex gap-1">
                {readOnly && <span className="ml-2 flex h-11 items-center gap-1.5 text-[12px] font-bold text-neutral-400"><Eye size={14} /> View only</span>}
                {!readOnly && <button type="button" aria-label="Undo" disabled={!cv.canUndo} onClick={cv.undo}
                  className="grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent text-current active:scale-95 disabled:opacity-25">
                  <Undo2 size={20} />
                </button>}
                {!readOnly && <button type="button" aria-label="Redo" disabled={!cv.canRedo} onClick={cv.redo}
                  className="grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent text-current active:scale-95 disabled:opacity-25">
                  <Redo2 size={20} />
                </button>}
              </div>
              {story ? (
                <div className="flex items-center gap-1.5">
                  <motion.button
                    type="button" onClick={() => setStoryPreview(true)} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 460, damping: 28 }}
                    className="flex h-10 items-center gap-1.5 rounded-full border-0 bg-[#17171a] px-4 text-[14px] font-bold text-white"
                  ><IcClapper /> Done</motion.button>
                  <motion.button
                    type="button" aria-label="Close story mode" onClick={leaveStory} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 460, damping: 28 }}
                    className="grid h-10 w-10 place-items-center rounded-full border-0 bg-white text-[#17171a] shadow-[0_2px_8px_rgba(20,24,40,.15)]"
                  ><X size={18} /></motion.button>
                </div>
              ) : printMode ? (
                <div className="flex items-center gap-1.5">
                  <motion.button
                    type="button" onClick={() => setPrintExportOpen(true)} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 460, damping: 28 }}
                    className="flex h-10 items-center gap-1.5 rounded-full border-0 bg-[#17171a] px-4 text-[14px] font-bold text-white"
                  ><IcPages /> Export</motion.button>
                  <motion.button
                    type="button" aria-label="Close print mode" onClick={leavePrint} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 460, damping: 28 }}
                    className="grid h-10 w-10 place-items-center rounded-full border-0 bg-white text-[#17171a] shadow-[0_2px_8px_rgba(20,24,40,.15)]"
                  ><X size={18} /></motion.button>
                </div>
              ) : (
                <motion.p className="m-0 text-center text-[14px] font-semibold text-neutral-400" style={{ opacity: subOpacity }}>
                  {photoCount} {photoCount === 1 ? 'Photo' : 'Photos'} <span className="mx-1">•</span> {formatDate(memory.date)}
                </motion.p>
              )}
              {story ? (
                <div className="flex justify-end pr-1">
                  <button type="button" aria-label="Change frame size" onClick={() => setSizeOpen(true)} className="flex h-9 items-center gap-1 rounded-full border-0 bg-white px-3 text-[12.5px] font-extrabold text-[#17171a] shadow-[0_2px_8px_rgba(20,24,40,.15)]">
                    {ratioLabel(size)} <ChevronDown size={14} />
                  </button>
                </div>
              ) : printMode ? (
                <div className="relative flex justify-end pr-1">
                  <button type="button" aria-label="Change page size" onClick={() => setPrintSizeOpen(true)} className="flex h-9 items-center gap-1 rounded-full border-0 bg-white px-3 text-[12.5px] font-extrabold text-[#17171a] shadow-[0_2px_8px_rgba(20,24,40,.15)]">
                    {printSize.name.replace('Scrapbook ', '').replace('Photo ', '')} <ChevronDown size={14} />
                  </button>
                  {/* below the size chip, so the top bar stays uncrowded */}
                  <button type="button" aria-label="Move every item inside its page" onClick={fitToPages} className="absolute right-1 top-full mt-1.5 flex h-9 items-center gap-1.5 rounded-full border-0 bg-white px-3.5 text-[12.5px] font-extrabold text-[#17171a] shadow-[0_2px_8px_rgba(20,24,40,.15)]">
                    <Maximize2 size={13} strokeWidth={2.6} /> Fit
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-end gap-2 pr-1 text-[12px] font-bold text-neutral-400" role="status" aria-live="polite">
                  {here.length > 0 && (
                    <span className="flex items-center" aria-label={`${here.map((h) => h.name).join(', ')} here now`} title={`${here.map((h) => h.name).join(', ')} here now`}>
                      {here.slice(0, 3).map((h, i) => (
                        <span key={h.id} className="relative -ml-2 first:ml-0" style={{ zIndex: 5 - i }}>
                          {h.photo
                            ? <img src={h.photo} alt={h.name} referrerPolicy="no-referrer" className="h-7 w-7 rounded-full object-cover ring-2 ring-white" />
                            : <span className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-extrabold text-white ring-2 ring-white" style={{ background: h.color }}>{h.name.slice(0, 1).toUpperCase()}</span>}
                          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                        </span>
                      ))}
                      {here.length > 3 && <span className="-ml-2 grid h-7 min-w-7 place-items-center rounded-full bg-neutral-200 px-1 text-[11px] font-extrabold text-neutral-600 ring-2 ring-white">+{here.length - 3}</span>}
                    </span>
                  )}
                  {readOnly ? null
                    : cv.status === 'saving' ? <span className="flex items-center gap-1"><Loader2 size={13} className="animate-spin" /> Saving</span> : <span className="flex items-center gap-1"><Check size={13} strokeWidth={3} /> Saved</span>}
                </div>
              )}
            </div>
          </header>

          {/* the infinite canvas surface */}
          <div ref={wrap} className="no-scrollbar" style={{ height: height * zoom, overflowX: zoom > 1.001 ? 'auto' : 'hidden', overflowY: 'hidden', touchAction: zoom > 1.001 ? 'pan-x pan-y' : 'pan-y' }}>
          <div ref={inner} style={{ position: 'relative', width: canvasW * (desk ? zoom : Math.max(1, zoom)), height: height * zoom }}>
          <div
            ref={surface}
            className="isolate"
            style={{
              position: 'absolute', top: 0, left: !desk && zoom < 1 ? (canvasW * (1 - zoom)) / 2 : 0, width: canvasW, height,
              transform: zoom !== 1 ? `scale(${zoom})` : undefined, transformOrigin: 'top left',
              ...rc.css,
              touchAction: zoom > 1.001 ? 'pan-x pan-y' : 'pan-y',
            }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('[data-item],[data-ui]')) return
              setSelectedId(null)
              setConnectFrom(null)
            }}
          >
            <FloatingShapes theme={theme} />
            <AnimatePresence initial={false}>
              {visibleItems.map((it) => (
                <CanvasItemView
                  key={it.id} item={it} canvasW={canvasW}
                  selected={selectedId === it.id}
                  far={isFar(it)}
                  onSlot={onSlot}
                  onViewSlot={onViewSlot}
                  onItemClick={onItemClick}
                  dragging={draggingId === it.id}
                  editing={editingId === it.id}
                  onPointerDown={readOnly ? noopPointer : startItemStable}
                  onMeasure={onMeasure}
                  onEditText={onEditText}
                  onEditDone={onEditDone}
                />
              ))}
            </AnimatePresence>

            <ThreadsSvg
              items={items} canvasW={canvasW} selectedId={selectedId}
              onSelect={(id, e) => {
                // the colour bar opens where the thread was touched
                const r = surface.current?.getBoundingClientRect()
                if (r) setThreadTap({ id, x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom })
                setSelectedId(id)
              }}
            />
            {guides && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 8600, overflow: 'visible' }} aria-hidden>
                {guides.v.map((l) => <line key={`v${l.x}`} x1={l.x} x2={l.x} y1={l.y1} y2={l.y2} stroke="#ff3d81" strokeWidth={1.25} strokeDasharray="5 4" />)}
                {guides.h.map((l) => <line key={`h${l.y}`} x1={l.x1} x2={l.x2} y1={l.y} y2={l.y} stroke="#ff3d81" strokeWidth={1.25} strokeDasharray="5 4" />)}
              </svg>
            )}
            {printMode && (
              <PrintOverlay surfaceRef={surface} scrollerRef={scroller} canvasW={canvasW} surfaceH={height} y0={printY} onY0={setPrintY} pageH={printPageH} used={printUsed} items={vItems} accent={accent} headerH={HEADER_H} zoom={zoom} margin={printMargin} />
            )}
            {story && (
              <StoryOverlay surfaceRef={surface} scrollerRef={scroller} canvasW={canvasW} surfaceH={height} y={storyY} onY={setStoryY} items={vItems} accent={accent} headerH={HEADER_H} size={size} zoom={zoom} />
            )}
            {selectedThread && !drawing && (() => {
              const m = threadTap?.id === selectedThread.id ? threadTap : threadMid(items, selectedThread, canvasW)
              if (!m) return null
              return (
                <motion.div
                  data-ui key={selectedThread.id}
                  className="absolute flex items-center rounded-full bg-white px-1.5"
                  style={{ left: Math.min(Math.max(m.x, 150), canvasW - 150), top: m.y - 62, x: '-50%', zIndex: 9600, boxShadow: '0 6px 22px rgba(20,24,40,.2), 0 0 0 1px rgba(20,24,40,.05)' }}
                  initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                >
                  {THREAD_COLORS.map((c) => (
                    <button
                      key={c} type="button" aria-label={`Thread colour ${c}`} onClick={() => patch(selectedThread.id, { props: { color: c } }, true)}
                      className="grid h-11 w-9 place-items-center border-0 bg-transparent"
                    >
                      <span className="h-6 w-6 rounded-full" style={{ background: c, boxShadow: selectedThread.props.color === c ? `0 0 0 2px #fff, 0 0 0 3.5px ${c}` : 'none' }} />
                    </button>
                  ))}
                  <CustomColor value={selectedThread.props.color} listed={THREAD_COLORS.includes(selectedThread.props.color)} accent="#17171a" onPick={(c) => patch(selectedThread.id, { props: { color: c } }, true)} cell="h-11 w-9" dot={24} />
                  <button
                    type="button" aria-label="Remove thread" onClick={() => { commit((l) => l.filter((x) => x.id !== selectedThread.id)); setSelectedId(null) }}
                    className="grid h-11 w-11 place-items-center border-0 bg-transparent text-[#d6455d]"
                  >
                    <span className="[&_svg]:h-[22px] [&_svg]:w-[22px]"><IcTrash /></span>
                  </button>
                </motion.div>
              )
            })()}

            {groupFrame && !drawing && (
              <div className="pointer-events-none absolute rounded-md" style={{ left: groupFrame.l - 6, top: groupFrame.t - 6, width: groupFrame.r - groupFrame.l + 12, height: groupFrame.b - groupFrame.t + 12, border: `1.5px dashed ${accent}`, zIndex: 8400 }}>
                <button
                  type="button" data-ui aria-label="Lock the pieces together" onClick={() => lockGroup(selected!.groupId!)} onPointerDown={(e) => e.stopPropagation()}
                  className="pointer-events-auto absolute -top-4 left-2 flex h-8 items-center gap-1.5 rounded-full border-0 bg-white pl-1.5 pr-3 text-[12px] font-extrabold text-[#17171a]"
                  style={{ boxShadow: '0 2px 8px rgba(20,24,40,.22), 0 0 0 1px rgba(20,24,40,.05)', transform: `scale(${1 / zoom})`, transformOrigin: 'left center' }}
                ><IcLock /> Lock</button>
              </div>
            )}
            {selected && actions && !drawing && editingId !== selected.id && draggingId !== selected.id && (
              <SelectionOverlay item={selected} canvasW={canvasW} topLimit={((scroller.current?.scrollTop ?? 0) + 8) / zoom} accent={accent} actions={actions} hideToolbar={!!sheet} zoom={zoom} locked={isBg(selected)} connecting={!!connectFrom} grouping={!!groupFrom} />
            )}
            {selected && actions && draggingId === selected.id && (
              <SelectionOverlay item={selected} canvasW={canvasW} topLimit={-9999} accent={accent} actions={{ ...actions, onFrame: undefined, onEdit: undefined }} hideToolbar zoom={zoom} locked={isBg(selected)} />
            )}

            {/* a background does not catch taps; its tab is how to pick it up */}
            {!drawing && !readOnly && vItems.filter((i) => isBg(i) && i.id !== selectedId).map((i) => (
              <button
                key={`bgtab${i.id}`} type="button" data-ui aria-label="Select the background" onClick={() => setSelectedId(i.id)}
                className="absolute flex h-8 items-center gap-1.5 rounded-full border-0 bg-white/90 px-3 text-[12px] font-bold text-[#17171a] shadow-[0_2px_8px_rgba(20,24,40,.25)]"
                style={{ left: 8, top: i.y - i.height / 2 + 8, zIndex: 8700, transform: `scale(${1 / zoom})`, transformOrigin: 'top left' }}
              >
                <ImageIcon size={14} /> Background
              </button>
            ))}


            {cv.loaded && items.length === 0 && !drawing && (
              <div className="pointer-events-none absolute inset-x-0 top-[180px] px-10 text-center">
                <div className="text-[44px]">{theme.emoji}</div>
                <p className="m-0 mt-2 text-[15px] font-semibold text-neutral-500">A blank page. Add photos, stickers, notes and doodles with the toolbar {desk ? 'on the left' : 'below'}. You can also drop pictures here from your computer.</p>
              </div>
            )}
          </div>
          </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {textStudio && <TextStudio key="text" seed={textStudio.seed} boxW={textStudio.boxW} palette={theme.palette} accent={accent} look={rc} onDone={finishText} onCancel={() => setTextStudio(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {drawing && <DrawStudio key="draw" seed={editDrawId ? (() => { const it = items.find((x) => x.id === editDrawId); return it && it.type === 'draw' ? { draw: it.props, scale: it.width / it.props.w } : undefined })() : undefined} palette={theme.palette} accent={accent} look={rc} onDone={(strokes, w) => addDrawing(strokes, w)} />}
      </AnimatePresence>

      <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = '' }} />

      <AnimatePresence>
        {busy && (
          <motion.div
            className="fixed inset-0 z-[75] grid place-items-center bg-black/30 backdrop-blur-[2px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} role="status" aria-live="polite"
          >
            <motion.div
              className="flex w-[240px] flex-col items-center gap-3 rounded-3xl bg-white px-6 py-7 shadow-2xl"
              initial={{ scale: 0.9, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
            >
              <Loader2 size={30} className="animate-spin" style={{ color: accent }} />
              <div className="text-[15px] font-extrabold">{busy.label ?? (busy.total === 1 ? 'Adding photo…' : 'Adding photos…')}</div>
              {busy.total > 1 && (
                <>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                    <div className="h-full rounded-full transition-[width] duration-300" style={{ width: `${(busy.done / busy.total) * 100}%`, background: accent }} />
                  </div>
                  <div className="text-[12.5px] font-semibold text-neutral-400">{Math.min(busy.done + 1, busy.total)} of {busy.total}</div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={slotInput} type="file" accept="image/*" multiple hidden onChange={(e) => { void fillSlots(e.target.files); e.target.value = '' }} />

      <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { void addPhotos(e.target.files); e.target.value = '' }} />

      <AnimatePresence>
        {cameraOpen && (
          <CameraCapture
            key="camera"
            onClose={() => setCameraOpen(false)}
            onDone={(files) => { setCameraOpen(false); void addPhotos(files) }}
            onFallback={() => { setCameraOpen(false); window.setTimeout(() => cameraInput.current?.click(), 150) }}
          />
        )}
      </AnimatePresence>

      <input ref={replaceInput} type="file" accept="image/*" hidden onChange={(e) => { void replacePhoto(e.target.files?.[0]); e.target.value = '' }} />

      <ToolSheet open={!!drivePrompt} onClose={() => void answerPrompt(false)} title="Keep the originals?" snaps={[0.5]} z={80}>
        {drivePrompt && (
          <div className="space-y-4 px-6 pb-4 text-center">
            <div className="text-[44px]">☁️</div>
            <p className="m-0 text-[15px] leading-relaxed text-neutral-600">
              This book has <b>{drivePrompt.count}</b> full-quality {drivePrompt.count === 1 ? 'photo' : 'photos'}
              {drivePrompt.bytes > 0 && <> (about {Math.max(1, Math.round(drivePrompt.bytes / 1048576))} MB)</>}.
              Want a copy of each in <b>your own Google Drive</b>? You can open the book right now either way. They save quietly in the background.
            </p>
            <button type="button" onClick={() => void answerPrompt(true)}
              className="h-13 min-h-12 w-full rounded-full border-0 bg-[#17171a] text-[15px] font-semibold text-white">Save to my Drive</button>
            <button type="button" onClick={() => void answerPrompt(false)}
              className="h-11 w-full rounded-full border-0 bg-transparent text-[14.5px] font-bold text-neutral-500">Not now</button>
          </div>
        )}
      </ToolSheet>

      <AnimatePresence>
        {viewer && <Lightbox key="viewer" memoryId={memory.id} getOriginal={(p) => loadOriginalBlob(memory.id, p, user?.uid)} images={viewer.images} start={viewer.start} onClose={() => setViewer(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {!desk && Math.abs(zoom - 1) > 0.001 && !drawing && !story && (
          <motion.div
            key="zoom" data-ui className="fixed z-40 flex items-center rounded-full bg-white p-1"
            style={{ right: desk ? 20 : 12, bottom: desk ? 20 : 'calc(var(--safe-bottom) + 96px)', boxShadow: '0 6px 22px rgba(20,24,40,.2), 0 0 0 1px rgba(20,24,40,.05)' }}
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
          >
            {desk && <button type="button" aria-label="Zoom out" onClick={() => applyZoom(zoom - 0.1)} className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-[20px] font-bold text-[#17171a] hover:bg-neutral-100">−</button>}
            <button type="button" aria-label="Fit to width" onClick={() => applyZoom(1)} className="flex h-10 items-center gap-2 rounded-full border-0 bg-transparent px-3 text-[13px] font-extrabold text-[#17171a] hover:bg-neutral-100">
              {Math.round(zoom * 100)}% {Math.abs(zoom - 1) > 0.001 && <span className="font-semibold text-neutral-400">Fit to width</span>}
            </button>
            {desk && <button type="button" aria-label="Zoom in" onClick={() => applyZoom(zoom + 0.1)} className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-[20px] font-bold text-[#17171a] hover:bg-neutral-100">+</button>}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {groupFrom && (
          <motion.div
            key="group-hint" data-ui className="fixed left-1/2 z-40 flex w-max max-w-[94vw] items-center gap-3 whitespace-nowrap rounded-full bg-white py-1.5 pl-4 pr-1.5 text-[13.5px] font-bold text-[#17171a] shadow-[0_10px_28px_rgba(20,24,40,.25),0_0_0_1px_rgba(20,24,40,.06)]"
            style={{ top: 'calc(var(--safe-top) + 138px)', x: '-50%' }}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          >
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#4F7BFF]" />
            Tap another item to group it
            <button type="button" onClick={() => setGroupFrom(null)} className="h-9 rounded-full border-0 bg-neutral-100 px-3.5 text-[13px] font-bold text-[#17171a]">Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {connectFrom && (
          <motion.div
            key="thread-hint" data-ui className="fixed left-1/2 z-40 flex w-max max-w-[94vw] items-center gap-3 whitespace-nowrap rounded-full bg-white py-1.5 pl-4 pr-1.5 text-[13.5px] font-bold text-[#17171a] shadow-[0_10px_28px_rgba(20,24,40,.25),0_0_0_1px_rgba(20,24,40,.06)]"
            style={{ top: 'calc(var(--safe-top) + 138px)', x: '-50%' }}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
          >
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-[#F97316]" />
            Tap another item to tie the thread
            <button type="button" onClick={() => setConnectFrom(null)} className="h-9 rounded-full border-0 bg-neutral-100 px-3.5 text-[13px] font-bold text-[#17171a]">Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>

      {desk && (
        <>
          <DeskBar
            title={memory.title} from={theme.palette[0]} to={theme.palette[1] ?? theme.palette[0]} readOnly={readOnly}
            canUndo={cv.canUndo} canRedo={cv.canRedo} onUndo={cv.undo} onRedo={cv.redo} saving={cv.status === 'saving'} here={here}
            mode={story ? 'story' : printMode ? 'print' : 'edit'}
            onBack={onBack} onTitle={() => { if (!readOnly) onEdit() }}
            files={[
              ...(!readOnly ? [{ label: 'Edit book', icon: <IcEdit />, onClick: onEdit }, { label: 'Change theme', icon: <IcPalette />, onClick: onTheme }] : []),
              { label: 'Share', icon: <IcShare />, onClick: onShare },
              ...(user ? [{ label: 'People', icon: <IcPeople />, onClick: () => setPeopleOpen(true) }, { label: memory.e2ee ? 'Private book' : 'Privacy', icon: <IcLock />, onClick: () => setPrivacyOpen(true) }] : []),
              { label: 'Download book', icon: <IcDownload />, onClick: () => void downloadBook() },
              ...(!readOnly ? [{ label: 'Delete', icon: <IcTrash />, onClick: onDelete, danger: true }] : []),
            ] as FileItem[]}
            onShare={onShare}
            onStory={() => { if (!story && !printMode) enterStory() }}
            onPrint={() => { if (!story && !printMode) enterPrint() }}
            modeSize={story ? ratioLabel(size) : printSize.name.replace('Scrapbook ', '').replace('Photo ', '')}
            onModeSize={() => (story ? setSizeOpen(true) : setPrintSizeOpen(true))}
            onModeDone={() => (story ? setStoryPreview(true) : setPrintExportOpen(true))}
            onModeClose={story ? leaveStory : leavePrint}
            onFit={fitToPages}
          />
          {!readOnly && !story && !printMode && (
            <DeskRail
              active={sheet === 'sticker' ? 'sticker' : sheet === 'templates' ? 'templates' : textStudio ? 'text' : styleOpen ? 'canvas' : sheet === 'location' ? 'location' : null}
              onTool={(t) => { if ((t === 'sticker' && sheet === 'sticker') || (t === 'templates' && sheet === 'templates')) closeSheet(); else if (t === 'canvas' && styleOpen) setStyleOpen(false); else onTool(t) }}
            />
          )}
          {!drawing && !textStudio && <DeskFoot
            left={<>{photoCount} {photoCount === 1 ? 'Photo' : 'Photos'} <span className="mx-1">•</span> {formatDate(memory.date)}</>}
            zoom={zoom} zmin={ZMIN} zmax={ZMAX} onZoom={(z) => applyZoom(z)} accent={accent}
          />}
        </>
      )}

      <BottomToolbar visible={!sheet && !editingId && !readOnly && !desk} inStory={story || printMode} accent={accent} onTool={onTool} />
      <CanvasStyleSheet open={styleOpen} onClose={() => setStyleOpen(false)} memory={memory} value={cstyle} onChange={changeStyle} onHeight={(h) => setSheetHs((s) => ({ ...s, style: h }))} />
      {user && <PeopleSheet open={peopleOpen} onClose={() => setPeopleOpen(false)} memory={memory} />}
      <StoryPreview open={storyPreview} onClose={() => setStoryPreview(false)} memory={memory} accent={accent} getItems={() => itemsRef.current} frameY={storyY} canvasW={canvasW} size={size} />
      <PrintSizeSheet open={printSizeOpen} onClose={() => setPrintSizeOpen(false)} size={printSize} landscape={printPick.landscape} onPick={pickPrint} accent={accent} />
      <PrintExportSheet open={printExportOpen} onClose={() => setPrintExportOpen(false)} memory={memory} accent={accent} getItems={() => withBackground(itemsRef.current, canvasW)} y0={printY} pageCount={printUsed} canvasW={canvasW} size={printSize} landscape={printPick.landscape} />
      <SizeSheet open={sizeOpen} onClose={() => setSizeOpen(false)} value={size} onPick={pickSize} accent={accent} />

      {/* ---- tool sheets ---- */}
      <ToolSheet
        open={sheet === 'frame' && !!photoItem} onClose={closeSheet} title="Frame" snaps={[0.5, 0.88]} initialSnap={1} dim={0.18} z={55}
        onVisibleHeight={(h) => setSheetHs((s) => ({ ...s, frame: h }))}
      >
        {photoItem && (
          <FramePicker
            photo={photoItem.props} width={photoItem.width} accent={accent} focusCaption={captionFocus}
            onFrame={(frame) => patch(photoItem.id, { height: frameHeight(frame, photoItem.width, photoItem.props.aspect, photoItem.props.caption), props: { frame } })}
            onRadius={(radius) => patch(photoItem.id, { props: { radius } })}
            onCaption={(caption) => patch(photoItem.id, { height: frameHeight(photoItem.props.frame, photoItem.width, photoItem.props.aspect, caption), props: { caption } })}
            onReplace={() => replaceInput.current?.click()}
            onBackground={setAsBackground}
            onOriginal={photoItem.props.original || photoItem.props.originalId ? () => void saveOriginal(photoItem.props) : undefined}
          />
        )}
      </ToolSheet>

      <PrivacySheet open={privacyOpen} onClose={() => setPrivacyOpen(false)} memory={memory} accent={accent} />

      <TemplateSheet open={sheet === 'templates'} onClose={closeSheet} accent={accent} themeId={memory.themeId} onPick={addTemplate} onFrame={(k) => addCollage(k)} onLine={() => { closeSheet(); addLine() }} />

      <ToolSheet
        open={sheet === 'collage' && !!collageItem} onClose={closeSheet} title="Photo frame" snaps={[0.56, 0.88]} dim={0.18} z={55}
        onVisibleHeight={(h) => setSheetHs((s) => ({ ...s, collage: h }))}
      >
        {collageItem && (
          <CollageEditor
            value={collageItem.props} accent={accent}
            onChange={(p) => patch(collageItem.id, { props: p })}
            onPick={(i) => { slotTarget.current = { id: collageItem.id, index: i }; slotInput.current?.click() }}
            onBackground={COLLAGES[collageItem.props.kind]?.group === 'grids' ? setCollageBackground : undefined}
          />
        )}
      </ToolSheet>

      <ToolSheet
        open={sheet === 'bubble' && !!bubbleItem} onClose={closeSheet} title="Chat bubble" snaps={[0.94]} dim={0.32} dock z={55}
        onVisibleHeight={(h) => setSheetHs((s) => ({ ...s, bubble: h }))}
      >
        {bubbleItem && (
          <BubbleEditor value={bubbleItem.props as BubbleProps} accent={accent} box={{ width: bubbleItem.width, height: bubbleItem.height }} onChange={(p) => patch(bubbleItem.id, { props: p, ...(p.shape ? { height: Math.round(bubbleItem.width * (BUBBLE_SHAPES.find((s) => s.id === p.shape)?.ratio ?? 0.72)) } : {}) })} />
        )}
      </ToolSheet>

      <ToolSheet
        open={sheet === 'sticker'} onClose={closeSheet} title="Stickers" snaps={[0.94]} dim={0.18} z={55}
        onVisibleHeight={(h) => setSheetHs((s) => ({ ...s, sticker: h }))}
      >
        <StickerTray accent={accent} onPick={(s) => addSticker(s)} onPickMany={addStickers} onFrame={(k) => addCollage(k)} />
      </ToolSheet>

      <ToolSheet
        open={sheet === 'location'} onClose={() => { setEditMapId(null); closeSheet() }} title="Location" snaps={[0.62, 0.92]} initialSnap={1} dim={0.18} z={55}
        onVisibleHeight={(h) => setSheetHs((s) => ({ ...s, location: h }))}
      >
        <LocationTool key={editMapId ?? 'new'} initial={editMap?.type === 'map' ? editMap.props : undefined} pins={['#3a4150', '#EA4335']} accent={accent} onAdd={addMap} />
      </ToolSheet>

    </motion.div>
    </AssetCtx.Provider>
  )
}
