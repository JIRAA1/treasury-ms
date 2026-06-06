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

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('*')
    .or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`)
    .maybeSingle()

  if (!profile || !['admin', 'treasurer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 1. Deactivate all semesters
  const { error: deacError } = await adminClient
    .from('semesters')
    .update({ is_active: false })
    .neq('id', '00000000-0000-0000-0000-000000000000') // dummy target to allow wide update

  if (deacError) return NextResponse.json({ error: deacError.message }, { status: 500 })

  // 2. Activate target semester
  const { data: semester, error: acError } = await adminClient
    .from('semesters')
    .update({ is_active: true })
    .eq('id', id)
    .select()
    .single()

  if (acError) return NextResponse.json({ error: acError.message }, { status: 500 })

  await logAction({
    actorId: profile.id,
    action: 'semester_activated',
    targetId: id,
    newValue: semester
  })

  return NextResponse.json({ success: true, data: semester })
}
