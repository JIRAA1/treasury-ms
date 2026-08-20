import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/special-collections
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()

  // Get current user profile
  const { data: profile } = await adminClient
    .from('users')
    .select('*')
    .or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'User profile not found' }, { status: 404 })
  }

  const isAdmin = profile.role === 'admin' || profile.role === 'treasurer'

  // view=student allows admin to preview the student-facing view (all items across all collections)
  const viewParam = request.nextUrl.searchParams.get('view')
  const forceStudentView = isAdmin && viewParam === 'student'

  if (isAdmin && !forceStudentView) {
    // Admin View: Fetch all special collections with items and slips overview
    const { data: collections, error } = await adminClient
      .from('special_collections')
      .select(`
        *,
        items:special_collection_items(
          id,
          user_id,
          amount,
          paid_amount,
          payment_mode,
          chosen_installments,
          status,
          note,
          user:users(id, student_id, fullname),
          slips:special_collection_slips(*)
        )
      `)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Process stats per collection
    const processed = (collections || []).map((col: any) => {
      const items = col.items || []
      const totalAssigned = items.length
      const totalPaid = items.filter((i: any) => i.status === 'approved').length
      const totalPartial = items.filter((i: any) => i.status === 'partial').length
      const totalPending = items.filter((i: any) => i.status === 'pending' || i.slips?.some((s: any) => s.status === 'pending')).length
      const totalUnpaid = items.filter((i: any) => i.status === 'unpaid').length
      const totalExpected = items.reduce((acc: number, i: any) => acc + parseFloat(i.amount || 0), 0)
      const totalCollected = items.reduce((acc: number, i: any) => acc + parseFloat(i.paid_amount || 0), 0)

      return {
        ...col,
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

    return NextResponse.json({ collections: processed })
  } else {
    // Student View (also used for admin preview via ?view=student)
    // Admin preview sees ALL items; normal student sees only their own
    const baseQuery = adminClient
      .from('special_collection_items')
      .select(`
        *,
        collection:special_collections(*),
        slips:special_collection_slips(*),
        user:users(id, student_id, fullname)
      `)
      .order('created_at', { ascending: false })

    const { data: items, error } = await (
      forceStudentView
        ? baseQuery
        : baseQuery.eq('user_id', profile.id)
    )

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ items, isAdminPreview: forceStudentView })
  }
}

// POST /api/special-collections (Admin only)
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

  if (!profile || (profile.role !== 'admin' && profile.role !== 'treasurer')) {
    return NextResponse.json({ error: 'Admin permissions required' }, { status: 403 })
  }

  const body = await request.json()
  const {
    title,
    description,
    default_amount,
    due_date,
    allow_installments = false,
    max_installments = 1,
    target_type = 'all', // 'all' or 'selected'
    selected_students = [] // Array of { user_id, amount?, note? }
  } = body

  if (!title || default_amount === undefined || default_amount === null) {
    return NextResponse.json({ error: 'Missing required fields: title, default_amount' }, { status: 400 })
  }

  // 1. Create special_collections row
  const { data: collection, error: colError } = await adminClient
    .from('special_collections')
    .insert({
      title,
      description: description || null,
      default_amount: parseFloat(default_amount),
      due_date: due_date || null,
      allow_installments: !!allow_installments,
      max_installments: allow_installments ? parseInt(max_installments || 1) : 1,
      is_active: true,
      created_by: profile.id,
    })
    .select()
    .single()

  if (colError) {
    return NextResponse.json({ error: colError.message }, { status: 500 })
  }

  // 2. Resolve target students
  let targetUsers: { user_id: string; amount: number; note: string | null }[] = []

  if (target_type === 'all') {
    const { data: allStudents } = await adminClient
      .from('users')
      .select('id')
      .eq('role', 'student')
      .eq('verified', true)

    targetUsers = (allStudents || []).map((s: any) => ({
      user_id: s.id,
      amount: parseFloat(default_amount),
      note: null,
    }))
  } else {
    targetUsers = selected_students.map((s: any) => ({
      user_id: s.user_id,
      amount: s.amount ? parseFloat(s.amount) : parseFloat(default_amount),
      note: s.note || null,
    }))
  }

  if (targetUsers.length === 0) {
    return NextResponse.json({
      success: true,
      collection,
      assigned_count: 0,
      message: 'สร้างรายการเก็บเงินพิเศษสำเร็จ แต่ยังไม่มีนักศึกษาถูกมอบหมาย'
    })
  }

  // 3. Batch insert items
  const itemsToInsert = targetUsers.map((tu) => ({
    collection_id: collection.id,
    user_id: tu.user_id,
    amount: tu.amount,
    paid_amount: 0,
    status: 'unpaid',
    note: tu.note,
  }))

  const { error: itemsError } = await adminClient
    .from('special_collection_items')
    .insert(itemsToInsert)

  if (itemsError) {
    console.error('[SpecialCollections POST] Insert items error:', itemsError)
    return NextResponse.json({ error: 'Failed to assign items to students: ' + itemsError.message }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    collection,
    assigned_count: targetUsers.length,
    message: `สร้างรายการเก็บเงินพิเศษ "${title}" สำเร็จ (มอบหมายให้นักศึกษา ${targetUsers.length} คน)`
  })
}
