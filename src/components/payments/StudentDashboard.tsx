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
import { calculateLateFine, formatFineDescription } from '@/lib/fine'
import { FileText, Upload, ArrowRight, AlertCircle, Clock, QrCode, Lock, Calendar, CreditCard, CheckCircle2 } from 'lucide-react'
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

    // คำนวณค่าปรับด้วย shared utility
    const lateFine = calculateLateFine(
      {
        deadline: period.deadline,
        fine_type: period.fine_type ?? 'flat',
        fine_rate: period.fine_rate ?? 0,
        fine_cap: period.fine_cap ?? null,
        fine_grace_days: period.fine_grace_days ?? 0,
        late_fine_amount: period.late_fine_amount ?? 0,
      },
      new Date(),
      hasPendingCredit
    )

    // คำนวณยอดเงินฐานตามสัดส่วน Tier × ยอดของงวดนั้นๆ
    // สูตร: period.amount × (tierAmount / Tier B standard)
    // เช่น Tier C (30) / Tier B (50) = 60% → งวด ฿50 จ่าย ฿30, งวด ฿30 จ่าย ฿18
    const standardAmount = tierAmounts.B || 50
    const tierRatio = tierAmount / standardAmount
    const expectedBaseAmount = period.amount * tierRatio
    const expectedAmount = expectedBaseAmount + lateFine

    // ถ้า payment มียอดเป็น 0 (สลิปเดิมส่งตอน API ล่ม) ให้ใช้ expectedAmount แทน
    if (payment && (!payment.amount || payment.amount <= 0)) {
      payment.amount = expectedAmount
    }

    return {
      period,
      status: payment?.status === 'approved' ? 'paid'
             : payment?.status === 'pending' ? 'pending'
             : payment?.status === 'rejected' ? 'rejected'
             : 'unpaid',
      // ถ้า payment ที่ชำระไปแล้วมียอดจริง ให้ใช้ยอดนั้น (approved) มิฉะนั้นใช้ตาม tier + fine
      amount: payment?.status === 'approved' ? (payment?.amount && payment.amount > 0 ? payment.amount : expectedAmount) : expectedAmount,
      payment,
    }
  })

  // เลือกงวดที่จะแสดงบน Hero Card:
  // 1. งวดที่ยังไม่จ่ายและยังเปิดรับสลิปอยู่ (open / noWindow)
  // 2. fallback: งวดที่ยังไม่จ่าย (แม้ว่าช่วงรับสลิปจะปิดแล้ว — เพื่อแจ้งยอดค้าง)
  // 3. fallback สุดท้าย: งวดล่าสุด (จ่ายครบแล้ว)
  const currentPeriodStatus =
    periodStatuses.find((p) => {
      const ws = getWindowStatus(p.period)
      return p.status !== 'paid' && ws === 'open'
    }) ??
    periodStatuses.find((p) => p.status !== 'paid') ??
    periodStatuses[periodStatuses.length - 1]

  const currentPeriod = currentPeriodStatus?.period
  const currentDeadline = currentPeriod?.deadline ? new Date(currentPeriod.deadline) : null
  const isOverdue = currentDeadline ? new Date() > currentDeadline : false

  const windowStatus = currentPeriod ? getWindowStatus(currentPeriod) : 'open'
  const isLocked = windowStatus === 'upcoming' || windowStatus === 'closed'

  // ดึงรายการงวดทั้งหมดที่ยังไม่ได้จ่าย (สถานะเป็น unpaid หรือ rejected)
  // ** กรอง upcoming ออก: ไม่รวมงวดที่ยังไม่เปิดรับชำระเข้ายอดค้าง **
  const unpaidPeriods = periodStatuses.filter((p) => {
    if (p.status !== 'unpaid' && p.status !== 'rejected') return false
    const ws = getWindowStatus(p.period)
    return ws !== 'upcoming'
  })
  const hasAccumulatedUnpaid = unpaidPeriods.length > 1
  const totalUnpaidAmount = unpaidPeriods.reduce((sum, p) => sum + p.amount, 0)

  const allPayablePaid = unpaidPeriods.length === 0
  const displayAmount = allPayablePaid ? 0 : (hasAccumulatedUnpaid ? totalUnpaidAmount : (currentPeriodStatus?.amount ?? 0))
  const displayLabel = allPayablePaid
    ? (currentPeriodStatus?.status === 'paid' ? 'ชำระเงินครบทุกงวดแล้ว 🎉' : 'รอเปิดงวดถัดไป')
    : (hasAccumulatedUnpaid
        ? `ยอดรวมค้างชำระทั้งหมด (${unpaidPeriods.map(p => p.period.label).join(' + ')})`
        : (currentPeriod?.label || 'งวดปัจจุบัน'))

  // จำนวนงวดที่ค้างชำระทั้งหมด (ไม่รวม upcoming) — ใช้แสดงปุ่ม "จ่ายสะสม"
  const totalUnpaidCount = periodStatuses.filter((p) => {
    if (p.status === 'paid' || p.status === 'pending') return false
    const ws = getWindowStatus(p.period)
    return ws !== 'upcoming'
  }).length
  // ถ้ามีงวดค้างที่ยังเปิดอยู่ ให้ยังแสดงปุ่มส่งสลิปได้
  const hasPayableUnpaid = periodStatuses.some((p) => {
    const ws = getWindowStatus(p.period)
    return (p.status === 'unpaid' || p.status === 'rejected') && ws === 'open'
  })

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
        title={profile?.fullname ?? 'นักศึกษา'}
        subtitle="ภาพรวมระบบการเงินสาขา"
        actions={
          hasPayableUnpaid ? (
            <Link href="/student/upload" className="flex items-center gap-1.5 sm:gap-2 bg-brand text-white text-[12px] font-bold px-2.5 sm:px-4 py-2 rounded-xl hover:bg-brand-hover transition-all shadow-lg shadow-brand/10 active:scale-95">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">ส่งสลิป</span>
            </Link>
          ) : null
        }
      />

      <div className="p-2.5 sm:p-4 md:p-8 space-y-4 md:space-y-8 max-w-7xl mx-auto">
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
              <div className="relative z-10 p-3.5 sm:p-6 md:p-10">
                {/* Top badges row */}
                <div className="flex items-center gap-2 flex-wrap mb-3.5 sm:mb-5">
                  {allPayablePaid ? (
                    <span className="flex items-center gap-1 text-[9px] bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded-lg border border-emerald-400/20 font-black uppercase">
                      <CheckCircle2 className="w-2.5 h-2.5 text-emerald-300" />
                      ชำระครบแล้ว
                    </span>
                  ) : (
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-white/40 bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg">
                      งวดปัจจุบัน
                    </span>
                  )}
                  {(() => {
                    const tierCfg = getTierConfig(profile?.tier ?? 'B')
                    const amountVal = tierAmounts[profile?.tier as 'A' | 'B' | 'C'] ?? tierAmounts.B
                    return (
                      <span className="text-[9px] font-black px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 text-white/60">
                        Tier {profile?.tier ?? 'B'} · ฿{amountVal}/สัปดาห์
                      </span>
                    )
                  })()}
                  {isOverdue && currentPeriodStatus.status !== 'paid' && !allPayablePaid && (
                    <span className="flex items-center gap-1 text-[9px] bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg border border-red-400/20 font-black uppercase">
                      <AlertCircle className="w-2.5 h-2.5" />
                      เกินกำหนด
                    </span>
                  )}
                  {windowStatus === 'upcoming' && !allPayablePaid && (
                    <span className="flex items-center gap-1 text-[9px] bg-amber-500/20 text-amber-300 px-2.5 py-1 rounded-lg border border-amber-400/20 font-black uppercase">
                      <Calendar className="w-2.5 h-2.5" />
                      รอเปิด
                    </span>
                  )}
                  {windowStatus === 'closed' && !allPayablePaid && (
                    <span className="flex items-center gap-1 text-[9px] bg-red-500/20 text-red-300 px-2.5 py-1 rounded-lg border border-red-400/20 font-black uppercase">
                      <Lock className="w-2.5 h-2.5" />
                      ปิดรับสลิป
                    </span>
                  )}
                </div>

                <div className="flex flex-col md:flex-row md:items-end gap-6 md:gap-10">
                  {/* Left: Period info */}
                  <div className="flex-1">
                    <h1 className="text-[15px] sm:text-[22px] md:text-[30px] font-black text-white tracking-tight leading-tight mb-2">
                      {displayLabel}
                    </h1>
                    <div className="flex items-center gap-1.5 text-white/50 text-[10px] sm:text-[12px] font-medium">
                      <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <span>กำหนดส่ง: {currentDeadline ? formatDate(currentDeadline) : 'ไม่ระบุ'}</span>
                    </div>
                  </div>

                  {/* Right: Amount + status + CTA */}
                  <div className="flex flex-col items-start md:items-end gap-2.5 w-full md:w-auto">
                    {/* Amount */}
                    <div className="text-left md:text-right">
                      <div className="text-[9px] sm:text-[11px] font-black text-white/40 uppercase tracking-widest mb-1">ยอดที่ต้องชำระ</div>
                      <div className="text-[22px] sm:text-[36px] md:text-[48px] font-black text-white tracking-tighter leading-none">
                        <span className="text-[13px] sm:text-[20px] md:text-[28px] text-white/60 mr-1">฿</span>
                        {displayAmount.toLocaleString()}
                      </div>
                      {(() => {
                        if (allPayablePaid) return null
                        if (hasAccumulatedUnpaid) {
                          const totalBaseAmount = unpaidPeriods.reduce((sum, p) => {
                            const tierAmount = tierAmounts[profile?.tier as 'A' | 'B' | 'C'] ?? tierAmounts.B
                            const standardAmount = tierAmounts.B || 50
                            const ratio = tierAmount / standardAmount
                            return sum + (p.period.amount * ratio)
                          }, 0)
                          const totalFine = totalUnpaidAmount - totalBaseAmount
                          if (totalFine > 0) {
                            return (
                              <div className="text-[8.5px] sm:text-[10px] text-red-300 font-bold mt-1">
                                รวมค่าปรับทั้งหมด ฿{totalFine.toLocaleString()}
                              </div>
                            )
                          }
                          return null
                        }

                        const baseTierAmount = tierAmounts[profile?.tier as 'A' | 'B' | 'C'] ?? tierAmounts.B
                        const standardAmount = tierAmounts.B || 50
                        const ratio = baseTierAmount / standardAmount
                        const expectedBaseAmount = (currentPeriod?.amount ?? 0) * ratio
                        const finePaid = currentPeriodStatus.amount - expectedBaseAmount
                        if (finePaid > 0 && currentPeriodStatus.status !== 'paid') {
                          const fineDesc = formatFineDescription({
                            deadline: currentPeriod?.deadline || new Date().toISOString(),
                            fine_type: currentPeriod?.fine_type ?? 'flat',
                            fine_rate: currentPeriod?.fine_rate ?? 0,
                            fine_cap: currentPeriod?.fine_cap ?? null,
                            fine_grace_days: currentPeriod?.fine_grace_days ?? 0,
                            late_fine_amount: currentPeriod?.late_fine_amount ?? 0,
                          })
                          return (
                            <div className="text-[8.5px] sm:text-[10px] text-red-300 font-bold mt-1">
                              รวมค่าปรับ ฿{finePaid.toLocaleString()} · {fineDesc}
                            </div>
                          )
                        }
                        return null
                      })()}
                    </div>

                    {/* Status pill */}
                    <StatusPill 
                      status={
                        allPayablePaid ? 'paid'
                        : (currentPeriodStatus.status === 'paid' ? 'paid'
                           : currentPeriodStatus.status === 'pending' ? 'pending'
                           : currentPeriodStatus.status === 'rejected' ? 'rejected'
                           : 'unpaid')
                      } 
                      note={allPayablePaid ? undefined : currentPeriodStatus.payment?.note}
                      size="lg"
                      className="md:text-[13px] md:px-3.5 md:py-1.5 text-[10.5px] px-2.5 py-0.5"
                    />

                    {/* CTA buttons */}
                    <div className="flex items-center gap-2 w-full md:w-auto">
                      {currentPeriodStatus.status === 'pending' ? (
                        <div className="flex items-center justify-center gap-1.5 sm:gap-2 py-1.5 sm:py-2.5 px-4 sm:px-5 bg-white/10 border border-white/15 rounded-xl text-[10.5px] sm:text-[12px] font-bold text-white/70 backdrop-blur-sm w-full md:w-auto">
                          <Clock className="w-4 h-4" />
                          รออนุมัติสลิป
                        </div>
                      ) : allPayablePaid ? (
                        <div className="flex items-center gap-1.5 sm:gap-2 py-1.5 sm:py-2.5 px-3 sm:px-4 bg-white/5 border border-white/10 rounded-xl text-[10.5px] sm:text-[12px] font-bold text-white/50 w-full justify-center md:w-auto">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          ไม่มีรายการค้างชำระ
                        </div>
                      ) : (
                        <>
                          {/* ถ้า Hero Card งวดยังเปิดอยู่ แสดงปุ่มส่งสลิปปกติ */}
                          {!isLocked ? (
                            <>
                              <button
                                onClick={() => setIsQrModalOpen(true)}
                                className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-white/10 border border-white/20 text-white text-[10.5px] sm:text-[12px] font-bold px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-xl hover:bg-white/15 transition-all active:scale-95 backdrop-blur-sm"
                              >
                                <QrCode className="w-4 h-4" />
                                QR
                              </button>
                              <Link
                                href="/student/upload"
                                className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-white text-brand text-[10.5px] sm:text-[12px] font-black px-3.5 sm:px-6 py-1.5 sm:py-2.5 rounded-xl hover:bg-white/90 transition-all active:scale-95 shadow-xl shadow-black/20"
                              >
                                <Upload className="w-4 h-4" />
                                {currentPeriodStatus.status === 'rejected' ? 'ส่งใหม่' : 'ส่งสลิป'}
                              </Link>
                            </>
                          ) : (
                            /* Hero Card งวดปิด — ตรวจว่ามีงวดอื่นที่ยังเปิดอยู่หรือไม่ */
                            hasPayableUnpaid ? (
                              <Link
                                href="/student/upload"
                                className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 sm:gap-2 bg-white text-brand text-[10.5px] sm:text-[12px] font-black px-3.5 sm:px-6 py-1.5 sm:py-2.5 rounded-xl hover:bg-white/90 transition-all active:scale-95 shadow-xl shadow-black/20"
                              >
                                <Upload className="w-4 h-4" />
                                ส่งสลิปงวดอื่น
                              </Link>
                            ) : (
                              <div className="flex items-center gap-1.5 sm:gap-2 py-1.5 sm:py-2.5 px-3 sm:px-4 bg-white/5 border border-white/10 rounded-xl text-[10.5px] sm:text-[12px] font-bold text-white/50 w-full justify-center md:w-auto">
                                <Lock className="w-4 h-4" />
                                {windowStatus === 'upcoming' ? 'รอเปิดรับสลิป' : 'ปิดรับสลิปทุกงวดแล้ว'}
                              </div>
                            )
                          )}
                        </>
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
              <KpiCard label="รอตรวจ" value={pendingCount} sub="รออนุมัติ" subVariant="warning" />
              <KpiCard label="ยอดค้าง" value={unpaidCount} sub="ยังไม่จ่าย" subVariant="danger" />
            </div>

            {/* Grid */}
            <div className="bg-background-secondary border border-border rounded-2xl md:rounded-[2rem] p-3 sm:p-6 md:p-8 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-8">
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
          <div className="bg-background-secondary border border-border rounded-2xl md:rounded-[2rem] p-3 sm:p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-4 sm:mb-8">
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
          <div className="bg-background-secondary border border-border rounded-2xl md:rounded-[2rem] p-3 sm:p-6 md:p-8 shadow-sm">
            <div className="flex items-center justify-between mb-4 sm:mb-8">
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
          title={displayLabel}
          amount={displayAmount}
        />
      )}
    </div>
  )
}
