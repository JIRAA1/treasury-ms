import { cn } from '@/lib/utils'
import {
  CheckCircle,
  XCircle,
  Receipt,
  Bell,
  Upload,
} from 'lucide-react'

export interface Activity {
  id: string
  type: 'approved' | 'rejected' | 'expense' | 'notification' | 'uploaded'
  title: string
  sub: string
  time: string
}

interface ActivityFeedProps {
  activities: Activity[]
  className?: string
}

const typeConfig = {
  approved: { Icon: CheckCircle, bg: 'bg-emerald-50', color: 'text-emerald-600' },
  rejected: { Icon: XCircle, bg: 'bg-red-50', color: 'text-red-500' },
  expense: { Icon: Receipt, bg: 'bg-blue-50', color: 'text-blue-600' },
  notification: { Icon: Bell, bg: 'bg-amber-50', color: 'text-amber-600' },
  uploaded: { Icon: Upload, bg: 'bg-background-tertiary', color: 'text-text-secondary' },
}

export default function ActivityFeed({ activities, className }: ActivityFeedProps) {
  if (!activities.length) {
    return (
      <div className={cn('py-8 text-center text-[12px] text-text-muted', className)}>
        ไม่มีกิจกรรมล่าสุด
      </div>
    )
  }

  return (
    <div className={cn('divide-y divide-background-tertiary', className)}>
      {activities.map((activity) => {
        const { Icon, bg, color } = typeConfig[activity.type]
        return (
          <div key={activity.id} className="flex items-center gap-3 py-2.5">
            <div className={cn('w-7 h-7 rounded-[7px] flex items-center justify-center flex-shrink-0', bg)}>
              <Icon className={cn('w-3 h-3', color)} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11.5px] font-medium text-text-primary truncate">{activity.title}</div>
              <div className="text-[10.5px] text-text-muted truncate">{activity.sub}</div>
            </div>
            <div className="text-[10px] text-text-muted flex-shrink-0">{activity.time}</div>
          </div>
        )
      })}
    </div>
  )
}
