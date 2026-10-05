import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { MapProps } from '../types'
import { arcRoute } from '../lib/geo'

const pinHtml = (color: string, label: string) => `
  <svg width="34" height="44" viewBox="0 0 34 44" style="filter:drop-shadow(0 3px 3px rgba(0,0,0,.35));overflow:visible">
    <path d="M17 43C17 43 3 27 3 16a14 14 0 0 1 28 0c0 11-14 27-14 27Z" fill="${color}" stroke="#fff" stroke-width="3"/>
    <circle cx="17" cy="16" r="7.5" fill="#fff"/>
    <text x="17" y="20" text-anchor="middle" font-family="Manrope,sans-serif" font-weight="800" font-size="11" fill="${color}">${label}</text>
  </svg>`

const icon = (color: string, label: string) =>
  L.divIcon({ className: 'keepsake-pin', html: pinHtml(color, label), iconSize: [34, 44], iconAnchor: [17, 42] })

/** Non-interactive Leaflet map with two pins and an animated dotted route. */
export function MapCard({ map }: { map: MapProps }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const css = getComputedStyle(el)
    const c1 = css.getPropertyValue('--t-pin').trim() || '#E5486F'
    const c2 = css.getPropertyValue('--t-pin2').trim() || '#F28C38'

    const m = L.map(el, {
      zoomControl: false, attributionControl: false, dragging: false, touchZoom: false, scrollWheelZoom: false,
      doubleClickZoom: false, boxZoom: false, keyboard: false, tap: false, zoomSnap: 0.25, fadeAnimation: false,
    } as L.MapOptions)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { crossOrigin: true, maxZoom: 18, detectRetina: true }).addTo(m)

    const route = map.route?.length ? map.route : arcRoute(map.from, map.to)
    const line = L.polyline(route, { weight: 4.5, dashArray: '1 10', lineCap: 'round', className: 'route-dots', opacity: 0.95 }).addTo(m)
    L.marker([map.from.lat, map.from.lng], { icon: icon(c1, 'A'), interactive: false }).addTo(m)
    L.marker([map.to.lat, map.to.lng], { icon: icon(c2, 'B'), interactive: false }).addTo(m)

    const fit = () => {
      m.invalidateSize()
      m.fitBounds(line.getBounds().pad(0.28), { animate: false, paddingTopLeft: [0, 6], paddingBottomRight: [0, 34] })
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
          <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--t-pin, #E5486F)' }} />
          <span className="truncate">{map.from.name}</span>
          <span aria-hidden className="text-neutral-400">→</span>
          <i className="h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--t-pin2, #F28C38)' }} />
          <span className="truncate">{map.to.name}</span>
        </div>
        <span className="pointer-events-none absolute right-1.5 top-1 z-[500] text-[8px] font-semibold text-black/45">© OpenStreetMap</span>
      </div>
    </div>
  )
}
