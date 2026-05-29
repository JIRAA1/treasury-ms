'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/layout/Topbar'
import KpiCard from '@/components/shared/KpiCard'
import { formatCurrency, formatDate, getCreditStatusLabel, getTierConfig } from '@/lib/utils'
import { Clock, CheckCircle2, Gift, Plus, Loader2, Filter } from 'lucide-react'
import { toast } from 'sonner'
import type { PaymentCredit, WeekSetting, User } from '@/types'

interface CreditRow extends PaymentCredit {
  user: User
  week_info: Pick<WeekSetting, 'title' | 'deadline'>
}

type StatusFilter = 'all' | 'pending' | 'repaid' | 'forgiven'

export default function AdminCreditsPage() {
  const [credits, setCredits] = useState<CreditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  const fetchCredits = useCallback(async () => {
    setLoading(true)
    try {
      const url = filter !== 'all' ? `/api/credits?status=${filter}` : '/api/credits'
      const res = await fetch(url)
      const json = await res.json()
      setCredits(json.credits ?? [])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { fetchCredits() }, [fetchCredits])

  const handleResolve = async (id: string, status: 'repaid' | 'forgiven') => {
    const label = status === 'repaid' ? 'จ่ายคืนแล้ว' : 'ยกให้'
    if (!confirm(`ยืนยัน: ${label} credit นี้?`)) return
    try {
      const res = await fetch(`/api/credits/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const json = await res.json()
        toast.error(json.error ?? 'เกิดข้อผิดพลาด')
        return
      }
      toast.success(`อัปเดต credit เป็น "${label}" แล้ว`)
      fetchCredits()
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    }
  }

  const pending = credits.filter(c => c.status === 'pending')
  const pendingTotal = pending.reduce((s, c) => s + c.amount, 0)
  const resolvedCount = credits.filter(c => c.status !== 'pending').length

  const filtered = filter === 'all' ? credits : credits.filter(c => c.status === filter)

  return (
    <div>
      <Topbar
        title="บันทึก Credit"
        subtitle="ติดตามยอดค้างจ่ายและการผ่อนผันชั่วคราว"
        actions={
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 bg-brand text-white text-[12px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">เพิ่ม Credit</span>
          </button>
        }
      />

      <div className="p-6 space-y-5">
        {/* KPI */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard
            label="ยอดค้างจ่ายรวม"
            value={formatCurrency(pendingTotal)}
            sub={`${pending.length} รายการ`}
            subVariant={pending.length > 0 ? 'warning' : 'neutral'}
          />
          <KpiCard
            label="จำนวนคนที่มี Credit"
            value={new Set(pending.map(c => c.user_id)).size}
            sub="คน"
          />
          <KpiCard
            label="แก้ไขแล้วทั้งหมด"
            value={resolvedCount}
            sub="รายการ"
            subVariant="positive"
          />
        </div>

        {/* Table */}
        <div className="bg-background-secondary border border-border rounded-[2rem] overflow-hidden shadow-sm">
          {/* Filter Bar */}
          <div className="p-5 border-b border-border flex items-center gap-3">
            <Filter className="w-4 h-4 text-text-muted" />
            <div className="flex border border-border rounded-xl overflow-hidden p-1 bg-background shadow-inner">
              {(['all', 'pending', 'repaid', 'forgiven'] as StatusFilter[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-[11.5px] font-black uppercase tracking-tight transition-all ${
                    filter === f
                      ? 'bg-brand text-white shadow-md'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {f === 'all' ? 'ทั้งหมด'
                    : f === 'pending' ? 'ค้างจ่าย'
                    : f === 'repaid' ? 'จ่ายคืนแล้ว'
                    : 'ยกให้แล้ว'}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-background-tertiary/50 text-text-muted border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest">นักศึกษา</th>
                  <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest">สัปดาห์</th>
                  <th className="px-6 py-4 text-right font-black text-[10px] uppercase tracking-widest">ยอดค้าง</th>
                  <th className="px-6 py-4 text-center font-black text-[10px] uppercase tracking-widest">สถานะ</th>
                  <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest">หมายเหตุ</th>
                  <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest">วันที่บันทึก</th>
                  <th className="px-6 py-4 text-right font-black text-[10px] uppercase tracking-widest">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr><td colSpan={7} className="py-20 text-center text-text-muted">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" /> กำลังโหลด...
                  </td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={7} className="py-20 text-center text-text-muted italic">ไม่มีรายการ Credit</td></tr>
                ) : filtered.map((c) => {
                  const statusStyle = getCreditStatusLabel(c.status)
                  const tierCfg = getTierConfig(c.user?.tier ?? 'B')
                  return (
                    <tr key={c.id} className="hover:bg-background-tertiary/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="font-bold text-text-primary">{c.user?.fullname}</div>
                          <span className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md border ${tierCfg.color} ${tierCfg.bg} ${tierCfg.border}`}>
                            {c.user?.tier}
                          </span>
                        </div>
                        <div className="text-[11px] text-text-muted font-mono">{c.user?.student_id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium">W{c.week}</div>
                        <div className="text-[11px] text-text-muted">{c.week_info?.title}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-text-primary">{formatCurrency(c.amount)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-[10.5px] font-black px-2.5 py-1 rounded-full ${statusStyle.bg} ${statusStyle.color}`}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-text-secondary text-[12px] max-w-[180px] truncate">
                        {c.note ?? <span className="text-text-muted italic">—</span>}
                      </td>
                      <td className="px-6 py-4 text-text-muted text-[11px]">{formatDate(c.created_at)}</td>
                      <td className="px-6 py-4 text-right">
                        {c.status === 'pending' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleResolve(c.id, 'repaid')}
                              title="Mark as Repaid"
                              className="flex items-center gap-1 text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 transition-all"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              จ่ายคืน
                            </button>
                            <button
                              onClick={() => handleResolve(c.id, 'forgiven')}
                              title="Forgive"
                              className="flex items-center gap-1 text-[11px] font-black text-sky-700 bg-sky-50 border border-sky-200 px-2.5 py-1.5 rounded-lg hover:bg-sky-100 transition-all"
                            >
                              <Gift className="w-3.5 h-3.5" />
                              ยกให้
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-text-muted italic">
                            {c.repaid_at ? formatDate(c.repaid_at) : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddCreditModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchCredits() }}
        />
      )}
    </div>
  )
}

// ── Add Credit Modal ─────────────────────────────────────────
function AddCreditModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [students, setStudents] = useState<Pick<User, 'id' | 'fullname' | 'student_id' | 'tier'>[]>([])
  const [weeks, setWeeks] = useState<Pick<WeekSetting, 'week' | 'title'>[]>([])
  const [form, setForm] = useState({ user_id: '', week: '', amount: '', note: '' })
  const [saving, setSaving] = useState(false)
  const supabase = useMemo(() => createClient(), [])

  useEffect(() => {
    const load = async () => {
      const [{ data: users }, { data: ws }] = await Promise.all([
        supabase.from('users').select('id, fullname, student_id, tier').eq('role', 'student').order('fullname'),
        supabase.from('week_settings').select('week, title').order('week'),
      ])
      setStudents(users ?? [])
      setWeeks(ws ?? [])
    }
    load()
  }, [supabase])

  // Auto-fill amount from selected student's tier
  useEffect(() => {
    if (!form.user_id) return
    const student = students.find(s => s.id === form.user_id)
    if (student) {
      const tierAmounts: Record<string, number> = { A: 60, B: 50, C: 30 }
      setForm(f => ({ ...f, amount: String(tierAmounts[student.tier] ?? 50) }))
    }
  }, [form.user_id, students])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.user_id || !form.week || !form.amount) {
      toast.error('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: form.user_id,
          week: parseInt(form.week),
          amount: parseFloat(form.amount),
          note: form.note || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'เกิดข้อผิดพลาด'); return }
      toast.success('บันทึก Credit เรียบร้อยแล้ว')
      onSuccess()
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-background rounded-3xl shadow-2xl w-full max-w-md p-8 border border-border">
        <h2 className="text-[18px] font-black text-text-primary mb-1">เพิ่ม Credit ค้างชำระ</h2>
        <p className="text-[12.5px] text-text-muted mb-6">บันทึกการผ่อนผันให้นักศึกษาจ่ายคืนในภายหลัง</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5 block">นักศึกษา</label>
            <select
              value={form.user_id}
              onChange={e => setForm(f => ({ ...f, user_id: e.target.value }))}
              className="w-full px-4 py-3 text-[13px] border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-brand/10"
            >
              <option value="">เลือกนักศึกษา...</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.fullname} ({s.student_id}) — Tier {s.tier}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5 block">สัปดาห์</label>
            <select
              value={form.week}
              onChange={e => setForm(f => ({ ...f, week: e.target.value }))}
              className="w-full px-4 py-3 text-[13px] border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-brand/10"
            >
              <option value="">เลือกสัปดาห์...</option>
              {weeks.map(w => (
                <option key={w.week} value={w.week}>W{w.week} — {w.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5 block">ยอดค้าง (บาท)</label>
            <input
              type="number"
              min="1"
              value={form.amount}
              onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-4 py-3 text-[13px] border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-brand/10"
              placeholder="50"
            />
            <p className="text-[11px] text-text-muted mt-1">กรอกอัตโนมัติจาก Tier ของนักศึกษา</p>
          </div>

          <div>
            <label className="text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5 block">หมายเหตุ (ไม่บังคับ)</label>
            <textarea
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              rows={2}
              className="w-full px-4 py-3 text-[13px] border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-brand/10 resize-none"
              placeholder="เหตุผลที่ผ่อนผัน..."
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 text-[13px] font-bold border border-border rounded-xl hover:bg-background-secondary transition-all">
              ยกเลิก
            </button>
            <button type="submit" disabled={saving} className="flex-1 py-3 text-[13px] font-bold bg-brand text-white rounded-xl hover:bg-brand-hover transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              บันทึก Credit
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
