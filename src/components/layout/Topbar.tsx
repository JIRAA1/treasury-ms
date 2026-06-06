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
      <div className="h-[64px] bg-background/90 backdrop-blur-xl px-4 md:px-8 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center gap-3">
          {/* Mobile hamburger */}
          <button
            onClick={toggleSidebar}
            className="lg:hidden w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-background-muted transition-all active:scale-95"
          >
            <Menu className="w-4.5 h-4.5" />
          </button>

          {/* Title block */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] md:text-[16px] font-black text-text-primary tracking-tight truncate leading-none">
                {title}
              </h2>
            </div>
            {subtitle && (
              <p className="text-[10px] text-text-muted font-medium truncate mt-0.5 tracking-wide">
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

      {/* Subtle shimmer gradient line under header */}
      <div
        className="h-px w-full"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(15,23,42,0.06) 30%, rgba(181,148,16,0.15) 50%, rgba(15,23,42,0.06) 70%, transparent 100%)',
        }}
      />
    </header>
  )
}
