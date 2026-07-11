import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { verifySlipByPayload } from '@/lib/thunder'
import { logAction } from '@/lib/audit'
import { extractQRCode } from '@/lib/qr'
import { sendAdminAlert, sendPaymentApproved } from '@/lib/line'
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
  // qr_payload is sent by the client after scanning the slip image
  const clientQrPayload = formData.get('qr_payload') as string | null
  // manual_confirm: true when user explicitly bypasses missing-QR warning
  const manualConfirmRaw = formData.get('manual_confirm') as string | null
  const manualConfirm = manualConfirmRaw === 'true'
  // pay_accumulated: ชำระเงินรวมยอดค้างชำระทุกงวดในสลิปเดียว
  const payAccumulatedRaw = formData.get('pay_accumulated') as string | null
  const payAccumulated = payAccumulatedRaw === 'true'
  // accumulated_period_ids: รายการ period_id ที่ต้องการชำระรวม (JSON string)
  const accumulatedPeriodIdsRaw = formData.get('accumulated_period_ids') as string | null
  const accumulatedPeriodIds: string[] = payAccumulated && accumulatedPeriodIdsRaw
    ? JSON.parse(accumulatedPeriodIdsRaw)
    : []

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

  // 2.5. File Hash — ป้องกัน duplicate ไฟล์เดิมส่งซ้ำ
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

  // ────────────────────────────────────────────────────────────────────────────
  // 3. Resolve QR Payload
  //    Priority: (1) client-sent payload → (2) server-side scan
  // ────────────────────────────────────────────────────────────────────────────
  let qrPayload: string | null = clientQrPayload || null

  if (!qrPayload) {
    // Fallback: extract QR from image on the server
    const serverQrData = await extractQRCode(buffer)
    if (serverQrData) {
      const parsed = parseSlipQR(serverQrData)
      if (parsed.isValid) {
        qrPayload = serverQrData
      }
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 4. Load tier/fine settings (needed for matchAmount and amount validation)
  // ────────────────────────────────────────────────────────────────────────────
  const { data: pendingCredit } = await adminClient
    .from('payment_credits')
    .select('id, amount')
    .eq('user_id', profile.id)
    .eq('period_id', period_id)
    .eq('status', 'pending')
    .maybeSingle()

  const { data: settings } = await adminClient.from('system_settings').select('*')
  const tierAmounts = {
    A: parseFloat(settings?.find((s: any) => s.key === 'tier_a_amount')?.value || '60'),
    B: parseFloat(settings?.find((s: any) => s.key === 'tier_b_amount')?.value || '50'),
    C: parseFloat(settings?.find((s: any) => s.key === 'tier_c_amount')?.value || '30'),
  }
  const tierAmount = tierAmounts[profile.tier as 'A' | 'B' | 'C'] ?? tierAmounts.B
  // คำนวณยอดเงินฐานตามสัดส่วน Tier × ยอดของงวดที่ชำระ
  // สูตร: period.amount × (tierAmount / Tier B standard)
  const standardAmount = tierAmounts.B || 50
  const tierRatio = tierAmount / standardAmount

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
  const expectedStudentAmount = (periodSetting?.amount ?? 0) * tierRatio + lateFine

  // ────────────────────────────────────────────────────────────────────────────
  // 5. NO QR PATH — save for manual review if user explicitly confirmed
  // ────────────────────────────────────────────────────────────────────────────
  if (!qrPayload) {
    if (!manualConfirm) {
      return NextResponse.json({
        error: 'ไม่พบ QR Code ในสลิป กรุณาส่งสลิปที่มี QR Code ชัดเจน หรือยืนยันส่งเพื่อให้เหรัญญิกตรวจสอบ',
        code: 'NO_QR_CODE'
      }, { status: 400 })
    }

    console.warn('[Upload] No QR found — saving slip for manual review (user confirmed)')
    await notifyAdmins('🔔 สลิปรอตรวจมือ (ไม่มี QR Code)', [
      `ผู้ส่ง: ${profile?.fullname}`,
      `รหัสนักศึกษา: ${profile?.student_id}`,
      `รายการ: ${cycleTitle}`,
      `เหตุผล: ไม่พบ QR Code ในสลิป กรุณาตรวจสลิปด้วยตนเอง`
    ], 'warning')

    const ext = file.type.split('/')[1]
    const filename = `${profile.id}/period-${period_id}-${Date.now()}.${ext}`
    const { error: uploadError } = await adminClient.storage.from('slips').upload(filename, buffer, { contentType: file.type, upsert: true })
    if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(filename)

    const paymentData = {
      user_id: profile.id,
      period_id,
      amount: 0,
      trans_ref: null,
      slip_url: publicUrl,
      status: 'pending' as const,
      file_hash: fileHash,
      note: 'no_qr_code',
    }

    const { data: payment, error: paymentError } = existing
      ? await adminClient.from('payments').update(paymentData).eq('id', existing.id).select().single()
      : await adminClient.from('payments').insert(paymentData).select().single()

    if (paymentError) {
      await adminClient.storage.from('slips').remove([filename])
      return NextResponse.json({ error: 'Failed to save payment record' }, { status: 500 })
    }

    try {
      await adminClient.from('payments').update({ verified_by_api: false }).eq('id', payment.id)
    } catch (_) { /* column may not exist yet */ }

    await logAction({ actorId: profile.id, action: 'payment_uploaded', targetId: payment.id, newValue: { ...paymentData, note: 'no_qr_code' } })

    return NextResponse.json({
      success: true,
      payment: { ...payment, verified_by_api: false },
      ocr: null,
      quota_exceeded: false,
      message: 'ส่งสลิปสำเร็จ — เหรัญญิกจะตรวจสอบสลิปของคุณด้วยตนเองเนื่องจากไม่พบ QR Code'
    })
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 6. QR PATH — check transRef duplicate in DB first
  // ────────────────────────────────────────────────────────────────────────────
  const parsedQR = parseSlipQR(qrPayload)
  if (parsedQR.isValid && parsedQR.transRef) {
    // ตรวจสอบสลิปซ้ำ: ครอบคลุมทั้ง trans_ref ตรง และ _carry_ suffix
    const { data: dupRows } = await adminClient
      .from('payments')
      .select('id, user_id, status')
      .or(`trans_ref.eq.${parsedQR.transRef},trans_ref.like.${parsedQR.transRef}_carry_%`)
      .neq('status', 'rejected')
      .limit(1)

    const dupPayment = dupRows?.[0] ?? null

    if (dupPayment) {
      const isOwnSlip = dupPayment.user_id === profile.id
      await notifyAdmins('Duplicate Slip Blocked (TransRef)', [
        `ผู้ส่ง: ${profile.fullname}`,
        `งวด: ${cycleTitle}`,
        `เหตุผล: สลิปนี้ซ้ำในระบบ (Trans Ref: ${parsedQR.transRef})`
      ], 'warning')

      return NextResponse.json({
        error: isOwnSlip
          ? 'คุณเคยส่งสลิปรายการโอนนี้ในระบบแล้ว'
          : 'สลิปนี้ถูกใช้ชำระเงินโดยนักศึกษาคนอื่นในระบบแล้ว',
        code: 'DUPLICATE_SLIP'
      }, { status: 409 })
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 7. คำนวณยอดรวมกรณีทบงวด และ Call Thunder API
  // ────────────────────────────────────────────────────────────────────────────
  let accumulatedPeriodDetails: { id: string; label: string; tierAmount: number; lateFine: number; totalAmount: number }[] = []
  let totalExpectedAmount = expectedStudentAmount

  if (payAccumulated && accumulatedPeriodIds.length > 0) {
    // ดึงข้อมูลงวดที่ค้างชำระทั้งหมดมาคำนวณยอดรวม
    const { data: accPeriods } = await adminClient
      .from('periods')
      .select('id, label, amount, deadline, open_at, late_fine_amount, fine_type, fine_rate, fine_cap, fine_grace_days')
      .in('id', accumulatedPeriodIds)

    if (accPeriods && accPeriods.length > 0) {
      // Server-side validation: กรองงวดที่ยังไม่เปิดรับชำระ (upcoming) ออก
      const now = new Date()
      const validAccPeriods = accPeriods.filter(ap => {
        if (!ap.open_at) return true // ไม่มี open_at = เปิดรับเสมอ
        return new Date(ap.open_at) <= now
      })

      if (validAccPeriods.length < accPeriods.length) {
        const blockedPeriods = accPeriods.filter(ap => ap.open_at && new Date(ap.open_at) > now)
        console.warn(`[Upload] Blocked ${blockedPeriods.length} upcoming period(s) from accumulated payment: ${blockedPeriods.map(p => p.label).join(', ')}`)
      }

      for (const ap of validAccPeriods) {
        if (ap.id === period_id) continue // งวดหลักคิดไปแล้วใน expectedStudentAmount
        const { data: accCredit } = await adminClient
          .from('payment_credits')
          .select('id')
          .eq('user_id', profile.id)
          .eq('period_id', ap.id)
          .eq('status', 'pending')
          .maybeSingle()

        const accFine = calculateLateFine(
          {
            deadline: ap.deadline,
            fine_type: ap.fine_type ?? 'flat',
            fine_rate: ap.fine_rate ?? 0,
            fine_cap: ap.fine_cap ?? null,
            fine_grace_days: ap.fine_grace_days ?? 0,
            late_fine_amount: ap.late_fine_amount ?? 0,
          },
          new Date(),
          !!accCredit
        )
        const accBaseAmount = (ap.amount ?? 0) * tierRatio
        const accTotal = accBaseAmount + accFine
        accumulatedPeriodDetails.push({ id: ap.id, label: ap.label, tierAmount: accBaseAmount, lateFine: accFine, totalAmount: accTotal })
        totalExpectedAmount += accTotal
      }
    }
  }

  const remarkPeriods = payAccumulated && accumulatedPeriodDetails.length > 0
    ? `${cycleTitle} + ${accumulatedPeriodDetails.map(p => p.label).join(', ')}`
    : cycleTitle

  const apiResult = await verifySlipByPayload(qrPayload, {
    matchAccount: true,
    matchAmount: totalExpectedAmount,
    remark: `Period - ${remarkPeriods} | ${profile.student_id}`,
  })

  // --- QUOTA EXCEEDED PATH ---
  if (apiResult.quota_exceeded) {
    console.warn('[Upload] Thunder quota exceeded — saving slip for manual review')
    await notifyAdmins('🔔 สลิปรอตรวจมือ (API Quota หมด)', [
      `ผู้ส่ง: ${profile?.fullname}`,
      `รหัสนักศึกษา: ${profile?.student_id}`,
      `รายการ: ${cycleTitle}`,
      `เหตุผล: Thunder API quota หมดแล้ว กรุณาตรวจสลิปด้วยตนเอง`
    ], 'warning')

    const ext = file.type.split('/')[1]
    const filename = `${profile.id}/period-${period_id}-${Date.now()}.${ext}`
    const { error: uploadError } = await adminClient.storage.from('slips').upload(filename, buffer, { contentType: file.type, upsert: true })
    if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(filename)

    const paymentData = {
      user_id: profile.id,
      period_id,
      amount: 0,
      trans_ref: parsedQR.isValid ? parsedQR.transRef : null,
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

    try {
      await adminClient.from('payments').update({ verified_by_api: false }).eq('id', payment.id)
    } catch (_) { /* column may not exist yet */ }

    await logAction({ actorId: profile.id, action: 'payment_uploaded', targetId: payment.id, newValue: { ...paymentData, note: 'quota_exceeded' } })

    return NextResponse.json({
      success: true,
      payment: { ...payment, verified_by_api: false },
      ocr: null,
      quota_exceeded: true,
      message: 'ส่งสลิปสำเร็จ — เหรัญญิกจะตรวจสอบยอดเงินด้วยตนเองเนื่องจาก API หมด quota'
    })
  }

  // --- NORMAL VERIFICATION PATH ---
  if (!apiResult.is_valid) {
    await notifyAdmins('Invalid Slip Attempt', [
      `ผู้ส่ง: ${profile?.fullname || user.id}`,
      `งวด: ${cycleTitle}`,
      `เหตุผล: ไม่พบข้อมูลการโอนเงินหรือ QR Payload ไม่ถูกต้อง`
    ], 'error')

    return NextResponse.json({
      error: 'ตรวจสอบสลิปไม่สำเร็จ: ไม่พบข้อมูลการโอนเงินหรือ QR Code ไม่ถูกต้องตามมาตรฐานธนาคาร',
      code: 'INVALID_SLIP'
    }, { status: 400 })
  }

  // 8. Amount Validation — use isAmountMatched from API if available, fallback to manual compare
  //    กรณีทบงวด: ตรวจสอบกับยอดรวม (totalExpectedAmount)
  const slipAmount = apiResult.amount
  const amountMatched = apiResult.is_amount_matched !== null
    ? apiResult.is_amount_matched
    : (slipAmount === null || slipAmount === totalExpectedAmount)

  if (!amountMatched) {
    await notifyAdmins('Amount Mismatch Blocked', [
      `ผู้ส่ง: ${profile.fullname}`,
      `งวด: ${remarkPeriods}`,
      `ยอดเงินในสลิป: ฿${slipAmount}`,
      `ยอดเงินที่ต้องการ: ฿${totalExpectedAmount}${payAccumulated ? ' (รวมยอดทบงวด)' : ''}`
    ], 'warning')

    return NextResponse.json({
      error: `ยอดเงินในสลิป (฿${slipAmount}) ไม่ตรงกับยอดชำระที่กำหนด (฿${totalExpectedAmount})${payAccumulated ? ' — รวมยอดค้างชำระทุกงวดที่เลือก' : ''}`,
      code: 'AMOUNT_MISMATCH'
    }, { status: 400 })
  }

  // 9. Storage & DB — Upload image only after all validations pass!
  const ext = file.type.split('/')[1]
  const filename = `${profile.id}/period-${period_id}-${Date.now()}.${ext}`
  const { error: uploadError } = await adminClient.storage.from('slips').upload(filename, buffer, { contentType: file.type, upsert: true })
  if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(filename)

  // If student has credit and uploaded a valid slip, auto-approve the payment and resolve credit
  const autoApprove = !!pendingCredit
  const transRef = apiResult.trans_ref || (parsedQR.isValid ? parsedQR.transRef : null)

  // ─── 9a. บันทึก payment งวดหลัก ────────────────────────────────────────────
  const paymentData = {
    user_id: profile.id,
    period_id,
    amount: payAccumulated ? expectedStudentAmount : (slipAmount || expectedStudentAmount),
    trans_ref: transRef,
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

  try {
    await adminClient.from('payments').update({ verified_by_api: true }).eq('id', payment.id)
  } catch (_) { /* column may not exist yet */ }

  await logAction({ actorId: profile.id, action: 'payment_uploaded', targetId: payment.id, newValue: paymentData })

  // ─── 9b. กรณีทบงวด: บันทึก payment งวดค้างแต่ละงวดด้วย _carry_ suffix ────
  const carryPayments: Array<{ period_id: string; label: string; amount: number }> = []

  if (payAccumulated && accumulatedPeriodDetails.length > 0) {
    const carryStatus = autoApprove ? ('approved' as const) : ('pending' as const)

    for (const acc of accumulatedPeriodDetails) {
      const carryTransRef = transRef ? `${transRef}_carry_${acc.id}` : null
      const carryPaymentData = {
        user_id: profile.id,
        period_id: acc.id,
        amount: acc.totalAmount,
        trans_ref: carryTransRef,
        slip_url: publicUrl,              // ใช้รูปสลิปเดียวกัน
        file_hash: carryTransRef          // ใช้ carry trans_ref เป็น hash เพื่อหลีกเลี่ยง unique constraint ของ file_hash
          ? createHash('sha256').update(carryTransRef).digest('hex')
          : fileHash,
        status: carryStatus,
        verified_at: autoApprove ? new Date().toISOString() : null,
        note: `accumulated_with:${period_id}`,
      }

      // ตรวจสอบว่างวดค้างนั้นเคยชำระและถูก rejected หรือยังไม่มีรายการ
      const { data: existingCarry } = await adminClient
        .from('payments')
        .select('id, status')
        .eq('user_id', profile.id)
        .eq('period_id', acc.id)
        .maybeSingle()

      const { data: carryPayment, error: carryError } = existingCarry
        ? await adminClient.from('payments').update(carryPaymentData).eq('id', existingCarry.id).select().single()
        : await adminClient.from('payments').insert(carryPaymentData).select().single()

      if (carryError) {
        console.error(`[Upload Accumulated] Failed to save carry payment for period ${acc.id}:`, carryError)
        // ไม่ abort ทั้ง transaction เพราะงวดหลักบันทึกแล้ว แจ้ง warning แทน
        await notifyAdmins('⚠️ Carry Payment Insert Failed', [
          `จาก: ${profile.fullname}`,
          `รายการ: ${acc.label}`,
          `ข้อผิดพลาด: ${carryError.message}`,
          `สลิปหลักบันทึกแล้ว (period: ${cycleTitle}) กรุณาแก้ไขด้วยตนเอง`
        ], 'error')
        continue
      }

      if (carryPayment) {
        try {
          await adminClient.from('payments').update({ verified_by_api: true }).eq('id', carryPayment.id)
        } catch (_) { /* column may not exist yet */ }
        await logAction({
          actorId: profile.id,
          action: 'payment_uploaded',
          targetId: carryPayment.id,
          newValue: { ...carryPaymentData, carry_for_period: period_id },
        })
        carryPayments.push({ period_id: acc.id, label: acc.label, amount: acc.totalAmount })
      }
    }
  }

  // 10. Notify
  const isAccumulated = payAccumulated && carryPayments.length > 0
  if (autoApprove) {
    const thaiDate = new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    await adminClient.from('notifications').insert({
      user_id: profile.id,
      title: isAccumulated ? 'ชำระเงินสำเร็จ (หักล้างยอดค้าง — รวมทบงวด)' : 'ชำระเงินสำเร็จ (หักล้างยอดค้าง)',
      message: isAccumulated
        ? `ชำระสำเร็จ ${[cycleTitle, ...carryPayments.map(p => p.label)].join(', ')} รวม ฿${totalExpectedAmount.toLocaleString()} (อนุมัติอัตโนมัติ)`
        : `รายการ "${cycleTitle}" จำนวน ฿${paymentData.amount.toLocaleString()} ได้รับการอนุมัติอัตโนมัติเนื่องจากยอดค้างชำระถูกเคลียร์แล้ว`,
      type: 'success',
    })
    if (profile.line_user_id) {
      try {
        await sendPaymentApproved(profile.line_user_id, remarkPeriods, totalExpectedAmount, thaiDate)
      } catch (e) {
        console.error('[Upload AutoApprove] Failed to send LINE notification:', e)
      }
    }
    await notifyAdmins('Slip Auto-Approved (Credit)', [
      `จาก: ${profile.fullname}`,
      `รหัสนักศึกษา: ${profile.student_id}`,
      `รายการ: ${remarkPeriods}`,
      `ยอดเงิน: ฿${totalExpectedAmount.toLocaleString()} (อนุมัติอัตโนมัติ — มียอดค้างชำระ credit)`
    ], 'info')
  } else {
    await notifyAdmins(isAccumulated ? 'New Slip Received (รวมทบงวด)' : 'New Slip Received', [
      `จาก: ${profile.fullname}`,
      `รหัสนักศึกษา: ${profile.student_id}`,
      `รายการ: ${remarkPeriods}`,
      `ยอดเงิน: ฿${totalExpectedAmount.toLocaleString()}${isAccumulated ? ` (รวม ${carryPayments.length + 1} งวด)` : ''}`,
      `Trans Ref: ${transRef || 'ไม่ระบุ'}`
    ], 'info')
  }

  return NextResponse.json({
    success: true,
    payment,
    accumulated: isAccumulated ? carryPayments : [],
    ocr: {
      amount: slipAmount,
      trans_ref: transRef,
      date: apiResult.date,
      bank: apiResult.bank,
    }
  })
}



