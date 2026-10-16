/** Page sizes for printing a book as a scrapbook: one image per page, at the paper's real proportions. */
export interface PrintSize {
  id: string
  name: string
  /** what it is used for */
  note: string
  /** the paper, in millimetres (portrait) */
  mm: [number, number]
  /** pixels at 300 dpi (portrait) */
  px: [number, number]
}

export const PRINT_SIZES: PrintSize[] = [
  { id: 'a4', name: 'A4', note: 'Standard paper, home printers', mm: [210, 297], px: [2480, 3508] },
  { id: 'a5', name: 'A5', note: 'Half of A4, small scrapbook pages', mm: [148, 210], px: [1748, 2480] },
  { id: 'a6', name: 'A6', note: 'Postcard', mm: [105, 148], px: [1240, 1748] },
  { id: 'letter', name: 'US Letter', note: '8.5 × 11 in', mm: [216, 279], px: [2550, 3300] },
  { id: 'scrap12', name: 'Scrapbook 12 × 12', note: 'Classic scrapbook album page', mm: [305, 305], px: [3600, 3600] },
  { id: 'scrap8', name: 'Scrapbook 8 × 8', note: 'Small square album page', mm: [203, 203], px: [2400, 2400] },
  { id: 'p810', name: 'Photo 8 × 10', note: 'Picture frame, photo print', mm: [203, 254], px: [2400, 3000] },
  { id: 'p57', name: 'Photo 5 × 7', note: 'Picture frame, photo print', mm: [127, 178], px: [1500, 2100] },
  { id: 'p46', name: 'Photo 4 × 6', note: 'Standard photo print', mm: [102, 152], px: [1200, 1800] },
]

export interface PrintChoice { id: string; landscape: boolean }

export const getPrintSize = (id?: string | null) => PRINT_SIZES.find((s) => s.id === id) ?? PRINT_SIZES[0]

/** width / height of one page, the way it is turned */
export const pageDims = (s: PrintSize, landscape: boolean) => (landscape ? { w: s.px[1], h: s.px[0] } : { w: s.px[0], h: s.px[1] })

/** the pixel size of a page at a quality (dpi), the 300 dpi size scaled down */
export const pagePixels = (s: PrintSize, landscape: boolean, dpi: number) => {
  const d = pageDims(s, landscape)
  const k = dpi / 300
  return { w: Math.round(d.w * k), h: Math.round(d.h * k) }
}

export const QUALITIES = [
  { dpi: 300, name: 'Best', note: 'Print shop quality, 300 dpi' },
  { dpi: 200, name: 'Good', note: 'Home printing, 200 dpi' },
  { dpi: 150, name: 'Light', note: 'Smaller files, 150 dpi' },
] as const
