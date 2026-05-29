import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
  const perPage = Math.min(100, parseInt(searchParams.get('per_page') ?? '20'))

  const { data: profile } = await createAdminClient().from('users').select('role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'treasurer'

  let query = supabase
    .from('payments')
    .select('*, user:user_id(fullname, student_id, tier)', { count: 'exact' })
    .order('created_at', { ascending: false })

  // Students only see their own; admins see all
  if (!isAdmin) {
    query = query.eq('user_id', user.id)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  // Server-side search filter (admin only)
  if (search && isAdmin) {
    // Supabase doesn't support ilike on joined columns directly,
    // so we do a partial match on the server side after fetch
  }

  // Pagination using range
  const from = (page - 1) * perPage
  const to = from + perPage - 1
  query = query.range(from, to)

  const { data: payments, error, count } = await query

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })

  let result = payments ?? []

  // Post-fetch search filter (admin only) — only applies to current page
  if (search && isAdmin) {
    const q = search.toLowerCase()
    result = result.filter((p) => {
      const u = p.user as { fullname: string; student_id: string } | null
      return u?.fullname.toLowerCase().includes(q) || u?.student_id.includes(q)
    })
  }

  return NextResponse.json({
    payments: result,
    total: count ?? 0,
    page,
    perPage,
    totalPages: Math.ceil((count ?? 0) / perPage),
  })
}

