import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'
import { sendMulticastLineMessage } from '@/lib/line'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient.from('users').select('id, role, fullname').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  if (!['admin', 'treasurer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: expense } = await supabase.from('expenses').select('*').eq('id', id).single()
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: updated, error } = await supabase
    .from('expenses')
    .update({ approved_by: profile?.id })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message || 'Failed to approve' }, { status: 500 })

  await logAction({
    actorId: profile?.id,
    action: 'expense_approved',
    targetId: id,
    oldValue: { approved_by: null },
    newValue: { approved_by: profile?.id },
  })

  // ── Notify all students about the approved expense (transparency) ──────────
  try {
    const { data: students } = await adminClient
      .from('users')
      .select('id, line_user_id')
      .eq('role', 'student')

    if (students && students.length > 0) {
      const approverName = profile?.fullname || 'เหรัญญิก'
      const amountStr = `฿${expense.amount.toLocaleString()}`
      const title = 'มีรายจ่ายใหม่จากกองกลาง 💸'
      const message = [
        `รายการ: ${expense.title}`,
        `จำนวน: ${amountStr}`,
        expense.description ? `รายละเอียด: ${expense.description}` : null,
        `อนุมัติโดย: ${approverName}`,
      ].filter(Boolean).join('\n')

      // In-App Notifications
      const notifs = students.map(s => ({
        user_id: s.id,
        title,
        message,
        type: 'info',
      }))
      await adminClient.from('notifications').insert(notifs)

      // LINE Multicast — single request for all students with LINE IDs
      const lineIds = students.map(s => s.line_user_id).filter(Boolean) as string[]
      if (lineIds.length > 0) {
        await sendMulticastLineMessage(lineIds, `📢 ${title}\n\n${message}`)
      }
    }
  } catch (err) {
    console.error('[Expense Approve] Failed to notify students:', err)
  }

  return NextResponse.json({ expense: updated })
}
