import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'treasurer'

  let query = supabase
    .from('payments')
    .select('*, user:user_id(fullname, student_id)')
    .order('created_at', { ascending: false })

  // Students only see their own; admins see all
  if (!isAdmin) {
    query = query.eq('user_id', user.id)
  }

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: payments, error } = await query

  if (error) return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })

  let result = payments ?? []

  // Search filter (server-side if needed)
  if (search && isAdmin) {
    const q = search.toLowerCase()
    result = result.filter((p) => {
      const u = p.user as { fullname: string; student_id: string } | null
      return u?.fullname.toLowerCase().includes(q) || u?.student_id.includes(q)
    })
  }

  return NextResponse.json({ payments: result })
}
