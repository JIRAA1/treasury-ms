'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import SlipUploader from '@/components/payments/SlipUploader'
import EmptyState from '@/components/shared/EmptyState'
import UploadPageLoading from './loading'
import { CheckCircle2, Clock, Lock, Calendar, ChevronRight, QrCode, Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PaymentPeriod {
  id: string
  label: string
  amount: number
  deadline: string
  status: 'unpaid' | 'rejected'
  open_at?: string | null
  close_at?: string | null
  qr_url?: string | null
}

type WindowStatus = 'open' | 'upcoming' | 'closed' | 'noWindow'

function getWindowStatus(cycle: PaymentPeriod): WindowStatus {
  const now = new Date()
  const openAt = cycle.open_at ? new Date(cycle.open_at) : null
  const closeAt = cycle.close_at ? new Date(cycle.close_at) : null

  if (!openAt && !closeAt) return 'noWindow'
  if (openAt && now < openAt) return 'upcoming'
  if (closeAt && now > closeAt) return 'closed'
  return 'open'
}

function formatThaiDate(isoStr: string) {
  return new Date(isoStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function UploadPage() {
  const router = useRouter()
  const [unpaidCycles, setUnpaidCycles] = useState<PaymentPeriod[]>([])
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Fetch user profile first to resolve DB user ID
        const { data: profile } = await supabase
          .from('users')
          .select('id, tier')
          .or(`id.eq.${user.id},student_id.eq.${user.user_metadata?.student_id || 'NONE'}`)
          .maybeSingle()

        const targetUserId = profile?.id || user.id

        // 2. Fetch settings, payments, and pending credits in parallel
        const [
          { data: settings },
          { data: payments },
          { data: sysSettings },
          { data: pendingCredits }
        ] = await Promise.all([
          supabase.from('periods').select('id, label, amount, deadline, open_at, close_at, late_fine_amount, qr_url').order('period_order', { ascending: true }),
          supabase.from('payments').select('period_id, status').eq('user_id', targetUserId),
          supabase.from('system_settings').select('*'),
          supabase.from('payment_credits').select('period_id').eq('user_id', targetUserId).eq('status', 'pending')
        ])

        const tierAmounts = {
          A: parseFloat(sysSettings?.find((s: any) => s.key === 'tier_a_amount')?.value || '60'),
          B: parseFloat(sysSettings?.find((s: any) => s.key === 'tier_b_amount')?.value || '50'),
          C: parseFloat(sysSettings?.find((s: any) => s.key === 'tier_c_amount')?.value || '30'),
        }
        const tierAmount = tierAmounts[profile?.tier as 'A' | 'B' | 'C'] ?? tierAmounts.B
        const pendingCreditPeriodIds = new Set(pendingCredits?.map(c => c.period_id) || [])

        const unpaid: PaymentPeriod[] = []
        
        settings?.forEach(s => {
          const p = payments?.find(pay => pay.period_id === s.id)
          if (!p || p.status === 'rejected') {
            const hasPendingCredit = pendingCreditPeriodIds.has(s.id)
            const deadline = s.deadline ? new Date(s.deadline) : null
            const isPastDeadline = deadline ? new Date() > deadline : false
            const lateFine = (!hasPendingCredit && isPastDeadline) ? (s.late_fine_amount ?? 0) : 0
            const expectedAmount = tierAmount + lateFine

            unpaid.push({
              id: s.id,
              label: s.label,
              amount: expectedAmount,
              deadline: s.deadline,
              status: p?.status === 'rejected' ? 'rejected' : 'unpaid',
              open_at: s.open_at ?? null,
              close_at: s.close_at ?? null,
              qr_url: s.qr_url ?? null,
            })
          }
        })

        setUnpaidCycles(unpaid)
        if (unpaid.length === 1) setSelectedPeriodId(unpaid[0].id)
      } catch (error) {
        console.error('Failed to fetch upload data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  const selectedCycle = unpaidCycles.find(c => c.id === selectedPeriodId)
  const selectedWindowStatus = selectedCycle ? getWindowStatus(selectedCycle) : null
  const isWindowLocked = selectedWindowStatus === 'upcoming' || selectedWindowStatus === 'closed'

  const step = selectedPeriodId === null ? 1 : 2

  return (
    <div>
      <Topbar title="ส่งสลิปการชำระเงิน" subtitle="อัปโหลดหลักฐานการโอนเงิน" />

      <div className="p-4 md:p-6 max-w-xl">
        {loading ? (
          <UploadPageLoading />
        ) : unpaidCycles.length === 0 ? (
          <div className="bg-background-secondary border border-border rounded-xl p-8">
            <EmptyState
              icon={CheckCircle2}
              title="ชำระครบทุกงวดแล้ว 🎉"
              description="คุณส่งสลิปครบทุกงวดการชำระที่กำหนดแล้ว หรือไม่มีงวดที่เปิดรับสลิปขณะนี้"
              variant="success"
            />
          </div>
        ) : (
          <div className="space-y-5">
            {/* ── Step Indicator ─────────────────────────────── */}
            <div className="flex items-center gap-0">
              {/* Step 1 */}
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all duration-300 ${
                  step >= 1 ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'bg-background-tertiary text-text-muted'
                }`}>
                  {step > 1 ? <CheckCircle2 className="w-4 h-4" /> : '1'}
                </div>
                <span className={`text-[12px] font-semibold transition-colors ${step >= 1 ? 'text-text-primary' : 'text-text-muted'}`}>
                  เลือกงวด
                </span>
              </div>
              {/* Connector */}
              <div className={`flex-1 h-0.5 mx-3 rounded-full transition-all duration-500 ${step > 1 ? 'bg-brand' : 'bg-border'}`} />
              {/* Step 2 */}
              <div className="flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-bold transition-all duration-300 ${
                  step >= 2 ? 'bg-brand text-white shadow-lg shadow-brand/20' : 'bg-background-tertiary text-text-muted'
                }`}>
                  2
                </div>
                <span className={`text-[12px] font-semibold transition-colors ${step >= 2 ? 'text-text-primary' : 'text-text-muted'}`}>
                  ส่งสลิป
                </span>
              </div>
            </div>

            {/* ── Step 1: Select Period ───────────────────────── */}
            {selectedPeriodId === null && (
              <div className="bg-background-secondary border border-border rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-background-tertiary/30">
                  <div className="text-[14px] font-bold text-text-primary">เลือกงวดที่ต้องการส่งสลิป</div>
                  <div className="text-[12px] text-text-muted mt-0.5">มี {unpaidCycles.length} รายการรอการชำระ</div>
                </div>
                <div className="divide-y divide-border">
                  {unpaidCycles.map((cycle, idx) => {
                    const winStatus = getWindowStatus(cycle)
                    const locked = winStatus === 'upcoming' || winStatus === 'closed'
                    const isRejected = cycle.status === 'rejected'
                    return (
                      <button
                        key={cycle.id}
                        onClick={() => !locked && setSelectedPeriodId(cycle.id)}
                        disabled={locked}
                        style={{ animationDelay: `${idx * 50}ms` }}
                        className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-all duration-150 animate-in fade-in slide-in-from-left-1 ${
                          locked
                            ? 'opacity-50 cursor-not-allowed'
                            : isRejected
                              ? 'hover:bg-red-50/50'
                              : 'hover:bg-background-muted cursor-pointer'
                        }`}
                      >
                        {/* Status icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          locked ? 'bg-background-muted' :
                          isRejected ? 'bg-red-50' : 'bg-brand/5'
                        }`}>
                          {locked
                            ? <Lock className="w-4 h-4 text-text-disabled" />
                            : isRejected
                              ? <Clock className="w-4 h-4 text-red-500" />
                              : <ChevronRight className="w-4 h-4 text-brand" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[14px] font-bold text-text-primary">{cycle.label}</span>
                            {isRejected && (
                              <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">ถูกปฏิเสธ</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[12px] font-bold text-brand">฿{cycle.amount.toLocaleString()}</span>
                            <span className="text-text-muted text-[11px] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {new Date(cycle.deadline).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </span>
                            {winStatus === 'upcoming' && cycle.open_at && (
                              <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100 font-bold flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" />
                                เปิด {formatThaiDate(cycle.open_at)}
                              </span>
                            )}
                            {winStatus === 'closed' && (
                              <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100 font-bold flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                ปิดรับสลิปแล้ว
                              </span>
                            )}
                            {winStatus === 'open' && (cycle.open_at || cycle.close_at) && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100 font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                เปิดรับอยู่{cycle.close_at ? ` · ถึง ${formatThaiDate(cycle.close_at)}` : ''}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Arrow */}
                        {!locked && (
                          <ChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Step 2: Upload ──────────────────────────────── */}
            {selectedPeriodId !== null && selectedCycle && (
              <div className="bg-background-secondary border border-border rounded-2xl p-5 animate-in fade-in slide-in-from-right-2 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-border">
                  <div>
                    <div className="text-[11px] text-text-muted uppercase tracking-wider font-bold mb-0.5">กำลังส่งสลิปสำหรับ</div>
                    <div className="text-[15px] font-bold text-text-primary">{selectedCycle.label}</div>
                    <div className="text-[12.5px] font-medium text-brand mt-0.5">ยอดโอนที่กำหนด: ฿{selectedCycle.amount.toLocaleString()}</div>
                  </div>
                  {unpaidCycles.length > 1 && (
                    <button
                      onClick={() => setSelectedPeriodId(null)}
                      className="text-[12px] text-brand hover:underline font-medium"
                    >
                      เปลี่ยนงวด
                    </button>
                  )}
                </div>

                {/* QR Code — prominent card style */}
                {selectedCycle.qr_url && !isWindowLocked && (
                  <div className="mb-5 overflow-hidden rounded-2xl border border-emerald-100 shadow-lg shadow-emerald-500/5">
                    {/* Header */}
                    <div className="gradient-emerald px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <QrCode className="w-4 h-4 text-white/80" />
                        <span className="text-[12px] font-black text-white uppercase tracking-widest">QR โอนเงิน</span>
                      </div>
                      <span className="text-[11px] font-bold text-white/60">สแกนก่อนส่งสลิป</span>
                    </div>
                    {/* QR image */}
                    <div className="bg-white flex flex-col items-center gap-3 py-5 px-4">
                      <img
                        src={selectedCycle.qr_url}
                        alt={`QR Code สำหรับ${selectedCycle.label}`}
                        className="w-44 h-44 object-contain rounded-xl ring-1 ring-border"
                      />
                      <div className="text-center">
                        <div className="text-[22px] font-black text-text-primary tracking-tight">
                          ฿{selectedCycle.amount.toLocaleString()}
                        </div>
                        <div className="text-[11px] text-text-muted mt-0.5">ยอดที่ต้องโอน — {selectedCycle.label}</div>
                      </div>
                    </div>
                    {/* Footer hint */}
                    <div className="bg-emerald-50 border-t border-emerald-100 px-4 py-2.5 flex items-center justify-center gap-2">
                      <Upload className="w-3 h-3 text-emerald-600" />
                      <span className="text-[11px] text-emerald-700 font-semibold">โอนเงินแล้ว? ส่งสลิปด้านล่างได้เลย</span>
                    </div>
                  </div>
                )}

                {/* Window locked guard */}
                {isWindowLocked ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="w-12 h-12 bg-background-tertiary rounded-full flex items-center justify-center mx-auto">
                      <Lock className="w-5 h-5 text-text-muted" />
                    </div>
                    {selectedWindowStatus === 'upcoming' && selectedCycle.open_at ? (
                      <>
                        <div className="text-[14px] font-bold text-text-primary">ยังไม่ถึงเวลาเปิดรับสลิป</div>
                        <div className="text-[12.5px] text-text-muted">
                          จะเปิดรับสลิปในวันที่ <span className="font-semibold text-text-primary">{formatThaiDate(selectedCycle.open_at)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[14px] font-bold text-text-primary">หมดเวลารับสลิปแล้ว</div>
                        {selectedCycle.close_at && (
                          <div className="text-[12.5px] text-text-muted">
                            ปิดรับเมื่อวันที่ <span className="font-semibold text-text-primary">{formatThaiDate(selectedCycle.close_at)}</span>
                          </div>
                        )}
                        <div className="text-[12px] text-text-disabled">กรุณาติดต่อเหรัญญิกหากต้องการส่งสลิปล่าช้า</div>
                      </>
                    )}
                  </div>
                ) : (
                  <SlipUploader
                    periodId={selectedPeriodId!}
                    unpaidCycles={unpaidCycles}
                    onPeriodChange={setSelectedPeriodId}
                    onSuccess={() => {
                      setTimeout(() => router.push('/student/dashboard'), 2500)
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
