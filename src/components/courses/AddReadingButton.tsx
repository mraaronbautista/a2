import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { isPdfFile, MAX_PDF_BYTES, sanitizePdfFilename } from '../../lib/pdfUpload'

interface AddReadingButtonProps {
  courseId: string
  userId: string
  nextOrderIndex: number
  onAdded: () => void
}

export function AddReadingButton({ courseId, userId, nextOrderIndex, onAdded }: AddReadingButtonProps) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [title, setTitle] = useState('')
  const [sourceLink, setSourceLink] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [bulkText, setBulkText] = useState('')
  const [pdf, setPdf] = useState<File | null>(null)
  const [busy, setBusy] = useState<'uploading' | 'saving' | null>(null)
  const [error, setError] = useState('')

  const bulkLines = bulkText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  useEffect(() => {
    if (!open) return
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !busy) setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [open, busy])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy('saving')
    setError('')

    if (mode === 'bulk') {
      // One line, one reading, added in the order pasted — a whole
      // syllabus at once instead of clicking through this form per
      // reading. Deliberately just titles: no per-line due date/link
      // parsing (that's a much bigger feature on its own).
      const result = await supabase.from('reading_items').insert(
        bulkLines.map((lineTitle, i) => ({
          course_id: courseId,
          title: lineTitle,
          order_index: nextOrderIndex + i,
        })),
      )
      if (result.error) {
        setError(result.error.message)
        setBusy(null)
        return
      }
      setBulkText('')
    } else {
      let storagePath: string | null = null
      const readingId = crypto.randomUUID()
      if (pdf) {
        if (pdf.size > MAX_PDF_BYTES) {
          setError('PDF files must be 50 MiB or smaller.')
          setBusy(null)
          return
        }
        if (!(await isPdfFile(pdf))) {
          setError('Choose a valid PDF file. Renamed or unsupported files cannot be uploaded.')
          setBusy(null)
          return
        }
        setBusy('uploading')
        storagePath = `${userId}/${courseId}/${readingId}/${sanitizePdfFilename(pdf.name)}`
        const upload = await supabase.storage.from('reading-files').upload(storagePath, pdf, {
          contentType: 'application/pdf',
          upsert: false,
        })
        if (upload.error) {
          setError(upload.error.message)
          setBusy(null)
          return
        }
      }

      setBusy('saving')
      const result = await supabase.from('reading_items').insert({
        id: readingId,
        course_id: courseId,
        title,
        source_link: sourceLink || null,
        storage_path: storagePath,
        original_name: pdf?.name ?? null,
        mime_type: pdf ? 'application/pdf' : null,
        size_bytes: pdf?.size ?? null,
        due_date: dueDate || null,
        order_index: nextOrderIndex,
      })
      if (result.error) {
        if (storagePath) {
          const cleanup = await supabase.storage.from('reading-files').remove([storagePath])
          setError(cleanup.error ? `${result.error.message} Cleanup also failed: ${cleanup.error.message}` : result.error.message)
        } else {
          setError(result.error.message)
        }
        setBusy(null)
        return
      }
      setTitle('')
      setSourceLink('')
      setDueDate('')
      setPdf(null)
    }

    setBusy(null)
    setOpen(false)
    onAdded()
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-sm font-medium text-accent hover:opacity-80">
        + Add reading
      </button>

      {open && (
        <div className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center" onClick={() => { if (!busy) setOpen(false) }}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navy">Add reading</h2>
              <div className="flex gap-1 text-xs">
                {(['single', 'bulk'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    disabled={!!busy}
                    className={['rounded-full px-3 py-1 font-medium capitalize', mode === m ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted'].join(
                      ' ',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="rounded-lg bg-accent-bg px-3 py-2 text-sm text-accent">{error}</p>}

            {mode === 'single' ? (
              <>
                <input
                  type="text"
                  required
                  placeholder="Reading title"
                  value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!!busy}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
                <input
                  type="url"
                  placeholder="Source link (optional)"
                  value={sourceLink}
                  onChange={(e) => setSourceLink(e.target.value)}
                  disabled={!!busy}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
                <label className="block rounded-lg border border-dashed border-border bg-bg px-3 py-3 text-sm text-ink-muted">
                  <span className="block font-medium text-ink">PDF file (optional)</span>
                  <span className="mb-2 block text-xs">Stored privately and opened in A2 Reading mode.</span>
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={!!busy}
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null
                      setPdf(file)
                      if (file && !title) setTitle(file.name.replace(/\.pdf$/i, ''))
                    }}
                    className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-accent-bg file:px-3 file:py-2 file:text-accent"
                  />
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={!!busy}
                  className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
              </>
            ) : (
              <>
                <textarea
                  required
                  autoFocus
                  placeholder={'One reading per line, e.g.\nChapter 4 — Due Process\nChapter 5 — Equal Protection\nMarbury v. Madison'}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  maxLength={20_000}
                  disabled={!!busy}
                  rows={6}
                  className="w-full resize-none rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                />
                <p className="text-xs text-ink-muted">
                  {bulkLines.length} reading{bulkLines.length === 1 ? '' : 's'} will be added, in order.
                </p>
                {bulkLines.length > 200 && <p className="text-xs text-accent">Add at most 200 readings at a time.</p>}
              </>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" disabled={!!busy} onClick={() => setOpen(false)} className="px-3 py-2 text-sm text-ink-muted disabled:opacity-50">
                Cancel
              </button>
              <button
                type="submit"
                disabled={!!busy || (mode === 'bulk' && (bulkLines.length === 0 || bulkLines.length > 200))}
                className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg disabled:opacity-50"
              >
                {busy === 'uploading' ? 'Uploading…' : busy === 'saving' ? 'Saving…' : mode === 'bulk' ? `Add ${bulkLines.length || ''}` : 'Add'}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}
