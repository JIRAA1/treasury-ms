'use client'

import { useState } from 'react'
import { 
  Send, 
  Users, 
  MessageSquare, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertTriangle,
  Loader2,
  Info
} from 'lucide-react'
import { toast } from 'sonner'
import { useDialog } from '@/components/shared/GlobalDialog'

interface WeekSetting {
  week: number
  title: string
}

export default function BroadcastClient({ weekSettings }: { weekSettings: WeekSetting[] }) {
  const dialog = useDialog()
  const [loading, setLoading] = useState(false)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [targetWeek, setTargetWeek] = useState<number | ''>('')
  const [filters, setFilters] = useState<string[]>(['all'])
  const [sendLine, setSendLine] = useState(true)
  const [sendInApp, setSendInApp] = useState(true)

  const filterOptions = [
    { id: 'all', label: 'นักศึกษาทุกคน', icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
    { id: 'paid', label: 'จ่ายแล้ว (Approved)', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'unpaid', label: 'ยังไม่จ่าย / ค้างส่ง', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { id: 'pending', label: 'รอตรวจสอบ', icon: Info, color: 'text-blue-500', bg: 'bg-blue-50' },
    { id: 'rejected', label: 'สลิปถูกปฏิเสธ', icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  ]

  const toggleFilter = (id: string) => {
    if (id === 'all') {
      setFilters(['all'])
      return
    }
    const newFilters = filters.filter(f => f !== 'all')
    if (newFilters.includes(id)) {
      const updated = newFilters.filter(f => f !== id)
      setFilters(updated.length === 0 ? ['all'] : updated)
    } else {
      setFilters([...newFilters, id])
    }
  }

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error('กรุณาระบุข้อความที่ต้องการส่ง')
      return
    }

    dialog.show({
      type: 'confirm',
      title: 'ยืนยันการส่งประกาศ',
      message: `คุณกำลังจะส่งข้อความถึงนักศึกษาที่ตรงตามเงื่อนไขที่เลือก ต้องการดำเนินการต่อใช่หรือไม่?`,
      onConfirm: async () => {
        dialog.setLoading(true)
        setLoading(true)
        try {
          const res = await fetch('/api/admin/broadcast', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title,
              message,
              filters,
              targetWeek: targetWeek || null,
              sendLine,
              sendInApp
            })
          })

          const data = await res.json()
          if (!res.ok) throw new Error(data.error)

          const hasLineErrors = data.results?.errors && data.results.errors.length > 0
          if (hasLineErrors) {
            if (data.results.line > 0 || data.results.inApp > 0) {
              toast.warning(`ส่งประกาศบางส่วนสำเร็จ (สำเร็จ: LINE ${data.results.line} คน, In-App ${data.results.inApp} คน | ล้มเหลว ${data.results.errors.length} รายการ)`)
            } else {
              toast.error(`ส่งประกาศไม่สำเร็จ: ${data.results.errors.join(', ')}`)
            }
          } else {
            const lineSent = data.results?.line || 0
            const inAppSent = data.results?.inApp || 0
            if (lineSent === 0 && inAppSent === 0) {
              toast.info(`ส่งประกาศแล้ว (ไม่มีเป้าหมายที่ตรงเงื่อนไข หรือผู้ใช้เชื่อม LINE)`)
            } else {
              toast.success(`ส่งประกาศสำเร็จ! (LINE: ${lineSent} คน, In-App: ${inAppSent} คน)`)
            }
          }
          setTitle('')
          setMessage('')
          dialog.hide()
        } catch (error: any) {
          toast.error('ส่งประกาศไม่สำเร็จ: ' + error.message)
          dialog.setLoading(false)
        } finally {
          setLoading(false)
        }
      }
    })
  }

  return (
    <div className="flex-1 overflow-auto p-6 md:p-8 max-w-4xl mx-auto w-full">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Form Section */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-background-secondary border border-border rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <MessageSquare className="w-5 h-5 text-brand" />
              <h2 className="text-[16px] font-black text-text-primary uppercase tracking-tight italic">Compose Message</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">หัวข้อ (สำหรับ In-App)</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="เช่น ประกาศสำคัญ, แจ้งเตือนยอดค้างชำระ"
                  className="w-full bg-background border border-border rounded-xl px-4 py-3 text-[14px] font-medium text-text-primary outline-none focus:ring-2 focus:ring-brand/10 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-1.5">ข้อความ</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="พิมพ์ข้อความที่ต้องการส่งถึงนักศึกษาที่นี่..."
                  rows={6}
                  className="w-full bg-background border border-border rounded-2xl px-4 py-3 text-[14px] font-medium text-text-primary outline-none focus:ring-2 focus:ring-brand/10 transition-all resize-none"
                />
              </div>
            </div>
          </section>

          <section className="bg-background-secondary border border-border rounded-[2rem] p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-6">
              <Users className="w-5 h-5 text-brand" />
              <h2 className="text-[16px] font-black text-text-primary uppercase tracking-tight italic">Recipients & Targeting</h2>
            </div>

            <div className="space-y-6">
              {/* Week Selector */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-2">อ้างอิงสถานะจากงวดที่</label>
                <select
                  value={targetWeek}
                  onChange={(e) => setTargetWeek(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full bg-background border border-border rounded-xl px-4 py-2.5 text-[14px] font-bold text-text-primary outline-none focus:ring-2 focus:ring-brand/10 transition-all appearance-none"
                >
                  <option value="">-- เลือกงวดที่ต้องการ (ถ้าไม่เลือกจะใช้อ้างอิงทุกงวด) --</option>
                  {weekSettings.map(w => (
                    <option key={w.week} value={w.week}>{w.title || `งวดที่ ${w.week}`}</option>
                  ))}
                </select>
                <p className="text-[11px] text-text-muted mt-1.5 ml-1">หากระบุงวด ระบบจะกรองนักศึกษาตามสถานะการจ่ายเงินของงวดนั้น</p>
              </div>

              {/* Filters */}
              <div>
                <label className="block text-[11px] font-black uppercase tracking-widest text-text-muted mb-3">ส่งถึงกลุ่มนักศึกษา</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {filterOptions.map((opt) => {
                    const isActive = filters.includes(opt.id)
                    const Icon = opt.icon
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleFilter(opt.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                          isActive 
                            ? `border-brand bg-brand/5 shadow-sm` 
                            : 'border-border bg-background hover:bg-background-tertiary'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${isActive ? 'bg-brand text-white' : `${opt.bg} ${opt.color}`}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className={`text-[13px] font-bold ${isActive ? 'text-brand' : 'text-text-primary'}`}>
                          {opt.label}
                        </span>
                        {isActive && <div className="ml-auto w-2 h-2 rounded-full bg-brand animate-pulse" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Settings & Action Section */}
        <div className="space-y-6">
          <section className="bg-background-secondary border border-border rounded-[2rem] p-6 shadow-sm sticky top-6">
            <h2 className="text-[14px] font-black text-text-primary uppercase tracking-widest mb-6 border-b border-border pb-3">Delivery Options</h2>
            
            <div className="space-y-4 mb-8">
              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-[13.5px] font-bold text-text-primary group-hover:text-brand transition-colors">LINE Official Account</span>
                  <span className="text-[11px] text-text-muted">ส่งข้อความ Push ผ่าน LINE Bot</span>
                </div>
                <input
                  type="checkbox"
                  checked={sendLine}
                  onChange={(e) => setSendLine(e.target.checked)}
                  className="w-5 h-5 rounded-md border-border text-brand focus:ring-brand transition-all cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between cursor-pointer group">
                <div className="flex flex-col">
                  <span className="text-[13.5px] font-bold text-text-primary group-hover:text-brand transition-colors">In-App Notification</span>
                  <span className="text-[11px] text-text-muted">แสดงแจ้งเตือนในแอปให้นักศึกษา</span>
                </div>
                <input
                  type="checkbox"
                  checked={sendInApp}
                  onChange={(e) => setSendInApp(e.target.checked)}
                  className="w-5 h-5 rounded-md border-border text-brand focus:ring-brand transition-all cursor-pointer"
                />
              </label>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl mb-6">
              <div className="flex gap-2.5 items-start">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-[11.5px] text-amber-800 leading-relaxed">
                  <span className="font-bold">ข้อควรระวัง:</span> การส่ง LINE Push Message จะมีค่าโควตาข้อความของ LINE Official Account โปรดตรวจสอบโควตาก่อนส่งจำนวนมาก
                </div>
              </div>
            </div>

            <button
              onClick={handleSend}
              disabled={loading || !message.trim()}
              className="w-full flex items-center justify-center gap-3 bg-brand text-white py-4 rounded-2xl text-[14px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              Send Broadcast
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
