import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/layout/Topbar'
import KpiCard from '@/components/shared/KpiCard'
import ActivityFeed from '@/components/shared/ActivityFeed'
import { formatCurrency, formatDate, getWeekLabel } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'
import Link from 'next/link'
import { Plus, Download } from 'lucide-react'
import type { Activity } from '@/components/shared/ActivityFeed'
import NotificationTrigger from '@/components/admin/NotificationTrigger'
import QuickApproveButton from '@/components/admin/QuickApproveButton'

export const metadata = { title: 'ภาพรวม — TreasuryMS Admin' }

export default async function AdminOverviewPage() {
  const supabase = await createClient()

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
    supabase.from('payments').select('*, user:user_id(fullname, student_id)').eq('status', 'pending').order('created_at').limit(8),
    supabase.rpc('get_treasury_balance'),
    supabase.from('payments').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('audit_logs').select('*, actor:actor_id(fullname)').order('created_at', { ascending: false }).limit(10),
    supabase.from('expenses').select('amount').not('approved_by', 'is', null)
      .gte('created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from('users').select('*', { count: 'exact', head: true }).eq('role', 'student'),
    supabase.from('users').select('tier').eq('role', 'student'),
    supabase.from('payment_credits').select('amount').eq('status', 'pending'),
    supabase.from('system_settings').select('key, value').in('key', ['reserve_fund_monthly_target', 'tier_c_max_quota']),
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

  // Weekly chart data (last 5 weeks) — dynamic from week_settings
  const { data: latestWeekSetting } = await supabase
    .from('week_settings')
    .select('week')
    .order('week', { ascending: false })
    .limit(1)
    .maybeSingle()
  const currentWeek = latestWeekSetting?.week ?? 1
  const weeklyRates = await Promise.all(
    [currentWeek - 4, currentWeek - 3, currentWeek - 2, currentWeek - 1, currentWeek].map(async (w) => {
      if (w < 1) return { week: w, rate: 0 }
      const { data } = await supabase.rpc('get_week_collection_rate', { target_week: w })
      return { week: w, rate: data ?? 0 }
    })
  )

  const monthlyExpenseTotal = (monthExpenses ?? []).reduce((s, e) => s + e.amount, 0)

  // Map audit logs to Activity feed format
  const activities: Activity[] = (auditLogs ?? []).map((log) => {
    const actorName = (log.actor as { fullname: string } | null)?.fullname ?? 'ระบบ'
    const actionMap: Record<string, { type: Activity['type']; title: string }> = {
      payment_approved: { type: 'approved', title: `${actorName} อนุมัติการชำระเงิน` },
      payment_rejected: { type: 'rejected', title: `${actorName} ปฏิเสธสลิป` },
      payment_uploaded: { type: 'uploaded', title: `อัปโหลดสลิปใหม่` },
      expense_created: { type: 'expense', title: `${actorName} เพิ่มค่าใช้จ่าย` },
      expense_approved: { type: 'approved', title: `${actorName} อนุมัติค่าใช้จ่าย` },
      income_created: { type: 'uploaded', title: `${actorName} เพิ่มรายรับใหม่` },
      income_approved: { type: 'approved', title: `${actorName} อนุมัติรายรับใหม่` },
      notification_sent: { type: 'notification', title: `${actorName} ส่งแจ้งเตือน` },
      tier_changed: { type: 'uploaded', title: `${actorName} เปลี่ยน Tier นักศึกษา` },
      credit_created: { type: 'expense', title: `${actorName} บันทึก Credit ค้างจ่าย` },
      credit_repaid: { type: 'approved', title: `${actorName} บันทึก Credit จ่ายคืน` },
      credit_forgiven: { type: 'approved', title: `${actorName} ยกให้ Credit` },
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
            <Link href="/admin/expenses" className="flex items-center gap-1.5 border border-border-strong bg-background text-[12.5px] font-medium px-3 py-1.5 rounded-lg hover:bg-background-secondary transition-colors">
              <Plus className="w-3.5 h-3.5" /> เพิ่มค่าใช้จ่าย
            </Link>
            <a href="/api/reports/export?type=income" className="flex items-center gap-1.5 border border-border-strong bg-background text-[12.5px] font-medium px-3 py-1.5 rounded-lg hover:bg-background-secondary transition-colors">
              <Download className="w-3.5 h-3.5" /> ส่งออกรายงาน
            </a>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Grid — Row 1 */}
        <div className="grid grid-cols-4 gap-4">
          <KpiCard label="ยอดคงเหลือ" value={formatCurrency(balance ?? 0)} sub="คำนวณจากรายรับ - รายจ่าย" />
          <KpiCard
            label="รอตรวจสอบ"
            value={pendingCount ?? 0}
            sub={(pendingCount ?? 0) > 0 ? 'รอการอนุมัติ' : 'ไม่มีรายการค้าง'}
            subVariant={(pendingCount ?? 0) > 0 ? 'warning' : 'neutral'}
          />
          <KpiCard label="ค่าใช้จ่ายเดือนนี้" value={formatCurrency(monthlyExpenseTotal)} sub="รายจ่ายที่อนุมัติแล้ว" />
          <KpiCard label="จำนวนนักศึกษา" value={studentCount ?? 0} sub="ทั้งหมดในระบบ" />
        </div>

        {/* KPI Grid — Row 2: Tier + Credit + Reserve */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tier Distribution */}
          <div className="bg-background-secondary border border-border rounded-xl p-5">
            <div className="text-[11px] uppercase tracking-wide text-text-muted mb-3">สัดส่วน Tier นักศึกษา</div>
            <div className="flex items-end gap-2 mb-3">
              {[
                { label: 'A', count: tierBreakdown.A, color: 'bg-emerald-400', text: 'text-emerald-700' },
                { label: 'B', count: tierBreakdown.B, color: 'bg-slate-400', text: 'text-slate-600' },
                { label: 'C', count: tierBreakdown.C, color: 'bg-amber-400', text: 'text-amber-700' },
              ].map((t) => (
                <div key={t.label} className="flex-1 flex flex-col items-center gap-1">
                  <span className={`text-[11px] font-black ${t.text}`}>{t.count}</span>
                  <div
                    className={`w-full rounded-t-sm ${t.color} transition-all`}
                    style={{ height: `${Math.max((t.count / Math.max(studentCount ?? 1, 1)) * 48, 4)}px` }}
                  />
                  <span className={`text-[10px] font-black ${t.text}`}>{t.label}</span>
                </div>
              ))}
            </div>
            <Link href="/admin/students" className="text-[11px] text-brand hover:underline">ดูรายชื่อ →</Link>
          </div>

          {/* Credit Debt */}
          <div className={`border rounded-xl p-5 ${pendingCreditsCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-background-secondary border-border'}`}>
            <div className="text-[11px] uppercase tracking-wide text-text-muted mb-1">ยอด Credit ค้างจ่าย</div>
            <div className={`text-[26px] font-bold tracking-tight ${pendingCreditsCount > 0 ? 'text-amber-700' : 'text-text-primary'}`}>
              {formatCurrency(creditDebtTotal)}
            </div>
            <div className="text-[11px] text-text-muted mt-1">
              {pendingCreditsCount > 0
                ? `${pendingCreditsCount} รายการค้างจ่าย`
                : 'ไม่มียอดค้าง ✓'}
            </div>
            <Link href="/admin/credits" className="text-[11px] text-brand hover:underline mt-2 inline-block">จัดการ Credit →</Link>
          </div>

          {/* Reserve Fund placeholder */}
          <div className="bg-background-secondary border border-border rounded-xl p-5">
            <div className="text-[11px] uppercase tracking-wide text-text-muted mb-1">กองทุนสำรองเป้าหมาย</div>
            <div className="text-[26px] font-bold text-text-primary tracking-tight">
              ฿{reserveTarget.toLocaleString()}
            </div>
            <div className="text-[11px] text-text-muted mt-1">บันทึกผ่านรายรับประเภทพิเศษ</div>
            <Link href="/admin/incomes" className="text-[11px] text-brand hover:underline mt-2 inline-block">บันทึกกองทุน →</Link>
          </div>
        </div>

        {/* Middle Section */}
        <div className="grid gap-4" style={{ gridTemplateColumns: '3fr 2fr' }}>
          {/* Pending Payments Table */}
          <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-[13.5px] font-semibold text-text-primary">รายการรอตรวจสอบ</span>
                {(pendingCount ?? 0) > 0 && (
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-semibold px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                )}
              </div>
              <Link href="/admin/payments" className="text-[12px] text-text-muted hover:text-text-primary transition-colors">ดูทั้งหมด →</Link>
            </div>
            {pendingPayments && pendingPayments.length > 0 ? (
              <div className="divide-y divide-border">
                {pendingPayments.map((p) => {
                  const user = p.user as { fullname: string; student_id: string } | null
                  return (
                    <div key={p.id} className="flex items-center gap-4 px-5 py-3">
                      <div className="w-7 h-7 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                        <span className="text-white text-[10px] font-semibold">
                          {user?.fullname?.[0] ?? 'U'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12.5px] font-medium text-text-primary truncate">{user?.fullname}</div>
                        <div className="text-[11px] text-text-muted">{user?.student_id} · {getWeekLabel(p.week)}</div>
                      </div>
                      <div className="text-[12.5px] font-semibold text-text-primary">{formatCurrency(p.amount)}</div>
                      <div className="flex items-center gap-1">
                        <QuickApproveButton paymentId={p.id} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-[13px] text-text-muted">ไม่มีรายการรอตรวจสอบ ✓</div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Balance Card */}
            <div className="bg-background-secondary border border-border rounded-xl p-5">
              <div className="text-[11px] uppercase tracking-wide text-text-muted mb-2">ยอดคงเหลือคลัง</div>
              <div className="text-[26px] font-bold text-text-primary tracking-tight">{formatCurrency(balance ?? 0)}</div>
            </div>

            {/* Weekly Chart */}
            <div className="bg-background-secondary border border-border rounded-xl p-5">
              <div className="text-[13px] font-semibold text-text-primary mb-4">อัตราการชำระ 5 สัปดาห์ล่าสุด</div>
              <div className="flex items-end gap-2 h-16">
                {weeklyRates.map((w, i) => (
                  <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full relative">
                      <div
                        className={`w-full rounded-t-sm transition-all ${i === weeklyRates.length - 1 ? 'bg-brand' : 'bg-background-muted'}`}
                        style={{ height: `${Math.max((w.rate / 100) * 56, 4)}px` }}
                      />
                    </div>
                    <div className="text-[9.5px] text-text-muted">W{w.week}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity */}
            <div className="bg-background-secondary border border-border rounded-xl p-5">
              <div className="text-[13px] font-semibold text-text-primary mb-3">กิจกรรมล่าสุด</div>
              <ActivityFeed activities={activities.slice(0, 6)} />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          <NotificationTrigger />
          {[
            { label: 'เพิ่มค่าใช้จ่าย', desc: 'บันทึกรายจ่ายสาขา', icon: Plus, href: '/admin/expenses' },
            { label: 'ส่งออกรายงาน', desc: 'Excel รายงานทางการเงิน', icon: Download, href: '/api/reports/export?type=income' },
          ].map((a) => (
            <Link
              key={a.label}
              href={a.href}
              className="bg-background-secondary border border-border rounded-xl p-4 flex items-center gap-3 hover:border-brand/40 hover:bg-background-tertiary transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-background-tertiary flex items-center justify-center flex-shrink-0">
                <a.icon className="w-4 h-4 text-text-secondary" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-text-primary">{a.label}</div>
                <div className="text-[11.5px] text-text-muted">{a.desc}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
