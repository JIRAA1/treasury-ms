'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Bell, Check, Trash2, Loader2, X } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { toast } from 'sonner'

export default function InAppNotifications() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    fetchNotifications()
    
    // Subscribe to new notifications
    const channel = supabase
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => {
        fetchNotifications()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase])

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    setNotifications(data || [])
    setLoading(false)
  }

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false)
    setNotifications(notifications.map(n => ({ ...n, is_read: true })))
  }

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-text-muted hover:text-text-primary hover:bg-background-tertiary rounded-xl transition-all active:scale-95"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black flex items-center justify-center rounded-full border-2 border-background-secondary shadow-sm">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-3 w-80 bg-background-secondary border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right">
            <div className="p-4 border-b border-border flex items-center justify-between bg-background-tertiary/20">
              <h4 className="text-[13px] font-bold text-text-primary uppercase tracking-tight italic">แจ้งเตือน</h4>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-[10px] font-bold text-brand hover:underline uppercase tracking-wider">อ่านทั้งหมด</button>
              )}
            </div>

            <div className="max-h-[350px] overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-brand" /></div>
              ) : notifications.length === 0 ? (
                <div className="p-12 text-center text-text-muted italic text-[12px]">ไม่มีการแจ้งเตือนในขณะนี้</div>
              ) : (
                <div className="divide-y divide-border">
                  {notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={cn(
                        "p-4 transition-colors hover:bg-background-tertiary/50 relative group",
                        !n.is_read && "bg-brand/[0.02]"
                      )}
                      onClick={() => markAsRead(n.id)}
                    >
                      {!n.is_read && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand" />}
                      <div className="flex justify-between items-start mb-1">
                        <span className={cn("text-[13px] font-bold", !n.is_read ? "text-text-primary" : "text-text-secondary")}>
                          {n.title}
                        </span>
                        <span className="text-[9.5px] text-text-disabled font-medium uppercase">{formatDate(new Date(n.created_at))}</span>
                      </div>
                      <p className="text-[12px] text-text-muted leading-relaxed">{n.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-3 bg-background-tertiary/50 border-t border-border text-center">
              <p className="text-[10px] text-text-disabled font-bold uppercase tracking-widest">ข้อมูลย้อนหลัง 20 รายการล่าสุด</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
