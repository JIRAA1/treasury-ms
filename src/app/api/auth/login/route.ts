import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { line_user_id } = await request.json()

  if (!line_user_id) {
    return NextResponse.json({ error: 'Missing LINE User ID' }, { status: 400 })
  }

  // Check if user exists with this LINE ID
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('line_user_id', line_user_id)
    .single()

  if (error || !user) {
    // If user not found, redirect to bind page (handled by client)
    return NextResponse.json({ 
      success: false, 
      message: 'User not found, please bind your account',
      redirect: '/bind'
    })
  }

  // Normally, we'd use Supabase Auth for the session.
  // This route is a placeholder for the logic that happens after LINE callback.
  
  return NextResponse.json({ 
    success: true, 
    user,
    redirect: user.role === 'student' ? '/student/dashboard' : '/admin/overview'
  })
}
