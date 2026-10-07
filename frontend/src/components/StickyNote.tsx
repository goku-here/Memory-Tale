import { useEffect, useRef } from 'react'

export const NOTE_COLORS = ['#FFF3A8', '#FFD1DC', '#CDEFD5', '#CFE3FA', '#E3D6F5', '#FFDDB8']

interface Props {
  text: string
  color: string
  editing: boolean
  onChange: (text: string) => void
  onDone: () => void
}

/** Pastel sticky note with a paperclip and handwritten text. Scales with its width (cqw units). */
export function StickyNote({ text, color, editing, onChange, onDone }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing) {
      const el = ref.current
      el?.focus()
      el?.setSelectionRange(el.value.length, el.value.length)
    }
  }, [editing])

  const textStyle = {
    fontFamily: "'Caveat', cursive", fontWeight: 700, fontSize: '13cqw', lineHeight: 1.15,
    color: '#4a4338', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
  } as const

  return (
    <div
      className="relative h-full w-full"
      style={{
        containerType: 'inline-size', background: color, borderRadius: '2cqw 2cqw 9cqw 2cqw',
        boxShadow: '0 1px 2px rgba(60,50,30,.16), 0 10px 18px rgba(60,50,30,.18)',
        backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,.35), rgba(255,255,255,0) 40%), linear-gradient(315deg, rgba(0,0,0,.09) 0, rgba(0,0,0,0) 14%)',
      }}
    >
      {/* paperclip */}
      <svg className="absolute" style={{ left: '50%', top: '-6cqw', width: '13cqw', transform: 'translateX(-50%) rotate(6deg)' }} viewBox="0 0 24 50" aria-hidden>
        <path d="M17 12v24a7 7 0 0 1-14 0V10a5 5 0 0 1 10 0v24a3 3 0 0 1-6 0V14" fill="none" stroke="#8d95a3" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M17 12v24a7 7 0 0 1-14 0V10a5 5 0 0 1 10 0v24a3 3 0 0 1-6 0V14" fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth=".9" strokeLinecap="round" />
      </svg>
      <div className="absolute" style={{ inset: '12cqw 9cqw 8cqw 9cqw' }}>
        {editing ? (
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onDone}
            onPointerDown={(e) => e.stopPropagation()}
            placeholder="Write something…"
            className="h-full w-full resize-none border-0 bg-transparent p-0 outline-none"
            style={textStyle}
            data-ui
          />
        ) : (
          <div className="h-full w-full overflow-hidden" style={textStyle}>
            {text || <span style={{ opacity: 0.4 }}>Double-tap to write</span>}
          </div>
        )}
      </div>
    </div>
  )
}
