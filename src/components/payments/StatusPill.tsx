import { cn } from '@/lib/utils'

type StatusVariant = 'paid' | 'pending' | 'rejected' | 'unpaid'

interface StatusPillProps {
  status: StatusVariant
  note?: string | null
  className?: string
}

const labels: Record<StatusVariant, string> = {
  paid: 'ชำระแล้ว',
  pending: 'รอตรวจสอบ',
  rejected: 'ถูกปฏิเสธ',
  unpaid: 'ยังไม่ชำระ',
}

const styles: Record<StatusVariant, string> = {
  paid: 'bg-emerald-600 text-white', // Changed to emerald for luxury green
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  rejected: 'bg-red-50 text-red-700 border border-red-200',
  unpaid: 'bg-background-muted text-text-secondary border border-border',
}

export default function StatusPill({ status, note, className }: StatusPillProps) {
  const isCash = note?.includes('เงินสด')
  
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider',
        styles[status],
        className
      )}
    >
      {status === 'paid' && isCash ? 'ชำระแล้ว (เงินสด)' : labels[status]}
    </span>
  )
}
