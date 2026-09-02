import { useCallback, useEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from 'react'
import { endOfDay } from 'date-fns'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useProfiles } from '../hooks/useProfiles'
import { useRealtimeRefresh } from '../hooks/useRealtimeRefresh'
import { NudgePickerButton } from '../components/us/NudgePickerButton'
import { NudgeRow } from '../components/us/NudgeRow'
import { ThoughtComposer } from '../components/us/ThoughtComposer'
import { ThoughtCard } from '../components/us/ThoughtCard'
import { BudgetView } from '../components/us/BudgetView'
import { BudgetEntryModal, type BudgetTransaction } from '../components/us/BudgetEntryModal'
import { useSettings } from '../hooks/useSettings'
import { useQuickAdd } from '../hooks/useQuickAdd'
import { SettingsIcon, ChevronDownIcon, BellIcon } from '../components/layout/icons'

const REALTIME_TABLES = ['nudges', 'thoughts', 'budget_transactions', 'budget_settings']
const SUBVIEW_ORDER = ['budget', 'thoughts'] as const
type SubView = (typeof SUBVIEW_ORDER)[number]
const SWIPE_MIN_DISTANCE = 60

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
  archived: boolean
  created_at: string
}

export function Us() {
  const { user } = useAuth()
  const { householdId, loading: householdLoading } = useHousehold()
  const profiles = useProfiles()
  const { openSettings } = useSettings()

  const [subView, setSubView] = useState<SubView>('budget')
  const [nudgesOpen, setNudgesOpen] = useState(false)
  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [tasks, setTasks] = useState<Item[]>([])
  const [readings, setReadings] = useState<Item[]>([])
  const [thoughts, setThoughts] = useState<Thought[]>([])
  const [addedToToday, setAddedToToday] = useState<Set<string>>(new Set())
  const [archivedOpen, setArchivedOpen] = useState(false)
  const [budgetTransactions, setBudgetTransactions] = useState<BudgetTransaction[]>([])
  const [budgetLimit, setBudgetLimit] = useState<number | null>(null)
  const [budgetEntry, setBudgetEntry] = useState<BudgetTransaction | 'new' | null>(null)
  const [loading, setLoading] = useState(true)
  const thoughtComposerRef = useRef<HTMLTextAreaElement>(null)

  const load = useCallback(async () => {
    if (!householdId || !user) return
    setLoading(true)

    const [membersRes, nudgesRes, tasksRes, readingsRes, thoughtsRes, budgetRes, budgetSettingsRes] = await Promise.all([
      supabase.from('household_members').select('user_id').eq('household_id', householdId),
      supabase.from('nudges').select('id, from_user_id, to_user_id, item_type, item_id, message, status, created_at').order('created_at', {
        ascending: false,
      }),
      supabase.from('tasks').select('id, title'),
      supabase.from('reading_items').select('id, title'),
      supabase.from('thoughts').select('id, owner_id, body, visibility, comments, archived, created_at').order('created_at', { ascending: false }),
      supabase
        .from('budget_transactions')
        .select('id, type, amount, category, description, paid_by, split_mode, occurred_on')
        .order('occurred_on', { ascending: false }),
      supabase.from('budget_settings').select('monthly_limit').eq('household_id', householdId).maybeSingle(),
    ])

    const members = (membersRes.data ?? []) as { user_id: string }[]
    setPartnerId(members.find((m) => m.user_id !== user.id)?.user_id ?? null)
    setNudges((nudgesRes.data ?? []) as Nudge[])
    setTasks((tasksRes.data ?? []) as Item[])
    setReadings((readingsRes.data ?? []) as Item[])
    setThoughts((thoughtsRes.data ?? []) as Thought[])
    setBudgetTransactions((budgetRes.data ?? []) as BudgetTransaction[])
    setBudgetLimit((budgetSettingsRes.data as { monthly_limit: number | null } | null)?.monthly_limit ?? null)
    setLoading(false)
  }, [householdId, user])

  useEffect(() => {
    load()
  }, [load])

  useRealtimeRefresh(REALTIME_TABLES, load)

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

  function closeBudgetEntry() {
    setBudgetEntry(null)
  }

  function saveBudgetEntry() {
    setBudgetEntry(null)
    load()
  }

  // The persistent "+" in AppShell adds a transaction on Budget; Thoughts
  // has no separate "add" modal (the composer's always visible), so it
  // just focuses that instead.
  useQuickAdd(
    subView === 'budget'
      ? () => setBudgetEntry('new')
      : () => {
          thoughtComposerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          thoughtComposerRef.current?.focus()
        },
  )

  if (householdLoading || loading) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  const partnerLabel = partnerId ? (profiles[partnerId] ?? 'partner') : 'partner'
  const activeThoughts = thoughts.filter((t) => !t.archived)
  const archivedThoughts = thoughts.filter((t) => t.archived)
  const budgetCategories = [...new Set(budgetTransactions.map((t) => t.category))].sort()
  // "New" nudges sent to me that I haven't reacted to yet — the bell's
  // notification-center badge count.
  const unreadNudgeCount = nudges.filter((n) => n.to_user_id === user?.id && n.status === 'sent').length

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Us</h1>
        <div className="flex items-center gap-2">
          {subView === 'budget' && (
            <button
              onClick={() => setBudgetEntry('new')}
              className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90"
            >
              + Add
            </button>
          )}
          <button
            onClick={() => setNudgesOpen(true)}
            aria-label="Nudges"
            className="relative rounded-full bg-surface p-2 text-ink-muted hover:text-ink"
          >
            <BellIcon className="h-5 w-5" />
            {unreadNudgeCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-medium text-white">
                {unreadNudgeCount}
              </span>
            )}
          </button>
          <button onClick={openSettings} aria-label="Settings" className="rounded-full p-1.5 text-ink-muted hover:text-ink md:hidden">
            <SettingsIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex gap-1 rounded-full bg-surface p-1 text-xs">
        {(
          [
            ['budget', 'Budget'],
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
        {subView === 'budget' && user && householdId && (
          <BudgetView
            householdId={householdId}
            userId={user.id}
            partnerId={partnerId}
            partnerLabel={partnerLabel}
            transactions={budgetTransactions}
            monthlyLimit={budgetLimit}
            onReload={load}
            onEdit={(t) => setBudgetEntry(t)}
          />
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

      {nudgesOpen && (
        <div
          className="fixed inset-0 z-20 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/30 md:items-center"
          onClick={() => setNudgesOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[calc(100dvh-0.75rem)] w-full max-w-sm touch-pan-y space-y-3 overflow-y-auto overscroll-contain rounded-t-2xl border border-border bg-surface p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] [-webkit-overflow-scrolling:touch] md:max-h-[85vh] md:rounded-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-navy">Nudges</h2>
              {user && householdId && (
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
            </div>

            {nudges.length === 0 ? (
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
            )}
          </div>
        </div>
      )}

      {budgetEntry && householdId && user && (
        <BudgetEntryModal
          householdId={householdId}
          userId={user.id}
          partnerId={partnerId}
          partnerLabel={partnerLabel}
          categories={budgetCategories}
          entry={budgetEntry === 'new' ? null : budgetEntry}
          onClose={closeBudgetEntry}
          onSaved={saveBudgetEntry}
          onDeleted={saveBudgetEntry}
        />
      )}
    </div>
  )
}
