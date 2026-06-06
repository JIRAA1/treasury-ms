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

  const studentId = authUser.user_metadata?.student_id || 'UNKNOWN'

  const { data: profile } = await adminClient
    .from('users')
    .select('*')
    .or(`id.eq.${authUser.id},student_id.eq.${studentId}`)
    .maybeSingle()

  if (!profile) redirect('/bind')

  // Find active semester
  const { data: activeSemester } = await adminClient
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  let periods: any[] = []
  let periodIds: string[] = []
  if (activeSemester) {
    const { data: pData } = await adminClient
      .from('periods')
      .select('*')
      .eq('semester_id', activeSemester.id)
      .order('period_order', { ascending: true })
    periods = pData || []
    periodIds = periods.map(p => p.id)
  }

  const [
    { data: payments },
    { data: expenses },
    { data: settings },
    { data: credits },
  ] = await Promise.all([
    periodIds.length > 0
      ? adminClient.from('payments').select('*').eq('user_id', profile.id).in('period_id', periodIds)
      : { data: [] },
    adminClient.from('expenses').select('*, creator:created_by(fullname)').not('approved_by', 'is', null).order('created_at', { ascending: false }).limit(3),
    adminClient.from('system_settings').select('*'),
    // pending credits for this student
    periodIds.length > 0
      ? adminClient.from('payment_credits').select('*, period_info:period_id(label)').eq('user_id', profile.id).eq('status', 'pending').in('period_id', periodIds).order('created_at', { ascending: false })
      : { data: [] },
  ])

  const promptPayConfig = {
    promptpay_id: settings?.find((s: { key: string; value: string }) => s.key === 'promptpay_id')?.value || '',
    promptpay_name: settings?.find((s: { key: string; value: string }) => s.key === 'promptpay_name')?.value || '',
  }

  const tierAmounts = {
    A: parseFloat(settings?.find((s: any) => s.key === 'tier_a_amount')?.value || '60'),
    B: parseFloat(settings?.find((s: any) => s.key === 'tier_b_amount')?.value || '50'),
    C: parseFloat(settings?.find((s: any) => s.key === 'tier_c_amount')?.value || '30'),
  }

  return (
    <StudentDashboard
      profile={profile}
      payments={payments || []}
      periods={periods || []}
      expenses={expenses || []}
      promptPayConfig={promptPayConfig}
      pendingCredits={credits || []}
      tierAmounts={tierAmounts}
    />
  )
}
