import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import type { MapProps } from '../types'
import { arcRoute, fitProjector, formatDuration } from '../lib/geo'

const MODE_ICON = { car: '🚗', bike: '🏍️', cycle: '🚲', walk: '🚶' } as const
const timeText = (m: MapProps) => (m.seconds ? `${MODE_ICON[m.mode ?? 'car']} ${formatDuration(m.seconds)}` : '')

const startIcon = L.divIcon({
  className: 'keepsake-pin',
  html: '<div style="width:20px;height:20px;border-radius:50%;background:#fff;border:5px solid #3a4150;box-shadow:0 2px 5px rgba(0,0,0,.35);box-sizing:border-box"></div>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

const endIcon = L.divIcon({
  className: 'keepsake-pin',
  html: `<svg width="30" height="40" viewBox="0 0 30 40" style="overflow:visible;filter:drop-shadow(0 3px 3px rgba(0,0,0,.35))">
    <path d="M15 39C15 39 2 23.5 2 14.5a13 13 0 0 1 26 0C28 23.5 15 39 15 39Z" fill="#EA4335" stroke="#fff" stroke-width="2.4"/>
    <circle cx="15" cy="14.5" r="5" fill="#fff"/></svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 38],
})

const stopIcon = (n: number) => L.divIcon({
  className: 'keepsake-pin',
  html: `<div style="width:20px;height:20px;border-radius:50%;background:#3a4150;border:2.5px solid #fff;box-shadow:0 2px 5px rgba(0,0,0,.35);box-sizing:border-box;color:#fff;font:800 10px/15px Manrope,sans-serif;text-align:center">${n}</div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
})

export function MapCard({ map }: { map: MapProps }) {
  const style = map.style ?? 'card'
  if (style === 'route') return <RouteOnly map={map} />
  if (style === 'around' || style === 'region') return <Cutout map={map} />
  return <CardMap map={map} />
}

/* ---------- map in a framed card (the original look) ---------- */

/** Non-interactive Leaflet map with a start circle, a destination marker and a solid route. */
function CardMap({ map }: { map: MapProps }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return

    const m = L.map(el, {
      zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false, zoomSnap: 0.25, fadeAnimation: false,
    } as L.MapOptions)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { crossOrigin: true, maxZoom: 18, detectRetina: true }).addTo(m)

    const route = map.route?.length ? map.route : arcRoute(map.from, map.to)
    L.polyline(route, { weight: 11, color: '#fff', opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(m)
    const line = L.polyline(route, { weight: 6.5, color: '#2F6BFF', lineCap: 'round', lineJoin: 'round' }).addTo(m)
    L.marker([map.from.lat, map.from.lng], { icon: startIcon, interactive: false }).addTo(m)
    ;(map.stops ?? []).forEach((s, i) => L.marker([s.lat, s.lng], { icon: stopIcon(i + 1), interactive: false, zIndexOffset: 300 }).addTo(m))
    L.marker([map.to.lat, map.to.lng], { icon: endIcon, interactive: false, zIndexOffset: 500 }).addTo(m)

    const fit = () => {
      m.invalidateSize()
      m.fitBounds(line.getBounds(), { animate: false, paddingTopLeft: [30, 62], paddingBottomRight: [30, 46] })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => { ro.disconnect(); m.remove() }
  }, [map])

  return (
    <div
      className="relative h-full w-full overflow-hidden"
      style={{ borderRadius: 20, background: '#fff', padding: 5, boxShadow: '0 1px 2px rgba(30,30,40,.14), 0 10px 22px rgba(30,30,40,.18)' }}
    >
      <div className="relative h-full w-full overflow-hidden" style={{ borderRadius: 16 }}>
        <div ref={host} className="pointer-events-none h-full w-full" />
        {map.seconds ? <Chip text={timeText(map)} /> : null}
        <div
          className="pointer-events-none absolute bottom-2 left-1/2 z-[500] flex w-max max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-extrabold text-[#17171a]"
          style={{ background: 'rgba(255,255,255,.92)', boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}
        >
          <i className="h-2.5 w-2.5 shrink-0 rounded-full bg-white" style={{ border: '2.5px solid #3a4150' }} />
          <span className="truncate">{map.from.name}</span>
          {(map.stops ?? []).map((s, i) => (
            <span key={i} className="flex min-w-0 items-center gap-1.5">
              <span aria-hidden className="text-neutral-400">→</span>
              <i className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full text-[8px] font-extrabold leading-none text-white" style={{ background: '#3a4150' }}>{i + 1}</i>
              <span className="truncate">{s.name}</span>
            </span>
          ))}
          <span aria-hidden className="text-neutral-400">→</span>
          <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: '#EA4335' }} />
          <span className="truncate">{map.to.name}</span>
        </div>
        <span className="pointer-events-none absolute right-1.5 top-1 z-[500] text-[8px] font-semibold text-black/45">© OpenStreetMap</span>
      </div>
    </div>
  )
}

function Chip({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute left-2 top-2 z-[500] rounded-full px-2.5 py-1 text-[11px] font-extrabold text-[#17171a]" style={{ background: 'rgba(255,255,255,.92)', boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}>{text}</span>
  )
}

/* ---------- shared drawing: route line, start dot, destination pin, names, travel time ---------- */

interface Pt { x: number; y: number }

function useBox(ref: RefObject<HTMLElement | null>) {
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const set = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return box
}

const path = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join('')

/** thins a long polyline for drawing (keeps the shape, drops points closer than `min` px) */
function thin(pts: Pt[], min = 1.2) {
  const out: Pt[] = []
  for (const p of pts) { const q = out[out.length - 1]; if (!q || Math.hypot(p.x - q.x, p.y - q.y) >= min) out.push(p) }
  if (pts.length && out[out.length - 1] !== pts[pts.length - 1]) out.push(pts[pts.length - 1])
  return out
}

function Art({ w, h, line, from, to, via = [], map, color, ink, showLine = true }: { w: number; h: number; line: Pt[]; from: Pt; to: Pt; via?: Pt[]; map: MapProps; color: string; ink: 'light' | 'dark'; showLine?: boolean }) {
  const d = path(thin(line))
  const mid = line[Math.floor(line.length / 2)] ?? from
  const text = ink === 'light' ? '#fff' : '#17171a'
  const halo = ink === 'light' ? 'rgba(10,14,24,.55)' : 'rgba(255,255,255,.95)'
  const label = (t: string, x: number, y: number, anchor: 'middle' | 'start' | 'end' = 'middle') => (
    <text x={x} y={y} textAnchor={anchor} fontSize="13" fontWeight="800" fill={text} stroke={halo} strokeWidth="3.2" paintOrder="stroke" strokeLinejoin="round" style={{ fontFamily: 'Manrope, sans-serif' }}>{t}</text>
  )
  const clampX = (x: number, half: number) => Math.max(half + 4, Math.min(w - half - 4, x))
  const toW = Math.min(w - 8, to.x * 0 + map.to.name.length * 7.4)
  const fromW = Math.min(w - 8, map.from.name.length * 7.4)
  const chipText = timeText(map)
  const chipW = chipText.length * 7 + 24
  const chipX = Math.max(4, Math.min(w - chipW - 4, mid.x + 12))
  const chipY = Math.max(4, Math.min(h - 28, mid.y - 11))
  return (
    <svg className="pointer-events-none absolute inset-0" width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      {showLine && line.length > 1 && (
        <>
          <path d={d} fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
          <path d={d} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
      {/* places on the way */}
      {via.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="9" fill="#3a4150" stroke="#fff" strokeWidth="2.4" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' }} />
          <text x={p.x} y={p.y + 3.6} textAnchor="middle" fontSize="10.5" fontWeight="800" fill="#fff" style={{ fontFamily: 'Manrope, sans-serif' }}>{i + 1}</text>
          {label(map.stops?.[i]?.name ?? '', clampX(p.x, ((map.stops?.[i]?.name.length ?? 0) * 7.4) / 2), p.y + (i % 2 ? -16 : 27))}
        </g>
      ))}
      {/* start */}
      <circle cx={from.x} cy={from.y} r="7.5" fill="#fff" stroke="#3a4150" strokeWidth="4" style={{ filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' }} />
      {label(map.from.name, clampX(from.x, fromW / 2), from.y + 28)}
      {/* destination pin: tip at the point */}
      <g transform={`translate(${to.x - 15} ${to.y - 38})`} style={{ filter: 'drop-shadow(0 3px 3px rgba(0,0,0,.35))' }}>
        <path d="M15 39C15 39 2 23.5 2 14.5a13 13 0 0 1 26 0C28 23.5 15 39 15 39Z" fill="#EA4335" stroke="#fff" strokeWidth="2.4" />
        <circle cx="15" cy="14.5" r="5" fill="#fff" />
      </g>
      {label(map.to.name, clampX(to.x, toW / 2), to.y - 48)}
      {chipText && (
        <g>
          <rect x={chipX} y={chipY} width={chipW} height="22" rx="11" fill="rgba(255,255,255,.95)" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,.25))' }} />
          <text x={chipX + chipW / 2} y={chipY + 15} textAnchor="middle" fontSize="11" fontWeight="800" fill="#17171a" style={{ fontFamily: 'Manrope, sans-serif' }}>{chipText}</text>
        </g>
      )}
    </svg>
  )
}

/* ---------- only the line and the pins, nothing behind them ---------- */

function RouteOnly({ map }: { map: MapProps }) {
  const host = useRef<HTMLDivElement>(null)
  const { w, h } = useBox(host)
  const route = map.route?.length ? map.route : arcRoute(map.from, map.to)
  const proj = w > 0 ? fitProjector(route, { w, h }, { t: 66, r: 30, b: 44, l: 30 }) : null
  return (
    <div ref={host} className="relative h-full w-full">
      {proj && (
        <Art
          w={w} h={h} line={route.map(([la, lo]) => proj(la, lo))} from={proj(map.from.lat, map.from.lng)} to={proj(map.to.lat, map.to.lng)}
          map={map} color={map.color ?? '#3B82F6'} ink="light" via={(map.stops ?? []).map((s) => proj(s.lat, s.lng))}
        />
      )}
    </div>
  )
}

/* ---------- the map, cut out along the route (or in the shape of the area), with a white sticker edge ---------- */

const maskUrl = (w: number, h: number, body: string) =>
  `url("data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`

function Cutout({ map }: { map: MapProps }) {
  const host = useRef<HTMLDivElement>(null)
  const mapEl = useRef<HTMLDivElement>(null)
  const { w, h } = useBox(host)
  const [geo, setGeo] = useState<{ line: Pt[]; from: Pt; to: Pt; via: Pt[]; rings: Pt[][]; sw: number } | null>(null)
  const route = useMemo(() => (map.route?.length ? map.route : arcRoute(map.from, map.to)), [map.route, map.from, map.to])
  const region = map.style === 'region' && map.region?.length ? map.region : null

  useEffect(() => {
    const el = mapEl.current
    if (!el || w < 20 || h < 20) return
    const m = L.map(el, {
      zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false, zoomSnap: 0.25, fadeAnimation: false,
    } as L.MapOptions)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { crossOrigin: true, maxZoom: 18, detectRetina: true }).addTo(m)
    const sw = Math.max(34, Math.min(w, h) * 0.27)
    const bounds = L.latLngBounds((region ? [...region.flat(), ...route] : route) as L.LatLngExpression[])
    const pad = region ? 14 : sw / 2 + 14
    m.fitBounds(bounds, { animate: false, paddingTopLeft: [pad, pad + 12], paddingBottomRight: [pad, pad + 4] })
    const px = (la: number, lo: number): Pt => { const p = m.latLngToContainerPoint([la, lo]); return { x: p.x, y: p.y } }
    setGeo({
      line: route.map(([la, lo]) => px(la, lo)),
      from: px(map.from.lat, map.from.lng),
      to: px(map.to.lat, map.to.lng),
      via: (map.stops ?? []).map((s) => px(s.lat, s.lng)),
      rings: region ? region.map((r) => r.map(([la, lo]) => px(la, lo))) : [],
      sw,
    })
    return () => { m.remove() }
  }, [map, w, h, region, route])

  let mapMask: string | undefined
  let edgeMask: string | undefined
  if (geo && w && h) {
    const edge = 16
    if (geo.rings.length) {
      const d = geo.rings.map((r) => `${path(thin(r, 0.8))}Z`).join('')
      mapMask = maskUrl(w, h, `<path d='${d}' fill='#000' fill-rule='evenodd'/>`)
      edgeMask = maskUrl(w, h, `<path d='${d}' fill='#000' stroke='#000' stroke-width='${edge}' stroke-linejoin='round' fill-rule='nonzero'/>`)
    } else {
      const d = path(thin(geo.line, 1.5))
      const dots = (r: number) => [geo.from, geo.to].map((p) => `<circle cx='${p.x}' cy='${p.y}' r='${r}' fill='#000'/>`).join('')
      mapMask = maskUrl(w, h, `<path d='${d}' fill='none' stroke='#000' stroke-width='${geo.sw}' stroke-linecap='round' stroke-linejoin='round'/>${dots(geo.sw * 0.72)}`)
      edgeMask = maskUrl(w, h, `<path d='${d}' fill='none' stroke='#000' stroke-width='${geo.sw + edge}' stroke-linecap='round' stroke-linejoin='round'/>${dots(geo.sw * 0.72 + edge / 2)}`)
    }
  }
  const maskStyle = (img: string) => ({ WebkitMaskImage: img, maskImage: img, WebkitMaskSize: `${w}px ${h}px`, maskSize: `${w}px ${h}px`, WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' }) as React.CSSProperties

  return (
    <div ref={host} className="relative h-full w-full">
      <div className="pointer-events-none absolute inset-0" style={{ filter: 'drop-shadow(0 6px 9px rgba(20,24,40,.32))', opacity: mapMask ? 1 : 0 }}>
        <div className="absolute inset-0 bg-white" style={edgeMask ? maskStyle(edgeMask) : undefined} />
        <div ref={mapEl} className="absolute inset-0" style={mapMask ? maskStyle(mapMask) : undefined} />
      </div>
      {geo && w > 0 && <Art w={w} h={h} line={geo.line} from={geo.from} to={geo.to} via={geo.via} map={map} color={map.color ?? '#2F6BFF'} ink="dark" />}
    </div>
  )
}
