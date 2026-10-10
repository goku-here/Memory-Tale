import { AnimatePresence, MotionConfig, useMotionValue, useReducedMotion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useCallback, useEffect, useState } from 'react'
import { Canvas } from './components/Canvas'
import { CreateMemorySheet, type SheetState } from './components/CreateMemorySheet'
import { Home } from './components/Home'
import { OpeningBook } from './components/OpeningBook'
import { DriveChip } from './components/DriveChip'
import { SettingsSheet } from './components/SettingsSheet'
import { InviteScreen } from './components/InviteScreen'
import { ShareScreen } from './components/ShareScreen'
import { useAuth } from './data/useAuth'
import { startOriginals, stopOriginals } from './data/originals'
import { getTheme } from './components/ThemeEngine'
import { ConfirmDialog, ToastHost, toast } from './components/ui'
import { useMemories } from './data/useMemories'
import { Tour } from './components/Tour'
import { tour, tourSeen } from './lib/tour'
import { purgePendingDriveCopies, useRemovals } from './data/people'
import { RemovedScreen } from './components/RemovedScreen'
import type { Memory } from './types'

export default function App() {
  const { memories, loading, save, remove, duplicate, reorder } = useMemories()
  const reduce = useReducedMotion()
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [opening, setOpening] = useState<{ memory: Memory; rect: DOMRect; mode: 'open' | 'close' } | null>(null)
  const progress = useMotionValue(0)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { user } = useAuth()
  const { notices, dismiss } = useRemovals()
  // invite links look like /join/<token>
  const [joinToken, setJoinToken] = useState<string | null>(() => window.location.pathname.match(/^\/join\/([A-Za-z0-9_-]+)/)?.[1] ?? null)
  const [pendingOpen, setPendingOpen] = useState<string | null>(null)
  const [shareId, setShareId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Memory | null>(null)

  // first run: offer the tour to people who have no books yet (people who already do never see it unasked)
  useEffect(() => {
    if (loading || tourSeen() || joinToken) return
    if (memories.length > 0) { tour.dismissSilently(); return }
    const t = window.setTimeout(() => { if (!tourSeen()) tour.start() }, 1400)
    return () => window.clearTimeout(t)
  }, [loading, memories.length, joinToken])

  const byId = useCallback((id?: string | null) => memories.find((m) => m.id === id), [memories])
  const openMemory = openId ? byId(openId) : undefined
  // a book that disappears while it is open (removed by its owner) closes
  useEffect(() => { if (openId && !loading && !memories.some((m) => m.id === openId) && !opening) setOpenId(null) }, [openId, loading, memories, opening])

  // save originals to Google Drive in the background (and resume after a restart)
  useEffect(() => {
    if (!user) return
    startOriginals(user.uid)
    void purgePendingDriveCopies()
    return stopOriginals
  }, [user])

  // after joining, open the book as soon as it has synced down to this device
  useEffect(() => {
    const m = pendingOpen ? memories.find((x) => x.id === pendingOpen) : undefined
    if (!m) return
    setPendingOpen(null)
    // let the shelf settle, bring the new book into view, then open it with the same book animation as everywhere else
    window.setTimeout(() => {
      const el = document.querySelector(`[data-book-id="${m.id}"]`)
      el?.scrollIntoView({ block: 'center' })
      window.setTimeout(() => {
        const rect = document.querySelector(`[data-book-id="${m.id}"]`)?.getBoundingClientRect()
        if (rect && rect.top >= 0 && rect.bottom <= window.innerHeight) startOpen(m, rect)
        else setOpenId(m.id)
      }, 450)
    }, 650)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpen, memories])

  const closeInvite = (memoryId?: string) => {
    setJoinToken(null)
    window.history.replaceState(null, '', '/')
    if (memoryId) { setPendingOpen(memoryId); toast('You are in! Opening the book…') }
  }

  const startOpen = useCallback((memory: Memory, rect: DOMRect) => {
    setOpenId(memory.id)
    progress.set(0)
    if (!reduce) setOpening({ memory, rect, mode: 'open' })
  }, [reduce, progress])

  const closeBook = useCallback(() => {
    const m = openId ? memories.find((x) => x.id === openId) : undefined
    const rect = m ? document.querySelector(`[data-book-id="${m.id}"]`)?.getBoundingClientRect() : undefined
    if (m && rect && !reduce) {
      progress.set(1)
      setOpening({ memory: m, rect, mode: 'close' })
    } else setOpenId(null)
  }, [openId, memories, reduce, progress])

  const openWhenReady = useCallback((memory: Memory) => {
    // wait for the new book to appear in the grid, then open from its slot
    window.setTimeout(() => {
      const el = document.querySelector(`[data-book-id="${memory.id}"]`)
      const rect = el?.getBoundingClientRect()
      if (rect) startOpen(memory, rect)
      else setOpenId(memory.id)
    }, 900)
  }, [startOpen])

  const submit = async (m: Memory, isNew: boolean) => {
    if (isNew) {
      m = { ...m, order: Math.min(0, ...memories.map((x) => x.order ?? 0)) - 1 }
      if (user) m = { ...m, members: [{ id: user.uid, name: user.name, color: getTheme(m.themeId).palette[0], photo: user.photo ?? undefined }] }
    }
    // a new theme brings its own colours: keep the pattern, drop the old background and pattern colour
    const before = !isNew ? byId(m.id) : undefined
    if (before && before.themeId !== m.themeId && m.canvasStyle) m = { ...m, canvasStyle: { pattern: m.canvasStyle.pattern } }
    await save(m)
    setSheet(null)
    if (isNew) {
      if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        const colors = getTheme(m.themeId).palette
        const burst = (x: number, angle: number) =>
          confetti({ particleCount: 70, spread: 70, startVelocity: 48, origin: { x, y: 0.9 }, angle, colors, scalar: 1.1, ticks: 220 })
        burst(0.15, 60)
        burst(0.85, 120)
      }
      openWhenReady(m)
      tour.emit('memory-created')
    } else {
      toast('Saved')
    }
  }

  const sheetMemory = sheet && 'id' in sheet ? byId(sheet.id) : undefined

  return (
    <MotionConfig reducedMotion="user">
      <Home
        memories={memories}
        loading={loading}
        hiddenId={opening?.mode === 'open' ? opening.memory.id : null}
        onSettings={() => setSettingsOpen(true)}
        onReorder={(ids) => void reorder(ids)}
        onAdd={() => { setSheet({ mode: 'create' }); tour.emit('create-open') }}
        onOpen={startOpen}
        onEdit={(m) => setSheet({ mode: 'edit', id: m.id })}
        onTheme={(m) => setSheet({ mode: 'theme', id: m.id })}
        onDuplicate={(m) => { void duplicate(m); toast('Book duplicated') }}
        onDelete={(m) => void remove(m.id)}
      />

      <AnimatePresence>
        {openMemory && (
          <Canvas
            key={openMemory.id}
            memory={openMemory}
            onBack={closeBook}
            reveal={opening ? { p: progress, rect: opening.rect } : undefined}
            onEdit={() => setSheet({ mode: 'edit', id: openMemory.id })}
            onTheme={() => setSheet({ mode: 'theme', id: openMemory.id })}
            onShare={() => setShareId(openMemory.id)}
            onDelete={() => setConfirmDelete(openMemory)}
            onCanvasStyle={(cs) => void save({ ...openMemory, canvasStyle: cs })}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {joinToken && (
          <InviteScreen
            key="invite" token={joinToken} knownIds={new Set(memories.map((m) => m.id))}
            onJoined={(id) => closeInvite(id)} onDismiss={() => closeInvite()}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {byId(shareId) && <ShareScreen key="share" memory={byId(shareId)!} onClose={() => setShareId(null)} />}
      </AnimatePresence>

      {opening && (
        <OpeningBook
          key={opening.mode} memory={opening.memory} rect={opening.rect} mode={opening.mode} progress={progress}
          onDone={() => { if (opening.mode === 'close') setOpenId(null); setOpening(null) }}
        />
      )}

      <CreateMemorySheet
        state={sheet}
        memory={sheetMemory}
        onClose={() => { setSheet(null); tour.emit('create-close') }}
        onSubmit={(m, isNew) => void submit(m, isNew)}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Delete this book?"
        message={`“${confirmDelete?.title ?? ''}” and everything on its canvas will be removed. This can't be undone.`}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          if (confirmDelete) { setOpenId(null); void remove(confirmDelete.id) }
          setConfirmDelete(null)
        }}
      />
      <DriveChip top={openId ? 'calc(var(--safe-top) + 128px)' : 'calc(var(--safe-top) + 84px)'} />
      <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AnimatePresence>
        {notices[0] && <RemovedScreen key={notices[0].id} notice={notices[0]} index={0} total={notices.length} pending={notices[0].pending} onContinue={() => void dismiss(notices[0].id)} />}
      </AnimatePresence>
      <Tour />
      <ToastHost />
    </MotionConfig>
  )
}
