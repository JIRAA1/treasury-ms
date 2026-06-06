import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type EmptyVariant = 'default' | 'success' | 'search' | 'error'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  variant?: EmptyVariant
  className?: string
}

const variantConfig: Record<EmptyVariant, {
  ring: string
  bg: string
  iconColor: string
  glow: string
}> = {
  default: {
    ring: 'ring-1 ring-border',
    bg: 'bg-background-muted',
    iconColor: 'text-text-muted',
    glow: '',
  },
  success: {
    ring: 'ring-1 ring-emerald-100',
    bg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    glow: 'shadow-[0_0_20px_rgba(6,95,70,0.12)]',
  },
  search: {
    ring: 'ring-1 ring-blue-100',
    bg: 'bg-blue-50',
    iconColor: 'text-blue-500',
    glow: 'shadow-[0_0_20px_rgba(59,130,246,0.1)]',
  },
  error: {
    ring: 'ring-1 ring-red-100',
    bg: 'bg-red-50',
    iconColor: 'text-red-500',
    glow: 'shadow-[0_0_20px_rgba(239,68,68,0.1)]',
  },
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const cfg = variantConfig[variant]

  return (
    <div className={cn('flex flex-col items-center justify-center py-14 px-6 text-center', className)}>
      {/* Animated icon container */}
      <div className="relative mb-5">
        {/* Decorative rings */}
        <div className={cn(
          'absolute -inset-3 rounded-full opacity-20',
          cfg.ring,
          cfg.bg
        )} />
        <div className={cn(
          'absolute -inset-6 rounded-full opacity-10',
          cfg.ring,
          cfg.bg
        )} />

        {/* Main icon circle */}
        <div
          className={cn(
            'relative w-16 h-16 flex items-center justify-center rounded-2xl',
            cfg.ring, cfg.bg, cfg.glow,
          )}
          style={{ animation: 'float 3s ease-in-out infinite' }}
        >
          <Icon className={cn('w-7 h-7', cfg.iconColor)} />
        </div>
      </div>

      <div className="text-[15px] font-bold text-text-primary mb-1.5 tracking-tight">{title}</div>
      {description && (
        <div className="text-[12.5px] text-text-muted max-w-[240px] leading-relaxed">{description}</div>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 inline-flex items-center gap-2 text-[12.5px] font-bold text-white bg-brand hover:bg-brand-hover rounded-xl px-5 py-2.5 transition-all shadow-lg shadow-brand/10 active:scale-95 press-down"
        >
          {action.label}
        </button>
      )}

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  )
}
