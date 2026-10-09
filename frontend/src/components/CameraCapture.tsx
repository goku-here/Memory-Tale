import { AnimatePresence, motion } from 'framer-motion'
import { Check, RefreshCw, Undo2, X, Zap, ZapOff } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

interface Props {
  /** photos taken (full resolution JPEG files) are handed over when the person taps Done */
  onDone: (files: File[]) => void
  onClose: () => void
  /** shown if the camera can't be opened here: lets the phone's own camera app take over */
  onFallback: () => void
}

interface Shot { file: File; url: string }

/** Full-screen in-app camera. Take as many photos as you like, then Done adds them all to the canvas. */
export function CameraCapture({ onDone, onClose, onFallback }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [shots, setShots] = useState<Shot[]>([])
  const [error, setError] = useState<'denied' | 'missing' | null>(null)
  const [ready, setReady] = useState(false)
  const [flash, setFlash] = useState(0)
  const [torch, setTorch] = useState(false)
  const [canTorch, setCanTorch] = useState(false)
  const shotsRef = useRef<Shot[]>([])
  shotsRef.current = shots

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }, [])

  const start = useCallback(async (mode: 'environment' | 'user') => {
    stop()
    setReady(false)
    setError(null)
    if (!navigator.mediaDevices?.getUserMedia) { setError('missing'); return }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 4096 }, height: { ideal: 3072 } }, audio: false,
      })
      stream.current = s
      const v = video.current
      if (v) { v.srcObject = s; await v.play().catch(() => {}) }
      const caps = (s.getVideoTracks()[0]?.getCapabilities?.() ?? {}) as { torch?: boolean }
      setCanTorch(!!caps.torch)
      setTorch(false)
      setReady(true)
    } catch (e) {
      const n = (e as DOMException).name
      setError(n === 'NotAllowedError' || n === 'SecurityError' ? 'denied' : 'missing')
    }
  }, [stop])

  useEffect(() => {
    void start(facing)
    return stop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facing])

  useEffect(() => () => { shotsRef.current.forEach((s) => URL.revokeObjectURL(s.url)) }, [])

  // release the camera when the app goes to the background
  useEffect(() => {
    const vis = () => { if (document.visibilityState === 'hidden') stop(); else void start(facing) }
    document.addEventListener('visibilitychange', vis)
    return () => document.removeEventListener('visibilitychange', vis)
  }, [facing, start, stop])

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); void shoot() } }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, onClose])

  const toggleTorch = async () => {
    const t = stream.current?.getVideoTracks()[0]
    if (!t) return
    try {
      await t.applyConstraints({ advanced: [{ torch: !torch } as MediaTrackConstraintSet] })
      setTorch(!torch)
    } catch { /* not supported on this camera */ }
  }

  const shoot = async () => {
    const v = video.current
    const track = stream.current?.getVideoTracks()[0]
    if (!ready || !v || !track) return
    navigator.vibrate?.(15)
    setFlash((n) => n + 1)
    let blob: Blob | null = null
    // full-resolution still where the browser supports it (Chrome / Android)...
    const IC = (window as unknown as { ImageCapture?: new (t: MediaStreamTrack) => { takePhoto: () => Promise<Blob> } }).ImageCapture
    if (IC) { try { blob = await new IC(track).takePhoto() } catch { blob = null } }
    // ...otherwise grab the current video frame
    if (!blob) {
      const c = document.createElement('canvas')
      c.width = v.videoWidth || 1280
      c.height = v.videoHeight || 720
      c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
      blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.95))
    }
    if (!blob) return
    const file = new File([blob], `Camera-${new Date().toISOString().replace(/[:.]/g, '-')}.jpg`, { type: blob.type || 'image/jpeg' })
    setShots((s) => [...s, { file, url: URL.createObjectURL(file) }])
  }

  const undo = () => setShots((s) => { const last = s[s.length - 1]; if (last) URL.revokeObjectURL(last.url); return s.slice(0, -1) })
  const done = () => { stop(); onDone(shots.map((s) => s.file)) }
  const close = () => { stop(); onClose() }
  const last = shots[shots.length - 1]

  return (
    <motion.div
      role="dialog" aria-modal aria-label="Camera"
      className="fixed inset-0 z-[90] flex flex-col bg-black text-white"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
    >
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={video} playsInline muted autoPlay
          className="absolute inset-0 h-full w-full object-cover"
          style={{ transform: facing === 'user' ? 'scaleX(-1)' : undefined }}
        />
        {/* shutter flash */}
        <AnimatePresence>
          {flash > 0 && <motion.div key={flash} className="pointer-events-none absolute inset-0 bg-white" initial={{ opacity: 0.85 }} animate={{ opacity: 0 }} transition={{ duration: 0.22 }} />}
        </AnimatePresence>

        <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4" style={{ paddingTop: 'calc(var(--safe-top) + 12px)' }}>
          <button type="button" aria-label="Close camera" onClick={close} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-black/40 text-white backdrop-blur"><X size={22} /></button>
          <div className="flex gap-2">
            {canTorch && (
              <button type="button" aria-label={torch ? 'Turn flash off' : 'Turn flash on'} aria-pressed={torch} onClick={() => void toggleTorch()}
                className="grid h-11 w-11 place-items-center rounded-full border-0 bg-black/40 text-white backdrop-blur">
                {torch ? <Zap size={20} fill="currentColor" /> : <ZapOff size={20} />}
              </button>
            )}
            <button type="button" aria-label="Switch camera" onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
              className="grid h-11 w-11 place-items-center rounded-full border-0 bg-black/40 text-white backdrop-blur"><RefreshCw size={20} /></button>
          </div>
        </div>

        {error && (
          <div className="absolute inset-0 grid place-items-center bg-black/85 px-8 text-center">
            <div>
              <div className="text-5xl">📷</div>
              <h2 className="m-0 mt-3 text-[20px] font-extrabold">{error === 'denied' ? 'Camera access is blocked' : "This device's camera isn't available here"}</h2>
              <p className="mx-auto mb-5 mt-2 max-w-[290px] text-[14.5px] leading-snug text-white/70">
                {error === 'denied'
                  ? 'Allow the camera for this site in your browser settings, or use your phone\'s camera app instead.'
                  : 'You can still take a photo with your phone\'s camera app.'}
              </p>
              <div className="flex flex-col gap-2.5">
                <button type="button" onClick={() => { stop(); onFallback() }} className="h-12 rounded-full border-0 bg-white px-6 text-[15px] font-semibold text-[#17171a]">Use the camera app</button>
                <button type="button" onClick={() => void start(facing)} className="h-11 rounded-full border-0 bg-transparent text-[14.5px] font-bold text-white/80">Try again</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-6 pt-5" style={{ paddingBottom: 'calc(var(--safe-bottom) + 22px)', background: '#000' }}>
        <div className="flex w-24 items-center gap-2">
          {last && (
            <>
              <div className="relative h-12 w-12">
                <img src={last.url} alt="Last photo" className="h-12 w-12 rounded-lg border-2 border-white object-cover" />
                <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-white px-1 text-[11px] font-extrabold text-[#17171a]">{shots.length}</span>
              </div>
              <button type="button" aria-label="Delete last photo" onClick={undo} className="grid h-10 w-10 place-items-center rounded-full border-0 bg-white/15 text-white"><Undo2 size={17} /></button>
            </>
          )}
        </div>

        <motion.button
          type="button" aria-label="Take photo" onClick={() => void shoot()} disabled={!ready || !!error}
          whileTap={{ scale: 0.9 }}
          className="grid h-[78px] w-[78px] place-items-center rounded-full border-4 border-white bg-transparent p-1 disabled:opacity-40"
        >
          <span className="block h-full w-full rounded-full bg-white" />
        </motion.button>

        <div className="flex w-24 justify-end">
          <motion.button
            type="button" whileTap={{ scale: 0.95 }} onClick={done} disabled={!shots.length}
            className="flex h-12 items-center gap-1.5 rounded-full border-0 bg-white px-5 text-[15px] font-semibold text-[#17171a] disabled:opacity-0"
          >
            <Check size={18} strokeWidth={3} /> Done
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}
