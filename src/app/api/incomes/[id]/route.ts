import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('id, role')
    .or(`id.eq.${user.id},student_id.eq.${user.user_metadata?.student_id || 'NONE'}`)
    .maybeSingle()
  
  if (!profile || !['admin', 'treasurer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get data before deletion for logging
  const { data: income } = await adminClient.from('incomes').select('*').eq('id', id).maybeSingle()
  if (!income) return NextResponse.json({ error: 'Income not found' }, { status: 404 })

  const { error } = await adminClient.from('incomes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAction({
    actorId: profile.id,
    action: 'income_deleted',
    targetId: id,
    oldValue: income
  })

  return NextResponse.json({ success: true })
}
