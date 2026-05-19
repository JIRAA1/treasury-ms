'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Loader2, CreditCard, User } from 'lucide-react'
import { toast } from 'sonner'

export default function PromptPaySettingsForm() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState({
    promptpay_id: '',
    promptpay_name: ''
  })
  const supabase = createClient()

  useEffect(() => {
    async function fetchConfig() {
      const { data } = await supabase.from('system_settings').select('*')
      if (data) {
        const mapped = data.reduce((acc: any, curr) => {
          acc[curr.key] = curr.value
          return acc
        }, {})
        setConfig({
          promptpay_id: mapped.promptpay_id || '',
          promptpay_name: mapped.promptpay_name || ''
        })
      }
      setLoading(false)
    }
    fetchConfig()
  }, [supabase])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updates = [
        { key: 'promptpay_id', value: config.promptpay_id },
        { key: 'promptpay_name', value: config.promptpay_name }
      ]
      const { error } = await supabase.from('system_settings').upsert(updates)
      if (error) throw error
      toast.success('บันทึกข้อมูลพร้อมเพย์เรียบร้อยแล้ว')
    } catch (error: any) {
      toast.error('ล้มเหลว: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="h-20 flex items-center justify-center text-text-muted">กำลังโหลด...</div>

  return (
    <form onSubmit={handleSave} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div>
          <label className="block text-[11px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">เบอร์โทรศัพท์ / เลขบัตร (พร้อมเพย์)</label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
              <CreditCard className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              placeholder="093XXXXXXX"
              value={config.promptpay_id}
              onChange={(e) => setConfig({ ...config, promptpay_id: e.target.value })}
              className="w-full bg-background border border-border rounded-2xl pl-11 pr-4 py-3 text-[14px] font-bold text-text-primary focus:ring-2 focus:ring-brand/10 transition-all outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-black text-text-muted uppercase tracking-widest mb-2 ml-1">ชื่อผู้รับเงิน (จะแสดงในหน้าสแกน)</label>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted">
              <User className="w-4 h-4" />
            </div>
            <input
              type="text"
              required
              placeholder="ชื่อ-นามสกุล"
              value={config.promptpay_name}
              onChange={(e) => setConfig({ ...config, promptpay_name: e.target.value })}
              className="w-full bg-background border border-border rounded-2xl pl-11 pr-4 py-3 text-[14px] font-bold text-text-primary focus:ring-2 focus:ring-brand/10 transition-all outline-none"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-accent-gold text-white text-[13px] font-black uppercase tracking-widest px-6 py-2.5 rounded-xl hover:opacity-90 transition-all shadow-xl shadow-accent-gold/20 active:scale-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          บันทึกข้อมูลรับเงิน
        </button>
      </div>
    </form>
  )
}
