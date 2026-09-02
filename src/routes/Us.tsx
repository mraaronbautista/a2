import { useCallback, useEffect, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import { endOfDay } from 'date-fns'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useProfiles } from '../hooks/useProfiles'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { ThoughtComposer } from '../components/us/ThoughtComposer'
import { ThoughtCard } from '../components/us/ThoughtCard'
import { GoalModal, type Goal } from '../components/us/GoalModal'
import { TaskItem } from '../components/tasks/TaskItem'
import { useSettings } from '../hooks/useSettings'
import { useQuickAdd } from '../hooks/useQuickAdd'
import { SettingsIcon, ChevronDownIcon } from '../components/layout/icons'

const REALTIME_TABLES = ['thoughts', 'goals']
const SUBVIEW_ORDER = ['goals', 'thoughts'] as const
type SubView = (typeof SUBVIEW_ORDER)[number]
const SWIPE_MIN_DISTANCE = 60

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
  archived: boolean
  created_at: string
}

function formatTargetDate(dateStr: string) {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function Us() {
  const { user } = useAuth()
  const { householdId, loading: householdLoading } = useHousehold()
  const profiles = useProfiles()
  const { openSettings } = useSettings()

  const [subView, setSubView] = useState<SubView>('goals')
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [addedToToday, setAddedToToday] = useState<Set<string>>(new Set())
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [goals, setGoals] = useState<Goal[]>([])
  const [goalModal, setGoalModal] = useState<Goal | 'new' | null>(null)
  const [completedGoalsOpen, setCompletedGoalsOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const thoughtComposerRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    if (!householdId || !user) return
    setLoading(true)

    const [thoughtsRes, goalsRes] = await Promise.all([
      supabase.from('thoughts').select('id, owner_id, body, visibility, comments, archived, created_at').order('created_at', { ascending: false }),
      supabase.from('goals').select('id, owner_id, title, target_date, visibility, completed_at').order('created_at', { ascending: false }),
    ])

    setThoughts((thoughtsRes.data ?? []) as Thought[])
    setGoals((goalsRes.data ?? []) as Goal[])
    setLoading(false)
  }, [householdId, user])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

  function nameFor(userId: string) {
    if (userId === user?.id) return 'You'
    return profiles[userId] ?? 'Partner'
  }

  async function toggleGoal(goal: Goal) {
    const completed_at = goal.completed_at ? null : new Date().toISOString()
    setGoals((prev) => prev.map((g) => (g.id === goal.id ? { ...g, completed_at } : g)))
    await supabase.from('goals').update({ completed_at }).eq('id', goal.id)
  }

  async function editThought(thoughtId: string, body: string) {
    setThoughts((prev) => prev.map((t) => (t.id === thoughtId ? { ...t, body } : t)))
    await supabase.from('thoughts').update({ body, updated_at: new Date().toISOString() }).eq('id', thoughtId)
  }

  // Reversible, unlike deleteThought below — a thought just moves into the
  // collapsed Archived section instead of being lost outright.
  async function archiveThought(thoughtId: string, archived: boolean) {
    setThoughts((prev) => prev.map((t) => (t.id === thoughtId ? { ...t, archived } : t)))
    await supabase.from('thoughts').update({ archived, updated_at: new Date().toISOString() }).eq('id', thoughtId)
  }

  async function deleteThought(thoughtId: string) {
    if (!window.confirm("Delete this thought permanently? This can't be undone.")) return
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
    // Carry any existing comments over as checklist items, attributed by
    // author — otherwise that context is stranded on the pin once the task
    // is what people are actually looking at.
    const checklist = thought.comments.map((c) => ({
      id: crypto.randomUUID(),
      text: `${nameFor(c.authorId)}: ${c.body}`,
      done: false,
    }))
    await supabase.from('tasks').insert({
      household_id: householdId,
      owner_id: user.id,
      title: thought.body,
      due_date: endOfDay(new Date()).toISOString(),
      visibility: thought.visibility,
      checklist,
    })
    setAddedToToday((prev) => new Set(prev).add(thought.id))
  }

  // Same gesture as Timeline's Day/Month swipe (touchstart/touchend only,
  // horizontal-dominance + minimum-distance check, no preventDefault) —
  // with only two sub-views, either direction just toggles between them.
  const subViewSwipeStart = useRef<{ x: number; y: number } | null>(null)

  function handleSubViewSwipeStart(e: ReactTouchEvent) {
    const t = e.touches[0]
    subViewSwipeStart.current = { x: t.clientX, y: t.clientY }
  }

  function handleSubViewSwipeEnd(e: ReactTouchEvent) {
    const start = subViewSwipeStart.current
    subViewSwipeStart.current = null
    if (!start) return
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_DISTANCE || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const idx = SUBVIEW_ORDER.indexOf(subView)
    const nextIdx = dx < 0 ? (idx + 1) % SUBVIEW_ORDER.length : (idx - 1 + SUBVIEW_ORDER.length) % SUBVIEW_ORDER.length
    setSubView(SUBVIEW_ORDER[nextIdx])
  }

  // The persistent "+" in AppShell opens a new goal on Goals; Thoughts has
  // no separate "add" modal (the composer's always visible), so it just
  // focuses that instead.
  useQuickAdd(
    subView === 'goals'
      ? () => setGoalModal('new')
      : () => {
          thoughtComposerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          thoughtComposerRef.current?.focus()
        },
  )

  if (householdLoading || loading) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  const activeThoughts = thoughts.filter((t) => !t.archived)
  const archivedThoughts = thoughts.filter((t) => t.archived)

  const activeGoals = goals
    .filter((g) => !g.completed_at)
    .sort((a, b) => {
      if (!a.target_date && !b.target_date) return 0
      if (!a.target_date) return 1
      if (!b.target_date) return -1
      return a.target_date.localeCompare(b.target_date)
    })
  const completedGoals = goals.filter((g) => g.completed_at)

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Us</h1>
        <div className="flex items-center gap-2">
          <button onClick={openSettings} aria-label="Settings" className="rounded-full p-1.5 text-ink-muted hover:text-ink md:hidden">
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 rounded-full bg-surface p-1 text-xs">
        {(
          [
            ['goals', 'Goals'],
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

      <div onTouchStart={handleSubViewSwipeStart} onTouchEnd={handleSubViewSwipeEnd}>
        {subView === 'goals' && (
          <div className="space-y-3">
            {activeGoals.length === 0 ? (
              <p className="text-sm text-ink-muted">No goals yet — what are we working toward?</p>
            ) : (
              <ul className="space-y-2">
                {activeGoals.map((g) => (
                  <TaskItem
                    key={g.id}
                    label={g.title}
                    meta={g.visibility === 'private' ? 'Just yours' : undefined}
                    dueLabel={g.target_date ? formatTargetDate(g.target_date) : undefined}
                    checked={false}
                    onToggle={() => toggleGoal(g)}
                    onClick={() => setGoalModal(g)}
                  />
                ))}
              </ul>
            )}

            {completedGoals.length > 0 && (
              <div>
                <button
                  onClick={() => setCompletedGoalsOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs text-ink-muted"
                >
                  <span>Achieved ({completedGoals.length})</span>
                  <ChevronDownIcon className={['h-4 w-4 transition-transform', completedGoalsOpen ? 'rotate-180' : ''].join(' ')} />
                </button>

                {completedGoalsOpen && (
                  <ul className="mt-2 space-y-2">
                    {completedGoals.map((g) => (
                      <TaskItem
                        key={g.id}
                        label={g.title}
                        dueLabel={g.target_date ? formatTargetDate(g.target_date) : undefined}
                        checked
                        onToggle={() => toggleGoal(g)}
                        onClick={() => setGoalModal(g)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {subView === 'thoughts' && user && householdId && (
          <div className="space-y-3">
            <ThoughtComposer ref={thoughtComposerRef} householdId={householdId} userId={user.id} onPosted={load} />

            {activeThoughts.length === 0 ? (
              <p className="text-sm text-ink-muted">Nothing pinned yet.</p>
            ) : (
              <ul className="space-y-2">
                {activeThoughts.map((t) => (
                  <ThoughtCard
                    key={t.id}
                    body={t.body}
                    visibility={t.visibility}
                    ownerId={t.owner_id}
                    createdAt={t.created_at}
                    comments={t.comments}
                    isOwn={t.owner_id === user.id}
                    archived={false}
                    nameFor={nameFor}
                    onEdit={(body) => editThought(t.id, body)}
                    onToggleShare={() => toggleShareThought(t)}
                    onAddComment={(body) => addThoughtComment(t.id, body)}
                    onAddToToday={() => addThoughtToToday(t)}
                    addedToToday={addedToToday.has(t.id)}
                    onArchive={() => archiveThought(t.id, true)}
                    onUnarchive={() => archiveThought(t.id, false)}
                    onDelete={() => deleteThought(t.id)}
                  />
                ))}
              </ul>
            )}

            {archivedThoughts.length > 0 && (
              <div>
                <button
                  onClick={() => setArchivedOpen((v) => !v)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs text-ink-muted"
                >
                  <span>Archived ({archivedThoughts.length})</span>
                  <ChevronDownIcon className={['h-4 w-4 transition-transform', archivedOpen ? 'rotate-180' : ''].join(' ')} />
                </button>

                {archivedOpen && (
                  <ul className="mt-2 space-y-2">
                    {archivedThoughts.map((t) => (
                      <ThoughtCard
                        key={t.id}
                        body={t.body}
                        visibility={t.visibility}
                        ownerId={t.owner_id}
                        createdAt={t.created_at}
                        comments={t.comments}
                        isOwn={t.owner_id === user.id}
                        archived
                        nameFor={nameFor}
                        onEdit={(body) => editThought(t.id, body)}
                        onToggleShare={() => toggleShareThought(t)}
                        onAddComment={(body) => addThoughtComment(t.id, body)}
                        onAddToToday={() => addThoughtToToday(t)}
                        addedToToday={addedToToday.has(t.id)}
                        onArchive={() => archiveThought(t.id, true)}
                        onUnarchive={() => archiveThought(t.id, false)}
                        onDelete={() => deleteThought(t.id)}
                      />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {goalModal && householdId && user && (
        <GoalModal
          householdId={householdId}
          userId={user.id}
          goal={goalModal === 'new' ? null : goalModal}
          onClose={() => setGoalModal(null)}
          onSaved={() => {
            setGoalModal(null)
            load()
          }}
          onDeleted={() => {
            setGoalModal(null)
            load()
          }}
        />
      )}
    </div>
  )
}
