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
  approved:     { Icon: CheckCircle, bg: 'bg-emerald-500', shadow: 'shadow-emerald-500/25' },
  rejected:     { Icon: XCircle,     bg: 'bg-red-500',     shadow: 'shadow-red-500/25' },
  expense:      { Icon: Receipt,     bg: 'bg-blue-500',    shadow: 'shadow-blue-500/25' },
  notification: { Icon: Bell,        bg: 'bg-amber-500',   shadow: 'shadow-amber-500/25' },
  uploaded:     { Icon: Upload,      bg: 'bg-slate-500',   shadow: 'shadow-slate-500/20' },
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
    <div className={cn('relative', className)}>
      {/* Vertical timeline line */}
      <div className="absolute left-[13px] top-4 bottom-4 w-px bg-gradient-to-b from-border via-border to-transparent" />

      <div className="space-y-0">
        {activities.map((activity, idx) => {
          const { Icon, bg, shadow } = typeConfig[activity.type]
          return (
            <div
              key={activity.id}
              className="relative flex items-start gap-3 py-2.5 pl-1 animate-in fade-in slide-in-from-left-2 duration-300"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Icon dot on timeline */}
              <div className={cn(
                'w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0 z-10 shadow-md',
                bg, shadow
              )}>
                <Icon className="w-3 h-3 text-white" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[12px] font-semibold text-text-primary leading-snug truncate">
                    {activity.title}
                  </div>
                  <div className="text-[9.5px] text-text-disabled flex-shrink-0 font-medium bg-background-muted px-1.5 py-0.5 rounded-md">
                    {activity.time}
                  </div>
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">{activity.sub}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
