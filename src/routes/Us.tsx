import { useCallback, useEffect, useMemo, useState } from 'react'
import { endOfDay } from 'date-fns'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useProfiles } from '../hooks/useProfiles'
import { NudgePickerButton } from '../components/us/NudgePickerButton'
import { NudgeRow } from '../components/us/NudgeRow'
import { ThoughtComposer } from '../components/us/ThoughtComposer'
import { ThoughtCard } from '../components/us/ThoughtCard'
import { useSettings } from '../hooks/useSettings'
import { SettingsIcon } from '../components/layout/icons'

type Status = 'sent' | 'on_it' | 'done' | 'later'

interface Nudge {
  id: string
  from_user_id: string
  to_user_id: string
  item_type: 'task' | 'reading' | 'note'
  item_id: string
  message: string | null
  status: Status
  created_at: string
}

interface Item {
  id: string
  title: string
}

interface ThoughtComment {
  id: string
  authorId: string
  body: string
  createdAt: string
}

interface Thought {
  id: string
  owner_id: string
  body: string
  visibility: 'private' | 'shared'
  comments: ThoughtComment[]
  created_at: string
}

export function Us() {
  const { user } = useAuth()
  const { householdId, loading: householdLoading } = useHousehold()
  const profiles = useProfiles()
  const { openSettings } = useSettings()

  const [subView, setSubView] = useState<'nudges' | 'thoughts'>('nudges')
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [tasks, setTasks] = useState<Item[]>([])
  const [readings, setReadings] = useState<Item[]>([])
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [addedToToday, setAddedToToday] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId || !user) return
    setLoading(true)

    const [membersRes, nudgesRes, tasksRes, readingsRes, thoughtsRes] = await Promise.all([
      supabase.from('household_members').select('user_id').eq('household_id', householdId),
      supabase.from('nudges').select('id, from_user_id, to_user_id, item_type, item_id, message, status, created_at').order('created_at', {
        ascending: false,
      }),
      supabase.from('tasks').select('id, title'),
      supabase.from('reading_items').select('id, title'),
      supabase.from('thoughts').select('id, owner_id, body, visibility, comments, created_at').order('created_at', { ascending: false }),
    ])

    const members = (membersRes.data ?? []) as { user_id: string }[]
    setPartnerId(members.find((m) => m.user_id !== user.id)?.user_id ?? null)
    setNudges((nudgesRes.data ?? []) as Nudge[])
    setTasks((tasksRes.data ?? []) as Item[])
    setReadings((readingsRes.data ?? []) as Item[])
    setThoughts((thoughtsRes.data ?? []) as Thought[])
    setLoading(false)
  }, [householdId, user])

  useEffect(() => {
    load()
  }, [load])

  const titleFor = useMemo(() => {
    const taskMap = new Map(tasks.map((t) => [t.id, t.title]))
    const readingMap = new Map(readings.map((r) => [r.id, r.title]))
    return (itemType: Nudge['item_type'], itemId: string) => {
      if (itemType === 'task') return taskMap.get(itemId) ?? '(deleted task)'
      if (itemType === 'reading') return readingMap.get(itemId) ?? '(deleted reading)'
      return '(note)'
    }
  }, [tasks, readings])

  function nameFor(userId: string) {
    if (userId === user?.id) return 'You'
    return profiles[userId] ?? 'Partner'
  }

  async function setStatus(nudgeId: string, status: Status) {
    setNudges((prev) => prev.map((n) => (n.id === nudgeId ? { ...n, status } : n)))
    await supabase.from('nudges').update({ status, updated_at: new Date().toISOString() }).eq('id', nudgeId)
  }

  async function cancelNudge(nudgeId: string) {
    setNudges((prev) => prev.filter((n) => n.id !== nudgeId))
    await supabase.from('nudges').delete().eq('id', nudgeId)
  }

  async function editThought(thoughtId: string, body: string) {
    setThoughts((prev) => prev.map((t) => (t.id === thoughtId ? { ...t, body } : t)))
    await supabase.from('thoughts').update({ body, updated_at: new Date().toISOString() }).eq('id', thoughtId)
  }

  async function deleteThought(thoughtId: string) {
    if (!window.confirm('Unpin this thought?')) return
    setThoughts((prev) => prev.filter((t) => t.id !== thoughtId))
    await supabase.from('thoughts').delete().eq('id', thoughtId)
  }

  async function toggleShareThought(thought: Thought) {
    const visibility = thought.visibility === 'shared' ? 'private' : 'shared'
    setThoughts((prev) => prev.map((t) => (t.id === thought.id ? { ...t, visibility } : t)))
    await supabase.from('thoughts').update({ visibility, updated_at: new Date().toISOString() }).eq('id', thought.id)
  }

  async function addThoughtComment(thoughtId: string, body: string) {
    await supabase.rpc('add_thought_comment', { p_thought_id: thoughtId, p_body: body })
    load()
  }

  async function addThoughtToToday(thought: Thought) {
    if (!user || !householdId) return
    await supabase.from('tasks').insert({
      household_id: householdId,
      owner_id: user.id,
      title: thought.body,
      due_date: endOfDay(new Date()).toISOString(),
      visibility: thought.visibility,
    })
    setAddedToToday((prev) => new Set(prev).add(thought.id))
  }

  if (householdLoading || loading) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  const partnerLabel = partnerId ? (profiles[partnerId] ?? 'partner') : 'partner'

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Us</h1>
        <div className="flex items-center gap-2">
          {subView === 'nudges' && user && householdId && (
            <NudgePickerButton
              householdId={householdId}
              userId={user.id}
              partnerId={partnerId}
              partnerLabel={partnerLabel}
              tasks={tasks}
              readings={readings}
              onAdded={load}
            />
          )}
          <button onClick={openSettings} aria-label="Settings" className="rounded-full p-1.5 text-ink-muted hover:text-ink md:hidden">
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 rounded-full bg-surface p-1 text-xs">
        {(
          [
            ['nudges', 'Nudges'],
            ['thoughts', 'Thoughts'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSubView(value)}
            className={['rounded-full px-3 py-1 font-medium', subView === value ? 'bg-accent-bg text-accent' : 'text-ink-muted'].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {subView === 'nudges' &&
        (nudges.length === 0 ? (
          <p className="text-sm text-ink-muted">No nudges yet.</p>
        ) : (
          <ul className="space-y-2">
            {nudges.map((n) => (
              <NudgeRow
                key={n.id}
                title={titleFor(n.item_type, n.item_id)}
                itemType={n.item_type}
                message={n.message}
                status={n.status}
                direction={n.to_user_id === user?.id ? 'received' : 'sent'}
                otherPartyLabel={partnerLabel}
                createdAt={n.created_at}
                canReact={n.to_user_id === user?.id}
                canCancel={n.from_user_id === user?.id}
                onSetStatus={(status) => setStatus(n.id, status)}
                onCancel={() => cancelNudge(n.id)}
              />
            ))}
          </ul>
        ))}

      {subView === 'thoughts' && user && householdId && (
        <div className="space-y-3">
          <ThoughtComposer householdId={householdId} userId={user.id} onPosted={load} />

          {thoughts.length === 0 ? (
            <p className="text-sm text-ink-muted">Nothing pinned yet.</p>
          ) : (
            <ul className="space-y-2">
              {thoughts.map((t) => (
                <ThoughtCard
                  key={t.id}
                  body={t.body}
                  visibility={t.visibility}
                  ownerId={t.owner_id}
                  createdAt={t.created_at}
                  comments={t.comments}
                  isOwn={t.owner_id === user.id}
                  nameFor={nameFor}
                  onEdit={(body) => editThought(t.id, body)}
                  onDelete={() => deleteThought(t.id)}
                  onToggleShare={() => toggleShareThought(t)}
                  onAddComment={(body) => addThoughtComment(t.id, body)}
                  onAddToToday={() => addThoughtToToday(t)}
                  addedToToday={addedToToday.has(t.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
