'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AdminError]', error)
  }, [error])

  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center space-y-4 max-w-sm">
        <div className="w-14 h-14 bg-red-50 border border-red-100 rounded-2xl flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>
        <div>
          <h2 className="text-[15px] font-bold text-text-primary mb-1">เกิดข้อผิดพลาด</h2>
          <p className="text-[12.5px] text-text-muted">
            {error.message || 'ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง'}
          </p>
          {error.digest && (
            <p className="text-[10px] text-text-disabled font-mono mt-1">Ref: {error.digest}</p>
          )}
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
