'use client'

import { useState, useEffect } from 'react'
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  Upload,
  Sparkles,
  Calendar,
  Eye,
  X,
} from 'lucide-react'
import UploadSpecialSlipModal from '@/components/special-collections/UploadSpecialSlipModal'
import type { SpecialCollectionItem } from '@/types'

export default function StudentSpecialCollectionsPage() {
  const [items, setItems] = useState<SpecialCollectionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState<SpecialCollectionItem | null>(null)
  const [viewingSlipsItem, setViewingSlipsItem] = useState<SpecialCollectionItem | null>(null)

  const fetchItems = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/special-collections')
      const data = await res.json()
      if (data.items) {
        setItems(data.items)
      }
    } catch (err) {
      console.error('Failed to fetch student special collections:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchItems()
  }, [])

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-text-primary tracking-tight flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
            <ShoppingBag className="w-5 h-5" />
          </div>
          การเก็บเงินพิเศษ
        </h1>
        <p className="text-xs text-text-muted mt-1">
          รายการเก็บเงินค่าเสื้อสาขา, ค่าอุปกรณ์, หรือค่ากิจกรรมพิเศษของคุณ
        </p>
      </div>

      {/* Main List */}
      {loading ? (
        <div className="py-16 text-center text-xs text-text-muted animate-pulse">
          กำลังโหลดรายการเก็บเงินพิเศษ...
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border-2 border-dashed border-border bg-background-tertiary">
          <ShoppingBag className="w-10 h-10 text-text-disabled mx-auto mb-3" />
          <div className="text-sm font-semibold text-text-secondary">ไม่มีรายการเก็บเงินพิเศษในขณะนี้</div>
          <p className="text-xs text-text-muted mt-1">
            เมื่อมีรายการเก็บเงินค่าเสื้อหรือกิจกรรมใหม่ ข้อมูลจะแสดงขึ้นที่นี่
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => {
            const collection = item.collection
            const totalAmount = parseFloat(item.amount as any || 0)
            const paidAmount = parseFloat(item.paid_amount as any || 0)
            const remainingAmount = Math.max(0, totalAmount - paidAmount)
            const slips = item.slips || []
            const pendingSlip = slips.find((s: any) => s.status === 'pending')

            const progress = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0

            return (
              <div
                key={item.id}
                className="p-5 rounded-2xl bg-white border border-border card-shadow relative overflow-hidden space-y-4"
              >
                {/* Top header row */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      {item.status === 'approved' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[10px] inline-flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> ชำระครบถ้วนแล้ว
                        </span>
                      ) : item.status === 'partial' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-bold text-[10px] inline-flex items-center gap-1">
                          <Clock className="w-3 h-3" /> กำลังผ่อนชำระ
                        </span>
                      ) : item.status === 'pending' || pendingSlip ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold text-[10px] inline-flex items-center gap-1 animate-pulse">
                          <Clock className="w-3 h-3" /> สลิปรอเหรัญญิกอนุมัติ
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200 font-bold text-[10px]">
                          ยังไม่ได้ชำระ
                        </span>
                      )}

                      {collection?.allow_installments && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          ผ่อนได้ {collection.max_installments} งวด
                        </span>
                      )}
                    </div>

                    <h3 className="text-base font-bold text-text-primary">{collection?.title}</h3>
                    {collection?.description && (
                      <p className="text-xs text-text-muted mt-0.5">{collection.description}</p>
                    )}
                  </div>

                  {item.note && (
                    <div className="px-3 py-1 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-700 whitespace-nowrap">
                      หมายเหตุ: {item.note}
                    </div>
                  )}
                </div>

                {/* Amount progress */}
                <div className="p-3.5 rounded-xl bg-background-tertiary border border-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">ความคืบหน้าการชำระ</span>
                    <span className="font-bold text-accent-emerald tabular-nums">
                      ฿{paidAmount.toLocaleString()} / ฿{totalAmount.toLocaleString()}
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-background-muted overflow-hidden">
                    <div
                      className="h-full gradient-brand rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                {/* Footer Action */}
                <div className="flex items-center justify-between pt-2 border-t border-border">
                  {collection?.due_date ? (
                    <span className="text-[11px] text-text-muted flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-500" />
                      กำหนดจ่าย: {new Date(collection.due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  ) : (
                    <span />
                  )}

                  <div className="flex items-center gap-2">
                    {slips.length > 0 && (
                      <button
                        onClick={() => setViewingSlipsItem(item)}
                        className="px-3 py-2 rounded-xl bg-white border border-border text-xs font-semibold text-text-secondary hover:text-brand hover:border-brand/30 transition-all flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        ดูสลิปที่ส่ง ({slips.length})
                      </button>
                    )}

                    {item.status !== 'approved' && remainingAmount > 0 && (
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="px-4 py-2 rounded-xl bg-brand text-white font-bold text-xs hover:bg-brand-hover transition-all flex items-center gap-1.5 shadow-sm press-down"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {item.status === 'partial' ? 'ส่งสลิปผ่อนงวดถัดไป' : 'ชำระเงิน / ส่งสลิป'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Upload Slip Modal */}
      {selectedItem && (
        <UploadSpecialSlipModal
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
          item={selectedItem}
          onUploaded={fetchItems}
        />
      )}

      {/* View Slips Modal */}
      {viewingSlipsItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white border border-border rounded-2xl p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-text-primary">ประวัติสลิปชำระเงิน</h3>
              <button onClick={() => setViewingSlipsItem(null)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {(viewingSlipsItem.slips || []).map((slip: any) => (
                <div key={slip.id} className="p-3 rounded-xl bg-background-tertiary border border-border flex items-center justify-between text-xs">
                  <div>
                    <div className="font-bold text-text-primary">
                      {slip.is_payoff ? 'สลิปปิดยอดล่วงหน้า' : `สลิปงวดที่ ${slip.installment_no}`}
                    </div>
                    <div className="text-[11px] text-accent-emerald font-semibold mt-0.5">
                      ฿{Number(slip.amount).toLocaleString()}
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                      {new Date(slip.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>

                  <span className={`px-2 py-1 rounded text-[10px] font-bold border ${
                    slip.status === 'approved'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                      : slip.status === 'pending'
                      ? 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
                      : 'bg-red-50 border-red-200 text-red-600 line-through'
                  }`}>
                    {slip.status === 'approved' ? 'อนุมัติแล้ว' : slip.status === 'pending' ? 'รอตรวจ' : 'ปฏิเสธ'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
