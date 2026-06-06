'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Loader2, CheckCheck, Info, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { th } from 'date-fns/locale'

const typeConfig: Record<string, { icon: typeof Info; bg: string; color: string }> = {
  info:    { icon: Info,          bg: 'bg-blue-50',    color: 'text-blue-500' },
  warning: { icon: AlertTriangle, bg: 'bg-amber-50',   color: 'text-amber-500' },
  success: { icon: CheckCircle,   bg: 'bg-emerald-50', color: 'text-emerald-600' },
  error:   { icon: XCircle,       bg: 'bg-red-50',     color: 'text-red-500' },
}

function timeAgo(iso: string) {
  try {
    return formatDistanceToNow(new Date(iso), { locale: th, addSuffix: true })
  } catch {
    return '—'
  }
}

export default function InAppNotifications() {
  const [isOpen, setIsOpen]           = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const supabase = createClient()

  const fetchNotifications = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .or(`id.eq.${user.id},student_id.eq.${user.user_metadata?.student_id || 'NONE'}`)
      .maybeSingle()

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile?.id || user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    setNotifications(data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    fetchNotifications()
    const channel = supabase
      .channel('notif-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, fetchNotifications)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, fetchNotifications])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase.from('users').select('id')
      .or(`id.eq.${user.id},student_id.eq.${user.user_metadata?.student_id || 'NONE'}`).maybeSingle()
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', profile?.id || user.id).eq('is_read', false)
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter(n => !n.is_read).length
  const hasUnread = unreadCount > 0

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl text-text-muted hover:text-text-primary hover:bg-background-muted transition-all active:scale-95"
        aria-label="การแจ้งเตือน"
      >
        <Bell className={cn('w-[18px] h-[18px] transition-transform', isOpen && 'scale-90')} />

        {hasUnread && (
          <>
            {/* Pulse ring */}
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5">
              <span className="absolute inset-0 rounded-full bg-red-400 opacity-60 animate-ping" />
              <span className="relative flex w-2.5 h-2.5 rounded-full bg-red-500 items-center justify-center border border-white">
                {unreadCount <= 9 && (
                  <span className="text-[7px] font-black text-white leading-none">{unreadCount}</span>
                )}
              </span>
            </span>
          </>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-[340px] z-50 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
            <div className="bg-background-secondary border border-border rounded-2xl shadow-2xl overflow-hidden"
              style={{ boxShadow: '0 20px 60px -10px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)' }}
            >
              {/* Header */}
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-black text-text-primary uppercase tracking-tight">แจ้งเตือน</span>
                  {hasUnread && (
                    <span className="text-[9px] font-black bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {hasUnread && (
                  <button
                    onClick={markAllAsRead}
                    className="flex items-center gap-1 text-[10px] font-bold text-text-muted hover:text-brand transition-colors"
                  >
                    <CheckCheck className="w-3 h-3" />
                    อ่านทั้งหมด
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-[360px] overflow-y-auto">
                {loading ? (
                  <div className="py-12 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-14 text-center">
                    <div className="w-10 h-10 bg-background-muted rounded-full flex items-center justify-center mx-auto mb-3">
                      <Bell className="w-5 h-5 text-text-disabled" />
                    </div>
                    <p className="text-[12px] text-text-muted font-medium">ไม่มีการแจ้งเตือน</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/50">
                    {notifications.map((n, idx) => {
                      const cfg = typeConfig[n.type] ?? typeConfig.info
                      const TypeIcon = cfg.icon
                      return (
                        <button
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className={cn(
                            'w-full text-left flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-background-muted/60 relative',
                            !n.is_read && 'bg-brand/[0.025]'
                          )}
                          style={{ animationDelay: `${idx * 30}ms` }}
                        >
                          {!n.is_read && (
                            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full bg-brand" />
                          )}
                          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5', cfg.bg)}>
                            <TypeIcon className={cn('w-3.5 h-3.5', cfg.color)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={cn('text-[12.5px] font-semibold truncate', !n.is_read ? 'text-text-primary' : 'text-text-secondary')}>
                              {n.title}
                            </div>
                            <p className="text-[11.5px] text-text-muted leading-snug mt-0.5 line-clamp-2">{n.message}</p>
                            <div className="text-[10px] text-text-disabled mt-1 font-medium">{timeAgo(n.created_at)}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t border-border bg-background-tertiary/40">
                <p className="text-[9.5px] text-text-disabled font-bold uppercase tracking-widest text-center">
                  ย้อนหลัง 20 รายการล่าสุด
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
