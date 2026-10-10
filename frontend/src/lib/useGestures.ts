import { useCallback, useEffect, useRef, type PointerEvent as RPointerEvent, type RefObject } from 'react'
import type { CanvasItem, ItemPatch } from '../types'
import { clamp } from './items'
import { snapDrag, type Guides } from './snap'

type Mode = 'drag' | 'pinch' | 'resize' | 'rotate'
interface Pt { x: number; y: number }

interface Base {
  cx: number; cy: number; w: number; h: number; rot: number; size: number
  p: Pt; d: number; a: number; scrollTop: number
}
interface G {
  id: string
  mode: Mode
  pointers: Map<number, Pt>
  base: Base
  moved: boolean
  t0: number
  last: Pt
  /** picked up by a long press (lifting the finger afterwards is not a tap) */
  held: boolean
  touch: boolean
}

export interface GestureOptions {
  surfaceRef: RefObject<HTMLDivElement | null>
  scrollerRef: RefObject<HTMLDivElement | null>
  itemsRef: RefObject<CanvasItem[]>
  heightRef: RefObject<number>
  /** canvas zoom (1 = fit to width); screen movement is divided by it to get canvas movement */
  zoomRef?: RefObject<number>
  live: (fn: (items: CanvasItem[]) => CanvasItem[]) => void
  begin: () => void
  end: () => void
  onSelect: (id: string) => void
  onDragging: (id: string | null) => void
  /** alignment lines while an item is dragged near other items (null when done) */
  onGuides?: (g: Guides | null) => void
  onDoubleTap?: (id: string) => void
  /** an item was picked up by a long press (the click that follows the release must be ignored) */
  onHold?: () => void
  /** a quick touch tap on an item that was not picked up (no hold) */
  onTap?: (id: string) => void
  /** already-selected items can be dragged straight away on touch */
  isSelected?: (id: string) => boolean
  /** px at the top of the viewport covered by the sticky header */
  topInset?: number
  /** px at the bottom of the viewport covered by the toolbar */
  bottomInset?: number
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y)
const ang = (a: Pt, b: Pt) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI

function norm(deg: number) {
  let d = ((((deg + 180) % 360) + 360) % 360) - 180
  const snap = Math.round(d / 90) * 90
  if (Math.abs(d - snap) < 3) d = snap
  return d === -180 ? 180 : d
}

/**
 * Pointer-event gestures for canvas items: drag, two-finger pinch + rotate, and the
 * resize / rotate handles of the selection. Window-level listeners let the second
 * finger land anywhere while the first one holds an item.
 */
export function useGestures(opts: GestureOptions) {
  const o = useRef(opts)
  o.current = opts
  const g = useRef<G | null>(null)
  const lastTap = useRef<{ id: string; t: number } | null>(null)
  const pendingTap = useRef(0)
  const raf = useRef(0)
  const fns = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void; down: (e: PointerEvent) => void; touch: (e: TouchEvent) => void }>(null!)

  const geometry = () => {
    const r = o.current.surfaceRef.current!.getBoundingClientRect()
    const z = o.current.zoomRef?.current || 1
    return { left: r.left, top: r.top, W: r.width / z, z }
  }

  const baseline = (mode: Mode, st: G) => {
    const { top, left, W, z } = geometry()
    const item = o.current.itemsRef.current.find((i) => i.id === st.id)
    if (!item) return
    const pts = [...st.pointers.values()]
    const cx = (item.x / 100) * W
    const base: Base = {
      cx, cy: item.y, w: item.width, h: item.height, rot: item.rotation,
      size: item.type === 'text' ? item.props.size : 0,
      p: pts.length === 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : { ...pts[0] },
      d: pts.length === 2 ? Math.max(1, dist(pts[0], pts[1])) : 1,
      a: pts.length === 2 ? ang(pts[0], pts[1]) : 0,
      scrollTop: o.current.scrollerRef.current?.scrollTop ?? 0,
    }
    if (mode === 'resize' || mode === 'rotate') {
      const c = { x: left + cx * z, y: top + item.y * z }
      base.d = Math.max(8, dist(c, pts[0]))
      base.a = ang(c, pts[0])
    }
    st.mode = mode
    st.base = base
  }

  const write = (id: string, p: ItemPatch) =>
    o.current.live((items) =>
      items.map((i) => (i.id === id ? ({ ...i, ...p, props: p.props ? { ...i.props, ...p.props } : i.props } as CanvasItem) : i)),
    )

  const update = () => {
    const st = g.current
    if (!st) return
    const { left, top, W, z } = geometry()
    const b = st.base
    const pts = [...st.pointers.values()]
    if (!pts.length) return

    const mine = o.current.itemsRef.current.find((i) => i.id === st.id)
    const locked = mine?.type === 'photo' && !!mine.props.background // a background only slides up and down
    if (locked && st.mode !== 'drag') return

    if (st.mode === 'drag') {
      const sc = ((o.current.scrollerRef.current?.scrollTop ?? 0) - b.scrollTop) / z
      const nx = b.cx + (pts[0].x - b.p.x) / z
      const ny = b.cy + (pts[0].y - b.p.y) / z + sc
      const item = o.current.itemsRef.current.find((i) => i.id === st.id)
      const sn = item && st.moved ? snapDrag(item, nx, ny, W, o.current.itemsRef.current) : null
      o.current.onGuides?.(sn && (sn.guides.v.length || sn.guides.h.length) ? sn.guides : null)
      write(st.id, { x: locked ? 50 : clamp(((sn?.x ?? nx) / W) * 100, 0, 100), y: clamp(locked ? ny : sn?.y ?? ny, 0, o.current.heightRef.current) })
      return
    }

    let scale = 1
    let rot = b.rot
    let cx = b.cx
    let cy = b.cy
    if (st.mode === 'pinch' && pts.length === 2) {
      scale = dist(pts[0], pts[1]) / b.d
      rot = b.rot + (ang(pts[0], pts[1]) - b.a)
      const mid = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
      cx = b.cx + (mid.x - b.p.x) / z
      cy = b.cy + (mid.y - b.p.y) / z
    } else if (st.mode === 'resize') {
      const c = { x: left + b.cx * z, y: top + b.cy * z }
      scale = dist(c, pts[0]) / b.d
      rot = b.rot + (ang(c, pts[0]) - b.a)
    } else if (st.mode === 'rotate') {
      const c = { x: left + b.cx * z, y: top + b.cy * z }
      rot = ang(c, pts[0]) + 90
    } else return

    const newW = clamp(b.w * scale, 36, W * 1.8)
    const s = newW / b.w
    const patch: ItemPatch = {
      rotation: norm(rot), x: clamp((cx / W) * 100, 0, 100), y: clamp(cy, 0, o.current.heightRef.current),
    }
    if (st.mode !== 'rotate') {
      patch.width = newW
      patch.height = b.h * s
      if (b.size) patch.props = { size: Math.round(b.size * s * 10) / 10 }
    }
    write(st.id, patch)
  }

  const autoScroll = () => {
    cancelAnimationFrame(raf.current)
    const tick = () => {
      const st = g.current
      if (!st || st.mode !== 'drag') return
      const sc = o.current.scrollerRef.current
      const y = st.last.y
      const top = o.current.topInset ?? 150
      const bottom = window.innerHeight - (o.current.bottomInset ?? 130)
      let v = 0
      if (y > bottom) v = Math.min(18, (y - bottom) / 5)
      else if (y < top) v = -Math.min(18, (top - y) / 5)
      if (sc && v) {
        const before = sc.scrollTop
        sc.scrollTop += v
        if (sc.scrollTop !== before) update()
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const finish = () => {
    const st = g.current
    cancelAnimationFrame(raf.current)
    window.removeEventListener('pointermove', fns.current.move)
    window.removeEventListener('pointerup', fns.current.up)
    window.removeEventListener('pointercancel', fns.current.up)
    window.removeEventListener('pointerdown', fns.current.down, true)
    window.removeEventListener('touchmove', fns.current.touch)
    g.current = null
    o.current.onDragging(null)
    o.current.onGuides?.(null)
    o.current.end()
    if (st && !st.held && !st.moved && st.mode === 'drag' && performance.now() - st.t0 < 450) {
      const now = performance.now()
      const lt = lastTap.current
      if (lt && lt.id === st.id && now - lt.t < 380) {
        lastTap.current = null
        window.clearTimeout(pendingTap.current)
        o.current.onDoubleTap?.(st.id)
      } else {
        lastTap.current = { id: st.id, t: now }
        // a single tap on an already-selected item (e.g. open a photo) waits to be sure it is not a double tap
        const id = st.id
        window.clearTimeout(pendingTap.current)
        if (st.touch) pendingTap.current = window.setTimeout(() => o.current.onTap?.(id), 340)
      }
    }
  }

  fns.current ||= {
    touch: (e) => { if (g.current && e.cancelable) e.preventDefault() },
    move: (e) => {
      const st = g.current
      if (!st || !st.pointers.has(e.pointerId)) return
      e.preventDefault()
      const p = { x: e.clientX, y: e.clientY }
      st.pointers.set(e.pointerId, p)
      st.last = p
      if (!st.moved && dist(p, st.base.p) > 10) st.moved = true
      update()
    },
    up: (e) => {
      const st = g.current
      if (!st || !st.pointers.has(e.pointerId)) return
      st.pointers.delete(e.pointerId)
      if (st.pointers.size === 0) return finish()
      if (st.mode === 'pinch') {
        baseline('drag', st)
        autoScroll()
      }
    },
    down: (e) => {
      const st = g.current
      if (!st || e.pointerType === 'mouse' || st.pointers.size >= 2 || st.mode !== 'drag') return
      if ((e.target as HTMLElement).closest?.('[data-ui]')) return
      st.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      st.moved = true
      baseline('pinch', st)
    },
  }

  const HOLD_MS = 400

  /** begin a gesture for an already-down pointer */
  const activate = (pointerId: number, p: Pt, id: string, mode: Mode, held = false, touch = false) => {
    if (g.current) return
    const st: G = {
      id, mode, pointers: new Map([[pointerId, p]]), moved: false, t0: performance.now(), last: p, held, touch,
      base: { cx: 0, cy: 0, w: 0, h: 0, rot: 0, size: 0, p, d: 1, a: 0, scrollTop: 0 },
    }
    g.current = st
    o.current.onSelect(id)
    o.current.begin()
    baseline(mode, st)
    o.current.onDragging(id)
    const f = fns.current
    window.addEventListener('pointermove', f.move, { passive: false })
    window.addEventListener('pointerup', f.up)
    window.addEventListener('pointercancel', f.up)
    window.addEventListener('pointerdown', f.down, true)
    window.addEventListener('touchmove', f.touch, { passive: false })
    if (mode === 'drag') autoScroll()
  }

  const hold = useRef<{ timer: number; x: number; y: number; id: number; itemId: string } | null>(null)
  const cancelHold = () => {
    const h = hold.current
    if (!h) return
    window.clearTimeout(h.timer)
    hold.current = null
    window.removeEventListener('pointermove', holdMove)
    window.removeEventListener('pointerup', holdEnd)
    window.removeEventListener('pointercancel', holdEnd)
  }
  function holdMove(e: PointerEvent) {
    const h = hold.current
    if (h && e.pointerId === h.id && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 10) cancelHold() // it's a scroll
  }
  function holdEnd(e: PointerEvent) {
    const h = hold.current
    if (!h || e.pointerId !== h.id) return
    const id = h.itemId
    cancelHold()
    if (e.type === 'pointerup') o.current.onTap?.(id)
  }

  const start = (e: RPointerEvent, id: string, mode: Mode) => {
    if (g.current) return
    if (e.button > 0) return
    const p = { x: e.clientX, y: e.clientY }
    // Touch: items only pick up after a 0.4 s press, so plain scrolling over them never selects or moves them.
    if (e.pointerType === 'touch' && mode === 'drag' && !o.current.isSelected?.(id)) {
      if (hold.current) return
      const pid = e.pointerId
      hold.current = {
        id: pid, x: p.x, y: p.y, itemId: id,
        timer: window.setTimeout(() => {
          const pos = { x: hold.current?.x ?? p.x, y: hold.current?.y ?? p.y }
          cancelHold()
          navigator.vibrate?.(18)
          o.current.onHold?.()
          activate(pid, pos, id, 'drag', true, true)
        }, HOLD_MS),
      }
      window.addEventListener('pointermove', holdMove)
      window.addEventListener('pointerup', holdEnd)
      window.addEventListener('pointercancel', holdEnd)
      return
    }
    e.preventDefault()
    e.stopPropagation()
    activate(e.pointerId, p, id, mode, false, e.pointerType === 'touch')
  }

  const stop = useCallback(() => { cancelAnimationFrame(raf.current) }, [])
  useEffect(() => () => { stop(); cancelHold(); if (g.current) finish() }, [stop]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    startItem: (e: RPointerEvent, id: string) => start(e, id, 'drag'),
    startHandle: (e: RPointerEvent, id: string, kind: 'resize' | 'rotate') => start(e, id, kind),
  }
}
