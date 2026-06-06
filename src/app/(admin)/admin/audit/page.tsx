import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import Topbar from '@/components/layout/Topbar'
import { formatDate, cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'
import { redirect } from 'next/navigation'
import { Download, Shield, User, Activity as ActivityIcon, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { Fragment } from 'react'
import { DeleteLogButton, ClearAllLogsButton } from './AuditClientComponents'


export const metadata = { title: 'ตรวจสอบ — TreasuryMS Admin' }

const actionCategory = (action: string) => {
  if (action.startsWith('payment')) return 'blue'
  if (action.startsWith('expense')) return 'amber'
  if (action.startsWith('income')) return 'emerald'
  if (action.startsWith('notification')) return 'gray'
  if (action.startsWith('system')) return 'red'
  if (action.startsWith('audit')) return 'red'
  return 'gray'
}

const actionLabel: Record<string, string> = {
  payment_uploaded: 'อัปโหลดสลิป',
  payment_approved: 'อนุมัติการชำระ',
  payment_rejected: 'ปฏิเสธสลิป',
  expense_created: 'เพิ่มค่าใช้จ่าย',
  expense_approved: 'อนุมัติค่าใช้จ่าย',
  expense_deleted: 'ลบค่าใช้จ่าย',
  income_created: 'เพิ่มรายรับ',
  income_approved: 'อนุมัติรายรับ',
  income_deleted: 'ลบรายรับ',
  notification_sent: 'ส่งแจ้งเตือน',
  broadcast_sent: 'บรอดแคสต์',
  student_binding_reset: 'รีเซ็ต LINE',
  user_role_changed: 'เปลี่ยน Role',
  system_reset: 'รีเซ็ตระบบ',
  clear_payments: 'ล้างประวัติการโอน',
  audit_deleted: 'ลบ Log',
  audit_cleared: 'ล้าง Log ทั้งหมด'
}

const categoryBadge: Record<string, string> = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  gray: 'bg-background-muted text-text-secondary border-border',
  red: 'bg-red-50 text-red-700 border-red-100',
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const PER_PAGE = 30
  const page = Math.max(1, parseInt(pageParam ?? '1'))
  const from = (page - 1) * PER_PAGE
  const to = from + PER_PAGE - 1

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const adminClient = createAdminClient()
  
  // Use adminClient to ensure we see all logs regardless of RLS
  const { data: logs, count: totalLogs } = await adminClient
    .from('audit_logs')
    .select('*, actor:actor_id(fullname, student_id)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  const totalPages = Math.ceil((totalLogs ?? 0) / PER_PAGE)

  return (
    <div>
      <Topbar 
        title="ตรวจสอบระบบ" 
        subtitle={`Audit Logs — ทั้งหมด ${totalLogs ?? 0} รายการ · หน้า ${page}/${totalPages}`} 
        actions={
          <div className="flex items-center gap-2">
            {logs && logs.length > 0 && <ClearAllLogsButton />}
            <a
              href="/api/reports/export?type=audit"
              className="flex items-center gap-1.5 border border-border bg-background text-[11px] font-bold px-3 py-1.5 rounded-lg hover:bg-background-tertiary transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              ส่งออกข้อมูล (.xlsx)
            </a>
          </div>
        }
      />

      <div className="p-6">
        <div className="bg-background-secondary border border-border rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead className="bg-background-tertiary/50 border-b border-border">
                <tr>
                  <th className="px-6 py-4 text-left font-bold text-text-muted text-[10px] uppercase tracking-widest">เวลา</th>
                  <th className="px-6 py-4 text-left font-bold text-text-muted text-[10px] uppercase tracking-widest">ผู้ดำเนินการ</th>
                  <th className="px-6 py-4 text-left font-bold text-text-muted text-[10px] uppercase tracking-widest">กิจกรรม</th>
                  <th className="px-6 py-4 text-left font-bold text-text-muted text-[10px] uppercase tracking-widest">เป้าหมาย (ID)</th>
                  <th className="px-6 py-4 text-left font-bold text-text-muted text-[10px] uppercase tracking-widest">รายละเอียดการเปลี่ยน</th>
                  <th className="px-6 py-4 text-right font-bold text-text-muted text-[10px] uppercase tracking-widest w-[80px]">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs?.map((log) => {
                  const actor = log.actor as { fullname: string; student_id: string } | null
                  const cat = actionCategory(log.action)
                  
                  // Smarter change detection for display
                  let changeDisplay = '—'
                  if (log.new_value && !log.old_value) {
                    changeDisplay = `เพิ่มข้อมูลใหม่: ${JSON.stringify(log.new_value).slice(0, 50)}...`
                  } else if (log.old_value && log.new_value) {
                    const keys = Object.keys(log.new_value)
                    const diffs = keys.filter(k => JSON.stringify(log.old_value[k]) !== JSON.stringify(log.new_value[k]))
                    if (diffs.length > 0) {
                      changeDisplay = diffs.map(k => `${k}: ${JSON.stringify(log.old_value[k])} → ${JSON.stringify(log.new_value[k])}`).join(', ')
                    }
                  }

                  return (
                    <tr key={log.id} className="hover:bg-background-tertiary/30 transition-colors group">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-[11.5px] font-bold text-text-primary">
                          {formatDistanceToNow(new Date(log.created_at), { locale: th, addSuffix: true })}
                        </div>
                        <div className="text-[10px] text-text-disabled font-medium uppercase tracking-tight">
                          {new Date(log.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {actor ? (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-brand/5 flex items-center justify-center border border-brand/10">
                              <User className="w-4 h-4 text-brand" />
                            </div>
                            <div>
                              <div className="font-bold text-text-primary text-[12px]">{actor.fullname}</div>
                              <div className="text-[10px] text-text-muted font-mono tracking-tighter">{actor.student_id}</div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-background-tertiary flex items-center justify-center border border-border">
                              <Shield className="w-4 h-4 text-text-disabled" />
                            </div>
                            <span className="text-text-disabled font-bold italic text-[11px]">ระบบอัตโนมัติ</span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          'text-[10px] font-black border px-2 py-0.5 rounded-full uppercase tracking-wider',
                          categoryBadge[cat]
                        )}>
                          {actionLabel[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-[10px] text-text-disabled bg-background-tertiary/50 px-1.5 py-0.5 rounded border border-border/50 inline-block truncate max-w-[100px]">
                          {log.target_id || 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div 
                          className="text-[11px] text-text-secondary leading-relaxed max-w-[300px] line-clamp-2 hover:line-clamp-none cursor-default transition-all"
                          title={changeDisplay}
                        >
                          {changeDisplay}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <DeleteLogButton id={log.id} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {!logs?.length && (
            <div className="py-24 text-center space-y-3">
              <div className="w-16 h-16 bg-background-tertiary rounded-full flex items-center justify-center mx-auto">
                <ActivityIcon className="w-8 h-8 text-text-disabled" />
              </div>
              <p className="text-[13px] text-text-muted font-medium italic">ยังไม่มีบันทึกกิจกรรมในขณะนี้</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-background-secondary/50">
              <div className="text-[11px] text-text-muted">
                แสดง {from + 1}–{Math.min(to + 1, totalLogs ?? 0)} จาก {totalLogs ?? 0} รายการ
              </div>
              <div className="flex items-center gap-1">
                {page > 1 && (
                  <Link
                    href={`?page=${page - 1}`}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-background-tertiary transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4 text-text-secondary" />
                  </Link>
                )}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => Math.abs(p - page) <= 2 || p === 1 || p === totalPages)
                  .map((p, idx, arr) => (
                    <Fragment key={p}>
                      {idx > 0 && arr[idx - 1] !== p - 1 && (
                        <span className="px-1 text-text-disabled text-[12px]">...</span>
                      )}
                      <Link
                        href={`?page=${p}`}
                        className={`w-8 h-8 flex items-center justify-center rounded-lg text-[11px] font-medium transition-colors ${
                          p === page
                            ? 'bg-brand text-white'
                            : 'text-text-secondary hover:bg-background-secondary border border-border'
                        }`}
                      >
                        {p}
                      </Link>
                    </Fragment>
                  ))}
                {page < totalPages && (
                  <Link
                    href={`?page=${page + 1}`}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-border hover:bg-background-tertiary transition-colors"
                  >
                    <ChevronRight className="w-4 h-4 text-text-secondary" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
