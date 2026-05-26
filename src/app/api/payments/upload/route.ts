import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { verifySlip } from '@/lib/thunder'
import { logAction } from '@/lib/audit'
import { extractQRCode } from '@/lib/qr'
import { sendLineMessage, sendAdminAlert } from '@/lib/line'
import { parseSlipQR } from '@/lib/slip-qr'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const week = parseInt(formData.get('week') as string)

  if (!file || !week) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Server-side validation (prevent bypass of client-side checks)
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const MAX_SIZE = 5 * 1024 * 1024 // 5MB
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'ประเภทไฟล์ไม่รองรับ รองรับเฉพาะ JPG, PNG, WEBP' }, { status: 415 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'ไฟล์มีขนาดใหญ่เกิน 5MB' }, { status: 413 })
  }

  const adminClient = createAdminClient()
  
  const { data: profile } = await adminClient.from('users').select('*').eq('id', user.id).single()
  const { data: admins } = await adminClient.from('users').select('fullname, line_user_id').in('role', ['admin', 'treasurer'])

  const notifyAdmins = async (title: string, details: string[], type: 'info' | 'warning' | 'error') => {
    if (!admins) return
    for (const adm of admins) {
      if (adm.line_user_id) {
        await sendAdminAlert(adm.line_user_id, title, details, type)
      }
    }
  }

  // 1. Quick Check — prevent double-submit
  const { data: existing } = await supabase
    .from('payments').select('id, status').eq('user_id', user.id).eq('week', week).maybeSingle()

  if (existing && existing.status !== 'rejected') {
    return NextResponse.json({ error: 'คุณได้ส่งสลิปของสัปดาห์นี้ไปแล้ว' }, { status: 409 })
  }

  const { data: nameSetting } = await adminClient.from('system_settings').select('value').eq('key', 'promptpay_name').maybeSingle()
  const expectedName = nameSetting?.value || "ชานน ศ."
  const { data: weekSetting } = await adminClient
    .from('week_settings')
    .select('title, amount, payment_open_at, payment_close_at')
    .eq('week', week)
    .maybeSingle()
  const cycleTitle = weekSetting?.title || `งวดที่ ${week}`

  // 2. Payment Window Check — lock if admin has configured open/close times
  if (weekSetting?.payment_open_at || weekSetting?.payment_close_at) {
    const now = new Date()
    const openAt = weekSetting.payment_open_at ? new Date(weekSetting.payment_open_at) : null
    const closeAt = weekSetting.payment_close_at ? new Date(weekSetting.payment_close_at) : null

    if (openAt && now < openAt) {
      return NextResponse.json({
        error: `ยังไม่ถึงเวลาเปิดรับสลิปของ${cycleTitle} (เปิดวันที่ ${openAt.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })})`,
        code: 'WINDOW_NOT_OPEN'
      }, { status: 403 })
    }

    if (closeAt && now > closeAt) {
      return NextResponse.json({
        error: `หมดเวลารับสลิปของ${cycleTitle} แล้ว (ปิดรับเมื่อวันที่ ${closeAt.toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })})`,
        code: 'WINDOW_CLOSED'
      }, { status: 403 })
    }
  }

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // 3. Server-Side QR & Duplicate Check (Pre-check)
  const qrData = await extractQRCode(buffer)
  if (qrData) {
    const parsed = parseSlipQR(qrData)
    if (parsed.isValid && parsed.transRef) {
      const { data: dupPayment } = await adminClient
        .from('payments')
        .select('id, user_id, status')
        .eq('trans_ref', parsed.transRef)
        .neq('status', 'rejected')
        .maybeSingle()

      if (dupPayment) {
        const isOwnSlip = dupPayment.user_id === user.id
        await notifyAdmins('Duplicate Slip Blocked', [
          `ผู้ส่ง: ${profile?.fullname || user.id}`,
          `งวด: ${cycleTitle}`,
          `เหตุผล: สลิปนี้ซ้ำในระบบ (Ref: ${parsed.transRef})`
        ], 'warning')

        return NextResponse.json({
          error: isOwnSlip 
            ? 'คุณเคยส่งสลิปรายการโอนนี้ในระบบแล้ว' 
            : 'สลิปนี้ถูกใช้ชำระเงินโดยนักศึกษาคนอื่นในระบบแล้ว',
          code: 'DUPLICATE_SLIP'
        }, { status: 409 })
      }
    }
  }

  // 4. OCR Verify (external API call)
  const ocrResult = await verifySlip(file)

  // --- QUOTA EXCEEDED PATH ---
  // When Thunder API quota is exhausted, skip OCR validation and save slip for manual review
  if (ocrResult.quota_exceeded) {
    console.warn('[Upload] Thunder quota exceeded — saving slip for manual review')
    await notifyAdmins('🔔 สลิปรอตรวจมือ (API Quota หมด)', [
      `ผู้ส่ง: ${profile?.fullname}`,
      `รหัสนักศึกษา: ${profile?.student_id}`,
      `รายการ: ${cycleTitle}`,
      `เหตุผล: Thunder API quota หมดแล้ว กรุณาตรวจสลิปด้วยตนเอง`
    ], 'warning')

    // Upload file first
    const ext = file.type.split('/')[1]
    const filename = `${user.id}/week-${week}-${Date.now()}.${ext}`
    const { error: uploadError } = await adminClient.storage.from('slips').upload(filename, buffer, { contentType: file.type, upsert: true })
    if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(filename)

    const paymentData = {
      user_id: user.id,
      week,
      amount: 0,           // Unknown until manual review
      trans_ref: null,
      slip_url: publicUrl,
      status: 'pending' as const,
    }

    const { data: payment, error: paymentError } = existing
      ? await supabase.from('payments').update(paymentData).eq('id', existing.id).select().single()
      : await supabase.from('payments').insert(paymentData).select().single()

    if (paymentError) {
      await adminClient.storage.from('slips').remove([filename])
      return NextResponse.json({ error: 'Failed to save payment record' }, { status: 500 })
    }

    // Try to set verified_by_api flag (column may not exist if migration not run yet)
    try {
      await adminClient.from('payments').update({ verified_by_api: false }).eq('id', payment.id)
    } catch (_) {
      // Column not yet migrated — safe to ignore
    }

    await logAction({ actorId: user.id, action: 'payment_uploaded', targetId: payment.id, newValue: { ...paymentData, note: 'quota_exceeded' } })

    return NextResponse.json({ 
      success: true, 
      payment: { ...payment, verified_by_api: false }, 
      ocr: null,
      quota_exceeded: true,
      message: 'ส่งสลิปสำเร็จ — เหรัญญิกจะตรวจสอบยอดเงินด้วยตนเองเนื่องจาก API หมด quota'
    })
  }

  // --- NORMAL PATH ---
  if (!ocrResult.is_valid) {
    await notifyAdmins('Invalid Slip Attempt', [
      `ผู้ส่ง: ${profile?.fullname || user.id}`,
      `งวด: ${cycleTitle}`,
      `เหตุผล: ไม่พบข้อมูลการโอนเงิน`
    ], 'error')
    
    return NextResponse.json({ 
      error: 'ตรวจสอบสลิปไม่สำเร็จ: ไม่พบข้อมูลการโอนเงินหรือสลิปไม่ถูกต้อง', 
      code: 'INVALID_SLIP' 
    }, { status: 400 })
  }

  // 5. Receiver Validation
  const receiverName = ocrResult.raw?.data?.rawSlip?.receiver?.account?.name?.en || 
                       ocrResult.raw?.data?.rawSlip?.receiver?.account?.name?.th || ""

  const isValidReceiver = expectedName
    ? receiverName.toLowerCase().includes(expectedName.toLowerCase())
    : true

  if (!isValidReceiver) {
    await notifyAdmins('Receiver Mismatch', [
      `ผู้ส่ง: ${profile?.fullname || user.id}`,
      `งวด: ${cycleTitle}`,
      `โอนไปที่: ${receiverName || 'ไม่ระบุ'}`,
      `ยอดเงิน: ฿${ocrResult.amount}`
    ], 'warning')

    return NextResponse.json({ 
      error: `สลิปไม่ถูกต้อง: ชื่อผู้รับโอนคือ "${receiverName}" ซึ่งไม่ตรงกับบัญชีที่กำหนด`, 
      code: 'RECEIVER_MISMATCH' 
    }, { status: 400 })
  }

  // 6. Amount Validation — server-side comparison AFTER OCR
  if (ocrResult.amount !== null && weekSetting && ocrResult.amount !== weekSetting.amount) {
    await notifyAdmins('Amount Mismatch Blocked', [
      `ผู้ส่ง: ${profile?.fullname || user.id}`,
      `งวด: ${cycleTitle}`,
      `ยอดเงินในสลิป: ฿${ocrResult.amount}`,
      `ยอดเงินที่ต้องการ: ฿${weekSetting.amount}`
    ], 'warning')

    return NextResponse.json({ 
      error: `ยอดเงินในสลิป (฿${ocrResult.amount}) ไม่ตรงกับยอดชำระที่กำหนดของงวดนี้ (฿${weekSetting.amount})`, 
      code: 'AMOUNT_MISMATCH' 
    }, { status: 400 })
  }

  // 7. Storage & DB (Upload image only after all validations pass!)
  const ext = file.type.split('/')[1]
  const filename = `${user.id}/week-${week}-${Date.now()}.${ext}`
  const { error: uploadError } = await adminClient.storage.from('slips').upload(filename, buffer, { contentType: file.type, upsert: true })
  if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(filename)

  const paymentData = {
    user_id: user.id,
    week,
    amount: ocrResult.amount || 0,
    trans_ref: ocrResult.trans_ref,
    slip_url: publicUrl,
    status: 'pending' as const,
  }

  const { data: payment, error: paymentError } = existing
    ? await supabase.from('payments').update(paymentData).eq('id', existing.id).select().single()
    : await supabase.from('payments').insert(paymentData).select().single()

  if (paymentError) {
    await adminClient.storage.from('slips').remove([filename])
    return NextResponse.json({ error: 'Failed to save payment record' }, { status: 500 })
  }

  // Try to set verified_by_api flag (column may not exist if migration not run yet)
  try {
    await adminClient.from('payments').update({ verified_by_api: true }).eq('id', payment.id)
  } catch (_) {
    // Column not yet migrated — safe to ignore
  }

  await logAction({ actorId: user.id, action: 'payment_uploaded', targetId: payment.id, newValue: paymentData })

  // 8. Notify Success
  await notifyAdmins('New Slip Received', [
    `จาก: ${profile?.fullname}`,
    `รหัสนักศึกษา: ${profile?.student_id}`,
    `รายการ: ${cycleTitle}`,
    `ยอดเงิน: ฿${paymentData.amount.toLocaleString()}`
  ], 'info')

  return NextResponse.json({ success: true, payment, ocr: ocrResult })
}
