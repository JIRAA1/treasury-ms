import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdminProfile } from '@/lib/supabase/resolve-profile'
import { sendPaymentApproved, sendPaymentRejected } from '@/lib/line'
import { isPositiveMoney } from '@/lib/money'
import { PaymentError, paymentFailure, isUuid, checkDatabaseError } from '@/lib/payment-service'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new PaymentError('Unauthorized', 401)
    const admin = createAdminClient()
    const profile = await resolveAdminProfile(admin, user)
    if (!profile) throw new PaymentError('Forbidden', 403)
    const body = request.headers.get('content-type')?.includes('application/json')
      ? await request.json() : Object.fromEntries((await request.formData()).entries())
    const { id, action, reason, new_amount, edit_note } = body
    if (!isUuid(id) || !['approve', 'reject', 'pending', 'notify_only', 'edit_amount'].includes(action)) throw new PaymentError('คำสั่งไม่ถูกต้อง')
    if (action === 'edit_amount' && !isPositiveMoney(new_amount)) throw new PaymentError('ยอดเงินต้องมากกว่า 0 และมีทศนิยมไม่เกิน 2 หลัก')
    let unchanged = false
    if (action !== 'notify_only') {
      const { data, error } = await admin.rpc('review_regular_payment', { p_id: id, p_actor_id: profile.id, p_action: action, p_amount: new_amount ?? null, p_note: edit_note || reason || null })
      checkDatabaseError(error)
      unchanged = data.unchanged
    }
    const { data: payment, error } = await admin.from('payments').select('*, period:period_id(label)').eq('id', id).single()
    checkDatabaseError(error)
    if (!unchanged) {
      // Schedule only after the transaction committed. Preserve shared slip evidence.
      after(async () => {
        const { data: student } = await admin.from('users').select('line_user_id').eq('id', payment.user_id).single()
        const label = payment.period?.label || 'งวดชำระ'
        const message = action === 'edit_amount' ? 'เหรัญญิกแก้ไขยอดชำระเป็น ฿' + payment.amount :
          payment.status === 'approved' ? label + ' ได้รับการอนุมัติแล้ว ฿' + payment.amount :
          payment.status === 'rejected' ? label + ' ถูกปฏิเสธ: ' + (reason || 'ข้อมูลไม่ครบถ้วน') : label + ' รอตรวจสอบ'
        await admin.from('notifications').insert({ user_id: payment.user_id, title: 'อัปเดตการชำระเงิน', message, type: payment.status === 'approved' ? 'success' : 'info' })
        if (student?.line_user_id && action !== 'edit_amount') {
          if (payment.status === 'approved') await sendPaymentApproved(student.line_user_id, label, payment.amount, new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }))
          if (payment.status === 'rejected') await sendPaymentRejected(student.line_user_id, label, reason || 'ข้อมูลไม่ครบถ้วน')
        }
      })
    }
    return Response.json({ success: true, unchanged, payment, new_amount: action === 'edit_amount' ? payment.amount : undefined })
  } catch (error) { return paymentFailure(error) }
}
export const PATCH = POST
