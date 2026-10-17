import { motion } from 'framer-motion'
import { AlignCenter, AlignLeft, AlignRight, Check, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ResolvedCanvas } from '../lib/canvasStyle'
import type { TextProps, TextRun } from '../types'
import { TEXT_FONTS } from './TextEditor'
import { CustomColor } from './ColorPicker'
import { useDesktop } from '../lib/useDesktop'
import { IcAlignTool, IcColorTool, IcFontTool, IcSizeTool } from './ToolIcons'

const EXTRA = ['#17171A', '#FFFFFF', '#E5486F', '#F28C38', '#FFC93C', '#2F8FD0', '#5F8650', '#8F5BD0']
type Tool = 'font' | 'size' | 'align' | 'color'
type Style = Pick<TextRun, 'font' | 'k' | 'color'>

/* ---------- the text as runs: pieces of text that each may carry their own font, size (a multiple of the block's) and colour ---------- */

const sameStyle = (a: Style, b: Style) => a.font === b.font && a.k === b.k && a.color === b.color
const strip = (r: TextRun): TextRun => {
  const o: TextRun = { t: r.t }
  if (r.font) o.font = r.font
  if (r.k && Math.abs(r.k - 1) > 0.01) o.k = Math.round(r.k * 1000) / 1000
  if (r.color) o.color = r.color
  return o
}
export const runsText = (runs: TextRun[]) => runs.map((r) => r.t).join('')

function toChars(runs: TextRun[]) {
  const out: (Style & { ch: string })[] = []
  for (const r of runs) for (let i = 0; i < r.t.length; i++) out.push({ ch: r.t[i], font: r.font, k: r.k, color: r.color })
  return out
}
function toRuns(chars: (Style & { ch: string })[]) {
  const out: TextRun[] = []
  for (const c of chars) {
    const last = out[out.length - 1]
    if (last && sameStyle(last, c)) last.t += c.ch
    else out.push(strip({ t: c.ch, font: c.font, k: c.k, color: c.color }))
  }
  return out
}

/** the editable area's content, read back as runs (a line break is a newline; the extra break a browser keeps at the end is dropped) */
function readRuns(root: HTMLElement): TextRun[] {
  const out: TextRun[] = []
  const endsNl = () => (out[out.length - 1]?.t.endsWith('\n') ?? true)
  const push = (t: string, st: Style) => {
    if (!t) return
    const last = out[out.length - 1]
    if (last && sameStyle(last, st)) last.t += t
    else out.push(strip({ t, ...st }))
  }
  const walk = (n: Node, st: Style) => {
    if (n.nodeType === 3) { push(n.textContent ?? '', st); return }
    if (!(n instanceof HTMLElement)) return
    if (n.tagName === 'BR') { push('\n', st); return }
    const s2: Style = { ...st }
    if (n.dataset.font) s2.font = n.dataset.font
    if (n.dataset.k) s2.k = +n.dataset.k
    if (n.dataset.color) s2.color = n.dataset.color
    if ((n.tagName === 'DIV' || n.tagName === 'P') && n !== root && out.length && !endsNl()) push('\n', st)
    n.childNodes.forEach((c) => walk(c, s2))
  }
  walk(root, {})
  let leaf: Node | null = root
  while (leaf && leaf.lastChild) leaf = leaf.lastChild
  const last = out[out.length - 1]
  if (leaf instanceof HTMLElement && leaf.tagName === 'BR' && last?.t.endsWith('\n')) last.t = last.t.slice(0, -1)
  return out.filter((r) => r.t)
}

/** put runs into the editable area */
function build(root: HTMLElement, runs: TextRun[]) {
  root.textContent = ''
  for (const r of runs) {
    const span = document.createElement('span')
    if (r.font) { span.dataset.font = r.font; span.style.fontFamily = r.font }
    if (r.k) { span.dataset.k = String(r.k); span.style.fontSize = `${r.k}em` }
    if (r.color) { span.dataset.color = r.color; span.style.color = r.color }
    r.t.split('\n').forEach((part, i) => {
      if (i > 0) span.append(document.createElement('br'))
      if (part) span.append(document.createTextNode(part))
    })
    root.append(span)
  }
  if (runsText(runs).endsWith('\n')) root.append(document.createElement('br'))
}

/** how many characters come before a point in the editable area */
function offsetOf(root: HTMLElement, node: Node, off: number) {
  const r = document.createRange()
  r.selectNodeContents(root)
  r.setEnd(node, off)
  const f = r.cloneContents()
  let n = 0
  const walk = (x: Node) => {
    if (x.nodeType === 3) n += x.textContent?.length ?? 0
    else if (x instanceof HTMLElement && x.tagName === 'BR') n += 1
    else x.childNodes.forEach(walk)
  }
  walk(f)
  return n
}
function setOffsets(root: HTMLElement, s: number, e: number) {
  const leaves: Node[] = []
  const walk = (x: Node) => {
    if (x.nodeType === 3) leaves.push(x)
    else if (x instanceof HTMLElement && x.tagName === 'BR') leaves.push(x)
    else x.childNodes.forEach(walk)
  }
  walk(root)
  const find = (p: number): [Node, number] => {
    let c = 0
    for (const l of leaves) {
      if (l.nodeType === 3) {
        const len = l.textContent?.length ?? 0
        if (p <= c + len) return [l, p - c]
        c += len
      } else {
        if (p === c) { const par = l.parentNode!; return [par, Array.prototype.indexOf.call(par.childNodes, l)] }
        c += 1
      }
    }
    return [root, root.childNodes.length]
  }
  const [a, ao] = find(s), [b, bo] = find(e)
  const r = document.createRange()
  r.setStart(a, ao)
  r.setEnd(b, bo)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(r)
}

interface Props {
  seed: TextProps
  /** the width (px) the block will have on the page: the writing area has the same width, so lines break in the same places */
  boxW: number
  /** theme colours first */
  palette: string[]
  accent: string
  /** the book's own canvas look, so the page matches it */
  look: ResolvedCanvas
  onDone: (p: TextProps, width: number) => void
  onCancel: () => void
}

/**
 * A page of its own for writing: an empty canvas where typing starts at once. Font, size, alignment and colour
 * sit above the keyboard. With nothing selected they change the whole block; select words (long press) and they
 * change just those. Done puts the block on the canvas exactly as written.
 */
export function TextStudio({ seed, boxW, palette, accent, look, onDone, onCancel }: Props) {
  const desk = useDesktop()
  // the tools take the left panel, and the page makes way for it
  useEffect(() => {
    if (!desk) return
    const root = document.documentElement
    root.style.setProperty('--dock-w', '360px')
    return () => root.style.setProperty('--dock-w', '0px')
  }, [desk])
  const [v, setV] = useState<TextProps>(seed)
  const vRef = useRef(v)
  vRef.current = v
  const [tool, setTool] = useState<Tool>('font')
  const [kb, setKb] = useState(0)
  const [sel, setSel] = useState<{ font: string; size: number; color: string } | null>(null)
  const ed = useRef<HTMLDivElement>(null)
  const saved = useRef<{ s: number; e: number } | null>(null)
  /** rebuilding the text moves the selection by itself: ignore those moves */
  const quietUntil = useRef(0)
  const swatches = [...new Set([...palette.filter((c) => c !== '#FFFFFF'), ...EXTRA])]

  // start with what is already written, and the cursor at its end
  useEffect(() => {
    const root = ed.current!
    const runs = seed.runs?.length ? seed.runs : seed.text ? [{ t: seed.text }] : []
    build(root, runs)
    const t = setTimeout(() => { root.focus(); const n = runsText(runs).length; setOffsets(root, n, n) }, 120)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // keep the tools right above the on-screen keyboard
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const on = () => setKb(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    on()
    vv.addEventListener('resize', on)
    vv.addEventListener('scroll', on)
    return () => { vv.removeEventListener('resize', on); vv.removeEventListener('scroll', on) }
  }, [])

  // a line break is a plain new line; pasted text is plain text
  useEffect(() => {
    const root = ed.current!
    const before = (e: Event) => {
      const t = (e as InputEvent).inputType
      if (t === 'insertParagraph') { e.preventDefault(); document.execCommand('insertLineBreak') }
    }
    const paste = (e: ClipboardEvent) => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '') }
    root.addEventListener('beforeinput', before)
    root.addEventListener('paste', paste)
    return () => { root.removeEventListener('beforeinput', before); root.removeEventListener('paste', paste) }
  }, [])

  const styleAt = (runs: TextRun[], at: number, base: TextProps) => {
    let c = 0
    let hit: TextRun | undefined
    for (const r of runs) { if (at < c + r.t.length) { hit = r; break } c += r.t.length }
    return { font: hit?.font ?? base.font, size: Math.round((hit?.k ?? 1) * base.size), color: hit?.color ?? base.color }
  }

  /** what is selected right now (words chosen by long press or dragging), remembered while the tools are used */
  useEffect(() => {
    const read = () => {
      const root = ed.current
      const s = window.getSelection()
      if (!root || !s || !s.rangeCount || !root.contains(s.anchorNode) || performance.now() < quietUntil.current) return
      const r = s.getRangeAt(0)
      const a = offsetOf(root, r.startContainer, r.startOffset), b = offsetOf(root, r.endContainer, r.endOffset)
      if (b > a) {
        saved.current = { s: a, e: b }
        setSel(styleAt(readRuns(root), a, vRef.current))
      } else { saved.current = null; setSel(null) }
    }
    document.addEventListener('selectionchange', read)
    return () => document.removeEventListener('selectionchange', read)
  }, [])

  const onInput = () => {
    const root = ed.current!
    const runs = readRuns(root)
    if (!runs.length) root.textContent = '' // so the hint shows again
    setV((x) => ({ ...x, text: runsText(runs), runs }))
  }

  /** a font, size or colour: for the chosen words if there are any, otherwise for the whole block */
  const style = (kind: 'font' | 'size' | 'color', value: string | number) => {
    const root = ed.current!
    const runs = readRuns(root)
    const s = saved.current
    if (s) {
      const chars = toChars(runs)
      for (let i = s.s; i < Math.min(s.e, chars.length); i++) {
        if (kind === 'font') chars[i].font = value as string
        else if (kind === 'color') chars[i].color = value as string
        else chars[i].k = (value as number) / vRef.current.size
      }
      const next = toRuns(chars)
      quietUntil.current = performance.now() + 120
      build(root, next)
      // the chosen words stay chosen, so the next change (or the next step of the size slider) still reaches them
      root.focus({ preventScroll: true })
      setOffsets(root, s.s, s.e)
      setV((x) => ({ ...x, text: runsText(next), runs: next }))
      setSel(styleAt(next, s.s, vRef.current))
    } else {
      const next = runs.map((r) => { const n = { ...r }; if (kind === 'font') delete n.font; if (kind === 'color') delete n.color; return n })
      const hadFocus = document.activeElement === root
      const cur = window.getSelection()
      const at = hadFocus && cur?.rangeCount ? offsetOf(root, cur.getRangeAt(0).startContainer, cur.getRangeAt(0).startOffset) : null
      build(root, next)
      if (at !== null) setOffsets(root, at, at)
      setV((x) => ({ ...x, [kind]: value, text: runsText(next), runs: next }))
    }
  }

  const finish = () => {
    const root = ed.current!
    const runs = readRuns(root)
    const text = runsText(runs)
    const rich = runs.some((r) => r.font || r.k || r.color)
    const { runs: _drop, ...rest } = v
    // the block hugs its words: as wide as the longest line, so there is no empty space either side
    const range = document.createRange()
    range.selectNodeContents(root)
    let lo = Infinity, hi = -Infinity
    for (const r of Array.from(range.getClientRects())) { if (r.width > 0) { lo = Math.min(lo, r.left); hi = Math.max(hi, r.right) } }
    const hug = Number.isFinite(lo) ? Math.ceil(hi - lo) + 6 : root.clientWidth
    onDone({ ...rest, text, ...(rich ? { runs } : {}) }, Math.min(Math.round(root.clientWidth), Math.max(24, hug)))
  }

  // tools do not take the keyboard's focus (that would lose the selection); with nothing selected the keyboard goes away
  const holdFocus = (e: React.PointerEvent) => { if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault() } // the size slider must be free to drag
  const afterTool = () => { if (!saved.current) window.setTimeout(() => ed.current?.blur(), 150) }

  const curFont = sel?.font ?? v.font
  const curSize = sel?.size ?? v.size
  const curColor = sel?.color ?? v.color
  const tools: { id: Tool; label: string; icon: ReactNode }[] = [
    { id: 'font', label: 'Font', icon: <IcFontTool /> },
    { id: 'size', label: 'Size', icon: <IcSizeTool /> },
    { id: 'align', label: 'Align', icon: <IcAlignTool align={v.align} /> },
    { id: 'color', label: 'Colour', icon: <IcColorTool /> },
  ]
  const focusEnd = () => { const root = ed.current!; root.focus(); const n = runsText(readRuns(root)).length; setOffsets(root, n, n) }

  return (
    <motion.div
      className={desk ? 'fixed z-[80]' : 'fixed inset-0 z-[80]'} role="dialog" aria-label="Write text"
      style={desk ? { left: 84 + 360, top: 56, right: 0, bottom: 0, background: '#eceef2' } : undefined}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
    >
      {!desk && <div className="absolute inset-0 bg-black/35" aria-hidden />}
      {/* the same sheet as the drawing page: slides up with a curved top edge, over a dimmed book */}
      <motion.div
        className={desk ? 'absolute inset-y-0 left-1/2 flex w-full max-w-[780px] -translate-x-1/2 flex-col overflow-hidden' : 'absolute inset-x-0 bottom-0 mx-auto flex max-w-[520px] flex-col overflow-hidden rounded-t-[30px]'}
        style={desk ? { ...look.css, background: look.bg, backgroundColor: look.bg, boxShadow: '0 0 0 1px rgba(0,0,0,.06), 0 18px 60px rgba(20,24,40,.14)' } : { ...look.css, top: 'calc(var(--safe-top) + 6px)', background: look.bg, backgroundColor: look.bg }}
        initial={desk ? false : { y: 60 }} animate={desk ? undefined : { y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      >
      <div className="flex items-center justify-between px-3 pt-3">
        <button type="button" aria-label="Cancel" onClick={onCancel} className="grid h-11 w-11 place-items-center rounded-full border-0 bg-white/80 text-[#17171a] backdrop-blur"><X size={20} /></button>
        <motion.button
          type="button" whileTap={{ scale: 0.95 }} onClick={finish} disabled={!v.text.trim()}
          className="flex h-11 items-center gap-1.5 rounded-full border-0 bg-[#17171a] px-5 text-[15px] font-semibold text-white disabled:opacity-35"
        >
          <Check size={18} strokeWidth={3} /> Done
        </motion.button>
      </div>

      {/* the page: the writing area is as wide as the block will be on the canvas, so lines break the same way */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-8" onClick={(e) => { if (e.target === e.currentTarget) focusEnd() }}>
        <div
          ref={ed} contentEditable suppressContentEditableWarning role="textbox" aria-multiline aria-label="Your text" spellCheck
          data-ph="Start typing…" onInput={onInput}
          className="mt-editor mx-auto min-h-[55%] outline-none"
          style={{
            width: Math.min(boxW, 4000), maxWidth: '100%', fontFamily: v.font, fontSize: v.size, color: v.color, textAlign: v.align, lineHeight: 1.15,
            whiteSpace: 'pre-wrap', overflowWrap: 'break-word', wordBreak: 'break-word', caretColor: accent, textShadow: '0 1px 0 rgba(255,255,255,.5)',
          }}
        />
      </div>

      {/* tools, riding above the keyboard */}
      {!desk && <div className="shrink-0" style={{ paddingBottom: kb > 0 ? kb : 'var(--safe-bottom)' }} onPointerDown={holdFocus} onPointerUp={afterTool}>
        <div className="mx-3 mb-2 overflow-hidden rounded-[22px] bg-white shadow-[0_10px_34px_rgba(20,24,40,.2),0_0_0_1px_rgba(20,24,40,.05)]">
          {sel && <div className="px-4 pt-2.5 text-[12px] font-extrabold uppercase tracking-wider" style={{ color: accent }}>Changing the selected words</div>}
          <div className="min-h-[84px] py-3">
            {tool === 'font' && (
              <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-3" style={{ touchAction: 'pan-x' }} role="radiogroup" aria-label="Font">
                {TEXT_FONTS.map((f) => {
                  const on = curFont === f.css
                  return (
                    <button
                      key={f.css} type="button" role="radio" aria-checked={on} onClick={() => style('font', f.css)}
                      className="grid h-[66px] w-[88px] shrink-0 place-items-center rounded-2xl border-0"
                      style={{ background: on ? `${accent}18` : '#f6f6f8', boxShadow: on ? `inset 0 0 0 2px ${accent}` : 'none' }}
                    >
                      <span className="text-[24px] leading-none" style={{ fontFamily: f.css, color: '#17171a' }}>Aa</span>
                      <span className="text-[11px] font-bold text-neutral-500">{f.label}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {tool === 'size' && (
              <div className="flex items-center gap-3 px-5" style={{ minHeight: 66 }}>
                <span className="text-[13px] font-bold text-neutral-400">A</span>
                <input type="range" min={10} max={120} value={curSize} aria-label="Text size" onChange={(e) => style('size', +e.target.value)} className="h-11 flex-1" style={{ accentColor: accent }} />
                <span className="text-[24px] font-bold text-neutral-500">A</span>
                <span className="w-9 text-right text-[13px] font-bold tabular-nums text-neutral-500">{Math.round(curSize)}</span>
              </div>
            )}
            {tool === 'align' && (
              <div className="flex items-center justify-center gap-3 px-5" style={{ minHeight: 66 }} role="group" aria-label="Alignment">
                {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
                  <button
                    key={a} type="button" aria-label={`Align ${a}`} aria-pressed={v.align === a} onClick={() => setV((x) => ({ ...x, align: a }))}
                    className="grid h-14 w-24 place-items-center rounded-2xl border-0"
                    style={v.align === a ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#55555f' }}
                  >
                    <Icon size={22} />
                  </button>
                ))}
              </div>
            )}
            {tool === 'color' && (
              <div className="no-scrollbar flex gap-1 overflow-x-auto px-3" style={{ touchAction: 'pan-x', minHeight: 66 }} role="radiogroup" aria-label="Colour">
                {swatches.map((c) => {
                  const on = curColor.toLowerCase() === c.toLowerCase()
                  return (
                    <button key={c} type="button" role="radio" aria-checked={on} aria-label={c} onClick={() => style('color', c)} className="grid h-14 w-12 shrink-0 place-items-center rounded-full border-0 bg-transparent">
                      <span className="h-9 w-9 rounded-full" style={{ background: c, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${accent}` : 'inset 0 0 0 1px rgba(0,0,0,.16)' }} />
                    </button>
                  )
                })}
                <CustomColor value={curColor} listed={swatches.some((c) => c.toLowerCase() === curColor.toLowerCase())} accent={accent} onPick={(c) => style('color', c)} cell="h-14 w-12" dot={36} />
              </div>
            )}
          </div>
          <div className="flex border-t border-black/5" role="tablist" aria-label="Text tools">
            {tools.map((t) => {
              const on = tool === t.id
              return (
                <button
                  key={t.id} type="button" role="tab" aria-selected={on} onClick={() => setTool(t.id)}
                  className="flex h-14 flex-1 flex-col items-center justify-center gap-0.5 border-0 bg-transparent"
                  style={{ color: on ? accent : '#6b6b76' }}
                >
                  <span className="transition-transform" style={{ transform: on ? 'scale(1.08)' : 'scale(.92)', opacity: on ? 1 : 0.8 }}>{t.icon}</span>
                  <span className="text-[11px] font-bold">{t.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>}
      </motion.div>

      {/* a laptop: every tool in the left panel, next to the page */}
      {desk && (
        <div
          className="fixed z-[80] flex flex-col overflow-y-auto bg-white" onPointerDown={holdFocus} data-ui
          style={{ left: 84, top: 56, bottom: 0, width: 360, boxShadow: '1px 0 0 rgba(20,24,40,.08), 10px 0 30px rgba(20,24,40,.08)' }}
        >
          <div className="px-5 pb-5 pt-4">
            <h2 className="m-0 text-[16px] font-extrabold text-[#17171a]">Text</h2>
            <p className="m-0 mt-1 text-[12.5px] leading-snug text-neutral-500">
              {sel ? <b style={{ color: accent }}>Changing the selected words.</b> : 'Type on the page. Select words to style just those.'}
            </p>

            <div className="mt-5 text-[12px] font-extrabold uppercase tracking-wider text-neutral-400">Font</div>
            <div className="mt-2 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Font">
              {TEXT_FONTS.map((f) => {
                const on = curFont === f.css
                return (
                  <button
                    key={f.css} type="button" role="radio" aria-checked={on} onClick={() => style('font', f.css)}
                    className="grid h-[68px] place-items-center rounded-2xl border-0"
                    style={{ background: on ? `${accent}18` : '#f6f6f8', boxShadow: on ? `inset 0 0 0 2px ${accent}` : 'none' }}
                  >
                    <span className="text-[24px] leading-none" style={{ fontFamily: f.css, color: '#17171a' }}>Aa</span>
                    <span className="text-[11px] font-bold text-neutral-500">{f.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="mt-6 text-[12px] font-extrabold uppercase tracking-wider text-neutral-400">Size</div>
            <div className="mt-1 flex items-center gap-3">
              <span className="text-[13px] font-bold text-neutral-400">A</span>
              <input type="range" min={10} max={120} value={curSize} aria-label="Text size" onChange={(e) => style('size', +e.target.value)} className="h-11 flex-1" style={{ accentColor: accent }} />
              <span className="text-[24px] font-bold text-neutral-500">A</span>
              <span className="w-9 text-right text-[13px] font-bold tabular-nums text-neutral-500">{Math.round(curSize)}</span>
            </div>

            <div className="mt-5 text-[12px] font-extrabold uppercase tracking-wider text-neutral-400">Align</div>
            <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Alignment">
              {([['left', AlignLeft], ['center', AlignCenter], ['right', AlignRight]] as const).map(([a, Icon]) => (
                <button
                  key={a} type="button" aria-label={`Align ${a}`} aria-pressed={v.align === a} onClick={() => setV((x) => ({ ...x, align: a }))}
                  className="grid h-12 place-items-center rounded-2xl border-0"
                  style={v.align === a ? { background: '#17171a', color: '#fff' } : { background: '#f1f1f3', color: '#55555f' }}
                ><Icon size={20} /></button>
              ))}
            </div>

            <div className="mt-6 text-[12px] font-extrabold uppercase tracking-wider text-neutral-400">Colour</div>
            <div className="mt-1 flex flex-wrap gap-0.5" role="radiogroup" aria-label="Colour">
              {swatches.map((c) => {
                const on = curColor.toLowerCase() === c.toLowerCase()
                return (
                  <button key={c} type="button" role="radio" aria-checked={on} aria-label={c} onClick={() => style('color', c)} className="grid h-12 w-12 place-items-center rounded-full border-0 bg-transparent">
                    <span className="h-9 w-9 rounded-full" style={{ background: c, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${accent}` : 'inset 0 0 0 1px rgba(0,0,0,.16)' }} />
                  </button>
                )
              })}
              <CustomColor value={curColor} listed={swatches.some((c) => c.toLowerCase() === curColor.toLowerCase())} accent={accent} onPick={(c) => style('color', c)} cell="h-12 w-12" dot={36} />
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}
