'use client'

import { useState } from 'react'
import Topbar from '@/components/layout/Topbar'
import KpiCard from '@/components/shared/KpiCard'
import WeekGrid from '@/components/payments/WeekGrid'
import PaymentRow from '@/components/payments/PaymentRow'
import StatusPill from '@/components/payments/StatusPill'
import ExpenseRow from '@/components/expenses/ExpenseRow'
import EmptyState from '@/components/shared/EmptyState'
import QrModal from '@/components/payments/QrModal'
import { formatCurrency, formatDate, getTierConfig } from '@/lib/utils'
import { FileText, Upload, ArrowRight, AlertCircle, Clock, QrCode, Sparkles, Lock, Calendar, CreditCard } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { WeekStatus, PaymentCredit } from '@/types'

function getWindowStatus(w: WeekStatus) {
  const now = new Date()
  const openAt = w.payment_open_at ? new Date(w.payment_open_at) : null
  const closeAt = w.payment_close_at ? new Date(w.payment_close_at) : null

  if (!openAt && !closeAt) return 'open'
  if (openAt && now < openAt) return 'upcoming'
  if (closeAt && now > closeAt) return 'closed'
  return 'open'
}

export default function StudentDashboard({ 
  profile, 
  payments, 
  weekSettings, 
  expenses,
  promptPayConfig,
  pendingCredits = [],
}: { 
  profile: any, 
  payments: any[], 
  weekSettings: any[], 
  expenses: any[],
  promptPayConfig: { promptpay_id: string, promptpay_name: string },
  pendingCredits?: PaymentCredit[],
}) {
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)

  const weekStatuses: WeekStatus[] = (weekSettings || []).map((setting) => {
    const payment = payments?.find((p) => p.week === setting.week)
    return {
      week: setting.week,
      status: payment?.status === 'approved' ? 'paid'
             : payment?.status === 'pending' ? 'pending'
             : payment?.status === 'rejected' ? 'rejected'
             : 'unpaid',
      amount: setting.amount || 100,
      payment,
      deadline: setting.deadline || null,
      title: setting.title,
      payment_open_at: setting.payment_open_at,
      payment_close_at: setting.payment_close_at
    }
  })

  const currentWeekStatus = weekStatuses.find((w) => w.status !== 'paid') ?? weekStatuses[weekStatuses.length - 1]
  const currentWeek = currentWeekStatus?.week || 0
  const currentDeadline = currentWeekStatus?.deadline ? new Date(currentWeekStatus.deadline) : null
  const isOverdue = currentDeadline ? new Date() > currentDeadline : false
  
  const windowStatus = currentWeekStatus ? getWindowStatus(currentWeekStatus) : 'open'
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

  const paidCount = weekStatuses.filter((w) => w.status === 'paid').length
  const pendingCount = weekStatuses.filter((w) => w.status === 'pending').length
  const unpaidCount = weekStatuses.filter((w) => w.status === 'unpaid' || w.status === 'rejected').length
  const totalPaid = (payments?.filter((p) => p.status === 'approved') ?? []).reduce((s, p) => s + p.amount, 0)
  const totalCycles = weekStatuses.length

  return (
    <div className="pb-12 bg-background">
      <Topbar
        title={`สวัสดี, ${profile?.fullname ?? 'นักศึกษา'}`}
        subtitle="ภาพรวมระบบการเงินสาขา"
        actions={
          currentWeekStatus && currentWeekStatus.status !== 'paid' && currentWeekStatus.status !== 'pending' && !isLocked ? (
            <Link href="/student/upload" className="flex items-center gap-2 bg-brand text-white text-[12px] font-bold px-4 py-2 rounded-xl hover:bg-brand-hover transition-all shadow-lg shadow-brand/10 active:scale-95">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">ส่งสลิป</span>
            </Link>
          ) : null
        }
      />

      <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
        {totalCycles === 0 ? (
          <EmptyState icon={FileText} title="ยังไม่มีกำหนดการชำระเงิน" description="กรุณารอเหรัญญิกเพิ่มงวดการชำระเงิน" />
        ) : (
          <>
            {/* Hero Card */}
            <div className="relative group overflow-hidden rounded-[2rem] bg-brand shadow-2xl shadow-brand/10">
              <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:scale-110 transition-transform duration-700">
                <Sparkles className="w-32 h-32 text-white" />
              </div>
              <div className="bg-white m-[1px] rounded-[1.9rem] p-6 md:p-10 flex flex-col md:flex-row md:items-center gap-6 md:gap-8 relative z-10">
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted bg-background-muted px-2.5 py-1 rounded-lg border border-border">งวดปัจจุบัน</span>
                    {/* Tier Badge */}
                    {(() => {
                      const tierCfg = getTierConfig(profile?.tier ?? 'B')
                      return (
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${tierCfg.color} ${tierCfg.bg} ${tierCfg.border}`}>
                          Tier {profile?.tier ?? 'B'} · ฿{tierCfg.amount}/สัปดาห์
                        </span>
                      )
                    })()}
                    {profile?.tier === 'C' && (
                      <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-100 px-2.5 py-1 rounded-lg font-bold">
                        ลดหย่อนชั่วคราว
                      </span>
                    )}
                    {isOverdue && currentWeekStatus.status !== 'paid' && (
                      <span className="flex items-center gap-1 text-[10px] bg-red-50 text-red-600 px-2.5 py-1 rounded-lg border border-red-100 font-bold uppercase">
                        <AlertCircle className="w-3 h-3" />
                        เกินกำหนด
                      </span>
                    )}
                    {windowStatus === 'upcoming' && (
                      <span className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 px-2.5 py-1 rounded-lg border border-amber-100 font-bold uppercase">
                        <Calendar className="w-3 h-3" />
                        จะเปิดรับในวันที่ {currentWeekStatus.payment_open_at ? formatThaiDate(new Date(currentWeekStatus.payment_open_at)) : ''}
                      </span>
                    )}
                    {windowStatus === 'closed' && (
                      <span className="flex items-center gap-1 text-[10px] bg-red-50 text-red-600 px-2.5 py-1 rounded-lg border border-red-100 font-bold uppercase">
                        <Lock className="w-3 h-3" />
                        ปิดรับสลิปแล้ว
                      </span>
                    )}
                  </div>
                  
                  <div>
                    <h1 className="text-[24px] md:text-[32px] font-bold text-text-primary tracking-tight leading-tight">
                      {currentWeekStatus.title || `งวดที่ ${currentWeek}`}
                    </h1>
                    <div className="flex items-center gap-2 text-text-muted mt-1 font-medium text-[13px]">
                      <Clock className="w-4 h-4" />
                      <span>กำหนดส่ง: {currentDeadline ? formatDate(currentDeadline) : 'ไม่ระบุ'}</span>
                    </div>
                  </div>

                  <StatusPill 
                    status={
                      currentWeekStatus.status === 'paid' ? 'paid'
                      : currentWeekStatus.status === 'pending' ? 'pending'
                      : currentWeekStatus.status === 'rejected' ? 'rejected'
                      : 'unpaid'
                    } 
                    note={currentWeekStatus.payment?.note}
                  />
                </div>
                
                <div className="hidden md:block w-px h-20 bg-border mx-2" />
                
                <div className="flex flex-col items-start md:items-end gap-1">
                  <div className="text-[11px] font-bold text-text-muted uppercase tracking-widest">ยอดที่ต้องชำระ</div>
                  <div className="text-[32px] md:text-[44px] font-bold text-brand tracking-tighter leading-none mb-4">
                    ฿{currentWeekStatus.amount.toLocaleString()}
                  </div>
                  
                  <div className="flex items-center gap-2 w-full md:w-auto">
                    {currentWeekStatus.status !== 'paid' && currentWeekStatus.status !== 'pending' && (
                      <>
                        {!isLocked ? (
                          <>
                            <button
                              onClick={() => setIsQrModalOpen(true)}
                              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-background border border-border text-text-primary text-[12px] font-bold px-4 py-2.5 rounded-xl hover:bg-background-tertiary transition-all active:scale-95 shadow-sm"
                            >
                              <QrCode className="w-4 h-4" />
                              ดู QR
                            </button>
                            <Link
                              href="/student/upload"
                              className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 bg-brand text-white text-[12px] font-bold px-6 py-2.5 rounded-xl hover:bg-brand-hover transition-all active:scale-95 shadow-lg shadow-brand/20"
                            >
                              <Upload className="w-4 h-4" />
                              {currentWeekStatus.status === 'rejected' ? 'ส่งใหม่' : 'ส่งสลิป'}
                            </Link>
                          </>
                        ) : (
                          <div className="flex items-center gap-2 py-2 px-4 bg-background-tertiary rounded-xl border border-border text-[13px] font-bold text-text-muted">
                            <Lock className="w-4 h-4" />
                            {windowStatus === 'upcoming' ? 'รอเปิดรับสลิป' : 'ปิดรับสลิปแล้ว'}
                          </div>
                        )}
                      </>
                    )}
                    {currentWeekStatus.status === 'pending' && (
                      <div className="bg-emerald-50 text-emerald-700 px-5 py-2.5 rounded-xl border border-emerald-100 text-[13px] font-bold">
                        กำลังตรวจสอบรายการ...
                      </div>
                    )}
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
                        ฿{c.amount.toLocaleString()} — สัปดาห์ที่ {c.week}
                        {(c.week_info as { title?: string } | undefined)?.title ? ` (${(c.week_info as { title?: string }).title})` : ''}
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

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <KpiCard label="จ่ายแล้ว" value={`${paidCount}/${totalCycles}`} sub={formatCurrency(totalPaid)} subVariant="positive" />
              <KpiCard label="รอตรวจ" value={pendingCount} sub="รายการค้างอนุมัติ" subVariant="warning" />
              <KpiCard label="ยอดค้าง" value={unpaidCount} sub="จำนวนงวดที่เหลือ" subVariant="danger" />
            </div>

            {/* Grid */}
            <div className="bg-background-secondary border border-border rounded-[2rem] p-6 md:p-8 shadow-sm">
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
              <WeekGrid weeks={weekStatuses} currentWeek={currentWeek} />
            </div>
          </>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
          {/* History */}
          <div className="bg-background-secondary border border-border rounded-[2rem] p-6 md:p-8 shadow-sm">
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
          <div className="bg-background-secondary border border-border rounded-[2rem] p-6 md:p-8 shadow-sm">
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
          title={currentWeekStatus.title || `งวดที่ ${currentWeekStatus.week}`}
          amount={currentWeekStatus.amount}
        />
      )}
    </div>
  )
}
