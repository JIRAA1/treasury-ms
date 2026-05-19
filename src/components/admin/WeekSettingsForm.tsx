'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/shared/GlobalDialog'

interface WeekSetting {
  week: number
  deadline: string
  amount: number
  title?: string
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
      amount: 100 
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

      <div className="border border-border rounded-lg overflow-x-auto shadow-sm">
        <table className="w-full text-[13px]">
          <thead className="bg-background-tertiary border-b border-border text-text-muted text-[10px] uppercase tracking-widest font-black">
            <tr>
              <th className="px-6 py-3 text-left w-12 text-center">#</th>
              <th className="px-6 py-3 text-left">ชื่องวดการชำระ</th>
              <th className="px-6 py-3 text-left">Deadline</th>
              <th className="px-6 py-3 text-left w-32">ยอดเงิน (฿)</th>
              <th className="px-6 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {settings.sort((a,b) => a.week - b.week).map((s) => (
              <tr key={s.week} className="hover:bg-background-tertiary/20 transition-colors">
                <td className="px-6 py-4 font-bold text-text-muted text-center italic">{s.week}</td>
                <td className="px-6 py-4">
                  <input
                    type="text"
                    value={s.title || ''}
                    onChange={(e) => updateSetting(s.week, 'title', e.target.value)}
                    className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-[13px] font-bold text-text-primary outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                  />
                </td>
                <td className="px-6 py-4">
                  <input
                    type="datetime-local"
                    value={s.deadline ? new Date(new Date(s.deadline).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16) : ''}
                    onChange={(e) => updateSetting(s.week, 'deadline', new Date(e.target.value).toISOString())}
                    className="bg-background border border-border rounded-xl px-3 py-1.5 text-[13px] font-medium text-text-secondary outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                  />
                </td>
                <td className="px-6 py-4">
                  <input
                    type="number"
                    value={s.amount}
                    onChange={(e) => updateSetting(s.week, 'amount', parseFloat(e.target.value))}
                    className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-[13px] font-black text-brand text-right outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                  />
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => removeWeek(s.week)} className="text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
