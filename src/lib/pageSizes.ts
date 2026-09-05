export type PaperSize = 'a4' | 'letter'
export type Orientation = 'portrait' | 'landscape'

export type PageSettings = {
  paper: PaperSize
  orientation: Orientation
  marginIn: number
}

export const DEFAULT_PAGE_SETTINGS: PageSettings = { paper: 'a4', orientation: 'portrait', marginIn: 1 }

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
