'use client'

import { cn } from '@/lib/utils'
import Sidebar from './Sidebar'
import { useUIStore } from '@/store/uiStore'
import type { User } from '@/types'
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import ErrorBoundary from '@/components/shared/ErrorBoundary'

interface AppShellProps {
  children: React.ReactNode
  role: 'student' | 'treasurer' | 'admin'
  user: User | null | undefined
  pendingCount?: number
  pendingCredits?: number
  hasUnpaidWeek?: boolean
}

export default function AppShell({ children, role, user = null, pendingCount = 0, pendingCredits = 0, hasUnpaidWeek = false }: AppShellProps) {
  const { isSidebarOpen, closeSidebar } = useUIStore()
  const pathname = usePathname()

  // Close sidebar on navigation
  useEffect(() => {
    closeSidebar()
  }, [pathname, closeSidebar])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 lg:hidden animate-in fade-in duration-200"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-[240px] transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <Sidebar role={role} user={user} pendingCount={pendingCount} pendingCredits={pendingCredits} hasUnpaidWeek={hasUnpaidWeek} />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <main className="flex-1 overflow-y-auto">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}

