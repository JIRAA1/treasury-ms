import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Topbar from '@/components/layout/Topbar'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft, User, Calendar, MessageSquare, CreditCard } from 'lucide-react'
import Link from 'next/link'
import type { WeekStatus } from '@/types'
import StudentDetailClient from './StudentDetailClient'

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

  const { data: actorProfile } = await createAdminClient().from('users').select('role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
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
  const completionPct = totalCycles > 0 ? Math.round((paidCount / totalCycles) * 100) : 0

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
              <div className="flex items-center gap-2.5 text-text-secondary">
                <User className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="text-text-muted">บทบาท:</span>
                <span className="font-medium text-text-primary">{student.role}</span>
              </div>
              <div className="flex items-center gap-2.5 text-text-secondary">
                <Calendar className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="text-text-muted">เข้าร่วม:</span>
                <span className="font-medium text-text-primary">{formatDate(student.created_at)}</span>
              </div>
              <div className="flex items-center gap-2.5 text-text-secondary">
                <MessageSquare className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
                <span className="text-text-muted">LINE:</span>
                {student.line_user_id
                  ? <div className="flex flex-col">
                      <span className="font-semibold text-emerald-600 leading-tight">เชื่อมแล้ว ✓</span>
                      <span className="text-[9px] text-text-muted font-mono truncate max-w-[100px]">{student.line_user_id}</span>
                    </div>
                  : <span className="font-semibold text-amber-600">ยังไม่เชื่อม</span>
                }
              </div>
            </div>

            {/* Admin action buttons — rendered as client component */}
            <div className="pt-2 border-t border-border">
              <StudentDetailClient
                student={student}
                weekStatuses={[]}
                actorRole={actorProfile.role}
                profileActionsOnly
              />
            </div>
          </div>

          {/* Stats Cards */}
          <div className="col-span-2 grid grid-cols-2 gap-4">
            {[
              { label: 'ชำระแล้ว', value: `${paidCount}/${totalCycles}`, sub: `${completionPct}% ของทั้งหมด`, variant: paidCount === totalCycles && totalCycles > 0 ? 'positive' : 'neutral' },
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

        {/* Payment rows — interactive, rendered by client component */}
        <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-text-muted" />
              <span className="text-[13.5px] font-semibold text-text-primary">ประวัติการชำระรายงวด</span>
            </div>
            <div className="text-[11px] text-text-muted">
              กดปุ่ม <span className="font-semibold text-emerald-600">เงินสด</span> เพื่อบันทึกการรับเงินสด
            </div>
          </div>

          <StudentDetailClient
            student={student}
            weekStatuses={weekStatuses}
            actorRole={actorProfile.role}
          />
        </div>
      </div>
    </div>
  )
}
