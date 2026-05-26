import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ClassmatesClient from './ClassmatesClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = { title: 'รายชื่อในชั้นเรียน — TreasuryMS' }

export default async function ClassmatesPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const adminClient = createAdminClient()

  const { data: profile } = await adminClient
    .from('users')
    .select('id, fullname, student_id')
    .or(`id.eq.${authUser.id},student_id.eq.${authUser.user_metadata.student_id}`)
    .maybeSingle()

  if (!profile) redirect('/bind')

  // Fetch all students
  const { data: students } = await adminClient
    .from('users')
    .select('id, fullname, student_id')
    .eq('role', 'student')
    .order('student_id', { ascending: true })

  // Fetch all approved/pending payments for all students
  const { data: payments } = await adminClient
    .from('payments')
    .select('user_id, week, status')
    .in('status', ['approved', 'pending'])

  // Fetch week settings
  const { data: weekSettings } = await adminClient
    .from('week_settings')
    .select('week, title, amount')
    .order('week', { ascending: true })

  return (
    <ClassmatesClient
      currentUserId={profile.id}
      students={students || []}
      payments={payments || []}
      weekSettings={weekSettings || []}
    />
  )
}
