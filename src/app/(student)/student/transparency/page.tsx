import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Topbar from '@/components/layout/Topbar'
import { formatCurrency } from '@/lib/utils'
import { FileText, ShieldCheck, TrendingUp } from 'lucide-react'

// Force the page to always fetch fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = { title: 'ความโปร่งใสทางการเงิน — TreasuryMS' }

export default async function TransparencyPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const adminClient = createAdminClient()

  const studentId = authUser.user_metadata?.student_id || 'UNKNOWN'

  const { data: profile } = await adminClient
    .from('users')
    .select('id')
    .or(`id.eq.${authUser.id},student_id.eq.${studentId}`)
    .maybeSingle()

  if (!profile) redirect('/bind')

  const { data: activeSemester } = await adminClient
    .from('semesters')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  const activeSemesterId = activeSemester?.id || '00000000-0000-0000-0000-000000000000'

  const [
    { data: periods },
    { data: sysSettings }
  ] = await Promise.all([
    adminClient
      .from('periods')
      .select('*')
      .eq('semester_id', activeSemesterId)
      .order('period_order', { ascending: true }),
    adminClient.from('system_settings').select('*')
  ])

  const periodIds = (periods ?? []).map((p) => p.id)

  const { data: payments } = await adminClient
    .from('payments')
    .select('amount, status, period_id')
    .eq('status', 'approved')
    .in('period_id', periodIds.length > 0 ? periodIds : ['00000000-0000-0000-0000-000000000000'])

  const { data: incomes } = await adminClient
    .from('incomes')
    .select('*')
    .not('approved_by', 'is', null)
    .order('created_at', { ascending: false })

  const { data: expenses } = await adminClient
    .from('expenses')
    .select('*')
    .not('approved_by', 'is', null)
    .order('created_at', { ascending: false })

  const { count: studentCount } = await adminClient
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')

  const totalStudentIncome = payments?.reduce((s, p) => s + p.amount, 0) || 0
  const totalOtherIncome = incomes?.reduce((s, i) => s + i.amount, 0) || 0
  const totalIncome = totalStudentIncome + totalOtherIncome
  const totalExpense = expenses?.reduce((s, e) => s + e.amount, 0) || 0
  const balance = totalIncome - totalExpense

  const reserveTarget = parseInt(sysSettings?.find((s: any) => s.key === 'reserve_fund_monthly_target')?.value ?? '200', 10)
  const availableBalance = balance - reserveTarget

  const cycleData = (periods ?? []).map((p) => {
    const cyclePayments = payments?.filter((pay) => pay.period_id === p.id) || []
    return {
      id: p.id,
      title: p.label || `งวดที่ ${p.period_order}`,
      collected: cyclePayments.reduce((sum, pay) => sum + pay.amount, 0),
      paidCount: cyclePayments.length,
    }
  })

  return (
    <div>
      <Topbar title="ความโปร่งใส" subtitle="รายงานการเงินสาขา — ข้อมูล Real-time" />

      <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-8 pb-12">
        {/* Badge */}
        <div className="flex items-center gap-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-[12px] font-bold border border-emerald-100">
            <ShieldCheck className="w-3.5 h-3.5" />
            ระบบตรวจสอบความโปร่งใส
          </div>
        </div>

        {/* Summary Card */}
        <div className="relative group overflow-hidden rounded-[2rem] bg-text-primary shadow-2xl shadow-black/10">
          <div className="relative z-10 bg-text-primary m-[1px] rounded-[1.9rem] p-6 md:p-10">
            <div className="text-white/70 text-[13px] font-medium mb-1 font-bold">ยอดเงินคงเหลือ (หักเงินสำรองแล้ว)</div>
            <div className="text-[38px] md:text-[42px] font-bold tracking-tight leading-none mb-6 text-white">
              {formatCurrency(availableBalance)}
            </div>
            <div className="grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
              <div>
                <div className="text-white/50 text-[10px] uppercase tracking-wider font-bold mb-1">รายรับทั้งหมด</div>
                <div className="text-[14px] md:text-[16px] font-bold text-emerald-400">+{formatCurrency(totalIncome)}</div>
              </div>
              <div>
                <div className="text-white/50 text-[10px] uppercase tracking-wider font-bold mb-1">รายจ่ายทั้งหมด</div>
                <div className="text-[14px] md:text-[16px] font-bold text-red-400">-{formatCurrency(totalExpense)}</div>
              </div>
              <div>
                <div className="text-white/50 text-[10px] uppercase tracking-wider font-bold mb-1">เงินสำรอง</div>
                <div className="text-[14px] md:text-[16px] font-bold text-amber-400">{formatCurrency(reserveTarget)}</div>
              </div>
            </div>
          </div>
          <TrendingUp className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5 rotate-12" />
        </div>

        {/* Income by Cycle */}
        <div className="bg-background-secondary border border-border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-background-tertiary/50 flex justify-between items-center">
            <h2 className="font-bold text-text-primary text-[15px]">รายรับจากนักศึกษา (ตามงวด)</h2>
            <div className="text-[12px] text-text-muted">รวม: {formatCurrency(totalStudentIncome)}</div>
          </div>
          <div className="divide-y divide-border">
              {cycleData.map((c) => {
                const rate = studentCount ? Math.round((c.paidCount / studentCount) * 100) : 0
                const barColor = rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-400' : 'bg-red-400'
                return (
                <div key={c.id} className="px-6 py-4 flex items-center justify-between hover:bg-background-tertiary/30 transition-colors">
                  <div>
                    <div className="text-[13.5px] font-bold text-text-primary">{c.title}</div>
                    <div className="text-[11.5px] text-text-muted mt-0.5">ผู้ชำระแล้ว {c.paidCount} จาก {studentCount || 0} คน</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[14px] font-bold text-text-primary">{formatCurrency(c.collected)}</div>
                    <div className="flex items-center gap-2 mt-1.5 justify-end">
                      <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} transition-all`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className={`text-[11px] font-bold tabular-nums ${rate >= 80 ? 'text-emerald-600' : rate >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                        {rate}%
                      </span>
                    </div>
                  </div>
                </div>
                )
              })}
            {cycleData.length === 0 && (
              <div className="p-12 text-center text-text-muted italic">ยังไม่มีข้อมูลรายรับ</div>
            )}
          </div>
        </div>

        {/* Other Incomes */}
        <div className="bg-background-secondary border border-border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-background-tertiary/50 flex justify-between items-center">
            <h2 className="font-bold text-text-primary text-[15px]">รายรับอื่นๆ (เงินสนับสนุน/กิจกรรม)</h2>
            <div className="text-[12px] text-text-muted">รวม: {formatCurrency(totalOtherIncome)}</div>
          </div>
          <div className="divide-y divide-border">
            {incomes?.map((i) => (
              <div key={i.id} className="px-6 py-5 hover:bg-background-tertiary/30 transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <div className="font-bold text-text-primary text-[14px]">{i.title}</div>
                    <div className="text-[11px] text-text-muted uppercase tracking-wider font-medium mt-0.5">ที่มา: {i.source || 'ไม่ระบุ'}</div>
                  </div>
                  <div className="font-bold text-emerald-600 text-[14px]">+{formatCurrency(i.amount)}</div>
                </div>
                {i.description && <div className="text-[12.5px] text-text-muted mb-2 leading-relaxed">{i.description}</div>}
                <div className="text-[11px] text-text-disabled font-medium">
                  {new Date(i.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            ))}
            {incomes?.length === 0 && (
              <div className="p-12 text-center text-text-muted italic">ยังไม่มีรายรับอื่นๆ</div>
            )}
          </div>
        </div>

        {/* Expenses List */}
        <div className="bg-background-secondary border border-border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-background-tertiary/50 flex justify-between items-center">
            <h2 className="font-bold text-text-primary text-[15px]">รายการค่าใช้จ่าย</h2>
            <div className="text-[12px] text-text-muted">รวม: {formatCurrency(totalExpense)}</div>
          </div>
          <div className="divide-y divide-border">
            {expenses?.map((e) => (
              <div key={e.id} className="px-6 py-5 hover:bg-background-tertiary/30 transition-colors">
                <div className="flex justify-between items-start mb-1">
                  <div className="font-bold text-text-primary text-[14px]">{e.title}</div>
                  <div className="font-bold text-red-600 text-[14px]">-{formatCurrency(e.amount)}</div>
                </div>
                {e.description && <div className="text-[12.5px] text-text-muted mb-3 leading-relaxed">{e.description}</div>}
                <div className="flex items-center gap-4 text-[11px] text-text-disabled font-medium uppercase tracking-wider">
                  <span>{new Date(e.created_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                  {e.receipt_url && (
                    <a href={e.receipt_url} target="_blank" rel="noreferrer" className="text-brand hover:underline flex items-center gap-1">
                      <FileText className="w-3 h-3" /> ดูใบเสร็จ
                    </a>
                  )}
                </div>
              </div>
            ))}
            {expenses?.length === 0 && (
              <div className="p-12 text-center text-text-muted italic">ยังไม่มีรายการค่าใช้จ่าย</div>
            )}
          </div>
        </div>

        <div className="text-center pt-4 pb-4">
          <p className="text-[12.5px] text-text-muted leading-relaxed">
            ระบบจัดทำขึ้นเพื่อความโปร่งใสในพรรคนักศึกษา <br />
            หากมีข้อสงสัยประการใด กรุณาติดต่อเหรัญญิกสาขา
          </p>
        </div>
      </div>
    </div>
  )
}
