'use client'

import { useCountUp } from '@/hooks/useCountUp'

/**
 * Client-only animated number value inside KpiCard.
 * Used when the value is a plain number and animation is desired.
 */
export default function AnimatedValue({
  value,
  className,
}: {
  value: number
  className?: string
}) {
  const animated = useCountUp(value, 900)
  return <span className={className}>{animated.toLocaleString('th-TH')}</span>
}
