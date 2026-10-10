import { motion } from 'framer-motion'
import type { RemovalNotice } from '../data/people'
import { BookCover } from './BookCard'
import { getTheme } from './ThemeEngine'

/** Full-screen notice for a book the owner has taken you out of. Several books are shown one after another. */
export function RemovedScreen({ notice, index, total, pending, onContinue }: { notice: RemovalNotice; index: number; total: number; pending: number; onContinue: () => void }) {
  const first = (notice.ownerName || 'The owner').split(' ')[0]
  const theme = getTheme(notice.themeId ?? 'friends')
  return (
    <motion.div
      key={notice.id} role="alertdialog" aria-modal aria-label="You no longer have access to this book"
      className="fixed inset-0 z-[90] grid place-items-center bg-[#f6f5f2] px-8 text-center"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }} className="max-w-[330px]">
        {total > 1 && <div className="mb-4 text-[13px] font-extrabold uppercase tracking-wider text-neutral-400">{index + 1} of {total}</div>}
        {notice.cover ? (
          <motion.div className="mx-auto w-[150px]" initial={{ rotate: -6, scale: 0.9 }} animate={{ rotate: -3, scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 16 }} style={{ filter: 'grayscale(.35)' }}>
            <BookCover memory={{ title: notice.title, themeId: notice.themeId ?? 'friends', cover: notice.cover, date: notice.date ?? '', members: [{ id: 'o', name: notice.ownerName, color: theme.palette[0], photo: notice.ownerPhoto }] }} />
          </motion.div>
        ) : <div className="text-[56px]">{theme.emoji}</div>}
        <h1 className="m-0 mt-6 text-[24px] font-extrabold leading-tight">You no longer have access to “{notice.title}”</h1>
        <p className="m-0 mt-3 text-[15px] leading-relaxed text-neutral-500">
          {first} removed you from this book. It has been deleted from your phone
          {notice.fileIds.length > 0 && (pending ? ', and the copies of its photos in your Google Drive are being removed' : ', and the copies of its photos you saved to Google Drive have been deleted')}.
        </p>
        {pending > 0 && (
          <p className="m-0 mt-2 text-[13px] leading-snug text-neutral-400">
            {pending} {pending === 1 ? 'copy' : 'copies'} will be deleted the next time Google Drive is connected on this device.
          </p>
        )}
        <button type="button" onClick={onContinue} className="mt-7 h-12 rounded-full border-0 bg-[#17171a] px-10 text-[15px] font-semibold text-white">
          {index + 1 < total ? 'Next' : 'OK'}
        </button>
      </motion.div>
    </motion.div>
  )
}
