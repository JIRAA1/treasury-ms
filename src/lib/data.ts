import { cache } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Request-scoped cached fetching of the user profile.
 * Since Next.js App Router renders Layout and Pages in the same request,
 * this function prevents duplicate database queries.
 */
export const getProfile = cache(async (authId: string, studentId: string) => {
  console.log(`[getProfile] cache miss for authId=${authId} studentId=${studentId}`)
  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('id, student_id, fullname, email, role, tier, tier_note, line_user_id, verified, created_at')
    .or(`id.eq.${authId},student_id.eq.${studentId}`)
    .maybeSingle()
  return data
})

/**
 * Request-scoped cached fetching of the active semester.
 */
export const getActiveSemester = cache(async () => {
  console.log('[getActiveSemester] cache miss')
  const admin = createAdminClient()
  const { data } = await admin
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()
  return data
})

/**
 * Request-scoped cached fetching of the system settings.
 */
export const getSettings = cache(async () => {
  console.log('[getSettings] cache miss')
  const admin = createAdminClient()
  const { data } = await admin
    .from('system_settings')
    .select('*')
  return data || []
})
