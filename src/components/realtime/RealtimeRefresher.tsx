// DESTINATION: src/components/realtime/RealtimeRefresher.tsx  (new folder: components/realtime/)
'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Props = {
  channelName: string
  table: string
  filter: string // e.g. "id=eq.abc123" or "shop_id=eq.xyz"
}

// Renders nothing — it just listens. When a matching row in `table`
// changes, it calls router.refresh(), which re-runs the Server
// Component's data fetch and updates the page with zero page reload
// and no polling.
export function RealtimeRefresher({ channelName, table, filter }: Props) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table, filter }, () => {
        router.refresh()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channelName, table, filter])

  return null
}
