'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Topbar from '@/components/layout/Topbar'
import KpiCard from '@/components/shared/KpiCard'
import { formatCurrency } from '@/lib/utils'
import { Search, Filter, Mail, Users, ChevronRight, Loader2, UserPlus } from 'lucide-react'
import Link from 'next/link'
import AddStudentModal from '@/components/admin/AddStudentModal'

interface Student {
  id: string
  fullname: string
  student_id: string
  weeksPaid: number
  weeksPending: number
}

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'paid' | 'unpaid' | 'pending'>('all')
  const [totalCycles, setTotalCycles] = useState(0)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: settings } = await supabase.from('week_settings').select('week')
        const tCycles = settings?.length || 0
        setTotalCycles(tCycles)

        const { data: users } = await supabase.from('users').select('id, fullname, student_id').eq('role', 'student')
        const { data: payments } = await supabase.from('payments').select('user_id, status')

        const studentData = (users || []).map((u) => {
          const userPayments = payments?.filter((p) => p.user_id === u.id) || []
          return {
            ...u,
            weeksPaid: userPayments.filter((p) => p.status === 'approved').length,
            weeksPending: userPayments.filter((p) => p.status === 'pending').length,
          }
        })

        setStudents(studentData)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [supabase, isAddModalOpen]) // Refresh list when modal closes/opens

  const filtered = students.filter((s) => {
    const matchesSearch = s.fullname.toLowerCase().includes(search.toLowerCase()) || s.student_id.includes(search)
    if (!matchesSearch) return false
    
    if (filter === 'paid') return s.weeksPaid === totalCycles && totalCycles > 0
    if (filter === 'unpaid') return s.weeksPaid < totalCycles
    if (filter === 'pending') return s.weeksPending > 0
    return true
  })

  const fullyPaid = students.filter((s) => s.weeksPaid === totalCycles && totalCycles > 0).length

  return (
    <div>
      <Topbar 
        title="จัดการนักศึกษา" 
        subtitle="รายชื่อนักศึกษาและสถานะการชำระเงินรายคน" 
        actions={
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-brand text-white text-[12px] font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95"
          >
            <UserPlus className="w-4 h-4" />
            <span className="hidden sm:inline">เพิ่มรายชื่อ</span>
          </button>
        }
      />

      <div className="p-6 space-y-5">
        {/* KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <KpiCard label="ทั้งหมด" value={students.length} sub="คน" />
          <KpiCard label="ชำระครบแล้ว" value={fullyPaid} sub="คน" subVariant="positive" />
          <KpiCard label="ค้างชำระ" value={students.length - fullyPaid} sub="คน" subVariant="danger" />
          <KpiCard label="รวมงวดทั้งหมด" value={totalCycles} sub="งวด" />
        </div>

        <div className="bg-background-secondary border border-border rounded-[2rem] overflow-hidden shadow-sm">
          {/* Toolbar */}
          <div className="p-5 border-b border-border flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
              <input
                type="text"
                placeholder="ค้นหาชื่อ หรือรหัสนักศึกษา..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-[13px] font-bold border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-brand/10 transition-all shadow-inner"
              />
            </div>
            <div className="flex border border-border rounded-xl overflow-hidden p-1 bg-background shadow-inner">
              {(['all', 'paid', 'unpaid', 'pending'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-4 py-1.5 rounded-lg text-[11.5px] font-black uppercase tracking-tight transition-all ${
                    filter === f 
                      ? 'bg-brand text-white shadow-md' 
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {f === 'all' ? 'ทั้งหมด' : f === 'paid' ? 'ครบแล้ว' : f === 'unpaid' ? 'ยังค้าง' : 'รอตรวจ'}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="bg-background-tertiary/50 text-text-muted border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest">ชื่อ-นามสกุล</th>
                  <th className="px-6 py-4 text-left font-black text-[10px] uppercase tracking-widest">รหัสนักศึกษา</th>
                  <th className="px-6 py-4 text-center font-black text-[10px] uppercase tracking-widest">ความคืบหน้า</th>
                  <th className="px-6 py-4 text-center font-black text-[10px] uppercase tracking-widest">ค้างตรวจ</th>
                  <th className="px-6 py-4 text-right font-black text-[10px] uppercase tracking-widest">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {loading ? (
                  <tr><td colSpan={5} className="py-24 text-center text-text-muted"><Loader2 className="w-6 h-6 animate-spin mx-auto mb-3" /> กำลังโหลดข้อมูล...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={5} className="py-24 text-center text-text-muted italic text-[14px]">ไม่พบข้อมูลนักศึกษาที่ค้นหา</td></tr>
                ) : filtered.map((s) => (
                  <tr key={s.id} className="hover:bg-background-tertiary/30 transition-colors group relative">
                    <td className="px-6 py-4">
                      <div className="font-bold text-text-primary">{s.fullname}</div>
                    </td>
                    <td className="px-6 py-4 text-text-secondary font-mono font-bold tracking-tighter">{s.student_id}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className={`text-[11px] font-black italic ${s.weeksPaid === totalCycles && totalCycles > 0 ? 'text-emerald-600' : 'text-text-primary'}`}>
                          {s.weeksPaid} / {totalCycles} COMPLETED
                        </span>
                        <div className="w-28 h-1.5 bg-border rounded-full overflow-hidden shadow-inner">
                          <div 
                            className={`h-full transition-all duration-500 ${s.weeksPaid === totalCycles && totalCycles > 0 ? 'bg-emerald-500' : 'bg-brand'}`} 
                            style={{ width: `${totalCycles > 0 ? (s.weeksPaid / totalCycles) * 100 : 0}%` }} 
                          />
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {s.weeksPending > 0 ? (
                        <span className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-full border border-amber-100 font-black text-[10px] uppercase">{s.weeksPending} Items</span>
                      ) : (
                        <span className="text-text-disabled font-medium text-[11px]">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/admin/students/${s.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 text-text-muted hover:text-brand hover:bg-brand/5 border border-transparent hover:border-brand/10 rounded-xl transition-all group-hover:translate-x-0.5"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AddStudentModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
      />
    </div>
  )
}
