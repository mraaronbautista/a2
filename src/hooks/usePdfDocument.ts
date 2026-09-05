import { useEffect, useState } from 'react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url'
import { supabase } from '../lib/supabaseClient'

GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type PdfStatus = 'loading' | 'ready' | 'password' | 'corrupt' | 'missing' | 'error'

export function usePdfDocument(storagePath: string | null) {
  const [state, setState] = useState<{ status: PdfStatus; document: PDFDocumentProxy | null; pdfBlob: Blob | null; pageCount: number; errorMessage: string }>({
    status: 'loading', document: null, pdfBlob: null, pageCount: 0, errorMessage: '',
  })

  useEffect(() => {
    let active = true
    let pdf: PDFDocumentProxy | null = null
    if (!storagePath) {
      queueMicrotask(() => { if (active) setState({ status: 'missing', document: null, pdfBlob: null, pageCount: 0, errorMessage: 'This reading does not have an uploaded PDF.' }) })
      return () => { active = false }
    }
    queueMicrotask(() => { if (active) setState({ status: 'loading', document: null, pdfBlob: null, pageCount: 0, errorMessage: '' }) })
    ;(async () => {
      const file = await supabase.storage.from('reading-files').download(storagePath)
      if (!active) return
      if (file.error || !file.data) {
        setState({ status: 'error', document: null, pdfBlob: null, pageCount: 0, errorMessage: file.error?.message ?? 'The PDF could not be downloaded.' })
        return
      }
      try {
        pdf = await getDocument({ data: await file.data.arrayBuffer() }).promise
        if (active) setState({ status: 'ready', document: pdf, pdfBlob: file.data, pageCount: pdf.numPages, errorMessage: '' })
      } catch (error) {
        const name = error instanceof Error ? error.name : ''
        const password = name === 'PasswordException'
        if (active) setState({
          status: password ? 'password' : 'corrupt', document: null, pdfBlob: file.data, pageCount: 0,
          errorMessage: password ? 'This PDF is password protected and cannot be opened in A2 yet.' : 'A2 could not open this PDF. The original file was not changed.',
        })
      }
    })()
    return () => {
      active = false
      void pdf?.cleanup()
    }
  }, [storagePath])

  return state
}
