import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  // 1. Fetch students
  const { data: students, error: studentError } = await adminClient
    .from('users')
    .select('id, fullname, student_id')
    .eq('role', 'student')
    .order('student_id', { ascending: true })

  if (studentError) return NextResponse.json({ error: 'Failed to fetch students' }, { status: 500 })

  // Find the active semester first
  const { data: activeSemester } = await adminClient
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  let periods: any[] = []
  let periodIds: string[] = []
  if (activeSemester) {
    const { data: pData, error: pError } = await adminClient
      .from('periods')
      .select('id, label, amount, period_order')
      .eq('semester_id', activeSemester.id)
      .order('period_order', { ascending: true })
    if (pError) return NextResponse.json({ error: 'Failed to fetch periods' }, { status: 500 })
    periods = pData || []
    periodIds = periods.map(p => p.id)
  }

  // 2. Fetch payments (only status and period_id, no private info)
  const { data: payments, error: paymentError } = periodIds.length > 0
    ? await adminClient
        .from('payments')
        .select('user_id, period_id, status')
        .in('status', ['approved', 'pending'])
        .in('period_id', periodIds)
    : { data: [], error: null }

  if (paymentError) return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })

  return NextResponse.json({
    students,
    payments: (payments || []).map(p => ({
      user_id: p.user_id,
      period_id: p.period_id,
      status: p.status
    })),
    weekSettings: periods.map(p => ({
      id: p.id,
      week: p.period_order,
      title: p.label,
      amount: p.amount
    }))
  })
}
