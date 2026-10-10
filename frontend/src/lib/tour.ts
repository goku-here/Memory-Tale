import { useSyncExternalStore } from 'react'

/**
 * The first-run tour: which step it is on, and whether the person is currently *doing* that step
 * (the card hides while they act and the next one appears once they have). A tiny event bus lets the
 * app report what the user just did.
 */
interface TourState { active: boolean; step: number; phase: 'intro' | 'doing' | 'wait' }
const KEY = 'mt-tour'
let state: TourState = { active: false, step: 0, phase: 'intro' }
const subs = new Set<() => void>()
const set = (s: TourState) => { state = s; subs.forEach((f) => f()) }

export const tourSeen = () => { try { return localStorage.getItem(KEY) !== null } catch { return true } }
const mark = () => { try { localStorage.setItem(KEY, 'done') } catch { /* private mode */ } }

export const tour = {
  /** begin (or replay) the tour from the first step */
  start() { set({ active: true, step: 0, phase: 'intro' }) },
  /** leave the tour for good (skip or finish) */
  stop() { mark(); set({ active: false, step: 0, phase: 'intro' }) },
  /** never show the tour to this person (they already have books) */
  dismissSilently: mark,
  go(step: number, phase: 'intro' | 'doing' | 'wait' = 'intro') { set({ active: true, step, phase }) },
  /** the app reports what the user just did, e.g. 'create-open', 'memory-created', 'photo-added', 'sticker-added', 'more-used', 'story-open', 'story-close' */
  emit(event: string) { window.dispatchEvent(new CustomEvent('mt-tour', { detail: event })) },
}

export const useTour = () => useSyncExternalStore(
  (f) => { subs.add(f); return () => { subs.delete(f) } },
  () => state,
)
