import { ArrowLeft, Check, ChevronDown, Loader2, Minus, Plus, Redo2, Undo2, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { ToolSheet } from './ToolSheet'
import type { ToolId } from './BottomToolbar'
import { IcBubble, IcCamera, IcDraw, IcFlag, IcGrid, IcMore, IcPages, IcPhone, IcPhoto, IcPin, IcNote, IcSticker, IcTemplates, IcText } from './ToolIcons'

/** the laptop layout: a bar along the top, a tool rail down the left (its panel opens beside it), the page in the middle, a strip along the bottom */
export const BAR_H = 56
export const RAIL_W = 84
export const FOOT_H = 46

/* ---------------------------------- top bar ---------------------------------- */

export interface FileItem { label: string; icon: ReactNode; onClick: () => void; danger?: boolean }

interface BarProps {
  title: string
  /** two colours of the book's theme: the bar is painted with them */
  from: string
  to: string
  readOnly: boolean
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  saving: boolean
  here: { id: string; name: string; photo?: string; color: string }[]
  mode: 'edit' | 'story' | 'print'
  onBack: () => void
  onTitle: () => void
  files: FileItem[]
  onShare: () => void
  onStory: () => void
  onPrint: () => void
  /** story and print modes */
  modeSize: string
  onModeSize: () => void
  onModeDone: () => void
  onModeClose: () => void
  onFit: () => void
}

const pill = 'flex h-9 items-center gap-1.5 rounded-full border-0 bg-white/15 px-3.5 text-[13.5px] font-bold text-white transition-colors hover:bg-white/25 active:scale-[.97]'
const round = 'grid h-9 w-9 place-items-center rounded-full border-0 bg-transparent text-white transition-colors hover:bg-white/20 disabled:opacity-35 disabled:hover:bg-transparent'

export function DeskBar(p: BarProps) {
  const [file, setFile] = useState(false)
  return (
    <div
      className="absolute inset-x-0 top-0 z-[60] flex items-center gap-1.5 px-3 text-white"
      style={{ height: BAR_H, background: `linear-gradient(90deg, ${p.from}, ${p.to})`, boxShadow: '0 2px 12px rgba(20,24,40,.18)' }}
    >
      <button type="button" aria-label={p.mode === 'edit' ? 'Back to your shelf' : 'Close'} title={p.mode === 'edit' ? 'Back to your shelf' : 'Close'} onClick={p.mode === 'edit' ? p.onBack : p.onModeClose} className={round}><ArrowLeft size={20} /></button>

      <div className="relative">
        <button type="button" aria-haspopup="menu" aria-expanded={file} onClick={() => setFile((v) => !v)} className={`${pill} !bg-transparent`}>
          Book <ChevronDown size={15} />
        </button>
        {file && (
          <>
            <div className="fixed inset-0 z-40" onPointerDown={() => setFile(false)} />
            <div role="menu" className="absolute left-0 top-[44px] z-50 w-60 rounded-2xl bg-white p-1.5 text-[#17171a] shadow-[0_14px_40px_rgba(20,24,40,.28)]">
              {p.files.map((f) => (
                <button
                  key={f.label} type="button" role="menuitem" onClick={() => { setFile(false); f.onClick() }}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left text-[14.5px] font-semibold hover:bg-neutral-100 ${f.danger ? 'text-[#d6455d]' : ''}`}
                ><span className="[&_svg]:h-[20px] [&_svg]:w-[20px]">{f.icon}</span>{f.label}</button>
              ))}
            </div>
          </>
        )}
      </div>

      <span className="mx-1 h-6 w-px bg-white/30" aria-hidden />
      {!p.readOnly && (
        <>
          <button type="button" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl+Z)" disabled={!p.canUndo} onClick={p.onUndo} className={round}><Undo2 size={19} /></button>
          <button type="button" aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)" disabled={!p.canRedo} onClick={p.onRedo} className={round}><Redo2 size={19} /></button>
          <span className="ml-1 flex items-center gap-1.5 text-[12.5px] font-semibold text-white/85" role="status" aria-live="polite">
            {p.saving ? <><Loader2 size={14} className="animate-spin" /> Saving</> : <><Check size={14} strokeWidth={3} /> Saved</>}
          </span>
        </>
      )}

      <button type="button" onClick={p.onTitle} title={p.readOnly ? p.title : 'Edit the book'} className="mx-3 min-w-0 flex-1 truncate border-0 bg-transparent px-2 text-center text-[15px] font-extrabold text-white">
        {p.title}
      </button>

      {p.here.length > 0 && (
        <span className="mr-1 flex items-center" title={`${p.here.map((h) => h.name).join(', ')} here now`}>
          {p.here.slice(0, 3).map((h, i) => (
            <span key={h.id} className="relative -ml-2 first:ml-0" style={{ zIndex: 5 - i }}>
              {h.photo
                ? <img src={h.photo} alt={h.name} referrerPolicy="no-referrer" className="h-8 w-8 rounded-full object-cover ring-2 ring-white" />
                : <span className="grid h-8 w-8 place-items-center rounded-full text-[12px] font-extrabold text-white ring-2 ring-white" style={{ background: h.color }}>{h.name.slice(0, 1).toUpperCase()}</span>}
            </span>
          ))}
        </span>
      )}

      {p.mode === 'edit' && (
        <>
          <button type="button" onClick={p.onStory} className={pill}><span className="[&_svg]:h-[17px] [&_svg]:w-[17px]"><IcPhone /></span> Story</button>
          <button type="button" onClick={p.onPrint} className={pill}><span className="[&_svg]:h-[17px] [&_svg]:w-[17px]"><IcPages /></span> Print pages</button>
          <button type="button" onClick={p.onShare} className="ml-1 flex h-9 items-center rounded-full border-0 bg-white px-5 text-[14px] font-extrabold text-[#17171a] shadow-[0_2px_8px_rgba(0,0,0,.18)] transition-transform hover:scale-[1.03] active:scale-[.97]">Share</button>
        </>
      )}
      {p.mode === 'print' && <button type="button" onClick={p.onFit} className={pill} title="Move every item inside its page">Fit</button>}
      {p.mode !== 'edit' && (
        <>
          <button type="button" onClick={p.onModeSize} className={pill}>{p.modeSize} <ChevronDown size={14} /></button>
          <button type="button" onClick={p.onModeDone} className="ml-1 flex h-9 items-center gap-1.5 rounded-full border-0 bg-white px-5 text-[14px] font-extrabold text-[#17171a]">
            {p.mode === 'story' ? 'Preview & save' : 'Export pages'}
          </button>
          <button type="button" aria-label="Close" onClick={p.onModeClose} className={round}><X size={19} /></button>
        </>
      )}
    </div>
  )
}

/* ---------------------------------- tool rail ---------------------------------- */

/** the key that picks each tool */
export const TOOL_KEYS: Partial<Record<ToolId, string>> = { templates: 'M', sticker: 'S', text: 'T', draw: 'D', photo: 'P', bubble: 'B', location: 'L', canvas: 'C', note: 'N' }

const TOOLS: { id: ToolId; label: string; icon: ReactNode }[] = [
  { id: 'templates', label: 'Templates', icon: <IcTemplates /> },
  { id: 'sticker', label: 'Stickers', icon: <IcSticker /> },
  { id: 'text', label: 'Text', icon: <IcText /> },
  { id: 'draw', label: 'Draw', icon: <IcDraw /> },
  { id: 'photo', label: 'Photos', icon: <IcPhoto /> },
  { id: 'bubble', label: 'Bubbles', icon: <IcBubble /> },
  { id: 'location', label: 'Places', icon: <IcPin /> },
  { id: 'canvas', label: 'Canvas', icon: <IcGrid /> },
]

const MORE: { id: ToolId; label: string; icon: ReactNode }[] = [
  { id: 'camera', label: 'Camera', icon: <IcCamera /> },
  { id: 'note', label: 'Sticky note', icon: <IcNote /> },
  { id: 'divider', label: 'Stop divider', icon: <IcFlag /> },
]

export function DeskRail({ active, onTool }: { active: ToolId | null; onTool: (t: ToolId) => void }) {
  const [more, setMore] = useState(false)
  const [moreAt, setMoreAt] = useState(16)
  return (
    <nav
      aria-label="Tools" data-ui
      className="no-scrollbar absolute bottom-0 left-0 z-[56] flex flex-col items-center gap-1 overflow-y-auto bg-white py-2"
      style={{ top: BAR_H, width: RAIL_W, boxShadow: '1px 0 0 rgba(20,24,40,.08)' }}
    >
      {TOOLS.map((t) => {
        const on = active === t.id
        return (
          <button
            key={t.id} type="button" aria-label={t.label} title={TOOL_KEYS[t.id] ? `${t.label} (${TOOL_KEYS[t.id]})` : t.label} aria-keyshortcuts={TOOL_KEYS[t.id]} aria-pressed={on} data-tour={t.id === 'sticker' ? 'sticker' : t.id === 'photo' ? 'photo' : undefined} onClick={() => onTool(t.id)}
            className="grid h-[66px] w-[70px] shrink-0 place-items-center rounded-2xl border-0 bg-transparent text-[#17171a] transition-colors hover:bg-neutral-100"
            style={on ? { background: 'rgba(23,23,26,.09)' } : undefined}
          >
            <span className="flex flex-col items-center gap-1.5 leading-none">
              {t.icon}
              <span className="text-[11px] font-bold tracking-tight text-neutral-600">{t.label}</span>
            </span>
          </button>
        )
      })}
      <div className="relative">
        <button
          type="button" aria-label="More" aria-haspopup="menu" aria-expanded={more} onClick={(e) => { setMoreAt(window.innerHeight - e.currentTarget.getBoundingClientRect().top + 8); setMore((v) => !v) }}
          className="grid h-[66px] w-[70px] shrink-0 place-items-center rounded-2xl border-0 bg-transparent text-[#17171a] transition-colors hover:bg-neutral-100"
          style={more ? { background: 'rgba(23,23,26,.09)' } : undefined}
        >
          <span className="flex flex-col items-center gap-1.5 leading-none">
            <IcMore />
            <span className="text-[11px] font-bold tracking-tight text-neutral-600">More</span>
          </span>
        </button>
        {more && (
          <>
            <div className="fixed inset-0 z-40" onPointerDown={() => setMore(false)} />
            <div role="menu" className="fixed z-50 w-56 rounded-2xl bg-white p-1.5 shadow-[0_14px_40px_rgba(20,24,40,.25),0_0_0_1px_rgba(20,24,40,.05)]" style={{ left: RAIL_W + 8, bottom: moreAt }}>
              {MORE.map((m) => (
                <button
                  key={m.id} type="button" role="menuitem" onClick={() => { setMore(false); onTool(m.id) }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl border-0 bg-transparent px-3 text-left text-[14.5px] font-semibold text-[#17171a] hover:bg-neutral-100"
                >{m.icon}<span className="flex-1">{m.label}</span>{TOOL_KEYS[m.id] && <kbd className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[11px] font-bold text-neutral-500">{TOOL_KEYS[m.id]}</kbd>}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </nav>
  )
}

/* ---------------------------------- bottom strip ---------------------------------- */

export function DeskFoot({
  left, zoom, zmin, zmax, onZoom, accent,
}: { left: ReactNode; zoom: number; zmin: number; zmax: number; onZoom: (z: number) => void; accent: string }) {
  return (
    <div
      data-ui className="absolute bottom-0 right-0 z-[55] flex items-center justify-between gap-4 bg-white px-4 text-[13px] font-semibold text-neutral-600"
      style={{ height: FOOT_H, left: 'calc(84px + var(--dock-w, 0px))', transition: 'left .22s ease', boxShadow: '0 -1px 0 rgba(20,24,40,.08)' }}
    >
      <span className="truncate">{left}</span>
      <span className="flex items-center gap-2">
        <button type="button" aria-label="Zoom out" onClick={() => onZoom(zoom - 0.1)} className="grid h-8 w-8 place-items-center rounded-full border-0 bg-transparent hover:bg-neutral-100"><Minus size={16} /></button>
        <input
          type="range" min={Math.round(zmin * 100)} max={Math.round(zmax * 100)} value={Math.round(zoom * 100)} aria-label="Zoom"
          onChange={(e) => onZoom(+e.target.value / 100)} className="h-6 w-40" style={{ accentColor: accent }}
        />
        <button type="button" aria-label="Zoom in" onClick={() => onZoom(zoom + 0.1)} className="grid h-8 w-8 place-items-center rounded-full border-0 bg-transparent hover:bg-neutral-100"><Plus size={16} /></button>
        <span className="w-11 text-right tabular-nums text-[#17171a]">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={() => onZoom(1)} className="h-8 rounded-full border-0 bg-neutral-100 px-3.5 text-[12.5px] font-bold text-[#17171a] hover:bg-neutral-200">Fit</button>
      </span>
    </div>
  )
}

/* ---------------------------------- keyboard shortcuts ---------------------------------- */

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const MOD = MAC ? '⌘' : 'Ctrl'

const GROUPS: { title: string; rows: [string[], string][] }[] = [
  {
    title: 'Add to the page',
    rows: [
      [['S'], 'Stickers'], [['T'], 'Text'], [['D'], 'Draw'], [['P'], 'Photos'], [['B'], 'Chat bubble'],
      [['N'], 'Sticky note'], [['L'], 'Places'], [['M'], 'Templates, collages and frames'], [['C'], 'Canvas style'],
    ],
  },
  {
    title: 'Edit',
    rows: [
      [[MOD, 'Z'], 'Undo'], [[MOD, 'Shift', 'Z'], 'Redo'], [[MOD, 'C'], 'Copy'], [[MOD, 'V'], 'Paste'], [[MOD, 'D'], 'Duplicate'],
      [['Delete'], 'Delete'], [['Enter'], 'Edit the selected item'], [['Esc'], 'Let go / close'],
      [['← ↑ ↓ →'], 'Nudge 1 px (with Shift: 10 px)'], [[']'], 'Bring forward'], [['['], 'Send backward'],
      [[MOD, 'G'], 'Group with another item'], [[MOD, 'Shift', 'G'], 'Ungroup'], [['Space'], 'View the selected photo'],
    ],
  },
  {
    title: 'Page',
    rows: [[[MOD, '+'], 'Zoom in'], [[MOD, '−'], 'Zoom out'], [[MOD, '0'], 'Fit to width'], [[MOD, 'Scroll'], 'Zoom with the wheel'], [['?'], 'This list']],
  },
  {
    title: 'Drawing page',
    rows: [[['1', '…', '7'], 'Pen, marker, highlighter, pencil, crayon, calligraphy, eraser'], [['[', ']'], 'Thinner / thicker'], [['H'], 'Hand: move the page'], [[MOD, 'Z'], 'Undo a stroke'], [[MOD, 'Enter'], 'Done']],
  },
  {
    title: 'Text page',
    rows: [[[MOD, 'Enter'], 'Done'], [['Esc'], 'Cancel']],
  },
]

export function ShortcutsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <ToolSheet open={open} onClose={onClose} title="Keyboard shortcuts" snaps={[0.9]} z={90} wide>
      <div className="grid gap-x-10 gap-y-6 px-6 pb-6 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title}>
            <h3 className="m-0 mb-2 text-[12px] font-extrabold uppercase tracking-wider text-neutral-400">{g.title}</h3>
            <div className="space-y-1.5">
              {g.rows.map(([keys, what]) => (
                <div key={what} className="flex items-center justify-between gap-3 text-[14px] font-semibold text-[#17171a]">
                  <span>{what}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    {keys.map((k) => <kbd key={k} className="min-w-6 rounded-md bg-neutral-100 px-1.5 py-0.5 text-center text-[12px] font-bold text-neutral-600 shadow-[inset_0_-1px_0_rgba(0,0,0,.12)]">{k}</kbd>)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </ToolSheet>
  )
}
