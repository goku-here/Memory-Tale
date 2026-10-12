import { motion } from 'framer-motion'
import { Crown, Eye, Loader2, Pencil, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { peopleOf, removeMember, setRole } from '../data/people'
import { reportError } from '../data/sync'
import { useAuth } from '../data/useAuth'
import type { Memory } from '../types'
import { ToolSheet } from './ToolSheet'
import { ConfirmDialog, toast } from './ui'

function Avatar({ name, photo, color }: { name: string; photo?: string; color: string }) {
  return photo ? (
    <img src={photo} alt="" referrerPolicy="no-referrer" className="h-11 w-11 rounded-full object-cover" />
  ) : (
    <span className="grid h-11 w-11 place-items-center rounded-full text-[16px] font-extrabold text-white" style={{ background: color }}>{name.slice(0, 1).toUpperCase()}</span>
  )
}

/** Everyone in the book. The owner can take people out. */
export function PeopleSheet({ open, onClose, memory }: { open: boolean; onClose: () => void; memory: Memory }) {
  const { user } = useAuth()
  const people = peopleOf(memory, user)
  const isOwner = !!user && (memory.ownerId ?? user.uid) === user.uid
  const owner = people.find((p) => p.owner)
  const viewers = new Set(memory.viewerIds ?? [])
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const changeRole = async (id: string, name: string, role: 'edit' | 'view') => {
    setBusy(id)
    try {
      await setRole(memory, id, role)
      toast(role === 'view' ? `${name} can now only view` : `${name} can now edit`)
    } catch (e) {
      reportError(e)
      toast('Could not change it. Publish the latest backend/firestore.rules in Firebase, then try again.')
    } finally { setBusy(null) }
  }

  const confirm = async () => {
    if (!user || !target) return
    const t = target
    setTarget(null)
    setBusy(t.id)
    try {
      await removeMember(user, memory, t.id)
      toast(`${t.name} was removed`)
    } catch (e) {
      reportError(e)
      const code = (e as { code?: string }).code
      toast(code === 'permission-denied'
        ? 'The cloud rules block this. Publish the latest backend/firestore.rules in Firebase, then try again.'
        : "Couldn't remove them. Check your connection and try again.")
    } finally { setBusy(null) }
  }

  return (
    <>
      <ToolSheet open={open} onClose={onClose} title="People" snaps={[0.62, 0.9]} z={70}>
        <div className="px-5 pb-6">
          <ul className="m-0 list-none space-y-1 p-0">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                <Avatar name={p.name} photo={p.photo} color={p.color} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15.5px] font-bold text-[#17171a]">{p.name}{p.id === user?.uid && <span className="font-semibold text-neutral-400"> (you)</span>}</div>
                  {p.owner
                    ? <div className="flex items-center gap-1 text-[12.5px] font-bold text-amber-600"><Crown size={13} /> Owner</div>
                    : (isOwner || p.id === user?.uid) && (viewers.has(p.id)
                      ? <div className="flex items-center gap-1 text-[12.5px] font-bold text-neutral-500"><Eye size={13} /> Can only view</div>
                      : <div className="flex items-center gap-1 text-[12.5px] font-bold text-neutral-500"><Pencil size={13} /> Can edit</div>)}
                </div>
                {isOwner && !p.owner && (
                  <motion.button
                    type="button" whileTap={{ scale: 0.94 }} disabled={busy === p.id} onClick={() => void changeRole(p.id, p.name, viewers.has(p.id) ? 'edit' : 'view')}
                    className="flex h-10 items-center gap-1.5 rounded-full border-0 bg-neutral-100 px-3.5 text-[13.5px] font-bold text-[#17171a] disabled:opacity-50"
                  >
                    {viewers.has(p.id) ? <><Pencil size={15} /> Allow edit</> : <><Eye size={15} /> View only</>}
                  </motion.button>
                )}
                {isOwner && !p.owner && (
                  <motion.button
                    type="button" whileTap={{ scale: 0.94 }} disabled={busy === p.id} onClick={() => setTarget({ id: p.id, name: p.name })}
                    className="flex h-10 items-center gap-1.5 rounded-full border-0 bg-[#fdecef] px-3.5 text-[13.5px] font-bold text-[#d6455d] disabled:opacity-50"
                  >
                    {busy === p.id ? <Loader2 size={15} className="animate-spin" /> : <UserMinus size={15} />} Remove
                  </motion.button>
                )}
              </li>
            ))}
          </ul>
          <p className="m-0 mt-4 px-2 text-center text-[13px] leading-snug text-neutral-400">
            {isOwner
              ? 'You own this memory. Choose for each person whether they can edit or only view. Anyone you remove loses access right away and cannot rejoin with an old link.'
              : `${owner?.name ?? 'The owner'} owns this memory and is the only one who can remove people.`}
          </p>
        </div>
      </ToolSheet>
      <ConfirmDialog
        open={!!target} title={`Remove ${target?.name ?? ''}?`} confirmLabel="Remove"
        message="They lose access to this memory immediately. The book is deleted from their phone, and the copies of its photos that they saved to their own Google Drive are deleted too."
        onCancel={() => setTarget(null)} onConfirm={() => void confirm()}
      />
    </>
  )
}
