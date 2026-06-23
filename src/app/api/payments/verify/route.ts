import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveAdminProfile } from '@/lib/supabase/resolve-profile'
import { NextRequest, NextResponse } from 'next/server'
import { sendPaymentApproved, sendPaymentRejected } from '@/lib/line'
import { logAction } from '@/lib/audit'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createAdminClient()
  const profile = await resolveAdminProfile(adminClient, user)
  if (!profile)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  interface VerifyBody {
    id: string
    action: 'approve' | 'reject' | 'notify_only'
    status?: string
    type?: 'cash_success' | 'manual_change'
    reason?: string // Custom rejection reason from admin
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

  const { id, action, status, type, reason } = body
  const rejectionReason = reason?.trim() || 'สลิปไม่ถูกต้องหรือข้อมูลไม่ครบถ้วน'

  // 1. Fetch Payment, User, and Cycle Info
  const { data: payment } = await adminClient
    .from('payments')
    .select('*, user:user_id(id, fullname), period:period_id(label, period_order)')
    .eq('id', id)
    .single()

  if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 })

  const student = payment.user as any
  const cycleTitle = (payment as any).period?.label || `งวดที่ ${(payment as any).period?.period_order || '—'}`
  const finalStatus = action === 'notify_only' ? (status || payment.status) : (action === 'approve' ? 'approved' : 'rejected')
  const thaiDate = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  // 1b. Fetch line_user_id explicitly from public.users (bypass PostgREST join ambiguity)
  const { data: studentFull } = await adminClient
    .from('users')
    .select('id, line_user_id')
    .eq('id', payment.user_id)
    .single()
  const lineUserId: string | null = studentFull?.line_user_id ?? null

  console.log(`[Verify] payment.id=${id} action=${action} student.id=${payment.user_id} line_user_id=${lineUserId ?? 'NOT_LINKED'} finalStatus=${finalStatus}`)

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
    message = `รายการ "${cycleTitle}" ไม่ผ่านการตรวจสอบ\nเหตุผล: ${rejectionReason}`
    notifType = 'error'
  } else if (action === 'approve' || status === 'approved') {
    title = 'ชำระเงินสำเร็จ'
    message = `รายการ "${cycleTitle}" จำนวน ฿${payment.amount} ได้รับการอนุมัติแล้ว`
    notifType = 'success'
  }

  if (title) {
    await adminClient.from('notifications').insert({
      user_id: payment.user_id,
      title,
      message,
      type: notifType
    })
  }

  let lineErrorDetail = ''
  let lineHttpStatus = 200

  // 3. Send LINE Notification (Flex Message with Detail)
  if (lineUserId) {
    try {
      if (finalStatus === 'approved') {
        const result = await sendPaymentApproved(lineUserId, cycleTitle, payment.amount, thaiDate)
        console.log(`[Verify] sendPaymentApproved → ok=${result.ok} status=${result.status ?? 'unknown'}`)
        if (!result.ok) {
          console.error(`[Verify] sendPaymentApproved failed for userId=${payment.user_id}: ${result.message}`)
          lineErrorDetail = result.message || 'ส่งข้อความไม่สำเร็จ'
          lineHttpStatus = result.status || 500
        }
      } else if (finalStatus === 'rejected') {
        const result = await sendPaymentRejected(lineUserId, cycleTitle, rejectionReason)
        console.log(`[Verify] sendPaymentRejected → ok=${result.ok} status=${result.status ?? 'unknown'}`)
        if (!result.ok) {
          console.error(`[Verify] sendPaymentRejected failed for userId=${payment.user_id}: ${result.message}`)
          lineErrorDetail = result.message || 'ส่งข้อความไม่สำเร็จ'
          lineHttpStatus = result.status || 500
        }
      }
    } catch (e) {
      console.error('[Verify] Failed to send LINE notification:', e)
      lineErrorDetail = e instanceof Error ? e.message : 'เกิดข้อผิดพลาดในการเชื่อมต่อ LINE'
      lineHttpStatus = 500
    }
  } else {
    console.warn(`[Verify] Student userId=${payment.user_id} has no LINE linked — skipping LINE notification`)
    lineErrorDetail = 'นักศึกษายังไม่ได้ผูกบัญชี LINE'
    lineHttpStatus = 400
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

    // Auto-resolve pending credit if payment is approved manually
    if (finalStatus === 'approved') {
      const { data: pendingCredit } = await adminClient
        .from('payment_credits')
        .select('id')
        .eq('user_id', payment.user_id)
        .eq('period_id', payment.period_id)
        .eq('status', 'pending')
        .maybeSingle()

      if (pendingCredit) {
        await adminClient
          .from('payment_credits')
          .update({
            status: 'repaid',
            repaid_at: new Date().toISOString(),
            repaid_via: payment.id
          })
          .eq('id', pendingCredit.id)
      }
    }

    await logAction({
      actorId: (profile?.['id'] as string) || user.id,
      action: action === 'approve' ? 'payment_approved' : 'payment_rejected',
      targetId: id,
      newValue: { status: finalStatus, slip_url: updateData.slip_url || null }
    })
  } else {
    // If notify_only and LINE notification failed, return error response
    if (lineErrorDetail) {
      let displayError = lineErrorDetail
      if (lineHttpStatus === 429) {
        displayError = 'เกินโควต้าการส่งข้อความประจำเดือนของ LINE Official Account (You have reached your monthly limit.)'
      } else if (lineHttpStatus === 400 && lineErrorDetail === 'นักศึกษายังไม่ได้ผูกบัญชี LINE') {
        displayError = 'ไม่สามารถส่งการแจ้งเตือนได้เนื่องจากนักศึกษายังไม่ได้ผูกบัญชี LINE'
      }
      return NextResponse.json({ error: displayError }, { status: lineHttpStatus })
    }
  }

  return NextResponse.json({ 
    success: true,
    warning: lineErrorDetail ? (lineHttpStatus === 429 ? 'เกินโควต้า LINE รายเดือน' : lineErrorDetail) : undefined
  })
}

export async function PATCH(request: NextRequest) {
  return POST(request)
}
