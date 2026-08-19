'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ShoppingBag,
  Plus,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  ChevronRight,
  Sparkles,
  CreditCard,
  Layers,
  Filter,
  Search,
} from 'lucide-react'
import CreateSpecialCollectionModal from '@/components/special-collections/CreateSpecialCollectionModal'
import type { SpecialCollection } from '@/types'

export default function AdminSpecialCollectionsPage() {
  const [collections, setCollections] = useState<SpecialCollection[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const fetchCollections = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/special-collections')
      const data = await res.json()
      if (data.collections) {
        setCollections(data.collections)
      }
    } catch (err) {
      console.error('Failed to fetch special collections:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCollections()
  }, [])

  const filtered = collections.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    (c.description && c.description.toLowerCase().includes(search.toLowerCase()))
  )

  const totalCollectedAll = collections.reduce((acc, c) => acc + (c.stats?.total_amount_collected || 0), 0)
  const totalPendingSlips = collections.reduce((acc, c) => acc + (c.stats?.total_pending || 0), 0)

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 text-amber-400">
              <ShoppingBag className="w-5 h-5" />
            </div>
            การเก็บเงินพิเศษ (Special Collections)
          </h1>
          <p className="text-xs text-white/50 mt-1">
            จัดการการเก็บเงินค่าเสื้อ, ค่าอุปกรณ์, ค่าค่ายกิจกรรมเฉพาะ หรือรายการเงินพิเศษรายบุคคล
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-semibold text-xs hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/20 press-down"
        >
          <Plus className="w-4 h-4" />
          สร้างรายการเก็บเงินพิเศษ
        </button>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/60">โครงการทั้งหมด</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-white mt-2 tabular-nums">
            {collections.length} <span className="text-xs font-normal text-white/40">รายการ</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/60">ยอดเงินจัดเก็บได้รวม</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-400 mt-2 tabular-nums">
            ฿{totalCollectedAll.toLocaleString()}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-white/60">สลิปที่รอตรวจสอบ</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-400 mt-2 tabular-nums">
            {totalPendingSlips} <span className="text-xs font-normal text-white/40">สลิป</span>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            placeholder="ค้นหาชื่อโครงการ หรือรายละเอียด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/50 transition-all"
          />
        </div>
      </div>

      {/* Collection Cards List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-white/40 animate-pulse">
          กำลังโหลดรายการเก็บเงินพิเศษ...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02]">
          <ShoppingBag className="w-10 h-10 text-white/20 mx-auto mb-3" />
          <div className="text-sm font-semibold text-white/70">ยังไม่มีรายการเก็บเงินพิเศษ</div>
          <p className="text-xs text-white/40 mt-1 max-w-sm mx-auto">
            กดปุ่ม "สร้างรายการเก็บเงินพิเศษ" ด้านบน เพื่อสร้างการเก็บเงินค่าเสื้อ ค่ากิจกรรม หรืออุปกรณ์รายบุคคล
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((col) => {
            const stats = col.stats || {
              total_assigned: 0,
              total_paid: 0,
              total_pending: 0,
              total_amount_expected: 0,
              total_amount_collected: 0,
            }
            const progress = stats.total_assigned > 0
              ? Math.round((stats.total_paid / stats.total_assigned) * 100)
              : 0

            return (
              <Link
                key={col.id}
                href={`/admin/special-collections/${col.id}`}
                className="group relative p-5 rounded-2xl bg-white/[0.03] border border-white/[0.08] hover:border-amber-500/40 hover:bg-white/[0.05] transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        col.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-white/10 text-white/50'
                      }`}>
                        {col.is_active ? 'เปิดรับชำระ' : 'ปิดแล้ว'}
                      </span>

                      {col.allow_installments && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          ผ่อนได้ {col.max_installments} งวด
                        </span>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-white/30 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition-colors">
                    {col.title}
                  </h3>

                  {col.description && (
                    <p className="text-xs text-white/50 line-clamp-2 mt-1">
                      {col.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-white/[0.06] space-y-3">
                  {/* Price & Due Date */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/60">
                      ราคาปกติ: <strong className="text-white">฿{col.default_amount.toLocaleString()}</strong>
                    </span>
                    {col.due_date && (
                      <span className="text-white/40 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-400/80" />
                        กำหนด: {new Date(col.due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-white/50 flex items-center gap-1">
                        <Users className="w-3 h-3 text-blue-400" />
                        ชำระแล้ว {stats.total_paid}/{stats.total_assigned} คน
                      </span>
                      <span className="font-bold text-amber-400">{progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Amount summary */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-white/40">จัดเก็บได้แล้ว</span>
                    <span className="font-bold text-emerald-400 tabular-nums">
                      ฿{stats.total_amount_collected.toLocaleString()} / ฿{stats.total_amount_expected.toLocaleString()}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {isModalOpen && (
        <CreateSpecialCollectionModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onCreated={fetchCollections}
        />
      )}
    </div>
  )
}
