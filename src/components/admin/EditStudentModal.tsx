'use client'

import { useState, useEffect } from 'react'
import { X, Save, Loader2, User, CreditCard, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface EditStudentModalProps {
  isOpen: boolean
  onClose: () => void
  student: any
}

export default function EditStudentModal({ isOpen, onClose, student }: EditStudentModalProps) {
  const [formData, setFormData] = useState({
    fullname: student.fullname,
    student_id: student.student_id,
    role: student.role,
    verified: student.verified
  })
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setFormData({
      fullname: student.fullname,
      student_id: student.student_id,
      role: student.role,
      verified: student.verified
    })
  }, [student])

  if (!isOpen) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error)
      }

      toast.success('อัปเดตข้อมูลนักศึกษาเรียบร้อยแล้ว')
      router.refresh()
      onClose()
    } catch (error: any) {
      toast.error('ไม่สามารถบันทึกข้อมูลได้: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-secondary w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <User className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h3 className="text-[16px] font-black text-text-primary uppercase tracking-tight italic">แก้ไขข้อมูลนักศึกษา</h3>
              <p className="text-[11px] text-text-muted font-bold tracking-wider uppercase">{student.fullname}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1">ชื่อ-นามสกุล</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={formData.fullname}
                  onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[14px] font-bold text-text-primary focus:ring-2 focus:ring-brand/20 transition-all outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1">รหัสนักศึกษา</label>
              <input
                type="text"
                required
                maxLength={8}
                value={formData.student_id}
                onChange={(e) => setFormData({ ...formData, student_id: e.target.value.replace(/\D/g, '') })}
                className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[14px] font-mono font-bold text-text-primary focus:ring-2 focus:ring-brand/20 transition-all outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1">บทบาท</label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[14px] font-bold text-text-primary focus:ring-2 focus:ring-brand/20 transition-all outline-none appearance-none cursor-pointer"
                >
                  <option value="student">นักศึกษา</option>
                  <option value="treasurer">เหรัญญิก</option>
                  <option value="admin">แอดมิน</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-text-muted uppercase tracking-widest mb-1.5 ml-1">การยืนยัน</label>
                <select
                  value={formData.verified ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, verified: e.target.value === 'true' })}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[14px] font-bold text-text-primary focus:ring-2 focus:ring-brand/20 transition-all outline-none appearance-none cursor-pointer"
                >
                  <option value="true">ยืนยันแล้ว</option>
                  <option value="false">ยังไม่ยืนยัน</option>
                </select>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-background border border-border text-text-secondary rounded-xl text-[13px] font-bold hover:bg-background-tertiary transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-brand text-white rounded-xl text-[13px] font-black uppercase tracking-wider hover:bg-brand-hover transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              บันทึกข้อมูล
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
