import { toBlob } from 'html-to-image'
import { createRoot } from 'react-dom/client'
import { ItemBody } from '../components/CanvasItem'
import { getTheme } from '../components/ThemeEngine'
import { ThreadsSvg } from '../components/Threads'
import { AssetCtx } from './assets'
import { resolveItemAssets } from '../data/sync'
import type { CanvasItem, Memory } from '../types'

export const STORY_W = 1080
export const STORY_H = 1920
/** Instagram's own UI covers these parts of a story (fractions of the frame height) */
export const SAFE_TOP = 0.13
export const SAFE_BOTTOM = 0.18

/* ---- settings (kept in one place so the watermark can become a premium option later) ---- */
const KEY_MARK = 'mt-story-mark'
const KEY_DOTS = 'mt-story-dots'
const read = (k: string, d: boolean) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1' } catch { return d } }
const write = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0') } catch { /* private mode */ } }
export const storyPrefs = {
  /** "Made with Memory Tale" mark. `locked` flips to true when removing it becomes a paid option */
  locked: false,
  mark: () => storyPrefs.locked || read(KEY_MARK, true),
  setMark: (v: boolean) => write(KEY_MARK, v),
  dots: () => read(KEY_DOTS, false),
  setDots: (v: boolean) => write(KEY_DOTS, v),
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const frameHeightFor = (canvasW: number) => (canvasW * 16) / 9

function StoryView({ memory, items, canvasW, frameY, dots, mark }: { memory: Memory; items: CanvasItem[]; canvasW: number; frameY: number; dots: boolean; mark: boolean }) {
  const theme = getTheme(memory.themeId)
  const h = frameHeightFor(canvasW)
  return (
    <div
      style={{
        width: canvasW, height: h, background: theme.canvasBg, position: 'relative', overflow: 'hidden', fontFamily: 'Manrope, sans-serif',
        ['--t-pin' as string]: theme.palette[0], ['--t-pin2' as string]: theme.palette[1],
        backgroundImage: dots ? `radial-gradient(${theme.dot} 1.5px, transparent 1.7px)` : undefined,
        backgroundSize: dots ? '22px 22px' : undefined,
        backgroundPosition: dots ? `0 ${-(frameY % 22)}px` : undefined,
      }}
    >
      {[...items].filter((i) => i.type !== 'thread').sort((a, b) => a.zIndex - b.zIndex).map((it) => (
        <div
          key={it.id}
          style={{
            position: 'absolute', left: `${it.x}%`, top: it.y - frameY, width: it.width, height: it.type === 'text' ? 'auto' : it.height,
            transform: `translate(-50%,-50%) rotate(${it.rotation}deg)`, zIndex: it.zIndex,
          }}
        >
          <ItemBody item={it} />
        </div>
      ))}
      <ThreadsSvg items={items} canvasW={canvasW} offsetY={frameY} />
      {mark && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: h * 0.065, textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: '.14em', color: 'rgba(23,23,26,.38)', zIndex: 9999 }}>
          MADE WITH MEMORY TALE
        </div>
      )}
    </div>
  )
}

const isIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const isSafari = () => /Safari/.test(navigator.userAgent) && !/Chrom|Android|Edg/.test(navigator.userAgent)

async function imagesReady(node: HTMLElement) {
  await Promise.all([...node.querySelectorAll('img')].map(async (img) => {
    try { if (!img.complete) await new Promise((r) => { img.onload = r; img.onerror = r; setTimeout(r, 4000) }); await img.decode() } catch { /* broken image: skip it */ }
  }))
}

async function fontsReady(node: HTMLElement) {
  const fams = new Set<string>()
  node.querySelectorAll<HTMLElement>('*').forEach((el) => { const f = getComputedStyle(el).fontFamily; if (f) fams.add(f) })
  await Promise.all([...fams].map((f) => document.fonts?.load(`16px ${f}`, 'Aa').catch(() => [])))
  await document.fonts?.ready
}

/** scale whatever html-to-image produced to exactly 1080 x 1920 */
async function normalise(blob: Blob): Promise<Blob> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const c = document.createElement('canvas')
    c.width = STORY_W
    c.height = STORY_H
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, 0, 0, STORY_W, STORY_H)
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Export failed'))), 'image/png'))
  } finally { URL.revokeObjectURL(url) }
}

export interface StoryOptions { frameY: number; canvasW: number; dots: boolean; mark: boolean }

/**
 * Renders just what is inside the story frame, off-screen, as a 1080 x 1920 PNG.
 * Only the items are drawn: no dim mask, safe-zone guides, handles or selection UI.
 */
export async function exportStoryPng(memory: Memory, current: CanvasItem[], o: StoryOptions): Promise<Blob> {
  const items = await Promise.all(current.map((i) => resolveItemAssets(memory.id, i)))
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:0;top:0;width:${o.canvasW}px;opacity:0;pointer-events:none;z-index:-1;`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(
      <AssetCtx.Provider value={{ memoryId: memory.id, root: null }}>
        <StoryView memory={memory} items={items} canvasW={o.canvasW} frameY={o.frameY} dots={o.dots} mark={o.mark} />
      </AssetCtx.Provider>,
    )
    await wait(80)
    const node = host.firstElementChild as HTMLElement
    await fontsReady(node)
    await imagesReady(node)
    await wait(items.some((i) => i.type === 'map') ? 2200 : 350)
    await imagesReady(node)
    const opts = { pixelRatio: STORY_W / o.canvasW, cacheBust: true, backgroundColor: getTheme(memory.themeId).canvasBg }
    // iOS Safari often paints the first pass blank or without images: render once and throw it away
    if (isIOS() || isSafari()) { await toBlob(node, opts).catch(() => null); await wait(120) }
    const blob = await toBlob(node, opts)
    if (!blob) throw new Error('Export failed')
    return await normalise(blob)
  } finally {
    root.unmount()
    host.remove()
  }
}
