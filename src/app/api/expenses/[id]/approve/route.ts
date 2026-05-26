import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await createAdminClient().from('users').select('id, role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
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

  return NextResponse.json({ expense: updated })
}
