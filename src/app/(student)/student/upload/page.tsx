'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import SlipUploader from '@/components/payments/SlipUploader'
import EmptyState from '@/components/shared/EmptyState'
import UploadPageLoading from './loading'
import { CheckCircle2, Clock, Lock, Calendar, ChevronRight, QrCode, Upload, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { calculateLateFine, formatFineDescription } from '@/lib/fine'

interface PaymentPeriod {
  id: string
  label: string
  amount: number
  deadline: string
  status: 'unpaid' | 'rejected'
  open_at?: string | null
  close_at?: string | null
  qr_url?: string | null
  fineDescription?: string
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
  const [payAccumulated, setPayAccumulated] = useState(false)
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
          supabase.from('periods').select('id, label, amount, deadline, open_at, close_at, late_fine_amount, fine_type, fine_rate, fine_cap, fine_grace_days, qr_url').order('period_order', { ascending: true }),
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
            const lateFine = calculateLateFine(
              {
                deadline: s.deadline,
                fine_type: s.fine_type ?? 'flat',
                fine_rate: s.fine_rate ?? 0,
                fine_cap: s.fine_cap ?? null,
                fine_grace_days: s.fine_grace_days ?? 0,
                late_fine_amount: s.late_fine_amount ?? 0,
              },
              new Date(),
              hasPendingCredit
            )
            const expectedAmount = tierAmount + lateFine
            const fineDescription = lateFine > 0
              ? formatFineDescription({
                  deadline: s.deadline,
                  fine_type: s.fine_type ?? 'flat',
                  fine_rate: s.fine_rate ?? 0,
                  fine_cap: s.fine_cap ?? null,
                  fine_grace_days: s.fine_grace_days ?? 0,
                  late_fine_amount: s.late_fine_amount ?? 0,
                })
              : undefined

            unpaid.push({
              id: s.id,
              label: s.label,
              amount: expectedAmount,
              deadline: s.deadline,
              status: p?.status === 'rejected' ? 'rejected' : 'unpaid',
              open_at: s.open_at ?? null,
              close_at: s.close_at ?? null,
              qr_url: s.qr_url ?? null,
              fineDescription,
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
  const selectedIsUnpaidOrRejected = selectedCycle?.status === 'unpaid' || selectedCycle?.status === 'rejected'
  // ล็อก Step 2 เฉพาะ: งวดยังไม่ถึงเวลาเปิด (upcoming)
  // หรือ: งวดปิดไปแล้วและไม่ใช่งวดค้างชำระ
  // งวดค้างชำระที่ปิดไปแล้ว → ปลดล็อก ให้ส่งสลิปย้อนหลังได้
  const isWindowLocked = selectedWindowStatus === 'upcoming' ||
    (selectedWindowStatus === 'closed' && !selectedIsUnpaidOrRejected)

  // ยอดรวมกรณีชำระทบงวด: รวมทุกงวดที่ค้างชำระ
  const accumulatedPeriodIds = unpaidCycles.map(c => c.id)
  const totalAccumulatedAmount = unpaidCycles.reduce((sum, c) => sum + c.amount, 0)

  const step = selectedPeriodId === null ? 1 : 2

  return (
    <div>
      <Topbar title="ส่งสลิปการชำระเงิน" subtitle="อัปโหลดหลักฐานการโอนเงิน" />

      <div className="p-3 sm:p-4 md:p-6 max-w-xl">
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
                    const isUnpaidOrRejected = cycle.status === 'unpaid' || cycle.status === 'rejected'
                    // ล็อกเฉพาะ: ยังไม่ถึงเวลาเปิด (upcoming)
                    // หรือ: ปิดไปแล้ว แต่เป็นงวดที่จ่ายไปแล้วปกติ (ไม่ใช่งวดค้าง)
                    // งวดค้างที่ปิดไปแล้ว → ปลดล็อก เพื่อให้ชำระย้อนหลังได้
                    const locked = winStatus === 'upcoming' || (winStatus === 'closed' && !isUnpaidOrRejected)
                    const isClosedUnpaid = winStatus === 'closed' && isUnpaidOrRejected
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
                              : isClosedUnpaid
                                ? 'hover:bg-orange-50/50 cursor-pointer'
                                : 'hover:bg-background-muted cursor-pointer'
                        }`}
                      >
                        {/* Status icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          locked ? 'bg-background-muted' :
                          isRejected ? 'bg-red-50' :
                          isClosedUnpaid ? 'bg-orange-50' :
                          'bg-brand/5'
                        }`}>
                          {locked
                            ? <Lock className="w-4 h-4 text-text-disabled" />
                            : isRejected
                              ? <Clock className="w-4 h-4 text-red-500" />
                              : isClosedUnpaid
                                ? <ChevronRight className="w-4 h-4 text-orange-500" />
                                : <ChevronRight className="w-4 h-4 text-brand" />}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[14px] font-bold text-text-primary">{cycle.label}</span>
                            {isRejected && (
                              <span className="text-[9px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">ถูกปฏิเสธ</span>
                            )}
                            {isClosedUnpaid && !isRejected && (
                              <span className="text-[9px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">ชำระย้อนหลัง</span>
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
                            {isClosedUnpaid && (
                              <span className="text-[10px] bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full border border-orange-100 font-bold flex items-center gap-1">
                                <AlertCircle className="w-2.5 h-2.5" />
                                ค้างชำระ — สามารถจ่ายย้อนหลังได้
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
              <div className="bg-background-secondary/80 backdrop-blur-xl border border-white/10 dark:border-black/20 rounded-2xl p-5 md:p-6 luxury-shadow animate-in fade-in slide-in-from-right-4 duration-350 relative">
                {/* Subtle internal glowing spots */}
                <div className="absolute top-0 right-1/4 w-32 h-32 bg-brand/5 rounded-full filter blur-2xl pointer-events-none" />

                {/* Header */}
                <div className="flex items-center justify-between mb-5 pb-4 border-b border-border-strong">
                  <div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider font-extrabold mb-0.5">
                      {payAccumulated ? 'ชำระเงินรวมยอดค้างชำระทั้งหมด' : 'กำลังนำส่งสลิปชำระเงิน'}
                    </div>
                    <div className="text-[16px] font-black text-text-primary">
                      {payAccumulated
                        ? unpaidCycles.map(c => c.label).join(' + ')
                        : selectedCycle.label
                      }
                    </div>
                    <div className="text-[13px] font-bold text-brand mt-0.5">
                      ยอดเงินโอนที่กำหนด: ฿{(payAccumulated ? totalAccumulatedAmount : selectedCycle.amount).toLocaleString()}
                      {payAccumulated && unpaidCycles.length > 1 && (
                        <span className="ml-2 text-[11px] font-semibold text-text-muted">({unpaidCycles.length} งวดรวมกัน)</span>
                      )}
                    </div>
                  </div>
                  {unpaidCycles.length > 1 && !payAccumulated && (
                    <button
                      onClick={() => setSelectedPeriodId(null)}
                      className="text-[12px] text-brand hover:text-brand-hover font-bold hover:underline transition-colors px-3 py-1.5 rounded-lg bg-brand/5 hover:bg-brand/10"
                    >
                      เปลี่ยนงวด
                    </button>
                  )}
                </div>

                {/* Accumulated Payment Banner — แสดงเฉพาะกรณีมีงวดค้างชำระมากกว่า 1 งวด */}
                {unpaidCycles.length > 1 && (
                  <div className={`mb-5 rounded-xl border p-3.5 transition-all duration-200 ${
                    payAccumulated
                      ? 'border-amber-300 bg-amber-50 dark:bg-amber-950/20'
                      : 'border-border bg-background-tertiary/40'
                  }`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
                        payAccumulated ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-background-muted'
                      }`}>
                        <span className="text-[14px]">{payAccumulated ? '✅' : '💳'}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-bold text-text-primary mb-0.5">
                          {payAccumulated
                            ? 'โหมดชำระรวมยอดค้างชำระทั้งหมด'
                            : `คุณมียอดค้างชำระ ${unpaidCycles.length} งวด`
                          }
                        </div>
                        <div className="text-[11px] text-text-muted">
                          {payAccumulated
                            ? `โอน ฿${totalAccumulatedAmount.toLocaleString()} ในสลิปเดียวเพื่อเคลียร์ยอดค้างทั้งหมด (${unpaidCycles.map(c => c.label).join(', ')})`
                            : `ทำการโอนเงิน ฿${totalAccumulatedAmount.toLocaleString()} เพียงครั้งเดียวเพื่อเคลียร์ยอดค้างทั้ง ${unpaidCycles.length} งวดพร้อมกัน`
                          }
                        </div>
                      </div>
                      <button
                        id="btn-toggle-accumulated"
                        onClick={() => setPayAccumulated(v => !v)}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-[11.5px] font-bold transition-all duration-200 ${
                          payAccumulated
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'bg-brand text-white hover:bg-brand-hover'
                        }`}
                      >
                        {payAccumulated ? 'ยกเลิก' : 'จ่ายรวม'}
                      </button>
                    </div>
                    {payAccumulated && (
                      <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800/50 space-y-1.5">
                        {unpaidCycles.map(c => (
                          <div key={c.id} className="flex items-center justify-between text-[11px]">
                            <span className="text-text-muted">{c.label}</span>
                            <span className="font-semibold text-text-primary">฿{c.amount.toLocaleString()}</span>
                          </div>
                        ))}
                        <div className="flex items-center justify-between text-[12px] pt-1.5 border-t border-amber-200 dark:border-amber-800/50 font-black">
                          <span className="text-amber-700 dark:text-amber-400">ยอดรวมที่ต้องโอน</span>
                          <span className="text-amber-700 dark:text-amber-400">฿{totalAccumulatedAmount.toLocaleString()}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* QR Code — compact premium horizontal card */}
                {selectedCycle.qr_url && !isWindowLocked && (
                  <div className="mb-6 overflow-hidden rounded-2xl border border-white/10 dark:border-black/20 shadow-xl relative"
                    style={{ background: 'linear-gradient(135deg, #059669 0%, #0d9488 100%)' }}>
                    
                    {/* Pulsing glow background */}
                    <div className="absolute inset-0 bg-white/5 animate-pulse" />
                    
                    <div className="flex items-center gap-4 p-4 relative z-10">
                      {/* QR image — compact rounded glass */}
                      <div className="shrink-0 bg-white rounded-2xl p-2 shadow-2xl ring-4 ring-white/15 hover:scale-105 transition-transform duration-300">
                        <img
                          src={selectedCycle.qr_url}
                          alt={`QR Code สำหรับ${selectedCycle.label}`}
                          className="w-24 h-24 object-contain"
                        />
                      </div>
                      {/* Info side */}
                      <div className="flex-1 min-w-0 text-white">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <QrCode className="w-3.5 h-3.5 text-white/80 shrink-0" />
                          <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">QR Code การโอนเงิน</span>
                        </div>
                        <div className="text-[26px] font-black leading-none tracking-tight">
                          ฿{(payAccumulated ? totalAccumulatedAmount : selectedCycle.amount).toLocaleString()}
                        </div>
                        <div className="text-[11px] text-white/80 mt-1 truncate font-medium">
                          {payAccumulated ? unpaidCycles.map(c => c.label).join(' + ') : selectedCycle.label}
                        </div>
                        <div className="mt-3 flex items-center gap-1.5 bg-white/20 backdrop-blur-md rounded-lg px-2.5 py-1.5 w-fit border border-white/10 shadow-sm">
                          <Upload className="w-3 h-3 text-white shrink-0" />
                          <span className="text-[10.5px] font-extrabold">สแกนชำระแล้วแนบหลักฐานด้านล่าง</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Window locked guard */}
                {isWindowLocked ? (
                  <div className="py-10 text-center space-y-4">
                    <div className="w-14 h-14 bg-background-tertiary rounded-full flex items-center justify-center mx-auto shadow-inner border border-border-strong">
                      <Lock className="w-6 h-6 text-text-muted" />
                    </div>
                    {selectedWindowStatus === 'upcoming' && selectedCycle.open_at ? (
                      <div className="space-y-1">
                        <div className="text-[15px] font-bold text-text-primary">ยังไม่ถึงเวลาเปิดรับสลิป</div>
                        <div className="text-[12.5px] text-text-muted">
                          จะเปิดรับสลิปในวันที่ <span className="font-semibold text-brand">{formatThaiDate(selectedCycle.open_at)}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-[15px] font-bold text-text-primary">หมดเวลารับสลิปชำระเงินแล้ว</div>
                        {selectedCycle.close_at && (
                          <div className="text-[12.5px] text-text-muted">
                            ปิดรับเมื่อวันที่ <span className="font-semibold text-text-primary">{formatThaiDate(selectedCycle.close_at)}</span>
                          </div>
                        )}
                        <div className="text-[11.5px] text-text-disabled mt-2">กรุณาติดต่อเหรัญญิกหากต้องการส่งสลิปล่าช้า</div>
                      </div>
                    )}
                  </div>
                ) : (
                  <SlipUploader
                    periodId={selectedPeriodId!}
                    unpaidCycles={unpaidCycles}
                    onPeriodChange={payAccumulated ? undefined : setSelectedPeriodId}
                    payAccumulated={payAccumulated}
                    accumulatedPeriodIds={payAccumulated ? accumulatedPeriodIds : []}
                    totalAccumulatedAmount={payAccumulated ? totalAccumulatedAmount : undefined}
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

