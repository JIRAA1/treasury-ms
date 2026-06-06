import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse as NextServerResponse } from 'next/server'
import { logAction } from '@/lib/audit'
import { randomUUID } from 'crypto'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextServerResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: periods, error } = await adminClient
    .from('periods')
    .select('*')
    .eq('semester_id', id)
    .order('period_order', { ascending: true })

  if (error) return NextServerResponse.json({ error: error.message }, { status: 500 })

  return NextServerResponse.json({ data: periods })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextServerResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient
    .from('users')
    .select('*')
    .or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`)
    .maybeSingle()

  if (!profile || !['admin', 'treasurer'].includes(profile.role)) {
    return NextServerResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  
  // Can either be a single period or batch saving
  if (body.periods || body.deletedPeriodIds) {
    const { periods = [], deletedPeriodIds = [] } = body

    // 1. Handle Deletions
    if (deletedPeriodIds.length > 0) {
      // Check if any period has payments before deleting
      const { data: paymentsWithPeriods } = await adminClient
        .from('payments')
        .select('period_id')
        .in('period_id', deletedPeriodIds)

      if (paymentsWithPeriods && paymentsWithPeriods.length > 0) {
        return NextServerResponse.json({ 
          error: 'ไม่สามารถลบงวดที่มียอดชำระเงินของนักศึกษาค้างอยู่ได้' 
        }, { status: 400 })
      }

      // Check payment_credits too
      const { data: creditsWithPeriods } = await adminClient
        .from('payment_credits')
        .select('period_id')
        .in('period_id', deletedPeriodIds)

      if (creditsWithPeriods && creditsWithPeriods.length > 0) {
        return NextServerResponse.json({ 
          error: 'ไม่สามารถลบงวดที่มีรายการ Credit ค้างอยู่ได้' 
        }, { status: 400 })
      }

      const { error: delError } = await adminClient
        .from('periods')
        .delete()
        .in('id', deletedPeriodIds)

      if (delError) return NextServerResponse.json({ error: delError.message }, { status: 500 })
    }

    // 2. Handle Upserts
    if (periods.length > 0) {
      const formattedPeriods = periods.map((p: any) => {
        const periodObj: any = {
          semester_id: id,
          label: p.label,
          period_order: p.period_order,
          amount: p.amount ?? 100.00,
          base_amount: p.base_amount ?? 50.00,
          late_fine_amount: p.late_fine_amount ?? 0.00,
          activity_type: p.activity_type || null,
          activity_extra_amount: p.activity_extra_amount ?? 0,
          is_separate_collection: p.is_separate_collection ?? false,
          qr_url: p.qr_url || null,
          open_at: p.open_at || null,
          close_at: p.close_at || null,
          deadline: p.deadline
        }
        
        if (p.id) {
          periodObj.id = p.id
        } else {
          periodObj.id = randomUUID()
        }
        
        return periodObj
      })

      const { error: upsertError } = await adminClient
        .from('periods')
        .upsert(formattedPeriods)

      if (upsertError) return NextServerResponse.json({ error: upsertError.message }, { status: 500 })
    }

    await logAction({
      actorId: profile.id,
      action: 'periods_batch_updated',
      targetId: id,
      newValue: { periodsCount: periods.length, deletedCount: deletedPeriodIds.length }
    })

    return NextServerResponse.json({ success: true })
  } else {
    // Single period creation
    const { 
      label, 
      period_order, 
      amount = 100.00, 
      base_amount = 50.00, 
      late_fine_amount = 0.00,
      activity_type = null,
      activity_extra_amount = 0,
      is_separate_collection = false,
      qr_url = null,
      open_at = null,
      close_at = null,
      deadline
    } = body

    if (!label || !deadline || period_order === undefined) {
      return NextServerResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data: period, error } = await adminClient
      .from('periods')
      .insert({
        semester_id: id,
        label,
        period_order,
        amount,
        base_amount,
        late_fine_amount,
        activity_type,
        activity_extra_amount,
        is_separate_collection,
        qr_url,
        open_at,
        close_at,
        deadline
      })
      .select()
      .single()

    if (error) return NextServerResponse.json({ error: error.message }, { status: 500 })

    await logAction({
      actorId: profile.id,
      action: 'period_created',
      targetId: period.id,
      newValue: period
    })

    return NextServerResponse.json({ data: period })
  }
}
