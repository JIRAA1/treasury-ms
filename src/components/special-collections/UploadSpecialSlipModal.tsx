'use client'

import { useState } from 'react'
import { X, Upload, Sparkles, AlertCircle, CheckCircle2, ShieldCheck, Clock } from 'lucide-react'
import type { SpecialCollectionItem } from '@/types'

export default function UploadSpecialSlipModal({
  isOpen,
  onClose,
  item,
  onUploaded,
}: {
  isOpen: boolean
  onClose: () => void
  item: SpecialCollectionItem
  onUploaded: () => void
}) {
  const collection = item.collection
  const remainingAmount = Number(item.amount || 0) - Number(item.paid_amount || 0)
  const isFirstTime = !item.payment_mode
  const allowInstallments = collection?.allow_installments || false
  const maxInstallments = collection?.max_installments || 1

  // State
  const [selectedMode, setSelectedMode] = useState<'full' | 'installment'>(
    allowInstallments ? 'installment' : 'full'
  )
  const [isPayoff, setIsPayoff] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [manualConfirm, setManualConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate standard installment price
  const perInstallmentPrice = Math.ceil(Number(item.amount || 0) / (item.chosen_installments || maxInstallments))
  const currentExpectedAmount = isFirstTime
    ? (selectedMode === 'full' ? remainingAmount : perInstallmentPrice)
    : (isPayoff ? remainingAmount : Math.min(perInstallmentPrice, remainingAmount))

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setPreviewUrl(URL.createObjectURL(f))
      setError(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError('กรุณาเลือกไฟล์สลิปโอนเงิน')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('item_id', item.id)
      if (isFirstTime) {
        formData.append('payment_mode', selectedMode)
      }
      formData.append('is_payoff', isPayoff ? 'true' : 'false')
      if (manualConfirm) {
        formData.append('manual_confirm', 'true')
      }

      const res = await fetch(`/api/special-collections/${item.collection_id}/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()
      if (!res.ok) {
        if (data.code === 'NO_QR_CODE') {
          setManualConfirm(true)
          throw new Error(data.error)
        }
        throw new Error(data.error || 'Failed to upload slip')
      }

      onUploaded()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" />
              ชำระเงินพิเศษ: {collection?.title}
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              ยอดค้างชำระ: <strong className="text-emerald-400">฿{remainingAmount.toLocaleString()}</strong>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: First-Time Payment Choice (if applicable) */}
          {isFirstTime && allowInstallments && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-3">
              <div className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                เลือกรูปแบบการชำระเงิน (ครั้งแรกและครั้งเดียว)
              </div>
              <p className="text-[11px] text-white/60">
                รายการนี้อนุญาตให้ผ่อนชำระได้ คุณต้องการเลือกจ่ายรูปแบบใด? (เมื่อยืนยันแล้วจะไม่สามารถเปลี่ยนได้)
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedMode('full')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedMode === 'full'
                      ? 'bg-amber-500/20 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-white/[0.03] border-white/10 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="text-xs font-bold text-white">จ่ายเต็มจำนวน</div>
                  <div className="text-sm font-black text-emerald-400 mt-1">฿{remainingAmount.toLocaleString()}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMode('installment')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedMode === 'installment'
                      ? 'bg-amber-500/20 border-amber-500 ring-1 ring-amber-500'
                      : 'bg-white/[0.03] border-white/10 opacity-60 hover:opacity-100'
                  }`}
                >
                  <div className="text-xs font-bold text-amber-300">ผ่อนชำระ {maxInstallments} งวด</div>
                  <div className="text-sm font-black text-amber-400 mt-1">
                    งวดละ ฿{perInstallmentPrice.toLocaleString()}
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Early Payoff Choice for Installment Users */}
          {!isFirstTime && item.payment_mode === 'installment' && remainingAmount > perInstallmentPrice && (
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2">
              <div className="text-xs font-bold text-blue-300">ตัวเลือกการชำระงวดนี้</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayoff(false)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    !isPayoff
                      ? 'bg-blue-500/20 border-blue-500 text-white font-bold'
                      : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                  <div>จ่ายงวดปกติ</div>
                  <div className="font-mono text-amber-400">฿{perInstallmentPrice.toLocaleString()}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPayoff(true)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    isPayoff
                      ? 'bg-emerald-500/20 border-emerald-500 text-white font-bold'
                      : 'bg-white/5 border-white/10 text-white/60'
                  }`}
                >
                  <div>ปิดยอดค้างทั้งหมด</div>
                  <div className="font-mono text-emerald-400">฿{remainingAmount.toLocaleString()}</div>
                </button>
              </div>
            </div>
          )}

          {/* Amount to Transfer Banner */}
          <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 flex items-center justify-between">
            <span className="text-xs text-white/60">ยอดที่ต้องโอนในสลิปนี้:</span>
            <span className="text-xl font-black text-amber-400 tabular-nums">
              ฿{currentExpectedAmount.toLocaleString()}
            </span>
          </div>

          {/* File Upload Box */}
          <div>
            <label className="block text-xs font-semibold text-white/80 mb-1.5">
              แนบรูปภาพสลิปโอนเงิน (มี QR Code ชัดเจน)
            </label>
            <div className="relative border-2 border-dashed border-white/20 hover:border-amber-500/50 rounded-xl p-4 text-center bg-white/[0.02] transition-all">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {previewUrl ? (
                <div className="space-y-2">
                  <img src={previewUrl} alt="Preview" className="max-h-40 mx-auto rounded-lg border border-white/10 object-contain" />
                  <div className="text-[11px] text-emerald-400 font-semibold flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> เลือกไฟล์เรียบร้อยแล้ว
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="w-8 h-8 text-white/30 mx-auto mb-1" />
                  <div className="text-xs font-semibold text-white/70">กดหรือลากรูปสลิปมาวางที่นี่</div>
                  <p className="text-[10px] text-white/40">รองรับไฟล์ JPG, PNG, WEBP ขนาดไม่เกิน 5MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Manual Confirm Warning (if NO_QR_CODE triggered) */}
          {manualConfirm && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs space-y-2">
              <p className="font-semibold">⚠️ ไม่พบ QR Code บนสลิป</p>
              <p className="text-[11px] text-white/70">
                คุณต้องการยืนยันส่งสลิปนี้เพื่อให้เหรัญญิกตรวจสอบด้วยตนเองหรือไม่?
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting || !file}
              className="px-5 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-500/20"
            >
              {submitting ? 'กำลังตรวจสอบสลิป...' : manualConfirm ? 'ยืนยันส่งสลิปตรวจมือ' : 'ยืนยันส่งสลิปชำระเงิน'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
