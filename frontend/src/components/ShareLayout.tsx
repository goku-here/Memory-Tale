import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import type { Memory } from '../types'
import { shade } from '../lib/color'
import { BookCover, GRAIN } from './BookCard'
import { getTheme } from './ThemeEngine'

type BookLike = Pick<Memory, 'title' | 'themeId' | 'cover' | 'date' | 'members'>

export const rise = (i: number) => ({
  initial: { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 },
  transition: { type: 'spring' as const, stiffness: 260, damping: 24, delay: 0.25 + i * 0.07 },
})

/**
 * Full-screen blurred cover gradient with the floating book, a heading and subtitle,
 * and room for buttons. Shared by the "memory is ready" screen and the invite landing page.
 */
export function ShareLayout({
  book, heading, sub, onClose, children, extra,
}: { book: BookLike; heading: ReactNode; sub: ReactNode; onClose?: () => void; children: ReactNode; extra?: ReactNode }) {
  const theme = getTheme(book.themeId)
  const base = book.cover.type === 'color' ? book.cover.value : book.cover.avg ?? theme.cover

  return (
    <motion.div
      className="fixed inset-0 z-[60] overflow-hidden"
      style={{ background: shade(base, 0.35) }}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
    >
      <div aria-hidden className="absolute inset-0" style={{ transform: 'scale(1.5)', filter: 'blur(64px) saturate(1.35)' }}>
        {book.cover.type === 'image' ? (
          <div className="absolute inset-0" style={{ background: `center / cover url(${book.cover.value})` }} />
        ) : (
          <>
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 18%, ${shade(base, -0.35)}, transparent 55%)` }} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 80% 90%, ${theme.palette[0]}, transparent 60%)` }} />
            <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 10% 85%, ${theme.palette[1] ?? base}aa, transparent 55%)` }} />
          </>
        )}
      </div>
      <div aria-hidden className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(20,20,35,.15), rgba(20,10,20,.5))' }} />
      <div aria-hidden className="absolute inset-0" style={{ backgroundImage: GRAIN, opacity: 0.2, mixBlendMode: 'overlay' }} />

      <div className="relative mx-auto flex h-full max-w-[520px] flex-col items-center px-8" style={{ paddingTop: 'calc(var(--safe-top) + 16px)', paddingBottom: 'calc(var(--safe-bottom) + 22px)' }}>
        <div className="flex h-11 w-full justify-end">
          {onClose && (
            <motion.button
              type="button" aria-label="Close" onClick={onClose} whileTap={{ scale: 0.92 }}
              initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}
              className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white text-[#17171a] shadow-lg"
            >
              <X size={21} />
            </motion.button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center">
          <motion.div
            className="relative w-[min(58vw,240px)]"
            initial={{ opacity: 0, scale: 0.7, rotate: -14, y: 40 }}
            animate={{ opacity: 1, scale: 1, rotate: -4, y: 0 }}
            transition={{ type: 'spring', stiffness: 160, damping: 16, delay: 0.1 }}
          >
            <div aria-hidden className="absolute -inset-10 rounded-full" style={{ background: base, opacity: 0.55, filter: 'blur(46px)' }} />
            <motion.div animate={{ y: [0, -12, 0], rotate: [0, 1.6, 0] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}>
              <BookCover memory={book} />
            </motion.div>
          </motion.div>
        </div>

        {extra}
        <motion.h1 {...rise(0)} className="m-0 text-center text-[29px] font-extrabold leading-tight tracking-tight text-white">{heading}</motion.h1>
        <motion.p {...rise(1)} className="mb-7 mt-2 max-w-[300px] text-center text-[15px] leading-snug text-white/75">{sub}</motion.p>
        <motion.div {...rise(2)} className="flex w-full flex-col gap-3">{children}</motion.div>
      </div>
    </motion.div>
  )
}
