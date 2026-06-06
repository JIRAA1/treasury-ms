'use client'

import { cn } from '@/lib/utils'
import { CheckCircle2, Clock4, Circle, XCircle } from 'lucide-react'
import type { PeriodStatus } from '@/types'

interface PeriodGridProps {
  periods: PeriodStatus[]
  onPeriodClick?: (period: PeriodStatus) => void
  currentPeriodId?: string
  className?: string
}

const statusConfig: Record<string, {
  cell: string
  icon: typeof CheckCircle2
  label: string
}> = {
  paid: {
    cell: 'bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700 hover:border-emerald-700',
    icon: CheckCircle2,
    label: 'ชำระแล้ว',
  },
  pending: {
    cell: 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100',
    icon: Clock4,
    label: 'รอตรวจ',
  },
  unpaid: {
    cell: 'bg-background-secondary border-border text-text-secondary hover:bg-background-muted',
    icon: Circle,
    label: 'ยังไม่ชำระ',
  },
  rejected: {
    cell: 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100',
    icon: XCircle,
    label: 'ถูกปฏิเสธ',
  },
}

export default function PeriodGrid({ periods, onPeriodClick, currentPeriodId, className }: PeriodGridProps) {
  return (
    <div className={cn('grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1.5 sm:gap-2.5', className)}>
      {periods.map((ps, idx) => {
        const isCurrent = ps.period.id === currentPeriodId
        const cfg = statusConfig[ps.status] ?? statusConfig.unpaid
        const StatusIcon = cfg.icon
        const isPaid = ps.status === 'paid'

        return (
          <button
            key={ps.period.id}
            onClick={() => onPeriodClick?.(ps)}
            style={{ animationDelay: `${idx * 40}ms` }}
            className={cn(
              'relative border rounded-lg sm:rounded-xl p-2 sm:p-3 text-left transition-all duration-200 group',
              'hover-lift press-down',
              cfg.cell,
              isCurrent && 'ring-2 ring-brand ring-offset-2 shadow-lg',
              isPaid && 'status-paid-glow',
              ps.status === 'pending' && 'status-pending-glow',
            )}
          >
            {/* Current period indicator */}
            {isCurrent && (
              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-brand pulse-dot border-2 border-white" />
            )}

            <div className="flex items-center justify-between mb-1.5">
              <StatusIcon className={cn(
                'w-3.5 h-3.5 flex-shrink-0',
                isPaid ? 'text-white/80' : ''
              )} />
              <span className={cn(
                'text-[8px] sm:text-[9px] font-black uppercase tracking-wider opacity-70',
              )}>
                ฿{(ps.payment?.amount ?? ps.period.amount).toLocaleString()}
              </span>
            </div>

            <div className="text-[10.5px] sm:text-[11.5px] font-bold truncate leading-tight mb-0.5">
              {ps.period.label}
            </div>
            <div className={cn('text-[8.5px] sm:text-[9.5px] opacity-70 font-semibold')}>
              {isPaid && ps.payment?.note?.includes('เงินสด') ? 'ชำระเงินสด' : cfg.label}
            </div>
          </button>
        )
      })}
    </div>
  )
}
