import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendBulkReminder, sendMulticastLineMessage } from '@/lib/line'
import { logAction } from '@/lib/audit'
import { calculateLateFine } from '@/lib/fine'

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
    /** Optional: filter reminders to a specific Tier ('A' | 'B' | 'C') */
    tier_filter?: 'A' | 'B' | 'C'
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
    //    Fetch payments & credits in parallel — credit holders are NOT sent reminders
    const [{ data: finalPaid }, { data: pendingCredits }] = await Promise.all([
      adminClient
        .from('payments')
        .select('user_id')
        .eq('period_id', period_id!)
        .in('status', ['approved', 'pending']),
      adminClient
        .from('payment_credits')
        .select('user_id')
        .eq('period_id', period_id!)
        .eq('status', 'pending'),
    ])

    const finalPaidIds = new Set(finalPaid?.map(p => p.user_id) || [])
    // Students with an active credit for this period are already "handled" — skip them
    const pendingCreditUserIds = new Set(pendingCredits?.map(c => c.user_id) || [])
    const handledIds = new Set([...finalPaidIds, ...pendingCreditUserIds])

    let unpaidStudents = (students ?? []).filter((s) => !handledIds.has(s.id))

    // Apply tier filter if specified
    if (body.tier_filter) {
      unpaidStudents = unpaidStudents.filter((s) => s.tier === body.tier_filter)
    }

    if (unpaidStudents.length === 0) {
      const tierMsg = body.tier_filter ? ` (Tier ${body.tier_filter})` : ''
      return NextResponse.json({ sent: 0, failed: 0, message: `นักศึกษาทุกคน${tierMsg}ชำระ "${cycleTitle}" ครบถ้วนแล้ว` })
    }

    // 5. Send Notifications (In-App & LINE)
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

    const now = new Date()
    const results = await sendBulkReminder(lineTargets.map((s) => {
      const studentAmount = tierAmounts[s.tier as 'A' | 'B' | 'C'] ?? tierAmounts.B
      // คำนวณค่าปรับรายบุคคล — ถ้ามี pending credit → exempt (ไม่ปรับ)
      const hasPendingCredit = pendingCreditUserIds.has(s.id)
      const fineAmount = calculateLateFine(
        {
          deadline: cycleSetting.deadline,
          fine_type: cycleSetting.fine_type ?? 'flat',
          fine_rate: cycleSetting.fine_rate ?? 0,
          fine_cap: cycleSetting.fine_cap ?? null,
          fine_grace_days: cycleSetting.fine_grace_days ?? 0,
          late_fine_amount: cycleSetting.late_fine_amount ?? 0,
        },
        now,
        hasPendingCredit
      )
      return {
        lineUserId: s.line_user_id!,
        periodLabel: cycleTitle,
        amount: studentAmount,
        deadline,
        openDate: cycleSetting.open_at ? thaiDateStr(cycleSetting.open_at) : undefined,
        closeDate: cycleSetting.close_at ? thaiDateStr(cycleSetting.close_at) : undefined,
        fineAmount: fineAmount > 0 ? fineAmount : undefined,
      }
    }))
    
    sent = results.filter(Boolean).length
    failed = results.filter((r) => !r).length

  } else if (body.type === 'custom' && body.message) {
    const targetIds = Array.isArray(body.target) ? body.target : []
    const { data: targets } = await adminClient.from('users').select('id, fullname, line_user_id').in('id', targetIds)

    if (targets && targets.length > 0) {
      // In-App — one row per student
      const notifs = targets.map(t => ({
        user_id: t.id,
        title: 'ข้อความจากเหรัญญิก',
        message: body.message!,
        type: 'info',
      }))
      const { error: notifErr } = await adminClient.from('notifications').insert(notifs)
      if (!notifErr) sent += targets.length
      else {
        failed += targets.length
        console.error('[Notify Custom] In-App insert error:', notifErr.message)
      }

      // LINE — single multicast request
      const lineIds = targets.map(t => t.line_user_id).filter(Boolean) as string[]
      if (lineIds.length > 0) {
        const ok = await sendMulticastLineMessage(lineIds, body.message!)
        if (!ok) console.error('[Notify Custom] LINE multicast ไม่สำเร็จ ตรวจสอบ server logs')
      }
    }
  }

  await logAction({ actorId: profile?.id || user.id, action: 'notification_sent', newValue: { type: body.type, sent, failed, period_id: body.period_id } })
  return NextResponse.json({ sent, failed })
}
