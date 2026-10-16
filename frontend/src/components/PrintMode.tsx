import { motion } from 'framer-motion'
import { Check, Download, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { exportStoryPng } from '../lib/exportStory'
import { resolveItemAssets } from '../data/sync'
import { PRINT_SIZES, QUALITIES, pageDims, pagePixels, type PrintSize } from '../lib/printSizes'
import { slugName, zipPages } from '../lib/zipPages'
import type { CanvasItem, Memory } from '../types'
import { ToolSheet } from './ToolSheet'
import { toast } from './ui'

const MASK = 'rgba(14,16,26,.5)'

/** rotated bounding box of an item, in canvas pixels */
function bounds(it: CanvasItem, canvasW: number) {
  const r = (it.rotation * Math.PI) / 180
  const bw = Math.abs(it.width * Math.cos(r)) + Math.abs(it.height * Math.sin(r))
  const bh = Math.abs(it.width * Math.sin(r)) + Math.abs(it.height * Math.cos(r))
  const cx = (it.x / 100) * canvasW
  return { l: cx - bw / 2, r: cx + bw / 2, t: it.y - bh / 2, b: it.y + bh / 2 }
}
const isBgItem = (it: CanvasItem) => (it.type === 'photo' || it.type === 'collage') && !!it.props.background

/** how many pages the book needs from `y0` down, given where its lowest item ends */
export function pagesNeeded(items: CanvasItem[], canvasW: number, y0: number, pageH: number) {
  let bottom = 0
  for (const it of items) if (it.type !== 'thread') bottom = Math.max(bottom, bounds(it, canvasW).b)
  return Math.max(1, Math.ceil((bottom - y0 - 2) / pageH))
}

interface OverlayProps {
  surfaceRef: RefObject<HTMLDivElement | null>
  scrollerRef: RefObject<HTMLDivElement | null>
  canvasW: number
  surfaceH: number
  /** where page 1 starts on the canvas */
  y0: number
  onY0: (y: number) => void
  pageH: number
  /** pages with content; one more empty page is shown after them as a place to keep going */
  used: number
  items: CanvasItem[]
  accent: string
  headerH: number
  zoom: number
  /** the printer-safe margin, in canvas px */
  margin: number
}

/** The pages laid over the canvas, one under the other: numbered frames, a margin guide, and a warning on whatever is cut by a page edge. */
export function PrintOverlay({ surfaceRef, scrollerRef, canvasW, surfaceH, y0, onY0, pageH, used, items, accent, headerH, zoom, margin }: OverlayProps) {
  const pages = used + 1
  const drag = useRef<{ off: number; cy: number } | null>(null)
  const z = useRef(zoom)
  z.current = zoom
  const raf = useRef(0)
  const live = useRef({ onY0 })
  live.current.onY0 = onY0

  const crossing = useMemo(() => items.filter((it) => {
    if (it.type === 'thread' || isBgItem(it)) return false
    const b = bounds(it, canvasW)
    if (b.b <= y0 || b.t >= y0 + used * pageH) return false
    if (b.l < -1 || b.r > canvasW + 1 || b.t < y0 - 1 || b.b > y0 + used * pageH + 1) return true
    for (let k = 1; k < used; k++) { const e = y0 + k * pageH; if (b.t < e - 1 && b.b > e + 1) return true }
    return false
  }), [items, canvasW, y0, used, pageH])

  const tick = () => {
    const d = drag.current
    const sc = scrollerRef.current
    const s = surfaceRef.current
    if (!d || !sc || !s) return
    const vh = window.innerHeight
    const topZone = headerH + 70
    const botZone = vh - 120
    if (d.cy < topZone) sc.scrollTop -= Math.min(18, (topZone - d.cy) / 4 + 2)
    else if (d.cy > botZone) sc.scrollTop += Math.min(18, (d.cy - botZone) / 4 + 2)
    const top = s.getBoundingClientRect().top
    live.current.onY0(Math.max(0, (d.cy - d.off - top) / z.current))
    raf.current = requestAnimationFrame(tick)
  }
  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const top = surfaceRef.current!.getBoundingClientRect().top
    drag.current = { off: e.clientY - (top + y0 * z.current), cy: e.clientY }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick)
  }
  const move = (e: React.PointerEvent) => { if (drag.current) drag.current.cy = e.clientY }
  const stop = () => { drag.current = null; cancelAnimationFrame(raf.current) }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 8500 }}>
      <div className="absolute inset-x-0 top-0" style={{ height: y0, background: MASK }} />
      <div className="absolute inset-x-0" style={{ top: y0 + pages * pageH, height: Math.max(0, surfaceH - y0 - pages * pageH), background: MASK }} />

      {Array.from({ length: pages }, (_, p) => {
        const spare = p >= used
        return (
          <div
            key={p} className="absolute inset-x-0"
            style={{ top: y0 + p * pageH, height: pageH, boxShadow: `inset 0 0 0 2px ${accent}${spare ? '55' : ''}`, background: spare ? 'rgba(255,255,255,.18)' : 'transparent' }}
          >
            <div className="absolute" style={{ inset: margin, border: `1.5px dashed ${accent}${spare ? '33' : '66'}`, borderRadius: 4 }} />
            <span
              className="absolute left-2 top-2 rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white"
              style={{ background: spare ? 'rgba(23,23,26,.45)' : accent, boxShadow: '0 2px 6px rgba(0,0,0,.25)' }}
            >
              {spare ? `Page ${p + 1} · empty` : `Page ${p + 1}`}
            </span>
            {p === 0 && (
              <div
                data-ui role="slider" aria-label="Move where the pages start" aria-valuenow={Math.round(y0)}
                onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}
                className="absolute left-1/2 grid h-11 w-24 -translate-x-1/2 cursor-grab place-items-center"
                style={{ top: 4, pointerEvents: 'auto', touchAction: 'none', zIndex: 9700 }}
              >
                <span className="h-[7px] w-14 rounded-full" style={{ background: '#fff', boxShadow: `0 0 0 1.5px ${accent}, 0 2px 8px rgba(0,0,0,.3)` }} />
              </div>
            )}
          </div>
        )
      })}

      {crossing.map((it) => {
        const b = bounds(it, canvasW)
        return <div key={it.id} className="absolute rounded-md" style={{ left: b.l, top: b.t, width: b.r - b.l, height: b.b - b.t, outline: '2px dashed #ff5d73', outlineOffset: 2, opacity: 0.9 }} />
      })}
    </div>
  )
}

interface PickProps {
  open: boolean
  onClose: () => void
  size: PrintSize
  landscape: boolean
  onPick: (s: PrintSize, landscape: boolean) => void
  accent: string
}

/** Choose the paper: its size and which way it is turned. */
export function PrintSizeSheet({ open, onClose, size, landscape, onPick, accent }: PickProps) {
  return (
    <ToolSheet open={open} onClose={onClose} title="Page size" snaps={[0.76, 0.94]} z={75}>
      <div className="px-4 pb-6">
        <div className="mx-2 mb-2 flex rounded-full bg-neutral-100 p-1" role="group" aria-label="Page direction">
          {([['Portrait', false], ['Landscape', true]] as const).map(([label, ls]) => (
            <button
              key={label} type="button" aria-pressed={landscape === ls} onClick={() => onPick(size, ls)}
              className="h-11 flex-1 rounded-full border-0 text-[14px] font-bold"
              style={landscape === ls ? { background: '#fff', color: '#17171a', boxShadow: '0 1px 4px rgba(0,0,0,.15)' } : { background: 'transparent', color: '#7a7a85' }}
            >
              {label}
            </button>
          ))}
        </div>
        {PRINT_SIZES.map((s) => {
          const on = s.id === size.id
          const d = pageDims(s, landscape)
          const r = d.w / d.h
          return (
            <motion.button
              key={s.id} type="button" whileTap={{ scale: 0.98 }} onClick={() => { onPick(s, landscape); onClose() }}
              className="flex min-h-[64px] w-full items-center gap-3.5 rounded-2xl border-0 bg-transparent px-2 py-2 text-left"
              style={on ? { background: `${accent}14` } : undefined} aria-pressed={on}
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center">
                <span className="rounded-[3px]" style={{ width: r >= 1 ? 40 : 40 * r, height: r >= 1 ? 40 / r : 40, border: `2px solid ${on ? accent : '#b9b9c3'}`, background: on ? `${accent}22` : '#f3f3f6' }} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15.5px] font-bold text-[#17171a]">{s.name}</span>
                <span className="block truncate text-[12.5px] text-neutral-500">{landscape ? `${s.mm[1]} × ${s.mm[0]}` : `${s.mm[0]} × ${s.mm[1]}`} mm · {s.note}</span>
              </span>
              {on && <Check size={20} strokeWidth={3} style={{ color: accent }} />}
            </motion.button>
          )
        })}
        <p className="m-0 px-2 pt-3 text-[12.5px] leading-snug text-neutral-400">Every page is as wide as your canvas and as tall as the paper needs. Keep what matters inside the dashed margin so a printer never cuts it.</p>
      </div>
    </ToolSheet>
  )
}

interface ExportProps {
  open: boolean
  onClose: () => void
  memory: Memory
  accent: string
  getItems: () => CanvasItem[]
  y0: number
  pageCount: number
  canvasW: number
  size: PrintSize
  landscape: boolean
}

const thumb = (size: PrintSize, landscape: boolean) => {
  const d = pageDims(size, landscape)
  return { id: 'thumb', name: '', note: '', w: 360, h: Math.round((360 * d.h) / d.w), safeTop: 0, safeBottom: 0 }
}

/** Shows every page, frame by frame, and saves them all as numbered images in a folder (a ZIP). */
export function PrintExportSheet({ open, onClose, memory, accent, getItems, y0, pageCount, canvasW, size, landscape }: ExportProps) {
  const [dpi, setDpi] = useState<number>(300)
  const [dots, setDots] = useState(false)
  const [thumbs, setThumbs] = useState<string[]>([])
  const [busy, setBusy] = useState<{ done: number } | null>(null)
  const resolved = useRef<CanvasItem[] | null>(null)
  const pageH = (canvasW * pageDims(size, landscape).h) / pageDims(size, landscape).w

  useEffect(() => {
    if (!open) return
    let alive = true
    const urls: string[] = []
    setThumbs([])
    resolved.current = null
    ;(async () => {
      const items = await Promise.all(getItems().map((i) => resolveItemAssets(memory.id, i)))
      if (!alive) return
      resolved.current = items
      for (let i = 0; i < pageCount; i++) {
        try {
          const blob = await exportStoryPng(memory, items, { frameY: y0 + i * pageH, canvasW, dots, mark: false, size: thumb(size, landscape), resolved: true })
          if (!alive) return
          urls.push(URL.createObjectURL(blob))
          setThumbs([...urls])
        } catch { urls.push(''); setThumbs([...urls]) }
      }
    })()
    return () => { alive = false; urls.forEach((u) => u && URL.revokeObjectURL(u)) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dots, pageCount, y0, size, landscape])

  const px = pagePixels(size, landscape, dpi)
  const folder = `${slugName(memory.title)}-pages`

  const run = async () => {
    setBusy({ done: 0 })
    try {
      const items = resolved.current ?? (await Promise.all(getItems().map((i) => resolveItemAssets(memory.id, i))))
      const full = { id: 'print', name: size.name, note: '', w: px.w, h: px.h, safeTop: 0, safeBottom: 0 }
      const r = await zipPages(folder, pageCount, (i) => exportStoryPng(memory, items, { frameY: y0 + i * pageH, canvasW, dots, mark: false, size: full, resolved: true }), (done) => setBusy({ done }))
      toast(r.parts > 1 ? `Saved ${pageCount} pages in ${r.parts} ZIP files` : `Saved ${pageCount} page${pageCount > 1 ? 's' : ''} in a folder`)
    } catch {
      toast("Couldn't finish the export. Try a lighter quality.")
    } finally { setBusy(null) }
  }

  const d = pageDims(size, landscape)
  return (
    <ToolSheet open={open} onClose={() => { if (!busy) onClose() }} title="Export pages" snaps={[0.94]} z={85}>
      <div className="space-y-4 px-5 pb-6">
        <p className="m-0 text-[13.5px] leading-snug text-neutral-500">
          {pageCount} page{pageCount > 1 ? 's' : ''} · {size.name} {landscape ? 'landscape' : 'portrait'}. Each page is saved as its own picture, numbered in order, inside one folder.
        </p>
        <div className="grid grid-cols-3 gap-2.5">
          {Array.from({ length: pageCount }, (_, i) => (
            <div key={i} className="relative overflow-hidden rounded-xl bg-neutral-100" style={{ aspectRatio: `${d.w} / ${d.h}`, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)' }}>
              {thumbs[i] ? <img src={thumbs[i]} alt={`Page ${i + 1}`} className="h-full w-full object-cover" /> : <span className="absolute inset-0 grid place-items-center"><Loader2 size={18} className="animate-spin text-neutral-400" /></span>}
              <span className="absolute left-1.5 top-1.5 grid h-6 min-w-6 place-items-center rounded-full bg-[#17171a]/80 px-1.5 text-[11px] font-extrabold text-white">{i + 1}</span>
            </div>
          ))}
        </div>

        <div>
          <span className="mb-2 block text-[12px] font-extrabold uppercase tracking-wider text-neutral-400">Quality</span>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Quality">
            {QUALITIES.map((q) => {
              const on = dpi === q.dpi
              return (
                <button
                  key={q.dpi} type="button" role="radio" aria-checked={on} onClick={() => setDpi(q.dpi)}
                  className="rounded-2xl border-0 px-2 py-2.5 text-center"
                  style={{ background: on ? `${accent}18` : '#f6f6f8', boxShadow: on ? `inset 0 0 0 2px ${accent}` : 'none' }}
                >
                  <span className="block text-[14px] font-extrabold text-[#17171a]">{q.name}</span>
                  <span className="block text-[11px] font-semibold text-neutral-500">{q.dpi} dpi</span>
                </button>
              )
            })}
          </div>
          <p className="m-0 pt-2 text-[12.5px] text-neutral-500">Each picture is {px.w} × {px.h} px. A higher quality takes longer and needs more memory.</p>
        </div>

        <button type="button" role="switch" aria-checked={dots} onClick={() => setDots((v) => !v)} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-1 text-left text-[14.5px] font-semibold text-[#17171a]">
          Include the dots / grid pattern
          <span className="relative h-7 w-12 rounded-full transition-colors" style={{ background: dots ? accent : '#d9d9df' }}>
            <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: dots ? 22 : 2 }} />
          </span>
        </button>

        <button
          type="button" disabled={!!busy} onClick={() => void run()}
          className="flex h-13 min-h-[52px] w-full items-center justify-center gap-2 rounded-full border-0 bg-[#17171a] text-[15.5px] font-bold text-white disabled:opacity-60"
        >
          {busy ? <><Loader2 size={18} className="animate-spin" /> Page {Math.min(busy.done + 1, pageCount)} of {pageCount}…</> : <><Download size={18} /> Save {pageCount} page{pageCount > 1 ? 's' : ''} as images</>}
        </button>
        <p className="m-0 text-center text-[12px] text-neutral-400">Saved as <b>{folder}.zip</b> · page-01.png, page-02.png …</p>
      </div>
    </ToolSheet>
  )
}
