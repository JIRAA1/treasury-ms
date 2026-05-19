import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'treasurer') 
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') // 'income', 'students', or 'audit'

  const adminClient = createAdminClient()
  
  let buffer: Buffer
  let filename: string

  if (type === 'income') {
    const { data: payments } = await adminClient.from('payments').select('*, user:user_id(fullname, student_id)').eq('status', 'approved')
    const { data: settings } = await adminClient.from('week_settings').select('*').order('week', { ascending: true })
    
    const data = (payments || []).map((p) => {
      const u = p.user as any
      const s = settings?.find(x => x.week === p.week)
      return {
        'วันที่ชำระ': new Date(p.created_at).toLocaleString('th-TH'),
        'รายการ': s?.title || `งวดที่ ${p.week}`,
        'รหัสนักศึกษา': u?.student_id,
        'ชื่อ-นามสกุล': u?.fullname,
        'จำนวนเงิน': p.amount,
        'เลขที่อ้างอิง': p.trans_ref,
      }
    })
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Incomes')
    buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    filename = `income_report_${Date.now()}.xlsx`

  } else if (type === 'audit') {
    const { data: logs } = await adminClient.from('audit_logs').select('*, actor:actor_id(fullname, student_id)').order('created_at', { ascending: false })
    
    const data = (logs || []).map((log) => {
      const actor = log.actor as any
      return {
        'วัน-เวลา': new Date(log.created_at).toLocaleString('th-TH'),
        'ผู้ดำเนินการ': actor ? `${actor.fullname} (${actor.student_id})` : 'ระบบ',
        'กิจกรรม': log.action,
        'ID เป้าหมาย': log.target_id,
        'ข้อมูลเก่า': JSON.stringify(log.old_value),
        'ข้อมูลใหม่': JSON.stringify(log.new_value)
      }
    })
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Audit_Logs')
    buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    filename = `audit_report_${Date.now()}.xlsx`

  } else {
    // Student summary
    const { data: students } = await adminClient.from('users').select('id, fullname, student_id').eq('role', 'student').order('student_id')
    const { data: payments } = await adminClient.from('payments').select('*, user:user_id(fullname, student_id)').eq('status', 'approved')
    const { data: settings } = await adminClient.from('week_settings').select('*').order('week', { ascending: true })

    const data = (students || []).map((student) => {
      const row: any = {
        'รหัสนักศึกษา': student.student_id,
        'ชื่อ-นามสกุล': student.fullname,
      }
      let total = 0
      settings?.forEach((s) => {
        const p = payments?.find((pay) => pay.user_id === student.id && pay.week === s.week)
        row[s.title || `งวดที่ ${s.week}`] = p ? p.amount : 0
        if (p) total += p.amount
      })
      row['รวมทั้งหมด'] = total
      return row
    })
    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students')
    buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    filename = `student_summary_${Date.now()}.xlsx`
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=${filename}`,
    },
  })
}
