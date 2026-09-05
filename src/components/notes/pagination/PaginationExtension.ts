import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// Genuine "flow across pages" doesn't exist in ProseMirror — this is the
// mechanism that fakes it convincingly (the same trick behind how Google
// Docs paginates): the document stays one continuous, normally-editable
// ProseMirror doc. Nothing about its structure changes. A *separate*
// measurement pass (see PaginatedEditor's effect) walks the rendered DOM
// after each edit, decides where page breaks should fall, and calls
// applyPageBreaks with a list of {pos, height} — this plugin turns those
// into empty widget-decoration spacers that push whatever comes after
// them down to the top of the next page-shaped background sheet. Purely
// a rendering overlay: no document steps, so it's invisible to undo/redo
// and never risks corrupting content the way actually splitting the doc
// across separate per-page editor instances would.
export interface PageBreakSpacer {
  /** Document position right after which the spacer is inserted. */
  pos: number
  /** Spacer height in px — enough to push the next node to the next page's top. */
  height: number
}

export const paginationPluginKey = new PluginKey<DecorationSet>('pagination')

export const PaginationExtension = Extension.create({
  name: 'pagination',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key: paginationPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, old) {
            const spacers = tr.getMeta(paginationPluginKey) as PageBreakSpacer[] | undefined
            if (!spacers) return old.map(tr.mapping, tr.doc)
            const decorations = spacers.map(({ pos, height }) =>
              Decoration.widget(
                pos,
                () => {
                  const el = document.createElement('div')
                  el.className = 'page-break-spacer'
                  el.style.height = `${height}px`
                  el.setAttribute('contenteditable', 'false')
                  return el
                },
                { side: 1, key: `pagebreak-${pos}` },
              ),
            )
            return DecorationSet.create(tr.doc, decorations)
          },
        },
        props: {
          decorations(state) {
            return this.getState(state)
          },
        },
      }),
    ]
  },
})

// Dispatches a metadata-only transaction (no document steps) carrying the
// new spacer list — safe to call from outside the editor's own update
// cycle (a debounced effect), and invisible to undo history.
export function applyPageBreaks(editor: Editor, spacers: PageBreakSpacer[]) {
  const tr = editor.state.tr.setMeta(paginationPluginKey, spacers)
  editor.view.dispatch(tr)
}
