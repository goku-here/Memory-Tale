import { Zip, ZipPassThrough } from 'fflate'
import type { CanvasItem, PhotoProps } from '../types'
import { resolveRef } from './assets'

/** ZIP parts are kept below this so a phone never has to hold one huge file in memory */
const PART_BYTES = 180 * 1024 * 1024

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'photo'
const extOf = (mime: string, name?: string) => {
  const fromName = name?.split('.').pop()?.toLowerCase()
  if (fromName && /^[a-z0-9]{2,5}$/.test(fromName)) return fromName
  return ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic', 'image/gif': 'gif' } as Record<string, string>)[mime] ?? 'jpg'
}

function save(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 8000)
}

export interface ZipProgress { done: number; total: number; fallback: number }

/**
 * Collects every photo of a book (full quality when available, otherwise the synced copy) into one or more ZIP files.
 */
export async function downloadBookZip(
  title: string,
  memoryId: string,
  items: CanvasItem[],
  getOriginal: (photo: PhotoProps) => Promise<Blob | null>,
  onProgress: (p: ZipProgress) => void,
) {
  const photos = items
    .filter((i): i is Extract<CanvasItem, { type: 'photo' }> => i.type === 'photo')
    .sort((a, b) => Math.round(a.y / 120) - Math.round(b.y / 120) || a.x - b.x)
  const base = slug(title)
  let part = 1
  let chunks: Uint8Array[] = []
  let zip: Zip | null = null
  let size = 0
  let fallback = 0
  const finished: Promise<void>[] = []

  const open = () => {
    chunks = []
    size = 0
    const mine = chunks
    let resolveFinal!: () => void
    const done = new Promise<void>((r) => { resolveFinal = r })
    const n = part
    zip = new Zip((err, chunk, final) => {
      if (err) { resolveFinal(); return }
      mine.push(chunk)
      if (final) { save(new Blob(mine as BlobPart[], { type: 'application/zip' }), `${base}-part-${n}.zip`); resolveFinal() }
    })
    finished.push(done)
  }
  const close = async () => { if (zip) { zip.end(); zip = null; part++; await new Promise((r) => setTimeout(r, 700)) } }

  for (let i = 0; i < photos.length; i++) {
    onProgress({ done: i, total: photos.length, fallback })
    const p = photos[i].props
    let blob = await getOriginal(p).catch(() => null)
    if (!blob) {
      fallback++
      const url = await resolveRef(memoryId, p.src)
      blob = url ? await (await fetch(url)).blob() : null
    }
    if (!blob) continue
    if (!zip) open()
    if (size + blob.size > PART_BYTES && size > 0) { await close(); open() }
    const data = new Uint8Array(await blob.arrayBuffer())
    const name = `${String(i + 1).padStart(3, '0')}-${slug(p.caption || title)}.${extOf(blob.type, undefined)}`
    const f = new ZipPassThrough(name) // photos are already compressed: store, don't re-compress
    zip!.add(f)
    f.push(data, true)
    size += data.length
  }
  onProgress({ done: photos.length, total: photos.length, fallback })
  await close()
  await Promise.all(finished)
  return { photos: photos.length, parts: part - 1, fallback }
}
