import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StudentDashboard from '@/components/payments/StudentDashboard'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata = { title: 'แดชบอร์ด — TreasuryMS' }

export default async function StudentDashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const adminClient = createAdminClient()

  const { data: profile } = await adminClient
    .from('users')
    .select('*')
    .or(`id.eq.${authUser.id},student_id.eq.${authUser.user_metadata.student_id}`)
    .maybeSingle()

  if (!profile) redirect('/bind')

  const [
    { data: payments },
    { data: weekSettings },
    { data: expenses },
    { data: settings },
    { data: credits },
  ] = await Promise.all([
    adminClient.from('payments').select('*').eq('user_id', profile.id).order('week', { ascending: true }),
    adminClient.from('week_settings').select('*').order('week', { ascending: true }),
    adminClient.from('expenses').select('*, creator:created_by(fullname)').not('approved_by', 'is', null).order('created_at', { ascending: false }).limit(3),
    adminClient.from('system_settings').select('*'),
    // pending credits for this student
    adminClient.from('payment_credits').select('*, week_info:week(title)').eq('user_id', profile.id).eq('status', 'pending').order('created_at', { ascending: false }),
  ])

  const promptPayConfig = {
    promptpay_id: settings?.find((s: { key: string; value: string }) => s.key === 'promptpay_id')?.value || '',
    promptpay_name: settings?.find((s: { key: string; value: string }) => s.key === 'promptpay_name')?.value || '',
  }

  return (
    <StudentDashboard
      profile={profile}
      payments={payments || []}
      weekSettings={weekSettings || []}
      expenses={expenses || []}
      promptPayConfig={promptPayConfig}
      pendingCredits={credits || []}
    />
  )
}
