import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import BroadcastClient from './BroadcastClient'

export const metadata = { title: 'ส่งข่าวสาร (Broadcast) — TreasuryMS' }

export default async function AdminBroadcastPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await createAdminClient().from('users').select('role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  if (profile?.role !== 'admin' && profile?.role !== 'treasurer') redirect('/student/dashboard')

  const { data: weekSettings } = await supabase
    .from('week_settings')
    .select('week, title')
    .order('week', { ascending: true })

  return (
    <div className="flex flex-col h-full">
      <Topbar title="ส่งข่าวสาร (Broadcast)" subtitle="ส่งข้อความแจ้งเตือนถึงนักศึกษาตามเงื่อนไข" />
      <BroadcastClient weekSettings={weekSettings || []} />
    </div>
  )
}
