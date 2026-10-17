import { Plus } from 'lucide-react'
import { useRef } from 'react'
import { AssetImg } from '../lib/assets'
import { COLLAGES, FrameArt, type Slot } from '../lib/collages'
import type { CollageProps } from '../types'

/** a slot's picture area as percentages of the drawing */
const box = (s: Slot, w: number, h: number) => ({ left: `${(s.x / w) * 100}%`, top: `${(s.y / h) * 100}%`, width: `${(s.w / w) * 100}%`, height: `${(s.h / h) * 100}%` })

/**
 * A photo frame or page piece: drawn art, with the person's pictures in the slots.
 * An empty slot shows a plus; tapping it (or a filled slot while selected) picks a picture.
 * Polaroid-style slots also carry a line of writing under the picture.
 */
export function CollageBody({
  collage, selected, onSlot, onView,
}: { collage: CollageProps; selected: boolean; onSlot?: (i: number) => void; onView?: (i: number) => void }) {
  const def = COLLAGES[collage.kind]
  const down = useRef<{ x: number; y: number; sel: boolean } | null>(null)
  if (!def) return null
  const { w, h } = def
  return (
    <div className="relative h-full w-full" style={{ containerType: 'inline-size' }}>
      {def.underImg && <img src={def.underImg} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />}
      <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden>
        {def.boardArt && collage.board ? def.boardArt(collage.board) : def.under}
        {def.slots.map((s, i) => <FrameArt key={i} s={s} />)}
      </svg>

      {def.slots.map((s, i) => {
        const src = collage.photos[i]
        const text = collage.texts?.[i] ?? ''
        const r = s.rot ?? 0
        return (
          <div key={i} className="absolute" style={{ ...box(s, w, h), transform: `rotate(${r}deg)` }}>
            <button
              type="button" aria-label={src ? `Photo ${i + 1}` : `Add photo ${i + 1}`}
              onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY, sel: selected } }}
              onClick={(e) => {
                const d = down.current
                if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return
                if (!src || d.sel) onSlot?.(i)
                else onView?.(i)
              }}
              className="absolute inset-0 grid place-items-center overflow-hidden border-0 p-0"
              style={{ borderRadius: s.shape === 'disc' ? '50%' : s.shape === 'plain' || s.shape === 'bare' ? '1.4cqw' : 0, cursor: 'pointer', ...(s.shape === 'disc' ? { WebkitMaskImage: 'radial-gradient(circle closest-side at center, transparent 0 36%, #000 36.6%)', maskImage: 'radial-gradient(circle closest-side at center, transparent 0 36%, #000 36.6%)' } : {}), background: !src && onSlot && s.shape === 'bare' ? 'rgba(255,255,255,.38)' : 'transparent' }}
            >
              {src ? (
                <AssetImg src={src} />
              ) : onSlot ? (
                <span className="grid place-items-center rounded-full bg-white/80 text-neutral-500" style={{ width: '11cqw', height: '11cqw', boxShadow: '0 0 0 .6cqw rgba(0,0,0,.12)' }}>
                  <Plus style={{ width: '6.4cqw', height: '6.4cqw' }} strokeWidth={3} />
                </span>
              ) : null}
            </button>
            {s.caption && (text || onSlot) && (
              <div
                className="pointer-events-none absolute inset-x-0 flex items-center justify-center overflow-hidden text-center"
                style={{ top: '100%', height: `${s.w * 0.25}cqw`, fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: `${s.w * 0.17}cqw`, lineHeight: 1.05, color: text ? '#4a4a55' : '#b9b9c1' }}
              >
                <span className="max-h-full max-w-full overflow-hidden whitespace-pre-wrap break-words">{text || (onSlot && selected ? 'Write something' : '')}</span>
              </div>
            )}
          </div>
        )
      })}

      <svg viewBox={`0 0 ${w} ${h}`} className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden>
        {def.over}
      </svg>
      {def.overImg && <img src={def.overImg} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full" />}
    </div>
  )
}
