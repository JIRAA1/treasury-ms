'use client'

import { useState, useRef } from 'react'
import { Upload, CheckCircle, XCircle, Loader2, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WeekStatus } from '@/types'
import { useDialog } from '@/components/shared/GlobalDialog'

interface SlipUploaderProps {
  week: number
  onSuccess?: () => void
  onError?: (error: string) => void
}

type Step = 'upload' | 'verifying' | 'success' | 'failed'

interface VerifyStep {
  label: string
  done: boolean
  active: boolean
}

export default function SlipUploader({ week, onSuccess, onError }: SlipUploaderProps) {
  const dialog = useDialog()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [step, setStep] = useState<Step>('upload')
  const [dragOver, setDragOver] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [verifySteps, setVerifySteps] = useState<VerifyStep[]>([
    { label: 'กำลังอัปโหลดรูปภาพ...', done: false, active: false },
    { label: 'กำลังอ่านข้อมูลสลิป...', done: false, active: false },
    { label: 'ตรวจสอบจำนวนเงิน...', done: false, active: false },
    { label: 'ตรวจสอบรหัสอ้างอิง...', done: false, active: false },
  ])
  const [ocrResult, setOcrResult] = useState<Record<string, string> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

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
      await new Promise((r) => setTimeout(r, 1500))
    }

    await updateStep(0)
    await updateStep(0, true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('week', week.toString())

    try {
      const res = await fetch('/api/payments/upload', { method: 'POST', body: formData })
      const data = await res.json()

      await updateStep(1)
      await updateStep(1, true)
      await updateStep(2)
      await updateStep(2, true)
      await updateStep(3)
      await updateStep(3, true)

      if (!res.ok) {
        setErrorMsg(data.error || 'เกิดข้อผิดพลาด')
        setStep('failed')
        onError?.(data.error)
        return
      }

      setOcrResult({
        amount: data.ocr?.amount ? `฿${data.ocr.amount}` : 'ไม่พบ',
        date: data.ocr?.date || 'ไม่พบ',
        trans_ref: data.ocr?.trans_ref || 'ไม่พบ',
        bank: data.ocr?.bank || 'ไม่พบ',
      })
      setStep('success')
      onSuccess?.()
    } catch {
      setErrorMsg('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
      setStep('failed')
    }
  }

  if (step === 'verifying') {
    return (
      <div className="flex gap-6 items-start">
        {preview && (
          <div className="w-28 h-36 rounded-lg border border-border overflow-hidden flex-shrink-0">
            <img src={preview} alt="slip" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 space-y-3 pt-1">
          <div className="text-[13px] font-semibold text-text-primary mb-4">กำลังตรวจสอบสลิป...</div>
          {verifySteps.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              {s.done ? (
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
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
    return (
      <div className="text-center py-6">
        <div className="w-12 h-12 bg-brand rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-6 h-6 text-white" />
        </div>
        <div className="text-[15px] font-semibold text-text-primary mb-1">ส่งสลิปสำเร็จ</div>
        <div className="text-[12.5px] text-text-muted mb-5">งวดที่ {week} · รอการตรวจสอบจากเหรัญญิก</div>
        {ocrResult && (
          <div className="bg-background-secondary border border-border rounded-lg p-4 text-left mb-5 space-y-2">
            {Object.entries(ocrResult).map(([k, v]) => (
              <div key={k} className="flex justify-between text-[12px]">
                <span className="text-text-muted capitalize">{k.replace('_', ' ')}</span>
                <span className="font-medium text-text-primary">{v}</span>
              </div>
            ))}
          </div>
        )}
        <button
          onClick={() => { setStep('upload'); setFile(null); setPreview(null) }}
          className="text-[12.5px] text-text-secondary hover:text-text-primary underline"
        >
          ส่งสลิปอื่นเพิ่มเติม
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
        <div className="text-[15px] font-semibold text-text-primary mb-1">ตรวจสอบไม่ผ่าน</div>
        <div className="text-[12.5px] text-text-muted mb-5">{errorMsg}</div>
        <button
          onClick={() => { setStep('upload'); setFile(null); setPreview(null) }}
          className="bg-brand text-white text-[13px] font-medium px-5 py-2 rounded-lg hover:bg-brand-hover transition-colors"
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
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          className={cn(
            'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
            dragOver ? 'border-brand bg-background-secondary' : 'border-border-strong hover:border-brand/60 hover:bg-background-secondary'
          )}
        >
          <Upload className="w-9 h-9 text-text-muted mx-auto mb-3" />
          <div className="text-[13px] font-medium text-text-primary mb-1">คลิกเพื่ออัปโหลด หรือลากไฟล์มาวาง</div>
          <div className="text-[11.5px] text-text-muted">PNG, JPG ขนาดไม่เกิน 5MB</div>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-background-secondary border-b border-border">
            <div className="flex items-center gap-2 text-[12.5px] text-text-secondary">
              <ImageIcon className="w-4 h-4" />
              <span>{file?.name}</span>
            </div>
            <button onClick={() => { setFile(null); setPreview(null) }} className="text-[12px] text-text-muted hover:text-text-primary underline">
              เปลี่ยนไฟล์
            </button>
          </div>
          <div className="p-4 flex justify-center">
            <img src={preview} alt="preview" className="max-h-[200px] object-contain rounded" />
          </div>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={!file}
        className="w-full bg-brand text-white text-[13.5px] font-medium py-2.5 rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ส่งสลิปงวดที่ {week}
      </button>
    </div>
  )
}
