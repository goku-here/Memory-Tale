import { createContext, useContext, useEffect, useRef, useState, type CSSProperties } from 'react'
import { loadAssetData } from '../data/sync'

/** Which book the images belong to (assets live under it) and which element scrolls (for lazy loading). */
interface Ctx { memoryId: string; root: Element | null }
export const AssetCtx = createContext<Ctx>({ memoryId: '', root: null })

const REF = 'asset:'
export const isRef = (s?: string): s is string => !!s && s.startsWith(REF)

/** id -> data URL, kept for the session so scrolling back never re-fetches */
const mem = new Map<string, string>()

export async function resolveRef(memoryId: string, src: string): Promise<string> {
  if (!isRef(src)) return src
  const id = src.slice(REF.length)
  const hit = mem.get(id)
  if (hit) return hit
  const data = await loadAssetData(memoryId, id)
  if (data) mem.set(id, data)
  return data ?? ''
}

/** true once the element has come within `margin` px of the scroll area */
function useNear(root: Element | null, margin = 700) {
  const ref = useRef<HTMLSpanElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    if (typeof IntersectionObserver === 'undefined') { setNear(true); return }
    const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setNear(true); io.disconnect() } }, { root, rootMargin: `${margin}px 0px` })
    io.observe(el)
    return () => io.disconnect()
  }, [root, near, margin])
  return [ref, near] as const
}

interface Props {
  src: string
  /** tiny blurred preview shown instantly while the real image loads */
  thumb?: string
  fit?: 'cover' | 'contain'
  /** transparent artwork (stickers): never paint a placeholder box behind it */
  bare?: boolean
  style?: CSSProperties
  alt?: string
}

/**
 * Image that understands `asset:<id>` references: shows the blurred preview straight away and
 * downloads the real picture only when it is near the screen. Plain data URLs render directly.
 */
export function AssetImg({ src, thumb, fit = 'cover', bare, style, alt = '' }: Props) {
  const { memoryId, root } = useContext(AssetCtx)
  const needs = isRef(src)
  const [data, setData] = useState<string | null>(() => (needs ? mem.get(src.slice(REF.length)) ?? null : src))
  const [ready, setReady] = useState(false)
  const [boxRef, near] = useNear(root)

  useEffect(() => {
    if (!needs) { setData(src); return }
    const cached = mem.get(src.slice(REF.length))
    if (cached) { setData(cached); return }
    if (!near) return
    let alive = true
    void resolveRef(memoryId, src).then((d) => { if (alive && d) setData(d) })
    return () => { alive = false }
  }, [src, needs, near, memoryId])

  const layer: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: fit, pointerEvents: 'none', userSelect: 'none' }
  return (
    <span ref={boxRef} style={{ display: 'block', position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: bare || thumb || ready ? 'transparent' : '#e9e9ee', ...style }}>
      {thumb && !(data && ready) && (
        <img src={thumb} alt="" draggable={false} aria-hidden style={{ ...layer, filter: 'blur(10px)', transform: 'scale(1.15)' }} />
      )}
      {data && (
        <img
          src={data} alt={alt} draggable={false} decoding="async" onLoad={() => setReady(true)}
          style={{ ...layer, opacity: ready ? 1 : 0, transition: 'opacity .35s ease' }}
        />
      )}
    </span>
  )
}

/** Resolves an image reference (data URL or `asset:` id) to a data URL; null while loading or when empty. */
export function useAssetSrc(src: string): string | null {
  const { memoryId } = useContext(AssetCtx)
  const [data, setData] = useState<string | null>(() => (!src ? null : isRef(src) ? mem.get(src.slice(REF.length)) ?? null : src))
  useEffect(() => {
    if (!src) { setData(null); return }
    if (!isRef(src)) { setData(src); return }
    const hit = mem.get(src.slice(REF.length))
    if (hit) { setData(hit); return }
    let alive = true
    void resolveRef(memoryId, src).then((d) => { if (alive && d) setData(d) })
    return () => { alive = false }
  }, [src, memoryId])
  return data
}
