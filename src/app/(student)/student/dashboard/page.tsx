import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StudentDashboard from '@/components/payments/StudentDashboard'
import { getProfile, getActiveSemester, getSettings } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata = { title: 'แดชบอร์ด — TreasuryMS' }

export default async function StudentDashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const adminClient = createAdminClient()

  try {
    const studentId = authUser.user_metadata?.student_id || 'UNKNOWN'

    // Stage 1: fetch profile + active semester + settings in parallel (using request-scoped cache!)
    const [profile, activeSemester, settings] = await Promise.all([
      getProfile(authUser.id, studentId),
      getActiveSemester(),
      getSettings(),
    ])

    if (!profile) redirect('/bind')

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

    // Stage 2: fetch payments + expenses + credits in parallel (depends on periodIds)
    const [
      paymentsRes,
      expensesRes,
      creditsRes,
    ] = await Promise.all([
      periodIds.length > 0
        ? adminClient.from('payments').select('id, user_id, period_id, amount, status, note, created_at').eq('user_id', profile.id).in('period_id', periodIds)
        : { data: [] },
      adminClient.from('expenses').select('*, creator:created_by(fullname)').not('approved_by', 'is', null).order('created_at', { ascending: false }).limit(3),
      // pending credits for this student
      periodIds.length > 0
        ? adminClient.from('payment_credits').select('*, period_info:period_id(label)').eq('user_id', profile.id).eq('status', 'pending').in('period_id', periodIds).order('created_at', { ascending: false })
        : { data: [] },
    ])

    const payments = paymentsRes.data || []
    const expenses = expensesRes.data || []
    const credits = creditsRes.data || []

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
        payments={payments}
        periods={periods}
        expenses={expenses}
        promptPayConfig={promptPayConfig}
        pendingCredits={credits}
        tierAmounts={tierAmounts}
      />
    )
  } catch (error) {
    console.error('[DashboardPage Error]', error)
    return (
      <div className="p-8 text-center min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-red-600">เกิดข้อผิดพลาดในการโหลดแดชบอร์ด</h2>
        <p className="text-text-muted mt-2">กรุณาลองใหม่อีกครั้ง</p>
        <a href="/student/dashboard" className="mt-4 text-brand underline font-bold">ลองใหม่</a>
      </div>
    )
  }
}
