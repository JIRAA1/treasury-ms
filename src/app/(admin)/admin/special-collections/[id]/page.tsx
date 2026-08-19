'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  Check,
  X,
  Sparkles,
  RefreshCw,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react'
import Topbar from '@/components/layout/Topbar'
import type { SpecialCollection } from '@/types'

export default function AdminSpecialCollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [collection, setCollection] = useState<SpecialCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedSlip, setSelectedSlip] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  // Edit state
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    default_amount: '',
    due_date: '',
    is_active: true,
    allow_installments: false,
    max_installments: '1',
  })
  const [editLoading, setEditLoading] = useState(false)

  // Delete state
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const fetchDetail = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/special-collections/${id}`)
      const data = await res.json()
      if (data.collection) {
        setCollection(data.collection)
      }
    } catch (err) {
      console.error('Failed to fetch collection detail:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDetail()
  }, [id])

  // Sync edit form when collection loads
  useEffect(() => {
    if (collection) {
      setEditForm({
        title: collection.title,
        description: collection.description || '',
        default_amount: String(collection.default_amount),
        due_date: collection.due_date ? collection.due_date.slice(0, 10) : '',
        is_active: collection.is_active,
        allow_installments: collection.allow_installments,
        max_installments: String(collection.max_installments),
      })
    }
  }, [collection])

  const handleEdit = async () => {
    if (!editForm.title.trim()) {
      alert('กรุณากรอกชื่อรายการเก็บเงิน')
      return
    }
    setEditLoading(true)
    try {
      const res = await fetch(`/api/special-collections/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          default_amount: parseFloat(editForm.default_amount),
          max_installments: parseInt(editForm.max_installments),
          due_date: editForm.due_date || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'แก้ไขไม่สำเร็จ')
      setIsEditOpen(false)
      fetchDetail()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setEditLoading(false)
    }
  }

  const handleDelete = async () => {
    setDeleteLoading(true)
    try {
      const res = await fetch(`/api/special-collections/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'ลบไม่สำเร็จ')
      router.push('/admin/special-collections')
    } catch (err: any) {
      alert(err.message)
      setDeleteLoading(false)
    }
  }

  const handleVerifySlip = async (slipId: string, action: 'approve' | 'reject') => {
    if (action === 'reject' && !rejectReason.trim()) {
      alert('กรุณาระบุเหตุผลในการปฏิเสธสลิป')
      return
    }

    setActionLoading(true)
    try {
      const res = await fetch(`/api/special-collections/slips/${slipId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          rejection_reason: action === 'reject' ? rejectReason : undefined,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Verification failed')

      setSelectedSlip(null)
      setRejectReason('')
      fetchDetail()
    } catch (err: any) {
      alert(err.message)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div>
        <Topbar title="การเก็บเงินพิเศษ" subtitle="รายละเอียด" />
        <div className="p-5 md:p-6">
          <div className="py-16 text-center text-xs text-text-muted animate-pulse">
            กำลังโหลดข้อมูลรายการเก็บเงินพิเศษ...
          </div>
        </div>
      </div>
    )
  }

  if (!collection) {
    return (
      <div>
        <Topbar title="ไม่พบข้อมูล" />
        <div className="p-5 md:p-6">
          <div className="py-16 text-center">
            <p className="text-sm font-semibold text-text-secondary">ไม่พบรายการเก็บเงินพิเศษนี้</p>
            <Link href="/admin/special-collections" className="text-xs text-brand mt-2 inline-block hover:underline">
              &larr; กลับหน้าหลักการเก็บเงินพิเศษ
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const items = collection.items || []
  const filteredItems = items.filter(item => {
    if (filterStatus === 'all') return true
    if (filterStatus === 'pending') return item.status === 'pending' || item.slips?.some(s => s.status === 'pending')
    return item.status === filterStatus
  })

  const stats = collection.stats || {
    total_assigned: items.length,
    total_paid: 0,
    total_partial: 0,
    total_pending: 0,
    total_unpaid: 0,
    total_amount_expected: 0,
    total_amount_collected: 0,
  }

  return (
    <div>
      <Topbar
        title={collection.title}
        subtitle="การเก็บเงินพิเศษ — รายละเอียด"
        backHref="/admin/special-collections"
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={fetchDetail}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-border text-xs font-semibold text-text-secondary hover:text-brand hover:border-brand/30 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              รีเฟรช
            </button>
            <button
              onClick={() => setIsEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand text-white text-xs font-semibold hover:bg-brand-hover transition-all shadow-sm"
            >
              <Pencil className="w-3.5 h-3.5" />
              แก้ไข
            </button>
            <button
              onClick={() => setIsDeleteOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold hover:bg-red-100 transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              ลบ
            </button>
          </div>
        }
      />
      <div className="p-5 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/admin/special-collections"
          className="inline-flex items-center gap-1.5 text-xs text-text-muted hover:text-brand mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          กลับไปหน้ารวมการเก็บเงินพิเศษ
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                collection.is_active
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-background-muted text-text-muted border border-border'
              }`}>
                {collection.is_active ? 'เปิดรับชำระ' : 'ปิดแล้ว'}
              </span>

              {collection.allow_installments && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  ผ่อนได้สูงสุด {collection.max_installments} งวด
                </span>
              )}
            </div>

            {collection.description && (
              <p className="text-xs text-text-muted mt-1 max-w-2xl">{collection.description}</p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white border border-border card-shadow">
          <div className="text-[11px] text-text-muted">ยอดจัดเก็บได้แล้ว</div>
          <div className="text-xl font-black text-accent-emerald mt-1 tabular-nums">
            ฿{stats.total_amount_collected.toLocaleString()}
          </div>
          <div className="text-[10px] text-text-muted mt-0.5">จาก ฿{stats.total_amount_expected.toLocaleString()}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-border card-shadow">
          <div className="text-[11px] text-text-muted">ชำระครบแล้ว</div>
          <div className="text-xl font-black text-text-primary mt-1 tabular-nums">
            {stats.total_paid} <span className="text-xs text-text-muted font-normal">/ {stats.total_assigned} คน</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-border card-shadow">
          <div className="text-[11px] text-text-muted">กำลังผ่อนชำระ</div>
          <div className="text-xl font-black text-amber-600 mt-1 tabular-nums">
            {stats.total_partial} <span className="text-xs text-text-muted font-normal">คน</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white border border-border card-shadow">
          <div className="text-[11px] text-text-muted">ยังไม่จ่าย/ค้างชำระ</div>
          <div className="text-xl font-black text-red-500 mt-1 tabular-nums">
            {stats.total_unpaid} <span className="text-xs text-text-muted font-normal">คน</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: `ทั้งหมด (${items.length})` },
          { id: 'pending', label: `รอตรวจสอบ (${stats.total_pending})` },
          { id: 'approved', label: `ชำระครบ (${stats.total_paid})` },
          { id: 'partial', label: `กำลังผ่อน (${stats.total_partial})` },
          { id: 'unpaid', label: `ยังไม่จ่าย (${stats.total_unpaid})` },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              filterStatus === tab.id
                ? 'bg-brand text-white shadow-sm'
                : 'bg-white border border-border text-text-secondary hover:text-brand hover:border-brand/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Member Table */}
      <div className="rounded-2xl border border-border bg-white overflow-hidden card-shadow">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-border bg-background-tertiary text-text-muted font-semibold">
                <th className="p-3.5">นักศึกษา</th>
                <th className="p-3.5">หมายเหตุ/โน้ต</th>
                <th className="p-3.5">รูปแบบการจ่าย</th>
                <th className="p-3.5 text-right">ยอดรวม</th>
                <th className="p-3.5 text-right">จ่ายแล้ว</th>
                <th className="p-3.5 text-center">สถานะ</th>
                <th className="p-3.5 text-center">สลิปที่ส่ง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-text-muted">
                    ไม่พบข้อมูลนักศึกษาในหมวดนี้
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const student = item.user
                  const slips = item.slips || []
                  const pendingSlip = slips.find((s: any) => s.status === 'pending')

                  return (
                    <tr key={item.id} className="hover:bg-background-tertiary transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-text-primary">{student?.fullname || 'ไม่ทราบชื่อ'}</div>
                        <div className="text-[10px] font-mono text-text-muted">{student?.student_id}</div>
                      </td>

                      <td className="p-3.5 text-text-secondary">
                        {item.note ? (
                          <span className="px-2 py-0.5 rounded bg-background-muted text-text-secondary font-medium">
                            {item.note}
                          </span>
                        ) : (
                          <span className="text-text-disabled">-</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {item.payment_mode === 'full' ? (
                          <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                            จ่ายเต็ม
                          </span>
                        ) : item.payment_mode === 'installment' ? (
                          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-semibold">
                            ผ่อน ({item.chosen_installments} งวด)
                          </span>
                        ) : (
                          <span className="text-text-disabled">ยังไม่เลือก</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right font-semibold text-text-primary tabular-nums">
                        ฿{Number(item.amount).toLocaleString()}
                      </td>

                      <td className="p-3.5 text-right font-bold text-accent-emerald tabular-nums">
                        ฿{Number(item.paid_amount || 0).toLocaleString()}
                      </td>

                      <td className="p-3.5 text-center">
                        {item.status === 'approved' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> ชำระครบแล้ว
                          </span>
                        ) : item.status === 'partial' ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px] inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> ผ่อนอยู่
                          </span>
                        ) : item.status === 'pending' || pendingSlip ? (
                          <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px] inline-flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3" /> รอตรวจสลิป
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-background-muted text-text-muted border border-border font-semibold text-[10px]">
                            ยังไม่จ่าย
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {slips.length > 0 ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {slips.map((slip: any) => (
                              <button
                                key={slip.id}
                                onClick={() => setSelectedSlip({ ...slip, studentName: student?.fullname, item })}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                  slip.status === 'pending'
                                    ? 'bg-amber-50 border-amber-300 text-amber-700 animate-pulse ring-1 ring-amber-300'
                                    : slip.status === 'approved'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                    : 'bg-red-50 border-red-200 text-red-600 line-through'
                                }`}
                              >
                                <Eye className="w-3 h-3" />
                                {slip.is_payoff ? 'ปิดยอด' : `งวด ${slip.installment_no}`}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-text-disabled text-[11px]">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slip Verification Modal */}
      {selectedSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white border border-border rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-text-primary">
                  ตรวจสอบสลิป: {selectedSlip.studentName}
                </h3>
                <p className="text-[11px] text-text-muted">
                  {selectedSlip.is_payoff ? 'สลิปปิดยอดล่วงหน้า' : `สลิปงวดที่ ${selectedSlip.installment_no}`} &bull; ยอดในสลิป ฿{Number(selectedSlip.amount).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedSlip(null)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image Preview */}
            <div className="relative rounded-xl overflow-hidden bg-background-tertiary max-h-80 flex items-center justify-center border border-border">
              <img
                src={selectedSlip.slip_url}
                alt="Slip"
                className="max-h-80 object-contain"
              />
            </div>

            {/* Slip details */}
            <div className="p-3 rounded-xl bg-background-tertiary border border-border text-xs space-y-1">
              <div className="flex justify-between text-text-secondary">
                <span>รหัสอ้างอิง (TransRef):</span>
                <span className="font-mono text-text-primary">{selectedSlip.trans_ref || 'ไม่ระบุ/ไม่มี QR'}</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>ตรวจสอบด้วย API:</span>
                <span className={selectedSlip.verified_by_api ? 'text-accent-emerald font-bold' : 'text-amber-600 font-bold'}>
                  {selectedSlip.verified_by_api ? 'ผ่าน Thunder OCR' : 'รอแอดมินตรวจมือ (No QR / Quota)'}
                </span>
              </div>
            </div>

            {/* Verification actions */}
            {selectedSlip.status === 'pending' ? (
              <div className="space-y-3 pt-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => handleVerifySlip(selectedSlip.id, 'approve')}
                    disabled={actionLoading}
                    className="flex-1 py-2.5 rounded-xl bg-accent-emerald text-white font-bold text-xs hover:opacity-90 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-60"
                  >
                    <Check className="w-4 h-4" />
                    อนุมัติสลิปนี้ ( Approve )
                  </button>
                </div>

                <div className="pt-2 border-t border-border space-y-2">
                  <input
                    type="text"
                    placeholder="ระบุเหตุผลในการปฏิเสธ (ถ้าต้องการกด Reject)..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-border text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-red-300"
                  />
                  <button
                    onClick={() => handleVerifySlip(selectedSlip.id, 'reject')}
                    disabled={actionLoading}
                    className="w-full py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-xs hover:bg-red-100 transition-all flex items-center justify-center gap-1.5 disabled:opacity-60"
                  >
                    <X className="w-4 h-4" />
                    ปฏิเสธสลิป ( Reject )
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-background-tertiary text-center text-xs font-semibold text-text-muted">
                สลิปนี้ถูก {selectedSlip.status === 'approved' ? 'อนุมัติเรียบร้อยแล้ว' : 'ปฏิเสธไปแล้ว'}
              </div>
            )}
          </div>
        </div>
      )}
      </div>

      {/* ── Edit Modal ───────────────────────────────────── */}
      {isEditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-white border border-border rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h3 className="text-sm font-bold text-text-primary">แก้ไขรายการเก็บเงินพิเศษ</h3>
              <button onClick={() => setIsEditOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">ชื่อรายการ <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl border border-border text-xs text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all"
                  placeholder="เช่น ค่าเสื้อสาขา รุ่น 67"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-text-secondary mb-1.5">รายละเอียด</label>
                <textarea
                  value={editForm.description}
                  onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2.5 rounded-xl border border-border text-xs text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all resize-none"
                  placeholder="รายละเอียดเพิ่มเติม..."
                />
              </div>

              {/* Amount + Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">ยอดเงิน (฿)</label>
                  <input
                    type="number"
                    value={editForm.default_amount}
                    onChange={e => setEditForm(f => ({ ...f, default_amount: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border text-xs text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-text-secondary mb-1.5">วันกำหนดชำระ</label>
                  <input
                    type="date"
                    value={editForm.due_date}
                    onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl border border-border text-xs text-text-primary focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 pt-1">
                <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-background-tertiary cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-text-primary">เปิดรับชำระ</div>
                    <div className="text-[11px] text-text-muted mt-0.5">ปิดเมื่อหมดเขตรับชำระเงิน</div>
                  </div>
                  <div
                    onClick={() => setEditForm(f => ({ ...f, is_active: !f.is_active }))}
                    className={`relative w-10 h-5.5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                      editForm.is_active ? 'bg-brand' : 'bg-border'
                    }`}
                    style={{ height: '22px', width: '40px' }}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      editForm.is_active ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </div>
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-background-tertiary cursor-pointer">
                  <div>
                    <div className="text-xs font-semibold text-text-primary">อนุญาตให้ผ่อนชำระ</div>
                    <div className="text-[11px] text-text-muted mt-0.5">นักศึกษาสามารถเลือกผ่อนได้</div>
                  </div>
                  <div
                    onClick={() => setEditForm(f => ({ ...f, allow_installments: !f.allow_installments }))}
                    className={`relative rounded-full transition-colors cursor-pointer flex-shrink-0 ${
                      editForm.allow_installments ? 'bg-amber-500' : 'bg-border'
                    }`}
                    style={{ height: '22px', width: '40px' }}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                      editForm.allow_installments ? 'translate-x-5' : 'translate-x-0.5'
                    }`} />
                  </div>
                </label>

                {editForm.allow_installments && (
                  <div>
                    <label className="block text-xs font-semibold text-text-secondary mb-1.5">จำนวนงวดสูงสุด</label>
                    <select
                      value={editForm.max_installments}
                      onChange={e => setEditForm(f => ({ ...f, max_installments: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-xl border border-border text-xs text-text-primary focus:outline-none focus:border-brand transition-all bg-white"
                    >
                      {[2, 3, 4, 6].map(n => (
                        <option key={n} value={n}>{n} งวด</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3 px-5 py-4 border-t border-border">
              <button
                onClick={() => setIsEditOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:bg-background-tertiary transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleEdit}
                disabled={editLoading}
                className="flex-1 py-2.5 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover transition-all disabled:opacity-60"
              >
                {editLoading ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm Modal ──────────────────────────── */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white border border-border rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-500 flex-shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-primary">ยืนยันการลบรายการ</h3>
                <p className="text-xs text-text-muted mt-1">
                  คุณกำลังจะลบ <strong className="text-text-primary">&ldquo;{collection.title}&rdquo;</strong>
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
              <div className="font-bold mb-1">การลบจะทำให้:</div>
              <div>• ข้อมูลการเก็บเงินนี้ทั้งหมดถูกลบถาวร</div>
              <div>• ประวัติการชำระเงินของนักศึกษาทุกคนในรายการนี้จะหายไป</div>
              <div>• ไม่สามารถกู้คืนได้</div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteOpen(false)}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:bg-background-tertiary transition-all"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteLoading}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-all disabled:opacity-60"
              >
                {deleteLoading ? 'กำลังลบ...' : 'ยืนยันลบ'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
