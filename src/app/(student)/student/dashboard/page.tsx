import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import StudentDashboard from '@/components/payments/StudentDashboard'

// Force the page to always fetch fresh data (no caching)
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = { title: 'แดชบอร์ด — TreasuryMS' }

export default async function StudentDashboardPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const adminClient = createAdminClient()
  
  // 1. Fetch Profile
  const { data: profile } = await adminClient
    .from('users')
    .select('*')
    .or(`id.eq.${authUser.id},student_id.eq.${authUser.user_metadata.student_id}`)
    .maybeSingle()

  if (!profile) redirect('/bind')

  // 2. Fetch Payments
  const { data: payments } = await adminClient
    .from('payments')
    .select('*')
    .eq('user_id', profile.id)
    .order('week', { ascending: true })

  // 3. Fetch Week Settings
  const { data: weekSettings } = await adminClient
    .from('week_settings')
    .select('*')
    .order('week', { ascending: true })
  
  // 4. Fetch Expenses
  const { data: expenses } = await adminClient
    .from('expenses')
    .select('*, creator:created_by(fullname)')
    .not('approved_by', 'is', null)
    .order('created_at', { ascending: false })
    .limit(3)

  // 5. Fetch PromptPay Config
  const { data: settings } = await adminClient.from('system_settings').select('*')
  const promptPayConfig = {
    promptpay_id: settings?.find(s => s.key === 'promptpay_id')?.value || '',
    promptpay_name: settings?.find(s => s.key === 'promptpay_name')?.value || ''
  }

  return (
    <StudentDashboard 
      profile={profile}
      payments={payments || []}
      weekSettings={weekSettings || []}
      expenses={expenses || []}
      promptPayConfig={promptPayConfig}
    />
  )
}
