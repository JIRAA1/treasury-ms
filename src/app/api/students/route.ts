import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await createAdminClient().from('users').select('role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'treasurer'

  const { data: activeSemester } = await adminClient
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  let totalCycles = 0
  let periodIds: string[] = []
  if (activeSemester) {
    const { data: settings } = await adminClient
      .from('periods')
      .select('id')
      .eq('semester_id', activeSemester.id)
    totalCycles = settings?.length || 0
    periodIds = (settings || []).map(p => p.id)
  }

  const { data: users } = await adminClient.from('users').select('id, fullname, student_id, tier').eq('role', 'student')
  
  // Only query payments matching the active semester's periods
  const { data: payments } = periodIds.length > 0
    ? await adminClient.from('payments').select('user_id, status, period_id').in('period_id', periodIds)
    : { data: [] }

  const studentData = (users || []).map((u) => {
    const userPayments = payments?.filter((p) => p.user_id === u.id && p.status === 'approved') || []
    const pendingPayments = payments?.filter((p) => p.user_id === u.id && p.status === 'pending') || []
    
    return {
      ...u,
      weeksPaid: userPayments.length,
      weeksPending: pendingPayments.length,
      totalCycles
    }
  })

  return NextResponse.json({ students: studentData })
}
