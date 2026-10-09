/**
 * Who is in a book, and taking someone out of it.
 *
 *   memories/{id}               memberIds / members / ownerId / banned (people who were removed and may not rejoin)
 *   removals/{uid}_{memoryId}   a notice for the removed person: who removed them, and which Drive files are
 *                               their copies of the book's photos (only their own app can delete those)
 */
import { collection, deleteDoc, deleteField, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, where, arrayRemove, arrayUnion } from 'firebase/firestore'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getDb } from '../lib/firebase'
import { deleteFromDrive, isConnected } from '../lib/drive'
import type { Memory, Member } from '../types'
import { db } from './db'
import { getRecords } from './originals'
import { repo } from './repo'
import { reportError } from './sync'
import { useAuth } from './useAuth'

export interface RemovalNotice {
  id: string
  uid: string
  memoryId: string
  title: string
  themeId?: Memory['themeId']
  ownerName: string
  ownerPhoto?: string
  at: number
  fileIds: string[]
}

const clean = <T,>(o: T): T => JSON.parse(JSON.stringify(o))

/** The real people in a book, owner first. */
export function peopleOf(memory: Memory, me?: { uid: string; name: string; photo: string | null } | null): (Member & { owner: boolean })[] {
  const ids = new Set(memory.memberIds ?? [])
  const list = (memory.members ?? []).filter((m) => m.id !== 'me' && (!ids.size || ids.has(m.id)))
  const ownerId = memory.ownerId ?? me?.uid
  if (me && ownerId === me.uid && !list.some((m) => m.id === me.uid)) list.unshift({ id: me.uid, name: me.name, color: '#17171a', photo: me.photo ?? undefined })
  return list
    .map((m) => ({ ...m, owner: m.id === ownerId }))
    .sort((a, b) => Number(b.owner) - Number(a.owner))
}

/**
 * Owner only. Takes `targetUid` out of the book: they lose access straight away and cannot rejoin with an old link.
 * Their Drive copies of other people's photos are listed in a notice so their own app can delete them.
 */
export async function removeMember(owner: { uid: string; name: string; photo: string | null }, memory: Memory, targetUid: string) {
  const d = getDb()
  if (!d) throw new Error('Cloud is not configured')
  const records = await getRecords(memory.id).catch(() => [])
  // copies of photos somebody else added; the person's own uploads stay theirs
  const theirs = records.filter((r) => r.copies[targetUid] && r.uploaderUid !== targetUid)
  await setDoc(doc(d, 'removals', `${targetUid}_${memory.id}`), clean({
    uid: targetUid, memoryId: memory.id, title: memory.title, themeId: memory.themeId,
    ownerName: owner.name, ownerPhoto: owner.photo ?? undefined, at: Date.now(),
    fileIds: theirs.map((r) => r.copies[targetUid].fileId),
  }))
  await Promise.allSettled(theirs.map((r) => updateDoc(doc(d, 'memories', memory.id, 'originals', r.id), { [`copies.${targetUid}`]: deleteField() })))
  const ref = doc(d, 'memories', memory.id)
  const cur = await getDoc(ref)
  const members = ((cur.data()?.members ?? []) as Member[]).filter((m) => m.id !== targetUid)
  await updateDoc(ref, clean({ memberIds: arrayRemove(targetUid), banned: arrayUnion(targetUid), members, updatedAt: Date.now() }))
}

/** My new name on every book I am in (cloud and this device), so other members see it too. */
export async function renameEverywhere(uid: string, name: string) {
  for (const m of await db.memories.toArray()) {
    if (m.members?.some((x) => x.id === uid)) await db.memories.update(m.id, { members: m.members.map((x) => (x.id === uid ? { ...x, name } : x)) })
  }
  const d = getDb()
  if (!d) return
  const mine = await getDocs(query(collection(d, 'memories'), where('memberIds', 'array-contains', uid)))
  await Promise.allSettled(mine.docs.map((x) => {
    const members = ((x.data().members ?? []) as Member[])
    if (!members.some((m) => m.id === uid)) return Promise.resolve()
    return updateDoc(x.ref, clean({ members: members.map((m) => (m.id === uid ? { ...m, name } : m)) }))
  }))
}

/* ---------- the removed person's side ---------- */
const PURGE = 'mt-drive-purge'
const readPurge = (): string[] => { try { return JSON.parse(localStorage.getItem(PURGE) || '[]') } catch { return [] } }
const writePurge = (ids: string[]) => localStorage.setItem(PURGE, JSON.stringify([...new Set(ids)]))

/** Delete Drive files that could not be deleted earlier (Drive was not connected). */
export async function purgePendingDriveCopies() {
  if (!isConnected()) return
  const left: string[] = []
  for (const id of readPurge()) {
    try { await deleteFromDrive(id) } catch { left.push(id) }
  }
  writePurge(left)
}

/** Everything of this book that lives on this device or in this person's Drive. Safe to run twice. */
export async function wipeBook(n: RemovalNotice) {
  await repo.deleteMemory(n.memoryId).catch(() => {})
  await db.uploads.where('memoryId').equals(n.memoryId).delete().catch(() => {})
  for (const k of [`mt-copy:${n.memoryId}`, `mt-asked:${n.memoryId}`, `mt-discard:${n.memoryId}`, `mt-story-y:${n.memoryId}`]) localStorage.removeItem(k)
  const failed: string[] = []
  for (const id of n.fileIds) {
    try { await deleteFromDrive(id) } catch { failed.push(id) }
  }
  if (failed.length) writePurge([...readPurge(), ...failed])
  return { deleted: n.fileIds.length - failed.length, pending: failed.length }
}

/** Notices addressed to me, oldest first. Each one is wiped from this device as soon as it arrives. */
export function useRemovals() {
  const { user } = useAuth()
  const uid = user?.uid
  const [notices, setNotices] = useState<(RemovalNotice & { pending: number })[]>([])
  const handled = useRef(new Map<string, number>())

  useEffect(() => {
    const d = getDb()
    if (!uid || !d) { setNotices([]); return }
    return onSnapshot(query(collection(d, 'removals'), where('uid', '==', uid)), async (snap) => {
      const list = snap.docs.map((x) => ({ ...(x.data() as RemovalNotice), id: x.id })).sort((a, b) => a.at - b.at)
      for (const n of list) {
        if (!handled.current.has(n.id)) {
          handled.current.set(n.id, -1)
          const r = await wipeBook(n)
          handled.current.set(n.id, r.pending)
        }
      }
      setNotices(list.map((n) => ({ ...n, pending: Math.max(0, handled.current.get(n.id) ?? 0) })))
    }, (e) => console.warn('[removals]', e)) // stays quiet until the newest rules are published
  }, [uid])

  const dismiss = useCallback(async (id: string) => {
    const d = getDb()
    setNotices((l) => l.filter((n) => n.id !== id))
    if (d) await deleteDoc(doc(d, 'removals', id)).catch(reportError)
  }, [])

  return { notices, dismiss }
}
