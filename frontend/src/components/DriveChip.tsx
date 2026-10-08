import { AnimatePresence, motion } from 'framer-motion'
import { Cloud, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getDriveStatus, onDriveStatus, startOriginals } from '../data/originals'
import { useAuth } from '../data/useAuth'
import { connectDrive } from '../lib/drive'

/** Small floating pill showing originals being saved / copied, or asking to reconnect Drive. */
export function DriveChip({ top }: { top: string }) {
  const { user } = useAuth()
  const [st, setSt] = useState(getDriveStatus())
  useEffect(() => onDriveStatus(setSt), [])

  const label = st.needsReconnect
    ? 'Reconnect Google Drive'
    : st.replicating
      ? `Saving originals ${Math.min(st.replicating.done + 1, st.replicating.total)} of ${st.replicating.total}`
      : st.queued > 0
        ? `Saving ${st.queued} original${st.queued === 1 ? '' : 's'} to Drive`
        : null

  return (
    <AnimatePresence>
      {user && label && (
        <motion.button
          type="button" key="chip"
          disabled={!st.needsReconnect}
          onClick={() => { void connectDrive(user.email).then((ok) => { if (ok) startOriginals(user.uid) }) }}
          className="fixed left-4 z-[70] flex h-9 items-center gap-2 rounded-full border-0 bg-white px-3.5 text-[12.5px] font-bold text-[#17171a] shadow-[0_4px_16px_rgba(20,24,40,.18),0_0_0_1px_rgba(20,24,40,.05)]"
          style={{ top }}
          initial={{ opacity: 0, y: -10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -10 }}
          role="status"
        >
          {st.needsReconnect ? <Cloud size={15} color="#d6455d" /> : <Loader2 size={15} className="animate-spin" />}
          {label}
        </motion.button>
      )}
    </AnimatePresence>
  )
}
