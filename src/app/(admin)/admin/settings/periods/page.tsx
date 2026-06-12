'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/layout/Topbar'
import { toast } from 'sonner'
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  ArrowLeft,
  MoveUp,
  MoveDown,
  GripVertical,
  Clock,
  HelpCircle,
  AlertTriangle,
} from 'lucide-react'
import { formatFineDescription } from '@/lib/fine'

interface Period {
  id?: string
  semester_id?: string
  label: string
  period_order: number
  amount: number
  base_amount: number
  late_fine_amount: number
  fine_type: 'flat' | 'daily' | 'per_period'
  fine_rate: number
  fine_cap: number | null
  fine_grace_days: number
  activity_type: 'small' | 'medium' | 'large' | null
  activity_extra_amount: number
  is_separate_collection: boolean
  qr_url: string | null
  open_at: string | null
  close_at: string | null
  deadline: string
}

function toLocalInput(isoStr?: string | null): string {
  if (!isoStr) return ''
  return new Date(new Date(isoStr).getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16)
}

function fromLocalInput(localStr: string): string {
  return new Date(localStr).toISOString()
}

export default function PeriodManagerPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const semesterId = searchParams.get('semester_id')

  const [semesterName, setSemesterName] = useState('')
  const [periods, setPeriods] = useState<Period[]>([])
  const [deletedPeriodIds, setDeletedPeriodIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const dragItem = useRef<number | null>(null)
  const dragOverItem = useRef<number | null>(null)

  useEffect(() => {
    if (!semesterId) {
      toast.error('ไม่พบรหัสภาคเรียน')
      router.push('/admin/settings')
      return
    }

    async function loadData() {
      try {
        // Fetch semester details
        const semRes = await fetch('/api/semesters')
        const semJson = await semRes.json()
        const currentSem = semJson.data?.find((s: any) => s.id === semesterId)
        if (currentSem) {
          setSemesterName(currentSem.name)
        }

        // Fetch periods
        const perRes = await fetch(`/api/semesters/${semesterId}/periods`)
        const perJson = await perRes.json()
        if (perRes.ok) {
          setPeriods(perJson.data ?? [])
        } else {
          throw new Error(perJson.error || 'Failed to fetch periods')
        }
      } catch (err: any) {
        toast.error('เกิดข้อผิดพลาด: ' + err.message)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [semesterId, router])

  const handleSave = async () => {
    // Basic validation
    for (const p of periods) {
      if (!p.label.trim()) {
        toast.error('กรุณาระบุชื่องวดให้ครบถ้วน')
        return
      }
      if (!p.deadline) {
        toast.error(`กรุณาระบุกำหนดชำระของงวด "${p.label}"`)
        return
      }
    }

    setSaving(true)
    try {
      const res = await fetch(`/api/semesters/${semesterId}/periods`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          periods,
          deletedPeriodIds,
        }),
      })

      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to save periods')

      toast.success('บันทึกงวดการชำระเงินเรียบร้อยแล้ว')
      router.push('/admin/settings')
    } catch (err: any) {
      toast.error('ไม่สามารถบันทึกได้: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const addPeriod = () => {
    const nextOrder = periods.length > 0 ? Math.max(...periods.map((p) => p.period_order)) + 1 : 1
    const newDeadline = new Date()
    newDeadline.setHours(23, 59, 0, 0)

    const newPeriod: Period = {
      label: `งวดที่ ${nextOrder}`,
      period_order: nextOrder,
      amount: 100,
      base_amount: 50,
      late_fine_amount: 0,
      fine_type: 'flat',
      fine_rate: 0,
      fine_cap: null,
      fine_grace_days: 0,
      activity_type: null,
      activity_extra_amount: 0,
      is_separate_collection: false,
      qr_url: null,
      open_at: null,
      close_at: null,
      deadline: newDeadline.toISOString(),
    }
    setPeriods([...periods, newPeriod])
  }

  const removePeriod = (index: number) => {
    const period = periods[index]
    if (period.id) {
      setDeletedPeriodIds([...deletedPeriodIds, period.id])
    }
    const updated = periods.filter((_, i) => i !== index)
    // Recalculate order to be consistent
    const reordered = updated.map((p, idx) => ({
      ...p,
      period_order: idx + 1,
    }))
    setPeriods(reordered)
  }

  const updatePeriod = (index: number, field: keyof Period, value: any) => {
    const updated = [...periods]
    updated[index] = { ...updated[index], [field]: value }
    setPeriods(updated)
  }

  // HTML5 Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent, position: number) => {
    dragItem.current = position
  }

  const handleDragEnter = (e: React.DragEvent, position: number) => {
    dragOverItem.current = position
  }

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
      const copyListItems = [...periods]
      const dragItemContent = copyListItems[dragItem.current]
      copyListItems.splice(dragItem.current, 1)
      copyListItems.splice(dragOverItem.current, 0, dragItemContent)

      // Reassign period_order based on new position
      const reordered = copyListItems.map((p, idx) => ({
        ...p,
        period_order: idx + 1,
      }))

      dragItem.current = null
      dragOverItem.current = null
      setPeriods(reordered)
    }
  }

  // Move via button helpers
  const moveUp = (index: number) => {
    if (index === 0) return
    const list = [...periods]
    const temp = list[index]
    list[index] = list[index - 1]
    list[index - 1] = temp

    const reordered = list.map((p, idx) => ({
      ...p,
      period_order: idx + 1,
    }))
    setPeriods(reordered)
  }

  const moveDown = (index: number) => {
    if (index === periods.length - 1) return
    const list = [...periods]
    const temp = list[index]
    list[index] = list[index + 1]
    list[index + 1] = temp

    const reordered = list.map((p, idx) => ({
      ...p,
      period_order: idx + 1,
    }))
    setPeriods(reordered)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background pb-12">
      <Topbar
        title={`จัดการงวด — เทอม ${semesterName || '...'}`}
        subtitle="เพิ่ม ลบ แก้ไข หรือลากสลับลำดับงวดการจ่ายเงิน"
        actions={
          <Link
            href="/admin/settings"
            className="flex items-center gap-1 text-[12.5px] font-bold text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> กลับหน้าตั้งค่า
          </Link>
        }
      />

      <div className="p-6 max-w-6xl mx-auto w-full space-y-6">
        {deletedPeriodIds.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-[12.5px] text-amber-800">
            <span className="font-bold">⚠️ มีการลบ {deletedPeriodIds.length} งวดออก</span>
            <span className="text-amber-600 font-medium">การลบจะมีผลเมื่อคลิก "บันทึกการเปลี่ยนแปลง"</span>
          </div>
        )}

        <div className="space-y-4">
          {periods.map((p, index) => (
            <div
              key={index}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={(e) => handleDragEnter(e, index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              className="border border-border bg-background-secondary rounded-2xl shadow-sm transition-all hover:shadow-md"
            >
              {/* Drag Handle & Header */}
              <div className="flex items-center justify-between px-5 py-3 bg-background-tertiary/20 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-primary p-1 rounded transition-colors hidden md:block">
                    <GripVertical className="w-4 h-4" />
                  </div>
                  <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">
                    ลำดับที่ {p.period_order}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Up/Down buttons for mobile & precise control */}
                  <button
                    onClick={() => moveUp(index)}
                    disabled={index === 0}
                    className="p-1.5 rounded-lg border border-border bg-background hover:bg-background-secondary text-text-secondary disabled:opacity-40 transition-colors"
                    title="เลื่อนขึ้น"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => moveDown(index)}
                    disabled={index === periods.length - 1}
                    className="p-1.5 rounded-lg border border-border bg-background hover:bg-background-secondary text-text-secondary disabled:opacity-40 transition-colors"
                    title="เลื่อนลง"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                  <div className="w-px h-4 bg-border mx-1" />
                  <button
                    onClick={() => removePeriod(index)}
                    className="text-red-500 hover:text-red-700 p-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-200 transition-colors"
                    title="ลบงวด"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Input Fields */}
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Title */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">ชื่องวด</label>
                  <input
                    type="text"
                    value={p.label}
                    onChange={(e) => updatePeriod(index, 'label', e.target.value)}
                    placeholder="เช่น สัปดาห์ 1 หรือ เดือน มิ.ย."
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[13px] font-bold text-text-primary outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                  />
                </div>

                {/* Amount */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">ยอดรวม (฿)</label>
                  <input
                    type="number"
                    value={p.amount}
                    onChange={(e) => updatePeriod(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[13px] font-black text-brand text-right outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                  />
                </div>

                {/* Base Amount */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">ยอดเงินฐาน (฿)</label>
                  <input
                    type="number"
                    value={p.base_amount}
                    onChange={(e) => updatePeriod(index, 'base_amount', parseFloat(e.target.value) || 0)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[13px] font-bold text-text-primary text-right outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                  />
                </div>

                {/* Fine Settings Panel */}
                <div className="col-span-full">
                  <div className="border border-red-100 bg-red-50/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <label className="text-[10px] font-black uppercase tracking-widest text-red-700 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        ตั้งค่าปรับล่าช้า (Late Fine)
                      </label>
                      {/* Preview badge */}
                      {((p.fine_rate ?? 0) > 0 || (p.late_fine_amount ?? 0) > 0) && (
                        <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2.5 py-1 rounded-full border border-red-200">
                          {formatFineDescription({
                            deadline: p.deadline || new Date().toISOString(),
                            fine_type: p.fine_type ?? 'flat',
                            fine_rate: p.fine_rate ?? 0,
                            fine_cap: p.fine_cap ?? null,
                            fine_grace_days: p.fine_grace_days ?? 0,
                            late_fine_amount: p.late_fine_amount ?? 0,
                          })}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {/* Fine Type */}
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">รูปแบบ</label>
                        <select
                          value={p.fine_type ?? 'flat'}
                          onChange={(e) => updatePeriod(index, 'fine_type', e.target.value)}
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[12px] font-bold text-text-primary outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                        >
                          <option value="flat">ปรับครั้งเดียว</option>
                          <option value="daily">ปรับรายวัน</option>
                          <option value="per_period">ปรับรายงวด</option>
                        </select>
                      </div>
                      {/* Fine Rate */}
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">
                          {(p.fine_type ?? 'flat') === 'daily' ? '฿/วัน' : (p.fine_type ?? 'flat') === 'per_period' ? '฿/งวด' : 'ยอด (฿)'}
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-text-muted">฿</span>
                          <input
                            type="number"
                            min="0"
                            value={p.fine_type === 'flat' ? (p.late_fine_amount ?? 0) : (p.fine_rate ?? 0)}
                            onChange={(e) => {
                              const v = parseFloat(e.target.value) || 0
                              if ((p.fine_type ?? 'flat') === 'flat') {
                                updatePeriod(index, 'late_fine_amount', v)
                              } else {
                                updatePeriod(index, 'fine_rate', v)
                              }
                            }}
                            className="w-full pl-6 pr-2 bg-background border border-border rounded-xl py-2 text-[13px] font-black text-red-600 text-right outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                          />
                        </div>
                      </div>
                      {/* Fine Cap */}
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">สูงสุด (฿, เว้น = ไม่จำกัด)</label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] text-text-muted">฿</span>
                          <input
                            type="number"
                            min="0"
                            value={p.fine_cap ?? ''}
                            placeholder="ไม่จำกัด"
                            onChange={(e) => updatePeriod(index, 'fine_cap', e.target.value ? parseFloat(e.target.value) : null)}
                            className="w-full pl-6 pr-2 bg-background border border-border rounded-xl py-2 text-[13px] font-bold text-text-primary text-right outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                          />
                        </div>
                      </div>
                      {/* Grace Days */}
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-text-muted mb-1">Grace (วัน)</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            value={p.fine_grace_days ?? 0}
                            onChange={(e) => updatePeriod(index, 'fine_grace_days', parseInt(e.target.value) || 0)}
                            className="w-full px-3 bg-background border border-border rounded-xl py-2 text-[13px] font-bold text-text-primary text-right outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">วัน</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deadline */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">กำหนดชำระ (Deadline)</label>
                  <input
                    type="datetime-local"
                    value={toLocalInput(p.deadline)}
                    onChange={(e) => updatePeriod(index, 'deadline', e.target.value ? fromLocalInput(e.target.value) : '')}
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[12.5px] font-medium text-text-secondary outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                  />
                </div>

                {/* Open Time */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> เปิดรับชำระเวลา
                  </label>
                  <input
                    type="datetime-local"
                    value={toLocalInput(p.open_at)}
                    onChange={(e) => updatePeriod(index, 'open_at', e.target.value ? fromLocalInput(e.target.value) : null)}
                    className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl px-3 py-2 text-[12.5px] font-medium text-emerald-700 outline-none focus:ring-2 focus:ring-emerald-300/50 transition-all"
                  />
                </div>

                {/* Close Time */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-red-500 mb-1.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> ปิดรับชำระเวลา
                  </label>
                  <input
                    type="datetime-local"
                    value={toLocalInput(p.close_at)}
                    onChange={(e) => updatePeriod(index, 'close_at', e.target.value ? fromLocalInput(e.target.value) : null)}
                    className="w-full bg-red-50/50 border border-red-200 rounded-xl px-3 py-2 text-[12.5px] font-medium text-red-600 outline-none focus:ring-2 focus:ring-red-300/50 transition-all"
                  />
                </div>

                {/* QR Code Url */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">QR URL (กำหนดเอง)</label>
                  <input
                    type="text"
                    value={p.qr_url || ''}
                    onChange={(e) => updatePeriod(index, 'qr_url', e.target.value || null)}
                    placeholder="ปล่อยว่างเพื่อใช้พร้อมเพย์ระบบ"
                    className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[12.5px] text-text-secondary outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                  />
                </div>
              </div>
            </div>
          ))}

          {periods.length === 0 && (
            <div className="py-16 border border-dashed border-border rounded-2xl text-center text-text-muted italic text-[13px]">
              ยังไม่มีงวดการชำระเงินในภาคเรียนนี้ กดปุ่ม "เพิ่มงวดใหม่" เพื่อเพิ่มงวดแรก
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between pt-4">
          <button
            onClick={addPeriod}
            className="flex items-center gap-1.5 text-brand hover:text-brand-hover text-[13px] font-black uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" /> เพิ่มงวดใหม่
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-brand text-white text-[13px] font-black uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 active:scale-95 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            บันทึกการเปลี่ยนแปลง
          </button>
        </div>
      </div>
    </div>
  )
}
