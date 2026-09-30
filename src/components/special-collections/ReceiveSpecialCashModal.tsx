'use client'

import { useRef, useState } from 'react'
import type { SpecialCollection, SpecialCollectionItem } from '@/types'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { isPositiveMoney, roundMoney } from '@/lib/money'

export default function ReceiveSpecialCashModal({ item, collection, onClose, onSaved }: {
  item: SpecialCollectionItem; collection: SpecialCollection; onClose: () => void; onSaved: () => void
}) {
  const remaining = roundMoney(Number(item.amount) - Number(item.paid_amount))
  const [mode, setMode] = useState<'full' | 'installment'>(item.payment_mode === 'installment' ? 'installment' : 'full')
  const [installments, setInstallments] = useState(String(Math.max(2, item.chosen_installments || 2)))
  const [amount, setAmount] = useState(String(item.payment_mode === 'installment' ? Math.min(remaining, Math.ceil(Number(item.amount) / Math.max(2, item.chosen_installments))) : remaining))
  const [note, setNote] = useState('')
  const [received, setReceived] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const attempt = useRef<{ fingerprint: string; id: string } | null>(null)
  const busy = useRef(false)
  const inputClass = 'w-full rounded-lg border border-border bg-white p-2 text-sm'
  const hasPending = item.slips?.some(s => s.status === 'pending')

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (busy.current) return
    setError('')
    const value = mode === 'full' ? remaining : Number(amount)
    if (!received || !isPositiveMoney(value) || value > remaining) { setError('กรุณาระบุยอดรับจริงไม่เกินยอดคงเหลือ และยืนยันการรับเงิน'); return }
    const payload = { amount: value, payment_mode: mode, chosen_installments: mode === 'full' ? 1 : Number(installments), note, received, expected_paid: Number(item.paid_amount) }
    const fingerprint = JSON.stringify(payload)
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, id: crypto.randomUUID() }
    busy.current = true
    setSaving(true)
    try {
      const res = await fetch(`/api/special-collections/items/${item.id}/cash`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, request_id: attempt.current.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
      onSaved()
    } catch (err) { setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ') }
    finally { busy.current = false; setSaving(false) }
  }

  return <Dialog open onOpenChange={open => { if (!open && !saving) onClose() }}>
    <DialogContent className="max-h-[90vh] overflow-y-auto bg-white">
      <DialogTitle>รับเงินสด — {item.user?.fullname}</DialogTitle>
      <DialogDescription>บันทึกยอดที่ได้รับจริง ระบบจะเพิ่มยอดชำระและรายรับทันที</DialogDescription>
      <p className="text-sm">ยอดทั้งหมด ฿{Number(item.amount).toLocaleString()} · รับแล้ว ฿{Number(item.paid_amount).toLocaleString()} · <strong>คงเหลือ ฿{remaining.toLocaleString()}</strong></p>
      {hasPending ? <p role="alert" className="text-sm text-amber-700">มีสลิปรอตรวจสอบ กรุณาตรวจหรือปฏิเสธสลิปเดิมก่อนรับเงินสด เพื่อป้องกันนับยอดซ้ำ</p> :
      <form onSubmit={save} className="space-y-4">
        <fieldset disabled={saving} className="space-y-4 disabled:opacity-60">
          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold">รูปแบบการจ่ายเงินสด</legend>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="cash-mode" value="full" checked={mode === 'full'} onChange={() => setMode('full')} /> จ่ายเต็ม / ปิดยอดคงเหลือ</label>
            <label className="flex items-center gap-2 text-sm"><input type="radio" name="cash-mode" value="installment" checked={mode === 'installment'} disabled={!collection.allow_installments && item.payment_mode !== 'installment'} onChange={() => { setMode('installment'); setAmount(String(Math.min(remaining, Math.ceil(Number(item.amount) / Number(installments))))) }} /> ผ่อนชำระ</label>
            {!collection.allow_installments && item.payment_mode !== 'installment' && <p className="text-xs text-text-muted">หากต้องการผ่อน ให้เปิดอนุญาตผ่อนในปุ่มแก้ไขรายการก่อน</p>}
          </fieldset>
          {mode === 'installment' && <label className="block text-sm">จำนวนงวดทั้งหมด<input required type="number" min={2} max={Math.max(collection.max_installments, item.chosen_installments || 2)} step={1} className={inputClass} value={installments} onChange={e => setInstallments(e.target.value)} /></label>}
          <label className="block text-sm">ยอดเงินสดที่รับครั้งนี้ (บาท)<input required type="number" min="0.01" max={remaining} step="0.01" className={inputClass} readOnly={mode === 'full'} value={mode === 'full' ? remaining : amount} onChange={e => setAmount(e.target.value)} /></label>
          <label className="block text-sm">หมายเหตุ (ถ้ามี)<textarea maxLength={1000} className={inputClass} value={note} onChange={e => setNote(e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input required type="checkbox" checked={received} onChange={e => setReceived(e.target.checked)} /> ได้รับเงินสดจำนวนนี้แล้ว</label>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2 text-sm">ยกเลิก</button><button type="submit" disabled={!received} className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? 'กำลังบันทึก...' : 'บันทึกรับเงินสด'}</button></div>
        </fieldset>
      </form>}
    </DialogContent>
  </Dialog>
}
