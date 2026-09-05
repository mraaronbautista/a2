import { Extension } from '@tiptap/core'

// No built-in Tiptap extension for paragraph/heading indentation — this
// adds an `indent` attribute (0-8) to both, rendered as margin-left, with
// indent/outdent commands. Deliberately a visual margin, not real list
// nesting (sinkListItem/liftListItem already covers that for actual
// lists).
const MAX_INDENT = 8
const EM_PER_LEVEL = 1.5

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      indent: () => ReturnType
      outdent: () => ReturnType
    }
  }
}

export const IndentExtension = Extension.create({
  name: 'indent',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'heading'],
        attributes: {
          indent: {
            default: 0,
            renderHTML: (attributes) => {
              const level = Number(attributes.indent) || 0
              if (!level) return {}
              return { style: `margin-left: ${level * EM_PER_LEVEL}em` }
            },
            parseHTML: (element) => {
              const margin = parseFloat(element.style.marginLeft || '0')
              return margin > 0 ? Math.round(margin / EM_PER_LEVEL) : 0
            },
          },
        },
      },
    ]
  },

  addCommands() {
    return {
      indent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          if (dispatch) {
            state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
              if (node.type.name === 'paragraph' || node.type.name === 'heading') {
                const level = Math.min(MAX_INDENT, (Number(node.attrs.indent) || 0) + 1)
                tr.setNodeAttribute(pos, 'indent', level)
              }
            })
            dispatch(tr)
          }
          return true
        },
      outdent:
        () =>
        ({ tr, state, dispatch }) => {
          const { selection } = state
          if (dispatch) {
            state.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
              if (node.type.name === 'paragraph' || node.type.name === 'heading') {
                const level = Math.max(0, (Number(node.attrs.indent) || 0) - 1)
                tr.setNodeAttribute(pos, 'indent', level)
              }
            })
            dispatch(tr)
          }
          return true
        },
    }
  },
})
