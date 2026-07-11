'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

/**
 * Hook for students to listen to payment updates in real-time,
 * show alerts, and check if there are unpaid cycles.
 */
export function useStudentPaymentStatus(userId: string | null | undefined, initialHasUnpaid = false) {
  const [hasUnpaidWeek, setHasUnpaidWeek] = useState(initialHasUnpaid)
  const supabase = useRef(createClient()).current
  const router = useRouter()

  const checkUnpaidStatus = async () => {
    if (!userId) return

    try {
      // 1. Get active semester
      const { data: semester } = await supabase
        .from('semesters')
        .select('id')
        .eq('is_active', true)
        .maybeSingle()

      if (!semester) {
        setHasUnpaidWeek(false)
        return
      }

      // 2. Fetch periods and payments in parallel
      const [periodsRes, paymentsRes] = await Promise.all([
        supabase
          .from('periods')
          .select('id, open_at, close_at')
          .eq('semester_id', semester.id),
        supabase
          .from('payments')
          .select('period_id, status')
          .eq('user_id', userId)
      ])

      const periods = periodsRes.data || []
      const payments = paymentsRes.data || []

      if (periods.length === 0) {
        setHasUnpaidWeek(false)
        return
      }

      const periodIds = new Set(periods.map(p => p.id))
      const now = new Date()

      // check if any payable period (not upcoming) is unpaid
      const hasUnpaid = periods.some((p) => {
        // filter out upcoming periods (not open yet)
        const openAt = p.open_at ? new Date(p.open_at) : null
        if (openAt && now < openAt) return false

        const pay = payments.find(
          (pay) => pay.period_id === p.id && (pay.status === 'approved' || pay.status === 'pending')
        )
        return !pay
      })

      setHasUnpaidWeek(hasUnpaid)
    } catch (err) {
      console.error('[useStudentPaymentStatus] check failed:', err)
    }
  }

  useEffect(() => {
    if (!userId) return

    // Run initial check
    checkUnpaidStatus()

    // Subscribe to student's payments
    const channel = supabase
      .channel(`student-payment-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payments',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          // Trigger check update
          checkUnpaidStatus()
          // Refresh route data so page content updates (e.g. Dashboard/Upload)
          router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return { hasUnpaidWeek }
}
