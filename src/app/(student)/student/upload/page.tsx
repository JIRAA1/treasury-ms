'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Topbar from '@/components/layout/Topbar'
import SlipUploader from '@/components/payments/SlipUploader'
import EmptyState from '@/components/shared/EmptyState'
import { CheckCircle, Clock } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface PaymentCycle {
  week: number
  title: string
  amount: number
  deadline: string
  status: 'unpaid' | 'rejected'
}

export default function UploadPage() {
  const router = useRouter()
  const [unpaidCycles, setUnpaidCycles] = useState<PaymentCycle[]>([])
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        // 1. Get all settings
        const { data: settings } = await supabase
          .from('week_settings')
          .select('*')
          .order('week', { ascending: true })

        // 2. Get user's payment history
        const { data: payments } = await supabase
          .from('payments')
          .select('week, status')
          .eq('user_id', user.id)

        const unpaid: PaymentCycle[] = []
        
        settings?.forEach(s => {
          const p = payments?.find(pay => pay.week === s.week)
          if (!p || p.status === 'rejected') {
            unpaid.push({
              week: s.week,
              title: s.title || `งวดที่ ${s.week}`,
              amount: s.amount,
              deadline: s.deadline,
              status: p?.status === 'rejected' ? 'rejected' : 'unpaid'
            })
          }
        })

        setUnpaidCycles(unpaid)
        if (unpaid.length === 1) setSelectedWeek(unpaid[0].week)
      } catch (error) {
        console.error('Failed to fetch upload data:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [supabase])

  const selectedCycle = unpaidCycles.find(c => c.week === selectedWeek)

  return (
    <div>
      <Topbar title="ส่งสลิปการชำระเงิน" subtitle="อัปโหลดหลักฐานการโอนเงิน" />

      <div className="p-6 max-w-xl">
        {loading ? (
          <div className="h-40 flex items-center justify-center text-[13px] text-text-muted">กำลังโหลด...</div>
        ) : unpaidCycles.length === 0 ? (
          <div className="bg-background-secondary border border-border rounded-xl p-8">
            <EmptyState
              icon={CheckCircle}
              title="ชำระครบทุกงวดแล้ว 🎉"
              description="คุณส่งสลิปครบทุกงวดการชำระที่กำหนดแล้ว ขอบคุณที่ชำระตรงเวลา"
              action={{ label: 'ดูประวัติการชำระ', onClick: () => router.push('/student/history') }}
            />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Step 1: Select Cycle */}
            {selectedWeek === null && (
              <div className="bg-background-secondary border border-border rounded-xl p-5">
                <div className="text-[13.5px] font-semibold text-text-primary mb-1">เลือกงวดที่ต้องการส่งสลิป</div>
                <div className="text-[12px] text-text-muted mb-4">มี {unpaidCycles.length} รายการที่รอการชำระ</div>
                <div className="grid grid-cols-1 gap-2">
                  {unpaidCycles.map((cycle) => (
                    <button
                      key={cycle.week}
                      onClick={() => setSelectedWeek(cycle.week)}
                      className={`flex items-center justify-between border rounded-xl p-4 text-left hover:border-brand transition-all duration-150 ${
                        cycle.status === 'rejected'
                          ? 'border-red-200 bg-red-50/50'
                          : 'border-border bg-background hover:bg-background-tertiary'
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-[14px] font-bold text-text-primary">{cycle.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[12px] font-semibold text-brand">฿{cycle.amount.toLocaleString()}</span>
                          <span className="text-text-muted text-[11px] flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            กำหนดส่ง: {new Date(cycle.deadline).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        {cycle.status === 'rejected' ? (
                          <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">ส่งใหม่</span>
                        ) : (
                          <span className="text-[10px] text-text-muted bg-background-tertiary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider underline">เลือก</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Upload */}
            {selectedWeek !== null && selectedCycle && (
              <div className="bg-background-secondary border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-4 pb-4 border-b border-border">
                  <div>
                    <div className="text-[11px] text-text-muted uppercase tracking-wider font-bold mb-0.5">กำลังส่งสลิปสำหรับ</div>
                    <div className="text-[15px] font-bold text-text-primary">{selectedCycle.title}</div>
                    <div className="text-[12.5px] font-medium text-brand mt-0.5">ยอดโอนที่กำหนด: ฿{selectedCycle.amount.toLocaleString()}</div>
                  </div>
                  {unpaidCycles.length > 1 && (
                    <button onClick={() => setSelectedWeek(null)} className="text-[12px] text-brand hover:underline font-medium">
                      เปลี่ยนงวด
                    </button>
                  )}
                </div>
                <SlipUploader
                  week={selectedWeek}
                  unpaidCycles={unpaidCycles}
                  onWeekChange={setSelectedWeek}
                  onSuccess={() => {
                    setTimeout(() => router.push('/student/dashboard'), 2500)
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
