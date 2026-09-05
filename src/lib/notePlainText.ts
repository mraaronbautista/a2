import type { JSONContent } from '@tiptap/react'
const BLOCKS = new Set(['doc','paragraph','heading','blockquote','bulletList','orderedList','listItem','taskList','taskItem','table','tableRow','tableCell','tableHeader','codeBlock'])
export function notePlainText(content: JSONContent | null): string {
  const parts: string[] = []
  function visit(node: JSONContent) { if (node.type === 'text' && node.text) parts.push(node.text); for (const child of node.content ?? []) visit(child); if (node.type && BLOCKS.has(node.type)) parts.push('\n') }
  if (content) visit(content)
  return parts.join(' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, 200_000)
}
