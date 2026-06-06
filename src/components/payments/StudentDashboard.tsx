'use client'

import { useState } from 'react'
import Topbar from '@/components/layout/Topbar'
import KpiCard from '@/components/shared/KpiCard'
import PeriodGrid from '@/components/payments/PeriodGrid'
import PaymentRow from '@/components/payments/PaymentRow'
import StatusPill from '@/components/payments/StatusPill'
import ExpenseRow from '@/components/expenses/ExpenseRow'
import EmptyState from '@/components/shared/EmptyState'
import QrModal from '@/components/payments/QrModal'
import { formatCurrency, formatDate, getTierConfig } from '@/lib/utils'
import { FileText, Upload, ArrowRight, AlertCircle, Clock, QrCode, Lock, Calendar, CreditCard } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { PeriodStatus, PaymentCredit, Period } from '@/types'

function getWindowStatus(p: Period) {
  const now = new Date()
  const openAt = p.open_at ? new Date(p.open_at) : null
  const closeAt = p.close_at ? new Date(p.close_at) : null

  if (!openAt && !closeAt) return 'open'
  if (openAt && now < openAt) return 'upcoming'
  if (closeAt && now > closeAt) return 'closed'
  return 'open'
}

export default function StudentDashboard({ 
  profile, 
  payments, 
  periods, 
  expenses,
  promptPayConfig,
  pendingCredits = [],
  tierAmounts,
}: { 
  profile: any, 
  payments: any[], 
  periods: Period[], 
  expenses: any[],
  promptPayConfig: { promptpay_id: string, promptpay_name: string },
  pendingCredits?: PaymentCredit[],
  tierAmounts: { A: number, B: number, C: number },
}) {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)

  const periodStatuses: PeriodStatus[] = (periods || []).map((period) => {
    const payment = payments?.find((p) => p.period_id === period.id)
    // ใช้ยอดตาม tier ของ student
    const tierAmount = tierAmounts[profile?.tier as 'A' | 'B' | 'C'] ?? tierAmounts.B
    
    // ตรวจสอบว่านักศึกษามีเครดิตค้างจ่าย (ผ่อนผัน) ในงวดนี้หรือไม่
    const hasPendingCredit = pendingCredits.some((c) => c.period_id === period.id && c.status === 'pending')

    // คำนวณค่าปรับ (ถ้าไม่มีเครดิต และชำระเลยกำหนดส่ง)
    const deadline = period.deadline ? new Date(period.deadline) : null
    const isPastDeadline = deadline ? new Date() > deadline : false
    const lateFine = (!hasPendingCredit && isPastDeadline) ? (period.late_fine_amount ?? 0) : 0
    const expectedAmount = tierAmount + lateFine

    return {
      period,
      status: payment?.status === 'approved' ? 'paid'
             : payment?.status === 'pending' ? 'pending'
             : payment?.status === 'rejected' ? 'rejected'
             : 'unpaid',
      // ถ้า payment ที่ชำระไปแล้วมียอดจริง ให้ใช้ยอดนั้น (approved) มิฉะนั้นใช้ตาม tier + fine
      amount: payment?.status === 'approved' ? (payment?.amount ?? expectedAmount) : expectedAmount,
      payment,
    }
  })

  const currentPeriodStatus = periodStatuses.find((p) => p.status !== 'paid') ?? periodStatuses[periodStatuses.length - 1]
  const currentPeriod = currentPeriodStatus?.period
  const currentDeadline = currentPeriod?.deadline ? new Date(currentPeriod.deadline) : null
  const isOverdue = currentDeadline ? new Date() > currentDeadline : false
  
  const windowStatus = currentPeriod ? getWindowStatus(currentPeriod) : 'open'
  const isLocked = windowStatus === 'upcoming' || windowStatus === 'closed'

  const formatThaiDate = (date: Date) => {
    return date.toLocaleDateString('th-TH', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const paidCount = periodStatuses.filter((w) => w.status === 'paid').length
  const pendingCount = periodStatuses.filter((w) => w.status === 'pending').length
  const unpaidCount = periodStatuses.filter((w) => w.status === 'unpaid' || w.status === 'rejected').length
  const totalPaid = (payments?.filter((p) => p.status === 'approved') ?? []).reduce((s, p) => s + p.amount, 0)
  const totalCycles = periodStatuses.length

  return (
    <div className="pb-12 bg-background">
      <Topbar
        title={`สวัสดี, ${profile?.fullname ?? 'นักศึกษา'}`}
        subtitle="ภาพรวมระบบการเงินสาขา"
        actions={
          currentPeriodStatus && currentPeriodStatus.status !== 'paid' && currentPeriodStatus.status !== 'pending' && !isLocked ? (
            <Link href="/student/upload" className="flex items-center gap-2 bg-brand text-white text-[12px] font-bold px-4 py-2 rounded-xl hover:bg-brand-hover transition-all shadow-lg shadow-brand/10 active:scale-95">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">ส่งสลิป</span>
            </Link>
          ) : null
        }
      />

      <div className="p-3 sm:p-4 md:p-8 space-y-5 md:space-y-8 max-w-7xl mx-auto">
        {totalCycles === 0 ? (
          <EmptyState icon={FileText} title="ยังไม่มีกำหนดการชำระเงิน" description="กรุณารอเหรัญญิกเพิ่มงวดการชำระเงิน" />
        ) : (
          <>
            {/* Hero Card */}
            <div className="relative overflow-hidden rounded-2xl md:rounded-[2rem] gradient-brand shadow-2xl">
              {/* Decorative geometric shapes */}
              <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-[0.07]"
                style={{ background: 'radial-gradient(circle, #b59410 0%, transparent 70%)' }} />
              <div className="absolute bottom-0 left-0 w-64 h-32 opacity-[0.05]"
                style={{ background: 'radial-gradient(ellipse at bottom left, #4f8ef7 0%, transparent 60%)' }} />
              <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[1px] h-20 bg-gradient-to-b from-white/10 to-transparent" />

              {/* Inner content */}
              <div className="relative z-10 p-5 md:p-10">
                {/* Top badges row */}
                <div className="flex items-center gap-2 flex-wrap mb-5">
                  <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                    งวดปัจจุบัน
                  </span>
                  {(() => {
                    const tierCfg = getTierConfig(profile?.tier ?? 'B')
                    const amountVal = tierAmounts[profile?.tier as 'A' | 'B' | 'C'] ?? tierCfg.amount
                    return (
                      <span className="text-[9px] font-black px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-white/60">
                        Tier {profile?.tier ?? 'B'} · ฿{amountVal}/สัปดาห์
                      </span>
                    )
                  })()}
                  {isOverdue && currentPeriodStatus.status !== 'paid' && (
                    <span className="flex items-center gap-1 text-[9px] bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg border border-red-400/20 font-black uppercase">
                      <AlertCircle className="w-2.5 h-2.5" />
                      เกินกำหนด
                    </span>
                  )}
                  {windowStatus === 'upcoming' && (
                    <span className="flex items-center gap-1 text-[9px] bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-400/20 font-black uppercase">
                      <Calendar className="w-2.5 h-2.5" />
                      รอเปิด
                    </span>
                  )}
                  {windowStatus === 'closed' && (
                    <span className="flex items-center gap-1 text-[9px] bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg border border-red-400/20 font-black uppercase">
                      <Lock className="w-2.5 h-2.5" />
                      ปิดรับสลิป
                    </span>
                  )}
                </div>

                <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-10">
                  {/* Left: Period info */}
                  <div className="flex-1">
                    <h1 className="text-[21px] sm:text-[26px] md:text-[34px] font-black text-white tracking-tight leading-tight mb-2">
                      {currentPeriod?.label || 'งวดปัจจุบัน'}
                    </h1>
                    <div className="flex items-center gap-1.5 text-white/50 text-[12px] font-medium">
                      <Clock className="w-3.5 h-3.5" />
                      <span>กำหนดส่ง: {currentDeadline ? formatDate(currentDeadline) : 'ไม่ระบุ'}</span>
                    </div>
                  </div>

                  {/* Right: Amount + status + CTA */}
                  <div className="flex flex-col items-start md:items-end gap-3">
                    {/* Amount */}
                    <div className="text-right">
                      <div className="text-[11px] font-black text-white/40 uppercase tracking-widest mb-1">ยอดที่ต้องชำระ</div>
                      <div className="text-[32px] sm:text-[40px] md:text-[52px] font-black text-white tracking-tighter leading-none">
                        <span className="text-[18px] sm:text-[22px] md:text-[28px] text-white/60 mr-1">฿</span>
                        {currentPeriodStatus.period.amount.toLocaleString()}
                      </div>
                      {(() => {
                        const baseTierAmount = tierAmounts[profile?.tier as 'A' | 'B' | 'C'] ?? tierAmounts.B
                        const finePaid = currentPeriodStatus.period.amount - baseTierAmount
                        if (finePaid > 0 && currentPeriodStatus.status !== 'paid') {
                          return (
                            <div className="text-[10px] text-red-300 font-bold mt-1">
                              รวมค่าปรับ ฿{finePaid.toLocaleString()}
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>

                    {/* Status pill */}
                    <StatusPill 
                      status={
                        currentPeriodStatus.status === 'paid' ? 'paid'
                        : currentPeriodStatus.status === 'pending' ? 'pending'
                        : currentPeriodStatus.status === 'rejected' ? 'rejected'
                        : 'unpaid'
                      } 
                      note={currentPeriodStatus.payment?.note}
                      size="lg"
                    />

                    {/* CTA buttons */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      {currentPeriodStatus.status !== 'paid' && currentPeriodStatus.status !== 'pending' && (
                        <>
                          {!isLocked ? (
                            <>
                              <button
                                onClick={() => setIsQrModalOpen(true)}
                                className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white text-[12px] font-bold px-4 py-2.5 rounded-xl hover:bg-white/15 transition-all active:scale-95 backdrop-blur-sm"
                              >
                                <QrCode className="w-4 h-4" />
                                QR
                              </button>
                              <Link
                                href="/student/upload"
                                className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-white text-brand text-[12px] font-black px-6 py-2.5 rounded-xl hover:bg-white/90 transition-all active:scale-95 shadow-xl shadow-black/20"
                              >
                                <Upload className="w-4 h-4" />
                                {currentPeriodStatus.status === 'rejected' ? 'ส่งใหม่' : 'ส่งสลิป'}
                              </Link>
                            </>
                          ) : (
                            <div className="flex items-center gap-2 py-2.5 px-4 bg-white/5 border border-white/10 rounded-xl text-[12px] font-bold text-white/50">
                              <Lock className="w-4 h-4" />
                              {windowStatus === 'upcoming' ? 'รอเปิดรับสลิป' : 'ปิดรับสลิปแล้ว'}
                            </div>
                          )}
                        </>
                      )}
                      {currentPeriodStatus.status === 'pending' && (
                        <div className="flex items-center gap-2 py-2.5 px-5 bg-white/10 border border-white/15 rounded-xl text-[12px] font-bold text-white/70 backdrop-blur-sm">
                          <Clock className="w-4 h-4" />
                          รอเหรัญญิกตรวจสอบ
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Credit Debt Banner */}
            {pendingCredits.length > 0 && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-black text-amber-800 mb-0.5">
                    คุณมียอดค้างจ่าย {pendingCredits.length} รายการ
                  </div>
                  <div className="text-[11.5px] text-amber-700 space-y-0.5">
                    {pendingCredits.map((c) => (
                      <div key={c.id}>
                        ฿{c.amount.toLocaleString()} — {c.period_info?.label || 'งวดค้างชำระ'}
                        {c.note ? ` · ${c.note}` : ''}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex-shrink-0 text-right">
                  <div className="text-[18px] font-black text-amber-800">
                    ฿{pendingCredits.reduce((s, c) => s + c.amount, 0).toLocaleString()}
                  </div>
                  <Link href="/student/history" className="text-[10.5px] text-amber-600 hover:underline font-bold">ดูประวัติ →</Link>
                </div>
              </div>
            )}

            {/* Pending Slip Banner */}
            {periodStatuses.some(w => w.status === 'pending') && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-100 rounded-2xl">
                <Clock className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-black text-blue-900 mb-0.5">
                    สลิปรอการตรวจสอบ
                  </div>
                  <div className="text-[11.5px] text-blue-800 leading-relaxed">
                    สลิปของคุณได้รับแล้ว — <span className="font-bold">ยังไม่ผ่านการอนุมัติ</span> กรุณารอเหรัญญิกตรวจสอบ
                    ระบบจะแจ้งผ่าน LINE เมื่อดำเนินการแล้ว
                  </div>
                </div>
              </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-3 gap-2 md:gap-6">
              <KpiCard label="จ่ายแล้ว" value={`${paidCount}/${totalCycles}`} sub={formatCurrency(totalPaid)} subVariant="positive" />
              <KpiCard label="รอตรวจ" value={pendingCount} sub="รายการค้างอนุมัติ" subVariant="warning" />
              <KpiCard label="ยอดค้าง" value={unpaidCount} sub="จำนวนงวดที่เหลือ" subVariant="danger" />
            </div>

            {/* Grid */}
            <div className="bg-background-secondary border border-border rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                <div>
                  <h3 className="text-[17px] font-bold text-text-primary tracking-tight">ภาพรวมการชำระเงิน</h3>
                  <p className="text-[12px] text-text-muted font-medium mt-0.5">สถานะการชำระเงินทั้งหมด {totalCycles} งวดประจำปี</p>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 uppercase">{paidCount} Paid</span>
                  <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100 uppercase">{pendingCount} Wait</span>
                  <span className="text-[10px] font-bold text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100 uppercase">{unpaidCount} Due</span>
                </div>
              </div>
              <PeriodGrid periods={periodStatuses} currentPeriodId={currentPeriod?.id} />
            </div>
          </>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* History */}
          <div className="bg-background-secondary border border-border rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[17px] font-bold text-text-primary tracking-tight">ประวัติล่าสุด</h3>
              <Link href="/student/history" className="flex items-center gap-1 text-[11px] font-bold text-brand uppercase tracking-wider hover:translate-x-1 transition-transform">
                ดูทั้งหมด <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {payments && payments.length > 0 ? (
              <div className="divide-y divide-border/40">
                {payments.slice(-5).reverse().map((p) => (
                  <PaymentRow key={p.id} payment={p} className="py-2.5" />
                ))}
              </div>
            ) : (
              <div className="py-12"><EmptyState icon={FileText} title="ยังไม่มีประวัติ" description="รายการที่ชำระจะปรากฏที่นี่" /></div>
            )}
          </div>

          {/* Expenses */}
          <div className="bg-background-secondary border border-border rounded-2xl md:rounded-[2rem] p-4 sm:p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[17px] font-bold text-text-primary tracking-tight">รายจ่ายกองกลาง</h3>
              <Link href="/student/transparency" className="flex items-center gap-1 text-[11px] font-bold text-brand uppercase tracking-wider hover:translate-x-1 transition-transform">
                ดูทั้งหมด <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
            {expenses && expenses.length > 0 ? (
              <div className="divide-y divide-border/40">
                {expenses.map((e) => (
                  <ExpenseRow key={e.id} expense={e} className="py-2.5" />
                ))}
              </div>
            ) : (
              <div className="py-12"><EmptyState icon={FileText} title="ยังไม่มีรายการ" /></div>
            )}
          </div>
        </div>
      </div>

      {isQrModalOpen && (
        <QrModal 
          isOpen={isQrModalOpen}
          onClose={() => setIsQrModalOpen(false)}
          promptPayId={promptPayConfig.promptpay_id}
          promptPayName={promptPayConfig.promptpay_name}
          title={currentPeriod?.label || `งวดปัจจุบัน`}
          amount={currentPeriodStatus.period.amount}
        />
      )}
    </div>
  )
}
