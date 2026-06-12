'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Loader2, Save, AlertTriangle } from 'lucide-react'

interface Props {
  tierAAmount: string
  tierBAmount: string
  tierCAmount: string
  tierCMaxQuota: string
  reserveFundTarget: string
}

export default function TierSettingsForm({
  tierAAmount,
  tierBAmount,
  tierCAmount,
  tierCMaxQuota,
  reserveFundTarget,
}: Props) {
  const [form, setForm] = useState({
    tier_a_amount: tierAAmount,
    tier_b_amount: tierBAmount,
    tier_c_amount: tierCAmount,
    tier_c_max_quota: tierCMaxQuota,
    reserve_fund_monthly_target: reserveFundTarget,
  })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  const handleChange = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const updates = Object.entries(form).map(([key, value]) => ({ key, value }))
      const { error } = await supabase.from('system_settings').upsert(updates)
      if (error) throw error
      toast.success('บันทึกการตั้งค่า Tier เรียบร้อยแล้ว')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด'
      toast.error('ล้มเหลว: ' + msg)
    } finally {
      setSaving(false)
    }
  }

  const tierFields = [
    {
      key: 'tier_a_amount',
      label: 'Tier A — สมทบพิเศษ',
      description: 'ช่วยเพื่อน Tier C ด้วย',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      badgeColor: 'bg-emerald-100',
    },
    {
      key: 'tier_b_amount',
      label: 'Tier B — มาตรฐาน',
      description: 'ค่าบำรุงปกติ',
      color: 'text-slate-700',
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      badgeColor: 'bg-slate-100',
    },
    {
      key: 'tier_c_amount',
      label: 'Tier C — ลดหย่อน',
      description: 'ส่วนต่างสมทบโดย Tier A',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      badgeColor: 'bg-amber-100',
    },
  ] as const

  return (
    <div className="space-y-6">
      {/* Tier Amounts */}
      <div>
        <h3 className="text-[12px] font-black uppercase tracking-widest text-text-muted mb-4">ค่าบำรุงรายงวด (บาท)</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tierFields.map((f) => (
            <div key={f.key} className={`${f.bg} ${f.border} border rounded-2xl p-4`}>
              <label className={`text-[11px] font-black uppercase tracking-wide ${f.color} block mb-1`}>{f.label}</label>
              <p className="text-[10.5px] text-text-muted mb-3">{f.description}</p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-text-muted">฿</span>
                <input
                  type="number"
                  min="0"
                  value={form[f.key as keyof typeof form]}
                  onChange={handleChange(f.key)}
                  className="w-full pl-7 pr-4 py-2.5 text-[14px] font-black border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-brand/10"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tier C Quota */}
      <div>
        <h3 className="text-[12px] font-black uppercase tracking-widest text-text-muted mb-4">โควต้า Tier C</h3>
        <div className="flex flex-col md:flex-row items-start gap-4">
          <div className="w-full max-w-xs">
            <label className="text-[11px] font-black uppercase tracking-wide text-text-muted block mb-1.5">จำนวนสูงสุดที่อนุญาต</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="50"
                value={form.tier_c_max_quota}
                onChange={handleChange('tier_c_max_quota')}
                className="w-full px-4 py-2.5 text-[14px] font-black border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-brand/10"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-text-muted font-medium">คน</span>
            </div>
          </div>
          <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl flex-1 text-[12px] text-amber-800">
            <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <span>ระบบจะปฏิเสธการเพิ่ม Tier C เมื่อถึงโควต้านี้ — แก้ไขได้ตลอดเวลา</span>
          </div>
        </div>
      </div>

      {/* Reserve Fund Target */}
      <div>
        <h3 className="text-[12px] font-black uppercase tracking-widest text-text-muted mb-4">กองทุนสำรองรายเดือน</h3>
        <div className="flex flex-col md:flex-row items-start gap-4">
          <div className="w-full max-w-xs">
            <label className="text-[11px] font-black uppercase tracking-wide text-text-muted block mb-1.5">เป้าหมาย/เดือน</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-bold text-text-muted">฿</span>
              <input
                type="number"
                min="0"
                value={form.reserve_fund_monthly_target}
                onChange={handleChange('reserve_fund_monthly_target')}
                className="w-full pl-7 pr-4 py-2.5 text-[14px] font-black border border-border rounded-xl bg-background outline-none focus:ring-2 focus:ring-brand/10"
              />
            </div>
          </div>
          <div className="flex items-start gap-2 p-4 bg-sky-50 border border-sky-200 rounded-xl flex-1 text-[12px] text-sky-800">
            <span className="mt-0.5 text-sky-500 font-black">ℹ</span>
            <span>ระบบจะหักยอดเงินกองทุนสำรองนี้ออกจากยอดเงินคงเหลือในคลัง (กองกลาง) โดยอัตโนมัติ โดยไม่ต้องสร้างรายการรายรับเพิ่มเติม</span>
          </div>
        </div>
      </div>

      <div className="pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-brand text-white text-[12px] font-black uppercase tracking-widest px-6 py-3 rounded-xl hover:bg-brand-hover transition-all shadow-lg shadow-brand/20 active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          บันทึกการตั้งค่า
        </button>
      </div>
    </div>
  )
}
