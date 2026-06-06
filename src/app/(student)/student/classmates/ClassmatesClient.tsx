'use client'

import { useState, useMemo } from 'react'
import Topbar from '@/components/layout/Topbar'
import { Search, CheckCircle, Clock, Minus, Users } from 'lucide-react'

interface Student {
  id: string
  fullname: string
  student_id: string
}

interface Payment {
  user_id: string
  period_id: string
  status: 'approved' | 'pending'
}

interface Period {
  id: string
  label: string
  amount: number
  period_order: number
}

interface Props {
  currentUserId: string
  students: Student[]
  payments: Payment[]
  periods: Period[]
}

type StatusCell = 'paid' | 'pending' | 'unpaid'

function getStatus(userId: string, periodId: string, payments: Payment[]): StatusCell {
  const p = payments.find(p => p.user_id === userId && p.period_id === periodId)
  if (!p) return 'unpaid'
  if (p.status === 'approved') return 'paid'
  return 'pending'
}

const STATUS_CONFIG = {
  paid: {
    label: 'จ่ายแล้ว',
    icon: CheckCircle,
    cell: 'text-emerald-600',
    bg: 'bg-emerald-50',
    border: 'border-emerald-100',
    dot: 'bg-emerald-500',
  },
  pending: {
    label: 'รอตรวจ',
    icon: Clock,
    cell: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-100',
    dot: 'bg-amber-400',
  },
  unpaid: {
    label: 'ยังไม่จ่าย',
    icon: Minus,
    cell: 'text-text-disabled',
    bg: 'bg-background-tertiary',
    border: 'border-border',
    dot: 'bg-border',
  },
}

export default function ClassmatesClient({ currentUserId, students, payments, periods }: Props) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() =>
    students.filter(s =>
      s.fullname.toLowerCase().includes(search.toLowerCase()) ||
      s.student_id.includes(search)
    ),
    [students, search]
  )

  const paidAllCount = students.filter(s =>
    periods.every(p => getStatus(s.id, p.id, payments) === 'paid')
  ).length

  return (
    <div className="pb-12">
      <Topbar
        title="รายชื่อในชั้นเรียน"
        subtitle={`${students.length} คน · ชำระครบ ${paidAllCount} คน`}
      />

      <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3">
          {(Object.entries(STATUS_CONFIG) as [StatusCell, typeof STATUS_CONFIG['paid']][]).map(([key, cfg]) => (
            <div key={key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold ${cfg.bg} ${cfg.border} ${cfg.cell}`}>
              <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </div>
          ))}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-brand/20 bg-brand/5 text-[11px] font-bold text-brand ml-auto">
            <span className="w-2 h-2 rounded-full bg-brand" />
            คุณ
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            placeholder="ค้นหาชื่อหรือรหัสนักศึกษา..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-[13px] font-medium border border-border rounded-xl bg-background-secondary outline-none focus:ring-2 focus:ring-brand/10 transition-all"
          />
        </div>

        {/* Table */}
        {periods.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-[14px] font-medium">ยังไม่มีกำหนดงวดการชำระ</p>
          </div>
        ) : (
          <div className="bg-background-secondary border border-border rounded-[2rem] overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]" style={{ minWidth: `${180 + periods.length * 110}px` }}>
                <thead className="bg-background-tertiary/60 border-b border-border">
                  <tr>
                    <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-widest text-text-muted w-8">#</th>
                    <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-widest text-text-muted">ชื่อ-นามสกุล</th>
                    <th className="px-5 py-4 text-left font-black text-[10px] uppercase tracking-widest text-text-muted">รหัส</th>
                    {periods.map(p => (
                      <th key={p.id} className="px-3 py-4 text-center font-black text-[10px] uppercase tracking-widest text-text-muted whitespace-nowrap">
                        <div>{p.label || `งวด ${p.period_order}`}</div>
                        <div className="text-brand font-black mt-0.5">฿{p.amount.toLocaleString()}</div>
                      </th>
                    ))}
                    <th className="px-5 py-4 text-center font-black text-[10px] uppercase tracking-widest text-text-muted">สรุป</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={3 + periods.length + 1} className="py-16 text-center text-text-muted text-[13px]">
                        ไม่พบรายชื่อที่ค้นหา
                      </td>
                    </tr>
                  ) : filtered.map((student, idx) => {
                    const isMe = student.id === currentUserId
                    const statuses = periods.map(p => getStatus(student.id, p.id, payments))
                    const paidCount = statuses.filter(s => s === 'paid').length
                    const pendingCount = statuses.filter(s => s === 'pending').length

                    return (
                      <tr
                        key={student.id}
                        className={`transition-colors ${
                          isMe
                            ? 'bg-brand/5 border-l-4 border-l-brand hover:bg-brand/10'
                            : 'hover:bg-background-tertiary/30'
                        }`}
                      >
                        {/* # */}
                        <td className="px-5 py-4 text-text-disabled font-bold">{idx + 1}</td>

                        {/* Name */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black flex-shrink-0 ${
                              isMe ? 'bg-brand text-white' : 'bg-background-tertiary text-text-secondary'
                            }`}>
                              {student.fullname?.[0] ?? '?'}
                            </div>
                            <span className={`font-bold truncate max-w-[140px] ${isMe ? 'text-brand' : 'text-text-primary'}`}>
                              {student.fullname}
                              {isMe && <span className="ml-1.5 text-[10px] font-black text-brand/60 uppercase">(คุณ)</span>}
                            </span>
                          </div>
                        </td>

                        {/* Student ID */}
                        <td className="px-5 py-4 font-mono text-text-secondary font-bold tracking-tighter">
                          {student.student_id}
                        </td>

                        {/* Per-period status */}
                        {periods.map((p, pi) => {
                          const status = statuses[pi]
                          const cfg = STATUS_CONFIG[status]
                          const Icon = cfg.icon
                          return (
                            <td key={p.id} className="px-3 py-4 text-center">
                              <div className={`inline-flex items-center justify-center w-7 h-7 rounded-full border ${cfg.bg} ${cfg.border}`}>
                                <Icon className={`w-3.5 h-3.5 ${cfg.cell}`} />
                              </div>
                            </td>
                          )
                        })}

                        {/* Summary */}
                        <td className="px-5 py-4 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className={`text-[12px] font-black ${
                              paidCount === periods.length ? 'text-emerald-600' : 'text-text-primary'
                            }`}>
                              {paidCount}/{periods.length}
                            </span>
                            {pendingCount > 0 && (
                              <span className="text-[10px] text-amber-500 font-bold">+{pendingCount} รอตรวจ</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Footer summary */}
            <div className="px-5 py-3 border-t border-border bg-background-tertiary/30 flex items-center justify-between">
              <span className="text-[11.5px] text-text-muted font-medium">
                แสดง {filtered.length} / {students.length} คน
              </span>
              <div className="flex items-center gap-4 text-[11px] font-bold">
                <span className="text-emerald-600">✓ ชำระครบ {paidAllCount} คน</span>
                <span className="text-text-muted">ค้างชำระ {students.length - paidAllCount} คน</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
