import { useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// Subscribes to Postgres changes on the given tables and re-runs onChange
// whenever a row is inserted/updated/deleted — RLS still applies, so a
// subscriber only ever receives events for rows their own policies already
// let them see. Callers should pass a stable (useCallback'd) onChange and a
// tables array that doesn't change identity across renders.
export function useRealtimeRefresh(tables: string[], onChange: () => void) {
  const tableKey = tables.join(',')

  useEffect(() => {
    if (!tableKey) return

    const channel = supabase.channel(`realtime:${tableKey}`)
    for (const table of tableKey.split(',')) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
    }
    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableKey, onChange])
}
