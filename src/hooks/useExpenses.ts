'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Expense } from '@/types'
import { toast } from 'sonner'

export function useExpenses() {
  const supabase = createClient()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)

  const fetchExpenses = useCallback(async (onlyApproved = false) => {
    setLoading(true)
    try {
      let query = supabase
        .from('expenses')
        .select('*, creator:users!created_by(fullname), approver:users!approved_by(fullname)')
        .order('created_at', { ascending: false })

      if (onlyApproved) {
        query = query.not('approved_by', 'is', null)
      }

      const { data, error } = await query

      if (error) throw error
      setExpenses(data as any[])
    } catch (error: any) {
      console.error('Error fetching expenses:', error)
      toast.error('ไม่สามารถโหลดข้อมูลรายจ่ายได้')
    } finally {
      setLoading(false)
    }
  }, [supabase])

  const addExpense = async (expenseData: Partial<Expense>) => {
    try {
      const { data, error } = await supabase
        .from('expenses')
        .insert(expenseData)
        .select()
        .single()

      if (error) throw error
      
      setExpenses(prev => [data as Expense, ...prev])
      toast.success('เพิ่มรายการรายจ่ายแล้ว')
      return data
    } catch (error) {
      console.error('Error adding expense:', error)
      toast.error('เพิ่มรายการไม่สำเร็จ')
      return null
    }
  }

  const approveExpense = async (id: string, adminId: string) => {
    try {
      const { error } = await supabase
        .from('expenses')
        .update({ approved_by: adminId })
        .eq('id', id)

      if (error) throw error

      setExpenses(prev => prev.map(e => e.id === id ? { ...e, approved_by: adminId } : e))
      toast.success('อนุมัติรายการรายจ่ายแล้ว')
    } catch (error) {
      console.error('Error approving expense:', error)
      toast.error('ทำรายการไม่สำเร็จ')
    }
  }

  return {
    expenses,
    loading,
    fetchExpenses,
    addExpense,
    approveExpense,
  }
}
