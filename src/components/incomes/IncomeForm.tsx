'use client'

import { useState } from 'react'
import { Loader2, Save } from 'lucide-react'

interface IncomeFormProps {
  onSubmit: (data: { title: string; description?: string; amount: number; source: string }) => Promise<void>
  onCancel: () => void
}

export default function IncomeForm({ onSubmit, onCancel }: IncomeFormProps) {
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [source, setSource] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !amount) return
    setLoading(true)
    await onSubmit({ 
      title, 
      description, 
      amount: parseFloat(amount), 
      source 
    })
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">ชื่อรายการรายรับ</label>
        <input
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="เช่น เงินสนับสนุนจากสาขา, ค่าขายเสื้อ"
          className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/10"
        />
      </div>

      <div>
        <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">จำนวนเงิน (บาท)</label>
        <input
          type="number"
          required
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/10 font-mono"
        />
      </div>

      <div>
        <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">แหล่งที่มา</label>
        <input
          type="text"
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="เช่น สโมสรนักศึกษา, ขายของที่ระลึก"
          className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/10"
        />
      </div>

      <div>
        <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">รายละเอียดเพิ่มเติม (ถ้ามี)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="ระบุรายละเอียด..."
          rows={3}
          className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[14px] outline-none focus:ring-2 focus:ring-brand/10 resize-none"
        />
      </div>

      <div className="flex gap-2 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl border border-border text-[13px] font-bold hover:bg-background-tertiary transition-colors"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 bg-brand text-white py-2.5 rounded-xl text-[13px] font-bold hover:bg-brand-hover transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          บันทึกรายรับ
        </button>
      </div>
    </form>
  )
}
