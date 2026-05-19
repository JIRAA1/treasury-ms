import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Supabase PKCE Auth Callback
 *
 * All Supabase magic-links (generated via admin.generateLink) redirect here
 * with ?code=<pkce_code>&next=<destination>.
 * We exchange the code for a real session (sets sb-* cookies), then forward
 * the user to their intended page.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/student/dashboard'

  if (!code) {
    // No code — something went wrong upstream; send back to login
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    console.error('[auth/callback] exchangeCodeForSession error:', error.message)
    return NextResponse.redirect(`${origin}/login?error=session_exchange_failed`)
  }

  // Session established — redirect to the intended destination
  return NextResponse.redirect(`${origin}${next}`)
}
