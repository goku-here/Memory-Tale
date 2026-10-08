import { AnimatePresence, motion } from 'framer-motion'
import { Cloud, Loader2, Pause } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getDriveStatus, onDriveStatus } from '../data/originals'
import { useAuth } from '../data/useAuth'
import { DriveDetails } from './DriveDetails'

/** Small floating pill showing originals being saved / copied. Tap it for details, pause and retry. */
export function DriveChip({ top }: { top: string }) {
  const { user } = useAuth()
  const [st, setSt] = useState(getDriveStatus())
  const [open, setOpen] = useState(false)
  useEffect(() => onDriveStatus(setSt), [])

  const busy = !!st.replicating || !!st.uploading || st.queued > 0
  const label = st.needsReconnect
    ? 'Reconnect Google Drive'
    : st.blocked === 'paused' && busy
      ? 'Saving originals paused'
      : st.blocked === 'wifi' && busy
        ? 'Waiting for Wi-Fi'
        : st.blocked === 'offline' && busy
          ? 'Waiting for connection'
          : st.replicating
            ? `Saving originals ${Math.min(st.replicating.done + 1, st.replicating.total)} of ${st.replicating.total}`
            : st.uploading
              ? `Saving originals ${Math.min(st.uploading.done + 1, st.uploading.total)} of ${st.uploading.total}`
              : st.queued > 0
                ? `${st.queued} original${st.queued === 1 ? '' : 's'} to save`
                : null

  return (
    <>
      <AnimatePresence>
        {user && label && (
          <motion.button
            type="button" key="chip" onClick={() => setOpen(true)} aria-label={`${label}. Open details`}
            className="fixed left-4 z-[70] flex h-9 items-center gap-2 rounded-full border-0 bg-white px-3.5 text-[12.5px] font-bold text-[#17171a] shadow-[0_4px_16px_rgba(20,24,40,.18),0_0_0_1px_rgba(20,24,40,.05)]"
            style={{ top }}
            initial={{ opacity: 0, y: -10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}
            whileTap={{ scale: 0.96 }}
            role="status"
          >
            {st.needsReconnect ? <Cloud size={15} color="#d6455d" /> : st.blocked ? <Pause size={14} /> : <Loader2 size={15} className="animate-spin" />}
            {label}
          </motion.button>
        )}
      </AnimatePresence>
      <DriveDetails open={open} onClose={() => setOpen(false)} />
    </>
  )
}
