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
  ShoppingBag,
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
  { label: 'ส่งสลิปงวดปกติ', href: '/student/upload', icon: Upload },
  { label: 'การเก็บเงินพิเศษ', href: '/student/special-collections', icon: ShoppingBag },
  { label: 'ประวัติการเงิน', href: '/student/history', icon: Clock },
  { label: 'รายชื่อในชั้น', href: '/student/classmates', icon: Users2 },
  { label: 'ความโปร่งใส', href: '/student/transparency', icon: Eye },
]

const adminNav = (pendingCount: number, pendingCredits = 0): NavItem[] => [
  { label: 'ภาพรวมระบบ', href: '/admin/overview', icon: LayoutDashboard },
  { label: 'จัดการการชำระ', href: '/admin/payments', icon: CreditCard, badge: pendingCount > 0 ? pendingCount : undefined },
  { label: 'การเก็บเงินพิเศษ', href: '/admin/special-collections', icon: ShoppingBag },
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
    <aside className="w-full h-full flex flex-col overflow-hidden relative gradient-sidebar">
      {/* Subtle ambient glows */}
      <div className="absolute top-0 left-0 w-48 h-48 opacity-[0.15] pointer-events-none orb-brand" />
      <div className="absolute bottom-32 right-0 w-32 h-32 opacity-[0.1] pointer-events-none orb-gold" />

      {/* Logo */}
      <div className="relative h-[68px] flex items-center justify-between px-4 border-b border-white/[0.05]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[10px] overflow-hidden flex-shrink-0 ring-1 ring-white/10"
            style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.06) 100%)' }}
          >
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain p-1" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-[13px] font-black text-white tracking-wide uppercase">Treasury</span>
            <span className="text-[8.5px] font-semibold text-white/25 tracking-[0.3em] uppercase mt-[3px]">Management</span>
          </div>
        </div>
        <button onClick={closeSidebar} className="lg:hidden w-7 h-7 flex items-center justify-center rounded-lg text-white/25 hover:text-white/60 hover:bg-white/[0.05] transition-all">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Role label */}
      <div className="px-4 pt-5 pb-1">
        <span className="text-[8px] font-black uppercase tracking-[0.35em] text-white/15">
          {isViewingAdmin ? 'Administration' : 'Student Portal'}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 overflow-y-auto space-y-0.5 py-2 pb-3">
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
                'relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-200 group',
                isActive
                  ? 'text-[#0d1427]'
                  : 'text-white/40 hover:text-white/75 hover:bg-white/[0.05]'
              )}
              style={isActive ? {
                background: 'linear-gradient(135deg, rgba(255,255,255,0.97) 0%, rgba(240,243,255,0.97) 100%)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.15)',
              } : undefined}
            >
              <Icon className={cn(
                'w-[15px] h-[15px] flex-shrink-0 transition-all duration-200',
                isActive ? 'text-brand' : 'text-white/25 group-hover:text-white/55'
              )} />

              <span className="flex-1 tracking-tight">{item.label}</span>

              {showDot && !isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 pulse-dot" />
              )}
              {item.badge !== undefined && (item.badge as number) > 0 && (
                <span className={cn(
                  'text-[8px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center tabular-nums',
                  isActive
                    ? 'bg-brand/10 text-brand'
                    : 'bg-rose-500/90 text-white shadow-sm shadow-rose-900/30'
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-4 h-px bg-white/[0.05]" />

      {/* Bottom section */}
      <div className="p-2.5 space-y-2 pt-2.5">
        {isAdmin && (
          <Link
            href={isViewingAdmin ? '/student/dashboard' : '/admin/overview'}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-white/[0.07] text-white/35 text-[10px] font-bold uppercase tracking-widest hover:text-white/65 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all press-down"
          >
            <ArrowLeftRight className="w-3 h-3" />
            {isViewingAdmin ? 'Student Mode' : 'Admin Mode'}
          </Link>
        )}

        {/* User profile card */}
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black text-white"
            style={{ background: 'linear-gradient(135deg, rgba(212,168,71,0.5), rgba(212,168,71,0.2))', border: '1px solid rgba(212,168,71,0.2)' }}
          >
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-bold text-white/80 truncate tracking-tight leading-tight">{user?.fullname}</div>
            <div className="text-[9px] text-white/25 truncate font-mono uppercase font-bold tracking-tight mt-0.5">{user?.student_id}</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
