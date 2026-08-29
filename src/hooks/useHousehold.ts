import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './useAuth'

interface HouseholdMembership {
  household_id: string
}

export function useHousehold() {
  const { user } = useAuth()
  const [householdId, setHouseholdId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setHouseholdId(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }: { data: HouseholdMembership | null }) => {
        if (cancelled) return
        setHouseholdId(data?.household_id ?? null)
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [user])

  return { householdId, loading }
}
