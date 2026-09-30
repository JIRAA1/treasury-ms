'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/utils'
import { sumMoney } from '@/lib/money'

type RecordRow = { id: string; type: 'income' | 'expense'; title: string; amount: number; created_at: string | null; approved_by: string | null }
type Semester = { id: string; name: string; is_active: boolean }
const keyOf = (row: RecordRow) => `${row.type}:${row.id}`

export default function AssignAccountingSemester() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [records, setRecords] = useState<RecordRow[]>([])
  const [semesters, setSemesters] = useState<Semester[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [semesterId, setSemesterId] = useState('')
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const busy = useRef(false)
  const visible = records.filter(row => (filter === 'all' || row.type === filter) && row.title.toLowerCase().includes(query.trim().toLowerCase()))
  const chosen = records.filter(row => selected.has(keyOf(row)))
  const selectedSemester = semesters.find(s => s.id === semesterId)
  const allVisibleSelected = visible.length > 0 && visible.every(row => selected.has(keyOf(row)))

  async function load() {
    setLoading(true); setError(''); setLoadFailed(false); setSelected(new Set())
    try {
      const res = await fetch('/api/reports/unassigned', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'โหลดรายการไม่สำเร็จ')
      setRecords(data.records); setSemesters(data.semesters)
    } catch (err) { setLoadFailed(true); setError(err instanceof Error ? err.message : 'โหลดรายการไม่สำเร็จ') }
    finally { setLoading(false) }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (busy.current || !selectedSemester || chosen.length === 0 || chosen.length > 200) return
    busy.current = true; setSaving(true); setError('')
    try {
      const res = await fetch('/api/reports/unassigned', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semester_id: semesterId, records: chosen.map(({ id, type }) => ({ id, type })) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ')
      toast.success(`จัดเข้าเทอม ${selectedSemester.name} แล้ว ${data.changed} รายการ${data.unchanged ? ` (อยู่ในเทอมนี้แล้ว ${data.unchanged} รายการ)` : ''}`)
      setOpen(false)
      router.refresh()
    } catch (err) { setError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ') }
    finally { busy.current = false; setSaving(false) }
  }

  return <>
    <button onClick={() => { setOpen(true); setSemesterId(''); setFilter('all'); setQuery(''); void load() }} className="mt-3 rounded-lg bg-amber-900 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-800">จัดเทอมให้รายการเก่า</button>
    <Dialog open={open} onOpenChange={value => { if (!saving && !loading) setOpen(value) }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogTitle>จัดเทอมให้รายรับ / รายจ่ายเก่า</DialogTitle>
        <DialogDescription>เลือกรายการที่เป็นของเทอมเดียวกัน แล้วเลือกเทอมที่จะจัดเข้า สามารถเลือกทีละรายการหรือหลายรายการพร้อมกันได้</DialogDescription>
        {loading ? <p role="status" className="py-6 text-center text-sm">กำลังโหลดรายการ...</p> : <form onSubmit={save} className="space-y-4">
          <fieldset disabled={saving || loadFailed} className="space-y-4 disabled:opacity-60">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-sm">ค้นหาชื่อรายการ<input value={query} onChange={e => setQuery(e.target.value)} className="mt-1 w-full rounded-lg border border-border p-2" /></label>
              <label className="text-sm">ประเภทรายการ<select value={filter} onChange={e => setFilter(e.target.value)} className="mt-1 w-full rounded-lg border border-border p-2"><option value="all">ทั้งหมด</option><option value="income">รายรับ</option><option value="expense">รายจ่าย</option></select></label>
              <label className="text-sm font-semibold">จัดเข้าเทอม<select required value={semesterId} onChange={e => setSemesterId(e.target.value)} className="mt-1 w-full rounded-lg border border-border p-2"><option value="">เลือกเทอม</option>{semesters.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' (ปัจจุบัน)' : ''}</option>)}</select></label>
            </div>
            {!semesters.length && <p className="text-sm text-amber-800">ยังไม่มีเทอม กรุณาสร้างเทอมที่หน้าตั้งค่าก่อน</p>}
            <div className="max-h-80 overflow-auto rounded-lg border border-border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-background-secondary"><tr>
                  <th className="p-3"><input type="checkbox" aria-label="เลือกทุกรายการที่แสดง" checked={allVisibleSelected} disabled={!visible.length} onChange={e => setSelected(current => { const next = new Set(current); visible.forEach(row => { if (e.target.checked) next.add(keyOf(row)); else next.delete(keyOf(row)) }); return next })} /></th>
                  <th className="p-3">ประเภท</th><th className="p-3">วันที่บันทึก</th><th className="p-3">รายการ</th><th className="p-3 text-right">จำนวนเงิน</th><th className="p-3">สถานะ</th>
                </tr></thead>
                <tbody>{visible.map(row => <tr key={keyOf(row)} className="border-t border-border">
                  <td className="p-3"><input type="checkbox" aria-label={`เลือก${row.type === 'income' ? 'รายรับ' : 'รายจ่าย'} ${row.title}`} checked={selected.has(keyOf(row))} onChange={e => setSelected(current => { const next = new Set(current); if (e.target.checked) next.add(keyOf(row)); else next.delete(keyOf(row)); return next })} /></td>
                  <td className={`p-3 whitespace-nowrap ${row.type === 'income' ? 'text-emerald-700' : 'text-red-600'}`}>{row.type === 'income' ? 'รายรับ' : 'รายจ่าย'}</td>
                  <td className="p-3 whitespace-nowrap">{row.created_at ? new Date(row.created_at).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok' }) : 'ไม่ระบุ'}</td>
                  <td className="p-3 min-w-40">{row.title}</td><td className="p-3 text-right whitespace-nowrap">{formatCurrency(Number(row.amount))}</td><td className="p-3 whitespace-nowrap">{row.approved_by ? 'อนุมัติแล้ว' : 'รออนุมัติ'}</td>
                </tr>)}{!visible.length && <tr><td colSpan={6} className="p-6 text-center text-text-muted">{records.length ? 'ไม่พบรายการตามตัวกรอง' : 'ไม่มีรายการที่ยังไม่ได้ระบุเทอม'}</td></tr>}</tbody>
              </table>
            </div>
            <div className="rounded-lg bg-background-secondary p-3 text-sm space-y-1">
              <p>เลือกทั้งหมด <strong>{chosen.length}</strong> รายการ · รายรับ {formatCurrency(sumMoney(chosen.filter(r => r.type === 'income').map(r => Number(r.amount))))} · รายจ่าย {formatCurrency(sumMoney(chosen.filter(r => r.type === 'expense').map(r => Number(r.amount))))}</p>
              <p>เทอมปลายทาง: <strong>{selectedSemester?.name || 'ยังไม่ได้เลือก'}</strong></p>
              <p className="text-xs text-text-muted">ยอดรวมข้างต้นรวมรายการรออนุมัติด้วย รายงานจะนับเฉพาะรายการที่อนุมัติแล้ว</p>
              {chosen.length > 200 && <p className="text-red-600">เลือกได้ครั้งละไม่เกิน 200 รายการ</p>}
            </div>
          </fieldset>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => void load()} className="rounded-lg border border-border px-3 py-2 text-sm">โหลดรายการใหม่</button>
            <button type="button" disabled={saving} onClick={() => setOpen(false)} className="rounded-lg border border-border px-3 py-2 text-sm">ยกเลิก</button>
            <button type="submit" disabled={saving || loadFailed || !selectedSemester || !chosen.length || chosen.length > 200} className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50">{saving ? 'กำลังบันทึก...' : `ยืนยันจัดเทอม ${chosen.length} รายการ`}</button>
          </div>
        </form>}
      </DialogContent>
    </Dialog>
  </>
}
