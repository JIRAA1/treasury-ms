'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'
import { useRouter } from 'next/navigation'

export function useAuth() {
  const supabase = createClient()
  const router = useRouter()
  const { user, setUser, clearUser } = useAuthStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function getProfile() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        
        if (!session) {
          clearUser()
          setLoading(false)
          return
        }

        const { data: profile, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (error) throw error

        setUser(profile as User)
      } catch (error) {
        console.error('Error fetching profile:', error)
        clearUser()
      } finally {
        setLoading(false)
      }
    }

    getProfile()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session) {
          const { data: profile } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single()
          
          if (profile) {
            setUser(profile as User)
          }
        } else {
          clearUser()
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, setUser, clearUser])

  const signOut = async () => {
    await supabase.auth.signOut()
    clearUser()
    router.push('/login')
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'treasurer'
  const isStudent = user?.role === 'student'

  return {
    user,
    loading,
    signOut,
    isAdmin,
    isStudent,
    isAuthenticated: !!user,
  }
}
