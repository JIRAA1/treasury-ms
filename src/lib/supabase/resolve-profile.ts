import type { SupabaseClient } from '@supabase/supabase-js'

interface UserMeta {
  id: string
  user_metadata?: {
    treasury_user_id?: string
    student_id?: string
  }
  email?: string
  email_confirmed_at?: string
  app_metadata?: Record<string, unknown>
}

/**
 * Resolves the DB user profile from a Supabase auth user.
 * Uses a deterministic .or() query that matches on auth UUID, treasury_user_id metadata,
 * or student_id — whichever is available.
 *
 * Always use adminClient (service-role) to bypass RLS when resolving profiles.
 */
export async function resolveProfile(
  adminClient: SupabaseClient,
  user: UserMeta,
  select = 'id, role, fullname, student_id, line_user_id, tier'
): Promise<Record<string, unknown> | null> {
  // Never authorize a financial operation with user-editable metadata.
  let result = await adminClient.from('users').select(select).eq('id', user.id).maybeSingle()
  if (!result.data && !result.error && user.app_metadata?.treasury_user_id) {
    result = await adminClient.from('users').select(select).eq('id', user.app_metadata.treasury_user_id).maybeSingle()
  }
  if (!result.data && !result.error && user.email && user.email_confirmed_at) {
    const localStudent = /^(\d{8})@treasury\.local$/i.exec(user.email)
    result = localStudent
      ? await adminClient.from('users').select(select).eq('student_id', localStudent[1]).maybeSingle()
      : await adminClient.from('users').select(select).eq('email', user.email).maybeSingle()
  }
  const { data, error } = result

  if (error) {
    console.error('[resolveProfile] Query error:', error.message)
    return null
  }

  return data as Record<string, unknown> | null
}

/**
 * Convenience: resolves profile and checks that role is admin or treasurer.
 * Returns null if user is not found or not privileged.
 */
export async function resolveAdminProfile(
  adminClient: SupabaseClient,
  user: UserMeta,
  select = 'id, role'
) {
  const profile = await resolveProfile(adminClient, user, select)
  if (!profile) return null
  if (!['admin', 'treasurer'].includes(profile['role'] as string)) return null
  return profile
}
