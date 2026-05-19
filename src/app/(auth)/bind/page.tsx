'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function BindPage() {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<'bind' | 'otp' | 'done'>('bind')
  const [studentId, setStudentId] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleBind = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{8}$/.test(studentId)) {
      setError('รหัสนักศึกษาต้องเป็นตัวเลข 8 หลัก')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'เกิดข้อผิดพลาด')
        return
      }

      if (data.alreadyBound) {
        // Sign in client-side for existing binding
        await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        })
        
        setStep('done')
        setTimeout(() => {
          router.push('/student/dashboard')
        }, 1000)
        return
      }

      setStep('otp')
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth/bind/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, otp }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'OTP ไม่ถูกต้อง')
        return
      }

      // Sign in client-side with the credentials returned by the server.
      // generateLink uses implicit flow (hash tokens) which server Route Handlers
      // cannot read. The browser Supabase client sets session cookies correctly.
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (signInError) {
        setError(`เข้าสู่ระบบไม่สำเร็จ: ${signInError.message}`)
        return
      }

      setStep('done')
      setTimeout(() => {
        router.push('/student/dashboard')
      }, 1000)
    } catch {
      setError('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-background-secondary border border-border rounded-2xl p-8 shadow-sm">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-9 h-9 bg-brand rounded-lg flex items-center justify-center">
              <span className="text-white text-[15px] font-bold">T</span>
            </div>
            <div>
              <div className="text-[15px] font-semibold text-text-primary">Treasury MS</div>
              <div className="text-[11px] text-text-muted">ผูกบัญชีนักศึกษา</div>
            </div>
          </div>

          {/* Steps indicator */}
          <div className="flex items-center gap-2 mb-8">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${step !== 'bind' ? 'bg-brand text-white' : 'bg-brand text-white'}`}>1</div>
            <div className="text-[11px] text-text-muted">ระบุรหัสนักศึกษา</div>
            <div className="flex-1 h-px bg-border mx-1" />
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${step === 'otp' || step === 'done' ? 'bg-brand text-white' : 'bg-background-tertiary text-text-muted'}`}>2</div>
            <div className="text-[11px] text-text-muted">ยืนยัน OTP</div>
          </div>

          {/* Done state */}
          {step === 'done' ? (
            <div className="text-center py-4">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <div className="text-[15px] font-semibold text-text-primary">ผูกบัญชีสำเร็จ!</div>
              <div className="text-[12.5px] text-text-muted mt-1 flex items-center justify-center gap-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                กำลังเข้าสู่แดชบอร์ด...
              </div>
            </div>

          /* Bind step */
          ) : step === 'bind' ? (
            <form onSubmit={handleBind} className="space-y-4">
              <div>
                <h1 className="text-[18px] font-bold text-text-primary mb-1">ผูกบัญชีนักศึกษา</h1>
                <p className="text-[12.5px] text-text-muted">กรอกรหัสนักศึกษา 8 หลักของคุณ เพื่อผูกกับบัญชี LINE</p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-text-secondary mb-1">รหัสนักศึกษา</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="เช่น 65123456"
                  maxLength={8}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-[15px] bg-background outline-none focus:ring-1 focus:ring-brand transition font-mono tracking-widest text-center"
                />
              </div>
              {error && <p className="text-[11.5px] text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <button
                type="submit"
                disabled={loading || studentId.length !== 8}
                className="w-full bg-brand text-white font-semibold text-[14px] py-2.5 rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'กำลังส่ง OTP...' : 'ส่ง OTP ไปที่ LINE'}
              </button>
            </form>

          /* OTP step */
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <h1 className="text-[18px] font-bold text-text-primary mb-1">ยืนยัน OTP</h1>
                <p className="text-[12.5px] text-text-muted">ระบบส่งรหัส 6 หลักไปที่ LINE ของคุณแล้ว (หมดอายุใน 5 นาที)</p>
              </div>
              <div>
                <label className="block text-[12px] font-medium text-text-secondary mb-1">รหัส OTP</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-[20px] bg-background outline-none focus:ring-1 focus:ring-brand transition font-mono tracking-[0.5em] text-center"
                />
              </div>
              {error && <p className="text-[11.5px] text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="w-full bg-brand text-white font-semibold text-[14px] py-2.5 rounded-xl hover:bg-brand-hover transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'กำลังยืนยัน...' : 'ยืนยัน'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('bind'); setOtp(''); setError('') }}
                className="w-full text-[12px] text-text-muted hover:text-text-secondary underline"
              >
                ย้อนกลับ
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
