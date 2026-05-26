import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

export async function GET() {
  const supabase = await createClient()
  const { data: incomes } = await supabase
    .from('incomes')
    .select('*, creator:created_by(fullname), approver:approved_by(fullname)')
    .order('created_at', { ascending: false })
  return NextResponse.json({ incomes: incomes ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await createAdminClient()
    .from('users')
    .select('id, role')
    .or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`)
    .maybeSingle()
  if (!['admin', 'treasurer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Forbidden', debug: { email: user.email, metadata: user.user_metadata, profile } }, { status: 403 })

  const { title, description, amount, source } = await request.json()

  if (!title || !amount || isNaN(amount))
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const { data: income, error } = await supabase
    .from('incomes')
    .insert({ title, description: description || null, amount, source: source || null, created_by: profile?.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message || 'Failed to create income' }, { status: 500 })

  await logAction({ actorId: profile?.id, action: 'income_created', targetId: income.id, newValue: { title, amount, source } })

  return NextResponse.json({ income }, { status: 201 })
}
