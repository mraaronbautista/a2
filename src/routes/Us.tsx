import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { useHousehold } from '../hooks/useHousehold'
import { useProfiles } from '../hooks/useProfiles'
import { NudgePickerButton } from '../components/us/NudgePickerButton'
import { NudgeRow } from '../components/us/NudgeRow'

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

export function Us() {
  const { user } = useAuth()
  const { householdId, loading: householdLoading } = useHousehold()
  const profiles = useProfiles()

  const [partnerId, setPartnerId] = useState<string | null>(null)
  const [nudges, setNudges] = useState<Nudge[]>([])
  const [tasks, setTasks] = useState<Item[]>([])
  const [readings, setReadings] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!householdId || !user) return
    setLoading(true)

    const [membersRes, nudgesRes, tasksRes, readingsRes] = await Promise.all([
      supabase.from('household_members').select('user_id').eq('household_id', householdId),
      supabase.from('nudges').select('id, from_user_id, to_user_id, item_type, item_id, message, status, created_at').order('created_at', {
        ascending: false,
      }),
      supabase.from('tasks').select('id, title'),
      supabase.from('reading_items').select('id, title'),
    ])

    const members = (membersRes.data ?? []) as { user_id: string }[]
    setPartnerId(members.find((m) => m.user_id !== user.id)?.user_id ?? null)
    setNudges((nudgesRes.data ?? []) as Nudge[])
    setTasks((tasksRes.data ?? []) as Item[])
    setReadings((readingsRes.data ?? []) as Item[])
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

  async function setStatus(nudgeId: string, status: Status) {
    setNudges((prev) => prev.map((n) => (n.id === nudgeId ? { ...n, status } : n)))
    await supabase.from('nudges').update({ status, updated_at: new Date().toISOString() }).eq('id', nudgeId)
  }

  async function cancelNudge(nudgeId: string) {
    setNudges((prev) => prev.filter((n) => n.id !== nudgeId))
    await supabase.from('nudges').delete().eq('id', nudgeId)
  }

  if (householdLoading || loading) {
    return <div className="p-6 text-sm text-ink-muted">Loading…</div>
  }

  const partnerLabel = partnerId ? (profiles[partnerId] ?? 'partner') : 'partner'

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-navy">Us</h1>
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
  )
}
