import { MotionConfig } from 'framer-motion'
import { Home } from './components/Home'
import { ToastHost, toast } from './components/ui'
import { useMemories } from './data/useMemories'
import { uid } from './lib/id'
import type { Memory } from './types'

export default function App() {
  const { memories, loading, save, remove, duplicate } = useMemories()

  // Temporary until the Create Memory sheet lands in the next step.
  const addSample = () => {
    const m: Memory = {
      id: uid(), title: 'New memory', category: 'romantic', themeId: 'romantic',
      cover: { type: 'color', value: '#9DB7D5' }, date: new Date().toISOString().slice(0, 10), createdAt: Date.now(),
    }
    void save(m)
  }

  return (
    <MotionConfig reducedMotion="user">
      <Home
        memories={memories}
        loading={loading}
        onAdd={addSample}
        onOpen={() => toast('Canvas is coming in the next step')}
        onEdit={() => toast('Editing arrives with the Create sheet')}
        onTheme={() => toast('Themes arrive with the Create sheet')}
        onDuplicate={(m) => void duplicate(m)}
        onDelete={(m) => void remove(m.id)}
      />
      <ToastHost />
    </MotionConfig>
  )
}
