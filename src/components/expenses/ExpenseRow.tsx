import { cn } from '@/lib/utils'
import type { Expense } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { FileText, ExternalLink } from 'lucide-react'

interface ExpenseRowProps {
  expense: Expense
  className?: string
}

export default function ExpenseRow({ expense, className }: ExpenseRowProps) {
  return (
    <div className={cn('flex items-start gap-2 sm:gap-3 py-2 sm:py-3', className)}>
      <div className="w-7 h-7 rounded-[7px] bg-background-tertiary flex items-center justify-center flex-shrink-0 mt-0.5">
        <FileText className="w-3.5 h-3.5 text-text-secondary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] sm:text-[12.5px] font-medium text-text-primary truncate">{expense.title}</div>
        {expense.description && (
          <div className="text-[10px] sm:text-[11px] text-text-muted truncate">{expense.description}</div>
        )}
        <div className="text-[9.5px] sm:text-[10.5px] text-text-muted mt-0.5">
          {formatDate(expense.created_at)}
          {expense.creator && ` · โดย ${expense.creator.fullname}`}
        </div>
      </div>
      <div className="flex flex-col items-end gap-0.5 sm:gap-1 flex-shrink-0">
        <div className="text-[11.5px] sm:text-[13px] font-semibold text-text-primary">{formatCurrency(expense.amount)}</div>
        {expense.receipt_url && (
          <a
            href={expense.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[9.5px] sm:text-[10.5px] text-text-muted hover:text-text-primary transition-colors"
          >
            ดูใบเสร็จ <ExternalLink className="w-2.5 h-2.5" />
          </a>
        )}
      </div>
    </div>
  )
}
