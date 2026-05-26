'use client'

import { useState } from 'react'
import { Bell, Loader2, Send } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/shared/GlobalDialog'

export default function NotificationTrigger() {
  const [loading, setLoading] = useState(false)
  const dialog = useDialog()

  const handleSendReminder = async () => {
    dialog.show({
      type: 'confirm',
      title: 'ส่งแจ้งเตือนยอดค้าง',
      message: 'คุณต้องการส่งข้อความแจ้งเตือนถึงนักศึกษาที่ยังไม่ได้ชำระเงินในงวดปัจจุบันใช่หรือไม่? ระบบจะส่งผ่าน LINE และกระดิ่งในแอป',
      onConfirm: async () => {
        dialog.setLoading(true)
        setLoading(true)
        try {
          const res = await fetch('/api/admin/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              type: 'reminder',
              target: 'all_unpaid'
            })
          })

          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'ส่งแจ้งเตือนไม่สำเร็จ')

          if (data.sent === 0 && data.failed > 0) {
            toast.error(`ส่งแจ้งเตือนไม่สำเร็จ: ล้มเหลวทั้งหมด ${data.failed} คน (โปรดตรวจสอบการเชื่อมต่อ LINE หรือโควตาข้อความ)`)
          } else if (data.failed > 0) {
            toast.warning(`ส่งแจ้งเตือนสำเร็จบางส่วน: สำเร็จ ${data.sent} คน, ล้มเหลว ${data.failed} คน`)
          } else if (data.sent === 0 && data.failed === 0) {
            toast.info('ไม่มีนักศึกษาที่ค้างชำระ หรือดำเนินการเสร็จสิ้นแล้ว')
          } else {
            toast.success(`ส่งแจ้งเตือนเรียบร้อยแล้ว: สำเร็จ ${data.sent} คน`)
          }
          dialog.hide()
        } catch (error: any) {
          toast.error('เกิดข้อผิดพลาด: ' + error.message)
          dialog.setLoading(false)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  return (
    <button
      onClick={handleSendReminder}
      disabled={loading}
      className="bg-background-secondary border border-border rounded-xl p-4 flex items-center gap-3 hover:border-brand/40 hover:bg-background-tertiary transition-colors w-full text-left"
    >
      <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
        {loading ? <Loader2 className="w-4 h-4 text-amber-600 animate-spin" /> : <Bell className="w-4 h-4 text-amber-600" />}
      </div>
      <div>
        <div className="text-[13px] font-bold text-text-primary">ส่งแจ้งเตือน</div>
        <div className="text-[11.5px] text-text-muted">แจ้งนักศึกษาที่ยังไม่ชำระ (LINE & App)</div>
      </div>
    </button>
  )
}
