import { createAdminClient } from '@/lib/supabase/admin'
import Topbar from '@/components/layout/Topbar'
import KpiCard from '@/components/shared/KpiCard'
import ActivityFeed from '@/components/shared/ActivityFeed'
import { formatCurrency, formatDate } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'
import Link from 'next/link'
import { Plus, Download } from 'lucide-react'
import type { Activity } from '@/components/shared/ActivityFeed'
import NotificationTrigger from '@/components/admin/NotificationTrigger'
import QuickApproveButton from '@/components/admin/QuickApproveButton'
import ExpenseDonutChart from '@/components/charts/ExpenseDonutChart'
import CashFlowTrendChart from '@/components/charts/CashFlowTrendChart'
import PaymentRateChart from '@/components/charts/PaymentRateChart'
import ExpectedVsActualChart from '@/components/charts/ExpectedVsActualChart'
import type { ExpenseCategory } from '@/types'

export const metadata = { title: 'ภาพรวม — TreasuryMS Admin' }

export default async function AdminOverviewPage() {
  // Use admin client to bypass RLS for dashboard stats
  const supabase = createAdminClient()

  const [
    { data: pendingPayments },
    { data: balance },
    { count: pendingCount },
    { data: auditLogs },
    { data: monthExpenses },
    { count: studentCount },
    { data: users },
    { data: pendingCredits },
    { data: sysSettings },
  ] = await Promise.all([
    supabase.from('payments').select('*, user:user_id(fullname, student_id), period:period_id(label, period_order)').eq('status', 'pending').order('created_at').limit(8),
    supabase.rpc('get_treasury_balance'),
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('audit_logs').select('*, actor:actor_id(fullname)').order('created_at', { ascending: false }).limit(10),
    supabase.from('expenses').select('amount').not('approved_by', 'is', null)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('users').select('tier').eq('role', 'student'),
    supabase.from('payment_credits').select('amount').eq('status', 'pending'),
    supabase.from('system_settings').select('key, value').in('key', ['reserve_fund_monthly_target', 'tier_c_max_quota', 'tier_a_amount', 'tier_b_amount', 'tier_c_amount']),
  ])

  // Tier breakdown
  const tierBreakdown = { A: 0, B: 0, C: 0 }
  for (const u of users ?? []) {
    if (u.tier === 'A') tierBreakdown.A++
    else if (u.tier === 'C') tierBreakdown.C++
    else tierBreakdown.B++
  }
  const reserveTarget = parseInt(sysSettings?.find((s: { key: string; value: string }) => s.key === 'reserve_fund_monthly_target')?.value ?? '200', 10)
  const creditDebtTotal = (pendingCredits ?? []).reduce((s: number, c: { amount: number }) => s + c.amount, 0)
  const pendingCreditsCount = (pendingCredits ?? []).length

  // Period chart data (last 5 periods of active semester)
  const { data: activeSemester } = await supabase
    .from('semesters')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle()

  const activeSemesterId = activeSemester?.id || '00000000-0000-0000-0000-000000000000'

  const { data: recentPeriods } = await supabase
    .from('periods')
    .select('id, label, period_order, amount')
    .eq('semester_id', activeSemesterId)
    .order('period_order', { ascending: false })
    .limit(5)

  // Calculate Expected vs Actual
  const tierAmounts = {
    A: parseFloat(sysSettings?.find((s: { key: string; value: string }) => s.key === 'tier_a_amount')?.value || '60'),
    B: parseFloat(sysSettings?.find((s: { key: string; value: string }) => s.key === 'tier_b_amount')?.value || '50'),
    C: parseFloat(sysSettings?.find((s: { key: string; value: string }) => s.key === 'tier_c_amount')?.value || '30'),
  }
  const standardAmount = tierAmounts.B || 50
  const expectedPerPeriodBase = 
    (tierBreakdown.A * (tierAmounts.A / standardAmount)) +
    (tierBreakdown.B * (tierAmounts.B / standardAmount)) +
    (tierBreakdown.C * (tierAmounts.C / standardAmount))

  const expectedActualData = await Promise.all(
    [...(recentPeriods ?? [])].reverse().map(async (p) => {
      const expected = p.amount * expectedPerPeriodBase;
      const { data: paymentsForPeriod } = await supabase
        .from('payments')
        .select('amount')
        .eq('period_id', p.id)
        .eq('status', 'approved')
      const actual = (paymentsForPeriod ?? []).reduce((sum, curr) => sum + curr.amount, 0)
      return { label: p.label, expected, actual }
    })
  )

  // Calculate Payment Rate by Tier
  const { data: activeSemesterPayments } = await supabase
    .from('payments')
    .select('user_id, status, user:user_id(tier)')
    .in('period_id', recentPeriods?.map(p => p.id) ?? [])
    .eq('status', 'approved')

  const paidCounts = { A: 0, B: 0, C: 0 }
  for (const p of activeSemesterPayments ?? []) {
    const t = (p.user as any)?.tier as 'A' | 'B' | 'C'
    if (t) paidCounts[t]++
  }

  const numPeriods = recentPeriods?.length || 0
  const tierPaymentData = [
    { tier: 'Tier A', paid: paidCounts.A, unpaid: Math.max(0, (tierBreakdown.A * numPeriods) - paidCounts.A) },
    { tier: 'Tier B', paid: paidCounts.B, unpaid: Math.max(0, (tierBreakdown.B * numPeriods) - paidCounts.B) },
    { tier: 'Tier C', paid: paidCounts.C, unpaid: Math.max(0, (tierBreakdown.C * numPeriods) - paidCounts.C) },
  ]

  const monthlyExpenseTotal = (monthExpenses ?? []).reduce((s, e) => s + e.amount, 0)

  // ── Chart data: Expense breakdown by category ──────────────────────────
  const { data: allExpenses } = await supabase
    .from('expenses')
    .select('amount, category')
    .not('approved_by', 'is', null)

  const EXPENSE_CATS: ExpenseCategory[] = ['activity', 'supplies', 'food', 'transport', 'other']
  const categoryTotals = EXPENSE_CATS.map((cat) => ({
    category: cat,
    amount: (allExpenses ?? []).filter((e: any) => (e.category ?? 'other') === cat).reduce((s: number, e: any) => s + (e.amount ?? 0), 0),
  }))
  const expenseTotalAll = categoryTotals.reduce((s, c) => s + c.amount, 0)

  // ── Chart data: Monthly cash flow (last 6 months) ──────────────────────
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const [{ data: monthPayments }, { data: monthIncomes }, { data: monthExpensesAll }] = await Promise.all([
    supabase.from('payments').select('amount, verified_at, created_at').eq('status', 'approved').gte('created_at', sixMonthsAgo.toISOString()),
    supabase.from('incomes').select('amount, created_at').not('approved_by', 'is', null).gte('created_at', sixMonthsAgo.toISOString()),
    supabase.from('expenses').select('amount, created_at').not('approved_by', 'is', null).gte('created_at', sixMonthsAgo.toISOString()),
  ])

  const thaiShortMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - (5 - i))
    const y = d.getFullYear()
    const m = d.getMonth()
    const label = `${thaiShortMonths[m]} ${String(y + 543).slice(-2)}`

    const matchMonth = (dateStr: string) => {
      const dt = new Date(dateStr)
      return dt.getFullYear() === y && dt.getMonth() === m
    }

    const income = [
      ...(monthPayments ?? []).filter((p: any) => matchMonth(p.verified_at || p.created_at)).map((p: any) => p.amount),
      ...(monthIncomes ?? []).filter((inc: any) => matchMonth(inc.created_at)).map((inc: any) => inc.amount),
    ].reduce((s, v) => s + v, 0)

    const expense = (monthExpensesAll ?? [])
      .filter((e: any) => matchMonth(e.created_at))
      .reduce((s: number, e: any) => s + (e.amount ?? 0), 0)

    return { month: label, income, expense, balance: income - expense }
  })

  // Map audit logs to Activity feed format
  const activities: Activity[] = (auditLogs ?? []).map((log) => {
    const actorName = (log.actor as { fullname: string } | null)?.fullname ?? 'ระบบ'
    const actionMap: Record<string, { type: Activity['type']; title: string }> = {
      payment_approved: { type: 'approved', title: `${actorName} อนุมัติการชำระเงิน` },
      payment_rejected: { type: 'rejected', title: `${actorName} ปฏิเสธสลิป` },
      payment_uploaded: { type: 'uploaded', title: `อัปโหลดสลิปใหม่` },
      expense_created: { type: 'expense', title: `${actorName} เพิ่มค่าใช้จ่าย` },
      expense_approved: { type: 'approved', title: `${actorName} อนุมัติค่าใช้จ่าย` },
      expense_deleted: { type: 'rejected', title: `${actorName} ลบค่าใช้จ่าย` },
      income_created: { type: 'uploaded', title: `${actorName} เพิ่มรายรับใหม่` },
      income_approved: { type: 'approved', title: `${actorName} อนุมัติรายรับใหม่` },
      income_deleted: { type: 'rejected', title: `${actorName} ลบรายรับ` },
      notification_sent: { type: 'notification', title: `${actorName} ส่งแจ้งเตือน` },
      broadcast_sent: { type: 'notification', title: `${actorName} บรอดแคสต์ข้อความ` },
      tier_changed: { type: 'uploaded', title: `${actorName} เปลี่ยน Tier นักศึกษา` },
      credit_created: { type: 'expense', title: `${actorName} บันทึก Credit ค้างจ่าย` },
      credit_repaid: { type: 'approved', title: `${actorName} บันทึก Credit จ่ายคืน` },
      credit_forgiven: { type: 'approved', title: `${actorName} ยกให้ Credit` },
      audit_deleted: { type: 'rejected', title: `${actorName} ลบประวัติการใช้งาน` },
      audit_cleared: { type: 'rejected', title: `${actorName} ล้างประวัติการใช้งานทั้งหมด` },
    }
    const mapped = actionMap[log.action] ?? { type: 'uploaded' as const, title: log.action }
    return {
      id: log.id,
      type: mapped.type,
      title: mapped.title,
      sub: `เมื่อ ${formatDistanceToNow(new Date(log.created_at), { locale: th, addSuffix: false })}ที่แล้ว`,
      time: new Date(log.created_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    }
  })

  return (
    <div>
      <Topbar
        title="ภาพรวม"
        subtitle="ข้อมูลล่าสุด ณ วันนี้"
        actions={
          <div className="flex items-center gap-2">
            <Link href="/admin/expenses" className="flex items-center gap-1.5 border border-border bg-white text-[11px] font-semibold px-3 py-1.5 rounded-xl hover:bg-background-muted hover:border-border-strong transition-all duration-150 text-text-secondary shadow-sm">
              <Plus className="w-3 h-3" /> เพิ่มค่าใช้จ่าย
            </Link>
            <a href="/api/reports/export?type=income" className="flex items-center gap-1.5 border border-border bg-white text-[11px] font-semibold px-3 py-1.5 rounded-xl hover:bg-background-muted hover:border-border-strong transition-all duration-150 text-text-secondary shadow-sm">
              <Download className="w-3 h-3" /> ส่งออกรายงาน
            </a>
          </div>
        }
      />

      <div className="p-5 md:p-6 space-y-5">
        {/* KPI Grid — Row 1 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard 
            label="ยอดคงเหลือ" 
            value={formatCurrency((balance ?? 0) - reserveTarget)} 
            sub={`หักสำรอง ฿${reserveTarget.toLocaleString()} (รวม ${formatCurrency(balance ?? 0)})`}
            accentColor="emerald"
          />
          <KpiCard
            label="รอตรวจสอบ"
            value={pendingCount ?? 0}
            sub={(pendingCount ?? 0) > 0 ? 'รอการอนุมัติ' : 'ไม่มีรายการค้าง'}
            subVariant={(pendingCount ?? 0) > 0 ? 'warning' : 'neutral'}
            accentColor={(pendingCount ?? 0) > 0 ? 'amber' : 'brand'}
          />
          <KpiCard label="ค่าใช้จ่ายเดือนนี้" value={formatCurrency(monthlyExpenseTotal)} sub="รายจ่ายที่อนุมัติแล้ว" accentColor="red" />
          <KpiCard label="จำนวนนักศึกษา" value={studentCount ?? 0} sub="ทั้งหมดในระบบ" accentColor="brand" />
        </div>

        {/* KPI Grid — Row 2: Tier + Credit + Reserve */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tier Distribution */}
          <div className="bg-white border border-border rounded-2xl p-5 card-shadow hover-lift">
            <div className="text-[9.5px] uppercase tracking-[0.2em] font-black text-text-muted mb-4">สัดส่วน Tier นักศึกษา</div>
            <div className="flex items-end gap-3 mb-4" style={{ height: '56px' }}>
              {[
                { label: 'A', count: tierBreakdown.A, gradient: 'from-emerald-500 to-teal-400', text: 'text-emerald-700' },
                { label: 'B', count: tierBreakdown.B, gradient: 'from-slate-400 to-slate-300', text: 'text-slate-600' },
                { label: 'C', count: tierBreakdown.C, gradient: 'from-amber-500 to-amber-300', text: 'text-amber-700' },
              ].map((t) => (
                <div key={t.label} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className={`text-[10px] font-black ${t.text}`}>{t.count}</span>
                  <div
                    className={`w-full rounded-t-lg bg-gradient-to-t ${t.gradient} bar-grow`}
                    style={{ height: `${Math.max((t.count / Math.max(studentCount ?? 1, 1)) * 44, 4)}px` }}
                  />
                  <span className={`text-[9px] font-black ${t.text}`}>{t.label}</span>
                </div>
              ))}
            </div>
            <Link href="/admin/students" className="text-[10.5px] text-brand hover:text-brand-hover font-bold transition-colors">ดูรายชื่อทั้งหมด →</Link>
          </div>

          {/* Credit Debt */}
          <div className="bg-white border border-border rounded-2xl p-5 card-shadow hover-lift">
            <div className="text-[9.5px] uppercase tracking-[0.2em] font-black text-text-muted mb-3">ยอด Credit ค้างจ่าย</div>
            <div className={`text-[24px] font-black tracking-tight leading-none mb-1 ${pendingCreditsCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {formatCurrency(creditDebtTotal)}
            </div>
            <div className="text-[10.5px] text-text-muted mt-2">
              {pendingCreditsCount > 0
                ? `${pendingCreditsCount} รายการค้างจ่าย`
                : '✓ ไม่มียอดค้าง'}
            </div>
            <Link href="/admin/credits" className="text-[10.5px] text-brand hover:text-brand-hover font-bold transition-colors mt-3 inline-block">จัดการ Credit →</Link>
          </div>

          {/* Reserve Fund */}
          <div className="bg-white border border-border rounded-2xl p-5 card-shadow hover-lift">
            <div className="text-[9.5px] uppercase tracking-[0.2em] font-black text-text-muted mb-3">กองทุนสำรอง (สะสม)</div>
            <div className="text-[24px] font-black text-text-primary tracking-tight leading-none mb-1">
              ฿{reserveTarget.toLocaleString()}
            </div>
            <div className="text-[10.5px] text-text-muted mt-2">หักออกจากเงินกองกลางโดยตรง</div>
            <Link href="/admin/settings" className="text-[10.5px] text-brand hover:text-brand-hover font-bold transition-colors mt-3 inline-block">ตั้งค่าเป้าหมาย →</Link>
          </div>
        </div>

        {/* Middle Section (Charts & Activities) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Payment Rate Chart */}
          <div className="bg-white border border-border rounded-2xl p-5 card-shadow">
            <div className="text-[12px] font-black text-text-primary mb-0.5">การชำระเงินแยกตามชั้นปี</div>
            <div className="text-[9.5px] text-text-muted mb-4">{activeSemester?.name ?? '—'} (รวม 5 งวดล่าสุด)</div>
            <PaymentRateChart data={tierPaymentData} />
          </div>

          {/* Expected vs Actual Chart */}
          <div className="bg-white border border-border rounded-2xl p-5 card-shadow">
            <div className="text-[12px] font-black text-text-primary mb-0.5">ยอดคาดหวัง vs รับจริง</div>
            <div className="text-[9.5px] text-text-muted mb-4">{activeSemester?.name ?? '—'} (5 งวดล่าสุด)</div>
            <ExpectedVsActualChart data={expectedActualData} />
          </div>

          {/* Activity */}
          <div className="bg-white border border-border rounded-2xl p-5 card-shadow">
            <div className="text-[12px] font-black text-text-primary mb-4">กิจกรรมล่าสุด</div>
            <ActivityFeed activities={activities.slice(0, 8)} />
          </div>
        </div>

        {/* Chart Row: Expense Donut + Cash Flow */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Expense Breakdown Donut */}
          <div className="bg-white border border-border rounded-2xl p-5 card-shadow">
            <div className="text-[12.5px] font-black text-text-primary mb-0.5">สัดส่วนรายจ่ายตามหมวดหมู่</div>
            <div className="text-[9.5px] text-text-muted mb-4">ค่าใช้จ่ายทั้งหมดที่อนุมัติแล้ว · รวม {formatCurrency(expenseTotalAll)}</div>
            <ExpenseDonutChart data={categoryTotals} totalAmount={expenseTotalAll} />
          </div>

          {/* Cash Flow Trend */}
          <div className="bg-white border border-border rounded-2xl p-5 card-shadow">
            <div className="text-[12.5px] font-black text-text-primary mb-0.5">กระแสเงินสด 6 เดือนล่าสุด</div>
            <div className="text-[9.5px] text-text-muted mb-4">รายรับ · รายจ่าย · ยอดคงเหลือ (บาท)</div>
            <CashFlowTrendChart data={monthlyTrend} />
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NotificationTrigger />
          {[
            { label: 'เพิ่มค่าใช้จ่าย', desc: 'บันทึกรายจ่ายสาขา', icon: Plus, href: '/admin/expenses', accentFrom: '#3d52d5', accentTo: '#7c94f8' },
            { label: 'ส่งออกรายงาน', desc: 'Excel รายงานทางการเงิน', icon: Download, href: '/api/reports/export?type=income', accentFrom: '#0a8f5a', accentTo: '#0fad6e' },
          ].map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="group relative bg-white border border-border rounded-2xl p-5 flex items-center gap-4 hover-lift card-shadow overflow-hidden"
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform text-white"
                style={{ background: `linear-gradient(135deg, ${a.accentFrom}, ${a.accentTo})` }}>
                <a.icon className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[12.5px] font-black text-text-primary">{a.label}</div>
                <div className="text-[10.5px] text-text-muted mt-0.5">{a.desc}</div>
              </div>
            </Link>
          ))}
        </div>

          {/* Pending Payments Table */}
          <div className="bg-white border border-border rounded-2xl overflow-hidden card-shadow">
            <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-[12.5px] font-black text-text-primary">รายการรอตรวจสอบ</span>
                {(pendingCount ?? 0) > 0 && (
                  <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] font-black px-2 py-0.5 rounded-full">{pendingCount}</span>
                )}
              </div>
              <Link href="/admin/payments" className="text-[10.5px] text-text-muted hover:text-brand font-semibold transition-colors">ดูทั้งหมด →</Link>
            </div>
            {pendingPayments && pendingPayments.length > 0 ? (
              <div className="divide-y divide-border/50">
                {pendingPayments.map((p) => {
                  const user = p.user as { fullname: string; student_id: string } | null
                  return (
                    <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-background-muted/50 transition-colors">
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-white text-[10px] font-black"
                        style={{ background: 'linear-gradient(135deg, #3d52d5, #7c94f8)' }}>
                        {user?.fullname?.[0] ?? 'U'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11.5px] font-semibold text-text-primary truncate">{user?.fullname}</div>
                        <div className="text-[10px] text-text-muted mt-0.5">{user?.student_id} · {p.period?.label || '—'}</div>
                      </div>
                      <div className="text-[12px] font-black text-text-primary tabular-nums">{formatCurrency(p.amount)}</div>
                      <div className="flex items-center gap-1">
                        <QuickApproveButton paymentId={p.id} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-10 text-center text-[12px] text-text-muted font-medium">✓ ไม่มีรายการรอตรวจสอบ</div>
            )}
          </div>
      </div>
    </div>
  )
}
