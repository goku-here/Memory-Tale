import { AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion'
import confetti from 'canvas-confetti'
import { useCallback, useState } from 'react'
import { Canvas } from './components/Canvas'
import { CreateMemorySheet, type SheetState } from './components/CreateMemorySheet'
import { Home } from './components/Home'
import { OpeningBook } from './components/OpeningBook'
import { ShareScreen } from './components/ShareScreen'
import { getTheme } from './components/ThemeEngine'
import { ConfirmDialog, ToastHost, toast } from './components/ui'
import { useMemories } from './data/useMemories'
import type { Memory } from './types'

export default function App() {
  const { memories, loading, save, remove, duplicate, reorder } = useMemories()
  const reduce = useReducedMotion()
  const [sheet, setSheet] = useState<SheetState | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [opening, setOpening] = useState<{ memory: Memory; rect: DOMRect; mode: 'open' | 'close' } | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [shareId, setShareId] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Memory | null>(null)

  const byId = useCallback((id?: string | null) => memories.find((m) => m.id === id), [memories])
  const openMemory = openId ? byId(openId) : undefined

  const startOpen = useCallback((memory: Memory, rect: DOMRect) => {
    setOpenId(memory.id)
    setRevealed(false)
    if (!reduce) setOpening({ memory, rect, mode: 'open' })
  }, [reduce])

  const closeBook = useCallback(() => {
    const m = openId ? memories.find((x) => x.id === openId) : undefined
    const rect = m ? document.querySelector(`[data-book-id="${m.id}"]`)?.getBoundingClientRect() : undefined
    setOpenId(null)
    if (m && rect && !reduce) setOpening({ memory: m, rect, mode: 'close' })
  }, [openId, memories, reduce])

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
    if (isNew) m = { ...m, order: Math.min(0, ...memories.map((x) => x.order ?? 0)) - 1 }
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
        onReorder={(ids) => void reorder(ids)}
        onAdd={() => setSheet({ mode: 'create' })}
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
            hidden={opening?.mode === 'open' && !revealed}
            onEdit={() => setSheet({ mode: 'edit', id: openMemory.id })}
            onTheme={() => setSheet({ mode: 'theme', id: openMemory.id })}
            onShare={() => setShareId(openMemory.id)}
            onDelete={() => setConfirmDelete(openMemory)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {byId(shareId) && <ShareScreen key="share" memory={byId(shareId)!} onClose={() => setShareId(null)} />}
      </AnimatePresence>

      {opening && <OpeningBook key={opening.mode} memory={opening.memory} rect={opening.rect} mode={opening.mode} onReveal={() => setRevealed(true)} onDone={() => setOpening(null)} />}

      <CreateMemorySheet
        state={sheet}
        memory={sheetMemory}
        onClose={() => setSheet(null)}
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
      <ToastHost />
    </MotionConfig>
  )
}
