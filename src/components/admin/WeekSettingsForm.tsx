'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Loader2, Plus, Trash2, AlertTriangle, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/shared/GlobalDialog'

interface WeekSetting {
  week: number
  deadline: string
  amount: number
  title?: string
  payment_open_at?: string | null
  payment_close_at?: string | null
}

function toLocalInput(isoStr?: string | null): string {
  if (!isoStr) return ''
  // Convert UTC ISO to local datetime-local string (offset +7h for TH)
  return new Date(new Date(isoStr).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16)
}

function fromLocalInput(localStr: string): string {
  return new Date(localStr).toISOString()
}

export default function WeekSettingsForm({ initialSettings }: { initialSettings: WeekSetting[] }) {
  const [settings, setSettings] = useState<WeekSetting[]>(initialSettings)
  const [removedWeeks, setRemovedWeeks] = useState<number[]>([])
  const [loading, setLoading] = useState(false)
  const supabase = createClient()
  const dialog = useDialog()

  const handleSave = async () => {
    dialog.show({
      type: 'confirm',
      title: 'ยืนยันการบันทึก',
      message: 'คุณต้องการบันทึกการเปลี่ยนแปลงทั้งหมดในงวดการชำระใช่หรือไม่?',
      onConfirm: async () => {
        dialog.setLoading(true)
        try {
          if (removedWeeks.length > 0) {
            const { error: delError } = await supabase.from('week_settings').delete().in('week', removedWeeks)
            if (delError) throw delError
          }
          if (settings.length > 0) {
            const { error: upError } = await supabase.from('week_settings').upsert(settings)
            if (upError) throw upError
          }
          toast.success('บันทึกข้อมูลเรียบร้อยแล้ว')
          dialog.hide()
          window.location.reload()
        } catch (error: any) {
          toast.error('ไม่สามารถบันทึกข้อมูลได้: ' + error.message)
          dialog.setLoading(false)
        }
      }
    })
  }

  const addWeek = () => {
    const nextWeek = settings.length > 0 ? Math.max(...settings.map(s => s.week)) + 1 : 1
    if (nextWeek > 50) return
    const newDeadline = new Date()
    newDeadline.setHours(23, 59, 0, 0)
    setSettings([...settings, { 
      week: nextWeek, 
      title: `งวดที่ ${nextWeek}`,
      deadline: newDeadline.toISOString(), 
      amount: 100,
      payment_open_at: null,
      payment_close_at: null,
    }])
  }

  const removeWeek = (week: number) => {
    dialog.show({
      type: 'warning',
      title: 'ลบงวดการชำระ',
      message: `คุณแน่ใจหรือไม่ว่าต้องการลบงวดที่ ${week}? ข้อมูลเดิมจะไม่หายแต่จะไม่แสดงผลให้นักศึกษาเห็น`,
      onConfirm: () => {
        setSettings(settings.filter(s => s.week !== week))
        if (initialSettings.some(s => s.week === week)) {
          setRemovedWeeks([...removedWeeks, week])
        }
        dialog.hide()
      }
    })
  }

  const updateSetting = (week: number, field: keyof WeekSetting, value: any) => {
    setSettings(settings.map(s => s.week === week ? { ...s, [field]: value } : s))
  }

  return (
    <div className="space-y-4">
      {removedWeeks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-center gap-2 text-amber-700 text-[12px]">
          <AlertTriangle className="w-4 h-4" />
          มีการลบ {removedWeeks.length} งวดออก จะมีผลเมื่อกดปุ่มบันทึก
        </div>
      )}

      <div className="space-y-4">
        {settings.sort((a, b) => a.week - b.week).map((s) => (
          <div key={s.week} className="border border-border rounded-2xl overflow-hidden shadow-sm">
            {/* Row header */}
            <div className="flex items-center justify-between px-5 py-3 bg-background-tertiary/40 border-b border-border">
              <span className="text-[11px] font-black uppercase tracking-widest text-text-muted">งวดที่ {s.week}</span>
              <button
                onClick={() => removeWeek(s.week)}
                className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* Title */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">ชื่องวด</label>
                <input
                  type="text"
                  value={s.title || ''}
                  onChange={(e) => updateSetting(s.week, 'title', e.target.value)}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[13px] font-bold text-text-primary outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">ยอดเงิน (฿)</label>
                <input
                  type="number"
                  value={s.amount}
                  onChange={(e) => updateSetting(s.week, 'amount', parseFloat(e.target.value))}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[13px] font-black text-brand text-right outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                />
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-text-muted mb-1.5">Deadline</label>
                <input
                  type="datetime-local"
                  value={s.deadline ? toLocalInput(s.deadline) : ''}
                  onChange={(e) => updateSetting(s.week, 'deadline', e.target.value ? fromLocalInput(e.target.value) : '')}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-[12.5px] font-medium text-text-secondary outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                />
              </div>

              {/* Empty col for alignment */}
              <div className="hidden xl:block" />

              {/* Payment Open */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  เปิดรับสลิปเวลา
                </label>
                <input
                  type="datetime-local"
                  value={toLocalInput(s.payment_open_at)}
                  onChange={(e) => updateSetting(s.week, 'payment_open_at', e.target.value ? fromLocalInput(e.target.value) : null)}
                  className="w-full bg-emerald-50/50 border border-emerald-200 rounded-xl px-3 py-2 text-[12.5px] font-medium text-text-secondary outline-none focus:ring-2 focus:ring-emerald-300/50 transition-all"
                />
                <p className="text-[10px] text-text-disabled mt-1">ปล่อยว่าง = ไม่จำกัดเวลาเปิด</p>
              </div>

              {/* Payment Close */}
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-red-500 mb-1.5 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  ปิดรับสลิปเวลา
                </label>
                <input
                  type="datetime-local"
                  value={toLocalInput(s.payment_close_at)}
                  onChange={(e) => updateSetting(s.week, 'payment_close_at', e.target.value ? fromLocalInput(e.target.value) : null)}
                  className="w-full bg-red-50/50 border border-red-200 rounded-xl px-3 py-2 text-[12.5px] font-medium text-text-secondary outline-none focus:ring-2 focus:ring-red-300/50 transition-all"
                />
                <p className="text-[10px] text-text-disabled mt-1">ปล่อยว่าง = ไม่จำกัดเวลาปิด</p>
              </div>

              {/* Window status indicator */}
              {(s.payment_open_at || s.payment_close_at) && (
                <div className="xl:col-span-2 flex items-center">
                  <WindowStatusBadge openAt={s.payment_open_at} closeAt={s.payment_close_at} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <button onClick={addWeek} className="flex items-center gap-2 text-brand hover:text-brand-hover text-[13px] font-black uppercase tracking-wider">
          <Plus className="w-4 h-4" /> เพิ่มงวดใหม่
        </button>

        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-brand text-white text-[13px] font-black uppercase tracking-widest px-6 py-2.5 rounded-xl hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 active:scale-95"
        >
          <Save className="w-4 h-4" />
          บันทึกการเปลี่ยนแปลง
        </button>
      </div>
    </div>
  )
}

function WindowStatusBadge({ openAt, closeAt }: { openAt?: string | null, closeAt?: string | null }) {
  const now = new Date()
  const open = openAt ? new Date(openAt) : null
  const close = closeAt ? new Date(closeAt) : null

  let status: 'open' | 'closed' | 'upcoming' | 'noWindow' = 'noWindow'
  let label = ''

  if (!open && !close) return null
  if (open && now < open) {
    status = 'upcoming'
    label = `เปิดในอีก ${formatDiff(open, now)}`
  } else if (close && now > close) {
    status = 'closed'
    label = `ปิดรับแล้ว (${formatDiff(now, close)} ที่แล้ว)`
  } else {
    status = 'open'
    label = close ? `เปิดอยู่ · ปิดใน ${formatDiff(close, now)}` : 'เปิดรับอยู่'
  }

  const styles = {
    open: 'bg-emerald-50 border-emerald-200 text-emerald-700',
    closed: 'bg-red-50 border-red-200 text-red-600',
    upcoming: 'bg-amber-50 border-amber-200 text-amber-700',
    noWindow: '',
  }

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-[11.5px] font-bold ${styles[status]}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
        status === 'open' ? 'bg-emerald-500 animate-pulse' :
        status === 'upcoming' ? 'bg-amber-400' : 'bg-red-400'
      }`} />
      {label}
    </div>
  )
}

function formatDiff(a: Date, b: Date): string {
  const diff = Math.abs(a.getTime() - b.getTime())
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  if (hours >= 24) return `${Math.floor(hours / 24)} วัน`
  if (hours > 0) return `${hours} ชม. ${minutes} นาที`
  return `${minutes} นาที`
}
