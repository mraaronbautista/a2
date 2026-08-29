import { useEffect, useReducer, useRef } from 'react'
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Highlight from '@tiptap/extension-highlight'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { supabase } from '../../lib/supabaseClient'

interface RichTextEditorProps {
  content: JSONContent | null
  editable: boolean
  userId: string
  onChange: (content: JSONContent) => void
}

const BUTTON_CLASS = 'rounded px-2 py-1 text-xs font-medium text-ink-muted hover:bg-bg hover:text-ink'
const ACTIVE_CLASS = 'bg-accent-bg text-accent'

const HIGHLIGHT_COLORS = ['#fde68a', '#bbf7d0', '#bfdbfe', '#fbcfe8']

const BLOCK_TYPE_OPTIONS = [
  { value: 'p', label: 'Body' },
  { value: 'h1', label: 'Heading 1' },
  { value: 'h2', label: 'Heading 2' },
  { value: 'h3', label: 'Heading 3' },
  { value: 'h4', label: 'Heading 4' },
] as const

export function RichTextEditor({ content, editable, userId, onChange }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Bold/Italic/Highlight/block-type active-states depend on the current
  // selection, not just document content — onUpdate alone misses a plain
  // cursor move (e.g. clicking into an existing heading) leaving the
  // toolbar showing stale active-state until the next edit.
  const [, forceRerender] = useReducer((c: number) => c + 1, 0)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Image,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: content ?? '',
    editable,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    onTransaction: () => forceRerender(),
  })

  useEffect(() => {
    if (editor) editor.setEditable(editable)
  }, [editor, editable])

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

  function toggleHighlightColor(color: string) {
    if (!editor) return
    if (editor.isActive('highlight', { color })) {
      editor.chain().focus().unsetHighlight().run()
    } else {
      editor.chain().focus().setHighlight({ color }).run()
    }
  }

  if (!editor) return null

  return (
    <div className={editable ? 'rounded-lg border border-border bg-bg' : ''}>
      {editable && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border p-1.5">
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
        </div>
      )}
      <EditorContent editor={editor} className="tiptap-content px-3 py-2 text-sm text-ink" />
    </div>
  )
}
