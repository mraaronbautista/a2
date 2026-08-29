import { useEffect, useRef } from 'react'
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

export function RichTextEditor({ content, editable, userId, onChange }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight,
      Image,
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    content: content ?? '',
    editable,
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
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

  if (!editor) return null

  return (
    <div className={editable ? 'rounded-lg border border-border bg-bg' : ''}>
      {editable && (
        <div className="flex flex-wrap gap-0.5 border-b border-border p-1.5">
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
            onClick={() => editor.chain().focus().toggleHighlight().run()}
            className={[BUTTON_CLASS, editor.isActive('highlight') ? ACTIVE_CLASS : ''].join(' ')}
          >
            Highlight
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
        </div>
      )}
      <EditorContent
        editor={editor}
        className="prose-sm max-w-none px-3 py-2 text-sm text-ink [&_.ProseMirror]:min-h-32 [&_.ProseMirror]:outline-none [&_img]:max-w-full [&_img]:rounded-lg [&_mark]:rounded [&_mark]:bg-accent-bg [&_mark]:px-0.5 [&_p.is-editor-empty:first-child::before]:float-left [&_p.is-editor-empty:first-child::before]:h-0 [&_p.is-editor-empty:first-child::before]:text-ink-muted [&_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]"
      />
    </div>
  )
}
