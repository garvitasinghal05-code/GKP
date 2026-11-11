// DESTINATION: src/lib/supabase/admin.ts  (new file, next to server.ts and client.ts)
// SERVER ONLY. Uses the secret service-role key. This is the ONLY way to call
// attach_gateway_order / mark_order_paid / mark_order_refunded.
// Never import it from a 'use client' file; never put NEXT_PUBLIC_ in front of the key.
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
