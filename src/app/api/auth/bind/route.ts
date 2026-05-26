import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendOTP } from '@/lib/line'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  const { student_id } = await request.json() as { student_id: string }
  console.log('[Bind API] Received request for student_id:', student_id)

  if (!/^\d{8}$/.test(student_id))
    return NextResponse.json({ error: 'รหัสนักศึกษาต้องเป็นตัวเลข 8 หลัก' }, { status: 400 })

  const cookieStore = await cookies()
  const lineUserId = cookieStore.get('line_user_id')?.value
  console.log('[Bind API] line_user_id cookie:', lineUserId ? 'Present' : 'MISSING')

  if (!lineUserId) return NextResponse.json({ error: 'กรุณาเข้าสู่ระบบด้วย LINE ก่อน' }, { status: 401 })

  // Use admin client to bypass RLS
  const admin = createAdminClient()

  // 0. Check if this LINE ID is already bound to another student
  const { data: lineOwner } = await admin
    .from('users')
    .select('student_id')
    .eq('line_user_id', lineUserId)
    .neq('student_id', student_id)
    .maybeSingle()
    
  if (lineOwner) {
    return NextResponse.json({ error: `LINE บัญชีนี้ถูกผูกกับรหัสนักศึกษา ${lineOwner.student_id} แล้ว กรุณาแจ้งแอดมินเพื่อรีเซ็ต` }, { status: 409 })
  }

  // 1. Check if student ID exists in our database
  const { data: userProfile, error: profileError } = await admin
    .from('users').select('id, line_user_id').eq('student_id', student_id).maybeSingle()

  if (!userProfile) {
    return NextResponse.json({ error: 'ไม่พบรหัสนักศึกษานี้ในระบบ กรุณาตรวจสอบรหัสอีกครั้ง หรือติดต่อเหรัญญิก' }, { status: 404 })
  }

  // 2. If this student ID is already bound to ANOTHER line account
  if (userProfile.line_user_id && userProfile.line_user_id !== lineUserId) {
    return NextResponse.json({ error: 'รหัสนักศึกษานี้ผูกกับบัญชี LINE อื่นแล้ว' }, { status: 409 })
  }

  // 3. If this student ID is already bound to THIS line account
  if (userProfile.line_user_id === lineUserId) {
    const email = `${student_id}@treasury.local`
    const password = `line_${lineUserId}`
    
    return NextResponse.json({ 
      success: true, 
      alreadyBound: true,
      email,
      password,
      message: 'บัญชีนี้ผูกไว้แล้ว กำลังเข้าสู่ระบบ...' 
    })
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  // Store OTP temporarily in a cookie (simple approach)
  cookieStore.set('bind_otp', `${otp}:${student_id}:${expiresAt}`, { httpOnly: true, maxAge: 300, path: '/' })

  await sendOTP(lineUserId, otp)

  return NextResponse.json({ success: true, message: 'ส่ง OTP แล้ว' })
}
