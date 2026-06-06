import { cn } from '@/lib/utils'

interface SkeletonCardProps {
  /** Number of text lines to render in the body */
  lines?: number
  /** Show a header section (icon + title placeholder) */
  hasHeader?: boolean
  /** Show a footer action button placeholder */
  hasFooter?: boolean
  /** Extra Tailwind classes on the outer card */
  className?: string
  /** Compact mode — reduced padding */
  compact?: boolean
}

function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn('shimmer rounded-lg', className)}
      aria-hidden="true"
    />
  )
}

export default function SkeletonCard({
  lines = 2,
  hasHeader = true,
  hasFooter = false,
  compact = false,
  className,
}: SkeletonCardProps) {
  const pad = compact ? 'p-4' : 'p-5'

  return (
    <div
      className={cn(
        'bg-background-secondary border border-border rounded-xl overflow-hidden',
        className,
      )}
      aria-busy="true"
      aria-label="กำลังโหลด..."
    >
      {hasHeader && (
        <div className={cn('flex items-center gap-3 border-b border-border', pad)}>
          <ShimmerBlock className="w-9 h-9 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <ShimmerBlock className="h-3.5 w-32" />
            <ShimmerBlock className="h-2.5 w-20" />
          </div>
          <ShimmerBlock className="h-6 w-16 rounded-full" />
        </div>
      )}

      <div className={cn('space-y-2.5', pad)}>
        {Array.from({ length: lines }).map((_, i) => (
          <ShimmerBlock
            key={i}
            className={cn(
              'h-3',
              // Vary widths for a more natural look
              i === 0 ? 'w-full' : i === lines - 1 ? 'w-2/3' : 'w-5/6',
            )}
          />
        ))}
      </div>

      {hasFooter && (
        <div className={cn('border-t border-border flex justify-end', pad)}>
          <ShimmerBlock className="h-8 w-24 rounded-lg" />
        </div>
      )}
    </div>
  )
}
