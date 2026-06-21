import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { ElementType } from 'react'
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

/* Gradient for accent top bar */
const accentBar = {
  brand:   'from-[#3d52d5] to-[#7c94f8]',
  emerald: 'from-[#0a8f5a] to-[#34d399]',
  gold:    'from-[#b8860b] to-[#d4a847]',
  amber:   'from-[#d97706] to-[#f59e0b]',
  red:     'from-[#dc2626] to-[#f87171]',
}

/* Soft icon background */
const iconBg = {
  brand:   'bg-blue-50/80 text-brand',
  emerald: 'bg-emerald-50/80 text-emerald-700',
  gold:    'bg-amber-50/80 text-amber-700',
  amber:   'bg-orange-50/80 text-orange-700',
  red:     'bg-red-50/80 text-red-600',
}

/* Subtle background tint */
const cardTint = {
  brand:   'from-[#eef1ff]/60',
  emerald: 'from-[#ecfdf5]/60',
  gold:    'from-[#fffbeb]/60',
  amber:   'from-[#fff7ed]/60',
  red:     'from-[#fff1f2]/60',
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
        'relative bg-white border border-border rounded-xl sm:rounded-2xl p-3 sm:p-5 flex flex-col gap-1 sm:gap-2.5',
        'hover-lift card-shadow overflow-hidden group',
        className
      )}
    >
      {/* Subtle card background tint */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-br to-transparent opacity-50 rounded-inherit pointer-events-none',
        cardTint[accentColor]
      )} />

      {/* Accent top bar */}
      <div className={cn('absolute top-0 inset-x-0 h-[3px] rounded-t-xl sm:rounded-t-2xl bg-gradient-to-r', accentBar[accentColor])} />

      <div className="relative flex items-start justify-between gap-2">
        <div className="text-[8.5px] sm:text-[10px] uppercase tracking-[0.22em] font-black text-text-muted leading-tight mt-0.5">
          {label}
        </div>
        {Icon && (
          <div className={cn('w-7 h-7 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl items-center justify-center flex-shrink-0 hidden xs:flex transition-transform group-hover:scale-110', iconBg[accentColor])}>
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        )}
      </div>

      <div className="relative animate-count text-[14px] sm:text-[26px] md:text-[28px] font-black text-text-primary tracking-tighter leading-none">
        {typeof value === 'number' ? (
          <Suspense fallback={<span>{value.toLocaleString('th-TH')}</span>}>
            <AnimatedValue value={value} />
          </Suspense>
        ) : (
          value
        )}
      </div>

      <div className="relative flex items-center justify-between gap-2 border-t border-border/50 pt-2 sm:pt-2.5 mt-auto">
        {sub && (
          <span className={cn('text-[8px] sm:text-[10.5px] font-semibold tracking-tight line-clamp-1', subVariantClasses[subVariant])}>
            {sub}
          </span>
        )}
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-[9px] sm:text-[10px] font-bold flex-shrink-0',
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
