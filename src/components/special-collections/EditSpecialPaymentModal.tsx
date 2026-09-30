'use client'

import { useState } from 'react'
import type { SpecialCollection, SpecialCollectionItem, SpecialCollectionSlip } from '@/types'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { isPositiveMoney, sumMoney } from '@/lib/money'

export default function EditSpecialPaymentModal({ item, collection, onClose, onSaved }: {
  item: SpecialCollectionItem; collection: SpecialCollection; onClose: () => void; onSaved: () => void
}) {
  const [mode, setMode] = useState(item.payment_mode || 'full')
  const [installments, setInstallments] = useState(String(item.chosen_installments || 2))
  const [slips, setSlips] = useState(() => (item.slips || []).map(s => ({ ...s, inputAmount: String(s.amount) })))
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const total = sumMoney(slips.filter(s => s.status === 'approved').map(s => isPositiveMoney(Number(s.inputAmount)) ? Number(s.inputAmount) : 0))
  const inputClass = 'w-full rounded-lg border border-border bg-white p-2 text-sm'

  async function save(event: React.FormEvent) {
    event.preventDefault()
    setError('')
    if (slips.some(s => !isPositiveMoney(Number(s.inputAmount)))) { setError('กรุณากรอกยอดสลิปมากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง'); return }
    if (total > Number(item.amount)) { setError('ยอดอนุมัติรวมเกินยอดที่ต้องชำระ'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/special-collections/items/${item.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_mode: mode, chosen_installments: mode === 'full' ? 1 : Number(installments), reason,
          slips: slips.map(s => ({ id: s.id, amount: Number(s.inputAmount), status: s.status })),
          expected: { payment_mode: item.payment_mode, chosen_installments: item.chosen_installments,
            amount: Number(item.amount), paid_amount: Number(item.paid_amount),
            slips: [...(item.slips || [])].sort((a, b) => a.id.localeCompare(b.id)).map(s => ({ id: s.id, amount: Number(s.amount), status: s.status })) },
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
      onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ') }
    finally { setSaving(false) }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
      <DialogTitle>แก้ไขการชำระเงิน — {item.user?.fullname}</DialogTitle>
      <DialogDescription>แก้ยอดตามสลิปจริง หรือคืนรายการที่อนุมัติผิดเป็นรอตรวจสอบ ยอดรับเงินจะปรับตามสลิปที่อนุมัติ และบันทึกประวัติการแก้ไข</DialogDescription>
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
          <label className="block text-sm">รูปแบบการจ่าย
            <select className={inputClass} value={mode} onChange={e => { setMode(e.target.value as 'full' | 'installment'); if (Number(installments) < 2) setInstallments('2') }}>
              <option value="full">จ่ายเต็ม</option>
              {(collection.allow_installments || item.payment_mode === 'installment') && <option value="installment">ผ่อนชำระ</option>}
            </select>
          </label>
          {mode === 'installment' && <label className="block text-sm">จำนวนงวด
            <input required className={inputClass} type="number" min={2} max={Math.max(collection.max_installments, item.chosen_installments || 2)} step={1} value={installments} onChange={e => setInstallments(e.target.value)} />
          </label>}
          <p className="text-xs text-text-secondary">หากจ่ายเต็มแต่เลือกผ่อน ให้เลือก “จ่ายเต็ม” และแก้ยอดสลิปเป็นยอดที่ได้รับจริงก่อนอนุมัติ</p>
          {slips.length === 0 && <p className="text-sm">ยังไม่มีสลิป สามารถแก้รูปแบบการจ่ายได้</p>}
          {slips.map((slip, index) => <div key={slip.id} className="rounded-xl border border-border p-3 space-y-2">
            <a href={slip.slip_url} target="_blank" rel="noreferrer" className="text-sm text-brand underline">ดูสลิปครั้งที่ {slip.installment_no}</a>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">ยอดในสลิป (บาท)
                <input required type="number" min="0.01" max="999999999.99" step="0.01" className={inputClass} value={slip.inputAmount} onChange={e => setSlips(current => current.map((s, i) => i === index ? { ...s, inputAmount: e.target.value } : s))} />
              </label>
              <label className="text-sm">สถานะสลิป
                <select className={inputClass} value={slip.status} onChange={e => setSlips(current => current.map((s, i) => i === index ? { ...s, status: e.target.value as SpecialCollectionSlip['status'] } : s))}>
                  <option value="pending">รอตรวจสอบ</option><option value="approved">อนุมัติ</option><option value="rejected">ปฏิเสธ</option>
                </select>
              </label>
            </div>
          </div>)}
          <p className="text-sm font-semibold">ยอดที่อนุมัติหลังแก้ไข ฿{total.toLocaleString()} / ฿{Number(item.amount).toLocaleString()}</p>
          <label className="block text-sm">เหตุผลการแก้ไข (จำเป็น)
            <textarea required maxLength={1000} className={inputClass} value={reason} onChange={e => setReason(e.target.value)} placeholder="เช่น นักเรียนจ่ายเต็ม แต่เลือกรูปแบบผ่อนผิด" />
          </label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">ยกเลิก</button>
            <button type="submit" disabled={!reason.trim()} className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}</button>
          </div>
        </fieldset>
      </form>
    </DialogContent>
  </Dialog>
}
