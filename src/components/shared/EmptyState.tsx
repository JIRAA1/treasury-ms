import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export default function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-4 text-center', className)}>
      <div className="w-10 h-10 flex items-center justify-center rounded-full bg-background-tertiary mb-3">
        <Icon className="w-5 h-5 text-text-muted" />
      </div>
      <div className="text-[14px] font-medium text-text-primary mb-1">{title}</div>
      {description && (
        <div className="text-[12px] text-text-muted max-w-xs">{description}</div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 text-[12.5px] font-medium text-text-secondary border border-border-strong bg-background hover:bg-background-tertiary rounded-[7px] px-4 py-2 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
