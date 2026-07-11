import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import UploadClient from './UploadClient'

import { getProfile, getSettings } from '@/lib/data'

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const metadata = { title: 'ส่งสลิปการชำระเงิน — TreasuryMS' }

export default async function UploadPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const adminClient = createAdminClient()

  try {
    const studentId = authUser.user_metadata?.student_id || 'UNKNOWN'

    // 1. Fetch user profile + settings first in parallel using cache
    const [profile, sysSettings] = await Promise.all([
      getProfile(authUser.id, studentId),
      getSettings()
    ])

    if (!profile) redirect('/bind')

    const targetUserId = profile.id

    // 2. Fetch periods, payments, and pending credits in parallel
    const [
      { data: periods },
      { data: payments },
      { data: pendingCredits }
    ] = await Promise.all([
      adminClient.from('periods').select('id, label, amount, deadline, open_at, close_at, late_fine_amount, fine_type, fine_rate, fine_cap, fine_grace_days, qr_url').order('period_order', { ascending: true }),
      adminClient.from('payments').select('period_id, status').eq('user_id', targetUserId),
      adminClient.from('payment_credits').select('period_id').eq('user_id', targetUserId).eq('status', 'pending')
    ])

    return (
      <UploadClient
        profile={profile}
        periods={periods || []}
        payments={payments || []}
        sysSettings={sysSettings || []}
        pendingCredits={pendingCredits || []}
      />
    )
  } catch (error) {
    console.error('[UploadPage Error]', error)
    return (
      <div className="p-8 text-center min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-xl font-bold text-red-600">เกิดข้อผิดพลาดในการโหลดหน้าส่งสลิป</h2>
        <p className="text-text-muted mt-2">กรุณาลองใหม่อีกครั้ง</p>
        <a href="/student/upload" className="mt-4 text-brand underline font-bold">ลองใหม่</a>
      </div>
    )
  }
}
