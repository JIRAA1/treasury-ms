import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Topbar from '@/components/layout/Topbar'
import KpiCard from '@/components/shared/KpiCard'
import { formatCurrency, cn } from '@/lib/utils'
import { FileText, Download, Users, CreditCard, ArrowRight, TrendingUp, Receipt } from 'lucide-react'
import Link from 'next/link'

export const metadata = { title: 'รายงาน — TreasuryMS' }

export default async function AdminReportsPage() {
  const adminClient = createAdminClient()

  const { data: students } = await adminClient.from('users').select('id, fullname, student_id').eq('role', 'student')
  const { data: payments } = await adminClient.from('payments').select('*')
  const { data: expenses } = await adminClient.from('expenses').select('*')
  const { data: incomes } = await adminClient.from('incomes').select('*')
  const { data: settings } = await adminClient.from('week_settings').select('*').order('week', { ascending: true })

  const totalPayments = payments?.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0) || 0
  const totalOtherIncomes = incomes?.filter(i => i.approved_by).reduce((s, i) => s + i.amount, 0) || 0
  const totalIncome = totalPayments + totalOtherIncomes
  const totalExpense = expenses?.filter(e => e.approved_by).reduce((s, e) => s + e.amount, 0) || 0
  const balance = totalIncome - totalExpense

  const cycleData = settings?.map((s) => {
    const cyclePayments = payments?.filter(p => p.week === s.week && p.status === 'approved') || []
    const collected = cyclePayments.reduce((sum, p) => sum + p.amount, 0)
    const paidCount = cyclePayments.length
    return { ...s, collected, paidCount }
  }) || []

  const approvedOtherIncomes = incomes?.filter(i => i.approved_by).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || []
  const approvedExpenses = expenses?.filter(e => e.approved_by).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) || []

  return (
    <div>
      <Topbar 
        title="รายงานการเงิน" 
        subtitle="สรุปรายรับ-รายจ่าย และภาพรวมทั้งหมด"
        actions={
          <div className="flex gap-2">
            <a href="/api/reports/export?type=income" className="flex items-center gap-1.5 border border-border-strong bg-background text-[12.5px] font-medium px-3 py-1.5 rounded-lg hover:bg-background-secondary transition-colors">
              <Download className="w-3.5 h-3.5" />
              ส่งออกรายรับ
            </a>
            <a href="/api/reports/export?type=students" className="flex items-center gap-1.5 border border-border-strong bg-background text-[12.5px] font-medium px-3 py-1.5 rounded-lg hover:bg-background-secondary transition-colors">
              <Download className="w-3.5 h-3.5" />
              สรุปรายคน
            </a>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-4">
          <KpiCard label="รายรับทั้งหมด" value={formatCurrency(totalIncome)} sub={`จากนักเรียน: ${formatCurrency(totalPayments)} · แหล่งอื่น: ${formatCurrency(totalOtherIncomes)}`} subVariant="positive" />
          <KpiCard label="รายจ่ายทั้งหมด" value={formatCurrency(totalExpense)} sub="ยอดที่จ่ายออกจริง" subVariant="danger" />
          <KpiCard label="ยอดคงเหลือ" value={formatCurrency(balance)} sub={balance >= 0 ? 'งบประมาณปัจจุบัน' : 'งบประมาณติดลบ'} subVariant={balance >= 0 ? 'positive' : 'danger'} />
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Cycle Summary */}
          <div className="bg-background-secondary border border-border rounded-xl p-5">
            <div className="text-[14px] font-bold text-text-primary mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-brand" />
              สรุปตามงวดการชำระ
            </div>
            <div className="space-y-2">
              {cycleData.map((c) => (
                <div key={c.week} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
                  <div>
                    <div className="text-[13px] font-semibold text-text-primary">{c.title || `งวดที่ ${c.week}`}</div>
                    <div className="text-[11px] text-text-muted">ชำระแล้ว {c.paidCount}/{students?.length || 0} คน</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-bold text-brand">{formatCurrency(c.collected)}</div>
                    <div className="text-[11px] text-text-muted">ยอดที่กำหนด ฿{c.amount}</div>
                  </div>
                </div>
              ))}
              {cycleData.length === 0 && <div className="text-center py-8 text-text-muted italic text-[12.5px]">ยังไม่มีข้อมูลการชำระเงิน</div>}
            </div>
          </div>

          {/* Student Summary */}
          <div className="bg-background-secondary border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[14px] font-bold text-text-primary flex items-center gap-2">
                <Users className="w-4 h-4 text-brand" />
                สถานะนักศึกษา
              </div>
              <Link href="/admin/students" className="text-[11.5px] text-brand hover:underline flex items-center gap-1">
                ดูทั้งหมด <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="divide-y divide-border">
              {students?.slice(0, 8).map((s) => {
                const paidCount = payments?.filter(p => p.user_id === s.id && p.status === 'approved').length || 0
                const isFullyPaid = paidCount >= (settings?.length || 0)
                return (
                  <div key={s.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <div className="text-[12.5px] font-medium text-text-primary">{s.fullname}</div>
                      <div className="text-[10.5px] text-text-muted">{s.student_id}</div>
                    </div>
                    <div className={cn(
                      "text-[11px] font-bold px-2 py-0.5 rounded-full",
                      isFullyPaid ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {paidCount}/{settings?.length || 0} งวด
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Other Incomes and Expenses Summary List */}
        <div className="grid grid-cols-2 gap-6">
          {/* Other Incomes summary card */}
          <div className="bg-background-secondary border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[14px] font-bold text-text-primary flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                รายรับอื่น ๆ (ที่อนุมัติแล้ว)
              </div>
              <Link href="/admin/incomes" className="text-[11.5px] text-brand hover:underline flex items-center gap-1">
                จัดการรายรับ <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {approvedOtherIncomes.slice(0, 5).map((i) => (
                <div key={i.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
                  <div>
                    <div className="text-[13px] font-semibold text-text-primary">{i.title}</div>
                    <div className="text-[11px] text-text-muted">{i.source || 'ไม่ระบุแหล่งที่มา'} · {new Date(i.created_at).toLocaleDateString('th-TH')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-bold text-emerald-600">{formatCurrency(i.amount)}</div>
                  </div>
                </div>
              ))}
              {approvedOtherIncomes.length === 0 && (
                <div className="text-center py-8 text-text-muted italic text-[12.5px]">ยังไม่มีข้อมูลรายรับอื่น ๆ</div>
              )}
            </div>
          </div>

          {/* Expenses summary card */}
          <div className="bg-background-secondary border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="text-[14px] font-bold text-text-primary flex items-center gap-2">
                <Receipt className="w-4 h-4 text-red-600" />
                รายจ่ายล่าสุด (ที่อนุมัติแล้ว)
              </div>
              <Link href="/admin/expenses" className="text-[11.5px] text-brand hover:underline flex items-center gap-1">
                จัดการรายจ่าย <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {approvedExpenses.slice(0, 5).map((e) => (
                <div key={e.id} className="flex items-center justify-between p-3 bg-background border border-border rounded-lg">
                  <div>
                    <div className="text-[13px] font-semibold text-text-primary">{e.title}</div>
                    <div className="text-[11px] text-text-muted">{new Date(e.created_at).toLocaleDateString('th-TH')}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-bold text-red-600">{formatCurrency(e.amount)}</div>
                  </div>
                </div>
              ))}
              {approvedExpenses.length === 0 && (
                <div className="text-center py-8 text-text-muted italic text-[12.5px]">ยังไม่มีข้อมูลรายจ่าย</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


