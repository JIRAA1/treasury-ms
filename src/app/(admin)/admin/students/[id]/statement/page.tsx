import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Topbar from '@/components/layout/Topbar'
import { formatCurrency, formatDate, getTierConfig, getCreditStatusLabel } from '@/lib/utils'
import { calculateLateFine } from '@/lib/fine'
import {
  ArrowLeft, FileText, CreditCard, AlertCircle, CheckCircle,
  Clock, XCircle, Receipt, BanknoteIcon
} from 'lucide-react'
import Link from 'next/link'
import type { PeriodStatus } from '@/types'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const adminClient = createAdminClient()
  const { data: student } = await adminClient.from('users').select('fullname').eq('id', id).single()
  return { title: `ใบแจ้งหนี้ — ${student?.fullname ?? 'นักศึกษา'} | TreasuryMS` }
}

export default async function StudentStatementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  // Auth check
  const { data: actorProfile } = await adminClient
    .from('users')
    .select('id, role')
    .or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`)
    .maybeSingle()
  if (!actorProfile || !['admin', 'treasurer'].includes(actorProfile.role)) {
    redirect('/student/dashboard')
  }

  // Fetch student
  const { data: student } = await adminClient.from('users').select('*').eq('id', id).single()
  if (!student) notFound()

  // Active semester + periods
  const { data: activeSemester } = await adminClient
    .from('semesters')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle()

  const activeSemesterId = activeSemester?.id || '00000000-0000-0000-0000-000000000000'

  const { data: periods } = await adminClient
    .from('periods')
    .select('*')
    .eq('semester_id', activeSemesterId)
    .order('period_order', { ascending: true })

  const periodIds = (periods ?? []).map(p => p.id)

  // Payments in active semester
  const { data: payments } = await adminClient
    .from('payments')
    .select('*')
    .eq('user_id', id)
    .in('period_id', periodIds.length > 0 ? periodIds : ['00000000-0000-0000-0000-000000000000'])
    .order('created_at', { ascending: false })

  // Pending credits
  const { data: credits } = await adminClient
    .from('payment_credits')
    .select('*, period:period_id(label, deadline)')
    .eq('user_id', id)
    .order('created_at', { ascending: false })

  const now = new Date()

  // Build period status with fine calculation
  const periodStatuses: (PeriodStatus & { fine: number })[] = (periods ?? []).map(p => {
    const payment = payments?.find(pay => pay.period_id === p.id)
    const hasPendingCredit = credits?.some(c => c.period_id === p.id && c.status === 'pending') ?? false
    const fine = payment?.status === 'approved' ? 0 : calculateLateFine(p, now, hasPendingCredit)
    const status = payment?.status === 'approved' ? 'paid'
      : payment?.status === 'pending' ? 'pending'
      : payment?.status === 'rejected' ? 'rejected'
      : 'unpaid'
    return {
      period: p,
      status,
      amount: payment?.status === 'approved' ? (payment?.amount ?? p.amount) : p.amount,
      payment,
      fine,
    }
  })

  // Summary stats
  const paidCount = periodStatuses.filter(ps => ps.status === 'paid').length
  const unpaidCount = periodStatuses.filter(ps => ps.status === 'unpaid').length
  const totalPaid = payments?.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0) ?? 0
  const totalFineAccrued = periodStatuses.reduce((s, ps) => s + ps.fine, 0)
  const pendingCreditTotal = credits?.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0) ?? 0

  const tierCfg = getTierConfig(student.tier)

  const statusIcon = (s: string) => {
    switch (s) {
      case 'paid': return <CheckCircle className="w-4 h-4 text-emerald-500" />
      case 'pending': return <Clock className="w-4 h-4 text-amber-500" />
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />
      default: return <AlertCircle className="w-4 h-4 text-text-disabled" />
    }
  }

  const statusLabel = (s: string) => {
    switch (s) {
      case 'paid': return <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">ชำระแล้ว</span>
      case 'pending': return <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">รอตรวจ</span>
      case 'rejected': return <span className="text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">ถูกปฏิเสธ</span>
      default: return <span className="text-[10px] font-black text-text-disabled bg-background-tertiary px-2 py-0.5 rounded-full border border-border">ยังไม่ชำระ</span>
    }
  }

  return (
    <div>
      <Topbar
        title={`ใบแจ้งหนี้ — ${student.fullname}`}
        subtitle={`เทอม ${activeSemester?.name ?? '—'} · รหัส ${student.student_id}`}
        actions={
          <Link
            href={`/admin/students/${id}`}
            className="flex items-center gap-1.5 border border-border-strong bg-background text-[12.5px] font-medium px-3 py-1.5 rounded-lg hover:bg-background-secondary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            กลับ
          </Link>
        }
      />

      <div className="p-6 max-w-4xl space-y-6">

        {/* ── Profile + Summary Row ──────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {/* Profile */}
          <div className={`sm:col-span-1 ${tierCfg.bg} ${tierCfg.border} border rounded-2xl p-5 flex flex-col items-center gap-3`}>
            <div className="w-14 h-14 rounded-full bg-brand flex items-center justify-center shadow-md">
              <span className="text-white text-xl font-bold">{student.fullname?.[0] ?? 'U'}</span>
            </div>
            <div className="text-center">
              <div className="text-[13px] font-bold text-text-primary">{student.fullname}</div>
              <div className="text-[11px] text-text-muted font-mono mt-0.5">{student.student_id}</div>
            </div>
            <span className={`text-[11px] font-black px-3 py-1 rounded-full border ${tierCfg.color} ${tierCfg.bg} ${tierCfg.border}`}>
              Tier {student.tier}
            </span>
          </div>

          {/* KPI */}
          <div className="sm:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'ชำระแล้ว', value: `${paidCount}/${periods?.length ?? 0} งวด`, color: 'text-emerald-600' },
              { label: 'ยังค้าง', value: `${unpaidCount} งวด`, color: unpaidCount > 0 ? 'text-red-500' : 'text-text-muted' },
              { label: 'ยอดจ่ายรวม', value: formatCurrency(totalPaid), color: 'text-brand' },
              { label: 'ค่าปรับสะสม', value: totalFineAccrued > 0 ? formatCurrency(totalFineAccrued) : '—', color: totalFineAccrued > 0 ? 'text-red-500' : 'text-text-muted' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-background-secondary border border-border rounded-xl p-4">
                <div className="text-[9.5px] uppercase tracking-widest text-text-muted mb-1.5">{label}</div>
                <div className={`text-[16px] font-black ${color} leading-tight`}>{value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Payment History ──────────────────────────────────── */}
        <div className="bg-background-secondary border border-border rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand" />
            <span className="text-[13.5px] font-bold text-text-primary">ประวัติการชำระรายงวด</span>
            <span className="ml-auto text-[10.5px] text-text-muted">เทอม {activeSemester?.name ?? '—'}</span>
          </div>

          {periodStatuses.length === 0 ? (
            <div className="py-14 text-center text-text-muted italic text-[13px]">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
              ยังไม่มีงวดในเทอมนี้
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {periodStatuses.map(ps => (
                <div key={ps.period.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-background-tertiary/30 transition-colors">
                  {/* Status icon */}
                  <div className="flex-shrink-0">{statusIcon(ps.status)}</div>

                  {/* Period info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-semibold text-text-primary truncate">{ps.period.label}</div>
                    <div className="text-[10.5px] text-text-muted">ครบกำหนด: {formatDate(ps.period.deadline)}</div>
                  </div>

                  {/* Fine badge */}
                  {ps.fine > 0 && ps.status !== 'paid' && (
                    <div className="flex-shrink-0 text-[10px] font-black text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                      +{formatCurrency(ps.fine)} ปรับ
                    </div>
                  )}

                  {/* Amount */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-[12.5px] font-semibold text-text-primary">
                      {ps.status === 'paid' ? formatCurrency(ps.amount) : formatCurrency(ps.period.amount + ps.fine)}
                    </div>
                    {ps.payment?.created_at && (
                      <div className="text-[10px] text-text-muted">{formatDate(ps.payment.created_at)}</div>
                    )}
                  </div>

                  {/* Status pill */}
                  <div className="flex-shrink-0">{statusLabel(ps.status)}</div>
                </div>
              ))}
            </div>
          )}

          {/* Total Row */}
          {periodStatuses.length > 0 && (
            <div className="px-5 py-3.5 border-t border-border bg-background-tertiary/30 flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">ยอดรวมค้างชำระ</span>
              <span className="text-[15px] font-black text-red-500">
                {formatCurrency(
                  periodStatuses
                    .filter(ps => ps.status !== 'paid')
                    .reduce((s, ps) => s + ps.period.amount + ps.fine, 0)
                )}
              </span>
            </div>
          )}
        </div>

        {/* ── Pending Credits ──────────────────────────────────── */}
        {credits && credits.length > 0 && (
          <div className="bg-background-secondary border border-border rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center gap-2">
              <Receipt className="w-4 h-4 text-amber-500" />
              <span className="text-[13.5px] font-bold text-text-primary">เครดิต / หนี้ผ่อนผัน</span>
              {pendingCreditTotal > 0 && (
                <span className="ml-auto text-[11px] font-black text-amber-600 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                  ค้าง {formatCurrency(pendingCreditTotal)}
                </span>
              )}
            </div>

            <div className="divide-y divide-border/50">
              {credits.map(credit => {
                const { label: creditLabel, color: creditColor, bg: creditBg } = getCreditStatusLabel(credit.status)
                const periodInfo = credit.period as any
                return (
                  <div key={credit.id} className="flex items-center gap-4 px-5 py-3.5">
                    <BanknoteIcon className="w-4 h-4 text-text-muted flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[12.5px] font-semibold text-text-primary">
                        {periodInfo?.label ?? 'งวดที่ไม่ระบุ'}
                      </div>
                      {credit.note && (
                        <div className="text-[10.5px] text-text-muted truncate">{credit.note}</div>
                      )}
                      <div className="text-[10px] text-text-muted">{formatDate(credit.created_at)}</div>
                    </div>
                    <div className="text-[12.5px] font-bold text-amber-600 flex-shrink-0">
                      {formatCurrency(credit.amount)}
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border flex-shrink-0 ${creditColor} ${creditBg}`}>
                      {creditLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Print hint ───────────────────────────────────────── */}
        <div className="text-center text-[10.5px] text-text-disabled">
          ใบแจ้งหนี้นี้สร้างโดยอัตโนมัติ ณ {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
}
