'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/layout/Topbar'
import KpiCard from '@/components/shared/KpiCard'
import { formatCurrency, getTierConfig } from '@/lib/utils'
import { Search, Users, ChevronRight, Loader2, UserPlus, Download, CheckCircle, Tag } from 'lucide-react'
import Link from 'next/link'
import AddStudentModal from '@/components/admin/AddStudentModal'
import { toast } from 'sonner'
import type { TierType } from '@/types'

interface Student {
  id: string
  fullname: string
  student_id: string
  line_user_id: string | null
  tier: TierType
  tier_note: string | null
  weeksPaid: number
  weeksPending: number
}

// ─── Change Tier Modal ──────────────────────────────────────────────────────
function ChangeTierModal({
  student,
  tierCCount,
  tierCQuota,
  onClose,
  onSuccess,
}: {
  student: Student
  tierCCount: number
  tierCQuota: number
  onClose: () => void
  onSuccess: () => void
}) {
  const [selectedTier, setSelectedTier] = useState<TierType>(student.tier)
  const [tierNote, setTierNote] = useState(student.tier_note ?? '')
  const [saving, setSaving] = useState(false)

  const tierCFull = tierCCount >= tierCQuota && selectedTier === 'C' && student.tier !== 'C'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (selectedTier === student.tier && tierNote === (student.tier_note ?? '')) {
      onClose()
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/students/${student.id}/tier`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: selectedTier, tier_note: tierNote || null }),
      })
      const json = await res.json()
      if (!res.ok) {
        toast.error(json.error ?? 'เกิดข้อผิดพลาด')
        return
      }
      toast.success(`เปลี่ยน Tier ของ ${student.fullname} เป็น Tier ${selectedTier} แล้ว`)
      onSuccess()
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setSaving(false)
    }
  }

  const tiers: TierType[] = ['A', 'B', 'C']
  const tierDescriptions = {
    A: 'สมทบพิเศษ — ฿60/สัปดาห์',
    B: 'มาตรฐาน — ฿50/สัปดาห์',
    C: 'ลดหย่อนชั่วคราว — ฿30/สัปดาห์',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-3xl shadow-2xl w-full max-w-md p-8 border border-border">
        <h2 className="text-[18px] font-black text-text-primary mb-1">เปลี่ยน Tier</h2>
        <p className="text-[12.5px] text-text-muted mb-6">
          {student.fullname} · <span className="font-mono">{student.student_id}</span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tier selector */}
          <div className="grid grid-cols-3 gap-2">
            {tiers.map((t) => {
              const cfg = getTierConfig(t)
              const isCFull = t === 'C' && tierCCount >= tierCQuota && student.tier !== 'C'
              return (
                <button
                  key={t}
                  type="button"
                  disabled={isCFull}
                  onClick={() => setSelectedTier(t)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed ${
                    selectedTier === t
                      ? `${cfg.border} ${cfg.bg} shadow-md`
                      : 'border-border hover:border-border-strong'
                  }`}
                >
                  <span className={`text-[22px] font-black ${cfg.color}`}>{t}</span>
                  <span className="text-[10px] text-text-muted text-center leading-tight">{tierDescriptions[t]}</span>
                  {isCFull && <span className="text-[9px] text-red-500 font-bold">QUOTA เต็ม</span>}
                </button>
              )
            })}
          </div>

          {/* Tier C note */}
          {selectedTier === 'C' && (
            <div>
              <label className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5 block">
                เหตุผลลดหย่อน (แสดงให้นักศึกษาเห็น)
              </label>
              <textarea
                value={tierNote}
                onChange={(e) => setTierNote(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 text-[13px] border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-brand/10 resize-none"
                placeholder="เช่น ลดหย่อนเนื่องจากสถานการณ์ทางการเงิน..."
              />
            </div>
          )}

          {/* Quota indicator */}
          <div className="flex items-center justify-between text-[11.5px] text-text-muted bg-background-secondary px-4 py-3 rounded-xl border border-border">
            <span>โควต้า Tier C</span>
            <span className={`font-black ${tierCCount >= tierCQuota ? 'text-red-500' : 'text-emerald-600'}`}>
              {tierCCount} / {tierCQuota} คน
            </span>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 text-[13px] font-bold border border-border rounded-xl hover:bg-background-secondary transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={saving || tierCFull}
              className="flex-1 py-3 text-[13px] font-bold bg-brand text-white rounded-xl hover:bg-brand-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              บันทึก
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [changeTierStudent, setChangeTierStudent] = useState<Student | null>(null)
  const [exporting, setExporting] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid' | 'pending' | 'A' | 'B' | 'C'>('all')
  const [totalCycles, setTotalCycles] = useState(0)
  const [tierCQuota, setTierCQuota] = useState(5)
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    try {
      const [
        { data: settings },
        { data: users },
        { data: payments },
        { data: sysSettings },
      ] = await Promise.all([
        supabase.from('week_settings').select('week'),
        supabase.from('users').select('id, fullname, student_id, line_user_id, tier, tier_note').eq('role', 'student'),
        supabase.from('payments').select('user_id, status'),
        supabase.from('system_settings').select('key, value').eq('key', 'tier_c_max_quota'),
      ])

      setTotalCycles(settings?.length || 0)
      setTierCQuota(parseInt(sysSettings?.[0]?.value ?? '5', 10))

      const studentData = (users || []).map((u) => {
        const userPayments = payments?.filter((p) => p.user_id === u.id) || []
        return {
          ...u,
          tier: (u.tier ?? 'B') as TierType,
          weeksPaid: userPayments.filter((p) => p.status === 'approved').length,
          weeksPending: userPayments.filter((p) => p.status === 'pending').length,
        }
      })

      setStudents(studentData)
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const res = await fetch('/api/admin/export/csv')
      if (!res.ok) {
        toast.error('ไม่สามารถ Export CSV ได้')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      a.download = match?.[1] ?? 'payments_export.csv'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('Export CSV สำเร็จ')
    } catch {
      toast.error('เกิดข้อผิดพลาดระหว่าง Export')
    } finally {
      setExporting(false)
    }
  }

  const tierCCount = students.filter((s) => s.tier === 'C').length
  const tierBreakdown = {
    A: students.filter((s) => s.tier === 'A').length,
    B: students.filter((s) => s.tier === 'B').length,
    C: tierCCount,
  }

  const filtered = students.filter((s) => {
    const matchesSearch = s.fullname.toLowerCase().includes(search.toLowerCase()) || s.student_id.includes(search)
    if (!matchesSearch) return false

    if (filter === 'paid') return s.weeksPaid === totalCycles && totalCycles > 0
    if (filter === 'unpaid') return s.weeksPaid < totalCycles
    if (filter === 'pending') return s.weeksPending > 0
    if (filter === 'A' || filter === 'B' || filter === 'C') return s.tier === filter
    return true
  })

  const fullyPaid = students.filter((s) => s.weeksPaid === totalCycles && totalCycles > 0).length

  return (
    <div>
      <Topbar
        title="จัดการนักศึกษา"
        subtitle="รายชื่อนักศึกษาและสถานะการชำระเงินรายคน"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={exporting}
              className="flex items-center gap-2 bg-background border border-border text-text-secondary text-[12px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-background-secondary transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span className="hidden sm:inline">Export CSV</span>
            </button>
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-2 bg-brand text-white text-[12px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95"
            >
              <UserPlus className="w-4 h-4" />
              <span className="hidden sm:inline">เพิ่มรายชื่อ</span>
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-5">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard label="ทั้งหมด" value={students.length} sub="คน" />
          <KpiCard label="ชำระครบแล้ว" value={fullyPaid} sub="คน" subVariant="positive" />
          <KpiCard label="ค้างชำระ" value={students.length - fullyPaid} sub="คน" subVariant="danger" />
          <KpiCard label="รวมงวดทั้งหมด" value={totalCycles} sub="งวด" />
        </div>

        {/* Tier Distribution + Quota */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(['A', 'B', 'C'] as TierType[]).map((t) => {
            const cfg = getTierConfig(t)
            const count = tierBreakdown[t]
            const isC = t === 'C'
            return (
              <div
                key={t}
                className={`${cfg.bg} ${cfg.border} border rounded-2xl p-4 flex items-center gap-4 cursor-pointer transition-all hover:shadow-sm ${filter === t ? 'ring-2 ring-brand/30 shadow-md' : ''}`}
                onClick={() => setFilter(filter === t ? 'all' : t)}
              >
                <div className={`w-12 h-12 rounded-xl ${cfg.bg} border ${cfg.border} flex items-center justify-center`}>
                  <span className={`text-[22px] font-black ${cfg.color}`}>{t}</span>
                </div>
                <div className="flex-1">
                  <div className={`text-[14px] font-black ${cfg.color}`}>Tier {t}</div>
                  <div className="text-[11px] text-text-muted">{cfg.description}</div>
                  {isC && (
                    <div className="mt-1.5">
                      <div className="flex items-center justify-between text-[10px] text-text-muted mb-0.5">
                        <span>โควต้า</span>
                        <span className={`font-black ${count >= tierCQuota ? 'text-red-500' : cfg.color}`}>{count}/{tierCQuota}</span>
                      </div>
                      <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${count >= tierCQuota ? 'bg-red-400' : 'bg-amber-400'}`}
                          style={{ width: `${Math.min((count / tierCQuota) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className={`text-[28px] font-black ${cfg.color}`}>{count}</div>
              </div>
            )
          })}
        </div>

        <div className="bg-background-secondary border border-border rounded-[2rem] overflow-hidden shadow-sm">
          {/* Toolbar */}
          <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือรหัสนักศึกษา..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-[13px] font-bold border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-brand/10 transition-all shadow-inner"
              />
            </div>
            <div className="flex border border-border rounded-xl overflow-hidden p-1 bg-background shadow-inner">
              {(['all', 'paid', 'unpaid', 'pending'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-[11.5px] font-black uppercase tracking-tight transition-all ${
                    filter === f
                      ? 'bg-brand text-white shadow-md'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {f === 'all' ? 'ทั้งหมด' : f === 'paid' ? 'ครบแล้ว' : f === 'unpaid' ? 'ยังค้าง' : 'รอตรวจ'}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-background-tertiary/50 text-text-muted border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest">ชื่อ-นามสกุล</th>
                  <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest">รหัสนักศึกษา</th>
                  <th className="px-6 py-4 text-center font-black text-[10px] uppercase tracking-widest">Tier</th>
                  <th className="px-6 py-4 text-center font-black text-[10px] uppercase tracking-widest">ความคืบหน้า</th>
                  <th className="px-6 py-4 text-center font-black text-[10px] uppercase tracking-widest">ค้างตรวจ</th>
                  <th className="px-6 py-4 text-right font-black text-[10px] uppercase tracking-widest">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr><td colSpan={6} className="py-24 text-center text-text-muted"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" /> กำลังโหลดข้อมูล...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="py-24 text-center text-text-muted italic text-[14px]">ไม่พบข้อมูลนักศึกษาที่ค้นหา</td></tr>
                ) : filtered.map((s) => {
                  const tierCfg = getTierConfig(s.tier)
                  return (
                    <tr key={s.id} className="hover:bg-background-tertiary/30 transition-colors group relative">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-text-primary">{s.fullname}</div>
                          {s.line_user_id ? (
                            <div className="w-3.5 h-3.5 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm shadow-emerald-200" title="เชื่อมต่อ LINE แล้ว">
                              <CheckCircle className="w-2.5 h-2.5 text-white" />
                            </div>
                          ) : (
                            <div className="w-3.5 h-3.5 bg-background-muted rounded-full flex items-center justify-center border border-border" title="ยังไม่ได้เชื่อมต่อ LINE">
                              <div className="w-1.5 h-1.5 bg-text-muted/20 rounded-full" />
                            </div>
                          )}
                        </div>
                        {s.tier === 'C' && s.tier_note && (
                          <div className="text-[10.5px] text-amber-600 mt-0.5 font-medium truncate max-w-[200px]">{s.tier_note}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-text-secondary font-mono font-bold tracking-tighter">{s.student_id}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-1 rounded-lg border ${tierCfg.color} ${tierCfg.bg} ${tierCfg.border}`}>
                          Tier {s.tier}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col items-center gap-1.5">
                          <span className={`text-[11px] font-black italic ${s.weeksPaid === totalCycles && totalCycles > 0 ? 'text-emerald-600' : 'text-text-primary'}`}>
                            {s.weeksPaid} / {totalCycles} COMPLETED
                          </span>
                          <div className="w-28 h-1.5 bg-border rounded-full overflow-hidden shadow-inner">
                            <div
                              className={`h-full transition-all duration-500 ${s.weeksPaid === totalCycles && totalCycles > 0 ? 'bg-emerald-500' : 'bg-brand'}`}
                              style={{ width: `${totalCycles > 0 ? (s.weeksPaid / totalCycles) * 100 : 0}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {s.weeksPending > 0 ? (
                          <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100 font-black text-[10px] uppercase">{s.weeksPending} Items</span>
                        ) : (
                          <span className="text-text-disabled font-medium text-[11px]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setChangeTierStudent(s)}
                            className="inline-flex items-center gap-1 text-[10px] font-black text-text-muted hover:text-brand bg-transparent hover:bg-brand/5 border border-transparent hover:border-brand/10 px-2.5 py-1.5 rounded-xl transition-all"
                          >
                            <Tag className="w-3 h-3" />
                            <span className="hidden md:inline">Tier</span>
                          </button>
                          <Link
                            href={`/admin/students/${s.id}`}
                            className="inline-flex items-center justify-center w-8 h-8 text-text-muted hover:text-brand hover:bg-brand/5 border border-transparent hover:border-brand/10 rounded-xl transition-all group-hover:translate-x-0.5"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AddStudentModal
        isOpen={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); fetchData() }}
      />

      {changeTierStudent && (
        <ChangeTierModal
          student={changeTierStudent}
          tierCCount={tierCCount}
          tierCQuota={tierCQuota}
          onClose={() => setChangeTierStudent(null)}
          onSuccess={() => { setChangeTierStudent(null); fetchData() }}
        />
      )}
    </div>
  )
}
