import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('id, role')
    .or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`)
    .maybeSingle()
  
  if (!profile || !['admin', 'treasurer'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id && id !== 'all') {
    // Delete individual log
    const { error } = await adminClient.from('audit_logs').delete().eq('id', id)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await logAction({
      actorId: profile.id,
      action: 'audit_deleted',
      targetId: id
    })

    return NextResponse.json({ success: true, deleted: id })
  } else {
    // Clear all logs
    const { error } = await adminClient.from('audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    // Log the clear action (so there's always at least one log indicating who did the clear!)
    await logAction({
      actorId: profile.id,
      action: 'audit_cleared',
      newValue: { type: 'clear_audit_logs' }
    })
    
    return NextResponse.json({ success: true, clearedAll: true })
  }
}
