import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/credits/[id]
// Body: { status: 'repaid' | 'forgiven', repaid_via?: string }
export async function PATCH(req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: actor } = await supabase.from('users').select('id, role').eq('id', user.id).single()
  if (!actor || !['admin', 'treasurer'].includes(actor.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { status, repaid_via } = body as { status: 'repaid' | 'forgiven'; repaid_via?: string }

  if (!['repaid', 'forgiven'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  // Fetch current credit
  const { data: existing } = await supabase
    .from('payment_credits')
    .select('*, user:user_id(fullname, line_user_id)')
    .eq('id', id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Credit not found' }, { status: 404 })
  if (existing.status !== 'pending') {
    return NextResponse.json({ error: 'Credit is already resolved' }, { status: 409 })
  }

  const admin = createAdminClient()
  const { data: updated, error } = await admin
    .from('payment_credits')
    .update({
      status,
      repaid_at: new Date().toISOString(),
      repaid_via: repaid_via ?? null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const action = status === 'repaid' ? 'credit_repaid' : 'credit_forgiven'
  await logAction(supabase, {
    actorId: actor.id,
    action,
    targetId: id,
    oldValue: { status: 'pending' },
    newValue: { status, repaid_via },
  })

  return NextResponse.json({ credit: updated })
}
