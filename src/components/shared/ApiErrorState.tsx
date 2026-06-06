import { AlertTriangle, RefreshCw, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ApiErrorStateProps {
  title?: string
  message?: string
  type?: 'generic' | 'network' | 'notfound'
  onRetry?: () => void
  className?: string
}

const typeConfig = {
  generic:  { Icon: AlertTriangle, iconBg: 'bg-red-50', iconColor: 'text-red-500' },
  network:  { Icon: WifiOff,       iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
  notfound: { Icon: AlertTriangle, iconBg: 'bg-slate-50', iconColor: 'text-slate-500' },
}

export default function ApiErrorState({
  title = 'ไม่สามารถโหลดข้อมูลได้',
  message = 'กรุณาลองใหม่อีกครั้ง หรือตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
  type = 'generic',
  onRetry,
  className,
}: ApiErrorStateProps) {
  const { Icon, iconBg, iconColor } = typeConfig[type]

  return (
    <div className={cn(
      'flex flex-col items-center justify-center py-16 px-8 text-center',
      className
    )}>
      {/* Icon */}
      <div className={cn(
        'w-16 h-16 rounded-2xl flex items-center justify-center mb-5',
        iconBg,
        'shadow-[0_0_0_1px_rgba(0,0,0,0.06),0_4px_16px_rgba(0,0,0,0.06)]'
      )}>
        <Icon className={cn('w-7 h-7', iconColor)} />
      </div>

      <h3 className="text-[15px] font-bold text-text-primary mb-2 tracking-tight">{title}</h3>
      <p className="text-[12.5px] text-text-muted max-w-[260px] leading-relaxed mb-6">{message}</p>

      {onRetry && (
        <button
          onClick={onRetry}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-brand text-white text-[12.5px] font-bold rounded-xl hover:bg-brand-hover transition-all shadow-lg shadow-brand/10 active:scale-95"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          ลองใหม่
        </button>
      )}
    </div>
  )
}
