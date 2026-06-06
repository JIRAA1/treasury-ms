import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdminProfile } from '@/lib/supabase/resolve-profile'
import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const profile = await resolveAdminProfile(adminClient, user)
  if (!profile)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const type = searchParams.get('type') // 'income' | 'audit' | 'credits' | default (students)


  let buffer: Buffer
  let filename: string

  if (type === 'income') {
    const { data: payments } = await adminClient.from('payments').select('*, user:user_id(fullname, student_id)').eq('status', 'approved')
    const { data: incomes } = await adminClient.from('incomes').select('*, approver:approved_by(fullname)').not('approved_by', 'is', null)
    const { data: settings } = await adminClient.from('periods').select('*').order('period_order', { ascending: true })
    
    const combinedList: any[] = []
    
    payments?.forEach((p) => {
      const u = p.user as any
      const s = settings?.find(x => x.id === p.period_id)
      combinedList.push({
        created_at: new Date(p.created_at),
        type: 'เงินค่าห้องนักศึกษา',
        title: s?.label || `งวดที่ ${p.period_id}`,
        payer: u ? `${u.fullname} (${u.student_id})` : 'ไม่ระบุตัวตน',
        amount: p.amount,
        ref: p.trans_ref || 'ชำระด้วยเงินสด'
      })
    })

    incomes?.forEach((i) => {
      combinedList.push({
        created_at: new Date(i.created_at),
        type: 'รายรับจากแหล่งอื่น',
        title: i.title,
        payer: i.source || 'ไม่ระบุแหล่งที่มา',
        amount: i.amount,
        ref: i.description || '—'
      })
    })

    combinedList.sort((a, b) => b.created_at.getTime() - a.created_at.getTime())

    const data = combinedList.map((item) => ({
      'วัน-เวลาที่รับเงิน': item.created_at.toLocaleString('th-TH'),
      'ประเภทรายรับ': item.type,
      'รายการ': item.title,
      'ผู้ชำระ / แหล่งที่มา': item.payer,
      'จำนวนเงิน (บาท)': item.amount,
      'เลขที่อ้างอิง / รายละเอียด': item.ref
    }))

    const worksheet = XLSX.utils.json_to_sheet(data)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Incomes')
    buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    filename = `income_report_${Date.now()}.xlsx`

  } else if (type === 'audit') {
    const { data: logs } = await adminClient.from('audit_logs').select('*, actor:actor_id(fullname, student_id)').order('created_at', { ascending: false })
    
    const actionMap: Record<string, string> = {
      payment_uploaded: 'อัปโหลดสลิป',
      payment_approved: 'อนุมัติการชำระ',
      payment_rejected: 'ปฏิเสธสลิป',
      expense_created: 'เพิ่มค่าใช้จ่าย',
      expense_approved: 'อนุมัติค่าใช้จ่าย',
      expense_deleted: 'ลบค่าใช้จ่าย',
      income_created: 'เพิ่มรายรับ',
      income_approved: 'อนุมัติรายรับ',
      income_deleted: 'ลบรายรับ',
      notification_sent: 'ส่งแจ้งเตือน',
      broadcast_sent: 'บรอดแคสต์',
      student_binding_reset: 'รีเซ็ต LINE',
      user_role_changed: 'เปลี่ยน Role',
      system_reset: 'รีเซ็ตระบบ',
      clear_payments: 'ล้างประวัติการโอน',
      audit_deleted: 'ลบ Log',
      audit_cleared: 'ล้าง Log ทั้งหมด'
    }

    const data = (logs || []).map((log) => {
      const actor = log.actor as any
      return {
        'วัน-เวลา': new Date(log.created_at).toLocaleString('th-TH'),
        'ผู้ดำเนินการ': actor ? `${actor.fullname} (${actor.student_id})` : 'ระบบ',
        'กิจกรรม': actionMap[log.action] || log.action,
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

  } else if (type === 'credits') {
    // Credit Report — รายชื่อนักศึกษาที่มียอดค้างชำระ
    const { data: credits } = await adminClient
      .from('payment_credits')
      .select(`
        id,
        amount,
        status,
        note,
        created_at,
        repaid_at,
        user:user_id ( fullname, student_id, tier ),
        period_info:period_id ( label, deadline )
      `)
      .order('status', { ascending: true })  // pending ก่อน, repaid/forgiven ทีหลัง
      .order('created_at', { ascending: false })

    const statusLabel: Record<string, string> = {
      pending: 'ค้างชำระ',
      repaid: 'ชำระแล้ว',
      forgiven: 'ยกเว้น'
    }

    const data = (credits || []).map((c) => {
      const u = c.user as any
      const w = c.period_info as any
      return {
        'รหัสนักศึกษา': u?.student_id || 'ไม่ระบุ',
        'ชื่อ-นามสกุล': u?.fullname || 'ไม่ระบุ',
        'Tier': u?.tier || 'B',
        'งวด': w?.label || 'ไม่ระบุ',
        'กำหนดชำระของงวด': w?.deadline ? new Date(w.deadline).toLocaleDateString('th-TH') : 'ไม่ระบุ',
        'ยอดค้าง (บาท)': c.amount,
        'สถานะ': statusLabel[c.status] || c.status,
        'หมายเหตุ': c.note || '—',
        'วันที่บันทึก': new Date(c.created_at).toLocaleDateString('th-TH'),
        'วันที่ชำระ': c.repaid_at ? new Date(c.repaid_at).toLocaleDateString('th-TH') : '—',
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(data)
    // Auto-fit columns
    worksheet['!cols'] = [
      { wch: 14 }, { wch: 24 }, { wch: 6 }, { wch: 20 }, { wch: 16 },
      { wch: 12 }, { wch: 10 }, { wch: 24 }, { wch: 14 }, { wch: 14 },
    ]
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Credit_Report')
    buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    filename = `credit_report_${Date.now()}.xlsx`

  } else {
    // Student summary
    const { data: students } = await adminClient.from('users').select('id, fullname, student_id').eq('role', 'student').order('student_id')
    const { data: payments } = await adminClient.from('payments').select('*, user:user_id(fullname, student_id)').eq('status', 'approved')
    const { data: settings } = await adminClient.from('periods').select('*').order('period_order', { ascending: true })

    const data = (students || []).map((student) => {
      const row: any = {
        'รหัสนักศึกษา': student.student_id,
        'ชื่อ-นามสกุล': student.fullname,
      }
      let total = 0
      settings?.forEach((s) => {
        const p = payments?.find((pay) => pay.user_id === student.id && pay.period_id === s.id)
        row[s.label || `งวดที่ ${s.period_order}`] = p ? p.amount : 0
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
