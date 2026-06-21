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
  approved:     { Icon: CheckCircle, gradient: 'from-emerald-500 to-teal-400',   shadow: 'shadow-emerald-500/20' },
  rejected:     { Icon: XCircle,     gradient: 'from-red-500 to-rose-400',       shadow: 'shadow-red-500/20' },
  expense:      { Icon: Receipt,     gradient: 'from-blue-500 to-indigo-400',    shadow: 'shadow-blue-500/20' },
  notification: { Icon: Bell,        gradient: 'from-amber-500 to-orange-400',   shadow: 'shadow-amber-500/20' },
  uploaded:     { Icon: Upload,      gradient: 'from-slate-500 to-slate-400',    shadow: 'shadow-slate-500/15' },
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
      <div className="absolute left-[13px] top-4 bottom-4 w-px bg-gradient-to-b from-border via-border/60 to-transparent" />

      <div className="space-y-0">
        {activities.map((activity, idx) => {
          const { Icon, gradient, shadow } = typeConfig[activity.type]
          return (
            <div
              key={activity.id}
              className="relative flex items-start gap-3 py-2.5 pl-1 animate-in fade-in slide-in-from-left-2 duration-300"
              style={{ animationDelay: `${idx * 50}ms` }}
            >
              {/* Icon dot on timeline */}
              <div className={cn(
                'w-[26px] h-[26px] rounded-full flex items-center justify-center flex-shrink-0 z-10 shadow-md bg-gradient-to-br',
                gradient, shadow
              )}>
                <Icon className="w-[11px] h-[11px] text-white" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 pb-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[11.5px] font-semibold text-text-primary leading-snug truncate">
                    {activity.title}
                  </div>
                  <div className="text-[9px] text-text-disabled flex-shrink-0 font-semibold bg-background-muted px-1.5 py-0.5 rounded-md tabular-nums">
                    {activity.time}
                  </div>
                </div>
                <div className="text-[10.5px] text-text-muted mt-[2px]">{activity.sub}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
