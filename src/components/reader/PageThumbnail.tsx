import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { PdfPage } from './PdfPage'

export function PageThumbnail({ pdf, pageNumber, active, bookmarked, onOpen }: { pdf: PDFDocumentProxy; pageNumber: number; active: boolean; bookmarked: boolean; onOpen: () => void }) {
  const ref = useRef<HTMLButtonElement>(null); const [visible, setVisible] = useState(false)
  useEffect(() => { const node = ref.current; if (!node) return; const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: '500px' }); observer.observe(node); return () => observer.disconnect() }, [])
  return <button ref={ref} type="button" onClick={onOpen} aria-current={active ? 'page' : undefined} className={['min-h-32 w-full rounded-lg border p-2', active ? 'border-accent bg-accent-bg' : 'border-transparent hover:bg-bg'].join(' ')}>
    {visible && <PdfPage pdf={pdf} pageNumber={pageNumber} scale={.18} availableWidth={220} thumbnail />}
    <span className="mt-1 block text-xs text-ink-muted">{pageNumber}{bookmarked ? ' · Bookmark' : ''}</span>
  </button>
}
