import { createClient } from '@/lib/supabase/server'
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

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'treasurer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: expense } = await supabase.from('expenses').select('*').eq('id', id).single()
  if (!expense) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: updated, error } = await supabase
    .from('expenses')
    .update({ approved_by: user.id })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to approve' }, { status: 500 })

  await logAction({
    actorId: user.id,
    action: 'expense_approved',
    targetId: id,
    oldValue: { approved_by: null },
    newValue: { approved_by: user.id },
  })

  return NextResponse.json({ expense: updated })
}
