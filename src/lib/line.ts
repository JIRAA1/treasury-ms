const LINE_API = 'https://api.line.me/v2/bot/message'
const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
}

export interface LineProfile {
  userId: string
  displayName: string
  pictureUrl?: string
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

export async function sendLineMessage(to: string, text: string): Promise<boolean> {
  try {
    console.log(`[LINE Push] Sending message to: ${to}`);
    const res = await fetch(`${LINE_API}/push`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        to,
        messages: [{ type: 'text', text }],
      }),
    })
    
    if (!res.ok) {
      const errorData = await res.json();
      console.error(`[LINE Push Error] ID: ${to}`, JSON.stringify(errorData));
    } else {
      console.log(`[LINE Push Success] Message sent to: ${to}`);
    }
    return res.ok
  } catch (e) {
    console.error(`[LINE Push Exception]`, e);
    return false
  }
}

// ─── FLEX MESSAGES ──────────────────────────────────────────

export async function sendOTP(to: string, otp: string) {
  return await fetch(`${LINE_API}/push`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to,
      messages: [{
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
      }]
    })
  })
}

export async function sendPaymentApproved(to: string, cycleTitle: string, amount: number, date: string) {
  return await fetch(`${LINE_API}/push`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to,
      messages: [{
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
                      { type: 'text', text: cycleTitle, wrap: true, color: '#0f172a', size: 'sm', flex: 4, align: 'end', weight: 'bold' }
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
      }]
    })
  })
}

export async function sendPaymentRejected(to: string, cycleTitle: string, reason: string) {
  return await fetch(`${LINE_API}/push`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to,
      messages: [{
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
      }]
    })
  })
}

export async function sendAdminAlert(to: string, title: string, details: string[], type: 'warning' | 'info' | 'error') {
  const colors = { warning: '#b59410', info: '#0f172a', error: '#991b1b' }
  const contents = details.map(d => ({
    type: 'text', text: d, size: 'xs', color: '#4a4a4e', wrap: true, margin: 'xs'
  }))

  return await fetch(`${LINE_API}/push`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to,
      messages: [{
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
      }]
    })
  })
}

export async function sendPaymentReminder(to: string, cycleTitle: string, amount: number, deadline: string) {
  return await fetch(`${LINE_API}/push`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      to,
      messages: [{
        type: 'flex',
        altText: 'แจ้งเตือนยอดค้างชำระ',
        contents: {
          type: 'bubble',
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              { type: 'text', text: 'งวดปัจจุบันกำหนดส่ง', weight: 'bold', color: '#b59410', size: 'sm' },
              { type: 'text', text: cycleTitle, weight: 'bold', size: 'xl', margin: 'md', color: '#0f172a' },
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
                  {
                    type: 'box',
                    layout: 'baseline',
                    spacing: 'sm',
                    contents: [
                      { type: 'text', text: 'กำหนดส่ง', color: '#8e8e93', size: 'sm', flex: 2 },
                      { type: 'text', text: deadline, color: '#991b1b', size: 'sm', flex: 4, align: 'end', weight: 'bold' }
                    ]
                  }
                ]
              },
              {
                type: 'button',
                action: { type: 'uri', label: 'ส่งสลิปหลักฐานการโอน', uri: `${process.env.NEXT_PUBLIC_APP_URL}/student/upload` },
                style: 'primary',
                color: '#0f172a',
                margin: 'xl',
                height: 'sm'
              },
              { type: 'text', text: 'กรุณาดำเนินการให้ตรงตามเวลาที่กำหนด', size: 'xs', color: '#8e8e93', margin: 'md', align: 'center' }
            ]
          }
        }
      }]
    })
  })
}

export async function sendBulkReminder(students: { lineUserId: string; cycleTitle: string; amount: number; deadline: string }[]): Promise<boolean[]> {
  const results: boolean[] = []
  for (const student of students) {
    try {
      const res = await sendPaymentReminder(student.lineUserId, student.cycleTitle, student.amount, student.deadline)
      if (!res.ok) {
        const err = await res.json()
        console.error(`[LINE Push Error] To: ${student.lineUserId}`, JSON.stringify(err))
      }
      results.push(res.ok)
    } catch (e) {
      console.error(`[LINE Push Exception]`, e)
      results.push(false)
    }
    await new Promise((r) => setTimeout(r, 100)) // Slight delay
  }
  return results
}
