import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { supabase } from '../../lib/supabaseClient'
import { PageBreakNode } from './pagination/PageBreakNode'
import { PaginationExtension, applyPageBreaks, type PageBreakSpacer } from './pagination/PaginationExtension'
import { contentHeightMm, contentWidthMm, pageDimensionsMm, type PageSettings } from '../../lib/pageSizes'

interface PaginatedEditorProps {
  content: JSONContent | null
  editable: boolean
  userId: string
  pageSettings: PageSettings
  onChange: (content: JSONContent) => void
}

const BUTTON_CLASS = 'rounded px-2 py-1 text-xs font-medium text-ink-muted hover:bg-bg hover:text-ink'
const ACTIVE_CLASS = 'bg-accent-bg text-accent'
const HIGHLIGHT_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8']
const PX_PER_MM = 96 / 25.4
const REMEASURE_DELAY_MS = 250

function mmToPx(mm: number) {
  return mm * PX_PER_MM
}

export function PaginatedEditor({ content, editable, userId, pageSettings, onChange }: PaginatedEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [, forceRerender] = useReducer((c: number) => c + 1, 0)
  const [pageCount, setPageCount] = useState(1)
  const [zoom, setZoom] = useState(1)
  const contentAreaRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Image,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      PageBreakNode,
      PaginationExtension,
    ],
    content: content ?? '',
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON())
      scheduleRemeasure()
    },
    onTransaction: () => forceRerender(),
  })

  useEffect(() => {
    if (editor) editor.setEditable(editable)
  }, [editor, editable])

  // The core layout pass: walks the natural (un-paginated) flow of
  // top-level nodes and decides where blank spacers need to go so content
  // never straddles a page boundary. See PaginationExtension for why this
  // is a decoration overlay rather than an actual document split.
  //
  // Deliberately block-level only — a break only ever lands *between* two
  // top-level nodes (paragraphs, headings, images, tables, ...), never
  // inside one. A single node taller than a full page (a huge image, a
  // long table) will still overflow past the page edge visually; splitting
  // a node's own content across pages is real word-processor territory
  // and out of scope for this first pass.
  function remeasure() {
    if (!editor) return
    // Clear existing spacers first so this measurement reads the document's
    // natural flow, not a layout already adjusted by the previous pass.
    applyPageBreaks(editor, [])

    const dom = editor.view.dom as HTMLElement
    const containerTop = dom.getBoundingClientRect().top
    const pageContentHeightPx = mmToPx(contentHeightMm(pageSettings))
    // Sheets on screen sit directly adjacent (no gap — see the render
    // below), spaced exactly one full page apart including both margins,
    // so a break has to advance by the *full* page height, not just the
    // content height, or content drifts further out of alignment with its
    // sheet after every single break.
    const fullPageHeightPx = mmToPx(pageDimensionsMm(pageSettings.paper, pageSettings.orientation).height)
    if (pageContentHeightPx <= 0) return

    const children = Array.from(dom.children).filter((el) => !el.classList.contains('page-break-spacer')) as HTMLElement[]

    const spacers: PageBreakSpacer[] = []
    let pageStartPx = 0
    let index = 0

    editor.state.doc.forEach((node, offset) => {
      const el = children[index]
      index++
      if (!el) return

      const rect = el.getBoundingClientRect()
      const top = rect.top - containerTop
      const bottom = top + rect.height

      const relativeTop = top - pageStartPx
      const relativeBottom = bottom - pageStartPx
      const isManualBreak = node.type.name === 'pageBreak'
      const needsBreakBefore = relativeTop > 0.5 && (isManualBreak || relativeBottom > pageContentHeightPx)

      if (needsBreakBefore) {
        const spacerHeight = fullPageHeightPx - relativeTop
        spacers.push({ pos: offset, height: spacerHeight })
        pageStartPx += fullPageHeightPx
      }
    })

    // Each spacer is exactly one page break, so the page count falls out
    // directly from how many were needed — no separate height/page-size
    // division to keep consistent with the loop above.
    setPageCount(spacers.length + 1)

    applyPageBreaks(editor, spacers)
  }

  const remeasureTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  function scheduleRemeasure() {
    if (remeasureTimer.current) clearTimeout(remeasureTimer.current)
    remeasureTimer.current = setTimeout(remeasure, REMEASURE_DELAY_MS)
  }

  // Re-run on mount (once real content is loaded) and whenever the page
  // shape itself changes (margins, paper size, orientation all change how
  // much fits per page even if nothing in the document did).
  useEffect(() => {
    scheduleRemeasure()
    return () => {
      if (remeasureTimer.current) clearTimeout(remeasureTimer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, pageSettings.paper, pageSettings.orientation, pageSettings.marginIn])

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !editor) return

    const path = `${userId}/${crypto.randomUUID()}-${file.name}`
    const { error } = await supabase.storage.from('note-images').upload(path, file)
    if (error) return

    const { data } = supabase.storage.from('note-images').getPublicUrl(path)
    editor.chain().focus().setImage({ src: data.publicUrl }).run()
  }

  function toggleHighlightColor(color: string) {
    if (!editor) return
    if (editor.isActive('highlight', { color })) {
      editor.chain().focus().unsetHighlight().run()
    } else {
      editor.chain().focus().setHighlight({ color }).run()
    }
  }

  function insertPageBreak() {
    if (!editor) return
    editor.chain().focus().insertContent({ type: 'pageBreak' }).run()
  }

  // @page's `size` doesn't accept a CSS custom property in most browsers,
  // so a dynamic paper size/orientation has to be injected as a literal
  // value right before printing, then removed again — margin stays 0
  // here since the printed pages reuse the same boxes as the screen view,
  // which already bake the margin in as padding (see contentWidth/
  // marginMmValue below).
  function handlePrint() {
    const style = document.createElement('style')
    style.id = 'paginated-print-size'
    style.textContent = `@page { size: ${pageSettings.paper} ${pageSettings.orientation}; margin: 0; }`
    document.head.appendChild(style)
    // window.print() doesn't block until the dialog closes in most modern
    // browsers, so removing the style right after calling it can strip the
    // sizing before the browser actually captures the page — clean up on
    // afterprint instead, which fires once the print/save-as-PDF flow is
    // actually done.
    const cleanup = () => {
      style.remove()
      window.removeEventListener('afterprint', cleanup)
    }
    window.addEventListener('afterprint', cleanup)
    window.print()
  }

  const dims = useMemo(() => pageDimensionsMm(pageSettings.paper, pageSettings.orientation), [pageSettings.paper, pageSettings.orientation])
  const marginMmValue = pageSettings.marginIn * 25.4
  const contentWidth = contentWidthMm(pageSettings)

  if (!editor) return null

  return (
    <div>
      {editable && (
        <div className="mb-2 flex flex-wrap items-center gap-1 rounded-lg border border-border bg-bg p-1.5 print:hidden">
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={[BUTTON_CLASS, editor.isActive('bold') ? ACTIVE_CLASS : ''].join(' ')}
          >
            Bold
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={[BUTTON_CLASS, editor.isActive('italic') ? ACTIVE_CLASS : ''].join(' ')}
          >
            Italic
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={[BUTTON_CLASS, editor.isActive('bulletList') ? ACTIVE_CLASS : ''].join(' ')}
          >
            • List
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            className={[BUTTON_CLASS, editor.isActive('orderedList') ? ACTIVE_CLASS : ''].join(' ')}
          >
            1. List
          </button>
          <button type="button" onClick={() => fileInputRef.current?.click()} className={BUTTON_CLASS}>
            Image
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
          <button type="button" onClick={insertPageBreak} className={BUTTON_CLASS}>
            Page break
          </button>

          <span className="mx-0.5 h-4 w-px bg-border" />

          <span className="text-xs text-ink-muted">Highlight</span>
          <div className="flex gap-1">
            {HIGHLIGHT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => toggleHighlightColor(color)}
                aria-label={`Highlight ${color}`}
                className={[
                  'h-5 w-5 rounded-full',
                  editor.isActive('highlight', { color }) ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface' : '',
                ].join(' ')}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>

          <span className="mx-0.5 h-4 w-px bg-border" />

          <button type="button" onClick={() => setZoom((z) => Math.max(0.25, z - 0.1))} className={BUTTON_CLASS}>
            −
          </button>
          <span className="w-10 text-center text-xs text-ink-muted">{Math.round(zoom * 100)}%</span>
          <button type="button" onClick={() => setZoom((z) => Math.min(2, z + 0.1))} className={BUTTON_CLASS}>
            +
          </button>
          <button type="button" onClick={() => setZoom(1)} className={BUTTON_CLASS}>
            Fit
          </button>

          <span className="mx-0.5 h-4 w-px bg-border" />

          <span className="text-xs text-ink-muted">
            {pageCount} page{pageCount === 1 ? '' : 's'}
          </span>

          <button type="button" onClick={handlePrint} className={[BUTTON_CLASS, 'ml-auto'].join(' ')}>
            Print / Export PDF
          </button>
        </div>
      )}

      <div className="paginated-scroll-area overflow-x-auto overflow-y-visible print:overflow-visible">
        <div
          className="paginated-page-stack mx-auto origin-top print:!transform-none print:!m-0"
          style={{ transform: `scale(${zoom})`, width: `${dims.width}mm` }}
        >
          {/* Page background sheets — purely visual, absolutely positioned
              behind the one continuous editor. Directly adjacent (no gap)
              so a break only ever has to advance content by exactly one
              page height to stay aligned with its sheet — a border marks
              the seam between pages instead. Print uses these same boxes
              (see index.css's @media print rules) rather than a second,
              separately-maintained layout. */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 -z-10 flex flex-col items-center">
              {Array.from({ length: pageCount }, (_, i) => (
                <div
                  key={i}
                  className={[
                    'paginated-page-sheet w-full shrink-0 bg-surface shadow-resting print:shadow-none',
                    i > 0 ? 'border-t border-border' : '',
                  ].join(' ')}
                  style={{ height: `${dims.height}mm` }}
                >
                  <span className="absolute right-3 bottom-2 text-[10px] text-ink-muted print:hidden">
                    Page {i + 1} of {pageCount}
                  </span>
                </div>
              ))}
            </div>

            <div
              ref={contentAreaRef}
              className="tiptap-content paginated-content mx-auto text-sm text-ink"
              style={{
                width: `${contentWidth}mm`,
                paddingTop: `${marginMmValue}mm`,
                paddingBottom: `${marginMmValue}mm`,
                paddingLeft: 0,
                paddingRight: 0,
              }}
            >
              <EditorContent editor={editor} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
