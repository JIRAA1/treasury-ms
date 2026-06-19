'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Animates a number from 0 → target when it mounts or target changes.
 * `duration` in ms, defaults to 800ms.
 */
export function useCountUp(target: number, duration = 800, enabled = true) {
  const [value, setValue] = useState(enabled ? 0 : target)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const prevTarget = useRef(target)

  useEffect(() => {
    if (!enabled) {
      setValue(target)
      return
    }

    const startVal = prevTarget.current === target ? 0 : value
    prevTarget.current = target

    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    startRef.current = null

    const step = (ts: number) => {
      if (!startRef.current) startRef.current = ts
      const elapsed = ts - startRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out quad
      const eased = 1 - (1 - progress) * (1 - progress)
      setValue(Math.round(startVal + (target - startVal) * eased))
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step)
      }
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, enabled])

  return value
}
