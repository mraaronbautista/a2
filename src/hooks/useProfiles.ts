import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useHousehold } from './useHousehold'

export function useProfiles() {
  const { householdId } = useHousehold()
  const [profiles, setProfiles] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!householdId) return

    supabase
      .from('profiles')
      .select('id, display_name')
      .then(({ data }: { data: { id: string; display_name: string | null }[] | null }) => {
        const map: Record<string, string> = {}
        for (const p of data ?? []) {
          map[p.id] = p.display_name ?? 'Partner'
        }
        setProfiles(map)
      })
  }, [householdId])

  return profiles
}
