'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * /auth/signin — Client-side sign-in bridge for LINE existing users.
 *
 * The LINE callback sets non-httpOnly short-lived cookies:
 *   signin_email  (60 s)
 *   signin_pass   (60 s)
 *
 * This page reads those cookies, calls signInWithPassword via the
 * browser Supabase client (which correctly persists session cookies),
 * clears the credentials cookies, then navigates to the dashboard.
 *
 * Why not use generateLink/magic-link? Supabase generateLink uses the
 * implicit flow — tokens land in the URL hash (#access_token=…).
 * Server-side Route Handlers never receive the hash, so the session
 * could never be established there.
 */
function getCookie(name: string): string {
  if (typeof document === 'undefined') return ''
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : ''
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; path=/`
}

export default function AuthSignInPage() {
  const router = useRouter()
  const supabase = createClient()
  const [status, setStatus] = useState<'signing-in' | 'error'>('signing-in')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    async function signIn() {
      const email = getCookie('signin_email')
      const password = getCookie('signin_pass')

      if (!email || !password) {
        setErrorMsg('ไม่พบข้อมูลการเข้าสู่ระบบ กรุณาลองใหม่')
        setStatus('error')
        return
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password })

      // Clear credentials immediately regardless of outcome
      deleteCookie('signin_email')
      deleteCookie('signin_pass')

      if (error) {
        setErrorMsg(`เข้าสู่ระบบไม่สำเร็จ: ${error.message}`)
        setStatus('error')
        return
      }

      router.replace('/student/dashboard')
    }

    signIn()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <p className="text-text-primary font-medium">เกิดข้อผิดพลาด</p>
          <p className="text-text-muted text-sm">{errorMsg}</p>
          <a href="/login" className="text-brand underline text-sm">กลับหน้าเข้าสู่ระบบ</a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-2">
        <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-text-muted text-sm">กำลังเข้าสู่ระบบ...</p>
      </div>
    </div>
  )
}
