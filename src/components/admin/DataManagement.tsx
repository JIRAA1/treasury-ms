'use client'

import { useState } from 'react'
import { Trash2, AlertOctagon, RefreshCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/shared/GlobalDialog'

export default function DataManagement() {
  const [loading, setLoading] = useState<string | null>(null)
  const dialog = useDialog()

  const handleAction = async (action: 'clear_payments' | 'reset_all') => {
    const isResetAll = action === 'reset_all'
    
    dialog.show({
      type: isResetAll ? 'error' : 'warning',
      title: isResetAll ? 'รีเซ็ตระบบทั้งหมด' : 'ล้างประวัติการชำระ',
      message: isResetAll 
        ? 'คำเตือนสูงสุด: ข้อมูลรายรับ รายจ่าย และประวัติทั้งหมดจะถูกลบถาวร ยกเว้นรายชื่อนักศึกษา คุณแน่ใจใช่หรือไม่?'
        : 'คุณต้องการล้างประวัติการโอนเงินและไฟล์สลิปทั้งหมดใช่หรือไม่? รายชื่อนักศึกษาจะยังอยู่เหมือนเดิม',
      onConfirm: async () => {
        dialog.setLoading(true)
        setLoading(action)
        try {
          const res = await fetch('/api/admin/system/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action })
          })
          const data = await res.json()
          if (!res.ok) throw new Error(data.error)
          
          toast.success(data.message)
          dialog.hide()
          setTimeout(() => window.location.reload(), 1500)
        } catch (error: any) {
          toast.error('ล้มเหลว: ' + error.message)
          dialog.setLoading(false)
        } finally {
          setLoading(null)
        }
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Clear Payments Only */}
        <div className="border border-border rounded-xl p-5 bg-background">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-50 rounded-lg">
              <RefreshCcw className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-[14px] font-bold text-text-primary">ล้างประวัติการชำระเงิน</h4>
              <p className="text-[12px] text-text-muted mt-1 leading-relaxed">
                ลบข้อมูลการโอนเงินและไฟล์รูปภาพสลิปทั้งหมด ยอดเงินรายรับจะกลายเป็น 0 
                เหมาะสำหรับเริ่มเดือนใหม่ หรือเริ่มภาคเรียนใหม่
              </p>
              <button
                onClick={() => handleAction('clear_payments')}
                disabled={!!loading}
                className="mt-4 px-4 py-2 bg-amber-600 text-white text-[12px] font-bold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading === 'clear_payments' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                ล้างประวัติการชำระ
              </button>
            </div>
          </div>
        </div>

        {/* Reset Everything */}
        <div className="border border-red-100 rounded-xl p-5 bg-red-50/30">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-100 rounded-lg">
              <AlertOctagon className="w-5 h-5 text-red-600" />
            </div>
            <div className="flex-1">
              <h4 className="text-[14px] font-bold text-red-700">รีเซ็ตระบบการเงินทั้งหมด</h4>
              <p className="text-[12px] text-red-600/70 mt-1 leading-relaxed">
                ลบข้อมูลทุกอย่างในระบบ (รายรับ, รายจ่าย, ประวัติการทำงาน) ยกเว้นรายชื่อนักศึกษา 
                ใช้ในกรณีต้องการล้างข้อมูลทดสอบทั้งหมด
              </p>
              <button
                onClick={() => handleAction('reset_all')}
                disabled={!!loading}
                className="mt-4 px-4 py-2 bg-red-600 text-white text-[12px] font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading === 'reset_all' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                รีเซ็ตข้อมูลทั้งหมด
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-background-tertiary border border-border rounded-lg p-4">
        <h5 className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-2">คำแนะนำเรื่องความปลอดภัย</h5>
        <ul className="text-[11.5px] text-text-muted space-y-1 list-disc list-inside">
          <li>การลบข้อมูลจะไม่มีผลกระทบต่อบัญชี LINE ของนักศึกษา</li>
          <li>ข้อมูลที่ลบแล้วจะไม่สามารถเรียกคืนได้ กรุณาสำรองข้อมูล (Export Excel) ก่อนดำเนินการ</li>
          <li>การลบประวัติการชำระจะช่วยคืนพื้นที่จัดเก็บ (Storage) ให้กับโปรเจคของคุณ</li>
        </ul>
      </div>
    </div>
  )
}
