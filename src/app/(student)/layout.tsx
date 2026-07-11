import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/layout/AppShell'
import type { User } from '@/types'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  // Use Admin Client to bypass RLS and find the profile by any linked identifier
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('*')
    .or(`id.eq.${authUser.id},line_user_id.eq.${authUser.id},student_id.eq.${authUser.user_metadata.student_id}`)
    .maybeSingle()

  if (!profile) {
    console.log('[StudentLayout] Profile NOT FOUND for Auth ID:', authUser.id)
    redirect('/bind')
  }

  // SYNC ID: If the IDs don't match, update the database record to use the Auth UID
  if (profile.id !== authUser.id) {
    console.log(`[StudentLayout] Syncing IDs: DB(${profile.id}) -> Auth(${authUser.id})`)
    const { error: syncError } = await admin
      .from('users')
      .update({ id: authUser.id })
      .eq('student_id', profile.student_id)
    
    if (!syncError) {
      profile.id = authUser.id
    }
  }

  // Parallel: fetch active semester + check unpaid cycles in one go
  const { data: activeSemester } = await admin
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  let hasUnpaidCycle = false
  if (activeSemester) {
    // Parallel: fetch periods + payments at the same time
    const [periodsRes, paymentsRes] = await Promise.all([
      admin
        .from('periods')
        .select('id')
        .eq('semester_id', activeSemester.id),
      admin
        .from('payments')
        .select('period_id, status')
        .eq('user_id', profile.id)
    ])

    const periods = periodsRes.data || []
    const payments = paymentsRes.data || []

    if (periods.length > 0) {
      const periodIds = new Set(periods.map((p) => p.id))
      hasUnpaidCycle = periods.some(
        (p) => !payments.find((pay) => pay.period_id === p.id && periodIds.has(pay.period_id) && (pay.status === 'approved' || pay.status === 'pending'))
      )
    }
  }

  return (
    <AppShell role={profile.role} user={profile as User} hasUnpaidWeek={hasUnpaidCycle}>
      {children}
    </AppShell>
  )
}

