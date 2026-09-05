import { useEffect, useRef, useState } from 'react'
import { TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import { clampRect } from '../../lib/pdfText'
import type { ReadingAnnotation, TextAnchor } from '../../lib/readingTypes'

interface Props {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  availableWidth?: number
  availableHeight?: number
  zoomMode?: 'fit-width' | 'fit-page' | 'custom'
  rotation?: number
  thumbnail?: boolean
  annotations?: ReadingAnnotation[]
  onTextSelection?: (quotedText: string, anchor: TextAnchor) => void
}

const COLOR: Record<string, string> = { yellow: '#fde68a99', green: '#bbf7d099', blue: '#bfdbfe99', pink: '#fbcfe899', purple: '#e9d5ff99' }

export function PdfPage({ pdf, pageNumber, scale, availableWidth = 0, availableHeight = 0, zoomMode = 'custom', rotation = 0, thumbnail = false, annotations = [], onTextSelection }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true; let renderTask: RenderTask | null = null; let textLayer: TextLayer | null = null
    ;(async () => {
      try {
        setRendering(true); setError('')
        const page = await pdf.getPage(pageNumber)
        const base = page.getViewport({ scale: 1, rotation })
        const widthScale = Math.max(.1, (availableWidth - (thumbnail ? 8 : 32)) / base.width)
        const heightScale = Math.max(.1, (availableHeight - 32) / base.height)
        const cssScale = zoomMode === 'fit-width' ? widthScale : zoomMode === 'fit-page' ? Math.min(widthScale, heightScale) : scale
        const safeCssScale = Math.min(3, Math.max(thumbnail ? .05 : .5, cssScale || scale))
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const viewport = page.getViewport({ scale: safeCssScale * ratio, rotation })
        const canvas = canvasRef.current
        if (!active || !canvas) return
        const maxSide = Math.max(viewport.width, viewport.height); const backingScale = maxSide > 8192 ? 8192 / maxSide : 1
        canvas.width = Math.floor(viewport.width * backingScale); canvas.height = Math.floor(viewport.height * backingScale)
        canvas.style.width = `${viewport.width / ratio}px`; canvas.style.height = `${viewport.height / ratio}px`
        const context = canvas.getContext('2d'); if (!context) throw new Error('Canvas is unavailable')
        renderTask = page.render({ canvas, canvasContext: context, viewport, transform: backingScale === 1 ? undefined : [backingScale, 0, 0, backingScale, 0, 0] })
        await renderTask.promise
        const textHost = textRef.current
        if (!thumbnail && textHost && active) {
          textHost.replaceChildren(); textHost.style.width = canvas.style.width; textHost.style.height = canvas.style.height
          textHost.style.setProperty('--scale-factor', String(safeCssScale))
          textLayer = new TextLayer({ textContentSource: await page.getTextContent(), container: textHost, viewport: page.getViewport({ scale: safeCssScale, rotation }) })
          await textLayer.render()
        }
        if (active) setRendering(false)
      } catch (cause) {
        if (cause instanceof Error && cause.name === 'RenderingCancelledException') return
        if (active) { setRendering(false); setError('This page could not be rendered.') }
      }
    })()
    return () => { active = false; renderTask?.cancel(); textLayer?.cancel() }
  }, [pdf, pageNumber, scale, availableWidth, availableHeight, zoomMode, rotation, thumbnail])

  function captureSelection() {
    const selection = window.getSelection(); const host = hostRef.current
    if (!selection || !host || selection.isCollapsed || !onTextSelection || !selection.anchorNode || !selection.focusNode) return
    if (!host.contains(selection.anchorNode) || !host.contains(selection.focusNode)) return
    const hostRect = host.getBoundingClientRect()
    const rects = Array.from(selection.getRangeAt(0).getClientRects()).map((rect) => clampRect({ x: (rect.left - hostRect.left) / hostRect.width, y: (rect.top - hostRect.top) / hostRect.height, width: rect.width / hostRect.width, height: rect.height / hostRect.height })).filter((rect) => rect.width > 0 && rect.height > 0)
    const quotedText = selection.toString().replace(/\s+/g, ' ').trim()
    if (quotedText && rects.length) onTextSelection(quotedText, { version: 1, rects, textStart: 0, textEnd: quotedText.length })
  }

  return <div ref={hostRef} className="relative mx-auto w-fit bg-white shadow-lg" onPointerUp={captureSelection}>
    {rendering && <div className="absolute inset-0 z-20 animate-pulse bg-slate-100" aria-label="Rendering page" />}
    {error && <div className="absolute inset-0 z-30 flex items-center justify-center bg-white p-4 text-sm text-red-700">{error}</div>}
    <canvas ref={canvasRef} className="block" />
    {!thumbnail && <div ref={textRef} className="pdf-text-layer absolute inset-0 overflow-hidden opacity-100" />}
    {!thumbnail && <div className="pointer-events-none absolute inset-0 z-10">{annotations.filter((item) => item.anchor).flatMap((item) => item.anchor!.rects.map((rect, index) => <span key={`${item.id}-${index}`} className="absolute mix-blend-multiply" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, background: COLOR[item.color] }} />))}</div>}
  </div>
}
