import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './useAuth'
import { useHousehold } from './useHousehold'

// The other member of a two-person household — null until loaded or if
// no partner has joined yet.
export function usePartnerId() {
  const { user } = useAuth()
  const { householdId } = useHousehold()
  const [partnerId, setPartnerId] = useState<string | null>(null)

  useEffect(() => {
    if (!householdId || !user) return
    supabase
      .from('household_members')
      .select('user_id')
      .eq('household_id', householdId)
      .then(({ data }) => {
        const members = (data ?? []) as { user_id: string }[]
        setPartnerId(members.find((m) => m.user_id !== user.id)?.user_id ?? null)
      })
  }, [householdId, user])

  return partnerId
}
