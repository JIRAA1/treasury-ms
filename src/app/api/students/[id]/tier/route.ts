import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { logAction } from '@/lib/audit'

type Params = { params: Promise<{ id: string }> }

// PATCH /api/students/[id]/tier
// Body: { tier: 'A' | 'B' | 'C', tier_note?: string }
export async function PATCH(req: Request, { params }: Params) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Role check
  const { data: actor } = await supabase.from('users').select('id, role').eq('id', user.id).single()
  if (!actor || !['admin', 'treasurer'].includes(actor.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params
  const body = await req.json()
  const { tier, tier_note } = body as { tier: 'A' | 'B' | 'C'; tier_note?: string }

  if (!['A', 'B', 'C'].includes(tier)) {
    return NextResponse.json({ error: 'Invalid tier value' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Fetch old value for audit
  const { data: oldUser } = await supabase.from('users').select('tier, tier_note').eq('id', id).single()

  // Handle Tier C assignment via atomic RPC to prevent race condition
  if (tier === 'C') {
    const { data: settings } = await supabase
      .from('system_settings')
      .select('value')
      .eq('key', 'tier_c_max_quota')
      .single()
    const maxQuota = parseInt(settings?.value ?? '5', 10)

    // Use atomic DB function — checks quota and updates in a single transaction
    const { data: assigned, error: rpcError } = await admin.rpc('assign_tier_c_safe', {
      p_user_id: id,
      p_max_quota: maxQuota,
    })

    if (rpcError) {
      return NextResponse.json({ error: rpcError.message }, { status: 500 })
    }

    if (!assigned) {
      return NextResponse.json(
        { error: `โควต้าเทียร์ C เต็มแล้ว (สูงสุด ${maxQuota} คน)` },
        { status: 422 }
      )
    }

    // Update tier_note separately (RPC only sets tier = 'C')
    if (tier_note !== undefined) {
      await admin.from('users').update({ tier_note: tier_note ?? null }).eq('id', id)
    }

    // Fetch updated user for response
    const { data: updated } = await admin
      .from('users')
      .select('id, fullname, student_id, tier, tier_note')
      .eq('id', id)
      .single()

    await logAction(supabase, {
      actorId: actor.id,
      action: 'tier_changed',
      targetId: id,
      oldValue: oldUser ?? undefined,
      newValue: { tier, tier_note },
    })

    return NextResponse.json({ user: updated })
  }

  // For Tier A or B — direct update (no quota concern)
  const { data: updated, error } = await admin
    .from('users')
    .update({ tier, tier_note: tier_note ?? null })
    .eq('id', id)
    .select('id, fullname, student_id, tier, tier_note')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAction(supabase, {
    actorId: actor.id,
    action: 'tier_changed',
    targetId: id,
    oldValue: oldUser ?? undefined,
    newValue: { tier, tier_note },
  })

  return NextResponse.json({ user: updated })
}
