import { motion, useReducedMotion } from 'framer-motion'
import { Copy, Download, Loader2, Share2, Type } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { exportStoryPng, frameHeightFor, SAFE_BOTTOM, SAFE_TOP, storyPrefs } from '../lib/exportStory'
import type { CanvasItem, Memory } from '../types'
import { ToolSheet } from './ToolSheet'
import { toast } from './ui'

const HATCH = 'repeating-linear-gradient(135deg, rgba(255,255,255,.34) 0 6px, rgba(255,255,255,.08) 6px 12px)'
const MASK = 'rgba(14,16,26,.58)'

/** rotated bounding box of an item, in canvas pixels */
function bounds(it: CanvasItem, canvasW: number) {
  const r = (it.rotation * Math.PI) / 180
  const bw = Math.abs(it.width * Math.cos(r)) + Math.abs(it.height * Math.sin(r))
  const bh = Math.abs(it.width * Math.sin(r)) + Math.abs(it.height * Math.cos(r))
  const cx = (it.x / 100) * canvasW
  return { l: cx - bw / 2, r: cx + bw / 2, t: it.y - bh / 2, b: it.y + bh / 2 }
}

interface OverlayProps {
  surfaceRef: RefObject<HTMLDivElement | null>
  scrollerRef: RefObject<HTMLDivElement | null>
  canvasW: number
  surfaceH: number
  y: number
  onY: (y: number) => void
  items: CanvasItem[]
  accent: string
  headerH: number
}

/** The 9:16 frame, dim mask, Instagram safe-zone guides and edge warnings. Taps pass through to the canvas. */
export function StoryOverlay({ surfaceRef, scrollerRef, canvasW, surfaceH, y, onY, items, accent, headerH }: OverlayProps) {
  const calm = useReducedMotion()
  const fh = frameHeightFor(canvasW)
  const spring = calm ? { duration: 0 } : { type: 'spring' as const, stiffness: 300, damping: 26 }
  const drag = useRef<{ off: number; cy: number } | null>(null)
  const raf = useRef(0)
  const live = useRef({ onY })
  live.current.onY = onY

  const crossing = useMemo(() => items.filter((it) => {
    if (it.type === 'thread') return false
    const b = bounds(it, canvasW)
    if (b.b <= y || b.t >= y + fh) return false
    return b.t < y || b.b > y + fh || b.l < 0 || b.r > canvasW
  }), [items, canvasW, y, fh])

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
    live.current.onY(Math.max(0, d.cy - d.off - top))
    raf.current = requestAnimationFrame(tick)
  }
  const start = (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const top = surfaceRef.current!.getBoundingClientRect().top
    drag.current = { off: e.clientY - (top + y), cy: e.clientY }
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(tick)
  }
  const move = (e: React.PointerEvent) => { if (drag.current) drag.current.cy = e.clientY }
  const stop = () => { drag.current = null; cancelAnimationFrame(raf.current) }
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  const handle = (pos: 'top' | 'bottom') => (
    <div
      data-ui role="slider" aria-label="Move the story frame" aria-valuenow={Math.round(y)}
      onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop}
      className="absolute left-1/2 grid h-11 w-24 -translate-x-1/2 cursor-grab place-items-center"
      style={{ [pos]: 4, pointerEvents: 'auto', touchAction: 'none', zIndex: 9700 }}
    >
      <span className="h-[7px] w-14 rounded-full" style={{ background: '#fff', boxShadow: `0 0 0 1.5px ${accent}, 0 2px 8px rgba(0,0,0,.3)` }} />
    </div>
  )

  const label = (text: string, at: 'top' | 'bottom') => (
    <span className="absolute left-3 text-[11px] font-extrabold uppercase tracking-wider text-white" style={{ [at]: 8, textShadow: '0 1px 3px rgba(0,0,0,.5)' }}>{text}</span>
  )

  return (
    <div className="pointer-events-none absolute inset-0" style={{ zIndex: 8500 }} aria-hidden={false}>
      {/* dim everything outside the frame */}
      <motion.div className="absolute inset-x-0 top-0" style={{ height: y, background: MASK }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: calm ? 0 : 0.35 }} />
      <motion.div className="absolute inset-x-0" style={{ top: y + fh, height: Math.max(0, surfaceH - y - fh), background: MASK }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: calm ? 0 : 0.35 }} />

      {/* the frame itself */}
      <motion.div
        className="absolute inset-x-0" style={{ top: y, height: fh, boxShadow: `inset 0 0 0 2px ${accent}`, transformOrigin: '50% 0' }}
        initial={{ opacity: 0, scaleY: 0.94 }} animate={{ opacity: 1, scaleY: 1 }} transition={spring}
      >
        <div className="absolute inset-x-0 top-0" style={{ height: `${SAFE_TOP * 100}%`, background: HATCH, borderBottom: '1.5px dashed rgba(255,255,255,.85)' }}>{label('Profile bar', 'top')}</div>
        <div className="absolute inset-x-0 bottom-0" style={{ height: `${SAFE_BOTTOM * 100}%`, background: HATCH, borderTop: '1.5px dashed rgba(255,255,255,.85)' }}>{label('Reply bar', 'bottom')}</div>
        {handle('top')}
        {handle('bottom')}
      </motion.div>

      {/* items that will be cut off */}
      {crossing.map((it) => {
        const b = bounds(it, canvasW)
        return <div key={it.id} className="absolute rounded-md" style={{ left: b.l, top: b.t, width: b.r - b.l, height: b.b - b.t, outline: '2px dashed #ff5d73', outlineOffset: 2, opacity: 0.9 }} />
      })}
    </div>
  )
}

function BarBtn({ label, icon, onClick, primary }: { label: string; icon: ReactNode; onClick: () => void; primary?: boolean }) {
  return (
    <motion.button
      type="button" whileTap={{ scale: 0.92 }} onClick={onClick} aria-label={label}
      className="flex h-14 min-w-[64px] flex-col items-center justify-center gap-0.5 rounded-full border-0 px-3 text-[11px] font-bold"
      style={primary ? { background: '#17171a', color: '#fff' } : { background: 'transparent', color: '#17171a' }}
    >
      {icon}{label}
    </motion.button>
  )
}

export function StoryBar({ visible, onName, onShare, onDownload, onCaption }: { visible: boolean; onName: () => void; onShare: () => void; onDownload: () => void; onCaption: () => void }) {
  const calm = useReducedMotion()
  if (!visible) return null
  return (
    <motion.div
      data-ui className="pointer-events-none fixed inset-x-0 z-40 flex justify-center" style={{ bottom: 'calc(var(--safe-bottom) + 16px)' }}
      initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={calm ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
    >
      <div className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-white p-1.5" style={{ boxShadow: '0 10px 34px rgba(20,24,40,.2), 0 0 0 1px rgba(20,24,40,.04)' }}>
        <BarBtn label="Tale name" icon={<Type size={20} />} onClick={onName} />
        <BarBtn label="Caption" icon={<Copy size={20} />} onClick={onCaption} />
        <BarBtn label="Download" icon={<Download size={20} />} onClick={onDownload} />
        <BarBtn label="Share" icon={<Share2 size={20} />} onClick={onShare} primary />
      </div>
    </motion.div>
  )
}

export const storyFileName = (title: string) => `memory-tale-${title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'story'}-story.png`

export function storyCaption(memory: Memory, date: string) {
  return `${memory.title}\n${date}\n\n#MemoryTale`
}

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.cssText = 'position:fixed;opacity:0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

interface PreviewProps {
  open: boolean
  onClose: () => void
  memory: Memory
  caption: string
  accent: string
  getItems: () => CanvasItem[]
  frameY: number
  canvasW: number
}

/** Renders the story and shows it before anything is shared. */
export function StoryPreview({ open, onClose, memory, caption, accent, getItems, frameY, canvasW }: PreviewProps) {
  const [dots, setDots] = useState(storyPrefs.dots)
  const [mark, setMark] = useState(storyPrefs.mark)
  const [state, setState] = useState<{ blob: Blob; url: string } | null>(null)
  const [err, setErr] = useState(false)
  const [tries, setTries] = useState(0)

  useEffect(() => {
    if (!open) return
    let alive = true
    let made = ''
    setState(null)
    setErr(false)
    exportStoryPng(memory, getItems(), { frameY, canvasW, dots, mark })
      .then((blob) => { if (!alive) return; made = URL.createObjectURL(blob); setState({ blob, url: made }) })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dots, mark, tries])

  const share = async () => {
    if (!state) return
    const file = new File([state.blob], storyFileName(memory.title), { type: 'image/png' })
    try {
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: memory.title, text: caption }); return }
    } catch (e) { if ((e as Error).name === 'AbortError') return }
    downloadBlob(state.blob, file.name)
    toast('Saved the story image')
  }

  const Switch = ({ label, on, set }: { label: string; on: boolean; set: (v: boolean) => void }) => (
    <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className="flex min-h-11 w-full items-center justify-between border-0 bg-transparent px-1 text-left text-[14.5px] font-semibold text-[#17171a]">
      {label}
      <span className="relative h-7 w-12 rounded-full transition-colors" style={{ background: on ? accent : '#d9d9df' }}>
        <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
      </span>
    </button>
  )

  return (
    <ToolSheet open={open} onClose={onClose} title="Story preview" snaps={[0.92]} z={85}>
      <div className="space-y-3 px-6 pb-5">
        <div className="mx-auto grid place-items-center overflow-hidden rounded-2xl bg-neutral-100" style={{ aspectRatio: '9 / 16', height: 'min(46vh, 420px)' }}>
          {state ? <img src={state.url} alt="Your story" className="h-full w-full object-contain" />
            : err ? (
              <div className="px-4 text-center text-[13.5px] font-semibold text-neutral-500">
                Couldn&apos;t render the image.<br />
                <button type="button" onClick={() => setTries((n) => n + 1)} className="mt-2 h-10 rounded-full border-0 bg-[#17171a] px-5 text-white">Try again</button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-[13px] font-semibold text-neutral-500"><Loader2 className="animate-spin" size={26} style={{ color: accent }} />Rendering your story…</div>
            )}
        </div>
        <Switch label="Show dots" on={dots} set={(v) => { storyPrefs.setDots(v); setDots(v) }} />
        <Switch label="“Made with Memory Tale” mark" on={mark} set={(v) => { if (storyPrefs.locked) return; storyPrefs.setMark(v); setMark(v) }} />
        <div className="flex gap-2">
          <button type="button" disabled={!state} onClick={() => state && downloadBlob(state.blob, storyFileName(memory.title))}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-0 bg-neutral-100 text-[15px] font-bold text-[#17171a] disabled:opacity-40"><Download size={18} />Download</button>
          <button type="button" disabled={!state} onClick={() => void share()}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full border-0 bg-[#17171a] text-[15px] font-bold text-white disabled:opacity-40"><Share2 size={18} />Share</button>
        </div>
      </div>
    </ToolSheet>
  )
}
