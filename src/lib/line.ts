const LINE_API = 'https://api.line.me/v2/bot/message'

/** ─── Dynamic headers ────────────────────────────────────────────────────── */
function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
  }
}

export interface LineProfile {
  userId: string
  displayName: string
  pictureUrl?: string
}

export interface LineSendResult {
  ok: boolean
  status?: number
  message?: string
}

export async function exchangeCode(code: string): Promise<LineProfile> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/line/callback`,
    client_id: process.env.LINE_CHANNEL_ID ?? '',
    client_secret: process.env.LINE_CHANNEL_SECRET ?? '',
  })

  const res = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || 'LINE auth failed')

  // Get profile
  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${data.access_token}` },
  })
  return await profileRes.json()
}

// ─── Shared Push Helper ──────────────────────────────────────────────────────

/**
 * ส่ง messages ไปยัง LINE Push API และ log error ถ้าไม่สำเร็จ
 */
async function postToLinePush(to: string, messages: object[]): Promise<Response> {
  const res = await fetch(`${LINE_API}/push`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ to, messages }),
  })
  if (!res.ok) {
    try {
      const err = await res.clone().json()
      console.error(`[LINE Push Error] to=${to} status=${res.status}`, JSON.stringify(err))
    } catch {
      console.error(`[LINE Push Error] to=${to} status=${res.status} (no JSON body)`)
    }
  }
  return res
}

// ─── sendLineMessage ─────────────────────────────────────────────────────────

export async function sendLineMessage(to: string, text: string): Promise<boolean> {
  try {
    const res = await postToLinePush(to, [{ type: 'text', text }])
    return res.ok
  } catch (e) {
    console.error(`[LINE Push Exception] to=${to}`, e)
    return false
  }
}

// ─── sendMulticastLineMessage ─────────────────────────────────────────────────

/**
 * ส่งข้อความ text เดียวกันไปยัง LINE user หลายคนพร้อมกัน (Multicast API)
 * LINE รองรับสูงสุด 500 user ต่อ request — ถ้าเกินจะตัดเป็น batch อัตโนมัติ
 */
export async function sendMulticastLineMessage(
  userIds: string[],
  text: string
): Promise<boolean> {
  if (userIds.length === 0) return true
  const BATCH = 500
  let allOk = true
  for (let i = 0; i < userIds.length; i += BATCH) {
    const to = userIds.slice(i, i + BATCH)
    try {
      const res = await fetch(`${LINE_API}/multicast`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ to, messages: [{ type: 'text', text }] }),
      })
      if (!res.ok) {
        const err = await res.clone().json().catch(() => null)
        console.error(`[LINE Multicast Error] batch ${i}–${i + to.length} status=${res.status}`, JSON.stringify(err))
        allOk = false
      }
    } catch (e) {
      console.error(`[LINE Multicast Exception] batch ${i}–${i + to.length}`, e)
      allOk = false
    }
  }
  return allOk
}

// ─── FLEX MESSAGES ──────────────────────────────────────────────────────────

export async function sendOTP(to: string, otp: string): Promise<Response> {
  return postToLinePush(to, [{
    type: 'flex',
    altText: `รหัสยืนยันของคุณคือ ${otp}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'ยืนยันตัวตน', weight: 'bold', color: '#0f172a', size: 'sm' },
          { type: 'text', text: otp, weight: 'bold', size: 'xxl', margin: 'md', color: '#0f172a', align: 'center' },
          { type: 'text', text: 'รหัส OTP สำหรับผูกบัญชี (หมดอายุใน 5 นาที)', size: 'xs', color: '#8e8e93', margin: 'md', align: 'center' }
        ]
      }
    }
  }])
}

export async function sendPaymentApproved(to: string, periodLabel: string, amount: number, date: string): Promise<LineSendResult> {
  try {
    const res = await postToLinePush(to, [{
      type: 'flex',
      altText: 'ชำระเงินสำเร็จ',
      contents: {
        type: 'bubble',
        styles: { header: { backgroundColor: '#065f46' } },
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [{ type: 'text', text: 'SUCCESSFUL PAYMENT', color: '#ffffff', size: 'xs', weight: 'bold' }]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: 'ยืนยันยอดเงินสำเร็จ', weight: 'bold', size: 'xl', color: '#0f172a' },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'lg',
              spacing: 'sm',
              contents: [
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    { type: 'text', text: 'รายการ', color: '#8e8e93', size: 'sm', flex: 2 },
                    { type: 'text', text: periodLabel, wrap: true, color: '#0f172a', size: 'sm', flex: 4, align: 'end', weight: 'bold' }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    { type: 'text', text: 'วันที่ชำระ', color: '#8e8e93', size: 'sm', flex: 2 },
                    { type: 'text', text: date, wrap: true, color: '#0f172a', size: 'sm', flex: 4, align: 'end' }
                  ]
                },
                {
                  type: 'box',
                  layout: 'baseline',
                  spacing: 'sm',
                  contents: [
                    { type: 'text', text: 'จำนวนเงิน', color: '#8e8e93', size: 'sm', flex: 2 },
                    { type: 'text', text: `฿${amount.toLocaleString()}`, wrap: true, color: '#065f46', size: 'md', flex: 4, align: 'end', weight: 'bold' }
                  ]
                }
              ]
            },
            { type: 'separator', margin: 'xxl' },
            { type: 'text', text: 'ขอบคุณที่ชำระเงินตรงเวลา', size: 'xs', color: '#8e8e93', margin: 'md', align: 'center' }
          ]
        }
      }
    }])
    if (!res.ok) {
      let message = 'LINE API error'
      try {
        const err = await res.clone().json()
        message = err.message || message
      } catch {}
      return { ok: false, status: res.status, message }
    }
    return { ok: true, status: res.status }
  } catch (e) {
    console.error(`[LINE sendPaymentApproved Exception] to=${to}`, e)
    return { ok: false, message: e instanceof Error ? e.message : 'Unknown exception' }
  }
}

export async function sendPaymentRejected(to: string, cycleTitle: string, reason: string): Promise<LineSendResult> {
  try {
    const res = await postToLinePush(to, [{
      type: 'flex',
      altText: 'สลิปถูกปฏิเสธ',
      contents: {
        type: 'bubble',
        styles: { header: { backgroundColor: '#991b1b' } },
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [{ type: 'text', text: 'PAYMENT REJECTED', color: '#ffffff', size: 'xs', weight: 'bold' }]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: 'ตรวจสอบสลิปไม่ผ่าน', weight: 'bold', size: 'xl', color: '#0f172a' },
            { type: 'text', text: cycleTitle, size: 'sm', color: '#8e8e93', margin: 'xs', weight: 'bold' },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'lg',
              paddingAll: 'lg',
              backgroundColor: '#fef2f2',
              cornerRadius: 'md',
              contents: [
                { type: 'text', text: 'สาเหตุที่ไม่ผ่าน:', color: '#991b1b', size: 'xs', weight: 'bold' },
                { type: 'text', text: reason, wrap: true, color: '#991b1b', size: 'sm', margin: 'xs' }
              ]
            },
            { type: 'text', text: 'กรุณาอัปโหลดสลิปใหม่อีกครั้งในระบบ', size: 'xs', color: '#8e8e93', margin: 'xl', align: 'center' }
          ]
        }
      }
    }])
    if (!res.ok) {
      let message = 'LINE API error'
      try {
        const err = await res.clone().json()
        message = err.message || message
      } catch {}
      return { ok: false, status: res.status, message }
    }
    return { ok: true, status: res.status }
  } catch (e) {
    console.error(`[LINE sendPaymentRejected Exception] to=${to}`, e)
    return { ok: false, message: e instanceof Error ? e.message : 'Unknown exception' }
  }
}

export async function sendAdminAlert(to: string, title: string, details: string[], type: 'warning' | 'info' | 'error'): Promise<boolean> {
  const colors = { warning: '#b59410', info: '#0f172a', error: '#991b1b' }
  const contents = details.map(d => ({
    type: 'text', text: d, size: 'xs', color: '#4a4a4e', wrap: true, margin: 'xs'
  }))

  try {
    const res = await postToLinePush(to, [{
      type: 'flex',
      altText: title,
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          backgroundColor: colors[type],
          contents: [{ type: 'text', text: title.toUpperCase(), color: '#ffffff', size: 'xs', weight: 'bold' }]
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'text', text: 'Admin Notification', weight: 'bold', size: 'sm', color: colors[type] },
            {
              type: 'box',
              layout: 'vertical',
              margin: 'md',
              spacing: 'xs',
              contents: contents as any
            }
          ]
        }
      }
    }])
    return res.ok
  } catch (e) {
    console.error(`[LINE sendAdminAlert Exception] to=${to}`, e)
    return false
  }
}

export async function sendPaymentReminder(
  to: string,
  periodLabel: string,
  amount: number,
  deadline: string,
  openDate?: string,
  closeDate?: string,
  /** ค่าปรับสะสม ณ ปัจจุบัน (บาท) — ถ้าส่งมาจะแสดงในการแจ้งเตือน */
  fineAmount?: number
) {
  const timeContents: object[] = []
  if (openDate) {
    timeContents.push({
      type: 'box',
      layout: 'baseline',
      spacing: 'sm',
      contents: [
        { type: 'text', text: 'วันที่เปิดรับ', color: '#8e8e93', size: 'sm', flex: 2 },
        { type: 'text', text: openDate, color: '#0f172a', size: 'sm', flex: 4, align: 'end', weight: 'bold' }
      ]
    })
  }
  if (closeDate) {
    timeContents.push({
      type: 'box',
      layout: 'baseline',
      spacing: 'sm',
      contents: [
        { type: 'text', text: 'วันที่ปิดรับ', color: '#991b1b', size: 'sm', flex: 2 },
        { type: 'text', text: closeDate, color: '#991b1b', size: 'sm', flex: 4, align: 'end', weight: 'bold' }
      ]
    })
  }
  if (!openDate && !closeDate) {
    timeContents.push({
      type: 'box',
      layout: 'baseline',
      spacing: 'sm',
      contents: [
        { type: 'text', text: 'กำหนดส่ง', color: '#8e8e93', size: 'sm', flex: 2 },
        { type: 'text', text: deadline, color: '#991b1b', size: 'sm', flex: 4, align: 'end', weight: 'bold' }
      ]
    })
  }

  // Fine amount section (shown only when fineAmount > 0)
  const fineContents: object[] = fineAmount && fineAmount > 0 ? [
    { type: 'separator', margin: 'lg' },
    {
      type: 'box',
      layout: 'vertical',
      margin: 'md',
      paddingAll: 'md',
      backgroundColor: '#fef3c7',
      cornerRadius: 'md',
      contents: [
        { type: 'text', text: '⚠️ ค่าปรับสะสม ณ วันนี้', color: '#92400e', size: 'xs', weight: 'bold' },
        { type: 'text', text: `฿${fineAmount.toLocaleString()}`, color: '#b45309', size: 'lg', weight: 'bold', margin: 'xs', align: 'center' },
        { type: 'separator', margin: 'md' },
        {
          type: 'box',
          layout: 'baseline',
          margin: 'md',
          spacing: 'sm',
          contents: [
            { type: 'text', text: 'ยอดโอนรวมค่าปรับ', color: '#92400e', size: 'sm', flex: 3, weight: 'bold' },
            { type: 'text', text: `฿${(amount + fineAmount).toLocaleString()}`, color: '#b45309', size: 'md', flex: 3, align: 'end', weight: 'bold' }
          ]
        },
        { type: 'text', text: 'ยิ่งช้ายิ่งเสียเพิ่ม — ชำระเร็ว ๆ นี้!', size: 'xxs', color: '#92400e', margin: 'xs', align: 'center' }
      ]
    }
  ] : []

  return postToLinePush(to, [{
    type: 'flex',
    altText: `แจ้งเตือน: ยอดค้างชำระ ${periodLabel} ฿${amount.toLocaleString()}${fineAmount && fineAmount > 0 ? ` + ค่าปรับ ฿${fineAmount.toLocaleString()} (รวม ฿${(amount + fineAmount).toLocaleString()})` : ''}`,
    contents: {
      type: 'bubble',
      styles: { header: { backgroundColor: '#b59410' } },
      header: {
        type: 'box',
        layout: 'vertical',
        contents: [{ type: 'text', text: 'PAYMENT REMINDER', color: '#ffffff', size: 'xs', weight: 'bold' }]
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'แจ้งเตือนยอดค้างชำระ', weight: 'bold', color: '#b59410', size: 'sm' },
          { type: 'text', text: periodLabel, weight: 'bold', size: 'xl', margin: 'md', color: '#0f172a' },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'lg',
            spacing: 'sm',
            contents: [
              {
                type: 'box',
                layout: 'baseline',
                spacing: 'sm',
                contents: [
                  { type: 'text', text: 'ยอดที่ต้องชำระ', color: '#8e8e93', size: 'sm', flex: 2 },
                  { type: 'text', text: `฿${amount.toLocaleString()}`, color: '#0f172a', size: 'sm', flex: 4, align: 'end', weight: 'bold' }
                ]
              },
              ...timeContents as any
            ]
          },
          ...fineContents as any,
          {
            type: 'button',
            action: { type: 'uri', label: 'ส่งสลิปหลักฐานการโอน', uri: `${process.env.NEXT_PUBLIC_APP_URL}/student/upload` },
            style: 'primary',
            color: '#b59410',
            margin: 'xl',
            height: 'sm'
          },
          { type: 'text', text: 'กรุณาดำเนินการให้ตรงตามเวลาที่กำหนด', size: 'xs', color: '#8e8e93', margin: 'md', align: 'center' }
        ]
      }
    }
  }])
}

export async function sendBulkReminder(students: {
  lineUserId: string
  periodLabel: string
  amount: number
  deadline: string
  openDate?: string
  closeDate?: string
  /** ค่าปรับ ณ ปัจจุบัน (บาท) */
  fineAmount?: number
}[]): Promise<boolean[]> {
  const results: boolean[] = []
  for (const student of students) {
    try {
      const res = await sendPaymentReminder(
        student.lineUserId,
        student.periodLabel,
        student.amount,
        student.deadline,
        student.openDate,
        student.closeDate,
        student.fineAmount
      )
      results.push(res.ok)
    } catch (e) {
      console.error(`[LINE Push Exception] to=${student.lineUserId}`, e)
      results.push(false)
    }
    await new Promise((r) => setTimeout(r, 100)) // Slight delay
  }
  return results
}
