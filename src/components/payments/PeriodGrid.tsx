'use client'

import { cn } from '@/lib/utils'
import type { PeriodStatus } from '@/types'

interface PeriodGridProps {
  periods: PeriodStatus[]
  onPeriodClick?: (period: PeriodStatus) => void
  currentPeriodId?: string
  className?: string
}

const cellStyles: Record<string, string> = {
  paid: 'bg-text-primary text-white border-text-primary',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  unpaid: 'bg-background-secondary text-text-secondary border-border',
  rejected: 'bg-red-50 text-red-600 border-red-200',
}

const statusLabel: Record<string, string> = {
  paid: 'ชำระแล้ว',
  pending: 'รอตรวจ',
  unpaid: 'ยังไม่ชำระ',
  rejected: 'ถูกปฏิเสธ',
}

export default function PeriodGrid({ periods, onPeriodClick, currentPeriodId, className }: PeriodGridProps) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2', className)}>
      {periods.map((ps) => {
        const isCurrent = ps.period.id === currentPeriodId
        
        return (
          <button
            key={ps.period.id}
            onClick={() => onPeriodClick?.(ps)}
            className={cn(
              'border rounded-lg p-3 text-left cursor-pointer transition-all duration-150 hover:shadow-sm hover:translate-y-[-1px]',
              cellStyles[ps.status],
              isCurrent && 'ring-2 ring-brand ring-offset-2 border-brand'
            )}
          >
            <div className="text-[12px] font-bold truncate mb-1">
              {ps.status === 'paid' ? '✅ ' : ''}
              {ps.period.label}
            </div>
            <div className={cn('text-[10px] mb-1 opacity-80')}>
              {ps.status === 'paid' && ps.payment?.note?.includes('เงินสด') ? 'ชำระเงินสด' : statusLabel[ps.status]}
            </div>
            <div className={cn('text-[11px] font-semibold')}>
              ฿{(ps.payment?.amount ?? ps.period.amount).toLocaleString()}
            </div>
          </button>
        )
      })}
    </div>
  )
}
