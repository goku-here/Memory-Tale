import { AnimatePresence, motion, useMotionValue, useTransform, type MotionValue } from 'framer-motion'
import { ArrowLeft, Check, ChevronDown, Clapperboard, Minus, ZoomIn, ZoomOut, Download, Loader2, MoreHorizontal, Palette, PenLine, Redo2, Share2, Trash2, Undo2, Users, X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../data/useAuth'
import { useCanvas } from '../data/useCanvas'
import { uid } from '../lib/id'
import { compressImage } from '../lib/image'
import { uploadOriginal } from '../lib/supabase'
import { connectDrive, driveConfigured, isConnected } from '../lib/drive'
import { discardOriginal, loadOriginalBlob, markForDiscard, missingCopies, prefs, purgeFlagged, queueOriginal, replicateBook, runPendingDiscards, unmarkDiscard } from '../data/originals'
import { reportError } from '../data/sync'
import { downloadBookZip } from '../lib/zipBook'
import { AssetCtx } from '../lib/assets'
import { bookEase, clipAt } from '../lib/bookTransition'
import { clamp, cloneItem, frameHeight, nextZ, rnd } from '../lib/items'
import { placeInOrder } from '../lib/layout'
import { useGestures } from '../lib/useGestures'
import { tour, tourSeen } from '../lib/tour'
import type { Guides } from '../lib/snap'
import { frameHeightFor, getSize, ratioLabel, type StorySize } from '../lib/storySizes'
import type { PhotoProps, BubbleProps, CanvasItem, FrameId, ItemPatch, MapProps, Stroke, StickerProps, TextProps } from '../types'
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
import { BubbleEditor } from './Bubble'
import { CameraCapture } from './CameraCapture'
import { Lightbox, type ViewerImage } from './Lightbox'
import { ToolSheet as Sheet } from './ToolSheet'
import { LocationTool } from './LocationTool'
import { PeopleSheet } from './PeopleSheet'
import { SizeSheet, StoryOverlay, StoryPreview } from './StoryMode'
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
  /** while the book opens/closes the canvas shows through a window shaped like the book */
  reveal?: { p: MotionValue<number>; rect: DOMRect }
}

type Sheet = 'frame' | 'sticker' | 'text' | 'draw' | 'location' | 'bubble' | null

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
/** smallest zoom: 40% shows two and a half screens at once. 1 = fit to width (the largest, so the canvas never scrolls sideways). */
const ZMIN = 0.4
/** phones open photos with a tap; the expand button is only for mouse users */
const hasMouse = () => typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches && !window.matchMedia('(pointer: coarse)').matches

export function Canvas({ memory, onBack, onEdit, onTheme, onShare, onDelete, reveal }: CanvasProps) {
  const theme = getTheme(memory.themeId)
  const accent = theme.palette[0]
  const scroller = useRef<HTMLDivElement>(null)
  const surface = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)
  const scrollY = useMotionValue(0)
  const { user } = useAuth()
  const cv = useCanvas(memory.id, user?.uid)
  const { items, itemsRef, height, commit, live, begin, end, setHeight } = cv
  const heightRef = useRef(height)
  heightRef.current = height

  const [menu, setMenu] = useState(false)
  const [story, setStory] = useState(false)
  const [zoom, setZoomState] = useState(1)
  const zoomRef = useRef(1)
  const zoomAnchor = useRef<{ y: number; screenY: number } | null>(null)
  const preStoryZoom = useRef(1)
  const [sizeId, setSizeId] = useState<string | null>(() => { try { return localStorage.getItem(`mt-story-size:${memory.id}`) } catch { return null } })
  const size: StorySize = getSize(sizeId)
  const [sizeOpen, setSizeOpen] = useState(false)
  const [peopleOpen, setPeopleOpen] = useState(false)
  const [guides, setGuides] = useState<Guides | null>(null)
  const [storyPreview, setStoryPreview] = useState(false)
  const [storyY, setStoryYState] = useState(0)
  const storyYRef = useRef(0)
  const setStoryY = useCallback((y: number) => { storyYRef.current = y; setStoryYState(y) }, [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [sheetHs, setSheetHs] = useState<Record<string, number>>({})
  const [canvasW, setCanvasW] = useState(() => Math.min(window.innerWidth, 520))
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
  const slotInput = useRef<HTMLInputElement>(null)
  const slotTarget = useRef<{ id: string; index: number } | null>(null)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [pen, setPen] = useState({ color: accent, size: 6 })
  const sheetH = Math.max(0, ...Object.values(sheetHs))

  selectedIdRef.current = selectedId
  const [scrollRoot, setScrollRoot] = useState<Element | null>(null)
  useEffect(() => { setScrollRoot(scroller.current) }, [])
  const assetCtx = useMemo(() => ({ memoryId: memory.id, root: scrollRoot }), [memory.id, scrollRoot])
  const selected = useMemo(() => items.find((i) => i.id === selectedId && i.type !== 'thread'), [items, selectedId])
  const selectedThread = useMemo(() => items.find((i): i is Extract<CanvasItem, { type: 'thread' }> => i.id === selectedId && i.type === 'thread'), [items, selectedId])
  const visibleItems = useMemo(() => items.filter((i) => i.type !== 'thread'), [items])
  const photoCount = useMemo(() => items.filter((i) => i.type === 'photo').length, [items])
  const drawing = sheet === 'draw'
  const drawingRef = useRef(false)
  drawingRef.current = drawing
  const draggingRef = useRef<string | null>(null)
  draggingRef.current = draggingId

  /** change the zoom, keeping the picked canvas point (`y`) under `screenY` */
  const applyZoom = useCallback((z: number, focal?: { y: number; screenY: number }) => {
    const nz = Math.round(clamp(z, ZMIN, 1) * 1000) / 1000
    const sf = surface.current
    if (!focal && sf) {
      const mid = (HEADER_H + window.innerHeight - 110) / 2
      focal = { y: (mid - sf.getBoundingClientRect().top) / zoomRef.current, screenY: mid }
    }
    zoomAnchor.current = focal ?? null
    if (nz === zoomRef.current) {
      // same zoom: still honour the anchor (scroll to it)
      if (focal && sf && scroller.current) scroller.current.scrollTop = sf.offsetTop + focal.y * nz - focal.screenY
      zoomAnchor.current = null
      return
    }
    zoomRef.current = nz
    setZoomState(nz)
  }, [])
  // once the page has the new size, scroll so the anchor stays where the fingers are
  useLayoutEffect(() => {
    const a = zoomAnchor.current
    const sc = scroller.current
    const sf = surface.current
    zoomAnchor.current = null
    if (a && sc && sf) sc.scrollTop = sf.offsetTop + a.y * zoom - a.screenY
  }, [zoom])

  // pinch with two fingers on the empty canvas, or Ctrl + wheel / trackpad pinch
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let g: { d: number; z: number; y: number } | null = null
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const mid = (t: TouchList) => (t[0].clientY + t[1].clientY) / 2
    const start = (e: TouchEvent) => {
      g = null
      if (e.touches.length !== 2 || drawingRef.current || draggingRef.current) return
      if ([...e.touches].some((t) => (t.target as HTMLElement).closest?.('[data-item],[data-ui]'))) return
      const sf = surface.current
      if (!sf) return
      g = { d: Math.max(1, dist(e.touches)), z: zoomRef.current, y: (mid(e.touches) - sf.getBoundingClientRect().top) / zoomRef.current }
    }
    const move = (e: TouchEvent) => {
      if (!g || e.touches.length !== 2) return
      if (e.cancelable) e.preventDefault()
      applyZoom(g.z * (dist(e.touches) / g.d), { y: g.y, screenY: mid(e.touches) })
    }
    const end = (e: TouchEvent) => { if (e.touches.length < 2) g = null }
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey || drawingRef.current) return
      e.preventDefault()
      const sf = surface.current
      if (!sf) return
      applyZoom(zoomRef.current * Math.exp(-e.deltaY * 0.01), { y: (e.clientY - sf.getBoundingClientRect().top) / zoomRef.current, screenY: e.clientY })
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
    }
  }, [applyZoom])

  const idle = useMotionValue(1)
  const clip = useTransform(reveal?.p ?? idle, (v) => (reveal ? clipAt(reveal.rect, bookEase(v)) : 'none'))
  const titleScale = useTransform(scrollY, [0, 120], [1, 0.82])
  const titleY = useTransform(scrollY, [0, 120], [0, -4])
  const subOpacity = useTransform(scrollY, [0, 80], [1, 0])

  useEffect(() => { scroller.current?.scrollTo(0, 0) }, [])
  useEffect(() => {
    const el = surface.current
    if (!el) return
    const ro = new ResizeObserver(() => { const w = el.offsetWidth; setCanvasW(w); cv.setWidth(w) })
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
    return { x: 50, y: Math.max(160, ((top + bottom) / 2 - r.top) / zoomRef.current) }
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
      window.clearTimeout(viewTimer.current)
    },
  })

  const startItem = (e: React.PointerEvent, id: string) => {
    if (connectFrom) {
      e.preventDefault()
      e.stopPropagation()
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
  const startItemStable = useCallback((e: React.PointerEvent, id: string) => startItemRef.current(e, id), [])
  const onViewSlot = useCallback((id: string, index: number) => {
    openViewer(`${id}#${index}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onSlot = useCallback((id: string, index: number) => { slotTarget.current = { id, index }; slotInput.current?.click() }, [])

  /* ---------- sheets ---------- */

  const closeSheet = useCallback(() => {
    if (sheet === 'draw') finishDrawing()
    else if (sheet === 'text') {
      const it = itemsRef.current.find((i) => i.id === selectedId)
      if (it?.type === 'text' && !it.props.text.trim()) live((l) => l.filter((x) => x.id !== it.id))
      end()
      if (it?.type === 'text' && !it.props.text.trim()) setSelectedId(null)
    } else if (sheet === 'frame' || sheet === 'bubble') end()
    if (sheet === 'frame') tour.emit('frame-close')
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
  const openBubble = () => { begin(); setSheet('bubble') }

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
      const sizes = imgs.map((img) => ({ width: w, height: frameHeight('polaroid', w, img.width / img.height), rotation: Math.round(rnd(-2, 2) * 10) / 10 }))
      // start under the header, at the top of what is visible, then flow downward in selection order
      const r = surface.current!.getBoundingClientRect()
      const startY = Math.max(140, (HEADER_H + 24 - r.top) / zoomRef.current)
      const spots = placeInOrder(sizes, itemsRef.current, canvasW, startY)
      commit((cur) => {
        let z = nextZ(cur)
        return [...cur, ...imgs.map((img, i) => ({
          id: ids[i], type: 'photo' as const, zIndex: z++, width: sizes[i].width, height: sizes[i].height, rotation: sizes[i].rotation,
          x: spots[i].x, y: spots[i].y,
          props: { src: img.dataUrl, thumb: img.thumb, aspect: img.width / img.height, frame: 'polaroid' as FrameId, radius: 4, caption: '', originalId: driveOn ? pids[i] : undefined },
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
        for (let i = 0; i < list.length; i++) void queueOriginal(list[i], memory.id, pids[i])
      } else if (user && !driveConfigured) {
        void (async () => {
          for (let i = 0; i < list.length; i++) {
            const path = await uploadOriginal(list[i], `${user.uid}/${memory.id}`)
            if (path) patch(ids[i], { props: { original: path } })
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
        patch(target.id, { props: { originalId: pid, original: undefined } })
        void queueOriginal(file, memory.id, pid)
      } else if (user && !driveConfigured) void uploadOriginal(file, `${user.uid}/${memory.id}`).then((path) => { if (path) patch(target.id, { props: { original: path } }) })
    } catch {
      toast("Couldn't read that photo")
    }
  }

  const addSticker = (s: StickerProps) => {
    const ratio = stickerRatio(s)
    const w = s.kind === 'emoji' ? 96 : s.kind === 'image' ? 140 : ratio > 2.2 ? 190 : ratio > 1.5 ? 150 : 120
    addItem((z, c) => ({
      id: '', type: 'sticker', zIndex: z, x: c.x + rnd(-14, 14), y: c.y + rnd(-30, 30),
      width: w, height: w / ratio, rotation: Math.round(rnd(-12, 12)), props: s,
    }), { ignoreSheet: true })
    setSheet(null) // close the tray so the new sticker is visible
    tour.emit('sticker-added')
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

  const addMap = (map: MapProps) => {
    if (editMapId) {
      patch(editMapId, { props: { ...map } }, true)
      setEditMapId(null)
      setSheet(null)
      return
    }
    const w = Math.round(clamp(canvasW * 0.78, 240, 340))
    setSheet(null)
    window.setTimeout(() => {
      addItem((z, c) => ({
        id: '', type: 'map', zIndex: z, x: 50, y: c.y, width: w, height: Math.round(w * 0.78),
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
      id: '', type: 'clothesline', zIndex: z, x: 50, y: c.y, width: w, height: Math.round(w * 0.64), rotation: 0,
      props: { photos: ['', '', ''] },
    }))
    slotTarget.current = { id, index: 0 }
    window.setTimeout(() => slotInput.current?.click(), 150)
  }

  const fillSlots = async (files: FileList | null) => {
    const t = slotTarget.current
    if (!files?.length || !t) return
    try {
      const imgs = await Promise.all([...files].slice(0, 3 - t.index).map((f) => compressImage(f, { maxSize: 900, quality: 0.8 })))
      commit((list) => list.map((i) => {
        if (i.id !== t.id || i.type !== 'clothesline') return i
        const photos = [...i.props.photos] as [string, string, string]
        imgs.forEach((m, k) => { photos[t.index + k] = m.dataUrl })
        return { ...i, props: { photos } }
      }))
    } catch {
      toast("Couldn't read that photo")
    }
  }

  const addDivider = () => {
    const n = itemsRef.current.filter((i) => i.type === 'divider').length + 1
    addItem((z, c) => ({
      id: '', type: 'divider', zIndex: z, x: 50, y: c.y, width: Math.round(canvasW * 0.9), height: 44, rotation: 0,
      props: { label: `Stop ${n}`, color: theme.palette[1] ?? accent },
    }))
  }

  /* ---------- story mode: a 9:16 frame over the canvas ---------- */
  const storyKey = `mt-story-y:${memory.id}`
  const enterStory = () => {
    const sc = scroller.current
    const sf = surface.current
    if (!sc || !sf) return
    let y: number | null = null
    try { const v = localStorage.getItem(storyKey); if (v !== null) y = Math.max(0, +v || 0) } catch { /* ignore */ }
    // first time: start at what is on screen now
    if (y === null) y = Math.max(0, (HEADER_H + 10 - sf.getBoundingClientRect().top) / zoomRef.current)
    setStoryY(y)
    setSelectedId(null)
    setStory(true)
    tour.emit('story-open')
    preStoryZoom.current = zoomRef.current
    fitFrame(y, size)
    sc.scrollTo({ top: Math.max(0, sf.offsetTop + y * zoomRef.current - HEADER_H - 10), behavior: 'smooth' })
    try { if (!localStorage.getItem('mt-story-hint')) { localStorage.setItem('mt-story-hint', '1'); toast('Keep titles and faces out of the shaded zones.') } } catch { /* ignore */ }
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
      case 'text': addText(); break
      case 'draw': setStrokes([]); setPen((p) => ({ ...p })); setSheet('draw'); break
      case 'note': addNote(); break
      case 'divider': addDivider(); break
      case 'location': setSheet('location'); break
      case 'bubble': addBubble(); break
      case 'line': addLine(); break
      case 'story': if (!story) enterStory(); break
    }
  }

  /* ---------- selection actions ---------- */

  const reorder = (dir: 1 | -1) => {
    if (!selected) return
    tour.emit('reorder')
    commit((list) => {
      const order = list.filter((x) => x.type !== 'thread').sort((a, b) => a.zIndex - b.zIndex)
      const i = order.findIndex((x) => x.id === selected.id)
      const j = i + dir
      if (j < 0 || j >= order.length) return list
      ;[order[i], order[j]] = [order[j], order[i]]
      const z = new Map(order.map((x, k) => [x.id, k + 1]))
      return list.map((x) => (z.has(x.id) ? { ...x, zIndex: z.get(x.id)! } : x))
    })
  }

  const actions = selected && {
    onHandle: (e: React.PointerEvent, kind: 'resize' | 'rotate') => startHandle(e, selected.id, kind),
    onDuplicate: () => {
      let id = ''
      commit((list) => { const c = cloneItem(selected, nextZ(list)); id = c.id; return [...list, c] })
      setSelectedId(id)
    },
    onDelete: () => { commit((l) => l.filter((x) => x.id !== selected.id && !(x.type === 'thread' && (x.props.a === selected.id || x.props.b === selected.id)))); setSelectedId(null) },
    onConnect: () => { setConnectFrom(selected.id); toast('Tap another item to tie the thread') },
    onForward: () => reorder(1),
    onBackward: () => reorder(-1),
    onView: selected.type === 'photo' && hasMouse() ? () => viewItem(selected.id) : undefined,
    onFrame: selected.type === 'photo' ? () => openFrame() : undefined,
    onColor: selected.type === 'note' ? (color: string) => patch(selected.id, { props: { color } }, true) : undefined,
    onEdit:
      selected.type === 'map' ? () => { setEditMapId(selected.id); setSheet('location') }
      : selected.type === 'text' ? openText
      : selected.type === 'bubble' ? openBubble
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

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    scrollY.set(el.scrollTop)
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
  const textItem = selected?.type === 'text' ? selected : undefined
  const photoItem = selected?.type === 'photo' ? selected : undefined

  return (
    <AssetCtx.Provider value={assetCtx}>
    <motion.div
      className="fixed inset-0 z-40"
      onPointerDownCapture={(e) => { lastPointer.current = e.pointerType; suppressClick.current = false }}
      style={{ ...themeVars(theme), background: theme.canvasBg, pointerEvents: reveal ? 'none' : undefined, clipPath: clip }}
      initial={{ opacity: reveal ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.06 } }}
      transition={{ duration: 0.22 }}
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
                        <MenuItem icon={<PenLine size={18} />} label="Edit book" onClick={run(onEdit)} />
                        <MenuItem icon={<Palette size={18} />} label="Change theme" onClick={run(onTheme)} />
                        <MenuItem icon={<Share2 size={18} />} label="Share" onClick={run(onShare)} />
                        {user && <MenuItem icon={<Users size={18} />} label="People" onClick={run(() => setPeopleOpen(true))} />}
                        <MenuItem icon={zoom < 1 ? <ZoomIn size={18} /> : <ZoomOut size={18} />} label={zoom < 1 ? 'Fit to width' : 'Zoom out'} onClick={run(() => applyZoom(zoom < 1 ? 1 : 0.5))} />
                        <MenuItem icon={<Download size={18} />} label="Download book" onClick={run(() => void downloadBook())} />
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
              {story ? (
                <div className="flex items-center gap-1.5">
                  <motion.button
                    type="button" onClick={() => setStoryPreview(true)} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 460, damping: 28 }}
                    className="flex h-10 items-center gap-1.5 rounded-full border-0 bg-[#17171a] px-4 text-[14px] font-bold text-white"
                  ><Clapperboard size={16} /> Done</motion.button>
                  <motion.button
                    type="button" aria-label="Close story mode" onClick={leaveStory} initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 460, damping: 28 }}
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
              ) : (
                <div className="flex items-center justify-end gap-1 pr-1 text-[12px] font-bold text-neutral-400" role="status" aria-live="polite">
                  {cv.status === 'saving' ? <><Loader2 size={13} className="animate-spin" /> Saving</> : <><Check size={13} strokeWidth={3} /> Saved</>}
                </div>
              )}
            </div>
          </header>

          {/* the infinite canvas surface */}
          <div style={{ height: height * zoom }}>
          <div
            ref={surface}
            className="relative isolate"
            style={{
              height,
              transform: zoom < 1 ? `scale(${zoom})` : undefined, transformOrigin: 'top center',
              backgroundImage: `radial-gradient(${theme.dot} 1.5px, transparent 1.7px)`,
              backgroundSize: '22px 22px',
              touchAction: 'pan-y',
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
                  onSlot={onSlot}
                  onViewSlot={onViewSlot}
                  onItemClick={onItemClick}
                  dragging={draggingId === it.id}
                  editing={editingId === it.id}
                  onPointerDown={startItemStable}
                  onMeasure={onMeasure}
                  onEditText={onEditText}
                  onEditDone={onEditDone}
                />
              ))}
            </AnimatePresence>

            <ThreadsSvg items={items} canvasW={canvasW} selectedId={selectedId} onSelect={setSelectedId} />
            {guides && (
              <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 8600, overflow: 'visible' }} aria-hidden>
                {guides.v.map((l) => <line key={`v${l.x}`} x1={l.x} x2={l.x} y1={l.y1} y2={l.y2} stroke="#ff3d81" strokeWidth={1.25} strokeDasharray="5 4" />)}
                {guides.h.map((l) => <line key={`h${l.y}`} x1={l.x1} x2={l.x2} y1={l.y} y2={l.y} stroke="#ff3d81" strokeWidth={1.25} strokeDasharray="5 4" />)}
              </svg>
            )}
            {story && (
              <StoryOverlay surfaceRef={surface} scrollerRef={scroller} canvasW={canvasW} surfaceH={height} y={storyY} onY={setStoryY} items={items} accent={accent} headerH={HEADER_H} size={size} zoom={zoom} />
            )}
            {selectedThread && !drawing && (() => {
              const m = threadMid(items, selectedThread, canvasW)
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
                  <button
                    type="button" aria-label="Remove thread" onClick={() => { commit((l) => l.filter((x) => x.id !== selectedThread.id)); setSelectedId(null) }}
                    className="grid h-11 w-11 place-items-center border-0 bg-transparent text-[#d6455d]"
                  >
                    <Trash2 size={18} />
                  </button>
                </motion.div>
              )
            })()}

            {selected && actions && !drawing && editingId !== selected.id && draggingId !== selected.id && (
              <SelectionOverlay item={selected} canvasW={canvasW} topLimit={((scroller.current?.scrollTop ?? 0) + 8) / zoom} accent={accent} actions={actions} hideToolbar={!!sheet} zoom={zoom} />
            )}
            {selected && actions && draggingId === selected.id && (
              <SelectionOverlay item={selected} canvasW={canvasW} topLimit={-9999} accent={accent} actions={{ ...actions, onFrame: undefined, onEdit: undefined }} hideToolbar zoom={zoom} />
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
      </div>

      {drawing && (
        <DrawLayer
          surfaceRef={surface} strokes={strokes} color={pen.color} size={pen.size} onChange={setStrokes}
          bottomInset={sheetH} zoom={zoom}
        />
      )}

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
        {zoom < 0.999 && !drawing && !story && (
          <motion.div
            key="zoom" data-ui className="fixed right-3 z-40 flex items-center rounded-full bg-white p-1"
            style={{ bottom: 'calc(var(--safe-bottom) + 96px)', boxShadow: '0 6px 22px rgba(20,24,40,.2), 0 0 0 1px rgba(20,24,40,.05)' }}
            initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
          >
            <button type="button" aria-label="Zoom out" disabled={zoom <= ZMIN + 0.001} onClick={() => applyZoom(zoom - 0.15)} className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-[#17171a] disabled:opacity-30"><Minus size={18} /></button>
            <button type="button" aria-label="Fit to width" onClick={() => applyZoom(1)} className="h-10 min-w-[48px] rounded-full border-0 bg-transparent px-1 text-[13px] font-extrabold text-[#17171a]">{Math.round(zoom * 100)}%</button>
            <button type="button" aria-label="Zoom in" onClick={() => applyZoom(zoom + 0.15)} className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-[#17171a]"><ZoomIn size={18} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomToolbar visible={!sheet && !editingId} inStory={story} accent={accent} onTool={onTool} />
      {user && <PeopleSheet open={peopleOpen} onClose={() => setPeopleOpen(false)} memory={memory} />}
      <StoryPreview open={storyPreview} onClose={() => setStoryPreview(false)} memory={memory} accent={accent} getItems={() => itemsRef.current} frameY={storyY} canvasW={canvasW} size={size} />
      <SizeSheet open={sizeOpen} onClose={() => setSizeOpen(false)} value={size} onPick={pickSize} accent={accent} />

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
            onReplace={() => replaceInput.current?.click()}
            onOriginal={photoItem.props.original || photoItem.props.originalId ? () => void saveOriginal(photoItem.props) : undefined}
          />
        )}
      </ToolSheet>

      <ToolSheet
        open={sheet === 'bubble' && !!bubbleItem} onClose={closeSheet} title="Chat bubble" snaps={[0.58, 0.88]} dim={0.18} z={55}
        onVisibleHeight={(h) => setSheetHs((s) => ({ ...s, bubble: h }))}
      >
        {bubbleItem && (
          <BubbleEditor value={bubbleItem.props as BubbleProps} accent={accent} onChange={(p) => patch(bubbleItem.id, { props: p })} />
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
        open={sheet === 'location'} onClose={() => { setEditMapId(null); closeSheet() }} title="Location" snaps={[0.62, 0.92]} dim={0.18} z={55}
        onVisibleHeight={(h) => setSheetHs((s) => ({ ...s, location: h }))}
      >
        <LocationTool key={editMapId ?? 'new'} initial={editMap?.type === 'map' ? editMap.props : undefined} pins={['#3a4150', '#EA4335']} accent={accent} onAdd={addMap} />
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
    </AssetCtx.Provider>
  )
}
