import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdminProfile } from '@/lib/supabase/resolve-profile'
import { sendPaymentApproved } from '@/lib/line'
import { PaymentError, paymentFailure, isUuid, checkDatabaseError } from '@/lib/payment-service'

export async function POST(request: Request, { params }: { params: Promise<{ slipId: string }> }) {
  try {
    const { slipId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new PaymentError('Unauthorized', 401)
    const admin = createAdminClient()
    const profile = await resolveAdminProfile(admin, user)
    if (!profile) throw new PaymentError('Forbidden', 403)
    const { action, rejection_reason } = await request.json()
    if (!isUuid(slipId) || !['approve', 'reject'].includes(action)) throw new PaymentError('คำสั่งไม่ถูกต้อง')
    if (action === 'reject' && (typeof rejection_reason !== 'string' || !rejection_reason.trim())) throw new PaymentError('กรุณาระบุเหตุผล')
    const { data, error } = await admin.rpc('review_special_slip', { p_id: slipId, p_actor_id: profile.id, p_action: action, p_reason: rejection_reason || null })
    checkDatabaseError(error)
    if (!data.unchanged) after(async () => {
      await admin.from('notifications').insert({ user_id: data.user_id, title: 'อัปเดตสลิปเงินพิเศษ',
        message: data.title + (action === 'approve' ? ' อนุมัติยอด ฿' + data.amount : ' ไม่ผ่าน: ' + rejection_reason), type: action === 'approve' ? 'success' : 'error' })
      const { data: student } = await admin.from('users').select('line_user_id').eq('id', data.user_id).single()
      if (action === 'approve' && student?.line_user_id) await sendPaymentApproved(student.line_user_id, data.title, data.amount, new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }))
    })
    return Response.json({ success: true, ...data })
  } catch (error) { return paymentFailure(error) }
}
