import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveProfile, resolveAdminProfile } from '@/lib/supabase/resolve-profile'
import { NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'
import { sendLineMessage } from '@/lib/line'

// GET /api/credits — admin ดูทั้งหมด, student ดูแค่ของตัวเอง
// Query: ?status=pending|repaid|forgiven&user_id=xxx
export async function GET(req: Request) {
  const supabase = await createClient()
  const adminClient = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Use adminClient + resolveProfile() to correctly resolve role regardless of how auth user maps to DB row
  const actor = await resolveProfile(adminClient, user, 'id, role')
  if (!actor) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const filterUserId = searchParams.get('user_id')

  const isAdmin = ['admin', 'treasurer'].includes(actor['role'] as string)

  let query = adminClient
    .from('payment_credits')
    .select(`
      *,
      user:user_id ( id, fullname, student_id, tier ),
      period_info:period_id ( label, deadline )
    `)
    .order('created_at', { ascending: false })

  // Students can only see their own
  if (!isAdmin) {
    query = query.eq('user_id', actor['id'] as string)
  } else if (filterUserId) {
    query = query.eq('user_id', filterUserId)
  }

  if (status) {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ credits: data ?? [] })
}

// POST /api/credits — admin สร้าง credit ให้นักศึกษา
// Body: { user_id, period_id, amount, note? }
export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const actor = await resolveAdminProfile(adminClient, user)
  if (!actor) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json()
  const { user_id, period_id, amount, note } = body as {
    user_id: string
    period_id: string
    amount: number
    note?: string
  }

  if (!user_id || !period_id || !amount) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check period exists
  const { data: periodData } = await adminClient.from('periods').select('id, label').eq('id', period_id).single()
  if (!periodData) return NextResponse.json({ error: 'Period not found' }, { status: 404 })

  // Check student exists
  const { data: student } = await adminClient.from('users').select('id, fullname').eq('id', user_id).eq('role', 'student').single()
  if (!student) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  const { data: credit, error } = await admin
    .from('payment_credits')
    .insert({
      user_id,
      period_id,
      amount,
      note: note ?? null,
      created_by: actor['id'] as string,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'นักศึกษาคนนี้มี credit สำหรับงวดนี้อยู่แล้ว' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch student's LINE ID for notification
  const { data: studentFull } = await admin
    .from('users')
    .select('line_user_id, fullname')
    .eq('id', user_id)
    .single()

  const cycleTitle = (periodData as any)?.label || `งวดนี้`
  const notifMessage = `เหรัญญิกบันทึกยอดค้างชำระ ฿${amount.toLocaleString()} สำหรับ${cycleTitle} กรุณาชำระในรอบถัดไป`

  // In-app notification
  await admin.from('notifications').insert({
    user_id,
    title: 'มียอดค้างชำระในระบบ',
    message: notifMessage,
    type: 'warning',
  })

  // LINE notification
  if (studentFull?.line_user_id) {
    try {
      await sendLineMessage(
        studentFull.line_user_id,
        `🔔 แจ้งยอดค้างชำระ\n${notifMessage}`
      )
    } catch (e) {
      console.error('[Credits] Failed to send LINE notification:', e)
    }
  }

  await logAction({
    actorId: actor['id'] as string,
    action: 'credit_created',
    targetId: credit.id,
    newValue: { user_id, period_id, amount, note },
  })

  return NextResponse.json({ credit }, { status: 201 })
}
