import { motion } from 'framer-motion'
import { Cloud, Pause, Play, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getDriveStatus, onDriveStatus, prefs, retryOriginalsNow, setOriginalsPaused, startOriginals } from '../data/originals'
import { useAuth } from '../data/useAuth'
import { connectDrive } from '../lib/drive'
import { ToolSheet } from './ToolSheet'

const WHY = {
  paused: 'You paused saving. Nothing uses data until you resume.',
  wifi: 'Waiting for Wi-Fi (you chose Wi-Fi only in Settings).',
  offline: 'Waiting for an internet connection.',
} as const

function Bar({ done, total }: { done: number; total: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200">
      <motion.div className="h-full rounded-full bg-[#17171a]" animate={{ width: `${total ? (done / total) * 100 : 0}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
    </div>
  )
}

/** Bottom sheet opened from the progress pill: what is being saved, why it may be waiting, pause / retry. */
export function DriveDetails({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth()
  const [st, setSt] = useState(getDriveStatus())
  const [paused, setPaused] = useState(prefs.paused())
  useEffect(() => onDriveStatus((s) => { setSt(s); setPaused(prefs.paused()) }), [])

  const toggle = () => { setOriginalsPaused(!paused); setPaused(!paused) }
  const reconnect = async () => { if (user && (await connectDrive(user.email))) startOriginals(user.uid) }

  return (
    <ToolSheet open={open} onClose={onClose} title="Saving originals" snaps={[0.5]} z={85}>
      <div className="space-y-5 px-6 pb-4">
        <p className="m-0 text-[14px] leading-snug text-neutral-500">
          Full-quality photos are saved to your own Google Drive in the background. You can keep using the app.
        </p>

        {st.uploading && (
          <section>
            <div className="mb-1.5 flex justify-between text-[13.5px] font-bold"><span>Your new photos</span><span>{Math.min(st.uploading.done, st.uploading.total)} / {st.uploading.total}</span></div>
            <Bar done={st.uploading.done} total={st.uploading.total} />
          </section>
        )}
        {st.replicating && (
          <section>
            <div className="mb-1.5 flex justify-between text-[13.5px] font-bold"><span>Copying from shared books</span><span>{st.replicating.done} / {st.replicating.total}</span></div>
            <Bar done={st.replicating.done} total={st.replicating.total} />
            {st.replicating.skipped > 0 && <p className="m-0 mt-1.5 text-[12.5px] text-neutral-500">{st.replicating.skipped} couldn&apos;t be copied (no original left anywhere). The smaller version stays.</p>}
          </section>
        )}
        {!st.uploading && !st.replicating && st.queued > 0 && (
          <p className="m-0 text-[14px] font-bold">{st.queued} original{st.queued === 1 ? '' : 's'} waiting to save.</p>
        )}
        {!st.uploading && !st.replicating && st.queued === 0 && !st.needsReconnect && (
          <p className="m-0 text-[14px] font-bold text-[#2E9E6B]">All originals are saved. ✓</p>
        )}

        {st.blocked && <p className="m-0 rounded-2xl bg-amber-50 px-4 py-3 text-[13.5px] leading-snug text-amber-800">{WHY[st.blocked]}</p>}
        {st.needsReconnect && <p className="m-0 rounded-2xl bg-red-50 px-4 py-3 text-[13.5px] leading-snug text-red-700">Google needs you to sign in again before saving can continue.</p>}
        {st.error && !st.needsReconnect && <p className="m-0 text-[12.5px] text-[#d6455d]">Last problem: {st.error}</p>}

        <div className="flex flex-wrap gap-2">
          {st.needsReconnect && (
            <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => void reconnect()} className="flex h-12 items-center gap-2 rounded-full border-0 bg-[#17171a] px-5 text-[14.5px] font-semibold text-white">
              <Cloud size={17} /> Reconnect
            </motion.button>
          )}
          <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={toggle} className="flex h-12 items-center gap-2 rounded-full border-0 bg-neutral-100 px-5 text-[14.5px] font-semibold text-[#17171a]">
            {paused ? <><Play size={16} /> Resume</> : <><Pause size={16} /> Pause</>}
          </motion.button>
          <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => void retryOriginalsNow()} className="flex h-12 items-center gap-2 rounded-full border-0 bg-neutral-100 px-5 text-[14.5px] font-semibold text-[#17171a]">
            <RefreshCw size={16} /> Try again now
          </motion.button>
        </div>
      </div>
    </ToolSheet>
  )
}
