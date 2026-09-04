import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { extractSyllabusLocally } from '../../lib/syllabusExtraction'

export interface SyllabusRow {
  id: string
  created_by: string
  original_name: string
  storage_path: string
  mime_type: string | null
  size_bytes: number
  extraction_status: 'pending' | 'ready' | 'needs_review' | 'failed'
  extraction_method: string | null
  extracted_text: string
  edited_text: string
  notes: string
  updated_at: string
}

interface Props {
  courseId: string
  householdId: string
  userId: string
  canManage: boolean
  syllabi: SyllabusRow[]
  onChanged: () => void
}

const ACCEPTED = '.pdf,.doc,.docx,.txt,.md,.html,.htm,image/*'

function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function safeExportName(name: string) {
  const base = name.replace(/\.[^.]+$/, '').trim() || 'syllabus'
  return `${base}-edited.txt`
}

function exportEditedCopy(item: SyllabusRow) {
  const body = [item.edited_text, item.notes ? `\n\nNOTES\n${item.notes}` : ''].join('')
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = safeExportName(item.original_name)
  link.click()
  URL.revokeObjectURL(url)
}

function printEditedCopy(item: SyllabusRow) {
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const title = printWindow.document.createElement('title')
  title.textContent = `${item.original_name} — edited copy`
  const style = printWindow.document.createElement('style')
  style.textContent = `
    @page { margin: 0.7in; }
    body { color: #111827; font: 11pt/1.55 Arial, sans-serif; margin: 0; }
    h1 { font-size: 18pt; margin: 0 0 4pt; }
    .label { color: #6b7280; font-size: 9pt; margin-bottom: 24pt; }
    h2 { border-top: 1px solid #d1d5db; font-size: 12pt; margin-top: 24pt; padding-top: 12pt; }
    pre { font: inherit; margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  `
  const heading = printWindow.document.createElement('h1')
  heading.textContent = item.original_name
  const label = printWindow.document.createElement('p')
  label.className = 'label'
  label.textContent = 'Editable study copy — the uploaded original remains unchanged'
  const text = printWindow.document.createElement('pre')
  text.textContent = item.edited_text || 'No editable syllabus text has been added.'

  printWindow.document.head.append(title, style)
  printWindow.document.body.append(heading, label, text)
  if (item.notes) {
    const notesHeading = printWindow.document.createElement('h2')
    notesHeading.textContent = 'Notes'
    const notes = printWindow.document.createElement('pre')
    notes.textContent = item.notes
    printWindow.document.body.append(notesHeading, notes)
  }
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}

export function SyllabusWorkspace({ courseId, householdId, userId, canManage, syllabi, onChanged }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState<SyllabusRow | null>(null)
  const [editedText, setEditedText] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')

  async function upload(file: File) {
    setBusy(true)
    setError('')
    const storagePath = `${userId}/${courseId}/${crypto.randomUUID()}-${file.name}`
    const extraction = await extractSyllabusLocally(file)
    const uploadResult = await supabase.storage.from('syllabi').upload(storagePath, file, { upsert: false })
    if (uploadResult.error) {
      setError(uploadResult.error.message)
      setBusy(false)
      return
    }

    const result = await supabase.from('course_syllabi').insert({
      household_id: householdId,
      course_id: courseId,
      created_by: userId,
      updated_by: userId,
      original_name: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      extraction_status: extraction.status,
      extraction_method: extraction.method,
      extracted_text: extraction.text,
      edited_text: extraction.text,
    })

    if (result.error) {
      await supabase.storage.from('syllabi').remove([storagePath])
      setError(result.error.message)
    } else {
      onChanged()
    }
    setBusy(false)
  }

  function openEditor(item: SyllabusRow) {
    setEditing(item)
    setEditedText(item.edited_text)
    setNotes(item.notes)
    setError('')
  }

  async function save() {
    if (!editing) return
    setBusy(true)
    const result = await supabase
      .from('course_syllabi')
      .update({ edited_text: editedText, notes, updated_by: userId, updated_at: new Date().toISOString() })
      .eq('id', editing.id)
    if (result.error) setError(result.error.message)
    else {
      setEditing(null)
      onChanged()
    }
    setBusy(false)
  }

  async function download(item: SyllabusRow) {
    const { data, error: signedError } = await supabase.storage.from('syllabi').createSignedUrl(item.storage_path, 60)
    if (signedError) setError(signedError.message)
    else window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  async function remove(item: SyllabusRow) {
    if (!window.confirm(`Delete “${item.original_name}” and its editable copy?`)) return
    setBusy(true)
    const result = await supabase.from('course_syllabi').delete().eq('id', item.id)
    if (result.error) setError(result.error.message)
    else {
      await supabase.storage.from('syllabi').remove([item.storage_path])
      onChanged()
    }
    setBusy(false)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-muted">Syllabus workspace</h2>
          <p className="text-xs text-ink-muted">Original file protected · extracted copy editable</p>
        </div>
        {canManage && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {busy ? 'Working…' : 'Upload syllabus'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) upload(file)
              }}
            />
          </>
        )}
      </div>

      {error && <p className="rounded-lg bg-accent-bg px-3 py-2 text-sm text-accent">{error}</p>}

      {syllabi.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface p-5 text-sm text-ink-muted">
          Upload a PDF, Word document, image, or text file. Text files are extracted on this device; other formats are
          preserved and marked for verified extraction.
        </div>
      ) : (
        <div className="space-y-2">
          {syllabi.map((item) => (
            <article key={item.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate font-medium text-ink">{item.original_name}</h3>
                  <p className="text-xs text-ink-muted">{fileSize(item.size_bytes)} · Original preserved</p>
                </div>
                <span
                  className={[
                    'rounded-full px-2.5 py-1 text-xs font-medium',
                    item.extraction_status === 'ready' ? 'bg-accent-bg text-accent' : 'bg-bg text-ink-muted',
                  ].join(' ')}
                >
                  {item.extraction_status === 'ready' ? 'Text ready' : 'Extraction review needed'}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <button type="button" onClick={() => download(item)} className="text-accent">Open original</button>
                <button type="button" onClick={() => openEditor(item)} className="text-accent">
                  {item.edited_text || item.notes ? 'Edit text & notes' : 'Add text & notes'}
                </button>
                <button type="button" onClick={() => exportEditedCopy(item)} className="text-accent">Export copy</button>
                <button type="button" onClick={() => printEditedCopy(item)} className="text-accent">Print</button>
                {item.created_by === userId && <button type="button" onClick={() => remove(item)} className="text-ink-muted">Delete</button>}
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onMouseDown={() => setEditing(null)}>
          <div className="max-h-[92svh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl" onMouseDown={(e) => e.stopPropagation()}>
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-navy">{editing.original_name}</h3>
              <p className="text-xs text-ink-muted">Changes below never alter the uploaded original.</p>
            </div>
            <label className="block text-sm font-medium text-ink">
              Editable syllabus text
              <textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                readOnly={!canManage}
                placeholder="Extracted text will appear here. You can also paste or type a corrected copy."
                className="mt-1 min-h-64 w-full rounded-lg border border-border bg-bg p-3 text-ink outline-none focus:border-accent"
              />
            </label>
            <label className="mt-4 block text-sm font-medium text-ink">
              Notes
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                readOnly={!canManage}
                placeholder="Add reminders, coverage decisions, professor preferences, or corrections."
                className="mt-1 min-h-28 w-full rounded-lg border border-border bg-bg p-3 text-ink outline-none focus:border-accent"
              />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => exportEditedCopy({ ...editing, edited_text: editedText, notes })} className="rounded-lg border border-border px-3 py-2 text-sm text-ink-muted">Export</button>
              <button type="button" onClick={() => printEditedCopy({ ...editing, edited_text: editedText, notes })} className="rounded-lg border border-border px-3 py-2 text-sm text-ink-muted">Print</button>
              <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-3 py-2 text-sm text-ink-muted">Close</button>
              {canManage && <button type="button" disabled={busy} onClick={save} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Save copy</button>}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
