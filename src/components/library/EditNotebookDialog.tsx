import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabaseClient'
import type { NotebookRow } from '../../hooks/useNotebook'

export function EditNotebookDialog({ notebook, onClose, onSaved }: { notebook: NotebookRow; onClose: () => void; onSaved: () => void }) {
  const [name,setName]=useState(notebook.name); const [description,setDescription]=useState(notebook.description); const [saving,setSaving]=useState(false)
  async function submit(e: FormEvent){e.preventDefault();setSaving(true);await supabase.from('notebooks').update({name:name.trim(),description:description.trim(),updated_at:new Date().toISOString()}).eq('id',notebook.id);setSaving(false);onSaved()}
  return <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4" onClick={onClose}><form onSubmit={submit} onClick={(e)=>e.stopPropagation()} className="w-full max-w-md space-y-3 rounded-2xl border border-border bg-surface p-6"><h2 className="font-semibold text-ink">Edit notebook</h2><input required maxLength={100} value={name} onChange={(e)=>setName(e.target.value)} className="w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink"/><textarea maxLength={500} value={description} onChange={(e)=>setDescription(e.target.value)} className="min-h-24 w-full rounded-lg border border-border bg-bg px-3 py-2 text-sm text-ink"/><div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="px-3 py-2 text-sm text-ink-muted">Cancel</button><button disabled={saving} className="rounded-lg bg-navy px-4 py-2 text-sm text-bg">Save</button></div></form></div>
}
