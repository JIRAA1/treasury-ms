import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('*')
    .or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`)
    .maybeSingle()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  if (profile.role === 'student') {
    // Student: only get active semester with periods
    const { data: semester, error } = await adminClient
      .from('semesters')
      .select('*, periods(*)')
      .eq('is_active', true)
      .maybeSingle()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: semester })
  }

  // Admin/Treasurer: get all semesters with period count
  const { data: semesters, error } = await adminClient
    .from('semesters')
    .select('*, periods(id)')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const result = semesters.map(s => ({
    ...s,
    periodsCount: s.periods ? s.periods.length : 0,
    periods: undefined
  }))

  return NextResponse.json({ data: result })
}

export async function POST(request: NextRequest) {
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

  const { name, description } = await request.json()
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data: semester, error } = await adminClient
    .from('semesters')
    .insert({
      name,
      description,
      is_active: false
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAction({
    actorId: profile.id,
    action: 'semester_created',
    targetId: semester.id,
    newValue: semester
  })

  return NextResponse.json({ data: semester })
}
