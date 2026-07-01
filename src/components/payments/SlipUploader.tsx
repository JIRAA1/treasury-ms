'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, CheckCircle, XCircle, Loader2, ImageIcon, AlertTriangle, RefreshCw } from 'lucide-react'
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
  const [rawQrPayload, setRawQrPayload] = useState<string | null>(null)
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
    setRawQrPayload(null)
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
        setRawQrPayload(qrCode.data)
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
    // Send the raw QR payload to the server so it can call verifySlipByPayload
    if (rawQrPayload) formData.append('qr_payload', rawQrPayload)
    // If user bypassed missing-QR warning, tell the server about it
    if (manualConfirm) formData.append('manual_confirm', 'true')

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

  // ── INJECT CUSTOM CSS ANIMATIONS ON MOUNT ──────────────────────────────────
  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'slip-uploader-custom-styles'
    style.innerHTML = `
      @keyframes neonPulse {
        0%, 100% { border-color: rgba(16, 185, 129, 0.3); box-shadow: 0 0 5px rgba(16, 185, 129, 0.1), inset 0 0 5px rgba(16, 185, 129, 0.05); }
        50% { border-color: rgba(16, 185, 129, 0.8); box-shadow: 0 0 20px rgba(16, 185, 129, 0.4), inset 0 0 10px rgba(16, 185, 129, 0.15); }
      }
      @keyframes neonPulseHover {
        0%, 100% { border-color: rgba(99, 102, 241, 0.3); box-shadow: 0 0 5px rgba(99, 102, 241, 0.1); }
        50% { border-color: rgba(99, 102, 241, 0.8); box-shadow: 0 0 20px rgba(99, 102, 241, 0.4); }
      }
      @keyframes laserScan {
        0% { top: 0%; opacity: 0.3; }
        50% { top: 100%; opacity: 1; }
        100% { top: 0%; opacity: 0.3; }
      }
      @keyframes iconFloat {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-6px); }
      }
      @keyframes checkPop {
        0% { transform: scale(0.8); opacity: 0; }
        50% { transform: scale(1.15); }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes shimmerGlow {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
      .luxury-scanner::after {
        content: '';
        position: absolute;
        left: 0;
        right: 0;
        height: 4px;
        background: linear-gradient(90deg, transparent, #10b981 20%, #34d399 50%, #10b981 80%, transparent);
        box-shadow: 0 0 15px #10b981, 0 0 30px #34d399;
        animation: laserScan 2.5s infinite linear;
        z-index: 10;
      }
      .pulse-glow-emerald {
        animation: neonPulse 2.5s infinite ease-in-out;
      }
      .pulse-glow-hover:hover {
        animation: neonPulseHover 2s infinite ease-in-out;
      }
      .animate-float {
        animation: iconFloat 3s infinite ease-in-out;
      }
      .receipt-bg {
        background: linear-gradient(135deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%);
      }
    `
    document.head.appendChild(style)
    return () => {
      const el = document.getElementById('slip-uploader-custom-styles')
      if (el) document.head.removeChild(el)
    }
  }, [])

  // ── CUSTOM CANVAS CONFETTI ──────────────────────────────────────────────────
  useEffect(() => {
    if (step !== 'success') return
    const canvas = document.getElementById('confetti-canvas') as HTMLCanvasElement | null
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const container = canvas.parentElement
    canvas.width = container?.clientWidth || 500
    canvas.height = container?.clientHeight || 450

    interface Particle {
      x: number
      y: number
      size: number
      color: string
      speedX: number
      speedY: number
      rotation: number
      rotationSpeed: number
    }

    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4']
    const particles: Particle[] = []

    const initParticles = () => {
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: 20,
          y: canvas.height - 20,
          size: Math.random() * 8 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          speedX: Math.random() * 6 + 2,
          speedY: -Math.random() * 12 - 6,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 12
        })
      }
      for (let i = 0; i < 60; i++) {
        particles.push({
          x: canvas.width - 20,
          y: canvas.height - 20,
          size: Math.random() * 8 + 4,
          color: colors[Math.floor(Math.random() * colors.length)],
          speedX: -Math.random() * 6 - 2,
          speedY: -Math.random() * 12 - 6,
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 12
        })
      }
    }

    initParticles()
    let animId: number

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      let hasActive = false

      particles.forEach(p => {
        p.x += p.speedX
        p.y += p.speedY
        p.speedY += 0.25
        p.rotation += p.rotationSpeed

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate((p.rotation * Math.PI) / 180)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
        ctx.restore()

        if (p.y < canvas.height + 20 && p.x > -20 && p.x < canvas.width + 20) {
          hasActive = true
        }
      })

      if (hasActive) {
        animId = requestAnimationFrame(render)
      }
    }

    render()
    return () => cancelAnimationFrame(animId)
  }, [step])

  const isSubmitDisabled = 
    !file || 
    scanning || 
    (qrStatus.scanned && qrStatus.hasQR && !qrStatus.isValid) || 
    (qrStatus.scanned && !qrStatus.hasQR && !manualConfirm) ||
    (amountMismatch && !manualConfirm)

  if (step === 'verifying') {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-black/20 bg-background-secondary/80 backdrop-blur-xl p-6 md:p-8 luxury-shadow flex flex-col md:flex-row gap-8 items-center min-h-[300px]">
        <div className="absolute top-0 right-0 w-48 h-48 bg-brand/10 rounded-full filter blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/10 rounded-full filter blur-3xl pointer-events-none" />

        {preview && (
          <div className="w-32 h-44 rounded-xl border border-border overflow-hidden flex-shrink-0 relative shadow-2xl animate-pulse">
            <img src={preview} alt="slip" className="w-full h-full object-cover grayscale opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-t from-background-secondary via-transparent to-transparent" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <Loader2 className="w-8 h-8 text-brand animate-spin" />
            </div>
          </div>
        )}
        <div className="flex-1 space-y-6 w-full">
          <div>
            <div className="text-[15px] font-bold text-text-primary mb-1 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-brand animate-spin" />
              กำลังประมวลผลระบบชำระเงิน
            </div>
            <div className="text-[12px] text-text-muted">กรุณารอสักครู่ ระบบกำลังนำส่งข้อมูลเข้าสู่ฐานข้อมูลและทำรายการอนุมัติ</div>
          </div>

          <div className="space-y-3.5 bg-background-muted/40 p-4.5 rounded-xl border border-border-strong">
            {verifySteps.map((s, i) => (
              <div key={i} className="flex items-center gap-3.5 transition-all duration-300">
                {s.done ? (
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0" style={{ animation: 'checkPop 0.4s ease-out forwards' }}>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  </div>
                ) : s.active ? (
                  <div className="w-5 h-5 rounded-full bg-brand/15 border border-brand/30 flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-3 h-3 text-brand animate-spin" />
                  </div>
                ) : (
                  <div className="w-5 h-5 rounded-full border border-border-strong flex-shrink-0 bg-background-muted" />
                )}
                <span className={cn(
                  'text-[12.5px] transition-colors duration-300',
                  s.done ? 'text-emerald-600 dark:text-emerald-500 font-medium' : s.active ? 'text-text-primary font-bold' : 'text-text-muted'
                )}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (step === 'success') {
    const isAutoApproved = successData?.payment?.status === 'approved'

    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-black/20 bg-background-secondary/80 backdrop-blur-xl p-6 md:p-8 luxury-shadow text-center min-h-[400px]">
        <canvas id="confetti-canvas" className="absolute inset-0 w-full h-full pointer-events-none z-40" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-emerald-500/10 rounded-full filter blur-3xl pointer-events-none" />

        <div className="relative w-16 h-16 mx-auto mb-5 z-10 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 dark:bg-emerald-500/10 animate-ping opacity-60" />
          <div className="w-14 h-14 rounded-full bg-emerald-500 dark:bg-emerald-600 shadow-lg shadow-emerald-500/20 flex items-center justify-center relative" style={{ animation: 'checkPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards' }}>
            <CheckCircle className="w-7 h-7 text-white" />
          </div>
        </div>

        <div className="text-[17px] font-black text-text-primary mb-1">ส่งหลักฐานการชำระเงินสำเร็จ ✓</div>
        <div className="text-[12px] text-text-muted mb-6 max-w-xs mx-auto">
          {successData?.quota_exceeded
            ? 'ระบบอัปโหลดใบเสร็จในความดูแลของเหรัญญิกเรียบร้อยแล้ว'
            : `บันทึกสลิปสำหรับการจ่ายเงิน "${selectedCycle?.label || 'งวดปัจจุบัน'}" เรียบร้อย`}
        </div>

        {ocrResult && (
          <div className="relative bg-background-muted/70 backdrop-blur-md border border-border-strong rounded-2xl p-5 text-left mb-6 space-y-4 max-w-sm mx-auto shadow-inner overflow-hidden">
            <div className="absolute -top-3 -right-3 w-16 h-16 rounded-full border-4 border-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-500/30 rotate-[20deg] select-none pointer-events-none">
              VERIFIED
            </div>

            <div className="flex justify-between items-center border-b border-border-strong pb-3">
              <span className="text-[11px] font-black text-text-muted uppercase tracking-wider">รายละเอียดใบเสร็จ</span>
              <span className="text-[10px] bg-brand/10 text-brand px-2 py-0.5 rounded-full font-bold">Smart QR</span>
            </div>

            <div className="space-y-3">
              {Object.entries(ocrResult).map(([k, v]) => (
                <div key={k} className="flex justify-between items-start gap-4 text-[12.5px]">
                  <span className="text-text-secondary text-[12px]">{k}</span>
                  <span className="font-semibold text-text-primary text-right break-all max-w-[200px]">{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="max-w-sm mx-auto mb-6">
          {isAutoApproved ? (
            <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-xl text-left flex gap-3 items-start">
              <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-[12.5px] font-bold text-emerald-900 dark:text-emerald-400">อนุมัติอัตโนมัติ</div>
                <div className="text-[11px] text-emerald-800/85 dark:text-emerald-500/80 mt-0.5">ยอดค้างชำระของท่านได้รับการหักล้างเรียบร้อยแล้ว โดยมียอดเครดิตก่อนหน้า</div>
              </div>
            </div>
          ) : (
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-100 dark:border-amber-900/40 rounded-xl text-left flex gap-3 items-start">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-[12.5px] font-bold text-amber-900 dark:text-amber-400">รอการตรวจสอบ</div>
                <div className="text-[11px] text-amber-800/85 dark:text-amber-500/80 mt-0.5">สลิปอยู่ในคิวรอการตรวจสอบโดยเหรัญญิก ระบบจะส่งแจ้งเตือนทาง LINE เมื่อมีอัปเดต</div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => { setStep('upload'); setFile(null); setPreview(null); setRawQrPayload(null); setQrStatus({ scanned: false, hasQR: false, isValid: false }) }}
          className="text-[12.5px] text-brand hover:text-brand-hover font-semibold transition-colors flex items-center justify-center gap-1 mx-auto"
        >
          <span>อัปโหลดสลิปใบอื่นเพิ่มเติม</span>
        </button>
      </div>
    )
  }

  if (step === 'failed') {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 dark:border-black/20 bg-background-secondary/80 backdrop-blur-xl p-6 md:p-8 luxury-shadow text-center min-h-[300px] flex flex-col justify-center items-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-red-500/10 rounded-full filter blur-3xl pointer-events-none" />

        <div className="w-14 h-14 bg-red-50 dark:bg-red-950/20 rounded-full flex items-center justify-center mb-4 border border-red-100 dark:border-red-900/30 relative">
          <div className="absolute inset-0 rounded-full bg-red-500/10 animate-ping opacity-40" />
          <XCircle className="w-7 h-7 text-red-500" />
        </div>

        <div className="text-[16px] font-bold text-text-primary mb-1">ส่งหลักฐานล้มเหลว</div>
        <div className="text-[12.5px] text-text-muted mb-6 max-w-sm">{errorMsg}</div>

        <button
          onClick={() => { setStep('upload'); setFile(null); setPreview(null); setRawQrPayload(null); setQrStatus({ scanned: false, hasQR: false, isValid: false }) }}
          className="bg-brand hover:bg-brand-hover text-white text-[13px] font-bold px-6 py-2.5 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-brand/20 cursor-pointer"
        >
          กลับไปแก้ไขและลองใหม่
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* ── DRAG AND DROP AREA ──────────────────────────────────────────────────── */}
      {!preview ? (
        <div
          onClick={() => inputRef.current?.click()}
          onDrop={handleDrop}
          onDropCapture={(e) => e.preventDefault()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          className={cn(
            'relative overflow-hidden border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all duration-300 luxury-shadow flex flex-col items-center justify-center min-h-[220px]',
            dragOver 
              ? 'border-brand bg-brand/5 scale-[1.01]' 
              : 'border-border-strong hover:border-brand/50 hover:bg-background-muted/30 pulse-glow-hover'
          )}
        >
          <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.015] pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '16px 16px' }} />

          <div className="relative w-14 h-14 bg-brand/10 dark:bg-brand/5 rounded-2xl flex items-center justify-center mb-4 transition-all duration-300 group-hover:scale-110 shadow-sm animate-float">
            <Upload className="w-6 h-6 text-brand" />
          </div>

          <div className="text-[13.5px] font-bold text-text-primary mb-1">
            ลากและวางรูปสลิป หรือ คลิกเพื่อนำเข้า
          </div>
          <div className="text-[11.5px] text-text-muted">
            รองรับ PNG, JPG, WEBP ขนาดข้อมูลไม่เกิน 5MB
          </div>
          <input 
            ref={inputRef} 
            type="file" 
            accept="image/png,image/jpeg,image/webp" 
            className="hidden" 
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} 
          />
        </div>
      ) : (
        /* ── PREVIEW VIEW WITH SCI-FI SCANNER ───────────────────────────────────── */
        <div className="border border-border-strong rounded-2xl overflow-hidden bg-background-secondary/40 backdrop-blur-md luxury-shadow transition-all duration-300">
          <div className="flex items-center justify-between px-4 py-3 bg-background-muted/50 border-b border-border-strong">
            <div className="flex items-center gap-2.5 text-[12.5px] text-text-secondary font-medium">
              <ImageIcon className="w-4 h-4 text-brand" />
              <span className="truncate max-w-[200px] font-semibold">{file?.name}</span>
            </div>
            <button 
              onClick={() => { setFile(null); setPreview(null); setRawQrPayload(null); setQrStatus({ scanned: false, hasQR: false, isValid: false }) }} 
              className="text-[11.5px] text-brand hover:text-brand-hover hover:underline font-bold transition-all"
            >
              เปลี่ยนไฟล์ภาพ
            </button>
          </div>
          
          <div className={cn(
            "p-5 flex justify-center bg-background-tertiary/40 relative overflow-hidden",
            scanning && "luxury-scanner"
          )}>
            {scanning && (
              <>
                <div className="absolute inset-0 bg-emerald-500/5 mix-blend-overlay animate-pulse pointer-events-none" />
                <div className="absolute top-2 left-3 font-mono text-[8.5px] text-emerald-500/60 pointer-events-none select-none">
                  SYSTEM_STATUS: RESOLVING_SLIP_IMAGE<br />
                  SCANNING_MATRIX: 2D_QR_CODE
                </div>
              </>
            )}
            <img 
              src={preview} 
              alt="preview" 
              className={cn(
                "max-h-[240px] object-contain rounded-xl shadow-lg border border-border-strong/50 transition-all duration-500",
                scanning && "brightness-[1.1] contrast-[1.05]"
              )} 
            />
          </div>
        </div>
      )}

      {/* ── SCANNING & VALIDATION OVERLAYS ──────────────────────────────────────── */}
      {preview && (
        <div className="space-y-4">
          {scanning && (
            <div className="flex items-center justify-center gap-3 py-3.5 border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl relative overflow-hidden pulse-glow-emerald">
              <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
              <span className="text-[12.5px] text-emerald-700 dark:text-emerald-400 font-bold tracking-wide">
                กำลังสแกนและถอดรหัส QR Payload...
              </span>
            </div>
          )}

          {!scanning && qrStatus.scanned && (
            <div className="space-y-3.5 animate-in fade-in slide-in-from-top-1 duration-200">
              {(!qrStatus.isValid) && (
                <div className="p-4 border border-red-100 dark:border-red-900/30 bg-red-50/40 dark:bg-red-950/10 rounded-xl space-y-3" style={{ animation: 'neonPulse 2.5s infinite ease-in-out' }}>
                  <div className="flex gap-3 items-start">
                    <XCircle className="w-4.5 h-4.5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="text-[13px] font-bold text-red-900 dark:text-red-400">ตรวจสอบความถูกต้องไม่ผ่าน</div>
                      <div className="text-[11.5px] text-red-800/85 dark:text-red-500/80 mt-0.5 leading-relaxed">{qrStatus.error}</div>
                    </div>
                  </div>

                  {!qrStatus.hasQR && (
                    <div className="pt-3 border-t border-red-200/40 flex items-center gap-2.5">
                      <input 
                        type="checkbox" 
                        id="manual_confirm_check"
                        checked={manualConfirm}
                        onChange={(e) => setManualConfirm(e.target.checked)}
                        className="rounded border-red-300 text-red-600 focus:ring-red-500 w-4 h-4 cursor-pointer"
                      />
                      <label htmlFor="manual_confirm_check" className="text-[12px] text-red-900 dark:text-red-400 font-bold cursor-pointer select-none">
                        ยินยอมส่งสลิปเพื่อขอตรวจสอบแมนนวลด้วยมือโดยเหรัญญิก
                      </label>
                    </div>
                  )}
                </div>
              )}

              {qrStatus.isValid && (
                <div className="space-y-3">
                  <div className="p-4 border border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl pulse-glow-emerald">
                    <div className="flex gap-3 items-start">
                      <CheckCircle className="w-4.5 h-4.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <div className="w-full">
                        <div className="text-[13px] font-bold text-emerald-800 dark:text-emerald-400">
                          สแกน Smart QR Code เรียบร้อย
                        </div>
                        
                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-3 text-[12px] text-emerald-800/85 dark:text-emerald-400/85 border-t border-emerald-500/10 pt-2.5">
                          <div>
                            <span className="text-[11px] text-emerald-600/70 dark:text-emerald-500/50 block">ยอดชำระ:</span>
                            <span className="font-extrabold text-[13px] text-emerald-700 dark:text-emerald-300">{qrStatus.amount ? `฿${qrStatus.amount.toLocaleString()}` : 'ไม่ระบุ'}</span>
                          </div>
                          <div>
                            <span className="text-[11px] text-emerald-600/70 dark:text-emerald-500/50 block">ธนาคาร:</span>
                            <span className="font-bold text-[12.5px] text-emerald-700 dark:text-emerald-300">{qrStatus.bank ? (BANK_NAMES[qrStatus.bank] || qrStatus.bank) : 'ไม่ระบุ'}</span>
                          </div>
                          <div className="col-span-2 border-t border-emerald-500/10 pt-2">
                            <span className="text-[9.5px] text-emerald-600/70 dark:text-emerald-500/50 block font-mono">TRANSACTION REFERENCE:</span>
                            <span className="font-mono text-[10.5px] text-emerald-700 dark:text-emerald-300 tracking-wider break-all">{qrStatus.transRef}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {suggestedWeek && (
                    <div className="p-4 border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl space-y-3" style={{ animation: 'neonPulse 2.5s infinite ease-in-out' }}>
                      <div className="flex gap-3 items-start">
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-500 flex-shrink-0 mt-0.5 animate-bounce" />
                        <div>
                          <div className="text-[13px] font-bold text-amber-800 dark:text-amber-400">ตรวจพบยอดเงินตรงกับงวดอื่น</div>
                          <div className="text-[11.5px] text-amber-850 dark:text-amber-400/90 mt-1 leading-relaxed">
                            ยอดชำระ <span className="font-bold">฿{qrStatus.amount?.toLocaleString()}</span> 
                            ของสลิปตรงกับยอดค้างของ <span className="font-bold text-amber-900 dark:text-amber-300">"{suggestedWeek.label}"</span>
                            <br />
                            (งวดที่ท่านเลือกอยู่คือ {selectedCycle?.label} ยอด ฿{selectedCycle?.amount.toLocaleString()})
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={handleSwitchWeek}
                        className="w-full bg-amber-600 hover:bg-amber-700 text-white text-[12.5px] font-bold py-2.5 px-3 rounded-xl transition-all shadow-md shadow-amber-600/15"
                      >
                        สลับชำระสำหรับ {suggestedWeek.label}
                      </button>
                    </div>
                  )}

                  {amountMismatch && !suggestedWeek && (
                    <div className="p-4 border border-amber-500/30 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl space-y-3">
                      <div className="flex gap-3 items-start">
                        <AlertTriangle className="w-4.5 h-4.5 text-amber-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <div className="text-[13px] font-bold text-amber-800 dark:text-amber-400">ยอดโอนไม่ตรงกับยอดที่กำหนด</div>
                          <div className="text-[11.5px] text-amber-850 dark:text-amber-400/90 mt-1 leading-relaxed">
                            ยอดเงินสลิปคือ <span className="font-bold">฿{qrStatus.amount?.toLocaleString()}</span> 
                            แต่ยอดที่กำหนดของ {selectedCycle?.label} คือ <span className="font-bold">฿{selectedCycle?.amount.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                      <div className="pt-2.5 border-t border-amber-500/10 flex items-center gap-2.5">
                        <input 
                          type="checkbox" 
                          id="amount_mismatch_check"
                          checked={manualConfirm}
                          onChange={(e) => setManualConfirm(e.target.checked)}
                          className="rounded border-amber-350 text-amber-600 focus:ring-amber-500 w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor="amount_mismatch_check" className="text-[12px] text-amber-900 dark:text-amber-450 font-bold cursor-pointer select-none">
                          ยืนยันว่าข้อมูลถูกต้อง (ชำระขาด/เกิน หรือชดเชยยอดค้างเดิม)
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
        className="w-full bg-brand hover:bg-brand-hover text-white text-[13.5px] font-bold py-3.5 rounded-xl transition-all duration-300 disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer shadow-lg shadow-brand/20 active:scale-[0.98]"
      >
        {scanning ? 'ระบบกำลังสแกนวิเคราะห์ภาพ...' : `ส่งใบเสร็จรับเงินสำหรับ ${selectedCycle?.label || 'งวดที่เลือก'}`}
      </button>
    </div>
  )
}
