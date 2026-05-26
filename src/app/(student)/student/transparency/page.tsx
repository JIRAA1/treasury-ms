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

  const { data: profile } = await adminClient
    .from('users')
    .select('id')
    .or(`id.eq.${authUser.id},student_id.eq.${authUser.user_metadata.student_id}`)
    .maybeSingle()

  if (!profile) redirect('/bind')

  const { data: payments } = await adminClient
    .from('payments')
    .select('amount, status, week')
    .eq('status', 'approved')

  const { data: expenses } = await adminClient
    .from('expenses')
    .select('*')
    .not('approved_by', 'is', null)
    .order('created_at', { ascending: false })

  const { count: studentCount } = await adminClient
    .from('users')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'student')

  const { data: settings } = await adminClient
    .from('week_settings')
    .select('*')
    .order('week', { ascending: true })

  const totalIncome = payments?.reduce((s, p) => s + p.amount, 0) || 0
  const totalExpense = expenses?.reduce((s, e) => s + e.amount, 0) || 0
  const balance = totalIncome - totalExpense

  const cycleData = settings?.map((s) => {
    const cyclePayments = payments?.filter((p) => p.week === s.week) || []
    return {
      week: s.week,
      title: s.title || `งวดที่ ${s.week}`,
      collected: cyclePayments.reduce((sum, p) => sum + p.amount, 0),
      paidCount: cyclePayments.length,
    }
  }) || []

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
            <div className="text-white/70 text-[13px] font-medium mb-1">ยอดเงินคงเหลือในกองกลาง</div>
            <div className="text-[42px] font-bold tracking-tight leading-none mb-6 text-white">
              {formatCurrency(balance)}
            </div>
            <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-6">
              <div>
                <div className="text-white/50 text-[11px] uppercase tracking-wider font-bold mb-1">รายรับทั้งหมด</div>
                <div className="text-[18px] font-bold text-emerald-400">+{formatCurrency(totalIncome)}</div>
              </div>
              <div>
                <div className="text-white/50 text-[11px] uppercase tracking-wider font-bold mb-1">รายจ่ายทั้งหมด</div>
                <div className="text-[18px] font-bold text-red-400">-{formatCurrency(totalExpense)}</div>
              </div>
            </div>
          </div>
          <TrendingUp className="absolute -right-8 -bottom-8 w-48 h-48 text-white/5 rotate-12" />
        </div>

        {/* Income by Cycle */}
        <div className="bg-background-secondary border border-border rounded-[2rem] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-background-tertiary/50 flex justify-between items-center">
            <h2 className="font-bold text-text-primary text-[15px]">รายละเอียดรายรับตามงวด</h2>
            <div className="text-[12px] text-text-muted">รวม: {formatCurrency(totalIncome)}</div>
          </div>
          <div className="divide-y divide-border">
            {cycleData.map((c) => (
              <div key={c.week} className="px-6 py-4 flex items-center justify-between hover:bg-background-tertiary/30 transition-colors">
                <div>
                  <div className="text-[13.5px] font-bold text-text-primary">{c.title}</div>
                  <div className="text-[11.5px] text-text-muted mt-0.5">ผู้ชำระแล้ว {c.paidCount} จาก {studentCount || 0} คน</div>
                </div>
                <div className="text-right">
                  <div className="text-[14px] font-bold text-text-primary">{formatCurrency(c.collected)}</div>
                  <div className="w-24 h-1 bg-border rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${(c.paidCount / (studentCount || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
            {cycleData.length === 0 && (
              <div className="p-12 text-center text-text-muted italic">ยังไม่มีข้อมูลรายรับ</div>
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
