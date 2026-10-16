import { Zip, ZipPassThrough } from 'fflate'

/** ZIP parts stay below this so a phone never holds one huge file in memory */
const PART_BYTES = 150 * 1024 * 1024

export const slugName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'book'

function save(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10000)
}

/**
 * Renders the pages one by one and puts them in a ZIP, inside a folder: `folder/page-01.png`, `page-02.png`, ...
 * Very big books are split into several ZIPs (all with the same folder name and continuing numbers).
 */
export async function zipPages(
  folder: string,
  count: number,
  render: (index: number) => Promise<Blob>,
  onProgress: (done: number) => void,
) {
  const parts: Blob[] = []
  const pending: Promise<void>[] = []
  let zip: Zip | null = null
  let size = 0
  const digits = Math.max(2, String(count).length)

  const open = () => {
    size = 0
    const mine: Uint8Array[] = []
    let finish!: () => void
    pending.push(new Promise<void>((r) => { finish = r }))
    zip = new Zip((err, chunk, final) => {
      if (err) { finish(); return }
      mine.push(chunk)
      if (final) { parts.push(new Blob(mine as BlobPart[], { type: 'application/zip' })); finish() }
    })
  }
  const close = () => { zip?.end(); zip = null }

  for (let i = 0; i < count; i++) {
    onProgress(i)
    const blob = await render(i)
    const data = new Uint8Array(await blob.arrayBuffer())
    if (zip && size + data.length > PART_BYTES && size > 0) close()
    if (!zip) open()
    const f = new ZipPassThrough(`${folder}/page-${String(i + 1).padStart(digits, '0')}.png`) // PNG is already compressed: store it
    zip!.add(f)
    f.push(data, true)
    size += data.length
  }
  onProgress(count)
  close()
  await Promise.all(pending)
  parts.forEach((b, i) => setTimeout(() => save(b, parts.length === 1 ? `${folder}.zip` : `${folder}-part-${i + 1}.zip`), i * 800))
  return { parts: parts.length }
}
