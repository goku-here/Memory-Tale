import type { Place } from '../types'

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

/** Road route from the public OSRM demo server; falls back to an arc. */
export async function fetchRoute(a: Place, b: Place): Promise<[number, number][]> {
  if (distanceKm(a, b) < 1500) {
    try {
      const ctl = new AbortController()
      const t = setTimeout(() => ctl.abort(), 5000)
      const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=simplified&geometries=geojson`
      const res = await fetch(url, { signal: ctl.signal })
      clearTimeout(t)
      if (res.ok) {
        const data = (await res.json()) as { routes?: { geometry: { coordinates: [number, number][] } }[] }
        const coords = data.routes?.[0]?.geometry.coordinates
        if (coords && coords.length > 1) return coords.map(([lng, lat]) => [lat, lng] as [number, number])
      }
    } catch {
      /* fall through to the arc */
    }
  }
  return arcRoute(a, b)
}
