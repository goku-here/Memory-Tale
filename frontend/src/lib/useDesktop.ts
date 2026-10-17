import { useEffect, useState } from 'react'

/** a laptop or desktop: a wide window and a mouse (a phone or tablet held in the hand keeps the touch layout) */
const QUERY = '(min-width: 1024px) and (hover: hover) and (pointer: fine)'

export const isDesktop = () => typeof window !== 'undefined' && window.matchMedia(QUERY).matches

export function useDesktop() {
  const [on, setOn] = useState(isDesktop)
  useEffect(() => {
    const m = window.matchMedia(QUERY)
    const h = () => setOn(m.matches)
    h()
    m.addEventListener('change', h)
    return () => m.removeEventListener('change', h)
  }, [])
  return on
}
