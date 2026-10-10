import { useSyncExternalStore } from 'react'

/**
 * Guided tours. 'main' is the first-run tour; 'select' is a short tip tour shown the first time someone selects
 * something on the canvas (what the little toolbar does). A tour knows which step it is on and whether the person
 * is currently *doing* it (the card hides while they act and the next one appears once they have). A tiny event
 * bus lets the app report what the user just did.
 */
export type Script = 'main' | 'select'
interface TourState { active: boolean; script: Script; step: number; phase: 'intro' | 'doing' | 'wait' }
const KEYS: Record<Script, string> = { main: 'mt-tour', select: 'mt-tour-select' }
let state: TourState = { active: false, script: 'main', step: 0, phase: 'intro' }
const subs = new Set<() => void>()
const set = (s: TourState) => { state = s; subs.forEach((f) => f()) }

export const tourSeen = (script: Script = 'main') => { try { return localStorage.getItem(KEYS[script]) !== null } catch { return true } }
const mark = (script: Script) => { try { localStorage.setItem(KEYS[script], 'done') } catch { /* private mode */ } }

export const tour = {
  /** begin (or replay) a tour from the first step */
  start(script: Script = 'main') { set({ active: true, script, step: 0, phase: 'intro' }) },
  /** leave the tour for good (skip or finish) */
  stop() { mark(state.script); set({ ...state, active: false, step: 0, phase: 'intro' }) },
  /** never show the first-run tour to this person (they already have books) */
  dismissSilently: () => mark('main'),
  isActive: () => state.active,
  go(step: number, phase: 'intro' | 'doing' | 'wait' = 'intro') { set({ ...state, active: true, step, phase }) },
  /** the app reports what the user just did, e.g. 'create-open', 'memory-created', 'photo-added', 'sticker-added', 'more-used', 'story-open', 'story-close', 'frame-close', 'thread-made', 'reorder' */
  emit(event: string) { window.dispatchEvent(new CustomEvent('mt-tour', { detail: event })) },
}

export const useTour = () => useSyncExternalStore(
  (f) => { subs.add(f); return () => { subs.delete(f) } },
  () => state,
)
