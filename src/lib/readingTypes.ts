export type ReaderViewMode = 'page' | 'reflow'
export type ReaderZoomMode = 'fit-width' | 'fit-page' | 'custom'
export type AnnotationKind = 'highlight' | 'note'
export type AnnotationColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple'

export interface NormalizedRect { x: number; y: number; width: number; height: number }
export interface TextAnchor { version: 1; rects: NormalizedRect[]; textStart: number; textEnd: number }
export interface ExtractedPage { pageNumber: number; text: string; blocks: Array<{ text: string; heading: boolean }> }
export interface PdfSearchResult { pageNumber: number; matchCount: number; snippet: string }

export interface ReadingBookmark {
  id: string
  page_number: number
  label: string
}

export interface ReadingAnnotation {
  id: string
  page_number: number
  kind: AnnotationKind
  color: AnnotationColor
  quoted_text: string | null
  body: string
  anchor: TextAnchor | null
  created_at: string
}
