import { useEffect, useRef, useState } from 'react'
import { TextLayer, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import { clampRect } from '../../lib/pdfText'
import type { AnnotationColor, PdfInkAnchor, ReadingAnnotation, TextAnchor } from '../../lib/readingTypes'

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
  inkActive?: boolean
  inkColor?: AnnotationColor
  onInk?: (anchor: PdfInkAnchor, color: AnnotationColor) => void
}

const COLOR: Record<string, string> = { yellow: '#fde68a99', green: '#bbf7d099', blue: '#bfdbfe99', pink: '#fbcfe899', purple: '#e9d5ff99' }

export function PdfPage({ pdf, pageNumber, scale, availableWidth = 0, availableHeight = 0, zoomMode = 'custom', rotation = 0, thumbnail = false, annotations = [], onTextSelection, inkActive=false, inkColor='yellow', onInk }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textRef = useRef<HTMLDivElement>(null)
  const [rendering, setRendering] = useState(true)
  const [error, setError] = useState('')
  const [inkPoints,setInkPoints]=useState<Array<{x:number;y:number}>>([])

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
    {!thumbnail && <svg viewBox="0 0 1 1" preserveAspectRatio="none" className={`absolute inset-0 z-10 h-full w-full ${inkActive?'pointer-events-auto touch-none':'pointer-events-none'}`} onPointerDown={e=>{if(!inkActive)return;e.currentTarget.setPointerCapture(e.pointerId);const r=e.currentTarget.getBoundingClientRect();setInkPoints([{x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height}])}} onPointerMove={e=>{if(!inkPoints.length)return;const r=e.currentTarget.getBoundingClientRect();setInkPoints(p=>[...p,{x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}])}} onPointerUp={()=>{if(inkPoints.length>1)onInk?.({version:1,strokes:[{color:inkColor,sizeMm:.6,points:inkPoints}]},inkColor);setInkPoints([])}}>{annotations.filter(item=>item.kind==='highlight'&&item.anchor&&'rects' in item.anchor).flatMap(item=>(item.anchor as TextAnchor).rects.map((rect,index)=><rect key={`${item.id}-${index}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={COLOR[item.color]}/>))}{annotations.filter(item=>item.kind==='ink'&&item.anchor&&'strokes' in item.anchor).flatMap(item=>(item.anchor as PdfInkAnchor).strokes.map((stroke,index)=><polyline key={`${item.id}-${index}`} points={stroke.points.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={COLOR[item.color]?.slice(0,7)??'#dc2626'} strokeWidth=".0025"/>))}{inkPoints.length>0&&<polyline points={inkPoints.map(p=>`${p.x},${p.y}`).join(' ')} fill="none" stroke={COLOR[inkColor].slice(0,7)} strokeWidth=".0025"/>}</svg>}
  </div>
}
