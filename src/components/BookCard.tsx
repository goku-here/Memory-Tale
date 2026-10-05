import { motion } from 'framer-motion'
import { useRef, type CSSProperties, type Ref } from 'react'
import type { Memory } from '../types'
import { getTheme } from './ThemeEngine'
import { shade } from '../lib/color'

const GRAIN =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' seed='4' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .9 -.15'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>\")"
const WEAVE =
  'repeating-linear-gradient(115deg, rgba(255,255,255,.07) 0 1px, transparent 1px 3px), repeating-linear-gradient(25deg, rgba(0,0,0,.05) 0 1px, transparent 1px 4px)'

export function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function BookCover({
  memory,
  ref,
  className = '',
  style,
}: {
  memory: Pick<Memory, 'title' | 'themeId' | 'cover' | 'date' | 'members'>
  ref?: Ref<HTMLDivElement>
  className?: string
  style?: CSSProperties
}) {
  const theme = getTheme(memory.themeId)
  const { cover } = memory
  const base = cover.type === 'color' ? cover.value : cover.avg ?? '#9DB7D5'
  const dark = (cover.tone ?? 'dark') === 'dark'
  const accent = shade(base, 0.2)
  const ink = dark ? shade(base, 0.62) : '#FFFFFF'
  const members = memory.members?.length
    ? memory.members
    : [{ id: 'me', name: 'You', color: theme.palette[0] }]

  return (
    <div
      ref={ref}
      className={`relative w-full ${className}`}
      style={{ aspectRatio: '3 / 4', containerType: 'inline-size', ...style }}
    >
      {/* ribbon bookmark (behind the cover so it emerges from below) */}
      <div
        aria-hidden
        className="absolute"
        style={{
          left: '10cqw', bottom: '-9cqw', width: '5.2cqw', height: '14cqw',
          background: `linear-gradient(90deg, ${shade(base, 0.16)}, ${accent})`,
          clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)',
          filter: 'drop-shadow(0 .4cqw .6cqw rgba(0,0,0,.25))',
        }}
      />
      {/* cover */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          borderRadius: '2.2cqw 5cqw 5cqw 2.2cqw',
          background: cover.type === 'color' ? base : `#ddd center / cover url(${cover.value})`,
          boxShadow:
            '0 1.2cqw 2cqw rgba(30,35,50,.14), 0 5cqw 9cqw rgba(30,35,50,.18), inset 0 0 0 .3cqw rgba(255,255,255,.18)',
        }}
      >
        {/* leather grain */}
        <div aria-hidden className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.22, mixBlendMode: 'multiply' }} />
        <div aria-hidden className="absolute inset-0" style={{ backgroundImage: WEAVE, opacity: 0.8, mixBlendMode: 'soft-light' }} />
        <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,.22), rgba(255,255,255,0) 45%, rgba(0,0,0,.08))' }} />
        {/* spine shading */}
        <div aria-hidden className="absolute inset-y-0 left-0" style={{ width: '9cqw', background: 'linear-gradient(90deg, rgba(0,0,0,.26), rgba(0,0,0,.08) 55%, rgba(255,255,255,.12) 78%, rgba(0,0,0,0))' }} />
        <div aria-hidden className="absolute inset-y-0" style={{ left: '9.5cqw', width: '.5cqw', background: 'rgba(0,0,0,.12)', boxShadow: '.4cqw 0 0 rgba(255,255,255,.14)' }} />

        {/* title */}
        <div className="absolute" style={{ left: '15cqw', right: '19cqw', top: '13cqw' }}>
          <h3
            className="m-0 break-words"
            style={{
              fontFamily: theme.font, color: ink, fontSize: '11.5cqw', lineHeight: 1.08, fontWeight: 600,
              display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              textShadow: dark ? '0 .25cqw 0 rgba(255,255,255,.28)' : '0 .4cqw 1.2cqw rgba(0,0,0,.35)',
            }}
          >
            {memory.title || 'Untitled'}
          </h3>
        </div>

        {/* date + avatars */}
        <div className="absolute flex items-center justify-between" style={{ left: '15cqw', right: '19cqw', bottom: '7cqw' }}>
          <span style={{ color: ink, opacity: 0.85, fontSize: '3.7cqw', fontWeight: 700, letterSpacing: '.04em' }}>
            {formatDate(memory.date)}
          </span>
          <div className="flex" aria-label={`${members.length} member${members.length > 1 ? 's' : ''}`}>
            {members.slice(0, 3).map((m, i) => (
              <span
                key={m.id}
                className="grid place-items-center rounded-full font-bold text-white"
                style={{
                  width: '7.6cqw', height: '7.6cqw', fontSize: '3.6cqw', background: m.color,
                  marginLeft: i ? '-2.4cqw' : 0, boxShadow: '0 0 0 .6cqw rgba(255,255,255,.85)',
                }}
              >
                {m.name.slice(0, 1).toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        {/* elastic band */}
        <div
          aria-hidden
          className="absolute inset-y-0"
          style={{
            right: '10cqw', width: '5.4cqw',
            background: `linear-gradient(90deg, ${shade(base, 0.2)}, ${accent} 45%, ${shade(base, 0.26)})`,
            boxShadow: '-.3cqw 0 1cqw rgba(0,0,0,.18), .3cqw 0 1cqw rgba(0,0,0,.14)',
          }}
        >
          <div className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.18, mixBlendMode: 'multiply' }} />
        </div>
      </div>
    </div>
  )
}

interface BookCardProps {
  memory: Memory
  index: number
  onOpen: (memory: Memory, rect: DOMRect) => void
  onLongPress: (memory: Memory) => void
  hidden?: boolean
}

export function BookCard({ memory, index, onOpen, onLongPress, hidden }: BookCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const start = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  const clear = () => {
    window.clearTimeout(timer.current)
    start.current = null
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.94 }}
      animate={{ opacity: hidden ? 0 : 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 260, damping: 24, delay: Math.min(index, 8) * 0.06 }}
      layout="position"
    >
      <motion.button
        type="button"
        aria-label={`Open ${memory.title}`}
        className="no-select block w-full cursor-pointer border-0 bg-transparent p-0 text-left outline-none"
        style={{ touchAction: 'manipulation' }}
        whileTap={{ scale: 0.96 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          fired.current = false
          start.current = { x: e.clientX, y: e.clientY }
          timer.current = window.setTimeout(() => {
            fired.current = true
            navigator.vibrate?.(12)
            onLongPress(memory)
          }, 480)
        }}
        onPointerMove={(e) => {
          if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 9) clear()
        }}
        onPointerUp={clear}
        onPointerCancel={clear}
        onPointerLeave={clear}
        onClick={() => {
          if (fired.current) return
          const r = ref.current?.getBoundingClientRect()
          if (r) onOpen(memory, r)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ContextMenu' || (e.key === 'F10' && e.shiftKey)) onLongPress(memory)
        }}
      >
        <BookCover memory={memory} ref={ref} />
      </motion.button>
    </motion.div>
  )
}
