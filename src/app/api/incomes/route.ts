import { createClient } from '@/lib/supabase/server'
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

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!['admin', 'treasurer'].includes(profile?.role ?? ''))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { title, description, amount, source } = await request.json()

  if (!title || !amount || isNaN(amount))
    return NextResponse.json({ error: 'Invalid data' }, { status: 400 })

  const { data: income, error } = await supabase
    .from('incomes')
    .insert({ title, description: description || null, amount, source: source || null, created_by: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to create income' }, { status: 500 })

  await logAction({ actorId: user.id, action: 'income_created', targetId: income.id, newValue: { title, amount, source } })

  return NextResponse.json({ income }, { status: 201 })
}
