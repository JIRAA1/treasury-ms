import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ReceiptPrintClient from '@/components/payments/ReceiptPrintClient'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return { title: `ใบเสร็จรับเงิน RC-${id.substring(0, 8).toUpperCase()} — TreasuryMS` }
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: paymentId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()

  // 1. Resolve student profile (by auth.user.id or student_id metadata)
  const studentId = user.user_metadata?.student_id || 'UNKNOWN'
  const { data: profile } = await adminClient
    .from('users')
    .select('id, fullname, student_id, role, tier')
    .or(`id.eq.${user.id},student_id.eq.${studentId}`)
    .maybeSingle()

  if (!profile) redirect('/bind')

  // 2. Fetch payment details
  const { data: payment } = await adminClient
    .from('payments')
    .select(`
      id, user_id, amount, trans_ref, status, verified_at, created_at, note,
      period:period_id (
        id, label, period_order, deadline, amount, base_amount, late_fine_amount,
        fine_type, fine_rate, fine_cap, fine_grace_days
      ),
      payer:user_id ( id, fullname, student_id, tier )
    `)
    .eq('id', paymentId)
    .eq('status', 'approved')
    .maybeSingle()

  // 3. Security check: student can only view their own receipt; admin/treasurer can view all
  if (!payment) notFound()
  const isAdmin = profile.role === 'admin' || profile.role === 'treasurer'
  if (!isAdmin && payment.user_id !== profile.id) notFound()

  // 4. Fetch the audit log to find who approved (actor = treasurer/admin)
  const { data: approvalLog } = await adminClient
    .from('audit_logs')
    .select('actor:actor_id ( fullname, student_id )')
    .eq('target_id', paymentId)
    .eq('action', 'payment_approved')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 5. Fetch system settings for organization info
  const { data: sysSettings } = await adminClient
    .from('system_settings')
    .select('key, value')
    .in('key', ['promptpay_name', 'org_name'])

  const orgName = sysSettings?.find(s => s.key === 'org_name')?.value
    || sysSettings?.find(s => s.key === 'promptpay_name')?.value
    || 'สาขาวิชา — TreasuryMS'

  const payer = payment.payer as any
  const period = payment.period as any
  const approver = (approvalLog?.actor as any) ?? null

  // 6. Calculate base amount and fine
  const totalPaid = Number(payment.amount)
  const baseAmount = Number(period?.base_amount ?? period?.amount ?? totalPaid)
  const fineAmount = Math.max(totalPaid - baseAmount, 0)

  const receiptData = {
    receiptId: `RC-${paymentId.substring(0, 8).toUpperCase()}`,
    issueDate: payment.verified_at || payment.created_at,
    payer: {
      fullname: payer?.fullname ?? 'ไม่ทราบชื่อ',
      student_id: payer?.student_id ?? '—',
      tier: payer?.tier ?? 'B',
    },
    period: {
      label: period?.label ?? 'ไม่ระบุงวด',
      deadline: period?.deadline ?? null,
    },
    payment: {
      id: payment.id,
      trans_ref: payment.trans_ref,
      baseAmount,
      fineAmount,
      totalPaid,
    },
    approver: approver ? { fullname: approver.fullname, student_id: approver.student_id } : null,
    orgName,
  }

  return <ReceiptPrintClient data={receiptData} />
}
