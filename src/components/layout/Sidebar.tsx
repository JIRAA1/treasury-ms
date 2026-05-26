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

const adminNav = (pendingCount: number): NavItem[] => [
  { label: 'ภาพรวมระบบ', href: '/admin/overview', icon: LayoutDashboard },
  { label: 'จัดการการชำระ', href: '/admin/payments', icon: CreditCard, badge: pendingCount > 0 ? pendingCount : undefined },
  { label: 'รายรับ (แหล่งอื่น)', href: '/admin/incomes', icon: TrendingUp },
  { label: 'บัญชีรายจ่าย', href: '/admin/expenses', icon: Receipt },
  { label: 'ส่งข่าวสาร (Broadcast)', href: '/admin/broadcast', icon: MessageSquare },
  { label: 'รายชื่อนักศึกษา', href: '/admin/students', icon: Users },
  { label: 'รายงานการเงิน', href: '/admin/reports', icon: BarChart3 },
  { label: 'Audit Logs', href: '/admin/audit', icon: Shield },
  { label: 'ตั้งค่าระบบ', href: '/admin/settings', icon: Settings },
]

export default function Sidebar({ 
  role, 
  user, 
  pendingCount = 0, 
  hasUnpaidWeek = false 
}: { 
  role: string, 
  user: User | null, 
  pendingCount: number, 
  hasUnpaidWeek: boolean 
}) {
  const pathname = usePathname()
  const { closeSidebar } = useUIStore()
  const isAdmin = role === 'admin' || role === 'treasurer'
  
  const isViewingAdmin = pathname.startsWith('/admin')
  const navItems = isViewingAdmin ? adminNav(pendingCount) : studentNav

  const initials = user?.fullname
    ? user.fullname.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U'

  // Show profile picture only for student view (if we had it, but we don't in db anymore)
  const showProfilePic = false

  return (
    <aside className="w-full h-full bg-brand flex flex-col shadow-2xl overflow-hidden border-r border-white/5">
      {/* Logo & Close Button (Mobile) */}
      <div className="h-[80px] flex items-center justify-between px-6 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center p-1.5 shadow-xl">
            <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
          </div>
          <div className="flex flex-col">
            <span className="text-[15px] font-black text-white tracking-tighter leading-none italic uppercase">Treasury</span>
            <span className="text-[10px] font-bold text-white/40 tracking-[0.2em] uppercase mt-1">Management</span>
          </div>
        </div>
        <button onClick={closeSidebar} className="lg:hidden p-2 text-white/40 hover:text-white transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 overflow-y-auto custom-scrollbar">
        <div className="space-y-1.5">
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
                  'flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[13.5px] font-bold transition-all duration-200 group relative',
                  isActive
                    ? 'bg-white text-brand shadow-2xl shadow-white/10'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                )}
              >
                {isActive && (
                  <div className="absolute left-0 w-1 h-6 bg-accent-gold rounded-full" />
                )}
                <Icon className={cn("w-[18px] h-[18px] transition-transform group-hover:scale-110", isActive ? "text-brand" : "text-white/30")} />
                <span className="flex-1 tracking-tight">{item.label}</span>
                {showDot && !isActive && (
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-lg shadow-amber-400/20" />
                )}
                {item.badge !== undefined && (item.badge as number) > 0 && (
                  <span className={cn(
                    'text-[10px] font-black px-2 py-0.5 rounded-full min-w-[22px] text-center',
                    isActive ? 'bg-brand/10 text-brand' : 'bg-accent-emerald text-white'
                  )}>
                    {item.badge}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Switcher & User */}
      <div className="p-4 mt-auto space-y-4">
        {isAdmin && (
          <Link
            href={isViewingAdmin ? '/student/dashboard' : '/admin/overview'}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border border-white/10 bg-white/5 text-white text-[11px] font-black uppercase tracking-widest hover:bg-white/10 transition-all active:scale-95"
          >
            {isViewingAdmin ? 'สลับเข้าโหมด Student' : 'สลับเข้าโหมด Admin'}
          </Link>
        )}

        <div className="bg-white/5 rounded-[1.5rem] p-4 border border-white/5 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-white/20 to-white/5 flex items-center justify-center border border-white/10 overflow-hidden shadow-inner">
              <span className="text-white text-[13px] font-black">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13.5px] font-black text-white truncate tracking-tight">{user?.fullname}</div>
              <div className="text-[10px] text-white/30 truncate font-mono tracking-tighter uppercase font-bold">{user?.student_id}</div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}
