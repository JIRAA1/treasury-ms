import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { transRef } = await request.json()
    if (!transRef) {
      return NextResponse.json({ error: 'Missing transRef' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: profile } = await adminClient.from('users').select('id').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()

    // ตรวจสอบสลิปซ้ำจาก trans_ref ตรง หรือ trans_ref ที่ต่อด้วย _carry_ suffix
    // (กรณีสลิปนั้นเคยถูกใช้ในการชำระเงินทบงวดแล้ว)
    const { data: existingRows, error } = await adminClient
      .from('payments')
      .select('id, period_id, status, user_id, trans_ref')
      .or(`trans_ref.eq.${transRef},trans_ref.like.${transRef}_carry_%`)
      .neq('status', 'rejected')
      .limit(1)

    if (error) {
      console.error('Error checking duplicate transRef:', error)
      return NextResponse.json({ error: 'Database check failed' }, { status: 500 })
    }

    const existing = existingRows?.[0] ?? null

    if (existing) {
      const isOwnSlip = existing.user_id === (profile?.id || user.id)
      return NextResponse.json({
        exists: true,
        isOwnSlip,
        payment: {
          id: existing.id,
          period_id: existing.period_id,
          status: existing.status
        }
      })
    }

    return NextResponse.json({ exists: false })
  } catch (error: any) {
    console.error('API Check Duplicate Error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
