'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import StatusPill from '@/components/payments/StatusPill'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Banknote, Check, X, Edit, Trash2, Link2Off, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import EditStudentModal from '@/components/admin/EditStudentModal'
import { useDialog } from '@/components/shared/GlobalDialog'
import type { PeriodStatus } from '@/types'

interface StudentDetailClientProps {
  student: Record<string, unknown>
  periodStatuses: PeriodStatus[]
  actorRole: string
  profileActionsOnly?: boolean
}

export default function StudentDetailClient({ student, periodStatuses, actorRole, profileActionsOnly = false }: StudentDetailClientProps) {
  const router = useRouter()
  const dialog = useDialog()
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const isAdmin = actorRole === 'admin'
  const isTreasurer = actorRole === 'treasurer' || isAdmin

  // ---- Cash payment ----
  const handleCashPayment = (ps: PeriodStatus) => {
    dialog.show({
      type: 'confirm',
      title: 'รับเงินสด',
      message: `ยืนยันรับเงินสดจำนวน ${formatCurrency(ps.period.amount)} สำหรับ "${ps.period.label}" ใช่หรือไม่?`,
      confirmText: '✓ บันทึกเงินสด',
      onConfirm: async () => {
        dialog.setLoading(true)
        setLoadingId(`cash-${ps.period.id}`)
        try {
          const paymentData = {
            user_id: student.id as string,
            period_id: ps.period.id,
            amount: ps.period.amount,
            status: 'approved',
            note: 'ชำระด้วยเงินสด (บันทึกโดยเหรัญญิก)',
            verified_at: new Date().toISOString(),
          }

          let paymentId: string
          if (ps.payment?.id) {
            const res = await fetch(`/api/payments/verify`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: ps.payment.id, action: 'approve' }),
            })
            if (!res.ok) throw new Error((await res.json()).error)
            paymentId = ps.payment.id
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
          dialog.hide()
          router.refresh()
        } catch (e: unknown) {
          toast.error('เกิดข้อผิดพลาด: ' + (e instanceof Error ? e.message : String(e)))
          dialog.setLoading(false)
        } finally {
          setLoadingId(null)
        }
      },
    })
  }

  // ---- Toggle payment status ----
  const handleToggleStatus = (ps: PeriodStatus, newStatus: 'approved' | 'rejected' | 'pending') => {
    if (!ps.payment?.id) return
    const label = newStatus === 'approved' ? 'อนุมัติ' : newStatus === 'rejected' ? 'ปฏิเสธ' : 'ยกเลิกการอนุมัติ'
    const isDestructive = newStatus === 'rejected' || newStatus === 'pending'
    dialog.show({
      type: isDestructive ? 'warning' : 'confirm',
      title: `${label}รายการชำระเงิน`,
      message: `ยืนยัน${label}รายการ "${ps.period.label}"?`,
      confirmText: `✓ ${label}`,
      onConfirm: async () => {
        dialog.setLoading(true)
        setLoadingId(`toggle-${ps.period.id}`)
        try {
          const res = await fetch('/api/payments/verify', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: ps.payment!.id, action: newStatus === 'approved' ? 'approve' : 'reject' }),
          })
          if (!res.ok) throw new Error((await res.json()).error)
          toast.success(`อัปเดตสถานะเป็น "${label}" เรียบร้อย`)
          dialog.hide()
          router.refresh()
        } catch (e: unknown) {
          toast.error('เกิดข้อผิดพลาด: ' + (e instanceof Error ? e.message : String(e)))
          dialog.setLoading(false)
        } finally {
          setLoadingId(null)
        }
      },
    })
  }

  // ---- Reset LINE binding / Auth user ----
  const handleResetBinding = () => {
    dialog.show({
      type: 'warning',
      title: 'ล้างข้อมูลการเข้าสู่ระบบ',
      message: `ล้างข้อมูลผูกบัญชีของ "${student.fullname as string}" ใช่หรือไม่? นักศึกษาจะต้องทำการผูกบัญชี (Login ด้วย LINE) ใหม่อีกครั้ง`,
      confirmText: 'ล้างข้อมูล',
      onConfirm: async () => {
        dialog.setLoading(true)
        setLoadingId('binding')
        try {
          const res = await fetch(`/api/students/${student.id}/binding`, { method: 'DELETE' })
          if (!res.ok) throw new Error((await res.json()).error)
          toast.success('ล้างข้อมูลผูกบัญชีเรียบร้อยแล้ว')
          dialog.hide()
          router.refresh()
        } catch (e: unknown) {
          toast.error('เกิดข้อผิดพลาด: ' + (e instanceof Error ? e.message : String(e)))
          dialog.setLoading(false)
        } finally {
          setLoadingId(null)
        }
      },
    })
  }

  // ---- Delete student ----
  const handleDelete = () => {
    dialog.show({
      type: 'error',
      title: '⚠️ ลบนักศึกษา',
      message: `ลบนักศึกษา "${student.fullname as string}" และประวัติทั้งหมดถาวร? ไม่สามารถกู้คืนได้`,
      confirmText: 'ลบถาวร',
      onConfirm: async () => {
        dialog.setLoading(true)
        setLoadingId('delete')
        try {
          const res = await fetch(`/api/students/${student.id}`, { method: 'DELETE' })
          if (!res.ok) throw new Error((await res.json()).error)
          toast.success('ลบข้อมูลนักศึกษาเรียบร้อยแล้ว')
          dialog.hide()
          router.push('/admin/students')
        } catch (e: unknown) {
          toast.error('ลบไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e)))
          dialog.setLoading(false)
          setLoadingId(null)
        }
      },
    })
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

  // ---- Full mode: render period payment rows ----
  return (
    <>
      <div className="divide-y divide-border">
        {periodStatuses.map((ps) => {
          const isLoading = loadingId === `cash-${ps.period.id}` || loadingId === `toggle-${ps.period.id}`
          return (
            <div key={ps.period.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-background-tertiary/30 transition-colors">
              {/* Left: period label */}
              <div className="flex items-center gap-3">
                <div className="w-16 h-8 rounded-lg bg-background-tertiary flex items-center justify-center flex-shrink-0 px-1 border border-border">
                  <span className="text-[10px] font-bold text-text-secondary truncate">{ps.period.label}</span>
                </div>
                <div>
                  <div className="text-[12.5px] font-medium text-text-primary">
                    {ps.period.label}
                  </div>
                  {ps.period.deadline && (
                    <div className="text-[10.5px] text-text-muted">
                      ครบกำหนด: {formatDate(ps.period.deadline)}
                    </div>
                  )}
                </div>
              </div>

              {/* Right: amount + status + actions */}
              <div className="flex items-center gap-4">
                {ps.payment ? (
                  <div className="text-right">
                    <div className="text-[12.5px] font-semibold text-text-primary">{formatCurrency(ps.payment.amount)}</div>
                    <div className="text-[10.5px] text-text-muted">{formatDate(ps.payment.created_at)}</div>
                  </div>
                ) : (
                  <div className="text-[12px] text-text-muted">{formatCurrency(ps.period.amount)}</div>
                )}

                {ps.payment?.slip_url && (
                  <a
                    href={ps.payment.slip_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-text-muted hover:text-text-primary underline underline-offset-2 transition-colors"
                  >
                    ดูสลิป
                  </a>
                )}

                <StatusPill status={ps.status} />

                {/* Admin/Treasurer actions per period */}
                {isTreasurer && (
                  <div className="flex items-center gap-1.5 ml-1">
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-text-muted" />
                    ) : ps.status === 'paid' ? (
                      <button
                        onClick={() => handleToggleStatus(ps, 'pending')}
                        title="ยกเลิกการอนุมัติ"
                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors border border-transparent hover:border-amber-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <>
                        {ps.status === 'pending' && (
                          <button
                            onClick={() => handleToggleStatus(ps, 'approved')}
                            title="อนุมัติสลิป"
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-transparent hover:border-emerald-100"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {(ps.status === 'unpaid' || ps.status === 'rejected') && (
                          <button
                            onClick={() => handleCashPayment(ps)}
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

        {periodStatuses.length === 0 && (
          <div className="py-12 text-center text-[13px] text-text-muted italic">
            ยังไม่มีข้อมูลงวดการชำระในเทอมนี้
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
