import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { AnnotationColor, ReadingAnnotation, ReadingBookmark, TextAnchor } from '../lib/readingTypes'
import type { Json } from '../types/database'

export function useReadingAnnotations(readingId: string, userId: string) {
  const [bookmarks, setBookmarks] = useState<ReadingBookmark[]>([])
  const [annotations, setAnnotations] = useState<ReadingAnnotation[]>([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!readingId || !userId) return
    const [bookmarkResult, annotationResult] = await Promise.all([
      supabase.from('reading_bookmarks').select('id, page_number, label').eq('reading_item_id', readingId).eq('user_id', userId).order('page_number'),
      supabase.from('reading_annotations').select('id, page_number, kind, color, quoted_text, body, anchor, created_at').eq('reading_item_id', readingId).eq('user_id', userId).order('page_number'),
    ])
    if (bookmarkResult.error || annotationResult.error) setError(bookmarkResult.error?.message ?? annotationResult.error?.message ?? 'Could not load reading notes.')
    else {
      setBookmarks((bookmarkResult.data ?? []) as ReadingBookmark[])
      setAnnotations((annotationResult.data ?? []) as unknown as ReadingAnnotation[])
    }
  }, [readingId, userId])
  useEffect(() => { let active = true; queueMicrotask(() => { if (active) void load() }); return () => { active = false } }, [load])

  async function toggleBookmark(page: number) {
    setError('')
    const existing = bookmarks.find((item) => item.page_number === page)
    const previous = bookmarks
    if (existing) {
      setBookmarks((items) => items.filter((item) => item.id !== existing.id))
      const result = await supabase.from('reading_bookmarks').delete().eq('id', existing.id)
      if (result.error) { setBookmarks(previous); setError(result.error.message) }
    } else {
      const id = crypto.randomUUID()
      setBookmarks((items) => [...items, { id, page_number: page, label: '' }].sort((a, b) => a.page_number - b.page_number))
      const result = await supabase.from('reading_bookmarks').insert({ id, reading_item_id: readingId, user_id: userId, page_number: page })
      if (result.error) { setBookmarks(previous); setError(result.error.message) }
    }
  }
  async function setBookmarkLabel(id: string, label: string) {
    const previous = bookmarks
    setBookmarks((items) => items.map((item) => item.id === id ? { ...item, label } : item))
    const result = await supabase.from('reading_bookmarks').update({ label: label.slice(0, 120) }).eq('id', id)
    if (result.error) { setBookmarks(previous); setError(result.error.message) }
  }
  async function createHighlight(page: number, quotedText: string, color: AnnotationColor, anchor: TextAnchor) {
    const id = crypto.randomUUID(); const created_at = new Date().toISOString()
    const item: ReadingAnnotation = { id, page_number: page, kind: 'highlight', color, quoted_text: quotedText, body: '', anchor, created_at }
    setAnnotations((items) => [...items, item])
    const result = await supabase.from('reading_annotations').insert({ id, reading_item_id: readingId, user_id: userId, page_number: page, kind: 'highlight', color, quoted_text: quotedText.slice(0, 10_000), anchor: anchor as unknown as Json })
    if (result.error) { setAnnotations((items) => items.filter((annotation) => annotation.id !== id)); setError(result.error.message) }
    return result.error ? null : item
  }
  async function upsertNote(page: number, body: string, quotedText: string | null = null, anchor: TextAnchor | null = null) {
    const trimmedBody = body.slice(0, 20_000)
    const existing = annotations.find((item) => item.kind === 'note' && item.page_number === page)

    if (!trimmedBody.trim() && !quotedText) {
      if (existing) await deleteAnnotation(existing.id)
      return null
    }

    if (existing) {
      const previous = annotations
      const updated: ReadingAnnotation = { ...existing, body: trimmedBody, quoted_text: quotedText, anchor }
      setAnnotations((items) => items.map((item) => (item.id === existing.id ? updated : item)))
      const result = await supabase.from('reading_annotations').update({ body: trimmedBody, quoted_text: quotedText, anchor: anchor as unknown as Json }).eq('id', existing.id)
      if (result.error) { setAnnotations(previous); setError(result.error.message); return null }
      return updated
    }

    const id = crypto.randomUUID(); const created_at = new Date().toISOString()
    const item: ReadingAnnotation = { id, page_number: page, kind: 'note', color: 'yellow', quoted_text: quotedText, body: trimmedBody, anchor, created_at }
    setAnnotations((items) => [...items, item])
    const result = await supabase.from('reading_annotations').insert({ id, reading_item_id: readingId, user_id: userId, page_number: page, kind: 'note', body: trimmedBody, quoted_text: quotedText, anchor: anchor as unknown as Json })
    if (result.error) { setAnnotations((items) => items.filter((annotation) => annotation.id !== id)); setError(result.error.message); return null }
    return item
  }
  async function deleteAnnotation(id: string) {
    const previous = annotations; setAnnotations((items) => items.filter((item) => item.id !== id))
    const result = await supabase.from('reading_annotations').delete().eq('id', id)
    if (result.error) { setAnnotations(previous); setError(result.error.message) }
  }
  return { bookmarks, annotations, error, toggleBookmark, setBookmarkLabel, createHighlight, upsertNote, deleteAnnotation }
}
