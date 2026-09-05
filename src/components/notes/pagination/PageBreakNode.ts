import { Node, mergeAttributes } from '@tiptap/core'

// A manual, user-inserted page break — always starts a new page in the
// measurement pass (see PaginationExtension) regardless of how much room
// is left on the current one. Atomic and non-editable: it's a marker, not
// content you'd type into. Inserted via editor.chain().focus()
// .insertContent({ type: 'pageBreak' }).run() — no custom command needed,
// insertContent already exists on every Tiptap editor.
export const PageBreakNode = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-page-break]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-page-break': 'true' })]
  },
})
