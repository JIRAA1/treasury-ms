import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendPaymentApproved } from '@/lib/line'
import { logAction } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slipId: string }> }
) {
  const { slipId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  // Verify Admin role
  const { data: adminProfile } = await adminClient
    .from('users')
    .select('id, fullname, role')
    .or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'}`)
    .maybeSingle()

  if (!adminProfile || (adminProfile.role !== 'admin' && adminProfile.role !== 'treasurer')) {
    return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 })
  }

  const body = await request.json()
  const { action, rejection_reason } = body // 'approve' or 'reject'

  if (action !== 'approve' && action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action. Must be approve or reject' }, { status: 400 })
  }

  // Load slip with item, collection, and student user
  const { data: slip } = await adminClient
    .from('special_collection_slips')
    .select(`
      *,
      item:special_collection_items(
        *,
        user:users(*),
        collection:special_collections(*)
      )
    `)
    .eq('id', slipId)
    .single()

  if (!slip || !slip.item) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลสลิปนี้' }, { status: 404 })
  }

  const item = slip.item
  const student = item.user
  const collection = item.collection

  if (action === 'approve') {
    // 1. Update slip status
    await adminClient
      .from('special_collection_slips')
      .update({
        status: 'approved',
        verified_at: new Date().toISOString(),
        verified_by: adminProfile.id,
      })
      .eq('id', slip.id)

    // 2. Calculate new paid amount & determine item status
    const currentPaid = parseFloat(item.paid_amount || 0)
    const slipAmount = parseFloat(slip.amount || 0)
    const totalItemAmount = parseFloat(item.amount || 0)

    const newPaidAmount = currentPaid + slipAmount
    const isCompleted = newPaidAmount >= totalItemAmount || slip.is_payoff

    const newItemStatus = isCompleted ? 'approved' : 'partial'
    const finalPaidAmount = isCompleted ? Math.max(newPaidAmount, totalItemAmount) : newPaidAmount

    // 3. Update item status
    await adminClient
      .from('special_collection_items')
      .update({
        status: newItemStatus,
        paid_amount: finalPaidAmount,
      })
      .eq('id', item.id)

    // 4. Record in Treasury Income
    await adminClient
      .from('incomes')
      .insert({
        title: `การเก็บเงินพิเศษ: ${collection.title} (${student?.fullname || 'นักศึกษา'})`,
        description: `ชำระเงินสลิปพิเศษ ${slip.is_payoff ? 'ปิดยอดล่วงหน้า' : `งวดที่ ${slip.installment_no}`}`,
        amount: slipAmount,
        created_by: adminProfile.id,
        approved_by: adminProfile.id,
        source: 'special_collection',
      })

    // 5. Audit Log
    await logAction({
      actorId: adminProfile.id,
      action: 'special_slip_approved',
      targetId: slip.id,
      newValue: {
        collection_title: collection.title,
        student_name: student?.fullname,
        amount: slipAmount,
        item_status: newItemStatus,
      }
    })

    // 6. Notify Student
    if (student?.id) {
      await adminClient.from('notifications').insert({
        user_id: student.id,
        title: 'สลิปการเก็บเงินพิเศษได้รับการอนุมัติแล้ว',
        message: `รายการ "${collection.title}" ยอด ฿${slipAmount.toLocaleString()} ได้รับการอนุมัติแล้ว (${isCompleted ? 'ชำระครบถ้วนเรียบร้อย' : `ผ่อนแล้ว ฿${finalPaidAmount.toLocaleString()}/฿${totalItemAmount.toLocaleString()}`})`,
        type: 'success',
      })

      if (student.line_user_id) {
        try {
          const thaiDate = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })
          await sendPaymentApproved(
            student.line_user_id,
            `${collection.title} (พิเศษ)`,
            slipAmount,
            thaiDate
          )
        } catch (e) {
          console.error('[Verify Special Slip] Failed to send LINE message:', e)
        }
      }
    }

    return NextResponse.json({
      success: true,
      action: 'approved',
      item_status: newItemStatus,
      message: 'อนุมัติสลิปเรียบร้อยแล้ว'
    })
  } else {
    // REJECT ACTION
    if (!rejection_reason) {
      return NextResponse.json({ error: 'กรุณาระบุเหตุผลในการปฏิเสธสลิป' }, { status: 400 })
    }

    // 1. Update slip status
    await adminClient
      .from('special_collection_slips')
      .update({
        status: 'rejected',
        rejection_reason,
        verified_at: new Date().toISOString(),
        verified_by: adminProfile.id,
      })
      .eq('id', slip.id)

    // 2. Re-evaluate item status based on current paid_amount
    const currentPaid = parseFloat(item.paid_amount || 0)
    const newItemStatus = currentPaid > 0 ? 'partial' : 'unpaid'

    await adminClient
      .from('special_collection_items')
      .update({ status: newItemStatus })
      .eq('id', item.id)

    // 3. Audit log
    await logAction({
      actorId: adminProfile.id,
      action: 'special_slip_rejected',
      targetId: slip.id,
      newValue: {
        collection_title: collection.title,
        student_name: student?.fullname,
        reason: rejection_reason,
      }
    })

    // 4. Notify Student
    if (student?.id) {
      await adminClient.from('notifications').insert({
        user_id: student.id,
        title: 'สลิปการเก็บเงินพิเศษถูกปฏิเสธ',
        message: `รายการ "${collection.title}" ถูกปฏิเสธสลิป เนื่องจาก: ${rejection_reason} กรุณาแนบสลิปใหม่อีกครั้ง`,
        type: 'error',
      })
    }

    return NextResponse.json({
      success: true,
      action: 'rejected',
      item_status: newItemStatus,
      message: 'ปฏิเสธสลิปเรียบร้อยแล้ว'
    })
  }
}
