import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { ElementType, Suspense as SuspenseType } from 'react'
import { Suspense } from 'react'
import AnimatedValue from './AnimatedValue'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  subVariant?: 'neutral' | 'positive' | 'warning' | 'danger'
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' }
  icon?: ElementType
  accentColor?: 'brand' | 'emerald' | 'gold' | 'amber' | 'red'
  className?: string
}

const subVariantClasses = {
  neutral:  'text-text-muted',
  positive: 'text-emerald-600',
  warning:  'text-amber-600',
  danger:   'text-red-600',
}

const accentBar = {
  brand:   'from-slate-800 to-slate-600',
  emerald: 'from-emerald-600 to-teal-500',
  gold:    'from-yellow-600 to-amber-400',
  amber:   'from-amber-500 to-orange-400',
  red:     'from-red-600 to-rose-400',
}

const iconBg = {
  brand:   'bg-slate-100 text-slate-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  gold:    'bg-amber-50 text-amber-700',
  amber:   'bg-orange-50 text-orange-700',
  red:     'bg-red-50 text-red-700',
}

export default function KpiCard({
  label,
  value,
  sub,
  subVariant = 'neutral',
  trend,
  icon: Icon,
  accentColor = 'brand',
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'relative bg-background-secondary border border-border rounded-xl sm:rounded-2xl p-2 sm:p-5 flex flex-col gap-1 sm:gap-3',
        'hover-lift card-shadow overflow-hidden',
        className
      )}
    >
      {/* Accent top bar */}
      <div className={cn('absolute top-0 inset-x-0 h-[3px] rounded-t-lg sm:rounded-t-2xl bg-gradient-to-r', accentBar[accentColor])} />

      <div className="flex items-start justify-between gap-2">
        <div className="text-[8.5px] sm:text-[10px] uppercase tracking-[0.2em] font-black text-text-muted leading-tight mt-0.5">
          {label}
        </div>
        {Icon && (
          <div className={cn('w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl items-center justify-center flex-shrink-0 hidden xs:flex', iconBg[accentColor])}>
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        )}
      </div>

      <div className="animate-count text-[13px] sm:text-[24px] md:text-[28px] font-black text-text-primary tracking-tighter leading-none">
        {typeof value === 'number' ? (
          <Suspense fallback={<span>{value.toLocaleString('th-TH')}</span>}>
            <AnimatedValue value={value} />
          </Suspense>
        ) : (
          value
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-1 sm:pt-2.5 mt-auto">
        {sub && (
          <span className={cn('text-[8px] sm:text-[11px] font-bold tracking-tight line-clamp-1', subVariantClasses[subVariant])}>
            {sub}
          </span>
        )}
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-[9.5px] sm:text-[10.5px] font-semibold flex-shrink-0',
            trend.direction === 'up' ? 'text-emerald-600' :
            trend.direction === 'down' ? 'text-red-600' : 'text-text-muted'
          )}>
            {trend.direction === 'up'   ? <TrendingUp className="w-3 h-3" />  :
             trend.direction === 'down' ? <TrendingDown className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
      </div>
    </div>
  )
}
