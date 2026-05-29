import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import WeekSettingsForm from '@/components/admin/WeekSettingsForm'
import DataManagement from '@/components/admin/DataManagement'
import PromptPaySettingsForm from '@/components/admin/PromptPaySettingsForm'
import TierSettingsForm from '@/components/admin/TierSettingsForm'

export const metadata = { title: 'ตั้งค่าระบบ — TreasuryMS' }

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  const { data: profile } = await adminClient.from('users').select('role').or(`id.eq.${user.id},id.eq.${user.user_metadata?.treasury_user_id || '00000000-0000-0000-0000-000000000000'},student_id.eq.${user.user_metadata?.student_id || user.email?.split('@')[0] || 'NONE'}`).maybeSingle()
  if (profile?.role !== 'admin' && profile?.role !== 'treasurer') redirect('/student/dashboard')

  const { data: weekSettings } = await supabase
    .from('week_settings')
    .select('*')
    .order('week', { ascending: true })

  const { data: sysSettings } = await supabase
    .from('system_settings')
    .select('*')

  const settingsMap: Record<string, string> = {}
  for (const s of sysSettings ?? []) {
    settingsMap[s.key] = s.value ?? ''
  }

  return (
    <div>
      <Topbar title="ตั้งค่าระบบ" subtitle="จัดการกำหนดการและระบบข้อมูล" />
      
      <div className="p-6 space-y-8 max-w-5xl mx-auto">
        {/* PromptPay Settings */}
        <section className="bg-background-secondary border border-border rounded-[2rem] p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-[18px] font-black text-text-primary uppercase tracking-tight italic">ข้อมูลรับเงินพร้อมเพย์</h2>
            <p className="text-[12.5px] text-text-muted font-medium">ตั้งค่าเบอร์โทรศัพท์และชื่อผู้รับเงินสำหรับสร้าง QR Code อัตโนมัติ</p>
          </div>
          <PromptPaySettingsForm />
        </section>

        {/* Tier Settings */}
        <section className="bg-background-secondary border border-border rounded-[2rem] p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-[18px] font-black text-text-primary uppercase tracking-tight italic">ระบบ Tier และโควต้า</h2>
            <p className="text-[12.5px] text-text-muted font-medium">กำหนดค่าบำรุงแต่ละ Tier และโควต้าสูงสุดสำหรับ Tier C (ลดหย่อน)</p>
          </div>
          <TierSettingsForm
            tierAAmount={settingsMap['tier_a_amount'] ?? '60'}
            tierBAmount={settingsMap['tier_b_amount'] ?? '50'}
            tierCAmount={settingsMap['tier_c_amount'] ?? '30'}
            tierCMaxQuota={settingsMap['tier_c_max_quota'] ?? '5'}
            reserveFundTarget={settingsMap['reserve_fund_monthly_target'] ?? '200'}
          />
        </section>

        {/* Cycle Settings */}
        <section className="bg-background-secondary border border-border rounded-[2rem] p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-[18px] font-black text-text-primary uppercase tracking-tight italic">กำหนดการงวดการชำระ</h2>
            <p className="text-[12.5px] text-text-muted font-medium">ระบุชื่องวด วันสิ้นสุดการรับสลิป และยอดเงินที่ต้องชำระ</p>
          </div>
          <WeekSettingsForm initialSettings={weekSettings || []} />
        </section>

        {/* Data Management */}
        <section className="bg-background-secondary border border-border rounded-[2rem] p-8 shadow-sm">
          <div className="mb-6">
            <h2 className="text-[18px] font-black text-text-primary uppercase tracking-tight italic text-red-600">การจัดการข้อมูลระบบ</h2>
            <p className="text-[12.5px] text-text-muted font-medium">ล้างข้อมูลประวัติการเงินเพื่อเริ่มต้นใหม่ หรือลบข้อมูลทดสอบ</p>
          </div>
          <DataManagement />
        </section>
      </div>
    </div>
  )
}
