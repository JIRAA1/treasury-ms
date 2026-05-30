import type { SupabaseClient } from '@supabase/supabase-js'

interface UserMeta {
  id: string
  user_metadata?: {
    treasury_user_id?: string
    student_id?: string
  }
  email?: string
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
  const fallbackUuid = user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'
  const fallbackStudentId = user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'

  const { data, error } = await adminClient
    .from('users')
    .select(select)
    .or(`id.eq.${user.id},id.eq.${fallbackUuid},student_id.eq.${fallbackStudentId}`)
    .maybeSingle()

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
