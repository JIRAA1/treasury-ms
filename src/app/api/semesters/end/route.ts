import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

/**
 * POST /api/semesters/end
 * Body: { semester_id: string }
 *
 * ขั้นตอน:
 * 1. ตรวจสอบสิทธิ์ admin เท่านั้น
 * 2. ดึงข้อมูลสรุปยอดรวมของเทอมนั้น
 * 3. Set is_active = false
 * 4. บันทึก snapshot ใน audit_log เป็นหลักฐาน
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  // Role check — admin only
  const { data: actor } = await adminClient
    .from('users')
    .select('id, role')
    .eq('id', user.id)
    .maybeSingle()

  if (!actor || actor.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden — admin only' }, { status: 403 })
  }

  const body = await request.json() as { semester_id: string }
  const { semester_id } = body

  if (!semester_id) {
    return NextResponse.json({ error: 'semester_id is required' }, { status: 400 })
  }

  // Fetch semester
  const { data: semester } = await adminClient
    .from('semesters')
    .select('*')
    .eq('id', semester_id)
    .single()

  if (!semester) {
    return NextResponse.json({ error: 'Semester not found' }, { status: 404 })
  }

  if (!semester.is_active) {
    return NextResponse.json({ error: 'เทอมนี้ปิดแล้ว (is_active = false)' }, { status: 409 })
  }

  // Fetch all periods in this semester
  const { data: periods } = await adminClient
    .from('periods')
    .select('id, label, period_order, amount')
    .eq('semester_id', semester_id)
    .order('period_order', { ascending: true })

  const periodIds = (periods ?? []).map(p => p.id)

  // Calculate final balance snapshot
  const { data: approvedPayments } = await adminClient
    .from('payments')
    .select('amount')
    .in('period_id', periodIds.length > 0 ? periodIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('status', 'approved')

  const totalCollected = approvedPayments?.reduce((s, p) => s + (p.amount || 0), 0) ?? 0

  // Count pending credits (outstanding debt)
  const { count: pendingCreditCount } = await adminClient
    .from('payment_credits')
    .select('*', { count: 'exact', head: true })
    .in('period_id', periodIds.length > 0 ? periodIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('status', 'pending')

  // Student counts
  const { count: totalStudents } = await adminClient
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')

  const { count: fullyPaidCount } = await adminClient
    .from('payments')
    .select('user_id', { count: 'exact', head: true })
    .in('period_id', periodIds.length > 0 ? periodIds : ['00000000-0000-0000-0000-000000000000'])
    .eq('status', 'approved')

  // ── Close the semester ──────────────────────────────────
  const { error: updateError } = await adminClient
    .from('semesters')
    .update({ is_active: false })
    .eq('id', semester_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // ── Record audit snapshot ───────────────────────────────
  const snapshotData = {
    semester_id,
    semester_name: semester.name,
    closed_at: new Date().toISOString(),
    total_collected: totalCollected,
    total_periods: periods?.length ?? 0,
    total_students: totalStudents ?? 0,
    fully_paid_payments: fullyPaidCount ?? 0,
    pending_credits_outstanding: pendingCreditCount ?? 0,
  }

  await logAction(supabase, {
    actorId: actor.id,
    action: 'semester_closed',
    targetId: semester_id,
    oldValue: { is_active: true },
    newValue: snapshotData,
  })

  return NextResponse.json({
    success: true,
    snapshot: snapshotData,
    message: `ปิดเทอม "${semester.name}" เรียบร้อยแล้ว ยอดรวมที่เก็บได้ ${totalCollected.toLocaleString()} บาท`,
  })
}
