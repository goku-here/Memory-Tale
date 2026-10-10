import { motion } from 'framer-motion'
import { Bike, Car, Check, Footprints, Motorbike, Loader2, LocateFixed, MapPin, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { MapProps, MapStyle, Place, TravelMode } from '../types'
import { fetchRegion, fetchRouteInfo, searchPlaces, type PlaceHit } from '../lib/geo'
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
  const [seconds, setSeconds] = useState<number | undefined>(initial?.seconds)
  const [style, setStyle] = useState<MapStyle>(initial?.style ?? 'card')
  const [mode, setMode] = useState<TravelMode>(initial?.mode ?? 'car')
  const [color, setColor] = useState(initial?.color ?? '#3B82F6')
  const [region, setRegion] = useState(initial?.region)
  const [regionBusy, setRegionBusy] = useState(false)
  const [regionFailed, setRegionFailed] = useState(false)
  const first = useRef(!!initial)
  const [routing, setRouting] = useState(false)

  const firstArea = useRef(!!initial)
  // new places: forget the old outline
  useEffect(() => {
    if (firstArea.current) { firstArea.current = false; return }
    setRegion(undefined)
    setRegionFailed(false)
  }, [from, to])
  // new places or a different way of travelling: new route and time
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setRoute(undefined)
    setSeconds(undefined)
    if (!from || !to) return
    let alive = true
    setRouting(true)
    void fetchRouteInfo(from, to, mode).then((r) => { if (alive) { setRoute(r.coords); setSeconds(r.seconds); setRouting(false) } })
    return () => { alive = false }
  }, [from, to, mode])

  // the area outline is looked up only when asked for
  useEffect(() => {
    if (style !== 'region' || region || regionFailed || !from || !to) return
    let alive = true
    setRegionBusy(true)
    void fetchRegion(from, to).then((r) => {
      if (!alive) return
      setRegionBusy(false)
      if (r) setRegion(r)
      else { setRegionFailed(true); setStyle('around') }
    })
    return () => { alive = false }
  }, [style, region, regionFailed, from, to])

  const ready = from && to && route
  const cut = style !== 'card'
  const STYLES: { id: MapStyle; label: string }[] = [
    { id: 'card', label: 'Map card' },
    { id: 'route', label: 'Route only' },
    { id: 'around', label: 'Cut out' },
    { id: 'region', label: 'Area shape' },
  ]
  const COLORS = ['#3B82F6', '#FFFFFF', '#EF4444', '#F59E0B', '#111827']

  return (
    <div className="space-y-4 pb-2">
      <PlaceField label="Starting point" dot={pins[0]} value={from} onPick={setFrom} allowLocate />
      <PlaceField label="Destination" dot={pins[1]} value={to} onPick={setTo} />

      <div className="px-5">
        <div className="mb-3 grid grid-cols-4 gap-1.5 rounded-2xl bg-neutral-100 p-1" role="radiogroup" aria-label="Way of travelling">
          {([['car', 'Car', Car], ['bike', 'Bike', Motorbike], ['cycle', 'Cycle', Bike], ['walk', 'Walk', Footprints]] as const).map(([id, label, Icon]) => (
            <button
              key={id} type="button" role="radio" aria-checked={mode === id} onClick={() => setMode(id)}
              className="flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border-0 px-0.5 text-[12px] font-bold leading-none"
              style={mode === id ? { background: '#fff', color: '#17171a', boxShadow: '0 1px 4px rgba(0,0,0,.12)' } : { background: 'transparent', color: '#7a7a85' }}
            ><Icon size={17} /> {label}</button>
          ))}
        </div>
        <div className="relative overflow-hidden rounded-3xl" style={{ height: cut ? 230 : 190, background: style === 'route' ? 'linear-gradient(160deg,#6c8a6a,#2f4a3a)' : '#f3f3f6' }}>
          {from && to ? (
            <div className={`absolute inset-0 ${cut ? 'p-0.5' : 'p-1.5'}`}><MapCard key={style + (region ? 'r' : '')} map={{ from, to, route, style, color, seconds, region, mode }} /></div>
          ) : (
            <div className="grid h-full place-items-center px-8 text-center text-[14px] font-semibold text-neutral-400">
              <span><MapPin className="mx-auto mb-2" size={26} />Pick two places to see your route</span>
            </div>
          )}
          {regionBusy && (
            <span className="absolute left-4 top-4 z-[600] flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-bold shadow">
              <Loader2 size={13} className="animate-spin" /> Finding the area
            </span>
          )}
          {routing && (
            <span className="absolute left-4 top-4 z-[600] flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[12px] font-bold shadow">
              <Loader2 size={13} className="animate-spin" /> Finding route
            </span>
          )}
        </div>
      </div>

      <div className="px-5">
        <span className="mb-1.5 block text-[12px] font-bold uppercase tracking-wider text-neutral-400">Look</span>
        <div className="grid grid-cols-4 gap-1.5 rounded-2xl bg-neutral-100 p-1" role="radiogroup" aria-label="Map look">
          {STYLES.map((o) => (
            <button
              key={o.id} type="button" role="radio" aria-checked={style === o.id} onClick={() => { setRegionFailed(false); setStyle(o.id) }}
              className="min-h-11 rounded-xl border-0 px-1 text-[12.5px] font-bold leading-tight"
              style={style === o.id ? { background: '#fff', color: '#17171a', boxShadow: '0 1px 4px rgba(0,0,0,.12)' } : { background: 'transparent', color: '#7a7a85' }}
            >{o.label}</button>
          ))}
        </div>
        {regionFailed && <p className="m-0 mt-1.5 text-[12px] text-amber-700">Couldn't find an outline for this area, so it is cut out along the route instead.</p>}
        {style === 'route' && (
          <div className="mt-3 flex items-center gap-2.5">
            <span className="text-[12px] font-bold uppercase tracking-wider text-neutral-400">Line</span>
            {COLORS.map((c) => (
              <button key={c} type="button" aria-label={`Line colour ${c}`} aria-pressed={color === c} onClick={() => setColor(c)} className="grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent p-0">
                <span className="h-7 w-7 rounded-full" style={{ background: c, boxShadow: color === c ? '0 0 0 2px #fff, 0 0 0 4px #17171a' : 'inset 0 0 0 1px rgba(0,0,0,.18)' }} />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-5">
        <motion.button
          type="button" whileTap={{ scale: 0.96 }} disabled={!ready || regionBusy}
          onClick={() => ready && onAdd({ from, to, route, style, color, seconds, mode, region: style === 'region' ? region : undefined })}
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
