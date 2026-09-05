import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useNotebook } from '../hooks/useNotebook'
import { useAuth } from '../hooks/useAuth'
import { NotebookHeader } from '../components/library/NotebookHeader'
import { NotebookSection } from '../components/library/NotebookSection'
import { EditNotebookDialog } from '../components/library/EditNotebookDialog'
import { NewSectionDialog } from '../components/library/NewSectionDialog'
import { AddExistingDialog } from '../components/library/AddExistingDialog'
import { ArchiveDialog } from '../components/library/ArchiveDialog'

export function NotebookDetail() {
  const { notebookId } = useParams(); const navigate = useNavigate(); const { user } = useAuth(); const [params,setParams]=useSearchParams()
  const { notebook,sections,entries,loading,error,reload }=useNotebook(notebookId)
  const [editOpen,setEditOpen]=useState(false); const [newSectionOpen,setNewSectionOpen]=useState(false); const [addToSection,setAddToSection]=useState<string|null>(null); const [archiveOpen,setArchiveOpen]=useState(false); const [search,setSearch]=useState('')
  const selectedId=params.get('section')??sections[0]?.id??null
  useEffect(()=>{if(!params.get('section')&&sections[0])setParams({section:sections[0].id},{replace:true})},[params,sections,setParams])
  useEffect(()=>{if(notebookId&&user)void supabase.from('notebook_user_state').upsert({notebook_id:notebookId,user_id:user.id,last_opened_at:new Date().toISOString(),updated_at:new Date().toISOString()})},[notebookId,user])
  if(loading)return <div className="p-6 text-sm text-ink-muted">Loading notebook…</div>
  if(error||!notebook)return <div className="p-6 text-sm text-ink-muted">{error??'Notebook not found.'}</div>
  async function removeEntry(id:string){await supabase.rpc('remove_library_entry',{target_entry_id:id});await reload()}
  async function toggleArchive(){await supabase.from('notebooks').update({archived_at:notebook?.archived_at?null:new Date().toISOString()}).eq('id',notebookId!);setArchiveOpen(false);await reload()}
  async function renameSection(id:string,current:string){const name=window.prompt('Section name',current)?.trim();if(!name||name===current)return;await supabase.from('notebook_sections').update({name,updated_at:new Date().toISOString()}).eq('id',id);await reload()}
  async function moveSection(id:string,index:number,direction:-1|1){const target=index+direction;if(target<0||target>=sections.length)return;const remaining=sections.filter((section)=>section.id!==id);const insertion=Math.max(0,Math.min(target,remaining.length));await supabase.rpc('reorder_section',{target_section_id:id,before_id:remaining[insertion-1]?.id??null,after_id:remaining[insertion]?.id??null});await reload()}
  async function deleteSection(id:string){if(!window.confirm('Delete this section? Its items will become Unfiled.'))return;const {error:deleteError}=await supabase.rpc('delete_section_unfile',{target_section_id:id});if(deleteError)window.alert(deleteError.message);await reload()}
  async function deleteNotebook(){if(!window.confirm(`Delete “${notebook?.name}”? Its items will become Unfiled.`))return;await supabase.rpc('delete_notebook_unfile',{target_notebook_id:notebookId!});navigate(notebook?.space==='personal'?'/us?view=notes&library=notebooks':'/notes?library=notebooks')}
  return <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
    <NotebookHeader notebook={notebook} onEdit={()=>setEditOpen(true)} onNewSection={()=>setNewSectionOpen(true)} onArchive={()=>setArchiveOpen(true)} onDelete={deleteNotebook}/>
    <input type="search" value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Search within notebook…" className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"/>
    <div className="space-y-3">{sections.map((section,index)=><div key={section.id} className="space-y-1"><div className="flex justify-end gap-1"><button disabled={index===0} onClick={()=>void moveSection(section.id,index,-1)} className="px-2 py-1 text-xs text-ink-muted disabled:opacity-30">↑</button><button disabled={index===sections.length-1} onClick={()=>void moveSection(section.id,index,1)} className="px-2 py-1 text-xs text-ink-muted disabled:opacity-30">↓</button><button onClick={()=>void renameSection(section.id,section.name)} className="px-2 py-1 text-xs text-ink-muted">Rename</button><button onClick={()=>void deleteSection(section.id)} className="px-2 py-1 text-xs text-accent">Delete</button></div><NotebookSection section={section} entries={entries.filter((entry)=>entry.section_id===section.id&&(!search||entry.title.toLowerCase().includes(search.toLowerCase())))} selected={selectedId===section.id} onSelect={()=>setParams({section:section.id})} onAdd={()=>setAddToSection(section.id)} onRemove={removeEntry}/></div>)}</div>
    {editOpen&&<EditNotebookDialog notebook={notebook} onClose={()=>setEditOpen(false)} onSaved={()=>{setEditOpen(false);void reload()}}/>}
    {newSectionOpen&&<NewSectionDialog notebookId={notebook.id} onClose={()=>setNewSectionOpen(false)} onSaved={()=>{setNewSectionOpen(false);void reload()}}/>}
    {addToSection&&<AddExistingDialog sectionId={addToSection} space={notebook.space} onClose={()=>setAddToSection(null)} onSaved={()=>{setAddToSection(null);void reload()}}/>}
    {archiveOpen&&<ArchiveDialog title="notebook" archived={!!notebook.archived_at} onClose={()=>setArchiveOpen(false)} onConfirm={toggleArchive}/>}</div>
}
