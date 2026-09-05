import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import TextAlign from '@tiptap/extension-text-align'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableCell from '@tiptap/extension-table-cell'
import TableHeader from '@tiptap/extension-table-header'
import { supabase } from '../../lib/supabaseClient'
import { PageBreakNode } from './pagination/PageBreakNode'
import { PaginationExtension, applyPageBreaks, type PageBreakSpacer } from './pagination/PaginationExtension'
import { IndentExtension } from './extensions/IndentExtension'
import { FindReplaceExtension, findAllMatches, setFindState, replaceMatch, type FindMatch } from './extensions/FindReplaceExtension'
import {
  contentHeightMm,
  contentWidthMm,
  pageDimensionsMm,
  PAPER_STYLE_BACKGROUND,
  PAPER_STYLE_BACKGROUND_SIZE,
  type PageSettings,
} from '../../lib/pageSizes'

interface PaginatedEditorProps {
  content: JSONContent | null
  editable: boolean
  userId: string
  pageSettings: PageSettings
  onChange: (content: JSONContent) => void
}

const BUTTON_CLASS = 'rounded px-2 py-1 text-xs font-medium text-ink-muted hover:bg-bg hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent'
const ACTIVE_CLASS = 'bg-accent-bg text-accent'
const HIGHLIGHT_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8']
const TEXT_COLORS = ['#1b2436', '#d97a4d', '#2563eb', '#16a34a', '#dc2626']
const PX_PER_MM = 96 / 25.4
const REMEASURE_DELAY_MS = 250

const BLOCK_TYPE_OPTIONS = [
  { value: 'p', label: 'Body' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
] as const

function mmToPx(mm: number) {
  return mm * PX_PER_MM
}

export function PaginatedEditor({ content, editable, userId, pageSettings, onChange }: PaginatedEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [, forceRerender] = useReducer((c: number) => c + 1, 0)
  const [pageCount, setPageCount] = useState(1)
  const [zoom, setZoom] = useState(1)
  const [fitToWidth, setFitToWidth] = useState(true)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [matches, setMatches] = useState<FindMatch[]>([])
  const [currentMatch, setCurrentMatch] = useState(-1)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Image,
      Placeholder.configure({ placeholder: 'Start writing…' }),
      TextStyle,
      Color,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      IndentExtension,
      PageBreakNode,
      PaginationExtension,
      FindReplaceExtension,
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

  const dims = useMemo(() => pageDimensionsMm(pageSettings.paper, pageSettings.orientation), [pageSettings.paper, pageSettings.orientation])

  // Fit-to-width: measure the scroll area's own width and scale the page
  // down (never up past 100%) to match, re-checking on container resize —
  // this is what keeps a full physical page usable on a phone screen
  // instead of requiring a manual zoom or endless horizontal scrolling.
  useEffect(() => {
    if (!fitToWidth) return
    const el = scrollAreaRef.current
    if (!el) return

    function apply() {
      const available = el!.clientWidth - 32 // leaves a little breathing room
      const pageWidthPx = mmToPx(dims.width)
      setZoom(Math.min(1, available / pageWidthPx))
    }

    apply()
    const observer = new ResizeObserver(apply)
    observer.observe(el)
    return () => observer.disconnect()
  }, [fitToWidth, dims.width])

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

  function setTextColor(color: string) {
    editor?.chain().focus().setColor(color).run()
  }

  function toggleLink() {
    if (!editor) return
    if (editor.isActive('link')) {
      editor.chain().focus().unsetLink().run()
      return
    }
    const url = window.prompt('Link URL', 'https://')
    if (!url) return
    editor.chain().focus().setLink({ href: url }).run()
  }

  function insertTable() {
    editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  function insertPageBreak() {
    editor?.chain().focus().insertContent({ type: 'pageBreak' }).run()
  }

  function currentBlockType(): (typeof BLOCK_TYPE_OPTIONS)[number]['value'] {
    if (!editor) return 'p'
    for (const level of [1, 2, 3, 4] as const) {
      if (editor.isActive('heading', { level })) return `h${level}` as 'h1' | 'h2' | 'h3' | 'h4'
    }
    return 'p'
  }

  function handleBlockTypeChange(value: string) {
    if (!editor) return
    if (value === 'p') {
      editor.chain().focus().setParagraph().run()
    } else {
      editor
        .chain()
        .focus()
        .toggleHeading({ level: Number(value[1]) as 1 | 2 | 3 | 4 })
        .run()
    }
  }

  function runFind(query: string) {
    if (!editor) return
    const found = findAllMatches(editor, query)
    setMatches(found)
    const next = found.length ? 0 : -1
    setCurrentMatch(next)
    setFindState(editor, found, next)
    if (found.length) scrollToMatch(found[0])
  }

  function scrollToMatch(match: FindMatch) {
    if (!editor || !scrollAreaRef.current) return
    const coords = editor.view.coordsAtPos(match.from)
    const containerRect = scrollAreaRef.current.getBoundingClientRect()
    scrollAreaRef.current.scrollBy({ top: coords.top - containerRect.top - containerRect.height / 2, behavior: 'smooth' })
  }

  function goToMatch(direction: 1 | -1) {
    if (!editor || matches.length === 0) return
    const next = (currentMatch + direction + matches.length) % matches.length
    setCurrentMatch(next)
    setFindState(editor, matches, next)
    scrollToMatch(matches[next])
  }

  function replaceCurrentMatch() {
    if (!editor || currentMatch === -1 || !matches[currentMatch]) return
    replaceMatch(editor, matches[currentMatch], replaceQuery)
    setTimeout(() => runFind(findQuery), 0)
  }

  function replaceAllMatches() {
    if (!editor) return
    // Reverse order so replacing one match never shifts the positions of
    // matches still waiting to be replaced.
    ;[...matches].reverse().forEach((m) => replaceMatch(editor, m, replaceQuery))
    setTimeout(() => runFind(findQuery), 0)
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

  const marginMmValue = pageSettings.marginIn * 25.4
  const contentWidth = contentWidthMm(pageSettings)
  const paperStyle = pageSettings.paperStyle ?? 'blank'

  if (!editor) return null

  return (
    <div>
      {editable && (
        <div className="mb-2 space-y-1.5 print:hidden">
          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-bg p-1.5">
            <select
              value={currentBlockType()}
              onChange={(e) => handleBlockTypeChange(e.target.value)}
              className="rounded border border-border bg-surface px-1.5 py-1 text-xs text-ink outline-none focus:border-accent"
            >
              {BLOCK_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>

            <span className="mx-0.5 h-4 w-px bg-border" />

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
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className={[BUTTON_CLASS, editor.isActive('underline') ? ACTIVE_CLASS : ''].join(' ')}
            >
              Underline
            </button>

            <span className="mx-0.5 h-4 w-px bg-border" />

            <span className="text-xs text-ink-muted">Color</span>
            <div className="flex gap-1">
              {TEXT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setTextColor(color)}
                  aria-label={`Text color ${color}`}
                  className={[
                    'h-5 w-5 rounded-full border border-border',
                    editor.isActive('textStyle', { color }) ? 'ring-2 ring-accent ring-offset-1 ring-offset-surface' : '',
                  ].join(' ')}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>

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

            {(['left', 'center', 'right', 'justify'] as const).map((align) => (
              <button
                key={align}
                type="button"
                onClick={() => editor.chain().focus().setTextAlign(align).run()}
                className={[BUTTON_CLASS, 'capitalize', editor.isActive({ textAlign: align }) ? ACTIVE_CLASS : ''].join(' ')}
              >
                {align}
              </button>
            ))}

            <span className="mx-0.5 h-4 w-px bg-border" />

            <button type="button" onClick={() => editor.chain().focus().outdent().run()} className={BUTTON_CLASS}>
              Outdent
            </button>
            <button type="button" onClick={() => editor.chain().focus().indent().run()} className={BUTTON_CLASS}>
              Indent
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-bg p-1.5">
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
            <button
              type="button"
              onClick={() => editor.chain().focus().toggleTaskList().run()}
              className={[BUTTON_CLASS, editor.isActive('taskList') ? ACTIVE_CLASS : ''].join(' ')}
            >
              Checklist
            </button>
            <button type="button" onClick={insertTable} className={BUTTON_CLASS}>
              Table
            </button>
            {editor.isActive('table') && (
              <>
                <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={BUTTON_CLASS}>
                  +Row
                </button>
                <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={BUTTON_CLASS}>
                  +Col
                </button>
                <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className={BUTTON_CLASS}>
                  Delete table
                </button>
              </>
            )}
            <button
              type="button"
              onClick={toggleLink}
              className={[BUTTON_CLASS, editor.isActive('link') ? ACTIVE_CLASS : ''].join(' ')}
            >
              {editor.isActive('link') ? 'Unlink' : 'Link'}
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className={BUTTON_CLASS}>
              Image
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
            <button type="button" onClick={insertPageBreak} className={BUTTON_CLASS}>
              Page break
            </button>

            <span className="mx-0.5 h-4 w-px bg-border" />

            <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className={BUTTON_CLASS}>
              Undo
            </button>
            <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className={BUTTON_CLASS}>
              Redo
            </button>
            <button
              type="button"
              onClick={() => {
                setFindOpen((v) => !v)
                if (findOpen && editor) setFindState(editor, [], -1)
              }}
              className={[BUTTON_CLASS, findOpen ? ACTIVE_CLASS : ''].join(' ')}
            >
              Find
            </button>
          </div>

          {findOpen && (
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-bg p-1.5 text-xs">
              <input
                type="text"
                placeholder="Find"
                value={findQuery}
                onChange={(e) => {
                  setFindQuery(e.target.value)
                  runFind(e.target.value)
                }}
                className="w-28 rounded border border-border bg-surface px-2 py-1 text-ink outline-none focus:border-accent"
              />
              <span className="text-ink-muted">{matches.length ? `${currentMatch + 1} of ${matches.length}` : '0 found'}</span>
              <button type="button" onClick={() => goToMatch(-1)} className={BUTTON_CLASS} disabled={!matches.length}>
                Prev
              </button>
              <button type="button" onClick={() => goToMatch(1)} className={BUTTON_CLASS} disabled={!matches.length}>
                Next
              </button>
              <span className="mx-0.5 h-4 w-px bg-border" />
              <input
                type="text"
                placeholder="Replace with"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                className="w-28 rounded border border-border bg-surface px-2 py-1 text-ink outline-none focus:border-accent"
              />
              <button type="button" onClick={replaceCurrentMatch} className={BUTTON_CLASS} disabled={currentMatch === -1}>
                Replace
              </button>
              <button type="button" onClick={replaceAllMatches} className={BUTTON_CLASS} disabled={!matches.length}>
                Replace all
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-bg p-1.5">
            <button
              type="button"
              onClick={() => {
                setFitToWidth(false)
                setZoom((z) => Math.max(0.25, z - 0.1))
              }}
              className={BUTTON_CLASS}
            >
              −
            </button>
            <span className="w-10 text-center text-xs text-ink-muted">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => {
                setFitToWidth(false)
                setZoom((z) => Math.min(2, z + 0.1))
              }}
              className={BUTTON_CLASS}
            >
              +
            </button>
            <button
              type="button"
              onClick={() => setFitToWidth(true)}
              className={[BUTTON_CLASS, fitToWidth ? ACTIVE_CLASS : ''].join(' ')}
            >
              Fit width
            </button>

            <span className="mx-0.5 h-4 w-px bg-border" />

            <span className="text-xs text-ink-muted">
              {pageCount} page{pageCount === 1 ? '' : 's'}
            </span>

            <button type="button" onClick={handlePrint} className={[BUTTON_CLASS, 'ml-auto'].join(' ')}>
              Print / Export PDF
            </button>
          </div>
        </div>
      )}

      <div ref={scrollAreaRef} className="paginated-scroll-area overflow-x-auto overflow-y-visible print:overflow-visible">
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
                  style={{
                    height: `${dims.height}mm`,
                    backgroundImage: PAPER_STYLE_BACKGROUND[paperStyle],
                    backgroundSize: PAPER_STYLE_BACKGROUND_SIZE[paperStyle],
                    backgroundPosition: `0 ${marginMmValue}mm`,
                  }}
                >
                  <span className="absolute right-3 bottom-2 text-[10px] text-ink-muted print:hidden">
                    Page {i + 1} of {pageCount}
                  </span>
                </div>
              ))}
            </div>

            <div
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
