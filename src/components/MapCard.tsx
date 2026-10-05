import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { MapProps } from '../types'
import { arcRoute } from '../lib/geo'

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

/** Non-interactive Leaflet map with a start circle, a destination marker and a solid route. */
export function MapCard({ map }: { map: MapProps }) {
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
        <div
          className="pointer-events-none absolute bottom-2 left-1/2 z-[500] flex w-max max-w-[calc(100%-16px)] -translate-x-1/2 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-extrabold text-[#17171a]"
          style={{ background: 'rgba(255,255,255,.92)', boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}
        >
          <i className="h-2.5 w-2.5 shrink-0 rounded-full bg-white" style={{ border: '2.5px solid #3a4150' }} />
          <span className="truncate">{map.from.name}</span>
          <span aria-hidden className="text-neutral-400">→</span>
          <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: '#EA4335' }} />
          <span className="truncate">{map.to.name}</span>
        </div>
        <span className="pointer-events-none absolute right-1.5 top-1 z-[500] text-[8px] font-semibold text-black/45">© OpenStreetMap</span>
      </div>
    </div>
  )
}
