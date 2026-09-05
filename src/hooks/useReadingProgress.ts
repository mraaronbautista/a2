import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import type { ReaderViewMode, ReaderZoomMode } from '../lib/readingTypes'

export function useReadingProgress(readingId: string, userId: string, pageCount: number) {
  const [page, setPageState] = useState(1)
  const [zoomMode, setZoomModeState] = useState<ReaderZoomMode>('fit-width')
  const [zoomValue, setZoomValueState] = useState(1)
  const [viewMode, setViewModeState] = useState<ReaderViewMode>('page')
  const loaded = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const save = useCallback((next: { page?: number; zoomMode?: ReaderZoomMode; zoomValue?: number; viewMode?: ReaderViewMode }, immediate = false) => {
    if (!readingId || !userId || !pageCount || !loaded.current) return
    if (timer.current) clearTimeout(timer.current)
    const write = () => void supabase.from('reading_progress').upsert({
      reading_item_id: readingId, user_id: userId, page_number: next.page ?? page, page_count: pageCount,
      zoom_mode: next.zoomMode ?? zoomMode, zoom_value: next.zoomValue ?? zoomValue,
      view_mode: next.viewMode ?? viewMode, updated_at: new Date().toISOString(),
    })
    if (immediate) write()
    else timer.current = setTimeout(write, 750)
  }, [readingId, userId, pageCount, page, zoomMode, zoomValue, viewMode])

  useEffect(() => {
    if (!readingId || !userId || !pageCount) return
    let active = true
    loaded.current = false
    supabase.from('reading_progress').select('page_number, zoom_mode, zoom_value, view_mode')
      .eq('reading_item_id', readingId).eq('user_id', userId).maybeSingle().then(({ data }) => {
        if (!active) return
        if (data) {
          setPageState(Math.min(Math.max(data.page_number, 1), pageCount))
          setZoomModeState(data.zoom_mode as ReaderZoomMode)
          setZoomValueState(Number(data.zoom_value))
          setViewModeState(data.view_mode as ReaderViewMode)
        }
        loaded.current = true
      })
    return () => { active = false; loaded.current = false; if (timer.current) clearTimeout(timer.current) }
  }, [readingId, userId, pageCount])

  const setPage = useCallback((value: number) => { const next = Math.min(Math.max(Math.round(value), 1), pageCount || 1); setPageState(next); save({ page: next }, true) }, [pageCount, save])
  const setZoomMode = useCallback((value: ReaderZoomMode) => { setZoomModeState(value); save({ zoomMode: value }) }, [save])
  const setZoomValue = useCallback((value: number) => { const next = Math.min(3, Math.max(.5, value)); setZoomValueState(next); setZoomModeState('custom'); save({ zoomValue: next, zoomMode: 'custom' }) }, [save])
  const setViewMode = useCallback((value: ReaderViewMode) => { setViewModeState(value); save({ viewMode: value }, true) }, [save])
  return { page, setPage, zoomMode, zoomValue, viewMode, setZoomMode, setZoomValue, setViewMode }
}
