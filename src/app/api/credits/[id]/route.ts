import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'
import { sendLineMessage } from '@/lib/line'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/credits/[id]
// Body: { status: 'repaid' | 'forgiven', repaid_via?: string }
export async function PATCH(req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: actor } = await adminClient
    .from('users')
    .select('id, role')
    .or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`)
    .maybeSingle()
  if (!actor || !['admin', 'treasurer'].includes(actor.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { status, repaid_via } = body as { status: 'repaid' | 'forgiven'; repaid_via?: string }

  if (!['repaid', 'forgiven'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Fetch current credit
  const { data: existing } = await adminClient
    .from('payment_credits')
    .select('*, user:user_id(fullname, line_user_id)')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Credit not found' }, { status: 404 })
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Credit is already resolved' }, { status: 409 })
  }

  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from('payment_credits')
    .update({
      status,
      repaid_at: new Date().toISOString(),
      repaid_via: repaid_via ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const action = status === 'repaid' ? 'credit_repaid' : 'credit_forgiven'
  await logAction(supabase, {
    actorId: actor.id,
    action,
    targetId: id,
    oldValue: { status: 'pending' },
    newValue: { status, repaid_via },
  })

  // Notify the student about their credit resolution
  const creditUser = (existing.user as any)
  const statusText = status === 'repaid' ? 'ชำระแล้ว' : 'ยกเว้นให้แล้ว'
  const notifTitle = status === 'repaid' ? 'ยอดค้างชำระถูกเคลียร์' : 'ยอดค้างถูกยกเว้นให้'
  const notifMessage = `ยอดค้างชำระ ฿${existing.amount?.toLocaleString?.() ?? existing.amount} ที่เพิ่มโดยเหรัญญิกได้รับการดำเนินการแล้ว (สถานะ: ${statusText})`

  try {
    await createAdminClient().from('notifications').insert({
      user_id: existing.user_id,
      title: notifTitle,
      message: notifMessage,
      type: status === 'repaid' ? 'success' : 'info',
    })
    if (creditUser?.line_user_id) {
      await sendLineMessage(
        creditUser.line_user_id,
        `💬 ${notifTitle}\n${notifMessage}`
      )
    }
  } catch (e) {
    console.error('[Credits PATCH] Failed to notify student:', e)
  }

  return NextResponse.json({ credit: updated })
}
