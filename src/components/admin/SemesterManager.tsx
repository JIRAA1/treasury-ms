'use client'

import { useState, useEffect } from 'react'
import { Plus, Check, Loader2, Calendar, Settings, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface Semester {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  periodsCount: number
}

export default function SemesterManager() {
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  const fetchSemesters = async () => {
    try {
      const res = await fetch('/api/semesters')
      if (!res.ok) throw new Error('Failed to fetch semesters')
      const json = await res.json()
      setSemesters(json.data ?? [])
    } catch (err) {
      console.error(err)
      toast.error('ไม่สามารถดึงข้อมูลเทอมได้')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSemesters()
  }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return

    setCreating(true)
    try {
      const res = await fetch('/api/semesters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, description: newDesc }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create semester')

      toast.success('สร้างภาคเรียนสำเร็จ')
      setNewName('')
      setNewDesc('')
      setShowAddForm(false)
      fetchSemesters()
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด')
    } finally {
      setCreating(false)
    }
  }

  const handleActivate = async (id: string) => {
    try {
      const res = await fetch(`/api/semesters/${id}/activate`, {
        method: 'PATCH',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to activate semester')

      toast.success('เปิดใช้งานภาคเรียนเรียบร้อย')
      fetchSemesters()
    } catch (err: any) {
      toast.error(err.message || 'เกิดข้อผิดพลาด')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Active Semester Quick Info */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-[12px] font-black uppercase tracking-widest text-text-muted">รายการภาคเรียนทั้งหมด</h3>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-1 text-[12.5px] font-bold text-brand hover:text-brand-hover transition-colors"
        >
          <Plus className="w-4 h-4" /> เพิ่มภาคเรียนใหม่
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={handleCreate} className="p-5 border border-border rounded-2xl bg-background-tertiary/20 space-y-4 max-w-md">
          <div className="text-[13px] font-bold text-text-primary">สร้างภาคเรียนใหม่</div>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">ชื่อภาคเรียน *</label>
              <input
                type="text"
                placeholder="เช่น 1/2568"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[13px] font-bold text-text-primary outline-none focus:ring-2 focus:ring-brand/10 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">คำอธิบาย</label>
              <textarea
                placeholder="รายละเอียดเพิ่มเติม (ระบุหรือไม่ก็ได้)"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                rows={2}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[12.5px] text-text-secondary outline-none focus:ring-2 focus:ring-brand/10 transition-all resize-none"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2 border border-border rounded-xl text-[12px] font-bold hover:bg-background-secondary transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand text-white rounded-xl text-[12px] font-bold hover:bg-brand-hover transition-colors disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              สร้างภาคเรียน
            </button>
          </div>
        </form>
      )}

      {/* Semester List */}
      <div className="space-y-3">
        {semesters.map((s) => (
          <div
            key={s.id}
            className={`border rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all ${
              s.is_active
                ? 'border-brand bg-brand/5 shadow-md shadow-brand/5'
                : 'border-border bg-background hover:bg-background-tertiary/20'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                s.is_active ? 'bg-brand text-white' : 'bg-background-secondary text-text-muted border border-border'
              }`}>
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14.5px] font-bold text-text-primary">{s.name}</span>
                  {s.is_active && (
                    <span className="inline-flex items-center gap-0.5 px-2.5 py-0.5 bg-brand text-white rounded-full text-[10px] font-bold">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>
                {s.description && (
                  <p className="text-[12px] text-text-muted mt-1 leading-relaxed">{s.description}</p>
                )}
                <div className="text-[11px] text-text-disabled mt-1.5 font-medium">
                  มี {s.periodsCount} งวดชำระเงิน · สร้างเมื่อ {new Date(s.created_at).toLocaleDateString('th-TH')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 self-end md:self-center">
              {!s.is_active && (
                <button
                  onClick={() => handleActivate(s.id)}
                  className="px-4 py-2 border border-brand/30 hover:border-brand text-brand hover:bg-brand/5 rounded-xl text-[12px] font-bold transition-all"
                >
                  ตั้งเป็น Active
                </button>
              )}
              <Link
                href={`/admin/settings/periods?semester_id=${s.id}`}
                className="flex items-center gap-1 px-4 py-2 bg-background-secondary hover:bg-background-tertiary border border-border text-text-secondary hover:text-text-primary rounded-xl text-[12px] font-bold transition-all"
              >
                <Settings className="w-3.5 h-3.5" /> จัดการงวด <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
        ))}

        {semesters.length === 0 && (
          <div className="py-12 border border-dashed border-border rounded-2xl text-center text-text-muted italic text-[13px]">
            ยังไม่มีภาคเรียนในระบบ กรุณากด "เพิ่มภาคเรียนใหม่" เพื่อเริ่มสร้างกำหนดการงวดการชำระเงิน
          </div>
        )}
      </div>
    </div>
  )
}
