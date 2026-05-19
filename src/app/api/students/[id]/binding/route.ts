import { createClient } from '@/lib/supabase/server'
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

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const { data: target } = await supabase.from('users').select('fullname, line_user_id').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  await supabase.from('users').update({ line_user_id: null }).eq('id', id)

  await logAction({
    actorId: user.id,
    action: 'student_binding_reset',
    targetId: id,
    oldValue: { line_user_id: target.line_user_id },
    newValue: { line_user_id: null },
  })

  return NextResponse.json({ success: true })
}
