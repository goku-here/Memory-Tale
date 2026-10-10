import type { Place, TravelMode } from '../types'

export interface PlaceHit extends Place {
  full: string
}

/** Nominatim (OpenStreetMap) place search. No API key; keep calls debounced (policy: <= 1 req/s). */
export async function searchPlaces(q: string, signal?: AbortSignal): Promise<PlaceHit[]> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&addressdetails=0&q=${encodeURIComponent(q)}`
  const res = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('Search failed')
  const rows = (await res.json()) as { display_name: string; lat: string; lon: string; name?: string }[]
  return rows.map((r) => ({
    name: (r.name || r.display_name.split(',')[0]).trim(),
    full: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
  }))
}

export function distanceKm(a: Place, b: Place) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** A gentle curved line between two places (used for flights / when no road route exists). */
export function arcRoute(a: Place, b: Place, steps = 48): [number, number][] {
  const mx = (a.lat + b.lat) / 2
  const my = (a.lng + b.lng) / 2
  const dx = b.lat - a.lat
  const dy = b.lng - a.lng
  const k = 0.22
  const cx = mx - dy * k
  const cy = my + dx * k
  const out: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const u = 1 - t
    out.push([u * u * a.lat + 2 * u * t * cx + t * t * b.lat, u * u * a.lng + 2 * u * t * cy + t * t * b.lng])
  }
  return out
}

export interface RouteInfo { coords: [number, number][]; seconds?: number }

/** Road route (and travel time) from the public OSRM demo server; falls back to an arc. */
export async function fetchRouteInfo(points: Place[], mode: TravelMode = 'car'): Promise<RouteInfo> {
  const a = points[0], b = points[points.length - 1]
  const km = points.slice(1).reduce((n, p, i) => n + distanceKm(points[i], p), 0)
  // free routing servers for each way of travelling (FOSSGIS, built on OpenStreetMap); the OSRM demo is a car-only fallback
  // a motorbike uses the same roads as a car; a bicycle and walking have their own networks
  const profile = mode === 'walk' ? 'foot' : mode === 'cycle' ? 'bike' : 'car'
  const servers = [`https://routing.openstreetmap.de/routed-${profile}/route/v1/driving`]
  if (profile === 'car') servers.push('https://router.project-osrm.org/route/v1/driving')
  if (km < (profile === 'car' ? 1500 : 600)) {
    for (const base of servers) {
      try {
        const ctl = new AbortController()
        const t = setTimeout(() => ctl.abort(), 7000)
        const res = await fetch(`${base}/${points.map((p) => `${p.lng},${p.lat}`).join(';')}?overview=full&geometries=geojson`, { signal: ctl.signal })
        clearTimeout(t)
        if (!res.ok) continue
        const data = (await res.json()) as { routes?: { duration?: number; geometry: { coordinates: [number, number][] } }[] }
        const coords = data.routes?.[0]?.geometry.coordinates
        if (coords && coords.length > 1) return { coords: coords.map(([lng, lat]) => [lat, lng] as [number, number]), seconds: data.routes?.[0]?.duration != null ? data.routes[0].duration * (mode === 'bike' ? 0.88 : 1) : undefined }
      } catch {
        /* try the next server, then fall back to an arc */
      }
    }
  }
  // no road route: join the places with gentle curves
  const coords: [number, number][] = []
  for (let i = 1; i < points.length; i++) coords.push(...arcRoute(points[i - 1], points[i]).slice(i > 1 ? 1 : 0))
  return { coords: coords.length ? coords : arcRoute(a, b) }
}

export const fetchRoute = async (a: Place, b: Place) => (await fetchRouteInfo([a, b])).coords

/** 4980 -> "1 hr 23 min" */
export function formatDuration(sec: number) {
  const m = Math.max(1, Math.round(sec / 60))
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  if (d) return `${d} d${h ? ` ${h} hr` : ''}`
  return h ? `${h} hr${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`
}

/**
 * Outline of the state / district around a route (Nominatim, OpenStreetMap), as simplified [lat, lng] rings.
 * Returns null when no outline is found.
 */
export async function fetchRegion(a: Place, b: Place, via: Place[] = []): Promise<[number, number][][] | null> {
  try {
    const all = [a, ...via, b]
    const lat = (Math.min(...all.map((p) => p.lat)) + Math.max(...all.map((p) => p.lat))) / 2
    const lon = (Math.min(...all.map((p) => p.lng)) + Math.max(...all.map((p) => p.lng))) / 2
    const zoom = Math.max(...all.map((p) => distanceKm(p, { name: '', lat, lng: lon }))) > 20 ? 5 : 8
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=${zoom}&polygon_geojson=1&polygon_threshold=0.015&lat=${lat}&lon=${lon}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) return null
    const g = ((await res.json()) as { geojson?: { type: string; coordinates: unknown } }).geojson
    if (!g) return null
    const raw: [number, number][][] =
      g.type === 'Polygon' ? [(g.coordinates as [number, number][][])[0]]
      : g.type === 'MultiPolygon' ? (g.coordinates as [number, number][][][]).map((p) => p[0])
      : []
    const rings = raw
      .filter((r) => r && r.length > 8)
      .sort((x, y) => y.length - x.length)
      .slice(0, 4)
      .map((r) => {
        const step = Math.max(1, Math.ceil(r.length / 320))
        return r.filter((_, i) => i % step === 0).map(([lng, la]) => [la, lng] as [number, number])
      })
    return rings.length ? rings : null
  } catch {
    return null
  }
}

/** projection that fits points into a box (flat, scaled by latitude: fine for trips) */
export function fitProjector(points: [number, number][], box: { w: number; h: number }, pad: { t: number; r: number; b: number; l: number }) {
  let minLa = Infinity, maxLa = -Infinity, minLo = Infinity, maxLo = -Infinity
  for (const [la, lo] of points) { minLa = Math.min(minLa, la); maxLa = Math.max(maxLa, la); minLo = Math.min(minLo, lo); maxLo = Math.max(maxLo, lo) }
  const k = Math.cos((((minLa + maxLa) / 2) * Math.PI) / 180)
  const spanX = Math.max(1e-6, (maxLo - minLo) * k), spanY = Math.max(1e-6, maxLa - minLa)
  const sc = Math.min((box.w - pad.l - pad.r) / spanX, (box.h - pad.t - pad.b) / spanY)
  const ox = pad.l + (box.w - pad.l - pad.r - spanX * sc) / 2
  const oy = pad.t + (box.h - pad.t - pad.b - spanY * sc) / 2
  return (la: number, lo: number) => ({ x: ox + (lo - minLo) * k * sc, y: oy + (maxLa - la) * sc })
}

/** width / height of what a map shows (route, or the region when it is one) */
export function mapAspect(m: { route?: [number, number][]; region?: [number, number][][]; style?: string; from: Place; to: Place }) {
  const pts = m.style === 'region' && m.region?.length ? m.region.flat() : m.route?.length ? m.route : [[m.from.lat, m.from.lng], [m.to.lat, m.to.lng]] as [number, number][]
  let minLa = Infinity, maxLa = -Infinity, minLo = Infinity, maxLo = -Infinity
  for (const [la, lo] of pts) { minLa = Math.min(minLa, la); maxLa = Math.max(maxLa, la); minLo = Math.min(minLo, lo); maxLo = Math.max(maxLo, lo) }
  const k = Math.cos((((minLa + maxLa) / 2) * Math.PI) / 180)
  return Math.max(0.2, ((maxLo - minLo) * k) / Math.max(1e-6, maxLa - minLa))
}
