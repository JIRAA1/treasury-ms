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

  // 2. Fetch payments (only status and week, no private info)
  const { data: payments, error: paymentError } = await adminClient
    .from('payments')
    .select('user_id, week, status')
    .in('status', ['approved', 'pending'])

  if (paymentError) return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })

  // 3. Fetch week settings
  const { data: weekSettings, error: weekError } = await adminClient
    .from('week_settings')
    .select('week, title, amount')
    .order('week', { ascending: true })

  if (weekError) return NextResponse.json({ error: 'Failed to fetch week settings' }, { status: 500 })

  return NextResponse.json({
    students,
    payments,
    weekSettings
  })
}
