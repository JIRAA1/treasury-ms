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
  const { data: profile } = await adminClient.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'treasurer') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: target } = await adminClient.from('users').select('student_id, fullname, line_user_id').eq('id', id).single()
  if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // 1. Clear from custom users table
  await adminClient.from('users').update({ 
    line_user_id: null,
    line_picture_url: null,
    verified: false
  }).eq('id', id)

  // 2. Delete from Supabase Auth so they can bind fresh (avoiding password mismatch)
  try {
    const email = `${target.student_id}@treasury.local`
    const { data: { users: authUsers } } = await adminClient.auth.admin.listUsers()
    const authUser = authUsers.find(u => u.email === email)
    
    if (authUser) {
      await adminClient.auth.admin.deleteUser(authUser.id)
    }
  } catch (err) {
    console.error('Failed to delete auth user:', err)
  }

  await logAction({
    actorId: user.id,
    action: 'student_binding_reset',
    targetId: id,
    oldValue: { line_user_id: target.line_user_id },
    newValue: { line_user_id: null },
  })

  return NextResponse.json({ success: true })
}
