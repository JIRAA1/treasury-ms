import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Topbar from '@/components/layout/Topbar'
import PaymentRow from '@/components/payments/PaymentRow'
import EmptyState from '@/components/shared/EmptyState'
import { formatCurrency, formatDate, getCreditStatusLabel } from '@/lib/utils'
import { FileText, CreditCard } from 'lucide-react'

// Force fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = { title: 'ประวัติการชำระ — TreasuryMS' }

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = 'payments' } = await searchParams

  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const adminClient = createAdminClient()
  
  try {
    const studentId = authUser.user_metadata?.student_id || 'UNKNOWN'

    // Robust profile lookup to get the correct database ID
    const { data: profile } = await adminClient
      .from('users')
      .select('id')
      .or(`id.eq.${authUser.id},student_id.eq.${studentId}`)
      .maybeSingle()

    if (!profile) redirect('/bind')

    const [paymentsRes, creditsRes] = await Promise.all([
      adminClient
        .from('payments')
        .select('*, period:period_id(label, period_order)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false }),
      adminClient
        .from('payment_credits')
        .select('*, period_info:period_id(label, deadline)')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false }),
    ])

    const payments = paymentsRes.data || []
    const credits = creditsRes.data || []

    const totalApproved = payments
      .filter((p) => p.status === 'approved')
      .reduce((s, p) => s + (p.amount || 0), 0)
    
    const pendingCreditsTotal = credits
      .filter((c) => c.status === 'pending')
      .reduce((s, c) => s + (c.amount || 0), 0)

    return (
      <div>
        <Topbar title="ประวัติการชำระเงิน" subtitle={`${payments.length} รายการชำระ · ${credits.length} รายการ Credit`} />

        <div className="p-6 max-w-2xl">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            {[
              { label: 'ชำระแล้ว', value: payments.filter((p) => p.status === 'approved').length, color: 'text-emerald-600' },
              { label: 'รอตรวจสอบ', value: payments.filter((p) => p.status === 'pending').length, color: 'text-amber-600' },
              { label: 'ถูกปฏิเสธ', value: payments.filter((p) => p.status === 'rejected').length, color: 'text-red-500' },
            ].map((s) => (
              <div key={s.label} className="bg-background-secondary border border-border rounded-xl p-4 text-center shadow-sm">
                <div className={`text-[20px] font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[11px] text-text-muted mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-background-secondary border border-border rounded-xl mb-5 shadow-inner">
            {[
              { key: 'payments', label: 'ประวัติชำระเงิน', icon: FileText },
              { key: 'credits', label: 'Credit ค้างจ่าย', icon: CreditCard, badge: credits.filter(c => c.status === 'pending').length },
            ].map((t) => {
              const isActive = tab === t.key
              return (
                <a
                  key={t.key}
                  href={`/student/history?tab=${t.key}`}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-[12px] font-black rounded-lg transition-all ${
                    isActive ? 'bg-brand text-white shadow-md' : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  <t.icon className="w-3.5 h-3.5" />
                  {t.label}
                  {t.badge > 0 && (
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center ${isActive ? 'bg-white/20' : 'bg-amber-100 text-amber-700'}`}>
                      {t.badge}
                    </span>
                  )}
                </a>
              )
            })}
          </div>

          {/* Payments Tab */}
          {tab === 'payments' && (
            <div className="bg-background-secondary border border-border rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-background-tertiary/20">
                <div className="text-[13px] font-semibold text-text-primary uppercase tracking-tight">รายการทั้งหมด</div>
                <div className="text-[12px] text-text-muted font-medium">รวมที่ชำระ: <span className="font-bold text-emerald-600">{formatCurrency(totalApproved)}</span></div>
              </div>

              {payments.length > 0 ? (
                <div className="divide-y divide-border">
                  {/* Header */}
                  <div className="flex items-center gap-4 px-5 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted bg-background-tertiary/50">
                    <div className="w-20">งวดที่</div>
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
          )}

          {/* Credits Tab */}
          {tab === 'credits' && (
            <div className="space-y-4">
              {/* Summary */}
              {pendingCreditsTotal > 0 && (
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                  <CreditCard className="w-5 h-5 text-amber-600 flex-shrink-0" />
                  <div className="flex-1">
                    <div className="text-[13px] font-black text-amber-800">ยอดค้างจ่ายทั้งหมด</div>
                    <div className="text-[11px] text-amber-600 mt-0.5">กรุณาติดต่อเหรัญญิกเพื่อจ่ายคืน</div>
                  </div>
                  <div className="text-[20px] font-black text-amber-800">{formatCurrency(pendingCreditsTotal)}</div>
                </div>
              )}

              <div className="bg-background-secondary border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="px-5 py-3.5 border-b border-border bg-background-tertiary/20">
                  <div className="text-[13px] font-semibold text-text-primary uppercase tracking-tight">ประวัติ Credit</div>
                </div>

                {credits.length > 0 ? (
                  <div className="divide-y divide-border">
                    {credits.map((c) => {
                      const statusStyle = getCreditStatusLabel(c.status)
                      const periodInfo = c.period_info as { label?: string; deadline?: string } | null
                      return (
                        <div key={c.id} className="flex items-start gap-4 px-5 py-4 hover:bg-background-tertiary/20 transition-colors">
                          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <CreditCard className="w-4 h-4 text-amber-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[13px] font-bold text-text-primary">{periodInfo?.label || 'งวดชำระ'}</span>
                              <span className={`text-[10.5px] font-black px-2 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.color}`}>
                                {statusStyle.label}
                              </span>
                            </div>
                            {c.note && <div className="text-[11.5px] text-text-muted mt-0.5">{c.note}</div>}
                            <div className="text-[10.5px] text-text-muted mt-0.5">บันทึกเมื่อ {formatDate(c.created_at)}</div>
                            {c.repaid_at && (
                              <div className="text-[10.5px] text-emerald-600 mt-0.5">แก้ไขเมื่อ {formatDate(c.repaid_at)}</div>
                            )}
                          </div>
                          <div className="flex-shrink-0 text-right">
                            <div className="text-[16px] font-black text-text-primary">{formatCurrency(c.amount)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="py-12">
                    <EmptyState icon={CreditCard} title="ไม่มีรายการ Credit" description="หากมีการผ่อนผัน Admin จะบันทึกและแจ้งให้ทราบ" />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  } catch (error) {
    console.error('[HistoryPage Error]', error)
    return (
      <div className="p-8 text-center min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-red-600">เกิดข้อผิดพลาดในการโหลดข้อมูล</h2>
        <p className="text-text-muted mt-2 max-w-sm mx-auto">ขออภัย ระบบไม่สามารถดึงข้อมูลประวัติของคุณได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง</p>
        <a href="/student/history" className="mt-6 inline-block bg-brand text-white font-bold px-6 py-2 rounded-xl shadow-lg">ลองใหม่อีกครั้ง</a>
      </div>
    )
  }
}
