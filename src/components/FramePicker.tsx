import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import type { FrameId, PhotoProps } from '../types'
import { frameHeight } from '../lib/items'
import { FRAMES, PhotoFrame, RADIUS_FRAMES } from './PhotoFrame'

interface Props {
  photo: PhotoProps
  width: number
  focusCaption?: boolean
  accent: string
  onFrame: (frame: FrameId) => void
  onRadius: (radius: number) => void
  onCaption: (caption: string) => void
}

const PREVIEW_W = 92

/** Frame chooser for the selected photo: previews, polaroid caption, corner radius. */
export function FramePicker({ photo, focusCaption, accent, onFrame, onRadius, onCaption }: Props) {
  const capRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (focusCaption) setTimeout(() => capRef.current?.focus(), 350)
  }, [focusCaption])
  const radiusOn = RADIUS_FRAMES.includes(photo.frame)

  return (
    <div className="pb-2">
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-5 pb-3 pt-1" style={{ touchAction: 'pan-x' }}>
        {FRAMES.map((f) => {
          const on = photo.frame === f.id
          const h = frameHeight(f.id, PREVIEW_W, photo.aspect)
          return (
            <motion.button
              key={f.id} type="button" aria-pressed={on} aria-label={f.label} whileTap={{ scale: 0.94 }}
              onClick={() => onFrame(f.id)}
              className="flex w-[104px] shrink-0 flex-col items-center gap-2 rounded-2xl border-0 bg-transparent p-2"
              style={{ boxShadow: on ? `inset 0 0 0 2px ${accent}` : 'inset 0 0 0 1px rgba(0,0,0,.06)', background: on ? `${accent}14` : '#fafafa' }}
            >
              <div className="grid h-[122px] w-full place-items-center overflow-hidden">
                <div style={{ width: PREVIEW_W * 0.9, height: Math.min(h, 122) * 0.9 }}>
                  <PhotoFrame photo={{ ...photo, frame: f.id, caption: f.id === 'polaroid' ? photo.caption : '' }} width={PREVIEW_W * 0.9} />
                </div>
              </div>
              <span className="text-[12px] font-bold text-neutral-600">{f.label}</span>
            </motion.button>
          )
        })}
      </div>

      <div className="space-y-5 px-5 pt-2">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-neutral-400">Caption</span>
          <input
            ref={capRef}
            value={photo.caption}
            maxLength={40}
            disabled={photo.frame !== 'polaroid'}
            placeholder={photo.frame === 'polaroid' ? 'Write a little note…' : 'Captions live on the Polaroid frame'}
            onChange={(e) => onCaption(e.target.value)}
            className="h-12 w-full rounded-2xl border-0 bg-neutral-100 px-4 text-[17px] text-[#17171a] outline-none disabled:opacity-50"
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
