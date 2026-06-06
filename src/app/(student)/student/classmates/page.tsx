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

  // Fetch active semester first
  const { data: activeSemester } = await adminClient
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  let periods: any[] = []
  let periodIds: string[] = []
  if (activeSemester) {
    const { data: pData } = await adminClient
      .from('periods')
      .select('id, label, amount, period_order')
      .eq('semester_id', activeSemester.id)
      .order('period_order', { ascending: true })
    periods = pData || []
    periodIds = periods.map(p => p.id)
  }

  // Fetch approved/pending payments for all students in active periods
  const { data: payments } = periodIds.length > 0
    ? await adminClient
        .from('payments')
        .select('user_id, period_id, status')
        .in('status', ['approved', 'pending'])
        .in('period_id', periodIds)
    : { data: [] }

  return (
    <ClassmatesClient
      currentUserId={profile.id}
      students={students || []}
      payments={payments || []}
      periods={periods || []}
    />
  )
}
