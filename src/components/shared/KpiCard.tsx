import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface KpiCardProps {
  label: string
  value: string | number
  sub?: string
  subVariant?: 'neutral' | 'positive' | 'warning' | 'danger'
  trend?: { value: string; direction: 'up' | 'down' | 'neutral' }
  className?: string
}

const subVariantClasses = {
  neutral: 'text-text-muted',
  positive: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
}
export default function KpiCard({ label, value, sub, subVariant = 'neutral', trend, className }: KpiCardProps) {
  return (
    <div
      className={cn(
        'bg-background-secondary border border-border rounded-2xl p-5 flex flex-col gap-3 shadow-sm hover:shadow-md transition-all duration-200',
        className
      )}
    >
      <div className="text-[10px] uppercase tracking-[0.2em] font-black text-text-muted">{label}</div>
      <div className="text-[26px] font-black text-text-primary tracking-tighter leading-none italic">{value}</div>
      <div className="flex items-center justify-between gap-2 border-t border-border pt-2">
        {sub && (
          <span className={cn('text-[11px] font-bold uppercase tracking-tight', subVariantClasses[subVariant])}>{sub}</span>
        )}
...
        {trend && (
          <div className={cn(
            'flex items-center gap-1 text-[10.5px] font-medium',
            trend.direction === 'up' ? 'text-emerald-600' :
            trend.direction === 'down' ? 'text-red-600' : 'text-text-muted'
          )}>
            {trend.direction === 'up' ? <TrendingUp className="w-3 h-3" /> :
             trend.direction === 'down' ? <TrendingDown className="w-3 h-3" /> :
             <Minus className="w-3 h-3" />}
            {trend.value}
          </div>
        )}
      </div>
    </div>
  )
}
