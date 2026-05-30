'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import SlipUploader from '@/components/payments/SlipUploader'
import EmptyState from '@/components/shared/EmptyState'
import { CheckCircle, Clock, Lock, Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PaymentCycle {
  week: number
  title: string
  amount: number
  deadline: string
  status: 'unpaid' | 'rejected'
  payment_open_at?: string | null
  payment_close_at?: string | null
  qr_url?: string | null
}

type WindowStatus = 'open' | 'upcoming' | 'closed' | 'noWindow'

function getWindowStatus(cycle: PaymentCycle): WindowStatus {
  const now = new Date()
  const openAt = cycle.payment_open_at ? new Date(cycle.payment_open_at) : null
  const closeAt = cycle.payment_close_at ? new Date(cycle.payment_close_at) : null

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
  const [unpaidCycles, setUnpaidCycles] = useState<PaymentCycle[]>([])
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
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
          supabase.from('week_settings').select('week, title, amount, deadline, payment_open_at, payment_close_at, late_fine_amount, qr_url').order('week', { ascending: true }),
          supabase.from('payments').select('week, status').eq('user_id', targetUserId),
          supabase.from('system_settings').select('*'),
          supabase.from('payment_credits').select('week').eq('user_id', targetUserId).eq('status', 'pending')
        ])

        const tierAmounts = {
          A: parseFloat(sysSettings?.find((s: any) => s.key === 'tier_a_amount')?.value || '60'),
          B: parseFloat(sysSettings?.find((s: any) => s.key === 'tier_b_amount')?.value || '50'),
          C: parseFloat(sysSettings?.find((s: any) => s.key === 'tier_c_amount')?.value || '30'),
        }
        const tierAmount = tierAmounts[profile?.tier as 'A' | 'B' | 'C'] ?? tierAmounts.B
        const pendingCreditWeeks = new Set(pendingCredits?.map(c => c.week) || [])

        const unpaid: PaymentCycle[] = []
        
        settings?.forEach(s => {
          const p = payments?.find(pay => pay.week === s.week)
          if (!p || p.status === 'rejected') {
            const hasPendingCredit = pendingCreditWeeks.has(s.week)
            const deadline = s.deadline ? new Date(s.deadline) : null
            const isPastDeadline = deadline ? new Date() > deadline : false
            const lateFine = (!hasPendingCredit && isPastDeadline) ? (s.late_fine_amount ?? 0) : 0
            const expectedAmount = tierAmount + lateFine

            unpaid.push({
              week: s.week,
              title: s.title || `งวดที่ ${s.week}`,
              amount: expectedAmount,
              deadline: s.deadline,
              status: p?.status === 'rejected' ? 'rejected' : 'unpaid',
              payment_open_at: s.payment_open_at ?? null,
              payment_close_at: s.payment_close_at ?? null,
              qr_url: s.qr_url ?? null,
            })
          }
        })

        setUnpaidCycles(unpaid)
        if (unpaid.length === 1) setSelectedWeek(unpaid[0].week)
      } catch (error) {
        console.error('Failed to fetch upload data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  const selectedCycle = unpaidCycles.find(c => c.week === selectedWeek)
  const selectedWindowStatus = selectedCycle ? getWindowStatus(selectedCycle) : null
  const isWindowLocked = selectedWindowStatus === 'upcoming' || selectedWindowStatus === 'closed'

  return (
    <div>
      <Topbar title="ส่งสลิปการชำระเงิน" subtitle="อัปโหลดหลักฐานการโอนเงิน" />

      <div className="p-6 max-w-xl">
        {loading ? (
          <div className="h-40 flex items-center justify-center text-[13px] text-text-muted">กำลังโหลด...</div>
        ) : unpaidCycles.length === 0 ? (
          <div className="bg-background-secondary border border-border rounded-xl p-8">
            <EmptyState
              icon={CheckCircle}
              title="ชำระครบทุกงวดแล้ว 🎉"
              description="คุณส่งสลิปครบทุกงวดการชำระที่กำหนดแล้ว ขอบคุณที่ชำระตรงเวลา"
              action={{ label: 'ดูประวัติการชำระ', onClick: () => router.push('/student/history') }}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Step 1: Select Cycle */}
            {selectedWeek === null && (
              <div className="bg-background-secondary border border-border rounded-xl p-5">
                <div className="text-[13.5px] font-semibold text-text-primary mb-1">เลือกงวดที่ต้องการส่งสลิป</div>
                <div className="text-[12px] text-text-muted mb-4">มี {unpaidCycles.length} รายการที่รอการชำระ</div>
                <div className="grid grid-cols-1 gap-2">
                  {unpaidCycles.map((cycle) => {
                    const winStatus = getWindowStatus(cycle)
                    const locked = winStatus === 'upcoming' || winStatus === 'closed'
                    return (
                      <button
                        key={cycle.week}
                        onClick={() => !locked && setSelectedWeek(cycle.week)}
                        disabled={locked}
                        className={`flex items-center justify-between border rounded-xl p-4 text-left transition-all duration-150 ${
                          locked
                            ? 'border-border bg-background-tertiary opacity-60 cursor-not-allowed'
                            : cycle.status === 'rejected'
                              ? 'border-red-200 bg-red-50/50 hover:border-red-400'
                              : 'border-border bg-background hover:border-brand hover:bg-background-tertiary'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <div className="text-[14px] font-bold text-text-primary">{cycle.title}</div>
                            {locked && <Lock className="w-3.5 h-3.5 text-text-muted" />}
                          </div>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[12px] font-semibold text-brand">฿{cycle.amount.toLocaleString()}</span>
                            <span className="text-text-muted text-[11px] flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              กำหนดส่ง: {new Date(cycle.deadline).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                            </span>
                            {/* Window status badge */}
                            {winStatus === 'upcoming' && cycle.payment_open_at && (
                              <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100 font-bold flex items-center gap-1">
                                <Calendar className="w-2.5 h-2.5" />
                                เปิด {formatThaiDate(cycle.payment_open_at)}
                              </span>
                            )}
                            {winStatus === 'closed' && (
                              <span className="text-[10px] bg-red-50 text-red-600 px-2 py-0.5 rounded-full border border-red-100 font-bold flex items-center gap-1">
                                <Lock className="w-2.5 h-2.5" />
                                ปิดรับสลิปแล้ว
                              </span>
                            )}
                            {winStatus === 'open' && (cycle.payment_open_at || cycle.payment_close_at) && (
                              <span className="text-[10px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-100 font-bold flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                เปิดรับอยู่
                                {cycle.payment_close_at && ` · ถึง ${formatThaiDate(cycle.payment_close_at)}`}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-3">
                          {locked ? (
                            <Lock className="w-4 h-4 text-text-disabled" />
                          ) : cycle.status === 'rejected' ? (
                            <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">ส่งใหม่</span>
                          ) : (
                            <span className="text-[10px] text-text-muted bg-background-tertiary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider underline">เลือก</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Upload */}
            {selectedWeek !== null && selectedCycle && (
              <div className="bg-background-secondary border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                  <div>
                    <div className="text-[11px] text-text-muted uppercase tracking-wider font-bold mb-0.5">กำลังส่งสลิปสำหรับ</div>
                    <div className="text-[15px] font-bold text-text-primary">{selectedCycle.title}</div>
                    <div className="text-[12.5px] font-medium text-brand mt-0.5">ยอดโอนที่กำหนด: ฿{selectedCycle.amount.toLocaleString()}</div>
                  </div>
                  {unpaidCycles.length > 1 && (
                    <button onClick={() => setSelectedWeek(null)} className="text-[12px] text-brand hover:underline font-medium">
                      เปลี่ยนงวด
                    </button>
                  )}
                </div>

                {/* QR Code — แสดงเพื่อให้นักศึกษาสแกนโอนก่อนส่งสลิป */}
                {selectedCycle.qr_url && !isWindowLocked && (
                  <div className="mb-4 flex flex-col items-center gap-2 p-4 bg-background-tertiary border border-border rounded-xl">
                    <div className="text-[11px] text-text-muted font-bold uppercase tracking-wider">QR โอนเงิน</div>
                    <img
                      src={selectedCycle.qr_url}
                      alt={`QR Code สำหรับ${selectedCycle.title}`}
                      className="w-40 h-40 object-contain rounded-lg"
                    />
                    <div className="text-[11px] text-text-muted">สแกนเพื่อโอนเงิน จากนั้นส่งสลิปด้านล่าง</div>
                  </div>
                )}

                {/* Window locked guard */}
                {isWindowLocked ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="w-12 h-12 bg-background-tertiary rounded-full flex items-center justify-center mx-auto">
                      <Lock className="w-5 h-5 text-text-muted" />
                    </div>
                    {selectedWindowStatus === 'upcoming' && selectedCycle.payment_open_at ? (
                      <>
                        <div className="text-[14px] font-bold text-text-primary">ยังไม่ถึงเวลาเปิดรับสลิป</div>
                        <div className="text-[12.5px] text-text-muted">
                          จะเปิดรับสลิปในวันที่ <span className="font-semibold text-text-primary">{formatThaiDate(selectedCycle.payment_open_at)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-[14px] font-bold text-text-primary">หมดเวลารับสลิปแล้ว</div>
                        {selectedCycle.payment_close_at && (
                          <div className="text-[12.5px] text-text-muted">
                            ปิดรับเมื่อวันที่ <span className="font-semibold text-text-primary">{formatThaiDate(selectedCycle.payment_close_at)}</span>
                          </div>
                        )}
                        <div className="text-[12px] text-text-disabled">กรุณาติดต่อเหรัญญิกหากต้องการส่งสลิปล่าช้า</div>
                      </>
                    )}
                  </div>
                ) : (
                  <SlipUploader
                    week={selectedWeek}
                    unpaidCycles={unpaidCycles}
                    onWeekChange={setSelectedWeek}
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
