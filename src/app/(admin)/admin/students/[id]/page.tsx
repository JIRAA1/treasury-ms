import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Topbar from '@/components/layout/Topbar'
import StatusPill from '@/components/payments/StatusPill'
import { formatCurrency, formatDate, getWeekLabel } from '@/lib/utils'
import { ArrowLeft, User, Calendar, CreditCard, MessageSquare } from 'lucide-react'
import Link from 'next/link'
import type { WeekStatus } from '@/types'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const adminClient = createAdminClient()
  const { data: student } = await adminClient.from('users').select('fullname').eq('id', id).single()
  return { title: `${student?.fullname ?? 'นักศึกษา'} — TreasuryMS Admin` }
}

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: actorProfile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!actorProfile || !['admin', 'treasurer'].includes(actorProfile.role)) {
    redirect('/student/dashboard')
  }

  const adminClient = createAdminClient()

  const { data: student } = await adminClient
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (!student) notFound()

  const { data: payments } = await adminClient
    .from('payments')
    .select('*')
    .eq('user_id', id)
    .order('week', { ascending: true })

  const { data: weekSettings } = await adminClient
    .from('week_settings')
    .select('*')
    .order('week', { ascending: true })

  const totalCycles = weekSettings?.length ?? 0
  const paidCount = payments?.filter(p => p.status === 'approved').length ?? 0
  const pendingCount = payments?.filter(p => p.status === 'pending').length ?? 0
  const rejectedCount = payments?.filter(p => p.status === 'rejected').length ?? 0
  const totalPaid = payments?.filter(p => p.status === 'approved').reduce((s, p) => s + p.amount, 0) ?? 0

  // Build week status array
  const weekStatuses: (WeekStatus & { title?: string; deadline?: string })[] = (weekSettings ?? []).map(ws => {
    const payment = payments?.find(p => p.week === ws.week)
    return {
      week: ws.week,
      title: ws.title,
      deadline: ws.deadline,
      status: payment?.status === 'approved' ? 'paid'
             : payment?.status === 'pending' ? 'pending'
             : payment?.status === 'rejected' ? 'rejected'
             : 'unpaid',
      amount: ws.amount ?? 0,
      payment,
    }
  })

  const completionPct = totalCycles > 0 ? Math.round((paidCount / totalCycles) * 100) : 0

  return (
    <div>
      <Topbar
        title={student.fullname}
        subtitle={`รหัสนักศึกษา: ${student.student_id}`}
        actions={
          <Link
            href="/admin/students"
            className="flex items-center gap-1.5 border border-border-strong bg-background text-[12.5px] font-medium px-3 py-1.5 rounded-lg hover:bg-background-secondary transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            กลับ
          </Link>
        }
      />

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Profile & Stats */}
        <div className="grid grid-cols-3 gap-4">
          {/* Profile Card */}
          <div className="col-span-1 bg-background-secondary border border-border rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg font-bold">{student.fullname?.[0] ?? 'U'}</span>
              </div>
              <div>
                <div className="text-[14px] font-bold text-text-primary">{student.fullname}</div>
                <div className="text-[11.5px] text-text-muted font-mono">{student.student_id}</div>
              </div>
            </div>

            <div className="space-y-2 text-[12.5px]">
              {[
                { icon: User, label: 'บทบาท', value: student.role },
                { icon: Calendar, label: 'เข้าร่วม', value: formatDate(student.created_at) },
                { icon: MessageSquare, label: 'LINE', value: student.line_user_id ? 'เชื่อมแล้ว ✓' : 'ยังไม่เชื่อม' },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-2.5 text-text-secondary">
                  <Icon className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                  <span className="text-text-muted">{label}:</span>
                  <span className="font-medium text-text-primary">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Cards */}
          <div className="col-span-2 grid grid-cols-2 gap-4">
            {[
              { label: 'ชำระแล้ว', value: `${paidCount}/${totalCycles}`, sub: `${completionPct}% ของทั้งหมด`, variant: paidCount === totalCycles ? 'positive' : 'neutral' },
              { label: 'ยอดที่ชำระ', value: formatCurrency(totalPaid), sub: 'ที่อนุมัติแล้ว', variant: 'positive' },
              { label: 'รอตรวจสอบ', value: pendingCount, sub: 'รายการ', variant: pendingCount > 0 ? 'warning' : 'neutral' },
              { label: 'ถูกปฏิเสธ', value: rejectedCount, sub: 'รายการ', variant: rejectedCount > 0 ? 'danger' : 'neutral' },
            ].map(({ label, value, sub, variant }) => (
              <div key={label} className="bg-background-secondary border border-border rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1.5">{label}</div>
                <div className="text-[22px] font-bold text-text-primary tracking-tight">{value}</div>
                <div className={`text-[11px] mt-0.5 ${
                  variant === 'positive' ? 'text-emerald-600'
                  : variant === 'warning' ? 'text-amber-600'
                  : variant === 'danger' ? 'text-red-500'
                  : 'text-text-muted'
                }`}>{sub}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="bg-background-secondary border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13.5px] font-semibold text-text-primary">ความคืบหน้าการชำระ</div>
            <div className="text-[12px] text-text-muted">{paidCount} / {totalCycles} งวด</div>
          </div>
          <div className="w-full h-2 bg-background-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                completionPct === 100 ? 'bg-emerald-500' : 'bg-brand'
              }`}
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <div className="text-[11px] text-text-muted mt-1.5">{completionPct}% สำเร็จ</div>
        </div>

        {/* Payment History Table */}
        <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-text-muted" />
            <span className="text-[13.5px] font-semibold text-text-primary">ประวัติการชำระรายงวด</span>
          </div>

          <div className="divide-y divide-border">
            {weekStatuses.map((ws) => (
              <div key={ws.week} className="flex items-center justify-between px-5 py-3.5 hover:bg-background-tertiary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-background-tertiary flex items-center justify-center">
                    <span className="text-[11px] font-bold text-text-secondary">{getWeekLabel(ws.week)}</span>
                  </div>
                  <div>
                    <div className="text-[12.5px] font-medium text-text-primary">
                      {ws.title || `งวดที่ ${ws.week}`}
                    </div>
                    {ws.deadline && (
                      <div className="text-[10.5px] text-text-muted">
                        ครบกำหนด: {formatDate(ws.deadline)}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {ws.payment ? (
                    <>
                      <div className="text-right">
                        <div className="text-[12.5px] font-semibold text-text-primary">{formatCurrency(ws.payment.amount)}</div>
                        <div className="text-[10.5px] text-text-muted">{formatDate(ws.payment.created_at)}</div>
                      </div>
                      {ws.payment.slip_url && (
                        <a
                          href={ws.payment.slip_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-text-muted hover:text-text-primary underline underline-offset-2 transition-colors"
                        >
                          ดูสลิป
                        </a>
                      )}
                    </>
                  ) : (
                    <div className="text-[12px] text-text-muted">{formatCurrency(ws.amount)}</div>
                  )}
                  <StatusPill status={ws.status === 'paid' ? 'paid' : ws.status === 'pending' ? 'pending' : ws.status === 'rejected' ? 'rejected' : 'unpaid'} />
                </div>
              </div>
            ))}

            {weekStatuses.length === 0 && (
              <div className="py-12 text-center text-[13px] text-text-muted italic">
                ยังไม่มีข้อมูลงวดการชำระ
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
