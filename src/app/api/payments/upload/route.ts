import { createHash } from 'crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveProfile } from '@/lib/supabase/resolve-profile'
import { calculateLateFine } from '@/lib/fine'
import { tierBaseAmount, sumMoney, isPositiveMoney } from '@/lib/money'
import { PaymentError, paymentFailure, isUuid, inspectSlip, storeSlip, checkDatabaseError, notifyPaymentAdmins } from '@/lib/payment-service'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new PaymentError('Unauthorized', 401)
    const admin = createAdminClient()
    const profile = await resolveProfile(admin, user)
    if (!profile) throw new PaymentError('ไม่พบข้อมูลผู้ใช้', 403)
    const form = await request.formData()
    const mainId = form.get('period_id')
    if (!isUuid(mainId)) throw new PaymentError('งวดไม่ถูกต้อง')
    let extra: unknown = []
    if (form.get('pay_accumulated') === 'true') {
      try { extra = JSON.parse(String(form.get('accumulated_period_ids') || '[]')) } catch { throw new PaymentError('รายการงวดไม่ถูกต้อง') }
    }
    if (!Array.isArray(extra) || extra.length > 99 || !extra.every(isUuid)) throw new PaymentError('รายการงวดไม่ถูกต้อง')
    const ids = [...new Set([mainId, ...extra as string[]])]
    const userId = String(profile.id)
    const [periodsResult, existingResult, creditsResult, settingsResult] = await Promise.all([
      admin.from('periods').select('*').in('id', ids),
      admin.from('payments').select('period_id,status').eq('user_id', userId).in('period_id', ids).neq('status', 'rejected'),
      admin.from('payment_credits').select('period_id').eq('user_id', userId).in('period_id', ids).eq('status', 'pending'),
      admin.from('system_settings').select('key,value').in('key', ['tier_a_amount', 'tier_b_amount', 'tier_c_amount']),
    ])
    for (const result of [periodsResult, existingResult, creditsResult, settingsResult]) checkDatabaseError(result.error)
    const periods = periodsResult.data || []
    if (periods.length !== ids.length || new Set(periods.map(p => p.semester_id)).size !== 1) throw new PaymentError('ต้องเลือกงวดที่มีอยู่ในเทอมเดียวกัน')
    if (existingResult.data?.length) throw new PaymentError('มีงวดที่ชำระแล้วหรือรอตรวจ กรุณาโหลดข้อมูลใหม่', 409)
    const now = new Date()
    if (periods.some(p => p.open_at && new Date(p.open_at) > now)) throw new PaymentError('มีงวดที่ยังไม่เปิดรับชำระ', 403)
    const settings = Object.fromEntries((settingsResult.data || []).map(s => [s.key, Number(s.value)]))
    const standard = settings.tier_b_amount ?? 50
    const rates: Record<string, number> = { A: settings.tier_a_amount ?? 60, B: standard, C: settings.tier_c_amount ?? 30 }
    const tier = rates[String(profile.tier)] ?? standard
    const allocations = ids.map(id => {
      const period = periods.find(p => p.id === id)!
      const amount = sumMoney([tierBaseAmount(period.amount, tier, standard), calculateLateFine(period, now, !!creditsResult.data?.some(c => c.period_id === id))])
      if (!isPositiveMoney(amount)) throw new PaymentError('ยอดเรียกเก็บไม่ถูกต้อง กรุณาติดต่อเหรัญญิก')
      return { id, label: period.label, amount }
    })
    const total = sumMoney(allocations.map(a => a.amount))
    const slip = await inspectSlip(form, total, String(profile.student_id) + ': ' + allocations.map(a => a.label).join(', '))
    const stored = await storeSlip(slip, userId)
    const rows = allocations.map((a, index) => ({
      period_id: a.id, amount: a.amount,
      status: slip.verified && creditsResult.data?.some(c => c.period_id === a.id) ? 'approved' : 'pending', slip_url: stored.url,
      trans_ref: slip.transRef ? (index === 0 ? slip.transRef : slip.transRef + '_carry_' + a.id) : null,
      file_hash: index === 0 ? slip.fileHash : createHash('sha256').update(slip.fileHash + ':' + a.id).digest('hex'),
      verified_by_api: slip.verified, note: index === 0 ? null : 'accumulated_with:' + mainId,
    }))
    const { data: payments, error } = await admin.rpc('save_regular_payments', { p_user_id: userId, p_rows: rows })
    if (error) { await admin.storage.from('slips').remove([stored.path]); checkDatabaseError(error) }
    notifyPaymentAdmins('สลิปรอตรวจสอบ', ['ผู้ส่ง: ' + profile.fullname, 'ยอดรวม: ฿' + total, 'จำนวนงวด: ' + rows.length])
    return Response.json({ success: true, payment: payments[0], accumulated: allocations.slice(1).map(a => ({ period_id: a.id, label: a.label, amount: a.amount })),
      ocr: slip.ocr, quota_exceeded: slip.quota, message: 'บันทึกครบทุกงวดแล้ว กรุณาตรวจสถานะการชำระของแต่ละงวด' })
  } catch (error) { return paymentFailure(error) }
}
