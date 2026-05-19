'use client'

import { useState } from 'react'
import { X, Save, Loader2, UserPlus, Users, AlertCircle, FileText, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useDialog } from '@/components/shared/GlobalDialog'

interface AddStudentModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AddStudentModal({ isOpen, onClose }: AddStudentModalProps) {
  const [mode, setStep] = useState<'choice' | 'single' | 'bulk'>('choice')
  const [loading, setLoading] = useState(false)
  const [singleData, setSingleData] = useState({ fullname: '', student_id: '' })
  const [bulkData, setBulkData] = useState('')
  const router = useRouter()
  const dialog = useDialog()

  if (!isOpen) return null

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/admin/students/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'single', data: singleData })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      toast.success('เพิ่มนักศึกษาเรียบร้อยแล้ว')
      router.refresh()
      onClose()
    } catch (error: any) {
      toast.error('ล้มเหลว: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const lines = bulkData.trim().split('\n').filter(l => l.trim())
    if (lines.length === 0) return
    
    setLoading(true)
    try {
      const students = lines.map(line => {
        const [id, ...nameParts] = line.split(/[,\s\t]+/).filter(x => x)
        return { student_id: id, fullname: nameParts.join(' ') }
      }).filter(s => s.student_id && s.fullname)

      const res = await fetch('/api/admin/students/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'bulk', data: students })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      toast.success(`เพิ่มนักศึกษาสำเร็จ ${data.count} คน`)
      router.refresh()
      onClose()
    } catch (error: any) {
      toast.error('ล้มเหลว: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-secondary w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h3 className="text-[16px] font-black text-text-primary uppercase tracking-tight italic">เพิ่มรายชื่อนักศึกษา</h3>
              <p className="text-[11px] text-text-muted font-bold tracking-wider uppercase">จัดการฐานข้อมูลสมาชิก</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Choice Step */}
        {mode === 'choice' && (
          <div className="p-8 grid grid-cols-2 gap-4">
            <button
              onClick={() => setStep('single')}
              className="flex flex-col items-center gap-4 p-8 rounded-3xl border border-border bg-background hover:border-brand/40 hover:bg-brand/[0.02] transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-brand/5 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-brand" />
              </div>
              <div className="text-center">
                <div className="text-[14px] font-black text-text-primary uppercase italic">เพิ่มรายคน</div>
                <p className="text-[11px] text-text-muted mt-1 font-medium">กรอกชื่อและรหัสทีละคน</p>
              </div>
            </button>

            <button
              onClick={() => setStep('bulk')}
              className="flex flex-col items-center gap-4 p-8 rounded-3xl border border-border bg-background hover:border-brand/40 hover:bg-brand/[0.02] transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6 text-emerald-600" />
              </div>
              <div className="text-center">
                <div className="text-[14px] font-black text-text-primary uppercase italic">เพิ่มทีละหลายคน</div>
                <p className="text-[11px] text-text-muted mt-1 font-medium">ก๊อปปี้รายชื่อจาก Excel</p>
              </div>
            </button>
          </div>
        )}

        {/* Single Mode */}
        {mode === 'single' && (
          <form onSubmit={handleSingleSubmit} className="p-8 space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">ชื่อ-นามสกุล</label>
                <input
                  type="text"
                  required
                  placeholder="เช่น นายสมชาย ใจดี"
                  value={singleData.fullname}
                  onChange={(e) => setSingleData({ ...singleData, fullname: e.target.value })}
                  className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-[14px] font-bold text-text-primary focus:ring-2 focus:ring-brand/10 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">รหัสนักศึกษา (8 หลัก)</label>
                <input
                  type="text"
                  required
                  maxLength={8}
                  placeholder="6XXXXXXXX"
                  value={singleData.student_id}
                  onChange={(e) => setSingleData({ ...singleData, student_id: e.target.value.replace(/\D/g, '') })}
                  className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-[14px] font-mono font-bold text-text-primary focus:ring-2 focus:ring-brand/10 outline-none transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('choice')} className="flex-1 py-3.5 rounded-2xl border border-border text-[13px] font-bold text-text-secondary hover:bg-background-tertiary">ย้อนกลับ</button>
              <button type="submit" disabled={loading} className="flex-[2] py-3.5 bg-brand text-white rounded-2xl text-[13px] font-black uppercase tracking-widest hover:bg-brand-hover shadow-xl shadow-brand/20 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                บันทึกรายชื่อ
              </button>
            </div>
          </form>
        )}

        {/* Bulk Mode */}
        {mode === 'bulk' && (
          <form onSubmit={handleBulkSubmit} className="p-8 space-y-6">
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-[11.5px] text-amber-800 leading-relaxed">
                <p className="font-bold uppercase tracking-tight mb-1">คำแนะนำการเพิ่มข้อมูล:</p>
                <p>วางข้อมูลในรูปแบบ: <code className="bg-white px-1 rounded font-bold">รหัสนักศึกษา [วรรค] ชื่อ-นามสกุล</code></p>
                <p className="mt-1 opacity-80">ตัวอย่าง: 65012345 นายสมชาย ใจดี (หนึ่งคนต่อหนึ่งบรรทัด)</p>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">วางรายการรายชื่อที่นี่</label>
              <textarea
                required
                rows={8}
                placeholder="65010001 นายกอ ไก่&#10;65010002 นายขอ ไข่"
                value={bulkData}
                onChange={(e) => setBulkData(e.target.value)}
                className="w-full bg-background border border-border rounded-3xl px-5 py-4 text-[13px] font-medium text-text-primary focus:ring-2 focus:ring-brand/10 outline-none transition-all custom-scrollbar"
              />
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep('choice')} className="flex-1 py-3.5 rounded-2xl border border-border text-[13px] font-bold text-text-secondary hover:bg-background-tertiary">ย้อนกลับ</button>
              <button type="submit" disabled={loading || !bulkData.trim()} className="flex-[2] py-3.5 bg-brand text-white rounded-2xl text-[13px] font-black uppercase tracking-widest hover:bg-brand-hover shadow-xl shadow-brand/20 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                นำเข้าข้อมูลทั้งหมด
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
