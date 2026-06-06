import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('*')
    .or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`)
    .maybeSingle()

  if (!profile || !['admin', 'treasurer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get semester details
  const { data: semester } = await adminClient
    .from('semesters')
    .select('is_active, name')
    .eq('id', id)
    .single()

  if (!semester) {
    return NextResponse.json({ error: 'ไม่พบภาคเรียนที่ต้องการลบ' }, { status: 404 })
  }

  if (semester.is_active) {
    return NextResponse.json({ error: 'ไม่สามารถลบภาคเรียนที่กำลังเปิดใช้งาน (Active) อยู่ได้' }, { status: 400 })
  }

  // Check if any period in this semester has payments or credits
  const { data: periods } = await adminClient
    .from('periods')
    .select('id')
    .eq('semester_id', id)

  if (periods && periods.length > 0) {
    const periodIds = periods.map(p => p.id)

    // Check payments
    const { data: payments } = await adminClient
      .from('payments')
      .select('id')
      .in('period_id', periodIds)
      .limit(1)

    if (payments && payments.length > 0) {
      return NextResponse.json({ error: 'ไม่สามารถลบภาคเรียนนี้ได้เนื่องจากมียอดชำระเงินของนักศึกษาค้างอยู่' }, { status: 400 })
    }

    // Check credits
    const { data: credits } = await adminClient
      .from('payment_credits')
      .select('id')
      .in('period_id', periodIds)
      .limit(1)

    if (credits && credits.length > 0) {
      return NextResponse.json({ error: 'ไม่สามารถลบภาคเรียนนี้ได้เนื่องจากมีรายการเครดิตผ่อนผันค้างอยู่' }, { status: 400 })
    }
  }

  // Delete semester (periods will cascade delete)
  const { error } = await adminClient
    .from('semesters')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAction({
    actorId: profile.id,
    action: 'semester_deleted',
    targetId: id,
    oldValue: { name: semester.name }
  })

  return NextResponse.json({ success: true, message: `ลบภาคเรียน "${semester.name}" เรียบร้อยแล้ว` })
}
