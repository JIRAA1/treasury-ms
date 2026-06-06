import { cn, formatDate, formatCurrency } from '@/lib/utils'
import StatusPill from './StatusPill'
import type { Payment } from '@/types'

interface PaymentRowProps {
  payment: Payment
  showWeek?: boolean
  className?: string
}

export default function PaymentRow({ payment, showWeek = true, className }: PaymentRowProps) {
  return (
    <div className={cn('flex items-center gap-2.5 sm:gap-4 py-2 sm:py-3 text-[11.5px] sm:text-[12.5px]', className)}>
      {showWeek && (
        <div className="w-14 sm:w-20 text-[10px] sm:text-[11px] font-semibold text-text-muted flex-shrink-0 truncate">
          {payment.period?.label || '—'}
        </div>
      )}
      <div className="flex-1 text-text-muted">{formatDate(payment.created_at)}</div>
      <div className="font-semibold text-text-primary">{formatCurrency(payment.amount)}</div>
      <StatusPill
        status={
          payment.status === 'approved'
            ? 'paid'
            : payment.status === 'pending'
            ? 'pending'
            : 'rejected'
        }
        note={payment.note}
      />
    </div>
  )
}
