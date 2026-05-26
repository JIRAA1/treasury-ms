import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

// PATCH: Update user profile (admin only — fullname, student_id, role, verified)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: actor } = await adminClient.from('users').select('id, role').or(`id.eq.${authUser.id},id.eq.${authUser.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${authUser.user_metadata?.student_id || authUser.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  if (!actor || !['admin', 'treasurer'].includes(actor.role)) {
    return NextResponse.json({ error: 'Forbidden — admin/treasurer only' }, { status: 403 })
  }

  // Fetch current student data for audit log
  const { data: current } = await adminClient.from('users').select('*').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'Student not found' }, { status: 404 })

  const body = await request.json()

  // Whitelist editable fields (treasurer can edit name/id; admin can also change role/verified)
  const allowedFields = actor.role === 'admin'
    ? ['fullname', 'student_id', 'role', 'verified']
    : ['fullname', 'student_id'] // treasurer cannot change role or verified status

  const updates: Record<string, unknown> = {}
  for (const key of allowedFields) {
    if (key in body) updates[key] = body[key]
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Validate student_id uniqueness if changing it
  if (updates.student_id && updates.student_id !== current.student_id) {
    const { data: dup } = await adminClient
      .from('users')
      .select('id')
      .eq('student_id', updates.student_id as string)
      .neq('id', id)
      .maybeSingle()
    if (dup) return NextResponse.json({ error: `รหัสนักศึกษา "${updates.student_id}" ถูกใช้แล้ว` }, { status: 409 })
  }

  const { error } = await adminClient.from('users').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit log
  const oldValue: Record<string, unknown> = {}
  const newValue: Record<string, unknown> = {}
  for (const key of Object.keys(updates)) {
    oldValue[key] = current[key]
    newValue[key] = updates[key]
  }
  await logAction({
    actorId: actor?.id || authUser.id,
    action: 'user_role_changed', // reuse closest action type
    targetId: id,
    oldValue,
    newValue,
  })

  return NextResponse.json({ success: true })
}

// DELETE: Remove user and all their payments (Cascade) — admin only
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: actor } = await adminClient.from('users').select('role').or(`id.eq.${authUser.id},id.eq.${authUser.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${authUser.user_metadata?.student_id || authUser.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  if (actor?.role !== 'admin') return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  // Note: Database foreign keys are set to ON DELETE CASCADE,
  // so deleting the user will delete all their payments automatically.
  const { error } = await adminClient.from('users').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

