import { cn } from '@/lib/utils'
import { CheckCircle2, Clock4, XCircle, Circle } from 'lucide-react'

type StatusVariant = 'paid' | 'pending' | 'rejected' | 'unpaid'
type SizeVariant = 'sm' | 'lg'

interface StatusPillProps {
  status: StatusVariant
  note?: string | null
  size?: SizeVariant
  className?: string
}

const config: Record<StatusVariant, {
  label: string
  icon: typeof CheckCircle2
  pill: string
  glow?: string
}> = {
  paid: {
    label: 'ชำระแล้ว',
    icon: CheckCircle2,
    pill: 'bg-emerald-600 text-white border-emerald-600',
    glow: 'status-paid-glow',
  },
  pending: {
    label: 'รอตรวจสอบ',
    icon: Clock4,
    pill: 'bg-amber-50 text-amber-700 border-amber-200',
    glow: 'status-pending-glow',
  },
  rejected: {
    label: 'ถูกปฏิเสธ',
    icon: XCircle,
    pill: 'bg-red-50 text-red-700 border-red-200',
  },
  unpaid: {
    label: 'ยังไม่ชำระ',
    icon: Circle,
    pill: 'bg-background-muted text-text-secondary border-border',
  },
}

const sizeStyles: Record<SizeVariant, { pill: string; icon: string; text: string }> = {
  sm: { pill: 'px-2 sm:px-2.5 py-0.5 gap-1 sm:gap-1.5',  icon: 'w-2.5 sm:w-3 h-2.5 sm:h-3',    text: 'text-[9.5px] sm:text-[10.5px]' },
  lg: { pill: 'px-3.5 py-1.5 gap-2',    icon: 'w-4 h-4',    text: 'text-[13px]' },
}

export default function StatusPill({ status, note, size = 'sm', className }: StatusPillProps) {
  const cfg = config[status]
  const sz  = sizeStyles[size]
  const Icon = cfg.icon
  const isCash = note?.includes('เงินสด')

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-bold uppercase tracking-wider',
        'transition-all duration-200',
        cfg.pill,
        cfg.glow,
        sz.pill,
        sz.text,
        className
      )}
    >
      <Icon className={cn(sz.icon, 'flex-shrink-0')} />
      {status === 'paid' && isCash ? 'ชำระแล้ว (เงินสด)' : cfg.label}
    </span>
  )
}
