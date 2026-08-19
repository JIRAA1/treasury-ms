import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/special-collections/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  const { data: collection, error } = await adminClient
    .from('special_collections')
    .select(`
      *,
      items:special_collection_items(
        *,
        user:users(id, student_id, fullname, email),
        slips:special_collection_slips(
          *,
          verifier:users(fullname)
        )
      )
    `)
    .eq('id', id)
    .single()

  if (error || !collection) {
    return NextResponse.json({ error: 'Special collection not found' }, { status: 404 })
  }

  // Calculate statistics
  const items = collection.items || []
  const totalAssigned = items.length
  const totalPaid = items.filter((i: any) => i.status === 'approved').length
  const totalPartial = items.filter((i: any) => i.status === 'partial').length
  const totalPending = items.filter((i: any) => i.status === 'pending' || i.slips?.some((s: any) => s.status === 'pending')).length
  const totalUnpaid = items.filter((i: any) => i.status === 'unpaid').length
  const totalExpected = items.reduce((acc: number, i: any) => acc + parseFloat(i.amount || 0), 0)
  const totalCollected = items.reduce((acc: number, i: any) => acc + parseFloat(i.paid_amount || 0), 0)

  return NextResponse.json({
    collection: {
      ...collection,
      stats: {
        total_assigned: totalAssigned,
        total_paid: totalPaid,
        total_partial: totalPartial,
        total_pending: totalPending,
        total_unpaid: totalUnpaid,
        total_amount_expected: totalExpected,
        total_amount_collected: totalCollected,
      }
    }
  })
}

// PATCH /api/special-collections/[id] (Admin only)
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'treasurer')) {
    return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 })
  }

  const body = await request.json()
  const {
    title,
    description,
    default_amount,
    due_date,
    is_active,
    allow_installments,
    max_installments
  } = body

  const updateData: Record<string, any> = {}
  if (title !== undefined) updateData.title = title
  if (description !== undefined) updateData.description = description
  if (default_amount !== undefined) updateData.default_amount = parseFloat(default_amount)
  if (due_date !== undefined) updateData.due_date = due_date
  if (is_active !== undefined) updateData.is_active = is_active
  if (allow_installments !== undefined) updateData.allow_installments = allow_installments
  if (max_installments !== undefined) updateData.max_installments = parseInt(max_installments)

  const { data: updated, error } = await adminClient
    .from('special_collections')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, collection: updated })
}

// DELETE /api/special-collections/[id] (Admin only)
export async function DELETE(
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
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (!profile || (profile.role !== 'admin' && profile.role !== 'treasurer')) {
    return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 })
  }

  const { error } = await adminClient
    .from('special_collections')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, message: 'ลบรายการเก็บเงินพิเศษสำเร็จ' })
}
