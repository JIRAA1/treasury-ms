import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/layout/AppShell'
import type { User } from '@/types'

import { getProfile } from '@/lib/data'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const profile = await getProfile(authUser.id, authUser.user_metadata.student_id)

  if (!profile || (profile.role !== 'admin' && profile.role !== 'treasurer')) {
    console.log('[AdminLayout] Access denied for:', authUser.id, 'Role:', profile?.role)
    redirect('/student/dashboard')
  }

  // Parallel: fetch pending counts at the same time
  const admin = createAdminClient()
  const [{ count: pendingCount }, { count: pendingCreditsCount }] = await Promise.all([
    admin.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    admin.from('payment_credits').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
  ])

  return (
    <AppShell role={profile.role as 'treasurer' | 'admin'} user={profile as User} pendingCount={pendingCount ?? 0} pendingCredits={pendingCreditsCount ?? 0}>
      {children}
    </AppShell>
  )
}

