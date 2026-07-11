import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import AppShell from '@/components/layout/AppShell'
import type { User } from '@/types'

import { getProfile } from '@/lib/data'

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) redirect('/login')

  const profile = await getProfile(authUser.id, authUser.user_metadata.student_id)

  if (!profile) {
    console.log('[StudentLayout] Profile NOT FOUND for Auth ID:', authUser.id)
    redirect('/bind')
  }

  // SYNC ID: If the IDs don't match, update the database record to use the Auth UID
  if (profile.id !== authUser.id) {
    console.log(`[StudentLayout] Syncing IDs: DB(${profile.id}) -> Auth(${authUser.id})`)
    const admin = createAdminClient()
    const { error: syncError } = await admin
      .from('users')
      .update({ id: authUser.id })
      .eq('student_id', profile.student_id)
    
    if (!syncError) {
      profile.id = authUser.id
    }
  }

  return (
    <AppShell role={profile.role} user={profile as User}>
      {children}
    </AppShell>
  )
}

