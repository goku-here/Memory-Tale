import { useSyncExternalStore } from 'react'

/** The first-run tour: where it is, and a tiny event bus so the app can tell it what the user just did. */
interface TourState { active: boolean; step: number }
const KEY = 'mt-tour'
let state: TourState = { active: false, step: 0 }
const subs = new Set<() => void>()
const set = (s: TourState) => { state = s; subs.forEach((f) => f()) }

export const tourSeen = () => { try { return localStorage.getItem(KEY) !== null } catch { return true } }
const mark = () => { try { localStorage.setItem(KEY, 'done') } catch { /* private mode */ } }

export const tour = {
  /** begin (or replay) the tour from the first step */
  start() { set({ active: true, step: 0 }) },
  /** leave the tour for good (skip or finish) */
  stop() { mark(); set({ active: false, step: 0 }) },
  /** never show the tour to this person (they already have books) */
  dismissSilently: mark,
  go(step: number) { set({ active: true, step }) },
  /** the app reports what the user just did: 'create-open' | 'create-close' | 'memory-created' | 'photo-added' */
  emit(event: string) { window.dispatchEvent(new CustomEvent('mt-tour', { detail: event })) },
}

export const useTour = () => useSyncExternalStore(
  (f) => { subs.add(f); return () => { subs.delete(f) } },
  () => state,
)
