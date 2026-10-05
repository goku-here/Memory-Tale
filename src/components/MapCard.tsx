import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { MapProps } from '../types'
import { arcRoute } from '../lib/geo'
import { PIN_TIP, pushPinSvg } from './PushPin'

const W = 44
const icon = (color: string) =>
  L.divIcon({
    className: 'keepsake-pin',
    html: pushPinSvg(color, W),
    iconSize: [W, (W * 80) / 60],
    iconAnchor: [(PIN_TIP.x / 60) * W, (PIN_TIP.y / 80) * ((W * 80) / 60)],
  })

/** Non-interactive Leaflet map with two pins and an animated dotted route. */
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
    L.polyline(route, { weight: 2.5, dashArray: '1 14', lineCap: 'round', className: 'route-dots', opacity: 0.9 }).addTo(m)
    L.marker([map.from.lat, map.from.lng], { icon: icon('#5B6B7F'), interactive: false }).addTo(m)
    L.marker([map.to.lat, map.to.lng], { icon: icon('#E5342F'), interactive: false, zIndexOffset: 500 }).addTo(m)

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
          className="pointer-events-none absolute inset-x-2 bottom-2 z-[500] flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-extrabold text-[#17171a]"
          style={{ background: 'rgba(255,255,255,.92)', boxShadow: '0 1px 4px rgba(0,0,0,.15)' }}
        >
          <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: '#5B6B7F' }} />
          <span className="truncate">{map.from.name}</span>
          <span aria-hidden className="text-neutral-400">→</span>
          <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: '#E5342F' }} />
          <span className="truncate">{map.to.name}</span>
        </div>
        <span className="pointer-events-none absolute right-1.5 top-1 z-[500] text-[8px] font-semibold text-black/45">© OpenStreetMap</span>
      </div>
    </div>
  )
}
