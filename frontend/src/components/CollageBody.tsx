import { Plus } from 'lucide-react'
import { useRef } from 'react'
import { AssetImg } from '../lib/assets'
import { COLLAGES, FrameArt, type Slot } from '../lib/collages'
import type { CollageProps } from '../types'

/** pixel-perfect rectangle of a slot's picture, as percentages of the drawing */
const box = (s: Slot, w: number, h: number) => ({ left: `${(s.x / w) * 100}%`, top: `${(s.y / h) * 100}%`, width: `${(s.w / w) * 100}%`, height: `${(s.h / h) * 100}%` })

/**
 * A photo frame or page template: drawn art, with the person's pictures in the slots.
 * An empty slot shows a plus; tapping it (or a filled slot while selected) picks a picture.
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
      <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden>
        {def.under}
        {def.slots.map((s, i) => (s.shape === 'plain' && def.group === 'frames' && def.label.startsWith('Ticket') ? null : <FrameArt key={i} s={s} />))}
      </svg>

      {def.slots.map((s, i) => {
        const src = collage.photos[i]
        // the slot art above was drawn into the SVG; here the real picture sits exactly on top of it
        return (
          <button
            key={i} type="button" aria-label={src ? `Photo ${i + 1}` : `Add photo ${i + 1}`}
            onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY, sel: selected } }}
            onClick={(e) => {
              const d = down.current
              if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return
              if (!src || d.sel) onSlot?.(i)
              else onView?.(i)
            }}
            className="absolute grid place-items-center overflow-hidden border-0 bg-transparent p-0"
            style={{ ...box(s, w, h), transform: `rotate(${s.rot ?? 0}deg)`, borderRadius: s.shape === 'plain' ? '1.4cqw' : 0, cursor: 'pointer' }}
          >
            {src ? (
              <AssetImg src={src} />
            ) : onSlot ? (
              <span className="grid place-items-center rounded-full bg-white/80 text-neutral-500" style={{ width: '11cqw', height: '11cqw', boxShadow: '0 0 0 .6cqw rgba(0,0,0,.12)' }}>
                <Plus style={{ width: '6.4cqw', height: '6.4cqw' }} strokeWidth={3} />
              </span>
            ) : null}
          </button>
        )
      })}

      <svg viewBox={`0 0 ${w} ${h}`} className="pointer-events-none absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden>
        {def.over}
      </svg>
    </div>
  )
}
