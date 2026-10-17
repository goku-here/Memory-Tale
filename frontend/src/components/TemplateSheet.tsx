import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { COLLAGES, FRAME_KINDS, GRID_KINDS, type CollageKind } from '../lib/collages'
import { TEMPLATE_CATEGORIES, TEMPLATES, THEME_CATEGORY, type TemplateCategory, type TemplateDef } from '../lib/templates'
import { CollageBody } from './CollageBody'
import { StickerArt, SVG_STICKERS } from './stickers'
import { CollageCard } from './StickerTray'
import { ClotheslineBody } from './Clothesline'
import { ToolSheet } from './ToolSheet'

/** a page template drawn small, from its real pieces */
function TemplateCard({ def, accent, onPick }: { def: TemplateDef; accent: string; onPick: () => void }) {
  return (
    <motion.button
      type="button" aria-label={def.label} whileTap={{ scale: 0.96 }} onClick={onPick}
      className="flex flex-col items-center gap-2 rounded-2xl border-0 bg-[#f6f6f8] p-3 text-center"
      style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)' }}
    >
      <span className="grid h-[176px] w-full place-items-center overflow-hidden">
        <span className="pointer-events-none relative block" style={{ width: `min(100%, ${176 / def.aspect}px)`, aspectRatio: `1 / ${def.aspect}`, containerType: 'inline-size' }}>
          {def.pieces.map((p, i) => {
            const common = {
              position: 'absolute' as const, left: `${50 + p.dx * 100}%`, top: `${((def.aspect / 2 + p.dy) / def.aspect) * 100}%`,
              width: `${p.w * 100}%`, transform: `translate(-50%,-50%) rotate(${p.rot ?? 0}deg)`,
            }
            if (p.type === 'collage') {
              const d = COLLAGES[p.kind]
              return <span key={i} style={{ ...common, aspectRatio: `${d.w} / ${d.h}` }}><CollageBody collage={{ kind: p.kind, photos: d.slots.map(() => '') }} selected={false} /></span>
            }
            if (p.type === 'sticker') {
              const r = SVG_STICKERS[p.id]?.ratio ?? 1
              return <span key={i} style={{ ...common, aspectRatio: `${r}` }}><StickerArt sticker={{ kind: 'svg', value: p.id }} width={40} /></span>
            }
            return <span key={i} style={{ ...common, fontSize: `${(p.size / 360) * 100}cqw`, lineHeight: 1.25, textAlign: p.align, color: p.color, whiteSpace: 'pre-wrap', fontFamily: p.font === 'display' ? "'Caveat', cursive" : "'Manrope', sans-serif", fontWeight: p.font === 'display' ? 700 : 500 }}>{p.text}</span>
          })}
        </span>
      </span>
      <span className="text-[13px] font-bold text-[#17171a]">{def.label}</span>
      <span className="text-[11.5px] font-semibold" style={{ color: accent }}>{def.photos} photo{def.photos === 1 ? '' : 's'}</span>
    </motion.button>
  )
}

/** Page templates, grouped by the kind of memory they suit. Picking one puts it on the page, locked as one piece. */
export function TemplateSheet({
  open, onClose, accent, themeId, onPick, onFrame, onLine,
}: { open: boolean; onClose: () => void; accent: string; themeId: string; onPick: (t: TemplateDef) => void; onFrame: (kind: CollageKind) => void; onLine: () => void }) {
  const [view, setView] = useState<'templates' | 'collages' | 'frames'>('templates')
  useEffect(() => { if (open) setView('templates') }, [open])
  const [cat, setCat] = useState<TemplateCategory | 'All'>(THEME_CATEGORY[themeId] ?? 'All')
  useEffect(() => { if (open) setCat(THEME_CATEGORY[themeId] ?? 'All') }, [open, themeId])
  const list = TEMPLATES.filter((t) => cat === 'All' || t.categories.includes(cat))
  const chips: (TemplateCategory | 'All')[] = ['All', ...TEMPLATE_CATEGORIES]
  return (
    <ToolSheet open={open} onClose={onClose} title="Templates" snaps={[0.94]} dim={0.18} z={55}>
      <div className="px-4 pb-8">
        <div className="mb-3 flex rounded-full bg-neutral-100 p-1" role="tablist" aria-label="What to add">
          {([['templates', 'Templates'], ['collages', 'Collages'], ['frames', 'Frames']] as const).map(([id, label]) => (
            <button
              key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)}
              className="h-10 flex-1 rounded-full border-0 text-[13.5px] font-bold"
              style={view === id ? { background: '#fff', color: '#17171a', boxShadow: '0 1px 4px rgba(0,0,0,.15)' } : { background: 'transparent', color: '#7a7a85' }}
            >{label}</button>
          ))}
        </div>
        {view === 'collages' && (
          <>
            <p className="m-0 px-1 pb-3 text-[13px] leading-snug text-neutral-500">
              Photos in a neat grid. Tap one to put it on your page, then tap each plus to add a photo. Open it later and switch on Use as background to fill the page with it.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {GRID_KINDS.map((k) => <CollageCard key={k} kind={k} accent={accent} onPick={() => onFrame(k)} />)}
            </div>
          </>
        )}
        {view === 'frames' && (
          <>
            <p className="m-0 px-1 pb-3 text-[13px] leading-snug text-neutral-500">
              Tap one to put it on your page, then tap the plus to add your photo. Double-tap it later to change the photo or write a caption.
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <motion.div
                role="button" tabIndex={0} aria-label="Polaroid line" whileTap={{ scale: 0.96 }} onClick={onLine}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onLine() } }}
                className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl bg-[#f6f6f8] p-3 text-center" style={{ boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)' }}
              >
                <span className="grid h-[148px] w-full place-items-center overflow-hidden">
                  {/* the real thing: three polaroids pinned to a twine, empty */}
                  <span className="block" style={{ width: `min(100%, ${148 / 0.64}px)`, aspectRatio: '1 / 0.64' }}>
                    <span className="pointer-events-none block h-full w-full"><ClotheslineBody line={{ photos: ['', '', ''] }} selected={false} /></span>
                  </span>
                </span>
                <span className="text-[13px] font-bold text-[#17171a]">Polaroid line</span>
                <span className="text-[11.5px] font-semibold" style={{ color: accent }}>3 photos</span>
              </motion.div>
              {FRAME_KINDS.map((k) => <CollageCard key={k} kind={k} accent={accent} onPick={() => onFrame(k)} />)}
            </div>
          </>
        )}
        {view === 'templates' && <>
        <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4" role="tablist" aria-label="Template categories" style={{ touchAction: 'pan-x' }}>
          {chips.map((c) => (
            <motion.button
              key={c} role="tab" type="button" aria-selected={cat === c} whileTap={{ scale: 0.95 }} onClick={() => setCat(c)}
              className="h-11 shrink-0 rounded-full border-0 px-5 text-[14px] font-extrabold"
              style={cat === c ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#55555f' }}
            >{c}</motion.button>
          ))}
        </div>
        <p className="m-0 px-1 pb-3 text-[13px] leading-snug text-neutral-500">
          A template arrives locked: move, turn or resize it as one piece, and tap a plus to add your photos. Tap <b>Unlock</b> to edit its pieces, add your own and lock it again.
        </p>
        {list.length === 0 ? (
          <p className="m-0 px-2 py-10 text-center text-[14px] text-neutral-500">More {cat.toLowerCase()} templates are coming soon.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {list.map((t) => <TemplateCard key={t.id} def={t} accent={accent} onPick={() => onPick(t)} />)}
          </div>
        )}
        </>}
      </div>
    </ToolSheet>
  )
}
