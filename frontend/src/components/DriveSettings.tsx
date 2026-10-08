import { motion } from 'framer-motion'
import { Cloud, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getDriveStatus, migrateLegacyOriginals, onDriveStatus, prefs, processUploads, startOriginals } from '../data/originals'
import { useAuth } from '../data/useAuth'
import { connectDrive, disconnectDrive, driveConfigured, driveMock, isConnected } from '../lib/drive'
import { toast } from './ui'

function Switch({ on, onChange, label, hint, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <button
      type="button" role="switch" aria-checked={on} disabled={disabled} onClick={() => onChange(!on)}
      className="flex min-h-14 w-full items-center gap-3 rounded-2xl border-0 bg-transparent px-1 text-left disabled:opacity-40"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-bold text-[#17171a]">{label}</span>
        {hint && <span className="block text-[12.5px] leading-snug text-neutral-500">{hint}</span>}
      </span>
      <span className="relative h-7 w-12 shrink-0 rounded-full transition-colors" style={{ background: on ? '#17171a' : '#d4d4da' }}>
        <motion.span className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow" animate={{ left: on ? 22 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 32 }} />
      </span>
    </button>
  )
}

/** Google Drive backup of full-quality originals. Shown in Settings when signed in. */
export function DriveSettings() {
  const { user } = useAuth()
  const [st, setSt] = useState(getDriveStatus())
  useEffect(() => onDriveStatus(setSt), [])
  const [connected, setConnected] = useState(isConnected())
  const [backup, setBackup] = useState(prefs.backup())
  const [copyShared, setCopyShared] = useState(prefs.copyShared())
  const [wifi, setWifi] = useState(prefs.wifiOnly())
  const [busy, setBusy] = useState<string | null>(null)

  if (!user) return null

  const connect = async () => {
    setBusy('connect')
    try {
      const ok = await connectDrive(user.email)
      setConnected(ok)
      if (ok) { startOriginals(user.uid); toast('Google Drive connected') } else toast("Google Drive wasn't connected")
    } catch { toast("Couldn't reach Google") } finally { setBusy(null) }
  }

  const migrate = async () => {
    setBusy('migrate')
    try {
      const r = await migrateLegacyOriginals(user.uid)
      toast(r.total ? `Moved ${r.moved} of ${r.total} originals to your Drive` : 'No old originals to move')
      void processUploads()
    } catch { toast("Couldn't move the old originals") } finally { setBusy(null) }
  }

  return (
    <div className="rounded-3xl bg-neutral-50 p-4">
      <div className="mb-2 flex items-center gap-2 text-[15px] font-extrabold">
        <Cloud size={18} /> Google Drive {driveMock && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">TEST MODE</span>}
      </div>

      {!driveConfigured ? (
        <p className="m-0 text-[13px] leading-snug text-amber-700">Drive isn&apos;t set up yet. Add the Google keys to <b>.env.local</b> (see README).</p>
      ) : !connected ? (
        <>
          <p className="m-0 mb-3 text-[13.5px] leading-snug text-neutral-600">
            Keep the full-quality originals of your photos in your own Drive. The app only sees the folder it creates.
          </p>
          <motion.button
            type="button" whileTap={{ scale: 0.97 }} onClick={() => void connect()} disabled={busy === 'connect'}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full border-0 bg-[#17171a] text-[15px] font-semibold text-white disabled:opacity-60"
          >
            {busy === 'connect' && <Loader2 size={17} className="animate-spin" />} Connect Google Drive
          </motion.button>
        </>
      ) : (
        <>
          <Switch on={backup} onChange={(v) => { setBackup(v); prefs.setBackup(v) }} label="Back up my originals" hint="New photos you add are saved in full quality to your Drive." />
          <Switch on={copyShared} onChange={(v) => { setCopyShared(v); prefs.setCopyShared(v) }} label="Keep copies of shared books" hint="Save friends' originals to your Drive too, automatically." />
          <Switch on={wifi} onChange={(v) => { setWifi(v); prefs.setWifiOnly(v) }} label="Wi-Fi only" hint="Don't use mobile data for backups." />

          <div className="mt-2 text-[13px] text-neutral-500" role="status">
            {st.needsReconnect ? 'Google needs you to sign in again to continue.' : st.queued > 0 ? `${st.queued} original${st.queued === 1 ? '' : 's'} waiting to save…` : 'All your originals are saved.'}
            {st.error && !st.needsReconnect && <div className="text-[#d6455d]">Last problem: {st.error}</div>}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {st.needsReconnect && (
              <button type="button" onClick={() => void connect()} className="h-11 rounded-full border-0 bg-[#17171a] px-5 text-[14px] font-semibold text-white">Reconnect</button>
            )}
            <button type="button" onClick={() => void migrate()} disabled={busy === 'migrate'} className="h-11 rounded-full border-0 bg-neutral-200 px-5 text-[14px] font-semibold text-[#17171a] disabled:opacity-60">
              {busy === 'migrate' ? 'Moving…' : 'Move old originals to Drive'}
            </button>
            <button type="button" onClick={() => { disconnectDrive(); setConnected(false) }} className="h-11 rounded-full border-0 bg-transparent px-3 text-[14px] font-bold text-neutral-500">Disconnect</button>
          </div>
        </>
      )}
    </div>
  )
}
