'use client'

import { useState, useEffect, useCallback } from 'react'
import Topbar from '@/components/layout/Topbar'
import StatusPill from '@/components/payments/StatusPill'
import { formatCurrency, formatDate, getTierConfig } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'
import { Search, ExternalLink, CheckCircle, XCircle, AlertTriangle, Loader2, Bell, Banknote, Smartphone } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/shared/GlobalDialog'

interface Payment {
  id: string
  period_id: string
  amount: number
  trans_ref: string | null
  slip_url: string | null
  note?: string | null
  status: 'pending' | 'approved' | 'rejected'
  created_at: string
  verified_by_api?: boolean | null
  user: { fullname: string; student_id: string; tier?: string } | null
  period: { label: string; period_order: number; semester_id: string } | null
}

export default function AdminPaymentsPage() {
  const dialog = useDialog()
  const [payments, setPayments] = useState<Payment[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)
  const [notifyLoadingId, setNotifyLoadingId] = useState<string | null>(null)
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [filterPeriod, setFilterPeriod] = useState<string>('')
  const [periods, setPeriods] = useState<{ id: string; label: string }[]>([])
  const [search, setSearch] = useState('')
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [page, setPage] = useState(1)
  // ── Edit Amount State ──
  const [editingAmount, setEditingAmount] = useState(false)
  const [editAmountValue, setEditAmountValue] = useState('')
  const [editAmountNote, setEditAmountNote] = useState('')
  const [editAmountLoading, setEditAmountLoading] = useState(false)
  const PER_PAGE = 20

  const fetchPayments = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterStatus !== 'all') params.set('status', filterStatus)
    if (filterPeriod) params.set('period_id', filterPeriod)
    if (search) params.set('search', search)
    params.set('page', String(page))
    params.set('per_page', String(PER_PAGE))
    const res = await fetch(`/api/payments/history?${params}`)
    const data = await res.json()
    setPayments(data.payments ?? [])
    setTotal(data.total ?? 0)
    setTotalPages(data.totalPages ?? 1)
    setLoading(false)
  }, [filterStatus, filterPeriod, search, page])

  // Load periods on mount
  useEffect(() => {
    async function loadPeriods() {
      try {
        const sRes = await fetch('/api/semesters')
        const sData = await sRes.json()
        const activeSemester = sData.data?.find((s: any) => s.is_active)
        if (activeSemester) {
          const pRes = await fetch(`/api/semesters/${activeSemester.id}/periods`)
          const pData = await pRes.json()
          setPeriods(pData.data ?? [])
        }
      } catch (err) {
        console.error('Failed to load periods', err)
      }
    }
    loadPeriods()
  }, [])

  useEffect(() => { fetchPayments() }, [fetchPayments])

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1) }, [filterStatus, filterPeriod, search])

  const doAction = async (id: string, action: 'approve' | 'reject') => {
    dialog.setLoading(true)
    setActionLoadingId(id)
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, reason: rejectReason }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.warning) {
          toast.warning(`อนุมัติสำเร็จ แต่แจ้งเตือน LINE ล้มเหลว: ${data.warning}`, { duration: 6000 })
        } else {
          toast.success(action === 'approve' ? 'อนุมัติแล้ว' : 'ปฏิเสธแล้ว')
        }
        dialog.hide()
        setSelectedPayment(null)
        setRejectReason('')
        fetchPayments()
      } else {
        toast.error('เกิดข้อผิดพลาด')
        dialog.setLoading(false)
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ')
      dialog.setLoading(false)
    } finally {
      setActionLoadingId(null)
    }
  }

  const handleAction = (id: string, action: 'approve' | 'reject', paymentName?: string) => {
    if (action === 'approve') {
      dialog.show({
        type: 'confirm',
        title: 'อนุมัติการชำระเงิน',
        message: paymentName
          ? `ยืนยันอนุมัติสลิปของ ${paymentName} ใช่หรือไม่?`
          : 'ยืนยันอนุมัติรายการชำระเงินนี้ใช่หรือไม่?',
        confirmText: '✓ อนุมัติ',
        onConfirm: () => doAction(id, 'approve'),
      })
    } else {
      dialog.show({
        type: 'warning',
        title: 'ปฏิเสธการชำระเงิน',
        message: rejectReason
          ? `ปฏิเสธด้วยเหตุผล: "${rejectReason}" ยืนยันหรือไม่?`
          : 'ยืนยันปฏิเสธรายการชำระเงินนี้ใช่หรือไม่?',
        confirmText: '✕ ปฏิเสธ',
        onConfirm: () => doAction(id, 'reject'),
      })
    }
  }

  // ── Retroactive LINE notification (notify_only) ──────────────────────────
  const doNotify = async (id: string) => {
    setNotifyLoadingId(id)
    dialog.setLoading(true)
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action: 'notify_only', status: 'approved' }),
      })
      if (res.ok) {
        toast.success('ส่งแจ้งเตือนไลน์ให้นักศึกษาแล้ว')
        dialog.hide()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'ส่งแจ้งเตือนไม่สำเร็จ')
        dialog.setLoading(false)
      }
    } catch {
      toast.error('เกิดข้อผิดพลาดในการเชื่อมต่อ')
      dialog.setLoading(false)
    } finally {
      setNotifyLoadingId(null)
    }
  }

  const handleNotify = (id: string, paymentName?: string) => {
    dialog.show({
      type: 'confirm',
      title: '📢 แจ้งเตือนยืนยันการชำระ',
      message: paymentName
        ? `ส่งแจ้งเตือนไลน์ "ชำระเงินสำเร็จ" ให้ ${paymentName} อีกครั้งใช่หรือไม่?\n(สถานะการชำระในระบบจะไม่เปลี่ยนแปลง)`
        : 'ส่งแจ้งเตือนไลน์อีกครั้งให้นักศึกษา?\n(สถานะการชำระในระบบจะไม่เปลี่ยนแปลง)',
      confirmText: '📢 ส่งแจ้งเตือน',
      onConfirm: () => doNotify(id),
    })
  }

  // ── Edit Amount ───────────────────────────────────────────────────────────
  const doEditAmount = async () => {
    if (!selectedPayment) return
    const parsed = parseFloat(editAmountValue)
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('กรุณาระบุยอดที่ถูกต้อง')
      return
    }
    setEditAmountLoading(true)
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedPayment.id,
          action: 'edit_amount',
          new_amount: parsed,
          edit_note: editAmountNote.trim() || undefined,
        }),
      })
      if (res.ok) {
        toast.success(`แก้ไขยอดเป็น ฿${parsed.toLocaleString()} เรียบร้อย`)
        setEditingAmount(false)
        setEditAmountValue('')
        setEditAmountNote('')
        // อัปเดตรายการใน detail sheet และ table
        setSelectedPayment(prev => prev ? { ...prev, amount: parsed } : null)
        fetchPayments()
      } else {
        const json = await res.json()
        toast.error(json.error ?? 'แก้ไขยอดไม่สำเร็จ')
      }
    } catch {
      toast.error('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setEditAmountLoading(false)
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
          <select
            value={filterPeriod}
            onChange={(e) => { setFilterPeriod(e.target.value); setPage(1) }}
            className="px-3 py-1.5 text-[12.5px] border border-border rounded-lg bg-background outline-none focus:ring-1 focus:ring-brand font-medium text-text-secondary cursor-pointer"
          >
            <option value="">ทุกงวด</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <div className="text-[12px] text-text-muted ml-auto">แสดง {payments.length} / {total} รายการ</div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          <table className="w-full text-[12.5px]">
            <thead className="bg-background-tertiary border-b border-border sticky top-0">
              <tr>
                {['นักศึกษา', 'รหัส', 'สัปดาห์', 'จำนวน', 'วิธีชำระ / Ref', 'ส่งเมื่อ', 'สถานะ', 'การดำเนินการ'].map((h) => (
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
                  onClick={() => { setSelectedPayment(p); setEditingAmount(false); setEditAmountValue(''); setEditAmountNote('') }}
                  className={`hover:bg-background-secondary cursor-pointer transition-colors ${p.status === 'pending' ? 'border-l-2 border-l-amber-300' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-background-tertiary flex items-center justify-center text-[10px] font-semibold text-text-secondary flex-shrink-0">
                        {p.user?.fullname?.[0] ?? 'U'}
                      </div>
                      <span className="font-medium text-text-primary truncate max-w-[120px]">{p.user?.fullname}</span>
                      {p.user?.tier && (() => {
                        const cfg = getTierConfig(p.user!.tier as 'A' | 'B' | 'C')
                        return (
                          <span className={`text-[9px] font-black px-1.5 py-0.5 rounded border ${cfg.color} ${cfg.bg} ${cfg.border}`}>
                            {p.user!.tier}
                          </span>
                        )
                      })()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-text-muted">{p.user?.student_id}</td>
                  <td className="px-4 py-3 font-medium">{p.period?.label || '—'}</td>
                  <td className="px-4 py-3 font-semibold text-text-primary">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3">
                    {p.note?.includes('เงินสด') ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 border border-emerald-200 font-medium text-[10px]">
                        <Banknote className="w-3 h-3" /> เงินสด
                      </span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <span className="inline-flex items-center gap-1 w-max px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 border border-blue-200 font-medium text-[10px]">
                          <Smartphone className="w-3 h-3" /> โอนเงิน
                        </span>
                        {p.trans_ref && <span className="font-mono text-[10.5px] text-text-muted opacity-80">{p.trans_ref}</span>}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-text-muted">{formatDistanceToNow(new Date(p.created_at), { locale: th, addSuffix: true })}</td>
                  <td className="px-4 py-3">
                    <StatusPill status={p.status === 'approved' ? 'paid' : p.status === 'pending' ? 'pending' : 'rejected'} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {p.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAction(p.id, 'approve', p.user?.fullname)}
                            disabled={actionLoadingId === p.id}
                            title="อนุมัติ"
                            className="p-1 rounded hover:bg-emerald-50 text-emerald-600 transition-colors disabled:opacity-50"
                          >
                            {actionLoadingId === p.id
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <CheckCircle className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => { setSelectedPayment(p) }}
                            title="ปฏิเสธ"
                            className="p-1 rounded hover:bg-red-50 text-red-500 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {p.status === 'approved' && (
                        <button
                          onClick={() => handleNotify(p.id, p.user?.fullname)}
                          disabled={notifyLoadingId === p.id}
                          title="ส่งแจ้งเตือนไลน์อีกครั้ง"
                          className="p-1 rounded hover:bg-sky-50 text-sky-500 transition-colors disabled:opacity-50"
                        >
                          {notifyLoadingId === p.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Bell className="w-4 h-4" />}
                        </button>
                      )}
                      {p.slip_url && (
                        <a href={p.slip_url} target="_blank" rel="noopener noreferrer"
                          title="ดูสลิป"
                          className="text-[11px] text-text-muted hover:text-text-primary flex items-center gap-0.5 transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
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
            {/* Manual review badge */}
            {selectedPayment.verified_by_api === false && (
              <div className="flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-200 rounded-xl text-[12px]">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-amber-800">ต้องตรวจสอบด้วยตนเอง</div>
                  <div className="text-amber-700 mt-0.5">สลิปนี้ผ่านเข้ามาโดยไม่ผ่าน OCR API เนื่องจาก quota หมด กรุณาเปิดดูสลิปและตรวจยอดเงินก่อนอนุมัติ</div>
                </div>
              </div>
            )}
            {/* Info */}
            <div className="space-y-2">
              {[
                ['นักศึกษา', selectedPayment.user?.fullname],
                ['รหัสนักศึกษา', selectedPayment.user?.student_id],
                ['งวด', selectedPayment.period?.label || '—'],
                ['จำนวน', formatCurrency(selectedPayment.amount)],
                ['วิธีชำระ', selectedPayment.note?.includes('เงินสด') ? 'เงินสด' : 'โอนเงิน'],
                ['Trans Ref', selectedPayment.trans_ref ?? '—'],
                ['วันที่ส่ง', formatDate(selectedPayment.created_at)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between text-[12.5px]">
                  <span className="text-text-muted">{k}</span>
                  <span className="font-medium text-text-primary font-mono text-right">{v}</span>
                </div>
              ))}
            </div>

            {/* Note Display */}
            {selectedPayment.note && (
              <div className="p-3 bg-background-tertiary rounded-xl text-[12px]">
                <div className="font-semibold text-text-secondary mb-1">หมายเหตุ</div>
                <div className="text-text-primary">{selectedPayment.note}</div>
              </div>
            )}

            {/* ── Edit Amount Section ── */}
            <div className="border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => {
                  setEditingAmount(v => !v)
                  if (!editingAmount) {
                    setEditAmountValue(String(selectedPayment.amount))
                    setEditAmountNote('')
                  }
                }}
                className="w-full flex items-center justify-between px-4 py-3 bg-background-tertiary/50 hover:bg-background-muted text-[12.5px] font-semibold text-text-primary transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-text-muted" />
                  แก้ไขยอดชำระ
                </span>
                <span className="text-[11px] text-text-muted">{editingAmount ? '✕ ยกเลิก' : '→ แก้ไข'}</span>
              </button>
              {editingAmount && (
                <div className="p-4 space-y-3 border-t border-border">
                  <div>
                    <label className="block text-[11.5px] font-medium text-text-secondary mb-1">ยอดเงินใหม่ (บาท)</label>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={editAmountValue}
                      onChange={e => setEditAmountValue(e.target.value)}
                      placeholder={String(selectedPayment.amount)}
                      className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-background outline-none focus:ring-2 focus:ring-brand font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11.5px] font-medium text-text-secondary mb-1">หมายเหตุ (ไม่บังคับ)</label>
                    <input
                      type="text"
                      value={editAmountNote}
                      onChange={e => setEditAmountNote(e.target.value)}
                      placeholder="เช่น จ่ายเต็มยอด แก้ไขยอดผิด..."                      className="w-full border border-border rounded-lg px-3 py-2 text-[12.5px] bg-background outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <button
                    onClick={doEditAmount}
                    disabled={editAmountLoading || !editAmountValue}
                    className="w-full bg-brand text-white text-[13px] font-semibold py-2.5 rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                  >
                    {editAmountLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    บันทึกยอดใหม่
                  </button>
                </div>
              )}
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

          {/* Actions — Pending */}
          {selectedPayment.status === 'pending' && (
            <div className="p-4 border-t border-border flex gap-2">
              <button
                onClick={() => handleAction(selectedPayment.id, 'approve', selectedPayment.user?.fullname)}
                className="flex-1 bg-brand text-white text-[13px] font-medium py-2.5 rounded-lg hover:bg-brand-hover transition-colors"
              >
                ✓ อนุมัติ
              </button>
              <button
                onClick={() => handleAction(selectedPayment.id, 'reject', selectedPayment.user?.fullname)}
                disabled={!rejectReason}
                className="flex-1 bg-red-50 text-red-600 border border-red-200 text-[13px] font-medium py-2.5 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-40"
              >
                ✕ ปฏิเสธ
              </button>
            </div>
          )}

          {/* Actions — Approved: retroactive LINE notify */}
          {selectedPayment.status === 'approved' && (
            <div className="p-4 border-t border-border">
              <button
                onClick={() => handleNotify(selectedPayment.id, selectedPayment.user?.fullname)}
                disabled={notifyLoadingId === selectedPayment.id}
                className="w-full flex items-center justify-center gap-2 bg-sky-50 text-sky-700 border border-sky-200 text-[13px] font-medium py-2.5 rounded-lg hover:bg-sky-100 transition-colors disabled:opacity-50"
              >
                {notifyLoadingId === selectedPayment.id
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Bell className="w-4 h-4" />}
                ส่งแจ้งเตือนยืนยันการชำระอีกครั้ง
              </button>
              <p className="text-[10.5px] text-text-muted text-center mt-2">ส่ง LINE Flex Message ให้นักศึกษาโดยไม่เปลี่ยนสถานะในระบบ</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
