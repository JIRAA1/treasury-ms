import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { sendPaymentApproved, sendPaymentRejected } from '@/lib/line'
import { logAction } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const { data: profile } = await createAdminClient().from('users').select('role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  if (!profile || !['admin', 'treasurer'].includes(profile.role))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  interface VerifyBody {
    id: string
    action: 'approve' | 'reject' | 'notify_only'
    status?: string
    type?: 'cash_success' | 'manual_change'
    reason?: string
  }
  let body: VerifyBody = { id: '', action: 'approve' }
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    body = await request.json()
  } else {
    const formData = await request.formData()
    body = Object.fromEntries(formData.entries()) as unknown as VerifyBody
  }

  if (!body.id || !body.action) {
    return NextResponse.json({ error: 'Missing required fields: id, action' }, { status: 400 })
  }

  const { id, action, status, type } = body

  // 1. Fetch Payment, User, and Cycle Info
  const { data: payment } = await adminClient
    .from('payments')
    .select('*, user:user_id(id, line_user_id, fullname)')
    .eq('id', id)
    .single()

  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  const { data: cycleSetting } = await adminClient
    .from('week_settings')
    .select('title')
    .eq('week', payment.week)
    .single()

  const student = payment.user as any
  const cycleTitle = cycleSetting?.title || `งวดที่ ${payment.week}`
  const finalStatus = action === 'notify_only' ? (status || payment.status) : (action === 'approve' ? 'approved' : 'rejected')
  const thaiDate = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // 2. Create In-App Notification
  let title = ''
  let message = ''
  let notifType = 'info'

  if (type === 'cash_success' || (action === 'notify_only' && status === 'approved' && payment.note?.includes('เงินสด'))) {
    title = 'ชำระเงินสดสำเร็จ'
    message = `เหรัญญิกได้บันทึกการชำระเงินสดของคุณสำหรับ "${cycleTitle}" เรียบร้อยแล้ว`
    notifType = 'success'
  } else if (status === 'pending') {
    title = 'ยกเลิกการอนุมัติ'
    message = `รายการ "${cycleTitle}" ของคุณถูกเปลี่ยนสถานะกลับเป็น "รอตรวจสอบ"`
    notifType = 'warning'
  } else if (action === 'reject' || status === 'rejected') {
    title = 'สลิปถูกปฏิเสธ'
    message = `รายการ "${cycleTitle}" ไม่ผ่านการตรวจสอบ กรุณาติดต่อเหรัญญิก`
    notifType = 'error'
  } else if (action === 'approve' || status === 'approved') {
    title = 'ชำระเงินสำเร็จ'
    message = `รายการ "${cycleTitle}" จำนวน ฿${payment.amount} ได้รับการอนุมัติแล้ว`
    notifType = 'success'
  }

  if (title) {
    await adminClient.from('notifications').insert({
      user_id: student.id,
      title,
      message,
      type: notifType
    })
  }

  // 3. Send LINE Notification (Flex Message with Detail)
  if (student.line_user_id) {
    try {
      if (finalStatus === 'approved') {
        await sendPaymentApproved(student.line_user_id, cycleTitle, payment.amount, thaiDate)
      } else if (finalStatus === 'rejected') {
        await sendPaymentRejected(student.line_user_id, cycleTitle, 'สลิปไม่ถูกต้องหรือข้อมูลไม่ครบถ้วน')
      }
    } catch (e) {
      console.error('Failed to send LINE notification:', e)
    }
  }

  // 4. Update Database if not notify_only
  if (action !== 'notify_only') {
    const updateData: any = {
      status: finalStatus,
      verified_at: finalStatus === 'approved' ? new Date().toISOString() : null
    }

    if (finalStatus === 'rejected') {
      updateData.slip_url = null

      if (payment.slip_url) {
        const getStoragePathFromUrl = (url: string, bucketName: string = 'slips'): string | null => {
          try {
            const marker = `/storage/v1/object/public/${bucketName}/`
            const index = url.indexOf(marker)
            if (index === -1) return null
            return url.substring(index + marker.length)
          } catch {
            return null
          }
        }

        const storagePath = getStoragePathFromUrl(payment.slip_url, 'slips')
        if (storagePath) {
          try {
            const { error: deleteError } = await adminClient.storage.from('slips').remove([storagePath])
            if (deleteError) {
              console.error('Failed to delete rejected slip from storage:', deleteError)
            }
          } catch (e) {
            console.error('Error deleting rejected slip from storage:', e)
          }
        }
      }
    }

    const { error } = await adminClient
      .from('payments')
      .update(updateData)
      .eq('id', id)
    
    if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

    await logAction({
      actorId: user.id,
      action: action === 'approve' ? 'payment_approved' : 'payment_rejected',
      targetId: id,
      newValue: { status: finalStatus, slip_url: updateData.slip_url || null }
    })
  }

  return NextResponse.json({ success: true })
}

export async function PATCH(request: NextRequest) {
  return POST(request)
}
