'use client'

import { useState, useEffect, useCallback } from 'react'
import Topbar from '@/components/layout/Topbar'
import StatusPill from '@/components/payments/StatusPill'
import { formatCurrency, formatDate, getWeekLabel } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'
import { Search, ExternalLink, CheckCircle, XCircle } from 'lucide-react'
import { toast } from 'sonner'

interface Payment {
  id: string
  week: number
  amount: number
  trans_ref: string | null
  slip_url: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  user: { fullname: string; student_id: string } | null
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [search, setSearch] = useState('')
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [page, setPage] = useState(1)
  const PER_PAGE = 20

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus !== 'all') params.set('status', filterStatus)
    if (search) params.set('search', search)
    params.set('page', String(page))
    params.set('per_page', String(PER_PAGE))
    const res = await fetch(`/api/payments/history?${params}`)
    const data = await res.json()
    setPayments(data.payments ?? [])
    setTotal(data.total ?? 0)
    setTotalPages(data.totalPages ?? 1)
    setLoading(false)
  }, [filterStatus, search, page])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [filterStatus, search])

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    const res = await fetch('/api/payments/verify', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action, reason: rejectReason }),
    })
    if (res.ok) {
      toast.success(action === 'approve' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว')
      setSelectedPayment(null)
      setRejectReason('')
      fetchPayments()
    } else {
      toast.error('เกิดข้อผิดพลาด')
    }
  }

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title="การชำระเงิน" subtitle={`${total} รายการทั้งหมด`} />

        {/* Filter Bar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-background-secondary sticky top-0 z-10">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
            <input
              type="text"
              placeholder="ค้นหาชื่อหรือรหัสนักศึกษา..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-8 pr-3 py-1.5 text-[12.5px] border border-border rounded-lg bg-background outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          <div className="flex border border-border rounded-lg overflow-hidden text-[12.5px]">
            {(['all', 'pending', 'approved', 'rejected'] as const).map((s) => (
              <button
                key={s}
                onClick={() => { setFilterStatus(s); setPage(1) }}
                className={`px-3 py-1.5 font-medium transition-colors ${filterStatus === s ? 'bg-brand text-white' : 'bg-background text-text-secondary hover:bg-background-secondary'}`}
              >
                {s === 'all' ? 'ทั้งหมด' : s === 'pending' ? 'รอตรวจ' : s === 'approved' ? 'อนุมัติ' : 'ปฏิเสธ'}
              </button>
            ))}
          </div>
          <div className="text-[12px] text-text-muted ml-auto">แสดง {payments.length} / {total} รายการ</div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-background-tertiary border-b border-border sticky top-0">
              <tr>
                {['นักศึกษา', 'รหัส', 'สัปดาห์', 'จำนวน', 'Trans Ref', 'ส่งเมื่อ', 'สถานะ', 'การดำเนินการ'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left font-medium text-text-muted text-[11px] uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 8 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-3.5 bg-background-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : payments.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelectedPayment(p)}
                  className={`hover:bg-background-secondary cursor-pointer transition-colors ${p.status === 'pending' ? 'border-l-2 border-l-amber-300' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-background-tertiary flex items-center justify-center text-[10px] font-semibold text-text-secondary flex-shrink-0">
                        {p.user?.fullname?.[0] ?? 'U'}
                      </div>
                      <span className="font-medium text-text-primary truncate max-w-[120px]">{p.user?.fullname}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{p.user?.student_id}</td>
                  <td className="px-4 py-3 font-medium">{getWeekLabel(p.week)}</td>
                  <td className="px-4 py-3 font-semibold text-text-primary">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 font-mono text-[11.5px] text-text-muted">{p.trans_ref ?? '—'}</td>
                  <td className="px-4 py-3 text-text-muted">{formatDistanceToNow(new Date(p.created_at), { locale: th, addSuffix: true })}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={p.status === 'approved' ? 'paid' : p.status === 'pending' ? 'pending' : 'rejected'} />
                  </td>
                  <td className="px-4 py-3">
                    {p.status === 'pending' && (
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <button onClick={() => handleAction(p.id, 'approve')} className="p-1 rounded hover:bg-emerald-50 text-emerald-600 transition-colors">
                          <CheckCircle className="w-4 h-4" />
                        </button>
                        <button onClick={() => { setSelectedPayment(p); }} className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors">
                          <XCircle className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {p.slip_url && (
                      <a href={p.slip_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                        className="text-[11px] text-text-muted hover:text-text-primary flex items-center gap-0.5 transition-colors">
                        สลิป <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-3 border-t border-border">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button key={p} onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-[12.5px] font-medium transition-colors ${p === page ? 'bg-brand text-white' : 'text-text-secondary hover:bg-background-secondary'}`}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Sheet */}
      {selectedPayment && (
        <div className="w-[420px] border-l border-border flex flex-col bg-background-secondary">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="text-[14px] font-semibold text-text-primary">รายละเอียดการชำระ</div>
            <button onClick={() => setSelectedPayment(null)} className="text-text-muted hover:text-text-primary transition-colors text-[13px]">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Slip */}
            {selectedPayment.slip_url && (
              <img src={selectedPayment.slip_url} alt="slip" className="w-full rounded-xl border border-border object-contain max-h-72" />
            )}
            {/* Info */}
            <div className="space-y-2">
              {[
                ['นักศึกษา', selectedPayment.user?.fullname],
                ['รหัสนักศึกษา', selectedPayment.user?.student_id],
                ['สัปดาห์', `W${selectedPayment.week}`],
                ['จำนวน', formatCurrency(selectedPayment.amount)],
                ['Trans Ref', selectedPayment.trans_ref ?? '—'],
                ['วันที่ส่ง', formatDate(selectedPayment.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[12.5px]">
                  <span className="text-text-muted">{k}</span>
                  <span className="font-medium text-text-primary font-mono text-right">{v}</span>
                </div>
              ))}
            </div>

            {/* Reject Reason */}
            {selectedPayment.status === 'pending' && (
              <div className="space-y-2">
                <label className="block text-[12px] font-medium text-text-secondary">เหตุผลการปฏิเสธ (กรณีปฏิเสธ)</label>
                <textarea
                  rows={2}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="ระบุเหตุผล..."
                  className="w-full border border-border rounded-lg px-3 py-2 text-[12.5px] bg-background outline-none focus:ring-1 focus:ring-brand resize-none"
                />
              </div>
            )}
          </div>

          {/* Actions */}
          {selectedPayment.status === 'pending' && (
            <div className="p-4 border-t border-border flex gap-2">
              <button
                onClick={() => handleAction(selectedPayment.id, 'approve')}
                className="flex-1 bg-brand text-white text-[13px] font-medium py-2.5 rounded-lg hover:bg-brand-hover transition-colors"
              >
                ✓ อนุมัติ
              </button>
              <button
                onClick={() => handleAction(selectedPayment.id, 'reject')}
                disabled={!rejectReason}
                className="flex-1 bg-red-50 text-red-600 border border-red-200 text-[13px] font-medium py-2.5 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40"
              >
                ✕ ปฏิเสธ
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
