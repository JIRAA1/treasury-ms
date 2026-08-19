import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { verifySlipByPayload } from '@/lib/thunder'
import { extractQRCode } from '@/lib/qr'
import { sendAdminAlert } from '@/lib/line'
import { parseSlipQR } from '@/lib/slip-qr'
import { createHash } from 'crypto'
import { logAction } from '@/lib/audit'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: collection_id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const item_id = formData.get('item_id') as string
  const selectedPaymentMode = formData.get('payment_mode') as 'full' | 'installment' | null // Sent on 1st time
  const isPayoff = formData.get('is_payoff') === 'true'
  const clientQrPayload = formData.get('qr_payload') as string | null
  const manualConfirm = formData.get('manual_confirm') === 'true'

  if (!file || !item_id) {
    return NextResponse.json({ error: 'Missing required fields: file, item_id' }, { status: 400 })
  }

  // File type & size validation
  const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
  const MAX_SIZE = 5 * 1024 * 1024 // 5MB
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'ประเภทไฟล์ไม่รองรับ รองรับเฉพาะ JPG, PNG, WEBP' }, { status: 415 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'ไฟล์มีขนาดใหญ่เกิน 5MB' }, { status: 413 })
  }

  const adminClient = createAdminClient()

  // Load student profile
  const { data: profile } = await adminClient
    .from('users')
    .select('*')
    .or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'ไม่พบข้อมูลบัญชีผู้ใช้ในระบบ' }, { status: 404 })
  }

  // Load admins for alert
  const { data: admins } = await adminClient
    .from('users')
    .select('fullname, line_user_id')
    .in('role', ['admin', 'treasurer'])

  const notifyAdmins = async (title: string, details: string[], type: 'info' | 'warning' | 'error') => {
    if (!admins) return
    for (const adm of admins) {
      if (adm.line_user_id) {
        await sendAdminAlert(adm.line_user_id, title, details, type)
      }
    }
  }

  // Load item and collection details
  const { data: item } = await adminClient
    .from('special_collection_items')
    .select(`
      *,
      collection:special_collections(*)
    `)
    .eq('id', item_id)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (!item) {
    return NextResponse.json({ error: 'ไม่พบรายการชำระเงินพิเศษสำหรับนักศึกษาคนนี้' }, { status: 404 })
  }

  const collection = item.collection
  if (!collection || !collection.is_active) {
    return NextResponse.json({ error: 'รายการเก็บเงินพิเศษนี้ถูกปิดรับชำระแล้ว' }, { status: 400 })
  }

  // 1. Lock-in Payment Mode Choice (First time payment choice)
  let paymentMode = item.payment_mode
  let chosenInstallments = (item.chosen_installments && item.chosen_installments > 1)
    ? item.chosen_installments
    : (collection.max_installments && collection.max_installments > 1 ? collection.max_installments : 2)

  if (!paymentMode) {
    // Student is making their choice right now
    if (!selectedPaymentMode) {
      return NextResponse.json({ error: 'กรุณาเลือกรูปแบบการชำระเงิน (จ่ายเต็มจำนวน หรือ ผ่อนชำระ)' }, { status: 400 })
    }

    if (selectedPaymentMode === 'installment' && !collection.allow_installments) {
      return NextResponse.json({ error: 'รายการนี้ไม่อนุญาตให้ผ่อนชำระ' }, { status: 400 })
    }

    paymentMode = selectedPaymentMode
    const paramInstallments = parseInt(formData.get('chosen_installments') as string || '0')
    chosenInstallments = selectedPaymentMode === 'installment'
      ? (paramInstallments > 1 ? paramInstallments : (collection.max_installments || 2))
      : 1

    // Update item with locked payment mode
    await adminClient
      .from('special_collection_items')
      .update({
        payment_mode: paymentMode,
        chosen_installments: chosenInstallments,
      })
      .eq('id', item.id)
  }

  // Calculate expected amount for this slip
  const remainingAmount = parseFloat(item.amount) - parseFloat(item.paid_amount || 0)
  if (remainingAmount <= 0) {
    return NextResponse.json({ error: 'รายการนี้คุณชำระเงินครบถ้วนเรียบร้อยแล้ว' }, { status: 400 })
  }

  let expectedSlipAmount = 0
  if (paymentMode === 'full' || isPayoff) {
    expectedSlipAmount = remainingAmount
  } else {
    // Normal installment amount
    const perInstallment = Math.ceil(parseFloat(item.amount) / (chosenInstallments > 1 ? chosenInstallments : 1))
    expectedSlipAmount = Math.min(perInstallment, remainingAmount)
  }

  // 2. File Hash check — prevent duplicate slip image upload
  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const fileHash = createHash('sha256').update(buffer).digest('hex')

  const { data: hashDup } = await adminClient
    .from('special_collection_slips')
    .select('id, item_id')
    .eq('file_hash', fileHash)
    .neq('status', 'rejected')
    .maybeSingle()

  if (hashDup) {
    return NextResponse.json({
      error: 'ไฟล์สลิปนี้ถูกใช้งานไปแล้วในระบบ กรุณาใช้สลิปโอนเงินฉบับใหม่',
      code: 'DUPLICATE_SLIP'
    }, { status: 409 })
  }

  // 3. Resolve QR Payload
  let qrPayload: string | null = clientQrPayload || null
  if (!qrPayload) {
    const serverQrData = await extractQRCode(buffer)
    if (serverQrData) {
      const parsed = parseSlipQR(serverQrData)
      if (parsed.isValid) qrPayload = serverQrData
    }
  }

  // 4. NO QR PATH — Manual review fallback if user confirmed
  if (!qrPayload) {
    if (!manualConfirm) {
      return NextResponse.json({
        error: 'ไม่พบ QR Code ในสลิป กรุณาส่งสลิปที่มี QR Code ชัดเจน หรือยืนยันส่งเพื่อให้เหรัญญิกตรวจสอบด้วยตนเอง',
        code: 'NO_QR_CODE'
      }, { status: 400 })
    }

    // Save slip without QR for manual review
    const ext = file.type.split('/')[1]
    const filename = `special/${collection_id}/${profile.id}-${Date.now()}.${ext}`
    const { error: uploadError } = await adminClient.storage.from('slips').upload(filename, buffer, { contentType: file.type, upsert: true })
    if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(filename)

    // Count existing slips to calculate installment_no
    const { count: slipCount } = await adminClient
      .from('special_collection_slips')
      .select('id', { count: 'exact', head: true })
      .eq('item_id', item.id)

    const slipData = {
      item_id: item.id,
      installment_no: (slipCount || 0) + 1,
      amount: expectedSlipAmount,
      is_payoff: isPayoff || paymentMode === 'full',
      slip_url: publicUrl,
      trans_ref: null,
      file_hash: fileHash,
      status: 'pending' as const,
      verified_by_api: false,
    }

    const { data: newSlip, error: slipErr } = await adminClient
      .from('special_collection_slips')
      .insert(slipData)
      .select()
      .single()

    if (slipErr) {
      return NextResponse.json({ error: 'Failed to save slip record' }, { status: 500 })
    }

    // Update item status to pending
    await adminClient
      .from('special_collection_items')
      .update({ status: 'pending' })
      .eq('id', item.id)

    await notifyAdmins('🔔 สลิปรายการพิเศษรอตรวจมือ (ไม่มี QR)', [
      `ผู้ส่ง: ${profile.fullname}`,
      `รายการ: ${collection.title}`,
      `ยอดเงินที่รอมือตรวจ: ฿${expectedSlipAmount}`,
      `หมายเหตุ: ไม่พบ QR Code ในสลิป`
    ], 'warning')

    return NextResponse.json({
      success: true,
      slip: newSlip,
      verified_by_api: false,
      message: 'ส่งสลิปสำเร็จ — เหรัญญิกจะตรวจสอบสลิปของคุณด้วยตนเองเนื่องจากไม่พบ QR Code'
    })
  }

  // 5. QR PATH — Check TransRef duplicate
  const parsedQR = parseSlipQR(qrPayload)
  if (parsedQR.isValid && parsedQR.transRef) {
    const { data: dupSlip } = await adminClient
      .from('special_collection_slips')
      .select('id')
      .eq('trans_ref', parsedQR.transRef)
      .neq('status', 'rejected')
      .maybeSingle()

    if (dupSlip) {
      return NextResponse.json({
        error: 'สลิปรายการโอนนี้เคยถูกใช้งานในระบบไปแล้ว (TransRef Duplicate)',
        code: 'DUPLICATE_SLIP'
      }, { status: 409 })
    }
  }

  // 6. Call Thunder OCR API Verification
  const apiResult = await verifySlipByPayload(qrPayload, {
    matchAccount: true,
    matchAmount: expectedSlipAmount,
    remark: `SpecialCollection - ${collection.title} | ${profile.student_id}`
  })

  // 7. QUOTA EXCEEDED / SERVICE EXPIRED PATH
  if (apiResult.quota_exceeded) {
    console.warn('[SpecialCollection Upload] Thunder API Quota Exceeded — fallback to manual review')
    const ext = file.type.split('/')[1]
    const filename = `special/${collection_id}/${profile.id}-${Date.now()}.${ext}`
    const { error: uploadError } = await adminClient.storage.from('slips').upload(filename, buffer, { contentType: file.type, upsert: true })
    if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
    const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(filename)

    const { count: slipCount } = await adminClient
      .from('special_collection_slips')
      .select('id', { count: 'exact', head: true })
      .eq('item_id', item.id)

    const slipData = {
      item_id: item.id,
      installment_no: (slipCount || 0) + 1,
      amount: expectedSlipAmount,
      is_payoff: isPayoff || paymentMode === 'full',
      slip_url: publicUrl,
      trans_ref: parsedQR.isValid ? parsedQR.transRef : null,
      file_hash: fileHash,
      status: 'pending' as const,
      verified_by_api: false,
    }

    const { data: newSlip, error: slipErr } = await adminClient
      .from('special_collection_slips')
      .insert(slipData)
      .select()
      .single()

    if (slipErr) {
      return NextResponse.json({ error: 'Failed to save slip record' }, { status: 500 })
    }

    await adminClient
      .from('special_collection_items')
      .update({ status: 'pending' })
      .eq('id', item.id)

    await notifyAdmins('🔔 สลิปรายการพิเศษรอตรวจมือ (API Quota หมด)', [
      `ผู้ส่ง: ${profile.fullname}`,
      `รายการ: ${collection.title}`,
      `ยอดเงินที่รอมือตรวจ: ฿${expectedSlipAmount}`,
      `เหตุผล: Thunder API หมด Quota/หมดอายุ`
    ], 'warning')

    return NextResponse.json({
      success: true,
      slip: newSlip,
      verified_by_api: false,
      quota_exceeded: true,
      message: 'ส่งสลิปสำเร็จ — เหรัญญิกจะตรวจสอบยอดเงินด้วยตนเองเนื่องจาก API ไม่พร้อมให้บริการ'
    })
  }

  // 8. OCR VALIDATION CHECK
  if (!apiResult.is_valid) {
    return NextResponse.json({
      error: 'ตรวจสอบสลิปไม่สำเร็จ: ไม่พบข้อมูลการโอนเงินหรือ QR Code ไม่ถูกต้องตามมาตรฐานธนาคาร',
      code: 'INVALID_SLIP'
    }, { status: 400 })
  }

  const slipAmount = apiResult.amount
  const amountMatched = apiResult.is_amount_matched !== null
    ? apiResult.is_amount_matched
    : (slipAmount === null || slipAmount === expectedSlipAmount)

  if (!amountMatched) {
    return NextResponse.json({
      error: `ยอดเงินในสลิป (฿${slipAmount}) ไม่ตรงกับยอดที่ต้องชำระ (฿${expectedSlipAmount})`,
      code: 'AMOUNT_MISMATCH'
    }, { status: 400 })
  }

  // 9. Storage & Record Slip (Passed Validation!)
  const ext = file.type.split('/')[1]
  const filename = `special/${collection_id}/${profile.id}-${Date.now()}.${ext}`
  const { error: uploadError } = await adminClient.storage.from('slips').upload(filename, buffer, { contentType: file.type, upsert: true })
  if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(filename)

  const transRef = apiResult.trans_ref || (parsedQR.isValid ? parsedQR.transRef : null)

  const { count: slipCount } = await adminClient
    .from('special_collection_slips')
    .select('id', { count: 'exact', head: true })
    .eq('item_id', item.id)

  const slipData = {
    item_id: item.id,
    installment_no: (slipCount || 0) + 1,
    amount: slipAmount || expectedSlipAmount,
    is_payoff: isPayoff || paymentMode === 'full',
    slip_url: publicUrl,
    trans_ref: transRef,
    file_hash: fileHash,
    status: 'pending' as const,
    verified_by_api: true,
  }

  const { data: newSlip, error: slipErr } = await adminClient
    .from('special_collection_slips')
    .insert(slipData)
    .select()
    .single()

  if (slipErr) {
    return NextResponse.json({ error: 'Failed to save slip record' }, { status: 500 })
  }

  // Update item status to pending
  await adminClient
    .from('special_collection_items')
    .update({ status: 'pending' })
    .eq('id', item.id)

  await notifyAdmins('New Special Collection Slip Received', [
    `จาก: ${profile.fullname}`,
    `รายการ: ${collection.title}`,
    `ยอดเงิน: ฿${slipData.amount}`,
    `รูปแบบ: ${paymentMode === 'full' ? 'จ่ายเต็มจำนวน' : isPayoff ? 'ผ่อนชำระ (ปิดยอดค้างทั้งหมด)' : `ผ่อนชำระ (งวดที่ ${slipData.installment_no})`}`
  ], 'info')

  return NextResponse.json({
    success: true,
    slip: newSlip,
    ocr: {
      amount: slipAmount,
      trans_ref: transRef,
      date: apiResult.date,
      bank: apiResult.bank,
    },
    message: 'ส่งสลิปชำระเงินพิเศษสำเร็จ รอเหรัญญิกตรวจสอบอนุมัติ'
  })
}
