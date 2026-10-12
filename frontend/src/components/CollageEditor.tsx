import { ImagePlus, Trash2 } from 'lucide-react'
import { AssetImg } from '../lib/assets'
import { COLLAGES } from '../lib/collages'
import type { CollageProps } from '../types'

/** Change what is in a photo frame: the pictures and the writing under them. */
export function CollageEditor({
  value, accent, onChange, onPick,
}: { value: CollageProps; accent: string; onChange: (p: Partial<CollageProps>) => void; onPick: (slot: number) => void }) {
  const def = COLLAGES[value.kind]
  if (!def || def.slots.length === 0) return <p className="m-0 px-6 py-6 text-center text-[14px] text-neutral-500">This one is just decoration. Move, turn or resize it, or delete it.</p>
  const texts = value.texts ?? []
  return (
    <div className="space-y-3 px-5 pb-6">
      {def.slots.map((s, i) => {
        const src = value.photos[i]
        return (
          <div key={i} className="rounded-2xl bg-[#f6f6f8] p-3" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)' }}>
            <div className="flex items-center gap-3">
              <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#e8e8ec]">
                {src ? <AssetImg src={src} /> : <ImagePlus size={22} className="text-neutral-400" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-extrabold text-[#17171a]">{def.slots.length > 1 ? `Photo ${i + 1}` : 'Photo'}</div>
                <div className="mt-1.5 flex gap-2">
                  <button type="button" onClick={() => onPick(i)} className="h-10 rounded-full border-0 px-4 text-[13.5px] font-bold text-white" style={{ background: accent }}>{src ? 'Change' : 'Add photo'}</button>
                  {src && (
                    <button type="button" aria-label="Remove the photo" onClick={() => onChange({ photos: value.photos.map((p, k) => (k === i ? '' : p)) })} className="grid h-10 w-10 place-items-center rounded-full border-0 bg-[#fdecef] text-[#d6455d]"><Trash2 size={16} /></button>
                  )}
                </div>
              </div>
            </div>
            {s.caption && (
              <input
                value={texts[i] ?? ''} maxLength={60} placeholder="Write something under it"
                onChange={(e) => { const t = [...texts]; while (t.length < def.slots.length) t.push(''); t[i] = e.target.value; onChange({ texts: t }) }}
                className="mt-3 h-11 w-full rounded-xl border-0 bg-white px-3.5 text-[15px] font-semibold text-[#17171a] outline-none placeholder:font-medium placeholder:text-neutral-400"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.08)', fontFamily: "'Caveat', cursive", fontSize: 18 }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
