import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import BroadcastClient from './BroadcastClient'

export const metadata = { title: 'ส่งข่าวสาร (Broadcast) — TreasuryMS' }

export default async function AdminBroadcastPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
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
