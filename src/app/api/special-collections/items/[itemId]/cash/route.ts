import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdminProfile } from '@/lib/supabase/resolve-profile'
import { PaymentError, paymentFailure, isUuid, checkDatabaseError } from '@/lib/payment-service'
import { isPositiveMoney } from '@/lib/money'

const schema = z.object({
  request_id: z.string().uuid(), amount: z.number().refine(isPositiveMoney),
  payment_mode: z.enum(['full', 'installment']), chosen_installments: z.number().int().min(1).max(2147483647),
  expected_paid: z.number().finite().min(0), note: z.string().trim().max(1000), received: z.literal(true),
})

export async function POST(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new PaymentError('Unauthorized', 401)
    const admin = createAdminClient()
    const profile = await resolveAdminProfile(admin, user)
    if (!profile) throw new PaymentError('Forbidden', 403)
    const { itemId } = await params
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!isUuid(itemId) || !parsed.success) throw new PaymentError('กรุณาตรวจสอบยอดเงินและยืนยันว่าได้รับเงินสดแล้ว')
    const input = parsed.data
    const { data, error } = await admin.rpc('record_special_cash', {
      p_id: itemId, p_actor_id: profile.id, p_request_id: input.request_id, p_amount: input.amount,
      p_mode: input.payment_mode, p_installments: input.chosen_installments,
      p_expected_paid: input.expected_paid, p_note: input.note || null,
    })
    const messages: Record<string, string> = {
      STALE_DATA: 'ยอดชำระเปลี่ยนแล้ว กรุณาปิดหน้าต่างและรีเฟรชก่อนรับเงินใหม่',
      PENDING_SLIP: 'มีสลิปรอตรวจสอบ กรุณาจัดการสลิปเดิมก่อนรับเงินสดเพื่อป้องกันยอดซ้ำ',
      FULL_AMOUNT_REQUIRED: 'จ่ายเต็มต้องรับยอดคงเหลือทั้งหมด หากรับบางส่วนให้เลือกผ่อนชำระ',
      OVERPAYMENT: 'ยอดรับเงินสดเกินยอดคงเหลือ', ALREADY_PAID: 'รายการนี้ชำระครบแล้ว',
      COLLECTION_CLOSED: 'รายการนี้ปิดรับชำระแล้ว', INVALID_INSTALLMENTS: 'จำนวนงวดไม่ตรงกับเงื่อนไขการผ่อน',
    }
    if (error && messages[error.message]) throw new PaymentError(messages[error.message], 409)
    if (error?.code === 'PGRST202') throw new PaymentError('ระบบรับเงินสดยังไม่พร้อม กรุณาให้ผู้ดูแลอัปเดตฐานข้อมูล', 503)
    checkDatabaseError(error)
    return Response.json(data)
  } catch (error) { return paymentFailure(error) }
}
