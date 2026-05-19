import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/layout/AppShell'
import type { User } from '@/types'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  // Use Admin Client to ensure we can read the role regardless of RLS
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('users')
    .select('*')
    .or(`id.eq.${authUser.id},student_id.eq.${authUser.user_metadata.student_id}`)
    .maybeSingle()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'treasurer')) {
    console.log('[AdminLayout] Access denied for:', authUser.id, 'Role:', profile?.role)
    redirect('/student/dashboard')
  }

  const { count: pendingCount } = await admin
    .from('payments')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending')

  return (
    <AppShell role={profile.role as 'treasurer' | 'admin'} user={profile as User} pendingCount={pendingCount ?? 0}>
      {children}
    </AppShell>
  )
}
