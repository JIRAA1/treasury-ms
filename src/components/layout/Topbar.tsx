'use client'

import { Menu } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import InAppNotifications from './InAppNotifications'

interface TopbarProps {
  title: string
  subtitle?: string
  backHref?: string
  actions?: React.ReactNode
}

export default function Topbar({ title, subtitle, actions }: TopbarProps) {
  const { toggleSidebar } = useUIStore()

  return (
    <header className="sticky top-0 z-30">
      {/* Main bar */}
      <div
        className="h-[60px] px-4 md:px-7 flex items-center justify-between"
        style={{
          background: 'rgba(245,247,252,0.88)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          borderBottom: '1px solid rgba(0,0,0,0.055)',
        }}
      >
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-background-muted transition-all active:scale-95"
          >
            <Menu className="w-4 h-4" />
          </button>

          {/* Title block */}
          <div className="min-w-0">
            <h2 className="text-[15px] md:text-[16px] font-black text-text-primary tracking-tight truncate leading-none">
              {title}
            </h2>
            {subtitle && (
              <p className="text-[10.5px] text-text-muted font-medium truncate mt-[3px] tracking-wide leading-none">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 md:gap-3">
          {actions && (
            <>
              <div className="flex items-center gap-2">{actions}</div>
              <div className="hidden md:block h-5 w-px bg-border mx-1" />
            </>
          )}
          <InAppNotifications />
        </div>
      </div>

      {/* Premium gradient accent line */}
      <div
        className="h-[1px] w-full"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(61,82,213,0.12) 30%, rgba(212,168,71,0.2) 60%, transparent 100%)',
        }}
      />
    </header>
  )
}
