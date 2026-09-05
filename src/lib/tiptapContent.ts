import type { JSONContent } from '@tiptap/react'

export function buildQuoteCitationDoc(quotedText: string | null, citation: string): JSONContent {
  const paragraphs: JSONContent[] = []
  if (quotedText) paragraphs.push({ type: 'paragraph', content: [{ type: 'text', text: quotedText }] })
  paragraphs.push({ type: 'paragraph', content: [{ type: 'text', text: citation }] })
  return { type: 'doc', content: paragraphs }
}
