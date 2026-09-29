import { createHash, randomUUID } from 'crypto'
import { after } from 'next/server'
import { createAdminClient } from './supabase/admin'
import { parseSlipQR } from './slip-qr'
import { verifySlipByPayload } from './thunder'
import { slipAmountMatches } from './money'
import { sendAdminAlert } from './line'

export class PaymentError extends Error {
  constructor(message: string, public status = 400, public code = 'INVALID_PAYMENT') { super(message) }
}
export const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function paymentFailure(error: unknown) {
  if (error instanceof PaymentError) return Response.json({ error: error.message, code: error.code }, { status: error.status })
  console.error('[Payment]', error)
  return Response.json({ error: 'ไม่สามารถบันทึกรายการได้ กรุณาลองใหม่' }, { status: 500 })
}
export function checkDatabaseError(error: { code?: string; message: string } | null) {
  if (!error) return
  if (error.code === '23505') throw new PaymentError('รายการนี้มีการชำระหรือใช้สลิปแล้ว กรุณาโหลดข้อมูลใหม่', 409, 'DUPLICATE_SLIP')
  if (error.code === 'P0001') throw new PaymentError('ข้อมูลหรือสถานะรายการเปลี่ยนแล้ว กรุณาโหลดข้อมูลใหม่ (' + error.message + ')', 409)
  throw new Error(error.message)
}
/** A submitted payload cannot substitute another slip: decode the actual image. */
export async function inspectSlip(form: FormData, expected: number, remark: string) {
  const file = form.get('file')
  if (!(file instanceof File) || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new PaymentError('รองรับเฉพาะไฟล์ JPG, PNG, WEBP', 415)
  if (!file.size || file.size > 5 * 1024 * 1024) throw new PaymentError('ขนาดไฟล์ต้องไม่เกิน 5MB', 413)
  const buffer = Buffer.from(await file.arrayBuffer())
  const fileHash = createHash('sha256').update(buffer).digest('hex')
  const { extractQRCode } = await import('./qr')
  const payload = await extractQRCode(buffer)
  const submitted = form.get('qr_payload')
  if (payload && submitted && payload !== submitted) throw new PaymentError('QR ในภาพไม่ตรงกับข้อมูลที่ส่ง')
  if (!payload) {
    if (form.get('manual_confirm') !== 'true') throw new PaymentError('ไม่พบ QR Code กรุณายืนยันส่งให้เหรัญญิกตรวจสอบ', 400, 'NO_QR_CODE')
    return { buffer, file, fileHash, transRef: null, verified: false, quota: false, ocr: null }
  }
  const parsed = parseSlipQR(payload)
  const result = await verifySlipByPayload(payload, { matchAccount: true, matchAmount: expected, remark })
  if (result.quota_exceeded) return { buffer, file, fileHash, transRef: parsed.isValid ? parsed.transRef : null, verified: false, quota: true, ocr: null }
  if (!result.is_valid) throw new PaymentError('ตรวจสอบสลิปไม่สำเร็จ กรุณาลองใหม่', 400, 'INVALID_SLIP')
  const hasAmount = result.amount !== null && Number.isFinite(result.amount)
  if (hasAmount && !slipAmountMatches(result.amount, expected, result.is_amount_matched)) throw new PaymentError('ยอดเงินในสลิปไม่ตรงกับยอดชำระ ฿' + expected.toFixed(2), 400, 'AMOUNT_MISMATCH')
  const verified = hasAmount && slipAmountMatches(result.amount, expected, result.is_amount_matched) && !!result.matched_account
  return { buffer, file, fileHash, transRef: result.trans_ref || (parsed.isValid ? parsed.transRef : null), verified, quota: false,
    ocr: { amount: result.amount, trans_ref: result.trans_ref, date: result.date, bank: result.bank } }
}
export async function storeSlip(slip: Awaited<ReturnType<typeof inspectSlip>>, userId: string) {
  const admin = createAdminClient()
  const path = userId + '/' + randomUUID() + '.' + slip.file.type.split('/')[1]
  const { error } = await admin.storage.from('slips').upload(path, slip.buffer, { contentType: slip.file.type })
  checkDatabaseError(error)
  return { path, url: admin.storage.from('slips').getPublicUrl(path).data.publicUrl }
}
export function notifyPaymentAdmins(title: string, details: string[]) {
  after(async () => {
    const admin = createAdminClient()
    const { data } = await admin.from('users').select('line_user_id').in('role', ['admin', 'treasurer'])
    await Promise.allSettled((data || []).filter(a => a.line_user_id).map(a => sendAdminAlert(a.line_user_id, title, details, 'info')))
  })
}
