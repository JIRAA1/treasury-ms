'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Check, Banknote, Loader2, X, Trash2, Edit } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import EditStudentModal from './EditStudentModal'
import { useDialog } from '@/components/shared/GlobalDialog'

interface StudentManagementActionsProps {
  studentId: string
  week: number
  amount: number
  existingPayment?: any
  isProfileActions?: boolean
  studentData?: any
}

export default function StudentManagementActions({ 
  studentId, 
  week, 
  amount, 
  existingPayment,
  isProfileActions = false,
  studentData
}: StudentManagementActionsProps) {
  const [loading, setLoading] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()
  const dialog = useDialog()

  const isPaid = existingPayment?.status === 'approved'

  const handleCashPayment = async () => {
    dialog.show({
      type: 'confirm',
      title: 'ยืนยันรับเงินสด',
      message: `คุณได้รับเงินสดจำนวน ฿${amount.toLocaleString()} จากนักศึกษาสำหรับงวดที่ ${week} แล้วใช่หรือไม่?`,
      onConfirm: async () => {
        dialog.setLoading(true)
        try {
          const paymentData = {
            user_id: studentId,
            week,
            amount,
            status: 'approved',
            note: 'ชำระด้วยเงินสด (บันทึกโดยเหรัญญิก)',
            verified_at: new Date().toISOString(),
          }

          const { data: updatedPayment, error } = existingPayment?.id
            ? await supabase.from('payments').update(paymentData).eq('id', existingPayment.id).select().single()
            : await supabase.from('payments').insert(paymentData).select().single()

          if (error) throw error
          
          await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: updatedPayment.id, action: 'notify_only', type: 'cash_success' })
          })

          toast.success('บันทึกการชำระเงินสดเรียบร้อยแล้ว')
          dialog.hide()
          router.refresh()
        } catch (error: any) {
          toast.error('เกิดข้อผิดพลาด: ' + error.message)
          dialog.setLoading(false)
        }
      }
    })
  }

  const handleToggleStatus = async (newStatus: 'approved' | 'rejected' | 'pending') => {
    const statusText = newStatus === 'approved' ? 'อนุมัติ' : newStatus === 'rejected' ? 'ปฏิเสธ' : 'ยกเลิกการอนุมัติ'
    
    dialog.show({
      type: newStatus === 'rejected' ? 'warning' : 'confirm',
      title: `${statusText}รายการ`,
      message: `คุณต้องการ${statusText}รายการชำระเงินงวดที่ ${week} นี้ใช่หรือไม่?`,
      onConfirm: async () => {
        dialog.setLoading(true)
        try {
          const { error } = await supabase
            .from('payments')
            .update({ 
              status: newStatus,
              verified_at: newStatus === 'approved' ? new Date().toISOString() : null 
            })
            .eq('id', existingPayment.id)

          if (error) throw error

          await fetch('/api/payments/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: existingPayment.id, action: 'notify_only', status: newStatus })
          })

          toast.success(`อัปเดตสถานะเป็น ${statusText} เรียบร้อยแล้ว`)
          dialog.hide()
          router.refresh()
        } catch (error: any) {
          toast.error('เกิดข้อผิดพลาด: ' + error.message)
          dialog.setLoading(false)
        }
      }
    })
  }

  const handleDeleteUser = async () => {
    dialog.show({
      type: 'error',
      title: 'ลบนักศึกษา',
      message: 'คำเตือน: ข้อมูลนักศึกษาและประวัติการชำระเงินทั้งหมดจะถูกลบถาวร ไม่สามารถกู้คืนได้ คุณแน่ใจใช่หรือไม่?',
      onConfirm: async () => {
        dialog.setLoading(true)
        try {
          const res = await fetch(`/api/students/${studentId}`, { method: 'DELETE' })
          if (!res.ok) {
            const data = await res.json()
            throw new Error(data.error)
          }
          
          toast.success('ลบข้อมูลนักศึกษาเรียบร้อยแล้ว')
          dialog.hide()
          router.push('/admin/students')
        } catch (error: any) {
          toast.error('ลบไม่สำเร็จ: ' + error.message)
          dialog.setLoading(false)
        }
      }
    })
  }

  if (isProfileActions) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setIsEditModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border text-text-primary text-[12px] font-medium rounded-lg hover:bg-background-tertiary transition-colors"
        >
          <Edit className="w-3.5 h-3.5" />
          แก้ไข
        </button>
        <button
          onClick={handleDeleteUser}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-[12px] font-medium rounded-lg border border-red-100 hover:bg-red-100 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          ลบนักศึกษา
        </button>

        <EditStudentModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} student={studentData} />
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      {isPaid ? (
        <button
          onClick={() => handleToggleStatus('pending')}
          className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100"
          title="ยกเลิกการอนุมัติ"
        >
          <X className="w-4 h-4" />
        </button>
      ) : (
        <>
          {existingPayment?.status === 'pending' && (
            <button
              onClick={() => handleToggleStatus('approved')}
              className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
              title="อนุมัติสลิป"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={handleCashPayment}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors"
          >
            <Banknote className="w-3.5 h-3.5" />
            เงินสด
          </button>
        </>
      )}
    </div>
  )
}
