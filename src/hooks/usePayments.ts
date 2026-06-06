'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Payment, PeriodStatus } from '@/types'
import { toast } from 'sonner'

export function usePayments(userId?: string) {
  const supabase = createClient()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchPayments = useCallback(async () => {
    if (!userId) return
    
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*, user:users(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })

      if (error) throw error
      setPayments(data as Payment[])
    } catch (error: any) {
      console.error('Error fetching payments:', error)
      toast.error('ไม่สามารถโหลดข้อมูลการชำระเงินได้')
    } finally {
      setLoading(false)
    }
  }, [supabase, userId])

  const fetchAllPayments = useCallback(async (filters?: { status?: string, period_id?: string }) => {
    setLoading(true)
    try {
      let query = supabase
        .from('payments')
        .select('*, user:users(*)')
        .order('created_at', { ascending: false })

      if (filters?.status && filters.status !== 'all') {
        query = query.eq('status', filters.status)
      }
      if (filters?.period_id) {
        query = query.eq('period_id', filters.period_id)
      }

      const { data, error } = await query

      if (error) throw error
      setPayments(data as Payment[])
    } catch (error: any) {
      console.error('Error fetching all payments:', error)
      toast.error('ไม่สามารถโหลดข้อมูลการชำระเงินได้')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const verifyPayment = async (id: string, action: 'approved' | 'rejected', reason?: string) => {
    try {
      const { error } = await supabase
        .from('payments')
        .update({ 
          status: action,
          verified_at: action === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', id)

      if (error) throw error

      setPayments(prev => prev.map(p => p.id === id ? { ...p, status: action } : p))
      toast.success(action === 'approved' ? 'อนุมัติการชำระเงินแล้ว' : 'ปฏิเสธการชำระเงินแล้ว')
      
      // Notification logic would typically be handled by a Supabase Edge Function or API route
      // to trigger LINE messages.
    } catch (error) {
      console.error('Error verifying payment:', error)
      toast.error('ทำรายการไม่สำเร็จ')
    }
  }

  useEffect(() => {
    if (userId) {
      fetchPayments()
    }
  }, [userId, fetchPayments])

  return {
    payments,
    loading,
    fetchPayments,
    fetchAllPayments,
    verifyPayment,
  }
}
