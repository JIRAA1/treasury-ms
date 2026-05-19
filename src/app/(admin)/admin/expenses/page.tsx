'use client'

import { useState, useEffect } from 'react'
import Topbar from '@/components/layout/Topbar'
import ExpenseForm from '@/components/expenses/ExpenseForm'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, ExternalLink, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import type { Expense } from '@/types'

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved'>('all')

  const fetchExpenses = async () => {
    setLoading(true)
    const res = await fetch('/api/expenses')
    const data = await res.json()
    setExpenses(data.expenses ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchExpenses() }, [])

  const handleAddExpense = async (data: { title: string; description?: string; amount: number; category: string; receipt?: File }) => {
    const formData = new FormData()
    formData.append('title', data.title)
    formData.append('description', data.description ?? '')
    formData.append('amount', data.amount.toString())
    formData.append('category', data.category)
    if (data.receipt) formData.append('receipt', data.receipt)

    const res = await fetch('/api/expenses', { method: 'POST', body: formData })
    if (res.ok) {
      toast.success('เพิ่มรายการค่าใช้จ่ายแล้ว')
      setShowForm(false)
      fetchExpenses()
    } else {
      toast.error('เกิดข้อผิดพลาด')
    }
  }

  const handleApprove = async (id: string) => {
    const res = await fetch(`/api/expenses/${id}/approve`, { method: 'PATCH' })
    if (res.ok) { toast.success('อนุมัติแล้ว'); fetchExpenses() }
    else toast.error('เกิดข้อผิดพลาด')
  }

  const filtered = expenses.filter((e) => {
    if (filterStatus === 'pending') return !e.approved_by
    if (filterStatus === 'approved') return !!e.approved_by
    return true
  })

  const totalApproved = expenses.filter((e) => e.approved_by).reduce((s, e) => s + e.amount, 0)
  const totalPending = expenses.filter((e) => !e.approved_by).reduce((s, e) => s + e.amount, 0)
  const now = new Date()
  const thisMonth = expenses.filter((e) => e.approved_by && new Date(e.created_at).getMonth() === now.getMonth())
    .reduce((s, e) => s + e.amount, 0)

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          title="ค่าใช้จ่าย"
          subtitle={`${expenses.length} รายการ`}
          actions={
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 bg-brand text-white text-[12.5px] font-medium px-3 py-1.5 rounded-lg hover:bg-brand-hover transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> เพิ่มค่าใช้จ่าย
            </button>
          }
        />

        {/* Summary */}
        <div className="px-6 py-3 border-b border-border bg-background-secondary">
          <div className="text-[12px] text-text-muted">
            อนุมัติแล้ว: <span className="font-semibold text-text-primary">{formatCurrency(totalApproved)}</span>
            {' · '}รอดำเนินการ: <span className="font-semibold text-amber-600">{formatCurrency(totalPending)}</span>
            {' · '}เดือนนี้: <span className="font-semibold text-text-primary">{formatCurrency(thisMonth)}</span>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
          <div className="flex border border-border rounded-lg overflow-hidden text-[12.5px]">
            {(['all', 'pending', 'approved'] as const).map((s) => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 font-medium transition-colors ${filterStatus === s ? 'bg-brand text-white' : 'bg-background text-text-secondary hover:bg-background-secondary'}`}>
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
                {['วันที่', 'ชื่อรายการ', 'รายละเอียด', 'จำนวน', 'สร้างโดย', 'สถานะ', 'ใบเสร็จ', 'การดำเนินการ'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-text-muted text-[11px] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 8 }).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-3.5 bg-background-muted rounded animate-pulse" /></td>)}</tr>
              )) : filtered.map((e) => (
                <tr key={e.id} className="hover:bg-background-secondary transition-colors">
                  <td className="px-4 py-3 text-text-muted">{formatDate(e.created_at)}</td>
                  <td className="px-4 py-3 font-medium text-text-primary">{e.title}</td>
                  <td className="px-4 py-3 text-text-muted max-w-[200px] truncate">{e.description ?? '—'}</td>
                  <td className="px-4 py-3 font-semibold text-text-primary text-right">{formatCurrency(e.amount)}</td>
                  <td className="px-4 py-3 text-text-muted">{(e.creator as { fullname: string } | undefined)?.fullname ?? '—'}</td>
                  <td className="px-4 py-3">
                    {e.approved_by ? (
                      <span className="text-[10.5px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">อนุมัติแล้ว</span>
                    ) : (
                      <span className="text-[10.5px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">รอดำเนินการ</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {e.receipt_url ? (
                      <a href={e.receipt_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary transition-colors">
                        ดู <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {!e.approved_by && (
                      <button onClick={() => handleApprove(e.id)}
                        className="flex items-center gap-1 text-[11px] font-medium text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors">
                        <CheckCircle className="w-3 h-3" /> อนุมัติ
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-background-tertiary border-t border-border">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-[12.5px] font-semibold text-text-primary">รวม</td>
                  <td className="px-4 py-3 text-[12.5px] font-bold text-text-primary text-right">
                    {formatCurrency(filtered.reduce((s, e) => s + e.amount, 0))}
                  </td>
                  <td colSpan={4} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add Expense Slide-over */}
      {showForm && (
        <div className="w-[440px] border-l border-border flex flex-col bg-background-secondary">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="text-[14px] font-semibold text-text-primary">เพิ่มค่าใช้จ่าย</div>
            <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text-primary transition-colors text-[13px]">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <ExpenseForm onSubmit={handleAddExpense} onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
