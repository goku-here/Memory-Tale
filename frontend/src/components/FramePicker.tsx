import { motion } from 'framer-motion'
import { Download, Replace } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { FrameId, PhotoProps } from '../types'
import { captionLines, frameHeight } from '../lib/items'
import { FRAMES, PhotoFrame, RADIUS_FRAMES } from './PhotoFrame'

interface Props {
  photo: PhotoProps
  width: number
  focusCaption?: boolean
  accent: string
  onFrame: (frame: FrameId) => void
  onRadius: (radius: number) => void
  onCaption: (caption: string) => void
  onReplace: () => void
  /** turn the photo into a full-width background (or back into an ordinary photo) */
  onBackground: (on: boolean) => void
  /** present when the full-quality original is stored in the cloud */
  onOriginal?: () => void
}

const PREVIEW_W = 92

/** Frame chooser for the selected photo: previews, polaroid caption, corner radius. */
export function FramePicker({ photo, focusCaption, accent, onFrame, onRadius, onCaption, onReplace, onBackground, onOriginal }: Props) {
  const capRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (focusCaption) setTimeout(() => capRef.current?.focus(), 350)
  }, [focusCaption])
  const radiusOn = RADIUS_FRAMES.includes(photo.frame)

  return (
    <div className="pb-2">
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-3 pt-1" style={{ touchAction: 'pan-x' }}>
        {FRAMES.map((f) => {
          const on = photo.frame === f.id
          const cap = f.id === 'polaroid' ? photo.caption : ''
          const nat = frameHeight(f.id, PREVIEW_W * 0.9, photo.aspect, cap)
          const fit = Math.min(1, 116 / nat) // a tall picture is shrunk to fit the tile, never cropped
          return (
            <motion.button
              key={f.id} type="button" aria-pressed={on} aria-label={f.label} whileTap={{ scale: 0.94 }}
              onClick={() => onFrame(f.id)}
              className="flex w-[104px] shrink-0 flex-col items-center gap-2 rounded-2xl border-0 bg-transparent p-2"
              style={{ boxShadow: on ? `inset 0 0 0 2px ${accent}` : 'inset 0 0 0 1px rgba(0,0,0,.06)', background: on ? `${accent}14` : '#fafafa' }}
            >
              <div className="grid h-[122px] w-full place-items-center overflow-hidden">
                <div style={{ width: PREVIEW_W * 0.9, height: nat, transform: `scale(${fit})`, flexShrink: 0 }}>
                  <PhotoFrame photo={{ ...photo, frame: f.id, caption: cap }} width={PREVIEW_W * 0.9} />
                </div>
              </div>
              <span className="text-[12px] font-bold text-neutral-600">{f.label}</span>
            </motion.button>
          )
        })}
      </div>

      <div className="space-y-5 px-5 pt-2">
        <button
          type="button" role="switch" aria-checked={!!photo.background} onClick={() => onBackground(!photo.background)}
          className="flex w-full items-center gap-3 rounded-2xl border-0 bg-neutral-100 px-4 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-[#17171a]">Use as background</span>
            <span className="block text-[12.5px] leading-snug text-neutral-500">Stretches the photo across the full width and puts it behind everything. Add stickers and photos on top.</span>
          </span>
          <span className="relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: photo.background ? accent : '#d9d9df' }}>
            <span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all" style={{ left: photo.background ? 22 : 2 }} />
          </span>
        </button>
        <motion.button
          type="button" whileTap={{ scale: 0.97 }} onClick={onReplace}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-0 bg-neutral-100 text-[15px] font-bold text-[#17171a]"
        >
          <Replace size={19} /> Change photo
        </motion.button>
        {onOriginal && (
          <motion.button
            type="button" whileTap={{ scale: 0.97 }} onClick={onOriginal}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border-0 bg-neutral-100 text-[15px] font-bold text-[#17171a]"
          >
            <Download size={19} /> Download original quality
          </motion.button>
        )}
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-neutral-400">Caption</span>
          <textarea
            ref={capRef}
            value={photo.caption}
            rows={Math.min(4, Math.max(1, captionLines(photo.caption)))}
            maxLength={120}
            disabled={photo.frame !== 'polaroid'}
            placeholder={photo.frame === 'polaroid' ? 'Write a little note… (up to 4 lines)' : 'Captions live on the Polaroid frame'}
            // the strip under the photo grows with the note, up to four lines
            onChange={(e) => { if (captionLines(e.target.value) <= 4) onCaption(e.target.value) }}
            className="block w-full resize-none rounded-2xl border-0 bg-neutral-100 px-4 py-3 text-[17px] leading-tight text-[#17171a] outline-none disabled:opacity-50"
            style={{ fontFamily: "'Caveat', cursive", fontWeight: 700 }}
          />
        </label>
        <label className="block">
          <span className="mb-1 flex justify-between text-[12px] font-bold uppercase tracking-wider text-neutral-400">
            <span>Corner radius</span><span>{Math.round(photo.radius)}px</span>
          </span>
          <input
            type="range" min={0} max={48} step={1} value={photo.radius} disabled={!radiusOn}
            onChange={(e) => onRadius(+e.target.value)}
            aria-label="Corner radius"
            className="h-11 w-full disabled:opacity-35"
            style={{ accentColor: accent }}
          />
        </label>
      </div>
    </div>
  )
}
