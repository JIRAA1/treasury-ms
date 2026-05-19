'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Upload } from 'lucide-react'

const expenseSchema = z.object({
  title: z.string().min(3, 'ชื่อต้องมีอย่างน้อย 3 ตัวอักษร').max(100),
  description: z.string().max(500).optional(),
  amount: z.number({ message: 'กรุณาระบุจำนวนเงิน' }).positive('จำนวนเงินต้องมากกว่า 0').max(100000),
  category: z.enum(['supplies', 'activity', 'food', 'transport', 'other']),
})

type ExpenseFormData = z.infer<typeof expenseSchema>

interface ExpenseFormProps {
  onSubmit: (data: ExpenseFormData & { receipt?: File }) => Promise<void>
  onCancel: () => void
}

const categoryLabels: Record<string, string> = {
  supplies: 'อุปกรณ์',
  activity: 'กิจกรรม',
  food: 'อาหาร/เครื่องดื่ม',
  transport: 'ค่าเดินทาง',
  other: 'อื่นๆ',
}

export default function ExpenseForm({ onSubmit, onCancel }: ExpenseFormProps) {
  const [receipt, setReceipt] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [descLen, setDescLen] = useState(0)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { category: 'other' },
  })

  const handleFormSubmit = async (data: ExpenseFormData) => {
    setLoading(true)
    try {
      await onSubmit({ ...data, receipt: receipt || undefined })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Title */}
      <div>
        <label className="block text-[12px] font-medium text-text-secondary mb-1">ชื่อรายการ *</label>
        <input
          {...register('title')}
          placeholder="เช่น ค่าน้ำดื่มสำหรับกิจกรรม"
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-background outline-none focus:ring-1 focus:ring-brand transition"
        />
        {errors.title && <p className="text-[11px] text-red-500 mt-1">{errors.title.message}</p>}
      </div>

      {/* Description */}
      <div>
        <label className="block text-[12px] font-medium text-text-secondary mb-1">รายละเอียด</label>
        <textarea
          {...register('description', { onChange: (e) => setDescLen(e.target.value.length) })}
          rows={3}
          placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)"
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-background outline-none focus:ring-1 focus:ring-brand transition resize-none"
        />
        <div className="text-right text-[10.5px] text-text-muted">{descLen}/500</div>
      </div>

      {/* Amount */}
      <div>
        <label className="block text-[12px] font-medium text-text-secondary mb-1">จำนวนเงิน *</label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-text-muted">฿</span>
          <input
            {...register('amount', { valueAsNumber: true })}
            type="number"
            step="0.01"
            placeholder="0.00"
            className="w-full border border-border rounded-lg pl-7 pr-3 py-2 text-[13px] bg-background outline-none focus:ring-1 focus:ring-brand transition"
          />
        </div>
        {errors.amount && <p className="text-[11px] text-red-500 mt-1">{errors.amount.message}</p>}
      </div>

      {/* Category */}
      <div>
        <label className="block text-[12px] font-medium text-text-secondary mb-1">หมวดหมู่ *</label>
        <select
          {...register('category')}
          className="w-full border border-border rounded-lg px-3 py-2 text-[13px] bg-background outline-none focus:ring-1 focus:ring-brand transition"
        >
          {Object.entries(categoryLabels).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Receipt */}
      <div>
        <label className="block text-[12px] font-medium text-text-secondary mb-1">ใบเสร็จ</label>
        <label className="flex items-center gap-2 border border-dashed border-border-strong rounded-lg px-3 py-2.5 cursor-pointer hover:bg-background-secondary transition">
          <Upload className="w-4 h-4 text-text-muted" />
          <span className="text-[12.5px] text-text-muted">{receipt ? receipt.name : 'เลือกไฟล์ (รูปภาพ หรือ PDF)'}</span>
          <input
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && setReceipt(e.target.files[0])}
          />
        </label>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 bg-brand text-white text-[13px] font-medium py-2.5 rounded-lg hover:bg-brand-hover transition-colors disabled:opacity-50"
        >
          {loading ? 'กำลังบันทึก...' : 'เพิ่มรายการ'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 text-[13px] text-text-secondary border border-border rounded-lg hover:bg-background-secondary transition-colors"
        >
          ยกเลิก
        </button>
      </div>
    </form>
  )
}
