/**
 * Simple outline illustrations to trace over in the drawing page. They are only a guide: they are never part of the drawing.
 * Each is the inside of a 100 x 100 SVG, drawn with one round line.
 */
export interface TraceArt { id: string; label: string; body: string }

const petals = [0, 60, 120, 180, 240, 300].map((r) => `<ellipse cx="50" cy="19" rx="8" ry="13" transform="rotate(${r} 50 38)"/>`).join('')
const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((r) => `<path d="M50 5V19" transform="rotate(${r} 50 50)"/>`).join('')

export const TRACE_ART: TraceArt[] = [
  { id: 'heart', label: 'Heart', body: '<path d="M50 88C12 62 8 36 23 23 36 12 48 19 50 32 52 19 64 12 77 23 92 36 88 62 50 88Z"/>' },
  { id: 'star', label: 'Star', body: '<path d="M50 8 61 38 93 39 68 58 77 90 50 71 23 90 32 58 7 39 39 38Z"/>' },
  { id: 'flower', label: 'Flower', body: `${petals}<circle cx="50" cy="38" r="7"/><path d="M50 52C47 68 53 80 50 96"/><path d="M50 78C62 68 72 72 78 64 72 80 60 84 50 78Z"/>` },
  { id: 'butterfly', label: 'Butterfly', body: '<path d="M50 50C30 12 4 20 14 46 18 58 34 58 50 50Z"/><path d="M50 50C70 12 96 20 86 46 82 58 66 58 50 50Z"/><path d="M50 52C34 60 18 68 28 84 36 92 48 74 50 52Z"/><path d="M50 52C66 60 82 68 72 84 64 92 52 74 50 52Z"/><path d="M50 32V78"/><path d="M50 32C46 22 40 18 35 16M50 32C54 22 60 18 65 16"/>' },
  { id: 'cat', label: 'Cat', body: '<path d="M20 40 16 12 38 26C46 24 54 24 62 26L84 12 80 40C90 62 76 86 50 86 24 86 10 62 20 40Z"/><circle cx="38" cy="52" r="4"/><circle cx="62" cy="52" r="4"/><path d="M46 62H54L50 67Z"/><path d="M50 67C50 74 42 74 40 70M50 67C50 74 58 74 60 70"/><path d="M6 58H26M8 70 26 65M94 58H74M92 70 74 65"/>' },
  { id: 'house', label: 'House', body: '<path d="M10 48 50 16 90 48"/><path d="M20 42V88H80V42"/><path d="M42 88V62H58V88"/><rect x="64" y="52" width="10" height="10"/><path d="M68 28V18H77V37"/>' },
  { id: 'tree', label: 'Tree', body: '<path d="M50 8C70 8 82 22 76 38 90 44 88 64 70 66 66 74 34 74 30 66 12 64 10 44 24 38 18 22 30 8 50 8Z"/><path d="M44 72V92M56 72V92M38 92H62"/>' },
  { id: 'sun', label: 'Sun', body: `<circle cx="50" cy="50" r="19"/>${rays}` },
  { id: 'cloud', label: 'Cloud', body: '<path d="M28 74C10 74 8 52 28 50 28 32 54 26 62 42 78 36 94 52 82 66 92 72 86 74 76 74Z"/>' },
  { id: 'moon', label: 'Moon', body: '<path d="M62 10A40 40 0 1 0 90 64 30 30 0 0 1 62 10Z"/><path d="M20 24l3 7 7 3-7 3-3 7-3-7-7-3 7-3Z"/>' },
  { id: 'leaf', label: 'Leaf', body: '<path d="M18 82C12 40 40 14 86 14 88 60 60 88 18 82Z"/><path d="M18 82C36 60 52 44 72 28"/>' },
  { id: 'balloon', label: 'Balloon', body: '<path d="M50 8C70 8 80 26 76 44 72 60 58 68 50 70 42 68 28 60 24 44 20 26 30 8 50 8Z"/><path d="M45 72 50 78 55 72Z"/><path d="M50 78C44 86 56 90 50 96"/>' },
  { id: 'cupcake', label: 'Cupcake', body: '<path d="M20 48C12 36 22 22 35 26 38 10 62 10 65 26 78 22 88 36 80 48Z"/><path d="M24 52 32 90H68L76 52Z"/><path d="M38 58 40 86M50 58V86M62 58 60 86"/>' },
  { id: 'fish', label: 'Fish', body: '<path d="M8 50C24 22 58 22 76 50 58 78 24 78 8 50Z"/><path d="M76 50 94 32V68Z"/><circle cx="26" cy="46" r="3"/><path d="M44 30C48 20 58 22 60 32"/>' },
  { id: 'camera', label: 'Camera', body: '<rect x="8" y="30" width="84" height="56" rx="9"/><path d="M32 30 38 18H62L68 30"/><circle cx="50" cy="58" r="17"/><circle cx="50" cy="58" r="8"/><circle cx="80" cy="42" r="2.5"/>' },
  { id: 'gift', label: 'Gift', body: '<rect x="14" y="42" width="72" height="46"/><rect x="9" y="30" width="82" height="13"/><path d="M50 30V88"/><path d="M50 30C36 8 20 22 34 30ZM50 30C64 8 80 22 66 30Z"/>' },
]

/** an illustration as an image address (for the tracing layer and the picker) */
export const traceUrl = (a: TraceArt) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="#2b2b38" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${a.body}</svg>`)}`
