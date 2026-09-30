import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdminProfile } from '@/lib/supabase/resolve-profile'
import { PaymentError, paymentFailure, isUuid, checkDatabaseError } from '@/lib/payment-service'
import { isPositiveMoney } from '@/lib/money'

const slipSchema = z.object({ id: z.string().uuid(), amount: z.number().refine(isPositiveMoney), status: z.enum(['pending', 'approved', 'rejected']) })
const schema = z.object({
  payment_mode: z.enum(['full', 'installment']), chosen_installments: z.number().int().min(1).max(2147483647),
  slips: z.array(slipSchema), reason: z.string().trim().min(1).max(1000),
  expected: z.object({ payment_mode: z.enum(['full', 'installment']).nullable(), chosen_installments: z.number().nullable(),
    amount: z.number(), paid_amount: z.number(), slips: z.array(slipSchema) }),
})

export async function PATCH(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new PaymentError('Unauthorized', 401)
    const admin = createAdminClient()
    const profile = await resolveAdminProfile(admin, user)
    if (!profile) throw new PaymentError('Forbidden', 403)
    const { itemId } = await params
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!isUuid(itemId) || !parsed.success) throw new PaymentError('กรุณาตรวจสอบยอดเงิน รูปแบบการจ่าย และเหตุผลการแก้ไข')
    const input = parsed.data
    const { data, error } = await admin.rpc('correct_special_item', {
      p_id: itemId, p_actor_id: profile.id, p_mode: input.payment_mode, p_installments: input.chosen_installments,
      p_slips: input.slips, p_expected: input.expected, p_reason: input.reason,
    })
    if (error?.message === 'STALE_DATA') throw new PaymentError('รายการเปลี่ยนแปลงแล้ว กรุณาปิดหน้าต่างและรีเฟรชก่อนแก้ไขใหม่', 409)
    if (error?.message === 'OVERPAYMENT') throw new PaymentError('ยอดสลิปที่อนุมัติรวมกันเกินยอดที่ต้องชำระ')
    if (error?.message === 'MULTIPLE_PENDING') throw new PaymentError('ให้มีสลิปรอตรวจสอบได้ครั้งละหนึ่งรายการ')
    checkDatabaseError(error)
    return Response.json(data)
  } catch (error) { return paymentFailure(error) }
}
