import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendLineMessage, sendMulticastLineMessage } from '@/lib/line'
import { logAction } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await createAdminClient().from('users').select('id, role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  if (!profile || !['admin', 'treasurer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { title, message, filters, targetPeriodId, sendLine, sendInApp } = body

  if (!message || !filters || filters.length === 0) {
    return NextResponse.json({ error: 'Missing message or filters' }, { status: 400 })
  }

  // 1. Fetch all students
  const { data: students } = await adminClient
    .from('users')
    .select('id, fullname, line_user_id')
    .eq('role', 'student')

  if (!students) return NextResponse.json({ error: 'No students found' }, { status: 404 })

  // 2. Fetch payments for filtering if needed
  let paymentMap = new Map<string, string>() // userId -> status
  if (body.targetPeriodId) {
    const { data: payments } = await adminClient
      .from('payments')
      .select('user_id, status')
      .eq('period_id', body.targetPeriodId)
    
    payments?.forEach(p => paymentMap.set(p.user_id, p.status))
  }

  // 3. Apply Filters
  const targetStudents = students.filter(student => {
    const status = paymentMap.get(student.id) || 'unpaid'
    
    if (filters.includes('all')) return true
    if (filters.includes('paid') && status === 'approved') return true
    if (filters.includes('unpaid') && (status === 'unpaid' || status === 'rejected')) return true
    if (filters.includes('pending') && status === 'pending') return true
    if (filters.includes('rejected') && status === 'rejected') return true
    
    return false
  })

  if (targetStudents.length === 0) {
    return NextResponse.json({ success: true, count: 0, message: 'No students matched the filters' })
  }

  // 4. Send Notifications
  const results = {
    line: 0,
    inApp: 0,
    errors: [] as string[]
  }

  // In-App — must be per-student (one DB row each)
  if (sendInApp) {
    for (const student of targetStudents) {
      const { error: notifError } = await adminClient.from('notifications').insert({
        user_id: student.id,
        title: title || 'ประกาศจากเหรัญญิก',
        message: message,
        type: 'info'
      })
      if (!notifError) results.inApp++
      else results.errors.push(`In-App error for ${student.fullname}: ${notifError.message}`)
    }
  }

  // LINE — single multicast request (avoids per-student sequential awaits & timeout)
  if (sendLine) {
    const lineIds = targetStudents.map(s => s.line_user_id).filter(Boolean) as string[]
    if (lineIds.length > 0) {
      const ok = await sendMulticastLineMessage(lineIds, message)
      results.line = ok ? lineIds.length : 0
      if (!ok) results.errors.push('LINE multicast ไม่สำเร็จ กรุณาตรวจสอบ server logs')
    }
  }

  await logAction({
    actorId: profile?.id || user.id,
    action: 'broadcast_sent',
    newValue: { title, message, filters, targetPeriodId, recipientCount: targetStudents.length, results }
  })

  return NextResponse.json({
    success: true,
    count: targetStudents.length,
    results
  })
}
