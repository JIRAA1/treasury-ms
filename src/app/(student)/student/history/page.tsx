import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Topbar from '@/components/layout/Topbar'
import PaymentRow from '@/components/payments/PaymentRow'
import EmptyState from '@/components/shared/EmptyState'
import { formatCurrency } from '@/lib/utils'
import { FileText } from 'lucide-react'

// Force fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = { title: 'ประวัติการชำระ — TreasuryMS' }

export default async function HistoryPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const adminClient = createAdminClient()
  
  // Robust profile lookup to get the correct database ID
  const { data: profile } = await adminClient
    .from('users')
    .select('id')
    .or(`id.eq.${authUser.id},student_id.eq.${authUser.user_metadata.student_id}`)
    .maybeSingle()

  if (!profile) redirect('/bind')

  const { data: payments } = await adminClient
    .from('payments')
    .select('*')
    .eq('user_id', profile.id)
    .order('week', { ascending: false })

  const totalApproved = (payments?.filter((p) => p.status === 'approved') ?? []).reduce((s, p) => s + p.amount, 0)

  return (
    <div>
      <Topbar title="ประวัติการชำระเงิน" subtitle={`ทั้งหมด ${payments?.length ?? 0} รายการ`} />

      <div className="p-6 max-w-2xl">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'ชำระแล้ว', value: payments?.filter((p) => p.status === 'approved').length ?? 0, color: 'text-emerald-600' },
            { label: 'รอตรวจสอบ', value: payments?.filter((p) => p.status === 'pending').length ?? 0, color: 'text-amber-600' },
            { label: 'ถูกปฏิเสธ', value: payments?.filter((p) => p.status === 'rejected').length ?? 0, color: 'text-red-500' },
          ].map((s) => (
            <div key={s.label} className="bg-background-secondary border border-border rounded-xl p-4 text-center shadow-sm">
              <div className={`text-[20px] font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[11px] text-text-muted mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-background-secondary border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-background-tertiary/20">
            <div className="text-[13px] font-semibold text-text-primary uppercase tracking-tight">รายการทั้งหมด</div>
            <div className="text-[12px] text-text-muted font-medium">รวมที่ชำระ: <span className="font-bold text-emerald-600">{formatCurrency(totalApproved)}</span></div>
          </div>

          {payments && payments.length > 0 ? (
            <div className="divide-y divide-border">
              {/* Header */}
              <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted bg-background-tertiary/50">
                <div className="w-10">งวดที่</div>
                <div className="flex-1">วันที่ทำรายการ</div>
                <div className="w-20 text-right">จำนวนเงิน</div>
                <div className="w-24 text-right">สถานะ</div>
              </div>
              {payments.map((p) => (
                <div key={p.id} className="flex items-center gap-4 px-5 py-0.5 hover:bg-background-tertiary/20 transition-colors">
                  <PaymentRow payment={p} className="flex-1" />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12">
              <EmptyState icon={FileText} title="ยังไม่มีประวัติการชำระ" description="รายการที่โอนหรือจ่ายเงินสดจะปรากฏที่นี่" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
