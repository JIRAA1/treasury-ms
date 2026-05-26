import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'
import { sendLineMessage } from '@/lib/line'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await createAdminClient().from('users').select('id, role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  if (!['admin', 'treasurer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: income } = await adminClient.from('incomes').select('*').eq('id', id).single()
  if (!income) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: updated, error } = await adminClient
    .from('incomes')
    .update({ approved_by: profile?.id })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message || 'Failed to approve' }, { status: 500 })

  await logAction({
    actorId: profile?.id,
    action: 'income_approved',
    targetId: id,
    oldValue: { approved_by: null },
    newValue: { approved_by: profile?.id },
  })

  // --- NOTIFY EVERYONE ---
  try {
    const { data: students } = await adminClient
      .from('users')
      .select('id, line_user_id')
      .eq('role', 'student')
    
    if (students && students.length > 0) {
      const title = 'มีรายรับใหม่เข้ากองกลาง 💰'
      const message = `รายการ: ${income.title}\nจำนวนเงิน: ฿${income.amount.toLocaleString()}\nแหล่งที่มา: ${income.source || 'ไม่ระบุ'}`
      
      // In-App Notifications
      const notifs = students.map(s => ({
        user_id: s.id,
        title,
        message,
        type: 'success'
      }))
      await adminClient.from('notifications').insert(notifs)

      // LINE Notifications (Optional: Can be slow if many students, but requested)
      for (const student of students) {
        if (student.line_user_id) {
          await sendLineMessage(student.line_user_id, `${title}\n\n${message}`)
        }
      }
    }
  } catch (err) {
    console.error('Failed to notify everyone:', err)
  }

  return NextResponse.json({ income: updated })
}
