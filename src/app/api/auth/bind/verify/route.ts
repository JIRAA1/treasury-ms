import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const { student_id, otp } = await request.json() as { student_id: string; otp: string }

  const cookieStore = await cookies()
  const lineUserId = cookieStore.get('line_user_id')?.value
  const displayName = cookieStore.get('line_display_name')?.value ?? 'นักศึกษา'
  const storedOtp = cookieStore.get('bind_otp')?.value

  if (!lineUserId) {
    return NextResponse.json({ error: 'ไม่พบข้อมูล LINE กรุณาเข้าสู่ระบบใหม่' }, { status: 401 })
  }
  if (!storedOtp) {
    return NextResponse.json({ error: 'OTP หมดอายุ กรุณาขอใหม่' }, { status: 400 })
  }

  const [otpCode, otpStudentId, expiresAt] = storedOtp.split(':')

  if (otpCode !== otp) {
    return NextResponse.json({ error: 'OTP ไม่ถูกต้อง' }, { status: 400 })
  }
  if (otpStudentId !== student_id) {
    return NextResponse.json({ error: 'ข้อมูลไม่ตรงกัน' }, { status: 400 })
  }
  if (new Date() > new Date(expiresAt)) {
    return NextResponse.json({ error: 'OTP หมดอายุแล้ว' }, { status: 400 })
  }

  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  try {
    // ── 1. Upsert in our custom users table ──────────────────────────────
    const { data: existingUser } = await admin
      .from('users')
      .select('id')
      .eq('student_id', student_id)
      .maybeSingle()

    let userId: string
    if (existingUser) {
      const { error: updateError } = await admin.from('users').update({ 
        line_user_id: lineUserId, 
        verified: true 
      }).eq('id', existingUser.id)
      
      if (updateError) {
        console.error('[OTP Verify Error] Update failed:', updateError)
        throw updateError
      }
      userId = existingUser.id
    } else {
      const { data: newUser, error: insertError } = await admin
        .from('users')
        .insert({ 
          student_id, 
          fullname: displayName, 
          line_user_id: lineUserId, 
          role: 'student', 
          verified: true 
        })
        .select()
        .single()
      if (insertError || !newUser) throw insertError ?? new Error('Failed to create user')
      userId = newUser.id
    }

    // ── 2. Ensure Supabase Auth user exists (idempotent) ─────────────────
    const email = `${student_id}@treasury.local`
    const password = `line_${lineUserId}`

    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        fullname: displayName, 
        student_id, 
        treasury_user_id: userId
      },
    })
    // If it already exists, the error is ignored

    // ── 3. Clear OTP cookies ───────────────────────────────────────────────
    cookieStore.delete('bind_otp')
    cookieStore.delete('line_user_id')
    cookieStore.delete('line_display_name')

    // ── 4. Return credentials for client-side signInWithPassword ──────────
    // generateLink uses implicit flow (tokens in URL hash) which server-side
    // Route Handlers cannot process. The browser Supabase client handles
    // signInWithPassword correctly and sets session cookies via @supabase/ssr.
    return NextResponse.json({ success: true, email, password })

  } catch (error: any) {
    const msg = error.message || error.details || JSON.stringify(error) || 'Internal Server Error'
    console.error('[OTP Verify Error]', msg, error)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
