'use client'

import { CheckCircle2, AlertCircle, Info, XCircle, Loader2 } from 'lucide-react'
import { create } from 'zustand'
import { cn } from '@/lib/utils'

type DialogType = 'success' | 'error' | 'warning' | 'confirm' | 'info'

interface DialogState {
  isOpen: boolean
  type: DialogType
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm?: () => void
  onCancel?: () => void
  loading?: boolean
  show: (options: {
    type: DialogType
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm?: () => void
    onCancel?: () => void
  }) => void
  hide: () => void
  setLoading: (loading: boolean) => void
}

export const useDialog = create<DialogState>((set) => ({
  isOpen: false,
  type: 'info',
  title: '',
  message: '',
  confirmText: undefined,
  cancelText: undefined,
  loading: false,
  show: (options) => set({ ...options, isOpen: true, loading: false }),
  hide: () => set({ isOpen: false }),
  setLoading: (loading) => set({ loading }),
}))

export function GlobalDialog() {
  const { isOpen, type, title, message, confirmText, cancelText, onConfirm, onCancel, hide, loading } = useDialog()

  if (!isOpen) return null

  const icons = {
    success: <CheckCircle2 className="w-12 h-12 text-emerald-500" />,
    error: <XCircle className="w-12 h-12 text-red-500" />,
    warning: <AlertCircle className="w-12 h-12 text-amber-500" />,
    confirm: <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center"><Info className="w-6 h-6 text-brand" /></div>,
    info: <Info className="w-12 h-12 text-blue-500" />,
  }

  const defaultConfirmText = type === 'confirm' ? 'ยืนยันรายการ' : 'ตกลง'
  const defaultCancelText = 'ยกเลิก'

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-background-secondary w-full max-w-sm rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10 p-8 text-center">
        <div className="flex justify-center mb-6">
          {loading ? <Loader2 className="w-12 h-12 text-brand animate-spin" /> : icons[type]}
        </div>
        
        <h3 className="text-[20px] font-black text-text-primary tracking-tight italic uppercase mb-2 leading-tight">
          {title}
        </h3>
        <p className="text-[14px] text-text-muted leading-relaxed mb-8">
          {message}
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              if (onConfirm) onConfirm()
              else hide()
            }}
            disabled={loading}
            className={cn(
              "w-full py-3.5 rounded-2xl text-[14px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 cursor-pointer",
              type === 'error' || type === 'warning'
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-brand text-white shadow-lg shadow-brand/20 hover:bg-brand-hover"
            )}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                กำลังดำเนินการ...
              </span>
            ) : (
              confirmText ?? defaultConfirmText
            )}
          </button>
          
          {(type === 'confirm' || type === 'warning' || onCancel) && (
            <button
              onClick={() => {
                if (onCancel) onCancel()
                hide()
              }}
              disabled={loading}
              className="w-full py-3 text-[13px] font-bold text-text-muted hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
            >
              {cancelText ?? defaultCancelText}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
