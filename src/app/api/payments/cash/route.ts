import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdminProfile } from '@/lib/supabase/resolve-profile'
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
    const body = await request.json()
    if (!isUuid(body.user_id) || !isUuid(body.period_id) || !isPositiveMoney(body.amount)) throw new PaymentError('รหัสรายการหรือยอดเงินไม่ถูกต้อง')
    if (body.verified_at && (!Number.isFinite(Date.parse(body.verified_at)) || Date.parse(body.verified_at) > Date.now())) throw new PaymentError('วันที่รับเงินไม่ถูกต้อง')
    const { data, error } = await admin.rpc('save_regular_payments', {
      p_user_id: body.user_id, p_actor_id: profile.id,
      p_rows: [{ period_id: body.period_id, amount: body.amount, status: 'approved', verified_at: body.verified_at || new Date().toISOString(), verified_by_api: false, note: body.note || 'ชำระด้วยเงินสด (บันทึกโดยเหรัญญิก)' }],
    })
    checkDatabaseError(error)
    return Response.json({ success: true, payment: data[0] })
  } catch (error) { return paymentFailure(error) }
}
