import type { MapProps } from '../types'

/** Placeholder card; replaced by the Leaflet-powered map in the location step. */
export function MapCard({ map }: { map: MapProps }) {
  return (
    <div className="grid h-full w-full place-items-center rounded-2xl bg-[#e8efe5] p-3 text-center text-[13px] font-bold shadow-lg">
      {map.from.name} → {map.to.name}
    </div>
  )
}
