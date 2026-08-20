'use client'

import { useState } from 'react'
import { X, Upload, Sparkles, AlertCircle, CheckCircle2, CreditCard, ChevronRight, QrCode as QrIcon, Download, Copy, Check } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { generatePromptPayPayload } from '@/lib/promptpay'
import type { SpecialCollectionItem } from '@/types'

export default function UploadSpecialSlipModal({
  isOpen,
  onClose,
  item,
  onUploaded,
  promptPayConfig,
}: {
  isOpen: boolean
  onClose: () => void
  item: SpecialCollectionItem
  onUploaded: () => void
  promptPayConfig?: { promptpay_id: string; promptpay_name: string }
}) {
  const collection = item.collection
  const totalAmount = Number(item.amount || 0)
  const paidAmount = Number(item.paid_amount || 0)
  const remainingAmount = Math.max(0, totalAmount - paidAmount)
  const isFirstTime = !item.payment_mode
  const allowInstallments = collection?.allow_installments || false
  const maxInstallments = collection?.max_installments && collection.max_installments > 1 ? collection.max_installments : 2

  // State
  const [selectedMode, setSelectedMode] = useState<'full' | 'installment'>(
    allowInstallments ? 'installment' : 'full'
  )
  const [selectedInstallments, setSelectedInstallments] = useState<number>(maxInstallments)
  const [isPayoff, setIsPayoff] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [manualConfirm, setManualConfirm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showQrCode, setShowQrCode] = useState(true)

  // Calculate installment amount
  const effectiveInstallments = isFirstTime
    ? (selectedInstallments || maxInstallments || 1)
    : (item.chosen_installments && item.chosen_installments > 1 ? item.chosen_installments : maxInstallments)

  const perInstallmentPrice = Math.ceil(totalAmount / (effectiveInstallments > 1 ? effectiveInstallments : 1))

  const currentExpectedAmount = isFirstTime
    ? (selectedMode === 'full' ? remainingAmount : perInstallmentPrice)
    : (isPayoff ? remainingAmount : Math.min(perInstallmentPrice, remainingAmount))

  const promptPayId = promptPayConfig?.promptpay_id || ''
  const promptPayName = promptPayConfig?.promptpay_name || 'เหรัญญิกห้อง'
  const qrPayload = promptPayId ? generatePromptPayPayload(promptPayId, currentExpectedAmount) : ''

  const handleCopyPromptPay = () => {
    if (!promptPayId) return
    navigator.clipboard.writeText(promptPayId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadQR = () => {
    const svg = document.getElementById('special-promptpay-qr')
    if (!svg) return
    
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      canvas.width = img.width + 40
      canvas.height = img.height + 140
      if (ctx) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 20, 20)
        
        ctx.fillStyle = '#0f172a'
        ctx.font = 'bold 20px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(promptPayName, canvas.width / 2, img.height + 60)
        
        ctx.fillStyle = '#8e8e93'
        ctx.font = '14px sans-serif'
        ctx.fillText(collection?.title || 'การเก็บเงินพิเศษ', canvas.width / 2, img.height + 85)
        
        ctx.fillStyle = '#065f46'
        ctx.font = 'bold 24px sans-serif'
        ctx.fillText(`฿${currentExpectedAmount.toLocaleString()}`, canvas.width / 2, img.height + 120)
      }
      
      const pngFile = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.download = `QR-${collection?.title || 'SpecialPayment'}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
  }

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
        formData.append('chosen_installments', String(effectiveInstallments))
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-white border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-background-tertiary">
          <div>
            <h2 className="text-sm font-bold text-text-primary flex items-center gap-2">
              <Upload className="w-4 h-4 text-brand" />
              ชำระเงินพิเศษ: {collection?.title}
            </h2>
            <p className="text-[11px] text-text-muted mt-0.5">
              ยอดค้างชำระ: <strong className="text-accent-emerald">฿{remainingAmount.toLocaleString()}</strong> (จากยอดรวม ฿{totalAmount.toLocaleString()})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-text-muted hover:text-text-primary hover:bg-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: First-Time Payment Choice (if applicable) */}
          {isFirstTime && allowInstallments && (
            <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-600" />
                เลือกรูปแบบการชำระเงิน (เลือกได้ครั้งเดียว)
              </div>
              <p className="text-[11px] text-amber-800">
                รายการนี้เปิดให้ผ่อนชำระได้ คุณสามารถเลือกจ่ายเต็มจำนวนหรือผ่อนชำระงวดละเท่าๆ กัน:
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setSelectedMode('full')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedMode === 'full'
                      ? 'bg-white border-brand ring-2 ring-brand/20 shadow-sm'
                      : 'bg-white/60 border-amber-200/80 hover:bg-white text-text-secondary'
                  }`}
                >
                  <div className="text-xs font-bold text-text-primary flex items-center justify-between">
                    <span>จ่ายเต็มจำนวน</span>
                    {selectedMode === 'full' && <CheckCircle2 className="w-3.5 h-3.5 text-brand" />}
                  </div>
                  <div className="text-sm font-black text-accent-emerald mt-1">฿{remainingAmount.toLocaleString()}</div>
                  <div className="text-[10px] text-text-muted mt-0.5">ชำระจบในครั้งเดียว</div>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedMode('installment')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedMode === 'installment'
                      ? 'bg-white border-amber-500 ring-2 ring-amber-500/20 shadow-sm'
                      : 'bg-white/60 border-amber-200/80 hover:bg-white text-text-secondary'
                  }`}
                >
                  <div className="text-xs font-bold text-amber-900 flex items-center justify-between">
                    <span>ผ่อนชำระ ({maxInstallments} งวด)</span>
                    {selectedMode === 'installment' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-600" />}
                  </div>
                  <div className="text-sm font-black text-amber-700 mt-1">
                    งวดละ ฿{perInstallmentPrice.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-text-muted mt-0.5">รวม {maxInstallments} งวด</div>
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Early Payoff Choice for Installment Users */}
          {!isFirstTime && item.payment_mode === 'installment' && remainingAmount > perInstallmentPrice && (
            <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
              <div className="text-xs font-bold text-blue-900">ตัวเลือกการชำระงวดนี้</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setIsPayoff(false)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    !isPayoff
                      ? 'bg-white border-brand ring-2 ring-brand/20 text-text-primary font-bold shadow-sm'
                      : 'bg-white/60 border-blue-200 text-text-muted hover:bg-white'
                  }`}
                >
                  <div className="text-text-primary font-bold">จ่ายงวดปกติ</div>
                  <div className="font-mono text-amber-700 font-bold mt-0.5">฿{perInstallmentPrice.toLocaleString()}</div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsPayoff(true)}
                  className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                    isPayoff
                      ? 'bg-white border-accent-emerald ring-2 ring-accent-emerald/20 text-text-primary font-bold shadow-sm'
                      : 'bg-white/60 border-blue-200 text-text-muted hover:bg-white'
                  }`}
                >
                  <div className="text-text-primary font-bold">ปิดยอดค้างทั้งหมด</div>
                  <div className="font-mono text-accent-emerald font-bold mt-0.5">฿{remainingAmount.toLocaleString()}</div>
                </button>
              </div>
            </div>
          )}

          {/* PromptPay QR Code Section */}
          {promptPayId ? (
            <div className="rounded-2xl border-2 border-brand/20 bg-brand/[0.02] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-brand/10 text-brand flex items-center justify-center">
                    <QrIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-text-primary">สแกน PromptPay เพื่อจ่าย</span>
                    <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold">ระบุยอดอัตโนมัติ</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowQrCode(!showQrCode)}
                  className="text-[11px] font-semibold text-brand hover:underline"
                >
                  {showQrCode ? 'ย่อ QR' : 'แสดง QR'}
                </button>
              </div>

              {showQrCode && (
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-white p-4 rounded-xl border border-border">
                  <div className="p-2.5 rounded-xl border border-border bg-white shadow-sm flex-shrink-0">
                    <QRCodeSVG
                      id="special-promptpay-qr"
                      value={qrPayload}
                      size={140}
                      level="M"
                      includeMargin={false}
                    />
                  </div>

                  <div className="flex-1 space-y-2 text-center sm:text-left">
                    <div>
                      <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider">บัญชีผู้รับ</div>
                      <div className="text-xs font-bold text-text-primary">{promptPayName}</div>
                      <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                        <span className="text-[11px] font-mono font-bold text-text-secondary">{promptPayId}</span>
                        <button
                          type="button"
                          onClick={handleCopyPromptPay}
                          className="p-1 text-text-muted hover:text-brand transition-colors rounded"
                          title="คัดลอกเบอร์พร้อมเพย์"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase font-bold text-text-muted tracking-wider">ยอดเงินที่ต้องโอน</div>
                      <div className="text-xl font-black text-brand tabular-nums">
                        ฿{currentExpectedAmount.toLocaleString()}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={downloadQR}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-background-secondary border border-border text-[11px] font-bold text-text-secondary hover:text-brand hover:border-brand/30 transition-all shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      บันทึกรูป QR Code
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Amount to Transfer Banner Fallback */
            <div className="p-3.5 rounded-xl bg-background-tertiary border border-border flex items-center justify-between">
              <div className="space-y-0.5">
                <span className="text-xs font-medium text-text-secondary">ยอดที่ต้องโอนในสลิปนี้:</span>
                <div className="text-[10px] text-text-muted">
                  {selectedMode === 'installment' && !isPayoff && (isFirstTime || item.payment_mode === 'installment')
                    ? `(ยอดผ่อนงวดที่ ${isFirstTime ? 1 : (item.slips?.filter(s => s.status === 'approved').length || 0) + 1} จากทั้งหมด ${effectiveInstallments} งวด)`
                    : '(ยอดชำระเต็มจำนวน / ปิดยอด)'}
                </div>
              </div>
              <span className="text-2xl font-black text-brand tabular-nums">
                ฿{currentExpectedAmount.toLocaleString()}
              </span>
            </div>
          )}

          {/* File Upload Box */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5">
              แนบรูปภาพสลิปโอนเงิน (มี QR Code ชัดเจน) <span className="text-red-500">*</span>
            </label>
            <div className="relative border-2 border-dashed border-border hover:border-brand/50 rounded-xl p-4 text-center bg-background-tertiary/50 transition-all">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {previewUrl ? (
                <div className="space-y-2">
                  <img src={previewUrl} alt="Preview" className="max-h-40 mx-auto rounded-lg border border-border object-contain shadow-sm" />
                  <div className="text-[11px] text-accent-emerald font-semibold flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> เลือกไฟล์เรียบร้อยแล้ว (คลิกเพื่อเปลี่ยน)
                  </div>
                </div>
              ) : (
                <div className="space-y-1 py-2">
                  <Upload className="w-7 h-7 text-text-muted mx-auto mb-1" />
                  <div className="text-xs font-semibold text-text-secondary">คลิกหรือลากรูปสลิปมาวางที่นี่</div>
                  <p className="text-[10px] text-text-muted">รองรับไฟล์ JPG, PNG, WEBP ขนาดไม่เกิน 5MB</p>
                </div>
              )}
            </div>
          </div>

          {/* Manual Confirm Warning (if NO_QR_CODE triggered) */}
          {manualConfirm && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-xs space-y-1">
              <p className="font-bold">⚠️ ไม่พบ QR Code บนสลิป</p>
              <p className="text-[11px] text-amber-700">
                คุณต้องการยืนยันส่งสลิปนี้เพื่อให้เหรัญญิกตรวจสอบด้วยตนเองหรือไม่?
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary hover:bg-background-tertiary transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting || !file}
              className="px-5 py-2.5 rounded-xl bg-brand text-white font-bold text-xs hover:bg-brand-hover transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {submitting ? 'กำลังตรวจสอบสลิป...' : manualConfirm ? 'ยืนยันส่งสลิปตรวจมือ' : `ยืนยันส่งสลิป (฿${currentExpectedAmount.toLocaleString()})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
