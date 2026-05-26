import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check role
  const adminClient = createAdminClient()
  const { data: profile } = await adminClient.from('users').select('role').eq('id', user.id).single()
  if (!profile || (profile.role !== 'admin' && profile.role !== 'treasurer')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Fetch data
  const { data: weekSettings } = await adminClient
    .from('week_settings')
    .select('week, title, amount')
    .order('week', { ascending: true })

  const { data: students } = await adminClient
    .from('users')
    .select('id, fullname, student_id')
    .eq('role', 'student')
    .order('student_id', { ascending: true })

  const { data: payments } = await adminClient
    .from('payments')
    .select('user_id, week, status, amount')

  if (!weekSettings || !students) {
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 })
  }

  // Build CSV
  const BOM = '\uFEFF' // UTF-8 BOM for Excel compatibility

  // Header row
  const weekHeaders = weekSettings.map(w => `"${w.title || `งวดที่ ${w.week}`}"`)
  const headerRow = ['ลำดับ', 'รหัสนักศึกษา', 'ชื่อ-นามสกุล', ...weekHeaders, 'จ่ายแล้ว (งวด)', 'รอตรวจ (งวด)', 'ค้างชำระ (งวด)'].join(',')

  // Data rows
  const rows = students.map((student, idx) => {
    const studentPayments = (payments ?? []).filter(p => p.user_id === student.id)

    const weekCells = weekSettings.map(w => {
      const p = studentPayments.find(pay => pay.week === w.week)
      if (!p) return '"ยังไม่จ่าย"'
      if (p.status === 'approved') return '"จ่ายแล้ว"'
      if (p.status === 'pending') return '"รอตรวจ"'
      if (p.status === 'rejected') return '"ถูกปฏิเสธ"'
      return '"ยังไม่จ่าย"'
    })

    const paidCount = studentPayments.filter(p => p.status === 'approved').length
    const pendingCount = studentPayments.filter(p => p.status === 'pending').length
    const unpaidCount = weekSettings.length - studentPayments.filter(p => p.status === 'approved' || p.status === 'pending').length

    return [
      idx + 1,
      `"${student.student_id}"`,
      `"${student.fullname}"`,
      ...weekCells,
      paidCount,
      pendingCount,
      unpaidCount,
    ].join(',')
  })

  const csv = BOM + [headerRow, ...rows].join('\r\n')

  const now = new Date()
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const filename = `payments_export_${dateStr}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
