'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Subscribes to `payments` table via Supabase Realtime and keeps
 * `pendingCount` (status = 'pending') in sync without a full page refresh.
 *
 * Returns { pendingCount, pendingCredits } — both auto-update live.
 */
export function usePendingCount(initialPending = 0, initialCredits = 0) {
  const [pendingCount, setPendingCount] = useState(initialPending)
  const [pendingCredits, setPendingCredits] = useState(initialCredits)
  const supabase = useRef(createClient()).current

  // Fetch current counts from DB
  const refresh = async () => {
    const [paymentsRes, creditsRes] = await Promise.all([
      supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      supabase
        .from('payment_credits')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ])
    setPendingCount(paymentsRes.count ?? 0)
    setPendingCredits(creditsRes.count ?? 0)
  }

  useEffect(() => {
    // Initial fetch
    refresh()

    // Subscribe to payments changes
    const paymentChannel = supabase
      .channel('sidebar-pending-payments')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments' },
        () => { refresh() }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payment_credits' },
        () => { refresh() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(paymentChannel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { pendingCount, pendingCredits }
}
