import { ImagePlus, Trash2 } from 'lucide-react'
import { AssetImg } from '../lib/assets'
import { BOARD_COLORS, COLLAGES } from '../lib/collages'
import { CustomColor } from './ColorPicker'
import type { CollageProps } from '../types'

/** Change what is in a photo frame: the pictures and the writing under them. */
export function CollageEditor({
  value, accent, onChange, onPick, onBackground,
}: { value: CollageProps; accent: string; onChange: (p: Partial<CollageProps>) => void; onPick: (slot: number) => void; onBackground?: (on: boolean) => void }) {
  const def = COLLAGES[value.kind]
  if (!def || def.slots.length === 0) return <p className="m-0 px-6 py-6 text-center text-[14px] text-neutral-500">This one is just decoration. Move, turn or resize it, or delete it.</p>
  const texts = value.texts ?? []
  return (
    <div className="space-y-3 px-5 pb-6">
      {onBackground && (
        <button
          type="button" role="switch" aria-checked={!!value.background} onClick={() => onBackground(!value.background)}
          className="flex min-h-14 w-full items-center justify-between gap-3 rounded-2xl border-0 bg-[#f6f6f8] px-4 text-left"
          style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)' }}
        >
          <span>
            <span className="block text-[14.5px] font-extrabold text-[#17171a]">Use as background</span>
            <span className="block text-[12.5px] font-medium text-neutral-500">Fills the page width, behind everything else</span>
          </span>
          <span className="relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: value.background ? accent : '#d4d4da' }}>
            <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-[left]" style={{ left: value.background ? 22 : 2 }} />
          </span>
        </button>
      )}
      {def.boardArt && (
        <div className="rounded-2xl bg-[#f6f6f8] p-3" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)' }}>
          <div className="mb-1 text-[14px] font-extrabold text-[#17171a]">Board colour</div>
          <div className="flex flex-wrap items-center gap-0.5" role="radiogroup" aria-label="Board colour">
            {BOARD_COLORS.map((c) => {
              const on = (value.board ?? '#FFFFFF').toLowerCase() === c.toLowerCase()
              return (
                <button key={c} type="button" role="radio" aria-checked={on} aria-label={c} onClick={() => onChange({ board: c })} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-transparent">
                  <span className="h-8 w-8 rounded-full" style={{ background: c, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${accent}` : 'inset 0 0 0 1px rgba(0,0,0,.2)' }} />
                </button>
              )
            })}
            <CustomColor
              value={value.board ?? '#FFFFFF'} listed={BOARD_COLORS.some((c) => c.toLowerCase() === (value.board ?? '#FFFFFF').toLowerCase())}
              accent={accent} onPick={(c) => onChange({ board: c })} cell="h-11 w-11" dot={32}
            />
          </div>
        </div>
      )}
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
