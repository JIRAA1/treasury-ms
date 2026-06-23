'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useDialog } from '@/components/shared/GlobalDialog'

interface QuickApproveButtonProps {
  paymentId: string
}

export default function QuickApproveButton({ paymentId }: QuickApproveButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const dialog = useDialog()

  const handleApprove = async () => {
    dialog.show({
      type: 'confirm',
      title: 'อนุมัติสลิป',
      message: 'คุณตรวจสอบความถูกต้องของสลิปและยอดเงินเรียบร้อยแล้วใช่หรือไม่?',
      onConfirm: async () => {
        dialog.setLoading(true)
        setLoading(true)
        try {
          const res = await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              id: paymentId, 
              action: 'approve'
            })
          })

          const data = await res.json()
          if (!res.ok) {
            throw new Error(data.error)
          }

          if (data.warning) {
            toast.warning(`อนุมัติสำเร็จ แต่แจ้งเตือน LINE ล้มเหลว: ${data.warning}`, { duration: 6000 })
          } else {
            toast.success('อนุมัติสลิปเรียบร้อยแล้ว')
          }
          dialog.hide()
          router.refresh()
        } catch (error: any) {
          toast.error('อนุมัติไม่สำเร็จ: ' + error.message)
          dialog.setLoading(false)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  return (
    <button 
      onClick={handleApprove}
      disabled={loading}
      className="flex items-center justify-center gap-1 text-[11px] font-medium text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
      อนุมัติ
    </button>
  )
}
