export type PaperSize = 'a4' | 'letter'
export type Orientation = 'portrait' | 'landscape'
export type PaperStyle = 'blank' | 'ruled' | 'grid' | 'dotted'

export type PageSettings = {
  paper: PaperSize
  orientation: Orientation
  marginIn: number
  paperStyle?: PaperStyle
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = { paper: 'a4', orientation: 'portrait', marginIn: 1, paperStyle: 'blank' }

// CSS background-image patterns for each paper style, drawn with
// repeating gradients rather than an image asset — scales cleanly to any
// zoom level and needs no file to keep in sync with page size changes.
export const PAPER_STYLE_BACKGROUND: Record<PaperStyle, string> = {
  blank: 'none',
  ruled: 'repeating-linear-gradient(to bottom, transparent, transparent 27px, var(--color-border) 27px, var(--color-border) 28px)',
  grid: [
    'repeating-linear-gradient(to bottom, transparent, transparent 23px, var(--color-border) 23px, var(--color-border) 24px)',
    'repeating-linear-gradient(to right, transparent, transparent 23px, var(--color-border) 23px, var(--color-border) 24px)',
  ].join(', '),
  dotted: 'radial-gradient(var(--color-border) 1px, transparent 1.5px)',
}
export const PAPER_STYLE_BACKGROUND_SIZE: Record<PaperStyle, string> = {
  blank: 'auto',
  ruled: 'auto',
  grid: 'auto',
  dotted: '20px 20px',
}

// Base (portrait) dimensions in CSS mm — using real physical units rather
// than px means the on-screen page and the printed page (`@page { size }`
// in index.css) are stating the exact same measurement, not two numbers
// that have to be kept in sync by hand.
const BASE_MM: Record<PaperSize, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
}

const MM_PER_IN = 25.4

export function pageDimensionsMm(paper: PaperSize, orientation: Orientation) {
  const base = BASE_MM[paper]
  return orientation === 'portrait' ? base : { width: base.height, height: base.width }
}

export function marginMm(marginIn: number) {
  return marginIn * MM_PER_IN
}

// The height available for actual content on one page, in mm — total page
// height minus top+bottom margin. This is the number the pagination
// measurement pass slices the document against.
export function contentHeightMm(settings: PageSettings) {
  const { height } = pageDimensionsMm(settings.paper, settings.orientation)
  return height - 2 * marginMm(settings.marginIn)
}

export function contentWidthMm(settings: PageSettings) {
  const { width } = pageDimensionsMm(settings.paper, settings.orientation)
  return width - 2 * marginMm(settings.marginIn)
}
