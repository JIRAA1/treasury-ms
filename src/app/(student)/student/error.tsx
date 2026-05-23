'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function StudentError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[StudentError]', error)
  }, [error])

  return (
    <div className="flex items-center justify-center h-full min-h-[400px] p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-text-primary mb-1">โหลดข้อมูลไม่สำเร็จ</h2>
          <p className="text-[12.5px] text-text-muted">
            {error.message || 'กรุณาลองรีเฟรชหน้าเว็บ หรือติดต่อเหรัญญิก'}
          </p>
        </div>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 bg-brand text-white text-[12.5px] font-medium px-4 py-2 rounded-lg hover:bg-brand-hover transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          ลองใหม่
        </button>
      </div>
    </div>
  )
}
