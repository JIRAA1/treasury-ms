import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Admin client using the Service Role key.
 * NEVER expose this on the client side.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
