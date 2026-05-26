'use client'

import { useState, useEffect } from 'react'
import Topbar from '@/components/layout/Topbar'
import IncomeForm from '@/components/incomes/IncomeForm'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function AdminIncomesPage() {
  const [incomes, setIncomes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved'>('all')

  const fetchIncomes = async () => {
    setLoading(true)
    const res = await fetch('/api/incomes')
    const data = await res.json()
    setIncomes(data.incomes ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchIncomes() }, [])

  const handleAddIncome = async (data: { title: string; description?: string; amount: number; source: string }) => {
    const res = await fetch('/api/incomes', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data) 
    })
    if (res.ok) {
      toast.success('เพิ่มรายการรายรับแล้ว')
      setShowForm(false)
      fetchIncomes()
    } else {
      toast.error('เกิดข้อผิดพลาด')
    }
  }

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/incomes/${id}/approve`, { method: 'PATCH' })
    if (res.ok) { 
      toast.success('อนุมัติและแจ้งเตือนทุกคนแล้ว')
      fetchIncomes() 
    } else {
      toast.error('เกิดข้อผิดพลาด')
    }
  }

  const filtered = incomes.filter((i) => {
    if (filterStatus === 'pending') return !i.approved_by
    if (filterStatus === 'approved') return !!i.approved_by
    return true
  })

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          title="รายรับ (แหล่งอื่น)"
          subtitle={`${incomes.length} รายการ`}
          actions={
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 bg-emerald-600 text-white text-[12.5px] font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> เพิ่มรายรับ
            </button>
          }
        />

        {/* Filter */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background-secondary">
          <div className="flex border border-border rounded-lg overflow-hidden text-[12.5px]">
            {(['all', 'pending', 'approved'] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 font-medium transition-colors ${filterStatus === s ? 'bg-emerald-600 text-white' : 'bg-background text-text-secondary hover:bg-background-secondary'}`}>
                {s === 'all' ? 'ทั้งหมด' : s === 'pending' ? 'รอดำเนินการ' : 'อนุมัติแล้ว'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-background-tertiary border-b border-border sticky top-0">
              <tr>
                {['วันที่', 'ชื่อรายการ', 'แหล่งที่มา', 'จำนวน', 'สร้างโดย', 'สถานะ', 'การดำเนินการ'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-text-muted text-[11px] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-text-muted">กำลังโหลด...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-text-muted">ไม่พบรายการ</td></tr>
              ) : filtered.map((i) => (
                <tr key={i.id} className="hover:bg-background-secondary transition-colors">
                  <td className="px-4 py-3 text-text-muted">{formatDate(i.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">
                    <div>{i.title}</div>
                    {i.description && <div className="text-[11px] text-text-muted font-normal">{i.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{i.source ?? '—'}</td>
                  <td className="px-4 py-3 font-bold text-emerald-600 text-right">{formatCurrency(i.amount)}</td>
                  <td className="px-4 py-3 text-text-muted">{i.creator?.fullname ?? '—'}</td>
                  <td className="px-4 py-3">
                    {i.approved_by ? (
                      <span className="text-[10.5px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">อนุมัติแล้ว</span>
                    ) : (
                      <span className="text-[10.5px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">รอดำเนินการ</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!i.approved_by && (
                      <button onClick={() => handleApprove(i.id)}
                        className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors">
                        <CheckCircle className="w-3 h-3" /> อนุมัติ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Form */}
      {showForm && (
        <div className="w-[440px] border-l border-border flex flex-col bg-background-secondary shadow-2xl">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="text-[14px] font-semibold text-text-primary uppercase tracking-tight italic">เพิ่มรายรับใหม่</div>
            <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text-primary transition-colors text-[13px]">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <IncomeForm onSubmit={handleAddIncome} onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
