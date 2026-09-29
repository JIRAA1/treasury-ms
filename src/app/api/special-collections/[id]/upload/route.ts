import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveProfile } from '@/lib/supabase/resolve-profile'
import { roundMoney } from '@/lib/money'
import { PaymentError, paymentFailure, isUuid, inspectSlip, storeSlip, checkDatabaseError, notifyPaymentAdmins } from '@/lib/payment-service'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new PaymentError('Unauthorized', 401)
    const admin = createAdminClient()
    const profile = await resolveProfile(admin, user)
    if (!profile) throw new PaymentError('Forbidden', 403)
    const form = await request.formData()
    const itemId = form.get('item_id')
    if (!isUuid(id) || !isUuid(itemId)) throw new PaymentError('รายการไม่ถูกต้อง')
    const { data: item, error } = await admin.from('special_collection_items').select('*').eq('id', itemId).eq('collection_id', id).eq('user_id', profile.id).single()
    checkDatabaseError(error)
    const { data: collection, error: collectionError } = await admin.from('special_collections').select('*').eq('id', id).single()
    checkDatabaseError(collectionError)
    if (!item || !collection?.is_active) throw new PaymentError('ไม่พบรายการที่เปิดรับชำระ', 404)
    const mode = item.payment_mode || form.get('payment_mode')
    const installments = mode === 'full' ? 1 : Number(item.payment_mode ? item.chosen_installments : form.get('chosen_installments') || collection.max_installments)
    if (!['full', 'installment'].includes(mode) || !Number.isInteger(installments) || (mode === 'installment' && (!collection.allow_installments || installments < 2 || installments > collection.max_installments))) throw new PaymentError('จำนวนงวดผ่อนไม่ถูกต้อง')
    const remaining = roundMoney(Number(item.amount) - Number(item.paid_amount))
    if (remaining <= 0) throw new PaymentError('ชำระครบแล้ว', 409)
    const payoff = mode === 'full' || form.get('is_payoff') === 'true'
    const expected = payoff ? remaining : Math.min(Math.ceil(Number(item.amount) / installments), remaining)
    const slip = await inspectSlip(form, expected, String(profile.student_id) + ': ' + collection.title)
    const stored = await storeSlip(slip, String(profile.id))
    const { data: saved, error: saveError } = await admin.rpc('save_special_slip', {
      p_user_id: profile.id, p_collection_id: id, p_item_id: itemId, p_mode: mode, p_installments: installments,
      p_slip: { amount: expected, is_payoff: payoff, slip_url: stored.url, trans_ref: slip.transRef, file_hash: slip.fileHash, verified_by_api: slip.verified },
    })
    if (saveError) { await admin.storage.from('slips').remove([stored.path]); checkDatabaseError(saveError) }
    notifyPaymentAdmins('สลิปเก็บเงินพิเศษรอตรวจสอบ', ['ผู้ส่ง: ' + profile.fullname, 'รายการ: ' + collection.title, 'ยอดเงิน: ฿' + expected])
    return Response.json({ success: true, slip: saved, ocr: slip.ocr, verified_by_api: slip.verified, quota_exceeded: slip.quota, message: 'ส่งสลิปสำเร็จ รอเหรัญญิกตรวจสอบ' })
  } catch (error) { return paymentFailure(error) }
}
