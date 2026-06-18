import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { verifySlip } from '@/lib/thunder'
import { logAction } from '@/lib/audit'
import { extractQRCode } from '@/lib/qr'
import { sendLineMessage, sendAdminAlert, sendPaymentApproved } from '@/lib/line'
import { parseSlipQR } from '@/lib/slip-qr'
import { createHash } from 'crypto'
import { calculateLateFine } from '@/lib/fine'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const period_id = formData.get('period_id') as string

  if (!file || !period_id) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

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
  
  const { data: profile } = await adminClient.from('users').select('*').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  
  if (!profile) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลบัญชีผู้ใช้งานในระบบ กรุณาลงทะเบียนหรือผูกบัญชีก่อนส่งสลิป' }, { status: 404 })
  }

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
  const { data: existing } = await adminClient
    .from('payments').select('id, status').eq('user_id', profile.id).eq('period_id', period_id).maybeSingle()

  if (existing && existing.status !== 'rejected') {
    return NextResponse.json({ error: 'คุณได้ส่งสลิปของงวดนี้ไปแล้ว' }, { status: 409 })
  }

  const { data: nameSetting } = await adminClient.from('system_settings').select('value').eq('key', 'promptpay_name').maybeSingle()
  const expectedName = nameSetting?.value || "ชานน ศ."
  const { data: periodSetting } = await adminClient
    .from('periods')
    .select('label, amount, deadline, open_at, close_at, late_fine_amount, fine_type, fine_rate, fine_cap, fine_grace_days')
    .eq('id', period_id)
    .maybeSingle()
  const cycleTitle = periodSetting?.label || `งวดนี้`

  // 2. Payment Window Check — lock if admin has configured open/close times
  if (periodSetting?.open_at || periodSetting?.close_at) {
    const now = new Date()
    const openAt = periodSetting.open_at ? new Date(periodSetting.open_at) : null
    const closeAt = periodSetting.close_at ? new Date(periodSetting.close_at) : null

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

  // 2.5. File Hash — ป้องกัน duplicate เมื่อ OCR อ่าน trans_ref ไม่ได้ (null ≠ null ใน UNIQUE)
  const fileHash = createHash('sha256').update(buffer).digest('hex')

  const { data: hashDup } = await adminClient
    .from('payments')
    .select('id, user_id, status')
    .eq('file_hash', fileHash)
    .neq('status', 'rejected')
    .maybeSingle()

  if (hashDup) {
    const isOwnSlip = hashDup.user_id === profile.id
    await notifyAdmins('Duplicate Slip Blocked (Hash)', [
      `ผู้ส่ง: ${profile.fullname}`,
      `งวด: ${cycleTitle}`,
      `เหตุผล: ไฟล์สลิปนี้เคยถูกอัปโหลดในระบบแล้ว (SHA-256 match)`
    ], 'warning')
    return NextResponse.json({
      error: isOwnSlip
        ? 'คุณเคยส่งไฟล์สลิปนี้ไปแล้ว'
        : 'ไฟล์สลิปนี้ถูกใช้โดยนักศึกษาคนอื่นในระบบแล้ว',
      code: 'DUPLICATE_SLIP'
    }, { status: 409 })
  }

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
        const isOwnSlip = dupPayment.user_id === profile.id
        await notifyAdmins('Duplicate Slip Blocked', [
          `ผู้ส่ง: ${profile.fullname}`,
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
    const filename = `${profile.id}/period-${period_id}-${Date.now()}.${ext}`
    const { error: uploadError } = await adminClient.storage.from('slips').upload(filename, buffer, { contentType: file.type, upsert: true })
    if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(filename)

    const paymentData = {
      user_id: profile.id,
      period_id,
      amount: 0,           // Unknown until manual review
      trans_ref: null,
      slip_url: publicUrl,
      status: 'pending' as const,
      file_hash: fileHash,
    }

    const { data: payment, error: paymentError } = existing
      ? await adminClient.from('payments').update(paymentData).eq('id', existing.id).select().single()
      : await adminClient.from('payments').insert(paymentData).select().single()

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

    await logAction({ actorId: profile.id, action: 'payment_uploaded', targetId: payment.id, newValue: { ...paymentData, note: 'quota_exceeded' } })

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
      `ผู้ส่ง: ${profile.fullname}`,
      `งวด: ${cycleTitle}`,
      `โอนไปที่: ${receiverName || 'ไม่ระบุ'}`,
      `ยอดเงิน: ฿${ocrResult.amount}`
    ], 'warning')

    return NextResponse.json({ 
      error: `สลิปไม่ถูกต้อง: ชื่อผู้รับโอนคือ "${receiverName}" ซึ่งไม่ตรงกับบัญชีที่กำหนด`, 
      code: 'RECEIVER_MISMATCH' 
    }, { status: 400 })
  }

  // Check if student has pending credit for this period
  const { data: pendingCredit } = await adminClient
    .from('payment_credits')
    .select('id, amount')
    .eq('user_id', profile.id)
    .eq('period_id', period_id)
    .eq('status', 'pending')
    .maybeSingle()

  // Load tier settings to calculate expected amount
  const { data: settings } = await adminClient.from('system_settings').select('*')
  const tierAmounts = {
    A: parseFloat(settings?.find((s: any) => s.key === 'tier_a_amount')?.value || '60'),
    B: parseFloat(settings?.find((s: any) => s.key === 'tier_b_amount')?.value || '50'),
    C: parseFloat(settings?.find((s: any) => s.key === 'tier_c_amount')?.value || '30'),
  }
  const tierAmount = tierAmounts[profile.tier as 'A' | 'B' | 'C'] ?? tierAmounts.B

  // Determine if late fine is applicable (only if no credit and it's past deadline)
  const lateFine = calculateLateFine(
    {
      deadline: periodSetting?.deadline || new Date().toISOString(),
      fine_type: periodSetting?.fine_type ?? 'flat',
      fine_rate: periodSetting?.fine_rate ?? 0,
      fine_cap: periodSetting?.fine_cap ?? null,
      fine_grace_days: periodSetting?.fine_grace_days ?? 0,
      late_fine_amount: periodSetting?.late_fine_amount ?? 0,
    },
    new Date(),
    !!pendingCredit
  )
  const expectedStudentAmount = tierAmount + lateFine

  // 6. Amount Validation — server-side comparison AFTER OCR
  if (ocrResult.amount !== null && ocrResult.amount !== expectedStudentAmount) {
    await notifyAdmins('Amount Mismatch Blocked', [
      `ผู้ส่ง: ${profile.fullname}`,
      `งวด: ${cycleTitle}`,
      `ยอดเงินในสลิป: ฿${ocrResult.amount}`,
      `ยอดเงินที่ต้องการ: ฿${expectedStudentAmount}`
    ], 'warning')

    return NextResponse.json({ 
      error: `ยอดเงินในสลิป (฿${ocrResult.amount}) ไม่ตรงกับยอดชำระที่กำหนดของงวดนี้ (฿${expectedStudentAmount})`, 
      code: 'AMOUNT_MISMATCH' 
    }, { status: 400 })
  }

  // 7. Storage & DB (Upload image only after all validations pass!)
  const ext = file.type.split('/')[1]
  const filename = `${profile.id}/period-${period_id}-${Date.now()}.${ext}`
  const { error: uploadError } = await adminClient.storage.from('slips').upload(filename, buffer, { contentType: file.type, upsert: true })
  if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(filename)

  // If student has credit and uploaded a valid slip, auto-approve the payment and resolve credit
  const autoApprove = !!pendingCredit
  const paymentData = {
    user_id: profile.id,
    period_id,
    amount: ocrResult.amount || 0,
    trans_ref: ocrResult.trans_ref,
    slip_url: publicUrl,
    status: autoApprove ? ('approved' as const) : ('pending' as const),
    verified_at: autoApprove ? new Date().toISOString() : null,
    file_hash: fileHash,
  }

  const { data: payment, error: paymentError } = existing
    ? await adminClient.from('payments').update(paymentData).eq('id', existing.id).select().single()
    : await adminClient.from('payments').insert(paymentData).select().single()

  if (paymentError) {
    await adminClient.storage.from('slips').remove([filename])
    return NextResponse.json({ error: 'Failed to save payment record' }, { status: 500 })
  }

  // Auto-resolve pending credit if payment is approved immediately
  if (autoApprove && pendingCredit) {
    await adminClient
      .from('payment_credits')
      .update({
        status: 'repaid',
        repaid_at: new Date().toISOString(),
        repaid_via: payment.id
      })
      .eq('id', pendingCredit.id)
  }

  // Try to set verified_by_api flag (column may not exist if migration not run yet)
  try {
    await adminClient.from('payments').update({ verified_by_api: true }).eq('id', payment.id)
  } catch (_) {
    // Column not yet migrated — safe to ignore
  }

  await logAction({ actorId: profile.id, action: 'payment_uploaded', targetId: payment.id, newValue: paymentData })

  // 8. Notify (auto-approve path vs. normal pending path)
  if (autoApprove) {
    // Auto-approved because student had a pending credit — notify them
    const thaiDate = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    await adminClient.from('notifications').insert({
      user_id: profile.id,
      title: 'ชำระเงินสำเร็จ (หักล้างยอดค้าง)',
      message: `รายการ "${cycleTitle}" จำนวน ฿${paymentData.amount.toLocaleString()} ได้รับการอนุมัติอัตโนมัติเนื่องจากยอดค้างชำระถูกเคลียร์แล้ว`,
      type: 'success',
    })
    if (profile.line_user_id) {
      try {
        await sendPaymentApproved(profile.line_user_id, cycleTitle, paymentData.amount, thaiDate)
      } catch (e) {
        console.error('[Upload AutoApprove] Failed to send LINE notification:', e)
      }
    }
    await notifyAdmins('Slip Auto-Approved (Credit)', [
      `จาก: ${profile.fullname}`,
      `รหัสนักศึกษา: ${profile.student_id}`,
      `รายการ: ${cycleTitle}`,
      `ยอดเงิน: ฿${paymentData.amount.toLocaleString()} (อนุมัติอัตโนมัติ — มียอดค้างชำระ credit)`
    ], 'info')
  } else {
    await notifyAdmins('New Slip Received', [
      `จาก: ${profile.fullname}`,
      `รหัสนักศึกษา: ${profile.student_id}`,
      `รายการ: ${cycleTitle}`,
      `ยอดเงิน: ฿${paymentData.amount.toLocaleString()}`
    ], 'info')
  }

  return NextResponse.json({ success: true, payment, ocr: ocrResult })
}
