import type { PaperStyle } from './pageSizes'
export const PAPER_TEMPLATES: Array<{ value: PaperStyle; label: string }> = [
  { value: 'blank', label: 'Blank' }, { value: 'ruled', label: 'Ruled' }, { value: 'wide-ruled', label: 'Wide ruled' },
  { value: 'narrow-ruled', label: 'Narrow ruled' }, { value: 'grid', label: 'Grid' }, { value: 'small-grid', label: 'Small grid' },
  { value: 'dotted', label: 'Dotted' }, { value: 'legal', label: 'Legal' },
]
export { PAPER_STYLE_BACKGROUND, PAPER_STYLE_BACKGROUND_SIZE } from './pageSizes'
export type { PaperStyle } from './pageSizes'
