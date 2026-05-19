'use client'

import { cn } from '@/lib/utils'
import type { WeekStatus } from '@/types'

interface WeekSetting {
  week: number
  title?: string
  deadline?: string | null
  amount: number
}

interface WeekGridProps {
  weeks: WeekStatus[]
  onWeekClick?: (week: WeekStatus) => void
  currentWeek?: number
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

export default function WeekGrid({ weeks, onWeekClick, currentWeek, className }: WeekGridProps) {
  return (
    <div className={cn('grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2', className)}>
      {weeks.map((ws) => {
        const isCurrent = ws.week === currentWeek
        const displayTitle = ws.payment?.id ? (ws.week.toString()) : (ws.week.toString()) // Fallback
        
        return (
          <button
            key={ws.week}
            onClick={() => onWeekClick?.(ws)}
            className={cn(
              'border rounded-lg p-3 text-left cursor-pointer transition-all duration-150 hover:shadow-sm hover:translate-y-[-1px]',
              cellStyles[ws.status],
              isCurrent && 'ring-2 ring-brand ring-offset-2 border-brand'
            )}
          >
            <div className="text-[12px] font-bold truncate mb-1">
              {ws.status === 'paid' ? '✅ ' : ''}
              {ws.week}. {ws.deadline ? new Date(ws.deadline).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }) : `งวดที่ ${ws.week}`}
            </div>
            <div className={cn('text-[10px] mb-1 opacity-80')}>
              {ws.status === 'paid' && ws.payment?.note?.includes('เงินสด') ? 'ชำระเงินสด' : statusLabel[ws.status]}
            </div>
            <div className={cn('text-[11px] font-semibold')}>
              ฿{ws.amount.toLocaleString()}
            </div>
          </button>
        )
      })}
    </div>
  )
}
