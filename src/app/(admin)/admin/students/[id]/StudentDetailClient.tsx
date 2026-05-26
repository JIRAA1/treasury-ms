'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StatusPill from '@/components/payments/StatusPill'
import { formatCurrency, formatDate, getWeekLabel } from '@/lib/utils'
import { Banknote, Check, X, Edit, Trash2, Link2Off, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import EditStudentModal from '@/components/admin/EditStudentModal'
import type { WeekStatus } from '@/types'

interface WeekRow extends WeekStatus {
  title?: string
  deadline?: string
}

interface StudentDetailClientProps {
  student: Record<string, unknown>
  weekStatuses: WeekRow[]
  actorRole: string
  profileActionsOnly?: boolean
}

export default function StudentDetailClient({ student, weekStatuses, actorRole, profileActionsOnly = false }: StudentDetailClientProps) {
  const router = useRouter()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const isAdmin = actorRole === 'admin'
  const isTreasurer = actorRole === 'treasurer' || isAdmin

  // ---- Cash payment ----
  const handleCashPayment = async (ws: WeekRow) => {
    if (!confirm(`ยืนยันรับเงินสดจำนวน ${formatCurrency(ws.amount)} สำหรับ "${ws.title || `งวดที่ ${ws.week}`}" ใช่หรือไม่?`)) return
    setLoadingId(`cash-${ws.week}`)
    try {
      const paymentData = {
        user_id: student.id as string,
        week: ws.week,
        amount: ws.amount,
        status: 'approved',
        note: 'ชำระด้วยเงินสด (บันทึกโดยเหรัญญิก)',
        verified_at: new Date().toISOString(),
      }

      let paymentId: string
      if (ws.payment?.id) {
        const res = await fetch(`/api/payments/verify`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ws.payment.id, action: 'approve' }),
        })
        if (!res.ok) throw new Error((await res.json()).error)
        paymentId = ws.payment.id
      } else {
        const res = await fetch('/api/payments/cash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(paymentData),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        paymentId = data.payment.id
      }

      // Send notify
      await fetch('/api/payments/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: paymentId, action: 'notify_only', type: 'cash_success' }),
      })

      toast.success('บันทึกการชำระเงินสดเรียบร้อย')
      router.refresh()
    } catch (e: unknown) {
      toast.error('เกิดข้อผิดพลาด: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoadingId(null)
    }
  }

  // ---- Toggle payment status ----
  const handleToggleStatus = async (ws: WeekRow, newStatus: 'approved' | 'rejected' | 'pending') => {
    if (!ws.payment?.id) return
    const label = newStatus === 'approved' ? 'อนุมัติ' : newStatus === 'rejected' ? 'ปฏิเสธ' : 'ยกเลิกการอนุมัติ'
    if (!confirm(`ยืนยัน${label}รายการงวดที่ ${ws.week}?`)) return

    setLoadingId(`toggle-${ws.week}`)
    try {
      const res = await fetch('/api/payments/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ws.payment.id, action: newStatus === 'approved' ? 'approve' : 'reject' }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(`อัปเดตสถานะเป็น "${label}" เรียบร้อย`)
      router.refresh()
    } catch (e: unknown) {
      toast.error('เกิดข้อผิดพลาด: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoadingId(null)
    }
  }

  // ---- Reset LINE binding / Auth user ----
  const handleResetBinding = async () => {
    if (!confirm(`ล้างข้อมูลผูกบัญชีของ "${student.fullname as string}" ใช่หรือไม่? นักศึกษาจะต้องทำการผูกบัญชี (Login ด้วย LINE) ใหม่อีกครั้ง`)) return
    setLoadingId('binding')
    try {
      const res = await fetch(`/api/students/${student.id}/binding`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('ล้างข้อมูลผูกบัญชีเรียบร้อยแล้ว')
      router.refresh()
    } catch (e: unknown) {
      toast.error('เกิดข้อผิดพลาด: ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoadingId(null)
    }
  }

  // ---- Delete student ----
  const handleDelete = async () => {
    if (!confirm(`⚠️ ลบนักศึกษา "${student.fullname as string}" และประวัติทั้งหมดถาวร? ไม่สามารถกู้คืนได้`)) return
    if (!confirm('ยืนยันอีกครั้ง — ข้อมูลจะหายถาวร')) return
    setLoadingId('delete')
    try {
      const res = await fetch(`/api/students/${student.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('ลบข้อมูลนักศึกษาเรียบร้อยแล้ว')
      router.push('/admin/students')
    } catch (e: unknown) {
      toast.error('ลบไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
      setLoadingId(null)
    }
  }

  // ---- Profile-only mode: only render Edit/ResetLINE/Delete buttons ----
  if (profileActionsOnly) {
    return (
      <>
        {isAdmin && (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => setIsEditOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-background border border-border text-text-primary text-[12px] font-medium rounded-lg hover:bg-background-tertiary transition-colors w-full justify-center"
            >
              <Edit className="w-3.5 h-3.5" />
              แก้ไขข้อมูล
            </button>

            <button
              onClick={handleResetBinding}
              disabled={loadingId === 'binding'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 text-[12px] font-medium rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors w-full justify-center disabled:opacity-50"
            >
              {loadingId === 'binding' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2Off className="w-3.5 h-3.5" />}
              ล้างข้อมูลการเข้าสู่ระบบ
            </button>

            <button
              onClick={handleDelete}
              disabled={loadingId === 'delete'}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 text-[12px] font-medium rounded-lg border border-red-100 hover:bg-red-100 transition-colors w-full justify-center disabled:opacity-50 mt-1"
            >
              {loadingId === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              ลบนักศึกษา
            </button>
          </div>
        )}

        <EditStudentModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          student={student}
        />
      </>
    )
  }

  // ---- Full mode: render week payment rows ----
  return (
    <>
      {/* Week payment rows — actions per row */}
      <div className="divide-y divide-border">
        {weekStatuses.map((ws) => {
          const isLoading = loadingId === `cash-${ws.week}` || loadingId === `toggle-${ws.week}`
          return (
            <div key={ws.week} className="flex items-center justify-between px-5 py-3.5 hover:bg-background-tertiary/30 transition-colors">
              {/* Left: week label */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-background-tertiary flex items-center justify-center">
                  <span className="text-[11px] font-bold text-text-secondary">{getWeekLabel(ws.week)}</span>
                </div>
                <div>
                  <div className="text-[12.5px] font-medium text-text-primary">
                    {ws.title || `งวดที่ ${ws.week}`}
                  </div>
                  {ws.deadline && (
                    <div className="text-[10.5px] text-text-muted">
                      ครบกำหนด: {formatDate(ws.deadline)}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: amount + status + actions */}
              <div className="flex items-center gap-4">
                {ws.payment ? (
                  <div className="text-right">
                    <div className="text-[12.5px] font-semibold text-text-primary">{formatCurrency(ws.payment.amount)}</div>
                    <div className="text-[10.5px] text-text-muted">{formatDate(ws.payment.created_at)}</div>
                  </div>
                ) : (
                  <div className="text-[12px] text-text-muted">{formatCurrency(ws.amount)}</div>
                )}

                {ws.payment?.slip_url && (
                  <a
                    href={ws.payment.slip_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-text-muted hover:text-text-primary underline underline-offset-2 transition-colors"
                  >
                    ดูสลิป
                  </a>
                )}

                <StatusPill status={ws.status === 'paid' ? 'paid' : ws.status === 'pending' ? 'pending' : ws.status === 'rejected' ? 'rejected' : 'unpaid'} />

                {/* Admin/Treasurer actions per week */}
                {isTreasurer && (
                  <div className="flex items-center gap-1.5 ml-1">
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
                    ) : ws.status === 'paid' ? (
                      // Can revert to pending
                      <button
                        onClick={() => handleToggleStatus(ws, 'pending')}
                        title="ยกเลิกการอนุมัติ"
                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <>
                        {/* Approve pending slip */}
                        {ws.status === 'pending' && (
                          <button
                            onClick={() => handleToggleStatus(ws, 'approved')}
                            title="อนุมัติสลิป"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {/* Cash payment button — only for unpaid/rejected */}
                        {(ws.status === 'unpaid' || ws.status === 'rejected') && (
                          <button
                            onClick={() => handleCashPayment(ws)}
                            className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 text-[10.5px] font-bold rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-colors"
                          >
                            <Banknote className="w-3 h-3" />
                            เงินสด
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {weekStatuses.length === 0 && (
          <div className="py-12 text-center text-[13px] text-text-muted italic">
            ยังไม่มีข้อมูลงวดการชำระ
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {isAdmin && (
        <EditStudentModal
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          student={student}
        />
      )}
    </>
  )
}
