'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, ShieldAlert, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface DeleteLogButtonProps {
  id: string
}

export function DeleteLogButton({ id }: DeleteLogButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm('คุณแน่ใจหรือไม่ที่จะลบบันทึกประวัตินี้?')) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/audit?id=${id}`, {
        method: 'DELETE',
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาดในการลบข้อมูล')

      toast.success('ลบบันทึกประวัติเรียบร้อยแล้ว')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="p-1.5 text-text-disabled hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center justify-center cursor-pointer"
      title="ลบบันทึกนี้"
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Trash2 className="w-3.5 h-3.5" />
      )}
    </button>
  )
}

export function ClearAllLogsButton() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const handleClearAll = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/audit', {
        method: 'DELETE',
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด')

      toast.success('ล้างประวัติกิจกรรมทั้งหมดสำเร็จแล้ว')
      setShowConfirm(false)
      router.refresh()
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="flex items-center gap-1.5 border border-red-200 bg-red-50/50 hover:bg-red-50 text-red-700 text-[12.5px] font-bold px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
      >
        <Trash2 className="w-3.5 h-3.5" />
        ล้างประวัติทั้งหมด
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs animate-fade-in">
          <div className="bg-background border border-border w-full max-w-md p-6 rounded-2xl shadow-xl space-y-4 animate-scale-in mx-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
                <ShieldAlert className="w-5.5 h-5.5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-[16px] font-bold text-text-primary">ยืนยันการล้างประวัติทั้งหมด?</h3>
                <p className="text-[13px] text-text-secondary leading-relaxed">
                  การกระทำนี้จะลบประวัติกิจกรรม (Audit Logs) ทั้งหมดในระบบอย่างถาวรและไม่สามารถเรียกคืนได้
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="px-4 py-2 text-[12.5px] font-bold text-text-secondary hover:bg-background-tertiary rounded-xl border border-border transition-colors cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleClearAll}
                disabled={loading}
                className="px-4 py-2 text-[12.5px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                ลบประวัติทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
