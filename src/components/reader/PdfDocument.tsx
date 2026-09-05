import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { AnnotationColor, PdfInkAnchor, ReadingAnnotation, TextAnchor } from '../../lib/readingTypes'
import { PdfPage } from './PdfPage'

interface Props { pdf: PDFDocumentProxy; page: number; zoomMode: 'fit-width' | 'fit-page' | 'custom'; zoom: number; rotation: number; annotations: ReadingAnnotation[]; onTextSelection: (text: string, anchor: TextAnchor) => void; inkActive?:boolean; onInk?:(anchor:PdfInkAnchor,color:AnnotationColor)=>void }
export function PdfDocument({ pdf, page, zoomMode, zoom, rotation, annotations, onTextSelection, inkActive, onInk }: Props) {
  const hostRef = useRef<HTMLDivElement>(null); const [size, setSize] = useState({ width: 0, height: 0 })
  useEffect(() => { const host = hostRef.current; if (!host) return; const update = () => setSize({ width: host.clientWidth, height: host.clientHeight }); update(); const observer = new ResizeObserver(update); observer.observe(host); return () => observer.disconnect() }, [])
  return <main ref={hostRef} className="min-h-0 min-w-0 flex-1 overflow-auto bg-black/15 p-3 md:p-4" aria-label={`PDF page ${page}`}>
    {size.width > 0 && <PdfPage pdf={pdf} pageNumber={page} scale={zoom} availableWidth={size.width} availableHeight={size.height} zoomMode={zoomMode} rotation={rotation} annotations={annotations.filter((item) => item.page_number === page)} onTextSelection={onTextSelection} inkActive={inkActive} onInk={onInk} />}
  </main>
}
