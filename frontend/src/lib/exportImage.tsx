import { toBlob } from 'html-to-image'
import { embeddedFontCSS } from './exportStory'
import { createRoot } from 'react-dom/client'
import { ItemBody } from '../components/CanvasItem'
import { formatDate } from '../components/BookCard'
import { getTheme } from '../components/ThemeEngine'
import { ThreadsSvg } from '../components/Threads'
import { repo } from '../data/repo'
import { resolveItemAssets } from '../data/sync'
import type { CanvasItem, Memory } from '../types'

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function ExportView({ memory, items, width }: { memory: Memory; items: CanvasItem[]; width: number }) {
  const theme = getTheme(memory.themeId)
  const photos = items.filter((i) => i.type === 'photo').length
  const solid = items.filter((i) => i.type !== 'thread')
  const top = solid.length ? Math.min(...solid.map((i) => i.y - i.height / 2)) : 0
  const bottom = solid.length ? Math.max(...solid.map((i) => i.y + i.height / 2)) : 300
  const offset = Math.max(0, top - 40)
  const bodyH = Math.max(320, bottom - offset + 60)
  return (
    <div
      id="keepsake-export"
      style={{
        width, background: theme.canvasBg, position: 'relative', overflow: 'hidden', fontFamily: 'Manrope, sans-serif',
        ['--t-pin' as string]: theme.palette[0], ['--t-pin2' as string]: theme.palette[1],
      }}
    >
      <div style={{ padding: '36px 24px 6px', textAlign: 'center' }}>
        <div style={{ fontFamily: theme.font, fontSize: 38, lineHeight: 1.1, color: theme.palette[3] ?? '#17171a' }}>{memory.title}</div>
        <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: '#9a9aa5' }}>
          {photos} {photos === 1 ? 'Photo' : 'Photos'} • {formatDate(memory.date)}
        </div>
      </div>
      <div
        style={{
          position: 'relative', height: bodyH, marginTop: 8,
          backgroundImage: `radial-gradient(${theme.dot} 1.5px, transparent 1.7px)`, backgroundSize: '22px 22px',
        }}
      >
        {[...items].filter((i) => i.type !== 'thread').sort((a, b) => a.zIndex - b.zIndex).map((it) => (
          <div
            key={it.id}
            style={{
              position: 'absolute', left: `${it.x}%`, top: it.y - offset, width: it.width, height: it.type === 'text' ? 'auto' : it.height,
              transform: `translate(-50%,-50%) rotate(${it.rotation}deg)`, zIndex: it.zIndex,
            }}
          >
            <ItemBody item={it} />
          </div>
        ))}
        <ThreadsSvg items={items} canvasW={width} offsetY={offset} />
      </div>
      <div style={{ padding: '10px 0 22px', textAlign: 'center', fontSize: 12, fontWeight: 800, letterSpacing: '.12em', color: '#b5b5bd' }}>
        MADE WITH MEMORY TALE
      </div>
    </div>
  )
}

/** Renders the memory's canvas off-screen and returns it as one long PNG. */
export async function exportMemoryPng(memory: Memory): Promise<Blob> {
  const doc = await repo.loadCanvas(memory.id)
  const items = await Promise.all(((doc?.items as CanvasItem[]) ?? []).map((i) => resolveItemAssets(memory.id, i)))
  const width = Math.round(doc?.width ?? 390)

  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:0;top:0;width:${width}px;opacity:0;pointer-events:none;z-index:-1;`
  document.body.appendChild(host)
  const root = createRoot(host)
  try {
    root.render(<ExportView memory={memory} items={items} width={width} />)
    await wait(80)
    await document.fonts?.ready
    const hasMap = items.some((i) => i.type === 'map')
    await wait(hasMap ? 2200 : 500)
    const node = host.firstElementChild as HTMLElement
    const h = node.offsetHeight
    const pixelRatio = Math.max(1, Math.min(2.5, 12000 / h))
    const fontEmbedCSS = await embeddedFontCSS(node)
    const blob = await toBlob(node, { pixelRatio, cacheBust: true, backgroundColor: getTheme(memory.themeId).canvasBg, ...(fontEmbedCSS ? { fontEmbedCSS } : {}) })
    if (!blob) throw new Error('Export failed')
    return blob
  } finally {
    root.unmount()
    host.remove()
  }
}
