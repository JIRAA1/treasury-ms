import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await createAdminClient().from('users').select('role').eq('student_id', user.user_metadata?.student_id || user.email?.split('@')[0]).single()
  if (!profile || !['admin', 'treasurer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden — admin/treasurer only' }, { status: 403 })
  }

  const body = await request.json() as {
    user_id: string
    week: number
    amount: number
    note?: string
    verified_at?: string
  }

  if (!body.user_id || !body.week || !body.amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Check if payment already exists for this week
  const { data: existing } = await adminClient
    .from('payments')
    .select('id, status')
    .eq('user_id', body.user_id)
    .eq('week', body.week)
    .maybeSingle()

  if (existing && existing.status === 'approved') {
    return NextResponse.json({ error: 'งวดนี้ชำระแล้ว ไม่สามารถบันทึกซ้ำได้' }, { status: 409 })
  }

  const paymentData = {
    user_id: body.user_id,
    week: body.week,
    amount: body.amount,
    status: 'approved' as const,
    note: body.note || 'ชำระด้วยเงินสด (บันทึกโดยเหรัญญิก)',
    verified_at: body.verified_at || new Date().toISOString(),
    trans_ref: null,
    slip_url: null,
  }

  let payment
  if (existing) {
    // Update existing rejected/pending payment
    const { data, error } = await adminClient
      .from('payments')
      .update(paymentData)
      .eq('id', existing.id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    payment = data
  } else {
    // Insert new cash payment
    const { data, error } = await adminClient
      .from('payments')
      .insert(paymentData)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    payment = data
  }

  await logAction({
    actorId: user.id,
    action: 'payment_approved',
    targetId: payment.id,
    newValue: { ...paymentData, method: 'cash', recorded_by: user.id },
  })

  return NextResponse.json({ success: true, payment })
}
