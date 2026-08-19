'use client'

import { useState, useEffect } from 'react'
import { X, Sparkles, Users, Check, AlertCircle } from 'lucide-react'

interface StudentOption {
  id: string
  student_id: string
  fullname: string
  selected: boolean
  customAmount: string
  note: string
}

export default function CreateSpecialCollectionModal({
  isOpen,
  onClose,
  onCreated,
}: {
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [defaultAmount, setDefaultAmount] = useState('600')
  const [dueDate, setDueDate] = useState('')
  const [allowInstallments, setAllowInstallments] = useState(false)
  const [maxInstallments, setMaxInstallments] = useState('2')
  const [targetType, setTargetType] = useState<'all' | 'selected'>('all')

  const [students, setStudents] = useState<StudentOption[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      fetchStudents()
    }
  }, [isOpen])

  const fetchStudents = async () => {
    setLoadingStudents(true)
    try {
      const res = await fetch('/api/students')
      const data = await res.json()
      if (data.students) {
        setStudents(
          data.students.map((s: any) => ({
            id: s.id,
            student_id: s.student_id,
            fullname: s.fullname,
            selected: true,
            customAmount: '',
            note: '',
          }))
        )
      }
    } catch (err) {
      console.error('Failed to fetch students:', err)
    } finally {
      setLoadingStudents(false)
    }
  }

  const toggleStudent = (id: string) => {
    setStudents(prev =>
      prev.map(s => (s.id === id ? { ...s, selected: !s.selected } : s))
    )
  }

  const updateStudentNote = (id: string, note: string) => {
    setStudents(prev =>
      prev.map(s => (s.id === id ? { ...s, note } : s))
    )
  }

  const updateStudentAmount = (id: string, amount: string) => {
    setStudents(prev =>
      prev.map(s => (s.id === id ? { ...s, customAmount: amount } : s))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('กรุณากรอกชื่อรายการเก็บเงินพิเศษ')
      return
    }
    if (!defaultAmount || parseFloat(defaultAmount) <= 0) {
      setError('กรุณาระบุยอดเงินเริ่มต้นที่ถูกต้อง')
      return
    }

    setSubmitting(true)
    try {
      const selectedList = students
        .filter(s => s.selected)
        .map(s => ({
          user_id: s.id,
          amount: s.customAmount ? parseFloat(s.customAmount) : parseFloat(defaultAmount),
          note: s.note || null,
        }))

      const res = await fetch('/api/special-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          default_amount: parseFloat(defaultAmount),
          due_date: dueDate ? new Date(dueDate).toISOString() : null,
          allow_installments: allowInstallments,
          max_installments: allowInstallments ? parseInt(maxInstallments) : 1,
          target_type: targetType,
          selected_students: targetType === 'selected' ? selectedList : [],
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create special collection')
      }

      onCreated()
      onClose()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              สร้างรายการเก็บเงินพิเศษ (Special Collection)
            </h2>
            <p className="text-xs text-white/50 mt-0.5">
              เช่น ค่าเสื้อสาขา 69, ค่าอุปกรณ์, หรือค่ากิจกรรมเฉพาะกลุ่ม
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Title & Description */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1">
                ชื่อรายการเก็บเงินพิเศษ <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="เช่น ค่าเสื้อสาขา คอมพิวเตอร์ศึกษา 69"
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1">รายละเอียดเพิ่มเติม</label>
              <textarea
                placeholder="ระบุรายละเอียด เช่น ไซส์เสื้อ รายละเอียดกิจกรรม วันรับของ..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
          </div>

          {/* Default Price & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1">
                ราคามาตรฐานต่อคน (บาท) <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                placeholder="600"
                value={defaultAmount}
                onChange={e => setDefaultAmount(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500 tabular-nums"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 mb-1">กำหนดจ่ายภายในวันที่</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Installment Option */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-amber-300 block">อนุญาตให้ผ่อนชำระได้ (Installments)</span>
                <span className="text-[11px] text-white/50">
                  ให้นักศึกษาเลือกเลือกระหว่าง "จ่ายเต็ม" หรือ "ผ่อนจ่าย" ในการส่งสลิปครั้งแรก
                </span>
              </div>

              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={allowInstallments}
                  onChange={e => setAllowInstallments(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
              </label>
            </div>

            {allowInstallments && (
              <div className="pt-2 border-t border-amber-500/10 flex items-center justify-between">
                <label className="text-xs text-white/80">จำนวนงวดผ่อนสูงสุด:</label>
                <select
                  value={maxInstallments}
                  onChange={e => setMaxInstallments(e.target.value)}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-white/20 text-xs text-amber-300 focus:outline-none"
                >
                  <option value="2">2 งวด (งวดละ {Math.ceil(parseFloat(defaultAmount || '0') / 2)} บาท)</option>
                  <option value="3">3 งวด (งวดละ {Math.ceil(parseFloat(defaultAmount || '0') / 3)} บาท)</option>
                  <option value="4">4 งวด (งวดละ {Math.ceil(parseFloat(defaultAmount || '0') / 4)} บาท)</option>
                </select>
              </div>
            )}
          </div>

          {/* Target Audience selection */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-white/80">มอบหมายให้ใครชำระ?</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType('all')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  targetType === 'all'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-white/[0.03] border-white/10 text-white/50 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                นักศึกษาทุกคน ({students.length} คน)
              </button>

              <button
                type="button"
                onClick={() => setTargetType('selected')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                  targetType === 'selected'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-white/[0.03] border-white/10 text-white/50 hover:text-white'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
                เลือกเฉพาะรายคน / ปรับราคา
              </button>
            </div>
          </div>

          {/* Selected Students Detail Table (when targetType === 'selected') */}
          {targetType === 'selected' && (
            <div className="border border-white/10 rounded-xl overflow-hidden bg-white/[0.01]">
              <div className="p-3 bg-white/[0.03] text-xs font-semibold text-white/60 flex items-center justify-between">
                <span>เลือกรายชื่อนักศึกษา และระบุหมายเหตุ (เช่น ไซส์เสื้อ S/M/L)</span>
                <span>เลือก {students.filter(s => s.selected).length}/{students.length} คน</span>
              </div>

              {loadingStudents ? (
                <div className="p-6 text-center text-xs text-white/40">กำลังดึงรายชื่อนักศึกษา...</div>
              ) : (
                <div className="max-h-52 overflow-y-auto divide-y divide-white/[0.05]">
                  {students.map(student => (
                    <div key={student.id} className="p-2.5 flex items-center gap-3 hover:bg-white/[0.02]">
                      <input
                        type="checkbox"
                        checked={student.selected}
                        onChange={() => toggleStudent(student.id)}
                        className="rounded border-white/20 bg-slate-800 text-amber-500 focus:ring-amber-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-white truncate">{student.fullname}</div>
                        <div className="text-[10px] font-mono text-white/40">{student.student_id}</div>
                      </div>

                      {student.selected && (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="โน้ต (เช่น L)"
                            value={student.note}
                            onChange={e => updateStudentNote(student.id, e.target.value)}
                            className="w-24 px-2 py-1 rounded bg-white/[0.05] border border-white/10 text-[11px] text-white placeholder:text-white/30"
                          />
                          <input
                            type="number"
                            placeholder={`฿${defaultAmount}`}
                            value={student.customAmount}
                            onChange={e => updateStudentAmount(student.id, e.target.value)}
                            className="w-20 px-2 py-1 rounded bg-white/[0.05] border border-white/10 text-[11px] text-white placeholder:text-white/30 tabular-nums"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Submit Buttons */}
          <div className="pt-3 border-t border-white/10 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-white/60 hover:text-white hover:bg-white/10 transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all disabled:opacity-50"
            >
              {submitting ? 'กำลังสร้าง...' : 'สร้างรายการเก็บเงินพิเศษ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
