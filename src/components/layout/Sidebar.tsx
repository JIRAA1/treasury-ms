'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Upload,
  Clock,
  Eye,
  CreditCard,
  Receipt,
  Users,
  Users2,
  BarChart3,
  Shield,
  Settings,
  ChevronLeft,
  MessageSquare,
  TrendingUp,
  ArrowLeftRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { User } from '@/types'
import { useUIStore } from '@/store/uiStore'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: number | string
  dot?: boolean
}

const studentNav: NavItem[] = [
  { label: 'แดชบอร์ด', href: '/student/dashboard', icon: LayoutDashboard },
  { label: 'ส่งสลิป', href: '/student/upload', icon: Upload },
  { label: 'ประวัติการเงิน', href: '/student/history', icon: Clock },
  { label: 'รายชื่อในชั้น', href: '/student/classmates', icon: Users2 },
  { label: 'ความโปร่งใส', href: '/student/transparency', icon: Eye },
]

const adminNav = (pendingCount: number, pendingCredits = 0): NavItem[] => [
  { label: 'ภาพรวมระบบ', href: '/admin/overview', icon: LayoutDashboard },
  { label: 'จัดการการชำระ', href: '/admin/payments', icon: CreditCard, badge: pendingCount > 0 ? pendingCount : undefined },
  { label: 'รายรับ (แหล่งอื่น)', href: '/admin/incomes', icon: TrendingUp },
  { label: 'บัญชีรายจ่าย', href: '/admin/expenses', icon: Receipt },
  { label: 'บันทึก Credit', href: '/admin/credits', icon: Clock, badge: pendingCredits > 0 ? pendingCredits : undefined },
  { label: 'ส่งข่าวสาร', href: '/admin/broadcast', icon: MessageSquare },
  { label: 'รายชื่อนักศึกษา', href: '/admin/students', icon: Users },
  { label: 'รายงานการเงิน', href: '/admin/reports', icon: BarChart3 },
  { label: 'Audit Logs', href: '/admin/audit', icon: Shield },
  { label: 'ตั้งค่าระบบ', href: '/admin/settings', icon: Settings },
]

export default function Sidebar({ 
  role, 
  user, 
  pendingCount = 0, 
  pendingCredits = 0,
  hasUnpaidWeek = false 
}: { 
  role: string, 
  user: User | null, 
  pendingCount: number, 
  pendingCredits?: number,
  hasUnpaidWeek: boolean 
}) {
  const pathname = usePathname()
  const { closeSidebar } = useUIStore()
  const isAdmin = role === 'admin' || role === 'treasurer'
  
  const isViewingAdmin = pathname.startsWith('/admin')
  const navItems = isViewingAdmin ? adminNav(pendingCount, pendingCredits) : studentNav

  const initials = user?.fullname
    ? user.fullname.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  return (
    <aside className="w-full h-full flex flex-col overflow-hidden relative"
      style={{ background: 'linear-gradient(180deg, #0c1628 0%, #0f172a 60%, #111827 100%)' }}
    >
      {/* Subtle background texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #4f8ef7 0%, transparent 60%), radial-gradient(circle at 80% 20%, #b59410 0%, transparent 50%)' }}
      />

      {/* Logo */}
      <div className="relative h-[72px] flex items-center justify-between px-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-black/30 overflow-hidden flex-shrink-0">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-[14px] font-black text-white tracking-tight leading-none italic uppercase">Treasury</span>
            <span className="text-[9px] font-bold text-white/30 tracking-[0.25em] uppercase mt-0.5">Management</span>
          </div>
        </div>
        <button onClick={closeSidebar} className="lg:hidden p-2 text-white/30 hover:text-white/70 transition-colors rounded-lg hover:bg-white/5">
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation section label */}
      <div className="px-5 pt-5 pb-2">
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-white/20">
          {isViewingAdmin ? 'Administration' : 'Student Portal'}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 overflow-y-auto space-y-0.5 pb-2">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          const showDot = item.href === '/student/upload' && hasUnpaidWeek

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={closeSidebar}
              className={cn(
                'relative flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] font-semibold transition-all duration-150 group',
                isActive
                  ? 'bg-white text-brand shadow-lg shadow-black/20'
                  : 'text-white/45 hover:text-white/80 hover:bg-white/[0.06]'
              )}
            >
              {/* Active left accent */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full"
                  style={{ background: 'linear-gradient(180deg, #4f46e5, #8b5cf6)' }}
                />
              )}

              <Icon className={cn(
                'w-[15px] h-[15px] flex-shrink-0 transition-transform duration-150',
                isActive ? 'text-brand' : 'text-white/30 group-hover:text-white/60 group-hover:scale-110'
              )} />

              <span className="flex-1 tracking-tight">{item.label}</span>

              {showDot && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-dot" />
              )}
              {item.badge !== undefined && (item.badge as number) > 0 && (
                <span className={cn(
                  'text-[8px] font-black px-1 py-0.5 rounded-full min-w-[16px] text-center tabular-nums',
                  isActive
                    ? 'bg-brand/10 text-brand'
                    : 'bg-rose-500 text-white shadow-sm shadow-rose-500/30'
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="p-3 space-y-2 border-t border-white/[0.06]">
        {isAdmin && (
          <Link
            href={isViewingAdmin ? '/student/dashboard' : '/admin/overview'}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-white/10 text-white/50 text-[10px] font-bold uppercase tracking-widest hover:text-white/80 hover:bg-white/[0.06] hover:border-white/20 transition-all press-down"
          >
            <ArrowLeftRight className="w-3 h-3" />
            {isViewingAdmin ? 'Student Mode' : 'Admin Mode'}
          </Link>
        )}

        {/* User profile card */}
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10.5px] font-black text-white"
            style={{ background: 'linear-gradient(135deg, rgba(181,148,16,0.5), rgba(181,148,16,0.2))', border: '1px solid rgba(181,148,16,0.25)' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold text-white/85 truncate tracking-tight">{user?.fullname}</div>
            <div className="text-[9px] text-white/30 truncate font-mono uppercase font-bold tracking-tight">{user?.student_id}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
