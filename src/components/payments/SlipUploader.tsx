'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, CheckCircle, XCircle, Loader2, ImageIcon, AlertTriangle, RefreshCw, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { parseSlipQR } from '@/lib/slip-qr'
import jsQR from 'jsqr'
import { useDialog } from '@/components/shared/GlobalDialog'

interface PaymentPeriod {
  id: string
  label: string
  amount: number
  deadline: string
  status: 'unpaid' | 'rejected'
}

interface SlipUploaderProps {
  periodId: string;
  unpaidCycles: PaymentPeriod[];
  onPeriodChange?: (periodId: string) => void;
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

type Step = 'upload' | 'verifying' | 'success' | 'failed'

interface VerifyStep {
  label: string
  done: boolean
  active: boolean
}

const BANK_NAMES: Record<string, string> = {
  '002': 'ธนาคารกรุงเทพ (BBL)',
  '004': 'ธนาคารกสิกรไทย (KBANK)',
  '006': 'ธนาคารกรุงไทย (KTB)',
  '011': 'ธนาคารทหารไทยธนชาต (TTB)',
  '014': 'ธนาคารไทยพาณิชย์ (SCB)',
  '025': 'ธนาคารกรุงศรีอยุธยา (BAY)',
  '030': 'ธนาคารออมสิน (GSB)',
  '034': 'ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (BAAC)',
}

interface StepResult {
  payment: any
  ocr: any
  quota_exceeded?: boolean
  message?: string
}

export default function SlipUploader({ periodId, unpaidCycles, onPeriodChange, onSuccess, onError }: SlipUploaderProps) {
  const dialog = useDialog()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successData, setSuccessData] = useState<StepResult | null>(null)
  const [verifySteps, setVerifySteps] = useState<VerifyStep[]>([
    { label: 'กำลังเตรียมส่งข้อมูล...', done: false, active: false },
    { label: 'กำลังส่งข้อมูลเข้าสู่ระบบ...', done: false, active: false },
    { label: 'กำลังตรวจสอบความถูกต้องสลิป...', done: false, active: false },
  ])
  const [ocrResult, setOcrResult] = useState<Record<string, string> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // QR Scanning States
  const [scanning, setScanning] = useState(false)
  const [qrStatus, setQrStatus] = useState<{
    scanned: boolean
    hasQR: boolean
    isValid: boolean
    error?: string
    transRef?: string | null
    amount?: number | null
    bank?: string | null
  }>({
    scanned: false,
    hasQR: false,
    isValid: false
  })
  const [suggestedWeek, setSuggestedWeek] = useState<PaymentPeriod | null>(null)
  const [amountMismatch, setAmountMismatch] = useState(false)
  const [manualConfirm, setManualConfirm] = useState(false)

  const selectedCycle = unpaidCycles.find(c => c.id === periodId)

  const handleFile = (f: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
      dialog.show({
        type: 'error',
        title: 'ไฟล์ไม่ถูกต้อง',
        message: 'ระบบรองรับเฉพาะไฟล์รูปภาพประเภท PNG, JPG และ WEBP เท่านั้น'
      })
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      dialog.show({
        type: 'error',
        title: 'ไฟล์ใหญ่เกินไป',
        message: 'กรุณาอัปโหลดรูปภาพที่มีขนาดไม่เกิน 5MB'
      })
      return
    }
    setFile(f)
    setPreview(URL.createObjectURL(f))

    // Reset pre-verification states
    setScanning(true)
    setQrStatus({ scanned: false, hasQR: false, isValid: false })
    setSuggestedWeek(null)
    setAmountMismatch(false)
    setManualConfirm(false)

    // Analyze QR Code
    const img = new Image()
    img.src = URL.createObjectURL(f)
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          setQrStatus({ scanned: true, hasQR: false, isValid: false, error: 'ไม่สามารถสร้าง Canvas เพื่อสแกนภาพได้' })
          setScanning(false)
          return
        }
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, img.width, img.height)
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height)

        if (!qrCode) {
          setQrStatus({
            scanned: true,
            hasQR: false,
            isValid: false,
            error: 'ไม่พบ QR Code ในภาพสลิป เพื่อความรวดเร็วในการอนุมัติอัตโนมัติ แนะนำให้อัปโหลดสลิปที่มี QR Code ชัดเจน'
          })
          setScanning(false)
          return
        }

        const parsed = parseSlipQR(qrCode.data)
        if (!parsed.isValid) {
          setQrStatus({
            scanned: true,
            hasQR: true,
            isValid: false,
            error: 'QR Code นี้ไม่ใช่สลิปการโอนเงินที่ถูกต้องตามมาตรฐานธนาคาร'
          })
          setScanning(false)
          return
        }

        // Check duplicates via API
        const dupRes = await fetch('/api/payments/check-duplicate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transRef: parsed.transRef })
        })
        const dupData = await dupRes.json()

        if (dupData.exists) {
          setQrStatus({
            scanned: true,
            hasQR: true,
            isValid: false,
            error: dupData.isOwnSlip
              ? 'คุณเคยส่งสลิปรายการโอนนี้ในระบบแล้ว'
              : 'สลิปนี้ถูกใช้ชำระเงินโดยนักศึกษาคนอื่นในระบบแล้ว'
          })
          setScanning(false)
          return
        }

        // Amount Check
        if (parsed.amount !== null && selectedCycle && parsed.amount !== selectedCycle.amount) {
          // Look for other unpaid period matching the slip amount
          const match = unpaidCycles.find(c => c.amount === parsed.amount && c.id !== periodId)
          if (match) {
            setSuggestedWeek(match)
          } else {
            setAmountMismatch(true)
          }
        }

        setQrStatus({
          scanned: true,
          hasQR: true,
          isValid: true,
          transRef: parsed.transRef,
          amount: parsed.amount,
          bank: parsed.sendingBank
        })
      } catch (err) {
        console.error('Error scanning QR:', err)
        setQrStatus({ scanned: true, hasQR: false, isValid: false, error: 'เกิดข้อผิดพลาดระหว่างการวิเคราะห์สลิป' })
      } finally {
        setScanning(false)
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const handleSwitchWeek = () => {
    if (suggestedWeek && onPeriodChange) {
      onPeriodChange(suggestedWeek.id)
      setSuggestedWeek(null)
    }
  }

  // Trigger re-check if user changes the period manually
  useEffect(() => {
    if (file && qrStatus.scanned && qrStatus.isValid) {
      // Re-evaluate amount match for the new selected period
      const currentCycle = unpaidCycles.find(c => c.id === periodId)
      if (qrStatus.amount !== null && currentCycle) {
        if (qrStatus.amount === currentCycle.amount) {
          setSuggestedWeek(null)
          setAmountMismatch(false)
        } else {
          const match = unpaidCycles.find(c => c.amount === qrStatus.amount && c.id !== periodId)
          if (match) {
            setSuggestedWeek(match)
            setAmountMismatch(false)
          } else {
            setSuggestedWeek(null)
            setAmountMismatch(true)
          }
        }
      }
    }
  }, [periodId, unpaidCycles, file, qrStatus.scanned, qrStatus.isValid, qrStatus.amount])

  const handleSubmit = async () => {
    if (!file) return
    setStep('verifying')

    // Animate steps
    const updateStep = async (idx: number, done = false) => {
      setVerifySteps((prev) =>
        prev.map((s, i) => ({
          ...s,
          active: i === idx && !done,
          done: i < idx || (i === idx && done),
        }))
      )
      await new Promise((r) => setTimeout(r, 1000))
    }

    await updateStep(0)
    await updateStep(0, true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('period_id', periodId)

    try {
      await updateStep(1)
      const res = await fetch('/api/payments/upload', { method: 'POST', body: formData })
      const data = await res.json()
      await updateStep(1, true)

      await updateStep(2)
      await updateStep(2, true)

      if (!res.ok) {
        setErrorMsg(data.error || 'การตรวจสอบสลิปไม่ผ่านเงื่อนไข')
        setStep('failed')
        onError?.(data.error)
        return
      }

      setSuccessData(data)
      if (data.quota_exceeded) {
        setOcrResult({
          'สถานะการตรวจ': 'รอเหรัญญิกตรวจสอบมือ (API Quota หมด)',
          'เลขอ้างอิง': 'จะระบุภายหลัง',
        })
      } else {
        setOcrResult({
          'ยอดโอน': data.ocr?.amount ? `฿${data.ocr.amount.toLocaleString()}` : 'ไม่ระบุ',
          'ธนาคารผู้โอน': data.ocr?.bank ? (BANK_NAMES[data.ocr.bank] || data.ocr.bank) : 'ไม่ระบุ',
          'รหัสอ้างอิง': data.ocr?.trans_ref || 'ไม่ระบุ',
          'วันที่โอน': data.ocr?.date || 'ไม่ระบุ',
        })
      }
      setStep('success')
      onSuccess?.()
    } catch {
      setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
      setStep('failed')
    }
  }

  const isSubmitDisabled = 
    !file || 
    scanning || 
    (qrStatus.scanned && qrStatus.hasQR && !qrStatus.isValid) || 
    (qrStatus.scanned && !qrStatus.hasQR && !manualConfirm) ||
    (amountMismatch && !manualConfirm)

  if (step === 'verifying') {
    return (
      <div className="flex gap-6 items-start">
        {preview && (
          <div className="w-28 h-36 rounded-lg border border-border overflow-hidden flex-shrink-0">
            <img src={preview} alt="slip" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 space-y-3 pt-1">
          <div className="text-[13px] font-semibold text-text-primary mb-4 flex items-center gap-2">
            <Loader2 className="w-4 h-4 text-brand animate-spin" />
            กำลังส่งข้อมูล...
          </div>
          {verifySteps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              {s.done ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              ) : s.active ? (
                <Loader2 className="w-4 h-4 text-brand animate-spin flex-shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />
              )}
              <span className={cn(
                'text-[12.5px]',
                s.done ? 'text-text-primary' : s.active ? 'text-text-primary font-medium' : 'text-text-muted'
              )}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (step === 'success') {
    // Auto-approved (credit case) vs pending (normal case)
    const isAutoApproved = successData?.payment?.status === 'approved'

    return (
      <div className="text-center py-6">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 ${isAutoApproved ? 'bg-emerald-100' : 'bg-blue-50'}`}>
          <CheckCircle className={`w-6 h-6 ${isAutoApproved ? 'text-emerald-600' : 'text-blue-500'}`} />
        </div>
        <div className="text-[15px] font-bold text-text-primary mb-1">ส่งสลิปสำเร็จ ✓</div>
        <div className="text-[12.5px] text-text-muted mb-4">
          {successData?.quota_exceeded
            ? 'ระบบได้รับสลิปของคุณแล้ว'
            : `ระบบบันทึกสลิปสำหรับ ${selectedCycle?.label || 'งวดที่กำหนด'} เรียบร้อยแล้ว`}
        </div>

        {/* Status Banner */}
        {isAutoApproved ? (
          <div className="mb-5 p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-left flex gap-2.5 items-start">
            <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[12.5px] font-bold text-emerald-900">อนุมัติอัตโนมัติ</div>
              <div className="text-[11.5px] text-emerald-800 mt-0.5">ยอดค้างชำระของคุณถูกหักออกแล้ว — ไม่ต้องรอเหรัญญิก</div>
            </div>
          </div>
        ) : (
          <div className="mb-5 p-3 bg-amber-50 border border-amber-100 rounded-xl text-left flex gap-2.5 items-start">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-[12.5px] font-bold text-amber-900">รอเหรัญญิกตรวจสอบ</div>
              <div className="text-[11.5px] text-amber-800 mt-0.5">
                สลิปของคุณ<span className="font-bold">ยังไม่ผ่านการอนุมัติ</span> — กรุณารอเหรัญญิกตรวจสอบ
                ระบบจะแจ้ง LINE เมื่ออนุมัติแล้ว
              </div>
            </div>
          </div>
        )}

        {ocrResult && (
          <div className="bg-background-muted border border-border-strong rounded-xl p-4 text-left mb-5 space-y-2.5">
            <div className="text-[11px] font-bold text-text-muted uppercase tracking-wider mb-1 border-b border-border-strong pb-1">ข้อมูลที่ตรวจสอบพบ</div>
            {Object.entries(ocrResult).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[12.5px]">
                <span className="text-text-secondary">{k}</span>
                <span className="font-semibold text-text-primary text-right">{v}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => { setStep('upload'); setFile(null); setPreview(null); setQrStatus({ scanned: false, hasQR: false, isValid: false }) }}
          className="text-[12.5px] text-brand hover:underline font-semibold"
        >
          ส่งสลิปใบอื่นเพิ่มเติม
        </button>
      </div>
    )
  }


  if (step === 'failed') {
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-6 h-6 text-red-500" />
        </div>
        <div className="text-[15px] font-bold text-text-primary mb-1">ส่งสลิปไม่สำเร็จ</div>
        <div className="text-[12.5px] text-text-muted mb-5 max-w-sm mx-auto">{errorMsg}</div>
        <button
          onClick={() => { setStep('upload'); setFile(null); setPreview(null); setQrStatus({ scanned: false, hasQR: false, isValid: false }) }}
          className="bg-brand text-white text-[13px] font-semibold px-5 py-2.5 rounded-xl hover:bg-brand-hover transition-colors"
        >
          ลองใหม่อีกครั้ง
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!preview ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDropCapture={(e) => e.preventDefault()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          className={cn(
            'border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-200 luxury-shadow',
            dragOver ? 'border-brand bg-background-muted' : 'border-border-strong hover:border-brand/40 hover:bg-background-muted'
          )}
        >
          <Upload className="w-9 h-9 text-text-muted mx-auto mb-3" />
          <div className="text-[13px] font-semibold text-text-primary mb-1">คลิกเพื่ออัปโหลด หรือลากไฟล์มาวาง</div>
          <div className="text-[11.5px] text-text-muted">PNG, JPG, WEBP ขนาดไม่เกิน 5MB</div>
          <input 
            ref={inputRef} 
            type="file" 
            accept="image/png,image/jpeg,image/webp" 
            className="hidden" 
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} 
          />
        </div>
      ) : (
        <div className="border border-border-strong rounded-2xl overflow-hidden luxury-shadow">
          <div className="flex items-center justify-between px-4 py-3 bg-background-muted border-b border-border-strong">
            <div className="flex items-center gap-2 text-[12.5px] text-text-secondary font-medium">
              <ImageIcon className="w-4 h-4 text-text-muted" />
              <span className="truncate max-w-[200px]">{file?.name}</span>
            </div>
            <button 
              onClick={() => { setFile(null); setPreview(null); setQrStatus({ scanned: false, hasQR: false, isValid: false }) }} 
              className="text-[11.5px] text-text-muted hover:text-text-primary underline font-medium"
            >
              เปลี่ยนไฟล์
            </button>
          </div>
          <div className="p-4 flex justify-center bg-background-tertiary">
            <img src={preview} alt="preview" className="max-h-[220px] object-contain rounded-lg shadow-sm" />
          </div>
        </div>
      )}

      {/* Pre-verification Status UI */}
      {preview && (
        <div className="space-y-3">
          {scanning && (
            <div className="flex items-center justify-center gap-2 py-3 border border-border-strong bg-background-muted rounded-xl animate-pulse">
              <RefreshCw className="w-4 h-4 text-brand animate-spin" />
              <span className="text-[12.5px] text-text-secondary font-medium">กำลังสแกนและวิเคราะห์สลิป...</span>
            </div>
          )}

          {!scanning && qrStatus.scanned && (
            <div className="space-y-3">
              {/* Case 1: Scanning Failed or Invalid QR */}
              {(!qrStatus.isValid) && (
                <div className="p-4 border border-red-100 bg-red-50/50 rounded-xl space-y-2">
                  <div className="flex gap-2.5 items-start">
                    <XCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[12.5px] font-bold text-red-900">ตรวจสอบสลิปไม่ผ่าน</div>
                      <div className="text-[11.5px] text-red-800 mt-0.5">{qrStatus.error}</div>
                    </div>
                  </div>

                  {/* Let user bypass if it is simply "No QR found" */}
                  {!qrStatus.hasQR && (
                    <div className="pt-2 border-t border-red-100/50 flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="manual_confirm_check"
                        checked={manualConfirm}
                        onChange={(e) => setManualConfirm(e.target.checked)}
                        className="rounded border-red-200 text-red-600 focus:ring-red-500 w-3.5 h-3.5 cursor-pointer"
                      />
                      <label htmlFor="manual_confirm_check" className="text-[11.5px] text-red-900 font-medium cursor-pointer">
                        ยืนยันส่งภาพนี้เพื่อขอตรวจสอบด้วยตัวเอง (แอดมินตรวจแมนนวล)
                      </label>
                    </div>
                  )}
                </div>
              )}

              {/* Case 2: Valid Slip Scanned */}
              {qrStatus.isValid && (
                <div className="space-y-3">
                  <div className="p-4 border border-emerald-100 bg-emerald-50/30 rounded-xl">
                    <div className="flex gap-2.5 items-start">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="text-[12.5px] font-bold text-emerald-900">สแกนและตรวจสอบข้อมูลสำเร็จ</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[11.5px] text-emerald-800">
                          <div>ยอดเงิน: <span className="font-bold">{qrStatus.amount ? `฿${qrStatus.amount.toLocaleString()}` : 'ไม่ระบุ'}</span></div>
                          <div>ธนาคาร: <span className="font-semibold">{qrStatus.bank ? (BANK_NAMES[qrStatus.bank] || qrStatus.bank) : 'ไม่ระบุ'}</span></div>
                          <div className="col-span-2 mt-0.5 text-emerald-700/80 font-mono text-[10.5px]">Ref: {qrStatus.transRef}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Suggestion Case 1: Amount matches another week */}
                  {suggestedWeek && (
                    <div className="p-4 border border-amber-100 bg-amber-50/50 rounded-xl space-y-3">
                      <div className="flex gap-2.5 items-start">
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[12.5px] font-bold text-amber-900">ตรวจพบยอดเงินไม่ตรงกับงวดที่เลือก</div>
                          <div className="text-[11.5px] text-amber-800 mt-1">
                            ยอดเงินสลิปคือ <span className="font-bold">฿{qrStatus.amount?.toLocaleString()}</span> 
                            ซึ่งตรงกับยอดที่ต้องชำระของ <span className="font-bold">{suggestedWeek.label}</span> 
                            (คุณกำลังทำรายการสำหรับ {selectedCycle?.label} ยอด ฿{selectedCycle?.amount.toLocaleString()})
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={handleSwitchWeek}
                        className="w-full bg-amber-600 text-white text-[12px] font-semibold py-2 px-3 rounded-lg hover:bg-amber-700 transition-colors shadow-sm"
                      >
                        สลับชำระสำหรับ {suggestedWeek.label}
                      </button>
                    </div>
                  )}

                  {/* Suggestion Case 2: Amount Mismatch (No suggested week) */}
                  {amountMismatch && !suggestedWeek && (
                    <div className="p-4 border border-amber-100 bg-amber-50/50 rounded-xl space-y-2">
                      <div className="flex gap-2.5 items-start">
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[12.5px] font-bold text-amber-900">ยอดเงินโอนไม่ตรงกับยอดของงวดที่เลือก</div>
                          <div className="text-[11.5px] text-amber-800 mt-1">
                            ยอดเงินในสลิปคือ <span className="font-bold">฿{qrStatus.amount?.toLocaleString()}</span> 
                            แต่ยอดที่กำหนดในงวดนี้คือ <span className="font-bold">฿{selectedCycle?.amount.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-amber-200/50 flex items-center gap-2">
                        <input 
                          type="checkbox" 
                          id="amount_mismatch_check"
                          checked={manualConfirm}
                          onChange={(e) => setManualConfirm(e.target.checked)}
                          className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <label htmlFor="amount_mismatch_check" className="text-[11.5px] text-amber-900 font-medium cursor-pointer">
                          ยืนยันว่าจำนวนเงินถูกต้อง (เช่น จ่ายบางส่วน หรือชดใช้ยอดเก่า)
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={isSubmitDisabled}
        className="w-full bg-brand text-white text-[13.5px] font-semibold py-3 rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer shadow-sm"
      >
        {scanning ? 'กำลังตรวจสอบสลิป...' : `ยืนยันส่งหลักฐานสำหรับ ${selectedCycle?.label || 'งวดที่เลือก'}`}
      </button>
    </div>
  )
}
