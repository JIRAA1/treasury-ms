import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import BroadcastClient from './BroadcastClient'

export const metadata = { title: 'ส่งข่าวสาร (Broadcast) — TreasuryMS' }

export default async function AdminBroadcastPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient.from('users').select('role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  if (profile?.role !== 'admin' && profile?.role !== 'treasurer') redirect('/student/dashboard')

  // Load periods from active semester
  const { data: activeSemester } = await adminClient
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  let periods: { id: string; label: string; period_order: number }[] = []
  if (activeSemester?.id) {
    const { data: pData } = await adminClient
      .from('periods')
      .select('id, label, period_order')
      .eq('semester_id', activeSemester.id)
      .order('period_order', { ascending: true })
    periods = pData || []
  }

  return (
    <div className="flex flex-col h-full">
      <Topbar title="ส่งข่าวสาร (Broadcast)" subtitle="ส่งข้อความแจ้งเตือนถึงนักศึกษาตามเงื่อนไข" />
      <BroadcastClient periods={periods} />
    </div>
  )
}
