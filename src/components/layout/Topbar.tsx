'use client'

import { Menu, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
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
    <header className="h-[70px] bg-background-secondary/80 backdrop-blur-md border-b border-border sticky top-0 z-30 px-4 md:px-8">
      <div className="h-full flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-4">
          <button 
            onClick={toggleSidebar}
            className="lg:hidden p-2 text-text-secondary hover:bg-background-tertiary rounded-xl transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="min-w-0">
            <h2 className="text-[16px] md:text-[18px] font-black text-text-primary tracking-tight truncate leading-tight uppercase italic">{title}</h2>
            {subtitle && (
              <p className="text-[11px] md:text-[12px] text-text-muted font-medium truncate uppercase tracking-wider">{subtitle}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-3 ml-4">
          {actions}
          <div className="hidden md:flex h-8 w-px bg-border mx-1" />
          <InAppNotifications />
        </div>
      </div>
    </header>
  )
}
