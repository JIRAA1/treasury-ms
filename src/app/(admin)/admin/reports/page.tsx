import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Topbar from '@/components/layout/Topbar'
import KpiCard from '@/components/shared/KpiCard'
import { formatCurrency, cn } from '@/lib/utils'
import { FileText, Download, Users, CreditCard, ArrowRight, TrendingUp, Receipt, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import Link from 'next/link'
import ReportCharts from '@/components/admin/ReportCharts'

export const metadata = { title: 'รายงาน — TreasuryMS' }

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ semester_id?: string }>
}) {
  const { semester_id } = await searchParams
  const adminClient = createAdminClient()

  // Fetch all semesters for the selector
  const { data: allSemesters } = await adminClient
    .from('semesters')
    .select('id, name, is_active')
    .order('created_at', { ascending: false })

  const activeSemester = allSemesters?.find((s) => s.is_active)
  const selectedSemesterId = semester_id || activeSemester?.id || '00000000-0000-0000-0000-000000000000'
  const selectedSemester = allSemesters?.find((s) => s.id === selectedSemesterId) || activeSemester

  const [
    { data: students },
    { data: payments },
    { data: expenses },
    { data: incomes },
    { data: periods },
    { data: sysSettings }
  ] = await Promise.all([
    adminClient.from('users').select('id, fullname, student_id, tier').eq('role', 'student'),
    adminClient.from('payments').select('id, user_id, period_id, amount, status'),
    adminClient.from('expenses').select('id, title, amount, approved_by, created_at'),
    adminClient.from('incomes').select('id, title, amount, approved_by, source, created_at'),
    adminClient.from('periods').select('id, label, period_order, amount').eq('semester_id', selectedSemesterId).order('period_order', { ascending: true }),
    adminClient.from('system_settings').select('key, value')
  ])

  const selectedPeriodIds = new Set(periods?.map(p => p.id) || [])
  const semesterPayments = payments?.filter(p => selectedPeriodIds.has(p.period_id)) || []

  const totalPayments = semesterPayments.filter(p => p.status === 'approved').reduce((s, p) => s + (p.amount || 0), 0) || 0
  const totalOtherIncomes = incomes?.filter(i => i.approved_by).reduce((s, i) => s + (i.amount || 0), 0) || 0
  const totalIncome = totalPayments + totalOtherIncomes
  const totalExpense = expenses?.filter(e => e.approved_by).reduce((s, e) => s + (e.amount || 0), 0) || 0
  const balance = totalIncome - totalExpense

  const reserveTarget = parseInt(sysSettings?.find((s: any) => s.key === 'reserve_fund_monthly_target')?.value ?? '200', 10)
  const availableBalance = balance - reserveTarget

  // Tier breakdown
  const tierACount = students?.filter((s: any) => s.tier === 'A').length || 0
  const tierBCount = students?.filter((s: any) => s.tier === 'B').length || 0
  const tierCCount = students?.filter((s: any) => s.tier === 'C').length || 0
  const tierSettings = {
    A: parseInt(sysSettings?.find((s: any) => s.key === 'tier_a_amount')?.value ?? '0', 10),
    B: parseInt(sysSettings?.find((s: any) => s.key === 'tier_b_amount')?.value ?? '0', 10),
    C: parseInt(sysSettings?.find((s: any) => s.key === 'tier_c_amount')?.value ?? '0', 10),
  }

  // Cycle summary
  const cycleData = periods?.map((s) => {
    const cyclePayments = semesterPayments.filter(p => p.period_id === s.id && p.status === 'approved')
    const collected = cyclePayments.reduce((sum, p) => sum + (p.amount || 0), 0)
    const paidCount = cyclePayments.length
    const pendingCount = semesterPayments.filter(p => p.period_id === s.id && p.status === 'pending').length
    const rate = students?.length ? Math.round((paidCount / students.length) * 100) : 0
    
    const standardAmount = tierSettings.B || 50
    const targetAmount = 
      (tierACount * (s.amount * (tierSettings.A / standardAmount))) + 
      (tierBCount * (s.amount * (tierSettings.B / standardAmount))) + 
      (tierCCount * (s.amount * (tierSettings.C / standardAmount)))
      
    return { ...s, collected, paidCount, pendingCount, rate, targetAmount }
  }) || []

  const approvedOtherIncomes = incomes?.filter(i => i.approved_by).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || []
  const approvedExpenses = expenses?.filter(e => e.approved_by).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || []

  return (
    <div>
      <Topbar
        title="รายงานการเงิน"
        subtitle={`ภาพรวมรายรับ-รายจ่าย · เทอม ${selectedSemester?.name || '—'}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <a href="/api/reports/export?type=credits" className="flex items-center gap-1.5 border border-amber-200 bg-amber-50 text-amber-700 text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-amber-100 transition-colors">
              <Download className="w-3.5 h-3.5" />
              Credit Report
            </a>
            <a href="/api/reports/export?type=income" className="flex items-center gap-1.5 border border-border-strong bg-background text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-background-secondary transition-colors">
              <Download className="w-3.5 h-3.5" />
              ส่งออกรายรับ
            </a>
            <a href="/api/reports/export?type=students" className="flex items-center gap-1.5 border border-border-strong bg-background text-[11px] font-medium px-3 py-1.5 rounded-lg hover:bg-background-secondary transition-colors">
              <Download className="w-3.5 h-3.5" />
              สรุปรายคน
            </a>
          </div>
        }
      />

      <div className="p-4 md:p-6 space-y-6">
        {/* Semester Selector */}
        {allSemesters && allSemesters.length > 1 && (
          <div className="flex items-center gap-3 p-3 bg-background-secondary border border-border rounded-xl">
            <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">เทอม</span>
            <div className="flex flex-wrap gap-2">
              {allSemesters.map((sem) => (
                <Link
                  key={sem.id}
                  href={`/admin/reports?semester_id=${sem.id}`}
                  className={cn(
                    "text-[11px] font-bold px-3 py-1.5 rounded-lg border transition-all",
                    sem.id === selectedSemesterId
                      ? "bg-brand text-white border-brand shadow-sm"
                      : "bg-background text-text-secondary border-border hover:border-brand/30"
                  )}
                >
                  {sem.name}
                  {sem.is_active && (
                    <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded-full">Active</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard label="รายรับทั้งหมด" value={formatCurrency(totalIncome)} sub={`จากนักเรียน: ${formatCurrency(totalPayments)} · แหล่งอื่น: ${formatCurrency(totalOtherIncomes)}`} subVariant="positive" />
          <KpiCard label="รายจ่ายทั้งหมด" value={formatCurrency(totalExpense)} sub="ยอดที่จ่ายออกจริง" subVariant="danger" />
          <KpiCard
            label="ยอดคงเหลือ"
            value={formatCurrency(availableBalance)}
            sub={`หักเงินสำรอง ฿${reserveTarget.toLocaleString()} แล้ว (จากทั้งหมด ${formatCurrency(balance)})`}
            subVariant={availableBalance >= 0 ? 'positive' : 'danger'}
          />
        </div>

        {/* Tier Breakdown */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { tier: 'A', count: tierACount, amount: tierSettings.A, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
            { tier: 'B', count: tierBCount, amount: tierSettings.B, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
            { tier: 'C', count: tierCCount, amount: tierSettings.C, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
          ].map(({ tier, count, amount, color, bg, border }) => (
            <div key={tier} className={`rounded-xl border ${border} ${bg} p-4`}>
              <div className={`text-[11px] font-black uppercase tracking-widest mb-1.5 ${color}`}>Tier {tier}</div>
              <div className={`text-[20px] font-black ${color}`}>{count} คน</div>
              <div className="text-[10px] text-text-muted mt-1">
                {amount > 0 ? `฿${amount.toLocaleString()} / งวด` : 'ไม่ระบุ'}
              </div>
            </div>
          ))}
        </div>

        {/* Charts */}
        <ReportCharts
          cycleData={cycleData}
          studentCount={students?.length || 0}
          tierBreakdown={{ A: tierACount, B: tierBCount, C: tierCCount }}
          tierAmounts={{
            A: tierSettings.A || 0,
            B: tierSettings.B || 0,
            C: tierSettings.C || 0,
          }}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Cycle Summary */}
          <div className="bg-background-secondary border border-border rounded-xl p-5">
            <div className="text-[13px] font-bold text-text-primary mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand" />
              สรุปตามงวดการชำระ
            </div>
            <div className="space-y-2">
              {cycleData.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-background border border-border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-semibold text-text-primary truncate">{c.label || `งวดที่ ${c.period_order}`}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex items-center gap-1 text-[10px] text-emerald-600">
                        <CheckCircle className="w-3 h-3" />
                        {c.paidCount} จ่ายแล้ว
                      </div>
                      {c.pendingCount > 0 && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-600">
                          <Clock className="w-3 h-3" />
                          {c.pendingCount} รอตรวจ
                        </div>
                      )}
                      <div className="text-[10px] text-text-muted">/ {students?.length || 0} คน</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[12px] font-bold text-brand">{formatCurrency(c.collected)} / {formatCurrency(c.targetAmount)}</div>
                    <div className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-0.5",
                      c.rate >= 80 ? "bg-emerald-50 text-emerald-600" :
                      c.rate >= 50 ? "bg-amber-50 text-amber-600" :
                      "bg-red-50 text-red-600"
                    )}>{c.rate}%</div>
                  </div>
                </div>
              ))}
              {cycleData.length === 0 && (
                <div className="text-center py-10 text-text-muted italic text-[11.5px]">
                  <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  ยังไม่มีข้อมูลการชำระเงินในเทอมนี้
                </div>
              )}
            </div>
          </div>

          {/* Student Summary */}
          <div className="bg-background-secondary border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13px] font-bold text-text-primary flex items-center gap-2">
                <Users className="w-4 h-4 text-brand" />
                สถานะนักศึกษา
              </div>
              <Link href="/admin/students" className="text-[10.5px] text-brand hover:underline flex items-center gap-1">
                ดูทั้งหมด <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {students?.slice(0, 8).map((s: any) => {
                const paidCount = semesterPayments.filter(p => p.user_id === s.id && p.status === 'approved').length
                const pendingCount = semesterPayments.filter(p => p.user_id === s.id && p.status === 'pending').length
                const isFullyPaid = paidCount >= (periods?.length || 0)
                return (
                  <div key={s.id} className="py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11.5px] font-medium text-text-primary truncate">{s.fullname}</div>
                      <div className="text-[9.5px] text-text-muted">{s.student_id} · Tier {s.tier}</div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {pendingCount > 0 && (
                        <span className="text-[9px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">
                          รอ {pendingCount}
                        </span>
                      )}
                      <div className={cn(
                        "text-[10px] font-bold px-2 py-0.5 rounded-full",
                        isFullyPaid ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      )}>
                        {paidCount}/{periods?.length || 0} งวด
                      </div>
                    </div>
                  </div>
                )
              })}
              {(!students || students.length === 0) && (
                <div className="text-center py-10 text-text-muted italic text-[11.5px]">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  ยังไม่มีนักศึกษาในระบบ
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Other Incomes and Expenses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Other Incomes */}
          <div className="bg-background-secondary border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13px] font-bold text-text-primary flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                รายรับอื่น ๆ
              </div>
              <Link href="/admin/incomes" className="text-[10.5px] text-brand hover:underline flex items-center gap-1">
                จัดการ <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {approvedOtherIncomes.slice(0, 5).map((i) => (
                <div key={i.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-text-primary truncate">{i.title}</div>
                    <div className="text-[10px] text-text-muted">{i.source || 'ไม่ระบุแหล่ง'} · {new Date(i.created_at).toLocaleDateString('th-TH')}</div>
                  </div>
                  <div className="text-[12px] font-bold text-emerald-600 flex-shrink-0 ml-2">{formatCurrency(i.amount)}</div>
                </div>
              ))}
              {approvedOtherIncomes.length === 0 && (
                <div className="text-center py-10 text-text-muted italic text-[11.5px]">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  ยังไม่มีรายรับอื่น ๆ
                </div>
              )}
            </div>
          </div>

          {/* Expenses */}
          <div className="bg-background-secondary border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[13px] font-bold text-text-primary flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-600" />
                รายจ่ายล่าสุด
              </div>
              <Link href="/admin/expenses" className="text-[10.5px] text-brand hover:underline flex items-center gap-1">
                จัดการ <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {approvedExpenses.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
                  <div className="min-w-0">
                    <div className="text-[12px] font-semibold text-text-primary truncate">{e.title}</div>
                    <div className="text-[10px] text-text-muted">{new Date(e.created_at).toLocaleDateString('th-TH')}</div>
                  </div>
                  <div className="text-[12px] font-bold text-red-600 flex-shrink-0 ml-2">{formatCurrency(e.amount)}</div>
                </div>
              ))}
              {approvedExpenses.length === 0 && (
                <div className="text-center py-10 text-text-muted italic text-[11.5px]">
                  <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  ยังไม่มีรายจ่าย
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
