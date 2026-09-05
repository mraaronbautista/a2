import { Extension, type Editor } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

// No built-in Tiptap find/replace — this is a minimal, working version:
// plain case-insensitive substring search across the doc's text nodes,
// all matches highlighted via decoration (current one distinguished),
// replace-one/replace-all by editing the ranges directly. Matches are
// recomputed from scratch on every search rather than incrementally
// mapped through edits — simpler, and searches are cheap enough at note
// length that this isn't a real cost.
export interface FindMatch {
  from: number
  to: number
}

interface FindState {
  matches: FindMatch[]
  current: number
}

export const findReplacePluginKey = new PluginKey<FindState>('findReplace')

export const FindReplaceExtension = Extension.create({
  name: 'findReplace',

  addProseMirrorPlugins() {
    return [
      new Plugin<FindState>({
        key: findReplacePluginKey,
        state: {
          init: () => ({ matches: [], current: -1 }),
          apply(tr, old) {
            const meta = tr.getMeta(findReplacePluginKey) as FindState | undefined
            if (meta) return meta
            return tr.docChanged ? { matches: [], current: -1 } : old
          },
        },
        props: {
          decorations(state) {
            const found = this.getState(state)
            if (!found || found.matches.length === 0) return DecorationSet.empty
            const decorations = found.matches.map((m, i) =>
              Decoration.inline(m.from, m.to, { class: i === found.current ? 'find-match find-match-current' : 'find-match' }),
            )
            return DecorationSet.create(state.doc, decorations)
          },
        },
      }),
    ]
  },
})

export function findAllMatches(editor: Editor, query: string): FindMatch[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const matches: FindMatch[] = []
  editor.state.doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return
    const text = node.text.toLowerCase()
    let searchFrom = 0
    for (;;) {
      const found = text.indexOf(q, searchFrom)
      if (found === -1) break
      matches.push({ from: pos + found, to: pos + found + q.length })
      searchFrom = found + q.length
    }
  })
  return matches
}

export function setFindState(editor: Editor, matches: FindMatch[], current: number) {
  editor.view.dispatch(editor.state.tr.setMeta(findReplacePluginKey, { matches, current }))
}

export function replaceMatch(editor: Editor, match: FindMatch, replacement: string) {
  editor.chain().focus().insertContentAt({ from: match.from, to: match.to }, replacement || '').run()
}
