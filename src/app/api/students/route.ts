import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'treasurer'

  const { data: settings } = await adminClient.from('week_settings').select('week')
  const totalCycles = settings?.length || 0

  const { data: users } = await adminClient.from('users').select('id, fullname, student_id').eq('role', 'student')
  const { data: payments } = await adminClient.from('payments').select('user_id, status')

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
