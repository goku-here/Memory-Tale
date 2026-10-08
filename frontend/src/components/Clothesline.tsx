import { Plus } from 'lucide-react'
import { AssetImg } from '../lib/assets'
import { useRef } from 'react'
import type { ClotheslineProps } from '../types'

const PINS = [
  { x: 18, rot: -5 },
  { x: 50, rot: 3, drop: 1.5 },
  { x: 82, rot: 7 },
]
const yAt = (x: number) => {
  const t = (x + 2) / 104
  return (1 - t) ** 2 * 6 + 2 * (1 - t) * t * 20 + t ** 2 * 5
}

/** Three Polaroids hanging from a twine line with clothespins; tap a slot to add a photo. */
export function ClotheslineBody({
  line, selected, onSlot, onView,
}: { line: ClotheslineProps; selected: boolean; onSlot?: (i: number) => void; onView?: (i: number) => void }) {
  const down = useRef<{ x: number; y: number; sel: boolean } | null>(null)
  return (
    <div className="relative h-full w-full" style={{ containerType: 'inline-size' }}>
      <svg viewBox="0 0 100 62" className="absolute inset-0 h-full w-full" style={{ overflow: 'visible' }} aria-hidden>
        <path d="M-2 6 Q50 20 102 5" fill="none" stroke="#9c7a4d" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M-2 6.6 Q50 20.6 102 5.6" fill="none" stroke="#c9a572" strokeWidth=".5" strokeLinecap="round" strokeDasharray="2 1.4" />
      </svg>
      {PINS.map((p, i) => {
        const y = yAt(p.x) + (p.drop ?? 0)
        const src = line.photos[i]
        return (
          <div key={i} className="absolute" style={{ left: `${p.x - 15}cqw`, top: `${y + 0.5}cqw`, width: '30cqw', transform: `rotate(${p.rot}deg)`, transformOrigin: '50% 0' }}>
            <button
              type="button" aria-label={src ? `Photo ${i + 1}` : `Add photo ${i + 1}`}
              onPointerDown={(e) => { down.current = { x: e.clientX, y: e.clientY, sel: selected } }}
              onClick={(e) => {
                const d = down.current
                if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) return
                if (!src || d.sel) onSlot?.(i)
                else onView?.(i)
              }}
              className="relative block w-full border-0 bg-white p-0"
              style={{ padding: '2cqw 2cqw 7.5cqw', boxShadow: '0 1px 2px rgba(40,30,30,.18), 0 8px 14px rgba(40,30,30,.2)', cursor: 'pointer' }}
            >
              <div className="relative grid w-full place-items-center overflow-hidden" style={{ aspectRatio: '1', background: '#ececef' }}>
                {src ? (
                  <AssetImg src={src} />
                ) : (
                  <span className="grid place-items-center rounded-full text-neutral-400" style={{ width: '9cqw', height: '9cqw', border: '.5cqw dashed #b5b5bd' }}>
                    <Plus style={{ width: '5cqw', height: '5cqw' }} strokeWidth={3} />
                  </span>
                )}
              </div>
            </button>
            {/* clothespin */}
            <div
              className="pointer-events-none absolute"
              style={{
                left: '50%', top: '-5cqw', width: '4.6cqw', height: '11.5cqw', marginLeft: '-2.3cqw', borderRadius: '1.2cqw',
                background: 'linear-gradient(90deg,#d9b27c,#c79a5f 50%,#b8864d)', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
              }}
            >
              <i className="absolute inset-x-0" style={{ top: '40%', height: '.5cqw', background: 'rgba(80,50,20,.45)' }} />
              <i className="absolute left-1/2 -ml-px" style={{ top: '46%', bottom: '3%', width: '.5cqw', background: 'rgba(80,50,20,.35)' }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
