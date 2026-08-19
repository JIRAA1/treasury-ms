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
          <h1 className="text-xl font-bold text-text-primary tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
            การเก็บเงินพิเศษ
          </h1>
          <p className="text-xs text-text-muted mt-1">
            จัดการการเก็บเงินค่าเสื้อ, ค่าอุปกรณ์, ค่าค่ายกิจกรรมเฉพาะ หรือรายการเงินพิเศษรายบุคคล
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand text-white font-semibold text-xs hover:bg-brand-hover transition-all shadow-sm press-down"
        >
          <Plus className="w-4 h-4" />
          สร้างรายการเก็บเงินพิเศษ
        </button>
      </div>

      {/* Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-border rounded-2xl p-4 card-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">โครงการทั้งหมด</span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-text-primary mt-2 tabular-nums">
            {collections.length} <span className="text-xs font-normal text-text-muted">รายการ</span>
          </div>
        </div>

        <div className="bg-white border border-border rounded-2xl p-4 card-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">ยอดเงินจัดเก็บได้รวม</span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-accent-emerald mt-2 tabular-nums">
            ฿{totalCollectedAll.toLocaleString()}
          </div>
        </div>

        <div className="bg-white border border-border rounded-2xl p-4 card-shadow">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">สลิปที่รอตรวจสอบ</span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2 tabular-nums">
            {totalPendingSlips} <span className="text-xs font-normal text-text-muted">สลิป</span>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            placeholder="ค้นหาชื่อโครงการ หรือรายละเอียด..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white border border-border text-xs text-text-primary placeholder:text-text-disabled focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand/20 transition-all"
          />
        </div>
      </div>

      {/* Collection Cards List */}
      {loading ? (
        <div className="py-12 text-center text-xs text-text-muted animate-pulse">
          กำลังโหลดรายการเก็บเงินพิเศษ...
        </div>
      ) : filtered.length === 0 ? (
        <div className="p-12 text-center rounded-2xl border-2 border-dashed border-border bg-background-tertiary">
          <ShoppingBag className="w-10 h-10 text-text-disabled mx-auto mb-3" />
          <div className="text-sm font-semibold text-text-secondary">ยังไม่มีรายการเก็บเงินพิเศษ</div>
          <p className="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            กดปุ่ม &quot;สร้างรายการเก็บเงินพิเศษ&quot; ด้านบน เพื่อสร้างการเก็บเงินค่าเสื้อ ค่ากิจกรรม หรืออุปกรณ์รายบุคคล
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
                className="group relative p-5 rounded-2xl bg-white border border-border hover:border-brand/40 hover:shadow-md transition-all flex flex-col justify-between card-shadow hover-lift"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                        col.is_active
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-background-muted text-text-muted border border-border'
                      }`}>
                        {col.is_active ? 'เปิดรับชำระ' : 'ปิดแล้ว'}
                      </span>

                      {col.allow_installments && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                          <Sparkles className="w-3 h-3" />
                          ผ่อนได้ {col.max_installments} งวด
                        </span>
                      )}
                    </div>

                    <ChevronRight className="w-4 h-4 text-text-disabled group-hover:text-brand group-hover:translate-x-1 transition-all" />
                  </div>

                  <h3 className="text-base font-bold text-text-primary group-hover:text-brand transition-colors">
                    {col.title}
                  </h3>

                  {col.description && (
                    <p className="text-xs text-text-muted line-clamp-2 mt-1">
                      {col.description}
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-border space-y-3">
                  {/* Price & Due Date */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-secondary">
                      ราคาปกติ: <strong className="text-text-primary">฿{col.default_amount.toLocaleString()}</strong>
                    </span>
                    {col.due_date && (
                      <span className="text-text-muted flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-amber-500" />
                        กำหนด: {new Date(col.due_date).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="text-text-muted flex items-center gap-1">
                        <Users className="w-3 h-3 text-blue-500" />
                        ชำระแล้ว {stats.total_paid}/{stats.total_assigned} คน
                      </span>
                      <span className="font-bold text-brand">{progress}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-background-muted overflow-hidden">
                      <div
                        className="h-full gradient-brand rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Amount summary */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-text-muted">จัดเก็บได้แล้ว</span>
                    <span className="font-bold text-accent-emerald tabular-nums">
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
