import { motion } from 'framer-motion'
import { Check, Loader2, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { MapProps, Place } from '../types'
import { fetchRoute, searchPlaces, type PlaceHit } from '../lib/geo'
import { MapCard } from './MapCard'

interface FieldProps {
  label: string
  dot: string
  value: Place | null
  onPick: (p: Place | null) => void
  allowLocate?: boolean
}

function PlaceField({ label, dot, value, onPick, allowLocate }: FieldProps) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<PlaceHit[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [focus, setFocus] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const ctl = useRef<AbortController | undefined>(undefined)

  useEffect(() => {
    window.clearTimeout(timer.current)
    ctl.current?.abort()
    setErr('')
    if (value || q.trim().length < 3) { setHits([]); setBusy(false); return }
    setBusy(true)
    timer.current = window.setTimeout(async () => {
      const c = new AbortController()
      ctl.current = c
      try {
        const r = await searchPlaces(q.trim(), c.signal)
        setHits(r)
        if (!r.length) setErr('No places found')
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setErr("Couldn't search right now. Check your connection.")
      } finally {
        if (!c.signal.aborted) setBusy(false)
      }
    }, 650)
    return () => { window.clearTimeout(timer.current); ctl.current?.abort() }
  }, [q, value])

  const locate = () => {
    if (!navigator.geolocation) return setErr('Location is not available on this device')
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (p) => { setBusy(false); onPick({ name: 'My location', lat: p.coords.latitude, lng: p.coords.longitude }) },
      () => { setBusy(false); setErr('Location permission was denied') },
      { enableHighAccuracy: false, timeout: 8000 },
    )
  }

  return (
    <div className="px-5">
      <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-neutral-400">{label}</span>
      <div className="relative">
        <div className="flex h-12 items-center gap-2.5 rounded-2xl bg-neutral-100 pl-4 pr-1.5">
          <i className="h-3 w-3 shrink-0 rounded-full" style={{ background: dot }} />
          {value ? (
            <>
              <span className="min-w-0 flex-1 truncate text-[16px] font-bold">{value.name}</span>
              <button type="button" aria-label={`Clear ${label}`} onClick={() => { onPick(null); setQ('') }}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-0 bg-transparent text-neutral-500">
                <X size={18} />
              </button>
            </>
          ) : (
            <>
              <input
                value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => setFocus(true)} onBlur={() => setTimeout(() => setFocus(false), 150)}
                placeholder="Search a place…" aria-label={label} enterKeyHint="search"
                className="min-w-0 flex-1 border-0 bg-transparent text-[16px] font-semibold text-[#17171a] outline-none"
              />
              {busy ? <Loader2 size={18} className="mr-3 animate-spin text-neutral-400" />
                : allowLocate && !q ? (
                  <button type="button" aria-label="Use my location" onClick={locate}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full border-0 bg-transparent text-neutral-600">
                    <LocateFixed size={19} />
                  </button>
                ) : <Search size={17} className="mr-3 text-neutral-400" />}
            </>
          )}
        </div>
        {!value && focus && (hits.length > 0 || err) && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
            className="m-0 mt-1.5 list-none overflow-hidden rounded-2xl bg-white p-0 shadow-[0_8px_28px_rgba(20,24,40,.16),0_0_0_1px_rgba(20,24,40,.05)]"
          >
            {err && !hits.length && <li className="px-4 py-3 text-[14px] text-neutral-500">{err}</li>}
            {hits.map((h, i) => (
              <li key={`${h.lat},${h.lng},${i}`}>
                <button
                  type="button" onPointerDown={(e) => e.preventDefault()}
                  onClick={() => { onPick({ name: h.name, lat: h.lat, lng: h.lng }); setQ(''); setHits([]) }}
                  className="flex min-h-12 w-full items-start gap-2.5 border-0 bg-transparent px-4 py-2.5 text-left"
                >
                  <MapPin size={16} className="mt-0.5 shrink-0 text-neutral-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-bold">{h.name}</span>
                    <span className="block truncate text-[12px] text-neutral-400">{h.full}</span>
                  </span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </div>
    </div>
  )
}

interface Props {
  pins: [string, string]
  accent: string
  onAdd: (map: MapProps) => void
  /** pre-fill when editing an existing map card */
  initial?: MapProps
}

/** Starting point + destination search with a live preview of the map card. */
export function LocationTool({ pins, accent, onAdd, initial }: Props) {
  const [from, setFrom] = useState<Place | null>(initial?.from ?? null)
  const [to, setTo] = useState<Place | null>(initial?.to ?? null)
  const [route, setRoute] = useState<[number, number][] | undefined>(initial?.route)
  const first = useRef(!!initial)
  const [routing, setRouting] = useState(false)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    setRoute(undefined)
    if (!from || !to) return
    let alive = true
    setRouting(true)
    void fetchRoute(from, to).then((r) => { if (alive) { setRoute(r); setRouting(false) } })
    return () => { alive = false }
  }, [from, to])

  const ready = from && to && route

  return (
    <div className="space-y-4 pb-2">
      <PlaceField label="Starting point" dot={pins[0]} value={from} onPick={setFrom} allowLocate />
      <PlaceField label="Destination" dot={pins[1]} value={to} onPick={setTo} />

      <div className="px-5">
        <div className="relative overflow-hidden rounded-3xl bg-neutral-100" style={{ height: 190 }}>
          {from && to ? (
            <div className="absolute inset-0 p-1.5"><MapCard map={{ from, to, route }} /></div>
          ) : (
            <div className="grid h-full place-items-center px-8 text-center text-[14px] font-semibold text-neutral-400">
              <span><MapPin className="mx-auto mb-2" size={26} />Pick two places to see your route</span>
            </div>
          )}
          {routing && (
            <span className="absolute left-4 top-4 z-[600] flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-bold shadow">
              <Loader2 size={13} className="animate-spin" /> Finding route
            </span>
          )}
        </div>
      </div>

      <div className="px-5">
        <motion.button
          type="button" whileTap={{ scale: 0.96 }} disabled={!ready}
          onClick={() => ready && onAdd({ from, to, route })}
          className="flex h-13 min-h-12 w-full items-center justify-center gap-2 rounded-full border-0 bg-[#17171a] text-[15px] font-semibold text-white disabled:opacity-35"
          style={ready ? { boxShadow: `0 8px 22px ${accent}55` } : undefined}
        >
          <Check size={18} strokeWidth={3} /> {initial ? 'Update map card' : 'Add map card'}
        </motion.button>
        <p className="m-0 mt-2 text-center text-[11.5px] text-neutral-400">Search by OpenStreetMap Nominatim. Map data © OpenStreetMap contributors.</p>
      </div>
    </div>
  )
}
