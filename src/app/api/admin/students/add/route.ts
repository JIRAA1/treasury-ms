import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await createAdminClient().from('users').select('role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  if (!profile || !['admin', 'treasurer'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { type, data } = await request.json()

  try {
    if (type === 'single') {
      const { error } = await adminClient.from('users').insert({
        student_id: data.student_id,
        fullname: data.fullname,
        role: 'student',
        verified: true
      })
      if (error) throw error
      return NextResponse.json({ success: true, count: 1 })
    }

    if (type === 'bulk') {
      const { error } = await adminClient.from('users').insert(
        data.map((s: any) => ({
          student_id: s.student_id,
          fullname: s.fullname,
          role: 'student',
          verified: true
        }))
      )
      if (error) throw error
      return NextResponse.json({ success: true, count: data.length })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error: any) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'พบรหัสนักศึกษาซ้ำในระบบ' }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
