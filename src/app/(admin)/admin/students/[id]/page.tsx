import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Topbar from '@/components/layout/Topbar'
import { formatCurrency, formatDate } from '@/lib/utils'
import { calculateLateFine } from '@/lib/fine'
import { ArrowLeft, User, Calendar, MessageSquare, CreditCard } from 'lucide-react'
import Link from 'next/link'
import type { PeriodStatus } from '@/types'
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

  const { data: activeSemester } = await adminClient
    .from('semesters')
    .select('id, name')
    .eq('is_active', true)
    .maybeSingle()

  const activeSemesterId = activeSemester?.id || '00000000-0000-0000-0000-000000000000'

  const { data: periods } = await adminClient
    .from('periods')
    .select('*')
    .eq('semester_id', activeSemesterId)
    .order('period_order', { ascending: true })

  const periodIds = (periods ?? []).map(p => p.id)

  const [paymentsRes, settingsRes, creditsRes] = await Promise.all([
    adminClient
      .from('payments')
      .select('*, period:period_id(label, period_order)')
      .eq('user_id', id)
      .in('period_id', periodIds.length > 0 ? periodIds : ['00000000-0000-0000-0000-000000000000']),
    adminClient.from('system_settings').select('*'),
    periodIds.length > 0
      ? adminClient
          .from('payment_credits')
          .select('*')
          .eq('user_id', id)
          .eq('status', 'pending')
          .in('period_id', periodIds)
      : Promise.resolve({ data: [] }),
  ])

  const payments = paymentsRes.data ?? []
  const settings = settingsRes.data ?? []
  const credits = (creditsRes as { data: any[] | null }).data ?? []

  // Tier amounts from system_settings
  const tierAmounts: Record<string, number> = {
    A: parseFloat(settings.find((s: any) => s.key === 'tier_a_amount')?.value ?? '60'),
    B: parseFloat(settings.find((s: any) => s.key === 'tier_b_amount')?.value ?? '50'),
    C: parseFloat(settings.find((s: any) => s.key === 'tier_c_amount')?.value ?? '30'),
  }
  const tierAmount = tierAmounts[student.tier as string] ?? tierAmounts.B

  const now = new Date()

  const totalCycles = periods?.length ?? 0
  const paidCount = payments.filter(p => p.status === 'approved').length
  const pendingCount = payments.filter(p => p.status === 'pending').length
  const rejectedCount = payments.filter(p => p.status === 'rejected').length
  const totalPaid = payments.filter(p => p.status === 'approved').reduce((s: number, p: any) => s + p.amount, 0)
  const completionPct = totalCycles > 0 ? Math.round((paidCount / totalCycles) * 100) : 0

  // Build period status array — use tier-adjusted amount + late fine
  const periodStatuses: PeriodStatus[] = (periods ?? []).map(p => {
    const payment = payments.find((pay: any) => pay.period_id === p.id)
    const hasPendingCredit = credits.some((c: any) => c.period_id === p.id)
    const fine = payment?.status === 'approved' ? 0 : calculateLateFine(p, now, hasPendingCredit)
    const expectedAmount = tierAmount + fine
    const status = payment?.status === 'approved' ? 'paid'
                 : payment?.status === 'pending' ? 'pending'
                 : payment?.status === 'rejected' ? 'rejected'
                 : 'unpaid'
    return {
      period: p,
      status,
      // ถ้าจ่ายแล้วใช้ยอดที่จ่ายจริง มิฉะนั้นใช้ยอดตาม tier + ค่าปรับ
      amount: payment?.status === 'approved' ? (payment?.amount ?? expectedAmount) : expectedAmount,
      payment,
      fine,
    }
  })


  return (
    <div>
      <Topbar
        title={student.fullname}
        subtitle={`รหัสนักศึกษา: ${student.student_id}`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href={`/admin/students/${id}/statement`}
              className="flex items-center gap-1.5 border border-border-strong bg-background text-[12.5px] font-medium px-3 py-1.5 rounded-lg hover:bg-background-secondary transition-colors"
            >
              <CreditCard className="w-3.5 h-3.5" />
              ใบแจ้งหนี้
            </Link>
            <Link
              href="/admin/students"
              className="flex items-center gap-1.5 border border-border-strong bg-background text-[12.5px] font-medium px-3 py-1.5 rounded-lg hover:bg-background-secondary transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              กลับ
            </Link>
          </div>
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
                periodStatuses={[]}
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
            periodStatuses={periodStatuses}
            actorRole={actorProfile.role}
          />
        </div>
      </div>
    </div>
  )
}
