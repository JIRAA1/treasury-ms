import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import WeekSettingsForm from '@/components/admin/WeekSettingsForm'
import DataManagement from '@/components/admin/DataManagement'
import PromptPaySettingsForm from '@/components/admin/PromptPaySettingsForm'

export const metadata = { title: 'ตั้งค่าระบบ — TreasuryMS' }

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin' && profile?.role !== 'treasurer') redirect('/student/dashboard')

  const { data: weekSettings } = await supabase
    .from('week_settings')
    .select('*')
    .order('week', { ascending: true })

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
