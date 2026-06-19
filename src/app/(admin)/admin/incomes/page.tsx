'use client'

import { useState, useEffect, useCallback } from 'react'
import Topbar from '@/components/layout/Topbar'
import IncomeForm from '@/components/incomes/IncomeForm'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Plus, CheckCircle, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/shared/GlobalDialog'
import type { Income } from '@/types'

export default function AdminIncomesPage() {
  const dialog = useDialog()
  const [incomes, setIncomes] = useState<Income[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved'>('all')

  const fetchIncomes = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/incomes')
      const data = await res.json()
      setIncomes(data.incomes ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchIncomes()
  }, [fetchIncomes])

  const handleAddIncome = async (data: { title: string; description?: string; amount: number; source: string }) => {
    const res = await fetch('/api/incomes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      toast.success('เพิ่มรายการรายรับแล้ว')
      setShowForm(false)
      fetchIncomes()
    } else {
      toast.error('เกิดข้อผิดพลาด')
    }
  }

  const handleApprove = (id: string, title: string) => {
    dialog.show({
      type: 'confirm',
      title: 'อนุมัติรายรับ',
      message: `ยืนยันอนุมัติรายรับ "${title}" ใช่หรือไม่?`,
      confirmText: '✓ อนุมัติ',
      onConfirm: async () => {
        dialog.setLoading(true)
        setActionLoadingId(id)
        try {
          const res = await fetch(`/api/incomes/${id}/approve`, { method: 'PATCH' })
          if (res.ok) {
            toast.success('อนุมัติแล้ว')
            dialog.hide()
            fetchIncomes()
          } else {
            toast.error('เกิดข้อผิดพลาด')
            dialog.setLoading(false)
          }
        } finally {
          setActionLoadingId(null)
        }
      },
    })
  }

  const handleRemove = (id: string, title: string) => {
    dialog.show({
      type: 'error',
      title: 'ลบรายรับ',
      message: `ยืนยันลบรายรับ "${title}" ใช่หรือไม่?`,
      confirmText: 'ลบรายการ',
      onConfirm: async () => {
        dialog.setLoading(true)
        setActionLoadingId(id)
        try {
          const res = await fetch(`/api/incomes/${id}`, { method: 'DELETE' })
          if (res.ok) {
            toast.success('ลบรายการแล้ว')
            dialog.hide()
            fetchIncomes()
          } else {
            toast.error('ลบไม่สำเร็จ')
            dialog.setLoading(false)
          }
        } finally {
          setActionLoadingId(null)
        }
      },
    })
  }

  const filtered = incomes.filter((i) => {
    if (filterStatus === 'pending') return !i.approved_by
    if (filterStatus === 'approved') return !!i.approved_by
    return true
  })

  const totalApproved = incomes.filter((i) => i.approved_by).reduce((s, i) => s + i.amount, 0)
  const totalPending = incomes.filter((i) => !i.approved_by).reduce((s, i) => s + i.amount, 0)

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar
          title="รายรับอื่นๆ"
          subtitle={`${incomes.length} รายการ`}
          actions={
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 bg-brand text-white text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-brand-hover transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> เพิ่มรายรับ
            </button>
          }
        />

        {/* Summary */}
        <div className="px-6 py-3 border-b border-border bg-background-secondary">
          <div className="text-[11px] text-text-muted">
            อนุมัติแล้ว: <span className="font-semibold text-emerald-600">{formatCurrency(totalApproved)}</span>
            {' · '}รอดำเนินการ: <span className="font-semibold text-amber-600">{formatCurrency(totalPending)}</span>
          </div>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
          <div className="flex border border-border rounded-lg overflow-hidden text-[11px]">
            {(['all', 'pending', 'approved'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 font-medium transition-colors ${
                  filterStatus === s
                    ? 'bg-brand text-white'
                    : 'bg-background text-text-secondary hover:bg-background-secondary'
                }`}
              >
                {s === 'all' ? 'ทั้งหมด' : s === 'pending' ? 'รอดำเนินการ' : 'อนุมัติแล้ว'}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[11.5px]">
            <thead className="bg-background-tertiary border-b border-border sticky top-0">
              <tr>
                {['วันที่', 'ชื่อรายการ', 'ที่มา', 'จำนวน', 'สถานะ', 'การจัดการ'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-text-muted text-[10px] uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3 bg-background-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                filtered.map((i) => (
                  <tr key={i.id} className="hover:bg-background-secondary transition-colors group">
                    <td className="px-4 py-3 text-text-muted">{formatDate(i.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-text-primary">{i.title}</div>
                      {i.description && <div className="text-[10px] text-text-disabled truncate max-w-[200px]">{i.description}</div>}
                    </td>
                    <td className="px-4 py-3 text-text-muted">{i.source || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-emerald-600 text-right">{formatCurrency(i.amount)}</td>
                    <td className="px-4 py-3">
                      {i.approved_by ? (
                        <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          อนุมัติแล้ว
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                          รอดำเนินการ
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {!i.approved_by && (
                          <button
                            onClick={() => handleApprove(i.id, i.title)}
                            disabled={actionLoadingId === i.id}
                            className="flex items-center gap-1 text-[10px] font-medium text-emerald-600 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                          >
                            {actionLoadingId === i.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <CheckCircle className="w-3 h-3" />}
                            อนุมัติ
                          </button>
                        )}
                        <button
                          onClick={() => handleRemove(i.id, i.title)}
                          disabled={actionLoadingId === i.id}
                          className="p-1 text-text-muted hover:text-red-500 hover:bg-red-50 rounded-md transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-50"
                          title="ลบรายการ"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot className="bg-background-tertiary border-t border-border">
                <tr>
                  <td colSpan={3} className="px-4 py-3 text-[11px] font-semibold text-text-primary">
                    รวม
                  </td>
                  <td className="px-4 py-3 text-[11px] font-bold text-emerald-600 text-right">
                    {formatCurrency(filtered.reduce((s, i) => s + i.amount, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add Income Slide-over */}
      {showForm && (
        <div className="w-[400px] border-l border-border flex flex-col bg-background-secondary">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="text-[13px] font-semibold text-text-primary">เพิ่มรายรับ</div>
            <button onClick={() => setShowForm(false)} className="text-text-muted hover:text-text-primary transition-colors text-[12px]">
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <IncomeForm onSubmit={handleAddIncome} onCancel={() => setShowForm(false)} />
          </div>
        </div>
      )}
    </div>
  )
}
