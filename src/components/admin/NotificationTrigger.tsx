'use client'

import { useState, useEffect } from 'react'
import { Bell, Loader2, ChevronDown, Users, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/shared/GlobalDialog'
import { createClient } from '@/lib/supabase/client'

type TierFilter = 'all' | 'A' | 'B' | 'C'

interface Period {
  id: string
  label: string
  period_order: number
}

export default function NotificationTrigger() {
  const [loading, setLoading] = useState(false)
  const [tierFilter, setTierFilter] = useState<TierFilter>('all')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('auto')
  const [periods, setPeriods] = useState<Period[]>([])
  const [loadingPeriods, setLoadingPeriods] = useState(true)
  const dialog = useDialog()

  // Load periods from active semester
  useEffect(() => {
    const supabase = createClient()
    async function fetchPeriods() {
      try {
        const { data: semester } = await supabase
          .from('semesters')
          .select('id')
          .eq('is_active', true)
          .maybeSingle()

        if (!semester) return

        const { data } = await supabase
          .from('periods')
          .select('id, label, period_order')
          .eq('semester_id', semester.id)
          .order('period_order', { ascending: false })

        setPeriods(data ?? [])
      } finally {
        setLoadingPeriods(false)
      }
    }
    fetchPeriods()
  }, [])

  const handleSendReminder = async () => {
    const tierLabel = tierFilter === 'all' ? 'ทุก Tier' : `Tier ${tierFilter} เท่านั้น`
    const periodLabel = selectedPeriod === 'auto'
      ? 'งวดที่มียอดค้างล่าสุด (อัตโนมัติ)'
      : (periods.find(p => p.id === selectedPeriod)?.label ?? 'ที่เลือก')

    dialog.show({
      type: 'confirm',
      title: 'ส่งแจ้งเตือนยอดค้าง',
      message: `ส่งถึง: ${tierLabel}\nงวด: ${periodLabel}\n\nระบบจะส่งแจ้งเตือนผ่าน LINE และกระดิ่งในแอปทันที`,
      confirmText: 'ส่งแจ้งเตือน',
      onConfirm: async () => {
        dialog.setLoading(true)
        setLoading(true)
        try {
          const body: Record<string, unknown> = {
            type: 'reminder',
            target: 'all_unpaid',
          }
          if (selectedPeriod !== 'auto') body.period_id = selectedPeriod
          if (tierFilter !== 'all') body.tier_filter = tierFilter

          const res = await fetch('/api/admin/notify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          })

          const data = await res.json()
          if (!res.ok) throw new Error(data.error || 'ส่งแจ้งเตือนไม่สำเร็จ')

          if (data.sent === 0 && data.failed > 0) {
            toast.error(`ส่งแจ้งเตือนไม่สำเร็จ: ล้มเหลวทั้งหมด ${data.failed} คน`)
          } else if (data.failed > 0) {
            toast.warning(`ส่งสำเร็จบางส่วน: ${data.sent} คน ✓, ล้มเหลว ${data.failed} คน`)
          } else if (data.sent === 0) {
            toast.info(data.message ?? 'ไม่มีนักศึกษาที่ค้างชำระ')
          } else {
            toast.success(`ส่งแจ้งเตือนเรียบร้อย: ${data.sent} คน ✓`)
          }
          dialog.hide()
        } catch (error: any) {
          toast.error('เกิดข้อผิดพลาด: ' + error.message)
          dialog.setLoading(false)
        } finally {
          setLoading(false)
        }
      },
    })
  }

  const tierOptions: { value: TierFilter; label: string; color: string; bg: string }[] = [
    { value: 'all', label: 'ทุก Tier', color: 'text-text-primary', bg: 'bg-background-secondary' },
    { value: 'A', label: 'Tier A', color: 'text-emerald-700', bg: 'bg-emerald-50' },
    { value: 'B', label: 'Tier B', color: 'text-slate-600', bg: 'bg-slate-100' },
    { value: 'C', label: 'Tier C', color: 'text-amber-700', bg: 'bg-amber-50' },
  ]

  return (
    <div className="bg-background-secondary border border-border rounded-xl p-4 space-y-3 hover:border-brand/30 transition-colors">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
          {loading ? (
            <Loader2 className="w-4 h-4 text-amber-600 animate-spin" />
          ) : (
            <Bell className="w-4 h-4 text-amber-600" />
          )}
        </div>
        <div>
          <div className="text-[13px] font-bold text-text-primary">ส่งแจ้งเตือนยอดค้าง</div>
          <div className="text-[11px] text-text-muted">LINE &amp; In-App · เลือก Tier &amp; งวดได้</div>
        </div>
      </div>

      {/* Tier Filter */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-text-muted">
          <Users className="w-3 h-3" />
          กลุ่มเป้าหมาย
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {tierOptions.map((t) => (
            <button
              key={t.value}
              onClick={() => setTierFilter(t.value)}
              className={`py-1.5 rounded-lg text-[10.5px] font-black transition-all border ${
                tierFilter === t.value
                  ? `${t.bg} ${t.color} border-current/30 shadow-sm`
                  : 'border-border text-text-muted hover:border-border-strong hover:text-text-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Period Selector */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-text-muted">
          <Calendar className="w-3 h-3" />
          งวดที่ต้องการแจ้งเตือน
        </div>
        <div className="relative">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            disabled={loadingPeriods}
            className="w-full pl-3 pr-8 py-2 text-[11.5px] font-bold border border-border rounded-lg bg-background text-text-primary outline-none focus:ring-2 focus:ring-brand/10 appearance-none cursor-pointer disabled:opacity-50 transition-all"
          >
            <option value="auto">🔍 อัตโนมัติ (งวดที่มียอดค้าง)</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={handleSendReminder}
        disabled={loading}
        className="w-full py-2.5 rounded-lg text-[12px] font-black uppercase tracking-widest bg-amber-500 text-white hover:bg-amber-600 active:scale-95 transition-all shadow-md shadow-amber-200 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? (
          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> กำลังส่ง...</>
        ) : (
          <><Bell className="w-3.5 h-3.5" /> ส่งแจ้งเตือน</>
        )}
      </button>
    </div>
  )
}
