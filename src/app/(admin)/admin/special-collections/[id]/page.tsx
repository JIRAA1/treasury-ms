'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  ShoppingBag,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  Check,
  X,
  Sparkles,
  Calendar,
  CreditCard,
  RefreshCw,
  FileSpreadsheet,
} from 'lucide-react'
import type { SpecialCollection } from '@/types'

export default function AdminSpecialCollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [collection, setCollection] = useState<SpecialCollection | null>(null)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedSlip, setSelectedSlip] = useState<any | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

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
      <div className="py-16 text-center text-xs text-white/40 animate-pulse">
        กำลังโหลดข้อมูลรายการเก็บเงินพิเศษ...
      </div>
    )
  }

  if (!collection) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm font-semibold text-white/70">ไม่พบรายการเก็บเงินพิเศษนี้</p>
        <Link href="/admin/special-collections" className="text-xs text-amber-400 mt-2 inline-block hover:underline">
          &larr; กลับหน้าหลักการเก็บเงินพิเศษ
        </Link>
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
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div>
        <Link
          href="/admin/special-collections"
          className="inline-flex items-center gap-1.5 text-xs text-white/50 hover:text-white mb-3 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          กลับไปหน้ารวมการเก็บเงินพิเศษ
        </Link>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                collection.is_active
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-white/10 text-white/50'
              }`}>
                {collection.is_active ? 'เปิดรับชำระ' : 'ปิดแล้ว'}
              </span>

              {collection.allow_installments && (
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  ผ่อนได้สูงสุด {collection.max_installments} งวด
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-white tracking-tight">{collection.title}</h1>
            {collection.description && (
              <p className="text-xs text-white/50 mt-1 max-w-2xl">{collection.description}</p>
            )}
          </div>

          <button
            onClick={fetchDetail}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs font-semibold text-white/70 hover:text-white hover:bg-white/10 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            รีเฟรชข้อมูล
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
          <div className="text-[11px] text-white/50">ยอดจัดเก็บได้แล้ว</div>
          <div className="text-xl font-black text-emerald-400 mt-1 tabular-nums">
            ฿{stats.total_amount_collected.toLocaleString()}
          </div>
          <div className="text-[10px] text-white/30 mt-0.5">จาก ฿{stats.total_amount_expected.toLocaleString()}</div>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
          <div className="text-[11px] text-white/50">ชำระครบแล้ว</div>
          <div className="text-xl font-black text-white mt-1 tabular-nums">
            {stats.total_paid} <span className="text-xs text-white/40 font-normal">/ {stats.total_assigned} คน</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
          <div className="text-[11px] text-white/50">กำลังผ่อนชำระ</div>
          <div className="text-xl font-black text-amber-400 mt-1 tabular-nums">
            {stats.total_partial} <span className="text-xs text-white/40 font-normal">คน</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]">
          <div className="text-[11px] text-white/50">ยังไม่จ่าย/ค้างชำระ</div>
          <div className="text-xl font-black text-rose-400 mt-1 tabular-nums">
            {stats.total_unpaid} <span className="text-xs text-white/40 font-normal">คน</span>
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
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-white/[0.04] border border-white/10 text-white/60 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Member Table */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.03] text-white/50 font-semibold">
                <th className="p-3.5">นักศึกษา</th>
                <th className="p-3.5">หมายเหตุ/โน้ต</th>
                <th className="p-3.5">รูปแบบการจ่าย</th>
                <th className="p-3.5 text-right">ยอดรวม</th>
                <th className="p-3.5 text-right">จ่ายแล้ว</th>
                <th className="p-3.5 text-center">สถานะ</th>
                <th className="p-3.5 text-center">สลิปที่ส่ง</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.05]">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-white/40">
                    ไม่พบข้อมูลนักศึกษาในหมวดนี้
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => {
                  const student = item.user
                  const slips = item.slips || []
                  const pendingSlip = slips.find((s: any) => s.status === 'pending')

                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="p-3.5">
                        <div className="font-bold text-white">{student?.fullname || 'ไม่ทราบชื่อ'}</div>
                        <div className="text-[10px] font-mono text-white/40">{student?.student_id}</div>
                      </td>

                      <td className="p-3.5 text-white/60">
                        {item.note ? (
                          <span className="px-2 py-0.5 rounded bg-white/10 text-white/80 font-medium">
                            {item.note}
                          </span>
                        ) : (
                          <span className="text-white/20">-</span>
                        )}
                      </td>

                      <td className="p-3.5">
                        {item.payment_mode === 'full' ? (
                          <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold">
                            จ่ายเต็ม
                          </span>
                        ) : item.payment_mode === 'installment' ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold">
                            ผ่อน ({item.chosen_installments} งวด)
                          </span>
                        ) : (
                          <span className="text-white/30">ยังไม่เลือก</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right font-semibold text-white tabular-nums">
                        ฿{Number(item.amount).toLocaleString()}
                      </td>

                      <td className="p-3.5 text-right font-bold text-emerald-400 tabular-nums">
                        ฿{Number(item.paid_amount || 0).toLocaleString()}
                      </td>

                      <td className="p-3.5 text-center">
                        {item.status === 'approved' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-[10px] inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> ชำระครบแล้ว
                          </span>
                        ) : item.status === 'partial' ? (
                          <span className="px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 font-bold text-[10px] inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" /> ผ่อนอยู่
                          </span>
                        ) : item.status === 'pending' || pendingSlip ? (
                          <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[10px] inline-flex items-center gap-1 animate-pulse">
                            <Clock className="w-3 h-3" /> รอตรวจสลิป
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-white/10 text-white/40 font-semibold text-[10px]">
                            ยังไม่จ่าย
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 text-center">
                        {slips.length > 0 ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {slips.map((slip: any, idx: number) => (
                              <button
                                key={slip.id}
                                onClick={() => setSelectedSlip({ ...slip, studentName: student?.fullname, item })}
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                                  slip.status === 'pending'
                                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 animate-pulse ring-2 ring-amber-500/30'
                                    : slip.status === 'approved'
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400 line-through'
                                }`}
                              >
                                <Eye className="w-3 h-3" />
                                {slip.is_payoff ? 'ปิดยอด' : `งวด ${slip.installment_no}`}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-white/20 text-[11px]">-</span>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white">
                  ตรวจสอบสลิป: {selectedSlip.studentName}
                </h3>
                <p className="text-[11px] text-white/50">
                  {selectedSlip.is_payoff ? 'สลิปปิดยอดล่วงหน้า' : `สลิปงวดที่ ${selectedSlip.installment_no}`} &bull; ยอดในสลิป ฿{Number(selectedSlip.amount).toLocaleString()}
                </p>
              </div>
              <button onClick={() => setSelectedSlip(null)} className="text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Image Preview */}
            <div className="relative rounded-xl overflow-hidden bg-black max-h-80 flex items-center justify-center border border-white/10">
              <img
                src={selectedSlip.slip_url}
                alt="Slip"
                className="max-h-80 object-contain"
              />
            </div>

            {/* Slip details */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs space-y-1">
              <div className="flex justify-between text-white/60">
                <span>รหัสอ้างอิง (TransRef):</span>
                <span className="font-mono text-white">{selectedSlip.trans_ref || 'ไม่ระบุ/ไม่มี QR'}</span>
              </div>
              <div className="flex justify-between text-white/60">
                <span>ตรวจสอบด้วย API:</span>
                <span className={selectedSlip.verified_by_api ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
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
                    className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs hover:bg-emerald-400 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                  >
                    <Check className="w-4 h-4" />
                    อนุมัติสลิปนี้ ( Approve )
                  </button>
                </div>

                <div className="pt-2 border-t border-white/10 space-y-2">
                  <input
                    type="text"
                    placeholder="ระบุเหตุผลในการปฏิเสธ (ถ้าต้องการกด Reject)..."
                    value={rejectReason}
                    onChange={e => setRejectReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white placeholder:text-white/30"
                  />
                  <button
                    onClick={() => handleVerifySlip(selectedSlip.id, 'reject')}
                    disabled={actionLoading}
                    className="w-full py-2 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 font-bold text-xs hover:bg-rose-500/30 transition-all flex items-center justify-center gap-1.5"
                  >
                    <X className="w-4 h-4" />
                    ปฏิเสธสลิป ( Reject )
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-white/5 text-center text-xs font-semibold text-white/50">
                สลิปนี้ถูก {selectedSlip.status === 'approved' ? 'อนุมัติเรียบร้อยแล้ว' : 'ปฏิเสธไปแล้ว'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
