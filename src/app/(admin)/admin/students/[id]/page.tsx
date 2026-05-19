import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import StudentManagementActions from '@/components/admin/StudentManagementActions'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Clock, CheckCircle, XCircle, AlertCircle, Banknote } from 'lucide-react'

export const metadata = { title: 'จัดการนักศึกษา — TreasuryMS' }

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const adminClient = createAdminClient()
  
  // 1. Fetch Student Profile
  const { data: profile } = await adminClient
    .from('users')
    .select('*')
    .eq('id', id)
    .single()

  if (!profile) notFound()

  // 2. Fetch All Payment Cycles
  const { data: settings } = await adminClient
    .from('week_settings')
    .select('*')
    .order('week', { ascending: true })

  // 3. Fetch Student's Payments
  const { data: payments } = await adminClient
    .from('payments')
    .select('*')
    .eq('user_id', id)
    .order('week', { ascending: true })

  const paymentMap = new Map(payments?.map(p => [p.week, p]))

  return (
    <div>
      <Topbar 
        title={profile.fullname} 
        subtitle={`รหัสนักศึกษา: ${profile.student_id}`}
        backHref="/admin/students"
        actions={
          <StudentManagementActions 
            studentId={profile.id}
            week={0} // dummy
            amount={0} // dummy
            isProfileActions={true}
            studentData={profile}
          />
        }
      />

      <div className="p-6 grid grid-cols-3 gap-6">
        {/* Left Column: Stats & Info */}
        <div className="col-span-1 space-y-6">
          <div className="bg-background-secondary border border-border rounded-xl p-5">
            <h3 className="text-[14px] font-bold text-text-primary mb-4">ข้อมูลเบื้องต้น</h3>
            <div className="space-y-3">
              <div>
                <div className="text-[11px] text-text-muted uppercase">สถานะบัญชี</div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className={`w-2 h-2 rounded-full ${profile.verified ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  <span className="text-[13px] font-medium">{profile.verified ? 'ยืนยันแล้ว' : 'ยังไม่ยืนยัน'}</span>
                </div>
              </div>
              <div>
                <div className="text-[11px] text-text-muted uppercase">บทบาท</div>
                <div className="text-[13px] font-medium mt-0.5 capitalize">{profile.role}</div>
              </div>
              <div>
                <div className="text-[11px] text-text-muted uppercase">วันที่ลงทะเบียน</div>
                <div className="text-[13px] font-medium mt-0.5">{formatDate(new Date(profile.created_at))}</div>
              </div>
            </div>
          </div>

          <div className="bg-background-secondary border border-border rounded-xl p-5">
            <h3 className="text-[14px] font-bold text-text-primary mb-4 text-emerald-600 flex items-center gap-2">
              <Banknote className="w-4 h-4" />
              สรุปการชำระเงิน
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-end">
                <span className="text-[13px] text-text-secondary">ชำระแล้ว</span>
                <span className="text-[18px] font-bold text-text-primary">
                  {payments?.filter(p => p.status === 'approved').length || 0} / {settings?.length || 0} งวด
                </span>
              </div>
              <div className="w-full h-2 bg-border rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-500 transition-all" 
                  style={{ width: `${settings?.length ? ((payments?.filter(p => p.status === 'approved').length || 0) / settings.length) * 100 : 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Payment Cycles & Actions */}
        <div className="col-span-2 space-y-6">
          <div className="bg-background-secondary border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-background-tertiary/30">
              <h3 className="text-[14px] font-bold text-text-primary">รายการงวดการชำระ</h3>
            </div>
            <div className="divide-y divide-border">
              {settings?.map((s) => {
                const payment = paymentMap.get(s.week)
                const isPaid = payment?.status === 'approved'
                const isPending = payment?.status === 'pending'
                const isRejected = payment?.status === 'rejected'
                
                return (
                  <div key={s.week} className="px-5 py-4 flex items-center justify-between hover:bg-background-tertiary/20 transition-colors">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[13.5px] font-bold text-text-primary">{s.title || `งวดที่ ${s.week}`}</span>
                        {isPaid && <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-[12px] font-medium text-brand">฿{s.amount}</span>
                        <span className="text-[11px] text-text-muted flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(new Date(s.deadline))}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {payment ? (
                        <div className="text-right mr-4">
                          <div className={`text-[11px] font-bold uppercase tracking-wider ${
                            isPaid ? 'text-emerald-600' : isPending ? 'text-amber-600' : 'text-red-600'
                          }`}>
                            {isPaid ? 'ชำระแล้ว' : isPending ? 'รอตรวจสอบ' : 'ถูกปฏิเสธ'}
                          </div>
                          <div className="text-[10px] text-text-muted">{formatDate(new Date(payment.created_at))}</div>
                        </div>
                      ) : (
                        <div className="text-right mr-4">
                          <div className="text-[11px] font-bold text-text-disabled uppercase tracking-wider">ยังไม่ได้ชำระ</div>
                        </div>
                      )}

                      <StudentManagementActions 
                        studentId={profile.id}
                        week={s.week}
                        amount={s.amount}
                        existingPayment={payment}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
