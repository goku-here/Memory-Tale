/**
 * Who is looking at a book right now.
 *   memories/{id}/presence/{uid}   { name, photo, color, at }   refreshed every 20 s while the book is open
 * Someone counts as here when their mark is under 50 s old.
 */
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import { useEffect, useState } from 'react'
import { getDb } from '../lib/firebase'
import { useAuth } from './useAuth'

export interface Here { id: string; name: string; photo?: string; color: string }

export function usePresence(memoryId: string, color: string): Here[] {
  const { user } = useAuth()
  const uid = user?.uid
  const [here, setHere] = useState<(Here & { at: number })[]>([])
  const [tick, setTick] = useState(0)

  // my own mark
  useEffect(() => {
    const d = getDb()
    if (!uid || !d || !user) return
    const ref = doc(d, 'memories', memoryId, 'presence', uid)
    const beat = () => { if (document.visibilityState === 'visible') void setDoc(ref, JSON.parse(JSON.stringify({ name: user.name, photo: user.photo ?? undefined, color, at: Date.now() }))).catch(() => {}) }
    beat()
    const t = window.setInterval(beat, 20_000)
    document.addEventListener('visibilitychange', beat)
    return () => { window.clearInterval(t); document.removeEventListener('visibilitychange', beat); void deleteDoc(ref).catch(() => {}) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoryId, uid])

  // everyone else's
  useEffect(() => {
    const d = getDb()
    if (!uid || !d) return
    return onSnapshot(collection(d, 'memories', memoryId, 'presence'), (snap) => {
      setHere(snap.docs.map((x) => ({ ...(x.data() as Omit<Here, 'id'> & { at: number }), id: x.id })))
    }, () => { /* stays quiet until the newest rules are published */ })
  }, [memoryId, uid])

  // marks go stale on their own
  useEffect(() => { const t = window.setInterval(() => setTick((n) => n + 1), 15_000); return () => window.clearInterval(t) }, [])
  void tick
  return here.filter((h) => h.id !== uid && Date.now() - h.at < 50_000)
}
