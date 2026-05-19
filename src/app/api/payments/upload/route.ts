import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { verifySlip } from '@/lib/thunder'
import { logAction } from '@/lib/audit'
import { extractQRCode } from '@/lib/qr'
import { sendLineMessage, sendAdminAlert } from '@/lib/line'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File
  const week = parseInt(formData.get('week') as string)

  if (!file || !week) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
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

  // 1. Quick Check
  const { data: existing } = await supabase
    .from('payments').select('id, status').eq('user_id', user.id).eq('week', week).maybeSingle()

  if (existing && existing.status !== 'rejected') {
    return NextResponse.json({ error: 'คุณได้ส่งสลิปของสัปดาห์นี้ไปแล้ว' }, { status: 409 })
  }

  // 2. OCR Verify
  const ocrResult = await verifySlip(file)

  const { data: nameSetting } = await adminClient.from('system_settings').select('value').eq('key', 'promptpay_name').maybeSingle()
  const expectedName = nameSetting?.value || "ชานน ศ."
  const { data: weekSetting } = await adminClient.from('week_settings').select('title, amount').eq('week', week).maybeSingle()
  const cycleTitle = weekSetting?.title || `งวดที่ ${week}`

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

  // 3. Receiver Validation
  const receiverName = ocrResult.raw?.data?.rawSlip?.receiver?.account?.name?.en || 
                       ocrResult.raw?.data?.rawSlip?.receiver?.account?.name?.th || "";
  
  const isValidReceiver = receiverName.toLowerCase().includes(expectedName.toLowerCase()) || 
                          (receiverName.includes("CHANON S") || receiverName.includes("ชานน ศ"))

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

  // 4. Storage & DB
  const ext = file.type.split('/')[1]
  const filename = `${user.id}/week-${week}-${Date.now()}.${ext}`
  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage.from('slips').upload(filename, bytes, { contentType: file.type, upsert: true })
  if (uploadError) return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  const { data: { publicUrl } } = supabase.storage.from('slips').getPublicUrl(filename)

  const paymentData = {
    user_id: user.id,
    week,
    amount: ocrResult.amount || 0,
    trans_ref: ocrResult.trans_ref,
    slip_url: publicUrl,
    status: 'pending',
  }

  const { data: payment, error: paymentError } = existing
    ? await supabase.from('payments').update(paymentData).eq('id', existing.id).select().single()
    : await supabase.from('payments').insert(paymentData).select().single()

  if (paymentError) return NextResponse.json({ error: 'Failed to save' }, { status: 500 })

  await logAction({ actorId: user.id, action: 'payment_uploaded', targetId: payment.id, newValue: paymentData })

  // 5. Notify Success
  await notifyAdmins('New Slip Received', [
    `จาก: ${profile?.fullname}`,
    `รหัสนักศึกษา: ${profile?.student_id}`,
    `รายการ: ${cycleTitle}`,
    `ยอดเงิน: ฿${paymentData.amount.toLocaleString()}`
  ], 'info')

  return NextResponse.json({ success: true, payment, ocr: ocrResult })
}
