import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdminProfile } from '@/lib/supabase/resolve-profile'
import { PaymentError, paymentFailure, checkDatabaseError } from '@/lib/payment-service'
import { readAll } from '@/lib/read-all'

async function authorize() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new PaymentError('Unauthorized', 401)
  const admin = createAdminClient()
  const profile = await resolveAdminProfile(admin, user)
  if (!profile) throw new PaymentError('Forbidden', 403)
  return { admin, profile }
}

export async function GET() {
  try {
    const { admin } = await authorize()
    const [incomes, expenses, semesters] = await Promise.all([
      readAll((from, to) => admin.from('incomes').select('id,title,amount,created_at,approved_by').is('semester_id', null).order('id').range(from, to)),
      readAll((from, to) => admin.from('expenses').select('id,title,amount,created_at,approved_by').is('semester_id', null).order('id').range(from, to)),
      admin.from('semesters').select('id,name,is_active').order('created_at', { ascending: false }),
    ])
    checkDatabaseError(semesters.error)
    return Response.json({ records: [
      ...incomes.data.map(row => ({ ...row, type: 'income' })),
      ...expenses.data.map(row => ({ ...row, type: 'expense' })),
    ].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '') || a.id.localeCompare(b.id)), semesters: semesters.data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return paymentFailure(error) }
}

const schema = z.object({
  semester_id: z.string().uuid(),
  records: z.array(z.object({ id: z.string().uuid(), type: z.enum(['income', 'expense']) })).min(1).max(200),
})

export async function PATCH(request: Request) {
  try {
    const { admin, profile } = await authorize()
    const input = schema.safeParse(await request.json().catch(() => null))
    if (!input.success) throw new PaymentError('กรุณาเลือกเทอมและรายการ 1–200 รายการ')
    const { data, error } = await admin.rpc('assign_accounting_semester', {
      p_actor_id: profile.id, p_semester_id: input.data.semester_id, p_records: input.data.records,
    })
    const messages: Record<string, string> = {
      SEMESTER_NOT_FOUND: 'ไม่พบเทอมที่เลือก กรุณาโหลดรายการใหม่',
      RECORD_NOT_FOUND: 'บางรายการถูกลบแล้ว กรุณาโหลดรายการใหม่',
      SEMESTER_ALREADY_ASSIGNED: 'บางรายการถูกจัดเข้าเทอมอื่นแล้ว กรุณาโหลดรายการใหม่ก่อนบันทึก',
      INVALID_RECORDS: 'รายการที่เลือกไม่ถูกต้อง กรุณาโหลดรายการใหม่',
    }
    if (error && messages[error.message]) throw new PaymentError(messages[error.message], 409)
    if (error?.code === 'PGRST202') throw new PaymentError('ระบบจัดเทอมยังไม่พร้อม กรุณาให้ผู้ดูแลอัปเดตฐานข้อมูล', 503)
    checkDatabaseError(error)
    return Response.json(data)
  } catch (error) { return paymentFailure(error) }
}
