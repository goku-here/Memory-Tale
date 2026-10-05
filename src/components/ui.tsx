import { AnimatePresence, motion, type HTMLMotionProps } from 'framer-motion'
import { useEffect, useState, type ReactNode } from 'react'

const press = { whileTap: { scale: 0.96 }, transition: { type: 'spring', stiffness: 500, damping: 30 } } as const

/** Round white 44px icon button with soft shadow. */
export function IconButton({
  label, children, className = '', dark, ...rest
}: { label: string; children: ReactNode; dark?: boolean } & HTMLMotionProps<'button'>) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      title={label}
      {...press}
      {...rest}
      className={`no-select grid h-11 w-11 shrink-0 place-items-center rounded-full border-0 outline-none ${
        dark ? 'bg-[#17171a] text-white' : 'bg-white text-[#17171a]'
      } shadow-[0_2px_10px_rgba(20,24,40,.10),0_0_0_1px_rgba(20,24,40,.04)] disabled:opacity-35 ${className}`}
    >
      {children}
    </motion.button>
  )
}

export function PillButton({
  children, variant = 'dark', className = '', ...rest
}: { variant?: 'dark' | 'light' | 'ghost' } & HTMLMotionProps<'button'>) {
  const styles = {
    dark: 'bg-[#17171a] text-white shadow-[0_10px_30px_rgba(10,12,24,.28)]',
    light: 'bg-white text-[#17171a] shadow-[0_6px_20px_rgba(10,12,24,.12)]',
    ghost: 'bg-black/5 text-[#17171a]',
  }[variant]
  return (
    <motion.button
      type="button"
      {...press}
      {...rest}
      className={`no-select flex min-h-12 items-center justify-center gap-2 rounded-full border-0 px-6 text-[15px] font-semibold outline-none disabled:opacity-40 ${styles} ${className}`}
    >
      {children}
    </motion.button>
  )
}

export function ConfirmDialog({
  open, title, message, confirmLabel = 'Delete', onConfirm, onCancel,
}: {
  open: boolean; title: string; message: string; confirmLabel?: string
  onConfirm: () => void; onCancel: () => void
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center bg-black/40 p-8"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onCancel}
        >
          <motion.div
            role="alertdialog" aria-modal aria-label={title}
            className="w-full max-w-[320px] rounded-[28px] bg-white p-6 text-center shadow-2xl"
            initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="m-0 text-xl font-extrabold">{title}</h2>
            <p className="mb-5 mt-2 text-[14px] leading-snug text-neutral-500">{message}</p>
            <div className="flex gap-3">
              <PillButton variant="ghost" className="flex-1" onClick={onCancel}>Cancel</PillButton>
              <PillButton className="flex-1 !bg-[#d6455d]" onClick={onConfirm}>{confirmLabel}</PillButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/* ---- tiny toast system ---- */
export const toast = (text: string) => window.dispatchEvent(new CustomEvent('keepsake:toast', { detail: text }))

export function ToastHost() {
  const [msg, setMsg] = useState<{ id: number; text: string } | null>(null)
  useEffect(() => {
    let t: number
    const on = (e: Event) => {
      setMsg({ id: Date.now(), text: (e as CustomEvent<string>).detail })
      window.clearTimeout(t)
      t = window.setTimeout(() => setMsg(null), 1900)
    }
    window.addEventListener('keepsake:toast', on)
    return () => { window.removeEventListener('keepsake:toast', on); window.clearTimeout(t) }
  }, [])
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[90] flex justify-center" style={{ top: 'calc(var(--safe-top) + 14px)' }}>
      <AnimatePresence>
        {msg && (
          <motion.div
            key={msg.id} role="status"
            className="rounded-full bg-[#17171a] px-4 py-2.5 text-[13px] font-semibold text-white shadow-xl"
            initial={{ y: -30, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: -20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 26 }}
          >
            {msg.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
