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
    <div className={cn('flex items-center gap-4 py-3 text-[12.5px]', className)}>
      {showWeek && (
        <div className="w-10 text-[11px] font-semibold text-text-muted flex-shrink-0">W{payment.week}</div>
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
