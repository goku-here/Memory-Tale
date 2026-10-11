import { motion } from 'framer-motion'
import { ArrowLeftRight, Brush, Check, Circle, Eraser, Hand, Loader2, Maximize, Minus, MousePointerClick, Paintbrush, Pentagon, Plus, RectangleHorizontal, Slash, Sparkles, Star, Triangle, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { cleanMask, composite, cutout, exportSticker, removePieceAt, type CutoutResult } from '../lib/cutout'

interface Props {
  file: File
  onClose: () => void
  onSave: (dataUrl: string, ratio: number) => void
}

type Stage = 'model' | 'analyzing' | 'ready' | 'error'
type Tool = 'brush' | 'line' | 'shape' | 'piece' | 'move'
type ShapeKind = 'rect' | 'ellipse' | 'triangle' | 'star' | 'free'
interface Pt { x: number; y: number }
/** a movable cut line: everything on the shaded side is taken away (or brought back) */
interface Cut { a: Pt; b: Pt; flip: boolean }
/** a basic shape that can be moved, resized and turned */
interface Box { cx: number; cy: number; w: number; h: number; rot: number }

const CHECKER = 'conic-gradient(#e6e6ea 25%, #f7f7f9 0 50%, #e6e6ea 0 75%, #f7f7f9 0) 0 0 / 22px 22px'

const TOOLS: { id: Tool; label: string; icon: typeof Brush }[] = [
  { id: 'brush', label: 'Brush', icon: Brush },
  { id: 'line', label: 'Line', icon: Slash },
  { id: 'shape', label: 'Shape', icon: Pentagon },
  { id: 'piece', label: 'Piece', icon: MousePointerClick },
  { id: 'move', label: 'Move', icon: Hand },
]
const SHAPES: { id: ShapeKind; label: string; icon: typeof Circle }[] = [
  { id: 'rect', label: 'Box', icon: RectangleHorizontal },
  { id: 'ellipse', label: 'Circle', icon: Circle },
  { id: 'triangle', label: 'Triangle', icon: Triangle },
  { id: 'star', label: 'Star', icon: Star },
  { id: 'free', label: 'Free', icon: Pentagon },
]
const ZMAX = 8

/** the outline of a basic shape as points, turned and placed */
function shapePoints(kind: ShapeKind, b: Box): Pt[] {
  let local: Pt[] = []
  const hw = b.w / 2, hh = b.h / 2
  if (kind === 'rect') local = [{ x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }]
  else if (kind === 'triangle') local = [{ x: 0, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh }]
  else if (kind === 'ellipse') for (let i = 0; i < 72; i++) { const t = (i / 72) * Math.PI * 2; local.push({ x: Math.cos(t) * hw, y: Math.sin(t) * hh }) }
  else if (kind === 'star') for (let i = 0; i < 10; i++) { const t = -Math.PI / 2 + (i / 10) * Math.PI * 2; const r = i % 2 ? 0.42 : 1; local.push({ x: Math.cos(t) * hw * r, y: Math.sin(t) * hh * r }) }
  const c = Math.cos(b.rot), s = Math.sin(b.rot)
  return local.map((p) => ({ x: b.cx + p.x * c - p.y * s, y: b.cy + p.x * s + p.y * c }))
}
const toLocal = (p: Pt, b: Box): Pt => {
  const dx = p.x - b.cx, dy = p.y - b.cy
  const c = Math.cos(-b.rot), s = Math.sin(-b.rot)
  return { x: dx * c - dy * s, y: dx * s + dy * c }
}
const distToSeg = (p: Pt, a: Pt, b: Pt) => {
  const dx = b.x - a.x, dy = b.y - a.y
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Cut the subject out of a photo, touch it up with brushes, a cut line, basic shapes or outlines, and save it as a sticker. */
export function StickerMaker({ file, onClose, onSave }: Props) {
  const [stage, setStage] = useState<Stage>('model')
  const [progress, setProgress] = useState(0)
  const [mode, setMode] = useState<'erase' | 'restore'>('erase')
  const [tool, setTool] = useState<Tool>('brush')
  const [brush, setBrush] = useState(26)
  const [outline, setOutline] = useState(true)
  const [error, setError] = useState('')
  const [undoCount, setUndoCount] = useState(0)
  const [dims, setDims] = useState({ w: 1, h: 1 })
  const [cut, setCut] = useState<Cut | null>(null)
  const [kind, setKind] = useState<ShapeKind>('rect')
  const [box, setBox] = useState<Box | null>(null)
  const [poly, setPoly] = useState<Pt[]>([])
  const [closed, setClosed] = useState(false)
  const res = useRef<CutoutResult | null>(null)
  const view = useRef<HTMLCanvasElement>(null)
  const history = useRef<ImageData[]>([])
  const drawing = useRef<{ x: number; y: number } | null>(null)
  /** what a finger is dragging right now (a cut line end, the whole line, a shape handle…) */
  const drag = useRef<{ type: string; start: Pt; cut?: Cut; box?: Box } | null>(null)

  /* ---- zoom and move, so small details can be cut accurately ---- */
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const stage_ = useRef<HTMLDivElement>(null)
  const boxEl = useRef<HTMLDivElement>(null)
  const touches = useRef(new Map<number, Pt>())
  const pinch = useRef<{ d: number; z: number; mx: number; my: number; p: Pt } | null>(null)
  /** after a pinch, ignore the finger that is still down until everything is lifted */
  const ignore = useRef(false)
  const panDrag = useRef<{ x: number; y: number; p: Pt } | null>(null)

  const render = useCallback(() => {
    const r = res.current
    const v = view.current
    if (r && v) composite(r.photo, r.mask, v)
  }, [])

  useEffect(() => {
    let alive = true
    cutout(file, (s) => alive && setStage(s), (f) => alive && setProgress(f))
      .then((r) => {
        if (!alive) return
        res.current = r
        const v = view.current
        if (v) { v.width = r.photo.width; v.height = r.photo.height }
        setDims({ w: r.photo.width, h: r.photo.height })
        render()
        setStage('ready')
      })
      .catch((e) => { if (alive) { setError((e as Error).message || 'Something went wrong'); setStage('error') } })
    return () => { alive = false }
  }, [file, render])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])

  const clampPan = (p: Pt, z: number): Pt => {
    const w = boxEl.current?.offsetWidth ?? 0, h = boxEl.current?.offsetHeight ?? 0
    const mx = (z * w - w) / 2 + w * 0.3, my = (z * h - h) / 2 + h * 0.3
    return { x: Math.max(-mx, Math.min(mx, p.x)), y: Math.max(-my, Math.min(my, p.y)) }
  }
  /** change the zoom keeping the point under (mx, my) where it is */
  const zoomAt = (nz: number, mx: number, my: number, from?: { z: number; p: Pt; mx: number; my: number }) => {
    const st = stage_.current?.getBoundingClientRect()
    if (!st) return
    const z0 = from?.z ?? zoom, p0 = from?.p ?? pan
    const z = Math.max(1, Math.min(ZMAX, nz))
    const cx = st.left + st.width / 2, cy = st.top + st.height / 2
    const k = z / z0
    setZoom(z)
    setPan(clampPan({ x: mx - cx - k * ((from?.mx ?? mx) - cx - p0.x), y: my - cy - k * ((from?.my ?? my) - cy - p0.y) }, z))
  }
  const zoomBy = (f: number) => {
    const st = stage_.current?.getBoundingClientRect()
    if (st) zoomAt(zoom * f, st.left + st.width / 2, st.top + st.height / 2)
  }
  const fit = () => { setZoom(1); setPan({ x: 0, y: 0 }) }

  const toCanvas = (e: { clientX: number; clientY: number }) => {
    const v = view.current!
    const r = v.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * v.width, y: ((e.clientY - r.top) / r.height) * v.height, scale: v.width / r.width }
  }

  const snapshot = () => {
    const m = res.current?.mask
    if (!m) return
    history.current.push(m.getContext('2d')!.getImageData(0, 0, m.width, m.height))
    if (history.current.length > 14) history.current.shift()
    setUndoCount(history.current.length)
  }
  const undoSnapshot = () => { history.current.pop(); setUndoCount(history.current.length) }
  const undo = () => {
    const m = res.current?.mask
    const prev = history.current.pop()
    if (!m || !prev) return
    m.getContext('2d')!.putImageData(prev, 0, 0)
    setUndoCount(history.current.length)
    render()
  }

  const onStageDown = (e: React.PointerEvent) => {
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (touches.current.size === 2) {
      // a second finger: this is a pinch, so drop whatever the first finger had started
      if (drawing.current) { drawing.current = null; undo() }
      drag.current = null
      const [a, b] = [...touches.current.values()]
      pinch.current = { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), z: zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, p: pan }
      ignore.current = true
    }
  }
  const onStageMove = (e: React.PointerEvent) => {
    if (!touches.current.has(e.pointerId)) return
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const pc = pinch.current
    if (pc && touches.current.size >= 2) {
      const [a, b] = [...touches.current.values()]
      zoomAt(pc.z * (Math.hypot(a.x - b.x, a.y - b.y) / pc.d), (a.x + b.x) / 2, (a.y + b.y) / 2, pc)
    }
  }
  const onStageUp = (e: React.PointerEvent) => {
    touches.current.delete(e.pointerId)
    if (touches.current.size < 2) pinch.current = null
    if (touches.current.size === 0) ignore.current = false
  }
  const onWheel = (e: React.WheelEvent) => { zoomAt(zoom * Math.exp(-e.deltaY * 0.0018), e.clientX, e.clientY) }

  const stroke = (x: number, y: number, scale: number) => {
    const m = res.current?.mask
    if (!m) return
    const ctx = m.getContext('2d')!
    const r = (brush / 2) * scale
    const last = drawing.current
    ctx.save()
    ctx.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over'
    ctx.fillStyle = ctx.strokeStyle = '#fff'
    ctx.lineWidth = r * 2
    ctx.lineCap = 'round'
    ctx.beginPath()
    if (last) { ctx.moveTo(last.x, last.y); ctx.lineTo(x, y); ctx.stroke() }
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    drawing.current = { x, y }
    render()
  }

  /** a ruler line: keeps to 0, 45 or 90 degrees when you are close to them */
  const straighten = (a: Pt, p: Pt): Pt => {
    const dx = p.x - a.x, dy = p.y - a.y
    const len = Math.hypot(dx, dy)
    if (len < 8) return p
    const ang = Math.atan2(dy, dx)
    const step = Math.PI / 4
    const near = Math.round(ang / step) * step
    if (Math.abs(ang - near) < (5 * Math.PI) / 180) return { x: a.x + Math.cos(near) * len, y: a.y + Math.sin(near) * len }
    return p
  }

  /** applies a filled outline to the mask: erase it, restore it, or keep only what is inside */
  const applyOutline = (pts: Pt[], op: 'erase' | 'keep' | 'restore') => {
    const m = res.current?.mask
    if (!m || pts.length < 3) return
    snapshot()
    const ctx = m.getContext('2d')!
    const trace = (c: CanvasRenderingContext2D) => { c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath() }
    if (op === 'keep') {
      const tmp = document.createElement('canvas')
      tmp.width = m.width
      tmp.height = m.height
      const t = tmp.getContext('2d')!
      t.fillStyle = '#fff'
      trace(t)
      t.fill()
      ctx.save()
      ctx.globalCompositeOperation = 'destination-in'
      ctx.drawImage(tmp, 0, 0)
      ctx.restore()
    } else {
      ctx.save()
      ctx.globalCompositeOperation = op === 'erase' ? 'destination-out' : 'source-over'
      ctx.fillStyle = '#fff'
      trace(ctx)
      ctx.fill()
      ctx.restore()
    }
    render()
  }

  /** the half of the picture on the cut line's shaded side, as a big polygon */
  const shadedSide = (c: Cut): Pt[] => {
    const dx = c.b.x - c.a.x, dy = c.b.y - c.a.y
    const len = Math.hypot(dx, dy) || 1
    const d = { x: dx / len, y: dy / len }
    const n = { x: -d.y * (c.flip ? -1 : 1), y: d.x * (c.flip ? -1 : 1) }
    const far = (dims.w + dims.h) * 3
    return [
      { x: c.a.x - d.x * far, y: c.a.y - d.y * far }, { x: c.b.x + d.x * far, y: c.b.y + d.y * far },
      { x: c.b.x + d.x * far + n.x * far, y: c.b.y + d.y * far + n.y * far }, { x: c.a.x - d.x * far + n.x * far, y: c.a.y - d.y * far + n.y * far },
    ]
  }

  const newBox = (k: ShapeKind) => setBox({ cx: dims.w / 2, cy: dims.h / 2, w: dims.w * 0.45, h: k === 'rect' ? dims.h * 0.4 : dims.w * 0.45, rot: 0 })
  const chooseShape = (k: ShapeKind) => {
    setKind(k)
    setPoly([]); setClosed(false)
    if (k === 'free') setBox(null)
    else newBox(k)
  }
  const outlinePoints = (): Pt[] => (kind === 'free' ? poly : box ? shapePoints(kind, box) : [])

  const down = (e: React.PointerEvent) => {
    if (stage !== 'ready' || !res.current || ignore.current || touches.current.size > 1) return
    if (tool === 'move') {
      e.currentTarget.setPointerCapture(e.pointerId)
      panDrag.current = { x: e.clientX, y: e.clientY, p: pan }
      return
    }
    const p = toCanvas(e)
    const pt = { x: p.x, y: p.y }
    const near = 26 * p.scale
    if (tool === 'piece') {
      snapshot()
      if (removePieceAt(res.current.mask, p.x, p.y)) render()
      else undoSnapshot()
      return
    }
    if (tool === 'line') {
      e.currentTarget.setPointerCapture(e.pointerId)
      if (cut && Math.hypot(pt.x - cut.a.x, pt.y - cut.a.y) < near) drag.current = { type: 'a', start: pt, cut }
      else if (cut && Math.hypot(pt.x - cut.b.x, pt.y - cut.b.y) < near) drag.current = { type: 'b', start: pt, cut }
      else if (cut && distToSeg(pt, cut.a, cut.b) < near * 0.8) drag.current = { type: 'move', start: pt, cut }
      else { drag.current = { type: 'new', start: pt }; setCut({ a: pt, b: pt, flip: false }) }
      return
    }
    if (tool === 'shape') {
      if (kind === 'free') {
        if (closed) return
        const first = poly[0]
        if (first && poly.length >= 3 && Math.hypot(pt.x - first.x, pt.y - first.y) < 20 * p.scale) { setClosed(true); return }
        setPoly((l) => [...l, pt])
        return
      }
      if (!box) return
      e.currentTarget.setPointerCapture(e.pointerId)
      const l = toLocal(pt, box)
      const rotH = { x: 0, y: -box.h / 2 - 34 * p.scale }
      if (Math.hypot(l.x - rotH.x, l.y - rotH.y) < near) drag.current = { type: 'rot', start: pt, box }
      else if ([[-1, -1], [1, -1], [1, 1], [-1, 1]].some(([sx, sy]) => Math.hypot(l.x - sx * box.w / 2, l.y - sy * box.h / 2) < near)) drag.current = { type: 'corner', start: pt, box }
      else if (Math.abs(l.x) <= box.w / 2 + near * 0.3 && Math.abs(l.y) <= box.h / 2 + near * 0.3) drag.current = { type: 'move', start: pt, box }
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    snapshot()
    drawing.current = null
    stroke(p.x, p.y, p.scale)
  }
  const move = (e: React.PointerEvent) => {
    if (ignore.current || touches.current.size > 1) return
    if (!(e.buttons & 1) && e.pointerType === 'mouse') return
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return
    if (tool === 'move') {
      const d = panDrag.current
      if (d) setPan(clampPan({ x: d.p.x + e.clientX - d.x, y: d.p.y + e.clientY - d.y }, zoom))
      return
    }
    const p = toCanvas(e)
    const pt = { x: p.x, y: p.y }
    const d = drag.current
    if (tool === 'line' && d) {
      if (d.type === 'new') setCut((c) => (c ? { ...c, b: straighten(d.start, pt) } : c))
      else if (d.cut) {
        const c0 = d.cut
        if (d.type === 'a') setCut({ ...c0, a: straighten(c0.b, pt) })
        else if (d.type === 'b') setCut({ ...c0, b: straighten(c0.a, pt) })
        else { const dx = pt.x - d.start.x, dy = pt.y - d.start.y; setCut({ ...c0, a: { x: c0.a.x + dx, y: c0.a.y + dy }, b: { x: c0.b.x + dx, y: c0.b.y + dy } }) }
      }
      return
    }
    if (tool === 'shape' && d?.box) {
      const b0 = d.box
      if (d.type === 'move') setBox({ ...b0, cx: b0.cx + pt.x - d.start.x, cy: b0.cy + pt.y - d.start.y })
      else if (d.type === 'rot') setBox({ ...b0, rot: Math.atan2(pt.y - b0.cy, pt.x - b0.cx) + Math.PI / 2 })
      else if (d.type === 'corner') { const l = toLocal(pt, b0); setBox({ ...b0, w: Math.max(24, Math.abs(l.x) * 2), h: Math.max(24, Math.abs(l.y) * 2) }) }
      return
    }
    if (tool === 'brush') stroke(p.x, p.y, p.scale)
  }
  const up = () => {
    drawing.current = null
    panDrag.current = null
    const d = drag.current
    drag.current = null
    if (tool === 'line' && d?.type === 'new') setCut((c) => (c && Math.hypot(c.b.x - c.a.x, c.b.y - c.a.y) < 14 ? null : c))
  }

  const tidy = () => {
    const m = res.current?.mask
    if (!m) return
    snapshot()
    cleanMask(m)
    render()
  }

  const save = () => {
    const r = res.current
    if (!r) return
    const out = exportSticker(r.photo, r.mask)
    if (!out) { setError('Nothing is left of the picture. Use Restore to bring some back.'); return }
    onSave(out.dataUrl, out.ratio)
  }

  const busy = stage === 'model' || stage === 'analyzing'
  const k = view.current && view.current.getBoundingClientRect().width ? view.current.width / view.current.getBoundingClientRect().width : 1
  const tint = mode === 'erase' ? '#ff4d6d' : '#34d399'
  const showBrushSize = tool === 'brush'
  const pts = outlinePoints()
  const shapeReady = tool === 'shape' && (kind === 'free' ? closed : !!box)
  const pathOf = (l: Pt[]) => `${l.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join('')}${l.length > 2 ? 'Z' : ''}`

  return (
    <motion.div
      role="dialog" aria-modal aria-label="Make a sticker"
      className="fixed inset-0 z-[95] flex flex-col bg-[#101014] text-white"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
    >
      <header className="flex items-center justify-between px-3" style={{ paddingTop: 'calc(var(--safe-top) + 10px)' }}>
        <button type="button" aria-label="Cancel" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/10 text-white"><X size={21} /></button>
        <div className="text-[16px] font-extrabold">Make a sticker</div>
        <motion.button
          type="button" whileTap={{ scale: 0.95 }} onClick={save} disabled={stage !== 'ready'}
          className="flex h-11 items-center gap-1.5 rounded-full border-0 bg-white px-4 text-[14.5px] font-semibold text-[#17171a] disabled:opacity-30"
        >
          <Check size={17} strokeWidth={3} /> Add
        </motion.button>
      </header>

      <div
        ref={stage_} className="relative grid min-h-0 flex-1 touch-none place-items-center overflow-hidden px-4 py-3"
        onPointerDownCapture={onStageDown} onPointerMoveCapture={onStageMove} onPointerUpCapture={onStageUp} onPointerCancelCapture={onStageUp} onWheel={onWheel}
      >
        <div
          ref={boxEl} className="relative max-h-full max-w-full"
          style={{ background: CHECKER, borderRadius: 14, visibility: stage === 'ready' ? 'visible' : 'hidden', transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: 'center', willChange: 'transform' }}
        >
          <canvas
            ref={view}
            className="block max-h-[50vh] max-w-full touch-none select-none"
            style={{ cursor: tool === 'piece' ? 'pointer' : tool === 'move' ? 'grab' : 'crosshair', background: 'transparent', filter: outline ? 'url(#mt-outline)' : undefined }}
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          />
          {/* the cut line, shapes and outlines, in the picture's own coordinates */}
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden" viewBox={`0 0 ${dims.w} ${dims.h}`} preserveAspectRatio="none" aria-hidden>
            {tool === 'line' && cut && (
              <>
                <path d={pathOf(shadedSide(cut))} fill={tint} fillOpacity=".28" />
                <line x1={cut.a.x} y1={cut.a.y} x2={cut.b.x} y2={cut.b.y} stroke="#101014" strokeOpacity=".5" strokeWidth={5 * k} strokeLinecap="round" />
                <line x1={cut.a.x} y1={cut.a.y} x2={cut.b.x} y2={cut.b.y} stroke="#fff" strokeWidth={2.6 * k} strokeLinecap="round" />
                {[cut.a, cut.b].map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={11 * k} fill="#fff" stroke="#101014" strokeWidth={2 * k} />)}
              </>
            )}
            {tool === 'shape' && pts.length > 0 && (
              <>
                <path d={pathOf(pts)} fill={shapeReady ? tint : 'none'} fillOpacity=".26" stroke="#fff" strokeWidth={2.6 * k} strokeLinejoin="round" />
                <path d={pathOf(pts)} fill="none" stroke={tint} strokeWidth={1.4 * k} strokeDasharray={`${6 * k} ${5 * k}`} strokeLinejoin="round" />
                {kind === 'free' && poly.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r={(i === 0 && poly.length >= 3 && !closed ? 10 : 6) * k} fill={i === 0 ? tint : '#fff'} stroke="#101014" strokeWidth={1.5 * k} />)}
                {kind !== 'free' && box && (() => {
                  const c = Math.cos(box.rot), s = Math.sin(box.rot)
                  const at = (x: number, y: number): Pt => ({ x: box.cx + x * c - y * s, y: box.cy + x * s + y * c })
                  const rot = at(0, -box.h / 2 - 34 * k), top = at(0, -box.h / 2)
                  return (
                    <>
                      <line x1={top.x} y1={top.y} x2={rot.x} y2={rot.y} stroke="#fff" strokeWidth={2 * k} />
                      <circle cx={rot.x} cy={rot.y} r={10 * k} fill="#fff" stroke="#101014" strokeWidth={2 * k} />
                      {[[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy], i) => { const q = at(sx * box.w / 2, sy * box.h / 2); return <circle key={i} cx={q.x} cy={q.y} r={10 * k} fill="#fff" stroke="#101014" strokeWidth={2 * k} /> })}
                    </>
                  )
                })()}
              </>
            )}
          </svg>
        </div>

        {stage === 'ready' && (
          <div className="absolute bottom-3 right-3 z-10 flex items-center rounded-full bg-black/55 p-1 backdrop-blur" onPointerDown={(e) => e.stopPropagation()}>
            <button type="button" aria-label="Zoom out" disabled={zoom <= 1.001} onClick={() => zoomBy(1 / 1.5)} className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-white disabled:opacity-30"><Minus size={18} /></button>
            <button type="button" aria-label="Fit the picture" onClick={fit} className="flex h-10 min-w-[52px] items-center justify-center gap-1 rounded-full border-0 bg-transparent px-1 text-[12.5px] font-extrabold text-white">{zoom > 1.001 ? `${Math.round(zoom * 100)}%` : <Maximize size={15} />}</button>
            <button type="button" aria-label="Zoom in" disabled={zoom >= ZMAX - 0.001} onClick={() => zoomBy(1.5)} className="grid h-10 w-10 place-items-center rounded-full border-0 bg-transparent text-white disabled:opacity-30"><Plus size={18} /></button>
          </div>
        )}

        {busy && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex w-[260px] flex-col items-center gap-3 rounded-3xl bg-white/10 px-6 py-7 text-center backdrop-blur">
              <Loader2 size={30} className="animate-spin" />
              <div className="text-[15px] font-extrabold">{stage === 'model' ? 'Getting the cut-out tool ready…' : 'Finding your subject…'}</div>
              {stage === 'model' && (
                <>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-white transition-[width] duration-200" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
                  <div className="text-[12px] text-white/60">One-time download, about 19 MB. Your photo stays on this phone.</div>
                </>
              )}
            </div>
          </div>
        )}

        {stage === 'error' && (
          <div className="absolute inset-0 grid place-items-center px-8 text-center">
            <div>
              <div className="text-4xl">😕</div>
              <p className="mx-auto my-3 max-w-[280px] text-[14.5px] leading-snug text-white/80">{error || 'We could not cut that out.'}</p>
              <button type="button" onClick={onClose} className="h-11 rounded-full border-0 bg-white px-6 text-[14.5px] font-semibold text-[#17171a]">Close</button>
            </div>
          </div>
        )}
        {stage === 'ready' && error && <p role="alert" className="absolute bottom-2 m-0 rounded-full bg-[#d6455d] px-4 py-2 text-[13px] font-semibold">{error}</p>}
      </div>

      <div className="space-y-2.5 px-4 pt-2" style={{ paddingBottom: 'calc(var(--safe-bottom) + 14px)', opacity: stage === 'ready' ? 1 : 0.35, pointerEvents: stage === 'ready' ? 'auto' : 'none' }}>
        <div className="grid grid-cols-5 gap-1 rounded-2xl bg-white/10 p-1" role="radiogroup" aria-label="Tool">
          {TOOLS.map(({ id, label, icon: Icon }) => (
            <button
              key={id} type="button" role="radio" aria-checked={tool === id}
              onClick={() => { setTool(id); if (id !== 'line') setCut(null); if (id !== 'shape') { setPoly([]); setClosed(false); setBox(null) } else if (kind !== 'free' && !box) newBox(kind) }}
              className="flex h-11 flex-col items-center justify-center gap-0.5 rounded-xl border-0 text-[11px] font-bold"
              style={tool === id ? { background: '#fff', color: '#17171a' } : { background: 'transparent', color: 'rgba(255,255,255,.8)' }}
            ><Icon size={16} />{label}</button>
          ))}
        </div>

        {tool === 'line' && (
          <div className="flex items-center gap-2">
            {!cut ? (
              <p className="m-0 flex-1 text-[12.5px] leading-snug text-white/70">Drag across the picture to draw a cut line. One side stays, the shaded side goes. You can move the line or pull its ends afterwards.</p>
            ) : (
              <>
                <button type="button" aria-label="Swap the sides" onClick={() => setCut({ ...cut, flip: !cut.flip })} className="flex h-11 shrink-0 items-center gap-1.5 rounded-full border-0 bg-white/12 px-4 text-[13px] font-bold text-white"><ArrowLeftRight size={16} /> Swap sides</button>
                <button type="button" onClick={() => { applyOutline(shadedSide(cut), mode === 'erase' ? 'erase' : 'restore'); setCut(null) }} className="h-11 flex-1 rounded-full border-0 px-2 text-[13px] font-bold" style={{ background: tint, color: mode === 'erase' ? '#fff' : '#0b3b2a' }}>
                  {mode === 'erase' ? 'Remove the shaded side' : 'Restore the shaded side'}
                </button>
                <button type="button" aria-label="Cancel the line" onClick={() => setCut(null)} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-0 bg-white/12 text-white"><X size={17} /></button>
              </>
            )}
          </div>
        )}

        {tool === 'shape' && (
          <>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto" style={{ touchAction: 'pan-x' }} role="radiogroup" aria-label="Shape">
              {SHAPES.map(({ id, label, icon: Icon }) => (
                <button key={id} type="button" role="radio" aria-checked={kind === id} onClick={() => chooseShape(id)}
                  className="flex h-10 shrink-0 items-center gap-1.5 rounded-full border-0 px-3.5 text-[13px] font-semibold"
                  style={kind === id ? { background: '#fff', color: '#17171a' } : { background: 'rgba(255,255,255,.12)', color: '#fff' }}
                ><Icon size={15} /> {label}</button>
              ))}
            </div>
            {kind === 'free' && !closed ? (
              <div className="flex items-center gap-2">
                <p className="m-0 min-w-0 flex-1 text-[12.5px] leading-snug text-white/70">Tap points around the area. Tap the first dot to close the shape.</p>
                <button type="button" onClick={() => setPoly((l) => l.slice(0, -1))} disabled={!poly.length} className="h-10 rounded-full border-0 bg-white/12 px-3.5 text-[13px] font-semibold text-white disabled:opacity-30">Undo point</button>
                <button type="button" onClick={() => setClosed(true)} disabled={poly.length < 3} className="h-10 rounded-full border-0 bg-white px-3.5 text-[13px] font-semibold text-[#17171a] disabled:opacity-30">Close</button>
              </div>
            ) : shapeReady ? (
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { applyOutline(pts, 'erase'); setBox(null); setPoly([]); setClosed(false); if (kind !== 'free') newBox(kind) }} className="h-11 flex-1 rounded-full border-0 bg-[#ff4d6d] px-2 text-[13px] font-bold text-white">Erase inside</button>
                <button type="button" onClick={() => { applyOutline(pts, 'keep'); setPoly([]); setClosed(false); if (kind !== 'free') newBox(kind) }} className="h-11 flex-1 rounded-full border-0 bg-white px-2 text-[13px] font-bold text-[#17171a]">Keep inside</button>
                <button type="button" onClick={() => { applyOutline(pts, 'restore'); setPoly([]); setClosed(false); if (kind !== 'free') newBox(kind) }} className="h-11 flex-1 rounded-full border-0 bg-[#34d399] px-2 text-[13px] font-bold text-[#0b3b2a]">Restore</button>
                {kind === 'free' && <button type="button" aria-label="Cancel the shape" onClick={() => { setPoly([]); setClosed(false) }} className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-0 bg-white/12 text-white"><X size={17} /></button>}
              </div>
            ) : null}
            {kind !== 'free' && box && <p className="m-0 text-center text-[12px] leading-snug text-white/55">Drag the shape to move it, the corners to resize, the top dot to turn.</p>}
          </>
        )}
        {tool === 'piece' && <p className="m-0 text-center text-[12.5px] leading-snug text-white/70">Tap any leftover bit to remove the whole piece.</p>}
        {tool === 'move' && <p className="m-0 text-center text-[12.5px] leading-snug text-white/70">Drag to move around. You can also pinch with two fingers to zoom while using any tool.</p>}

        <div className="flex items-center justify-center gap-2">
          {(tool === 'brush' || tool === 'line') && ([['erase', 'Erase', Eraser], ['restore', 'Restore', Paintbrush]] as const).map(([id, label, Icon]) => (
            <motion.button
              key={id} type="button" whileTap={{ scale: 0.95 }} aria-pressed={mode === id} onClick={() => setMode(id)}
              className="flex h-11 items-center gap-2 rounded-full border-0 px-5 text-[14.5px] font-semibold"
              style={mode === id ? { background: '#fff', color: '#17171a' } : { background: 'rgba(255,255,255,.12)', color: '#fff' }}
            >
              <Icon size={17} /> {label}
            </motion.button>
          ))}
          <motion.button type="button" whileTap={{ scale: 0.92 }} aria-label="Undo" onClick={undo} disabled={!undoCount} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/12 text-white disabled:opacity-30"><Undo2 size={18} /></motion.button>
          <motion.button type="button" whileTap={{ scale: 0.92 }} aria-label="Clean up specks and holes" title="Clean up" onClick={tidy} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/12 text-white"><Sparkles size={18} /></motion.button>
        </div>
        {showBrushSize && (
          <div className="flex items-center gap-3">
            <span className="w-12 text-[12px] font-bold uppercase tracking-wider text-white/50">Brush</span>
            <input type="range" min={8} max={90} value={brush} onChange={(e) => setBrush(+e.target.value)} aria-label="Brush size" className="h-11 flex-1" style={{ accentColor: '#fff' }} />
          </div>
        )}
        <button type="button" role="switch" aria-checked={outline} onClick={() => setOutline((v) => !v)} className="flex min-h-11 w-full items-center justify-between rounded-2xl border-0 bg-transparent px-1 text-left text-white">
          <span className="text-[14px] font-semibold">Preview the white sticker outline</span>
          <span className="relative h-7 w-12 rounded-full transition-colors" style={{ background: outline ? '#fff' : 'rgba(255,255,255,.25)' }}>
            <motion.span className="absolute top-0.5 h-6 w-6 rounded-full" style={{ background: outline ? '#17171a' : '#fff' }} animate={{ left: outline ? 22 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
          </span>
        </button>
      </div>
    </motion.div>
  )
}
