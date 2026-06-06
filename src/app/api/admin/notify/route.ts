import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendBulkReminder, sendLineMessage } from '@/lib/line'
import { logAction } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await createAdminClient().from('users').select('id, role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  if (!profile || !['admin', 'treasurer'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as {
    type: 'reminder' | 'custom'
    period_id?: string
    message?: string
    target: 'all_unpaid' | string[]
  }

  let sent = 0
  let failed = 0

  if (body.type === 'reminder') {
    // 1. Get all students & system settings
    const [{ data: students, error: sError }, { data: settings }] = await Promise.all([
      adminClient
        .from('users')
        .select('id, fullname, student_id, line_user_id, tier')
        .eq('role', 'student'),
      adminClient.from('system_settings').select('*')
    ])
    
    if (sError) throw sError

    const tierAmounts = {
      A: parseFloat(settings?.find((s: any) => s.key === 'tier_a_amount')?.value || '60'),
      B: parseFloat(settings?.find((s: any) => s.key === 'tier_b_amount')?.value || '50'),
      C: parseFloat(settings?.find((s: any) => s.key === 'tier_c_amount')?.value || '30'),
    }

    // 2. Determine which cycle to target
    let period_id = body.period_id
    let cycleSetting = null

    if (!period_id) {
      // Find the active semester
      const { data: activeSemester } = await adminClient
        .from('semesters')
        .select('id')
        .eq('is_active', true)
        .maybeSingle()

      if (!activeSemester) {
        return NextResponse.json({ error: 'ไม่พบภาคเรียนที่ใช้งานอยู่ (Active Semester) กรุณาเปิดใช้งานก่อน' }, { status: 400 })
      }

      // Get all configured periods for this semester, latest first
      const { data: allCycles } = await adminClient
        .from('periods')
        .select('*')
        .eq('semester_id', activeSemester.id)
        .order('period_order', { ascending: false })

      if (!allCycles || allCycles.length === 0) {
        return NextResponse.json({ error: 'กรุณาเพิ่มงวดการชำระเงินในหน้าตั้งค่าก่อน' }, { status: 400 })
      }

      // Find the most recent period that still has unpaid students
      for (const cycle of allCycles) {
        const { data: paid } = await adminClient
          .from('payments')
          .select('user_id')
          .eq('period_id', cycle.id)
          .in('status', ['approved', 'pending'])
        
        const paidIds = new Set(paid?.map(p => p.user_id) || [])
        const unpaid = (students ?? []).filter(s => !paidIds.has(s.id))
        
        if (unpaid.length > 0) {
          period_id = cycle.id
          cycleSetting = cycle
          break
        }
      }

      // If everyone is caught up, use the absolute latest period
      if (!period_id) {
        period_id = allCycles[0].id
        cycleSetting = allCycles[0]
      }
    } else {
      const { data: s } = await adminClient.from('periods').select('*').eq('id', period_id).single()
      cycleSetting = s
    }

    if (!cycleSetting) return NextResponse.json({ error: 'ไม่พบข้อมูลงวดการชำระที่ต้องการ' }, { status: 400 })

    const cycleTitle = cycleSetting.label || `งวดที่ ${cycleSetting.period_order}`
    const amount = cycleSetting.amount || 100
    const deadline = new Date(cycleSetting.deadline).toLocaleDateString('th-TH', { 
      day: 'numeric', month: 'long', year: 'numeric' 
    })

    // 3. Final list of unpaid students for the selected period
    const { data: finalPaid } = await adminClient
      .from('payments')
      .select('user_id')
      .eq('period_id', period_id!)
      .in('status', ['approved', 'pending'])

    const finalPaidIds = new Set(finalPaid?.map(p => p.user_id) || [])
    const unpaidStudents = (students ?? []).filter((s) => !finalPaidIds.has(s.id))

    if (unpaidStudents.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, message: `นักศึกษาทุกคนชำระ "${cycleTitle}" ครบถ้วนแล้ว` })
    }

    // 4. Send Notifications (In-App & LINE)
    const notifs = unpaidStudents.map(s => ({
      user_id: s.id,
      title: 'งวดปัจจุบันกำหนดส่ง',
      message: `คุณมียอดค้างชำระสำหรับ "${cycleTitle}" กรุณาดำเนินการภายในวันที่ ${deadline}`,
      type: 'warning'
    }))
    await adminClient.from('notifications').insert(notifs)

    const lineTargets = unpaidStudents.filter(s => s.line_user_id)

    // Format Thai dates for LINE Flex
    const thaiDateStr = (isoStr: string | null) => {
      if (!isoStr) return ''
      return new Date(isoStr).toLocaleDateString('th-TH', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    }

    const results = await sendBulkReminder(lineTargets.map((s) => {
      const studentAmount = tierAmounts[s.tier as 'A' | 'B' | 'C'] ?? tierAmounts.B
      return { 
        lineUserId: s.line_user_id!, 
        cycleTitle,
        amount: studentAmount,
        deadline,
        openDate: cycleSetting.open_at ? thaiDateStr(cycleSetting.open_at) : undefined,
        closeDate: cycleSetting.close_at ? thaiDateStr(cycleSetting.close_at) : undefined,
      }
    }))
    
    sent = results.filter(Boolean).length
    failed = results.filter((r) => !r).length

  } else if (body.type === 'custom' && body.message) {
    const targetIds = Array.isArray(body.target) ? body.target : []
    const { data: targets } = await adminClient.from('users').select('id, line_user_id').in('id', targetIds)
    
    for (const t of targets ?? []) {
      if (t.line_user_id) {
        const ok = await sendLineMessage(t.line_user_id, body.message!)
        ok ? sent++ : failed++
      }
    }
  }

  await logAction({ actorId: profile?.id || user.id, action: 'notification_sent', newValue: { type: body.type, sent, failed, period_id: body.period_id } })
  return NextResponse.json({ sent, failed })
}
