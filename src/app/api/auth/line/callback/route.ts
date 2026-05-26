import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { exchangeCode } from '@/lib/line'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  if (!code) return NextResponse.redirect(`${appUrl}/login?error=no_code`)

  try {
    console.log('[LINE Callback] Exchanging code:', code)
    const lineProfile = await exchangeCode(code)
    console.log('[LINE Callback] Profile received:', lineProfile.userId)
    
    // Use admin client to bypass RLS when checking for existing user
    const admin = createAdminClient()

    const { data: existingUser, error: dbError } = await admin
      .from('users')
      .select('id, student_id, fullname, role')
      .eq('line_user_id', lineProfile.userId)
      .maybeSingle()

    if (dbError) {
      console.error('[LINE Callback] Database error:', dbError)
      throw dbError
    }

    console.log('[LINE Callback] Existing user check:', existingUser ? 'Found' : 'Not found')

    const response = existingUser 
      ? NextResponse.redirect(`${appUrl}/auth/signin`)
      : NextResponse.redirect(`${appUrl}/bind`)

    if (existingUser) {
      const email = `${existingUser.student_id}@treasury.local`
      const password = `line_${lineProfile.userId}`

      // Sync Auth user password and metadata
      const { data: { users: authUsers } } = await admin.auth.admin.listUsers()
      const authUser = authUsers.find(u => u.email === email)

      if (authUser) {
        await admin.auth.admin.updateUserById(authUser.id, { 
          password,
          user_metadata: { 
            ...authUser.user_metadata,
            avatar_url: lineProfile.pictureUrl 
          }
        })
      } else {
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { 
            fullname: existingUser.fullname, 
            student_id: existingUser.student_id,
            avatar_url: lineProfile.pictureUrl
          }
        })
      }

      response.cookies.set('signin_email', email, { httpOnly: false, maxAge: 60, path: '/' })
      response.cookies.set('signin_pass', password, { httpOnly: false, maxAge: 60, path: '/' })
      console.log('[LINE Callback] Synced auth and redirecting to /auth/signin')
    } else {
      response.cookies.set('line_user_id', lineProfile.userId, { httpOnly: true, maxAge: 600, path: '/' })
      response.cookies.set('line_display_name', lineProfile.displayName, { httpOnly: true, maxAge: 600, path: '/' })
      console.log('[LINE Callback] Setting bind cookies and redirecting to /bind')
    }

    return response
  } catch (e) {
    console.error('[LINE callback error]', e)
    return NextResponse.redirect(`${appUrl}/login?error=line_auth_failed`)
  }
}
