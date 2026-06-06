import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Topbar from '@/components/layout/Topbar'
import EmptyState from '@/components/shared/EmptyState'
import { Bell, CheckCircle, XCircle, Receipt, AlertCircle, Info } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata = { title: 'การแจ้งเตือน — TreasuryMS' }

interface Notification {
  id: string
  title: string
  message: string
  type: string
  sent_at: string
  read_at: string | null
}

const typeConfig = {
  success: { icon: CheckCircle, bg: 'bg-emerald-50', iconColor: 'text-emerald-600', border: 'border-emerald-100' },
  error: { icon: XCircle, bg: 'bg-red-50', iconColor: 'text-red-500', border: 'border-red-100' },
  warning: { icon: AlertCircle, bg: 'bg-amber-50', iconColor: 'text-amber-600', border: 'border-amber-100' },
  expense: { icon: Receipt, bg: 'bg-blue-50', iconColor: 'text-blue-600', border: 'border-blue-100' },
  info: { icon: Info, bg: 'bg-background-secondary', iconColor: 'text-text-muted', border: 'border-border' },
}

export default async function StudentNotificationsPage() {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/login')

  const adminClient = createAdminClient()

  const studentId = authUser.user_metadata?.student_id || 'UNKNOWN'

  const { data: profile } = await adminClient
    .from('users')
    .select('id')
    .or(`id.eq.${authUser.id},student_id.eq.${studentId}`)
    .maybeSingle()

  if (!profile) redirect('/bind')

  const { data: notifications } = await adminClient
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('sent_at', { ascending: false })
    .limit(50)

  const unreadCount = (notifications ?? []).filter(n => !n.read_at).length

  return (
    <div>
      <Topbar
        title="การแจ้งเตือน"
        subtitle={unreadCount > 0 ? `${unreadCount} รายการที่ยังไม่ได้อ่าน` : 'ทั้งหมด'}
      />

      <div className="p-6 max-w-2xl">
        {notifications && notifications.length > 0 ? (
          <div className="space-y-2">
            {(notifications as Notification[]).map((notif) => {
              const cfg = typeConfig[notif.type as keyof typeof typeConfig] ?? typeConfig.info
              const Icon = cfg.icon
              const isUnread = !notif.read_at

              return (
                <div
                  key={notif.id}
                  className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                    isUnread
                      ? 'bg-background-secondary border-border shadow-sm'
                      : 'bg-background border-border/60 opacity-75'
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-9 h-9 rounded-[10px] border ${cfg.bg} ${cfg.border} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                    <Icon className={`w-4.5 h-4.5 ${cfg.iconColor}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className={`text-[13px] font-semibold ${isUnread ? 'text-text-primary' : 'text-text-secondary'}`}>
                          {notif.title}
                        </div>
                        <div className="text-[12px] text-text-muted mt-0.5 leading-relaxed">
                          {notif.message}
                        </div>
                      </div>
                      {isUnread && (
                        <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0 mt-1.5" />
                      )}
                    </div>
                    <div className="text-[10.5px] text-text-disabled mt-1.5">
                      {formatDistanceToNow(new Date(notif.sent_at), { locale: th, addSuffix: true })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="mt-8">
            <EmptyState
              icon={Bell}
              title="ยังไม่มีการแจ้งเตือน"
              description="การอนุมัติสลิปและการแจ้งเตือนต่างๆ จะปรากฏที่นี่"
            />
          </div>
        )}
      </div>
    </div>
  )
}
