'use client'

import { useState } from 'react'
import { X, Download, QrCode as QrIcon, User, ShieldCheck } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { generatePromptPayPayload } from '@/lib/promptpay'
import { cn } from '@/lib/utils'

interface QrModalProps {
  isOpen: boolean
  onClose: () => void
  promptPayId: string
  promptPayName: string
  title: string
  amount: number
}

export default function QrModal({ isOpen, onClose, promptPayId, promptPayName, title, amount }: QrModalProps) {
  if (!isOpen) return null

  const payload = generatePromptPayPayload(promptPayId, amount)

  const downloadQR = () => {
    const svg = document.getElementById('promptpay-qr')
    if (!svg) return
    
    const svgData = new XMLSerializer().serializeToString(svg)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    
    img.onload = () => {
      canvas.width = img.width + 40
      canvas.height = img.height + 140
      if (ctx) {
        // Background
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        
        // QR Code
        ctx.drawImage(img, 20, 20)
        
        // Text Info
        ctx.fillStyle = '#0f172a'
        ctx.font = 'bold 20px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText(promptPayName, canvas.width / 2, img.height + 60)
        
        ctx.fillStyle = '#8e8e93'
        ctx.font = '14px sans-serif'
        ctx.fillText(title, canvas.width / 2, img.height + 85)
        
        ctx.fillStyle = '#065f46'
        ctx.font = 'bold 24px sans-serif'
        ctx.fillText(`฿${amount.toLocaleString()}`, canvas.width / 2, img.height + 120)
      }
      
      const pngFile = canvas.toDataURL('image/png')
      const downloadLink = document.createElement('a')
      downloadLink.download = `QR-${title}.png`
      downloadLink.href = pngFile
      downloadLink.click()
    }
    
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-background-secondary rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand/10 flex items-center justify-center">
              <QrIcon className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h3 className="text-[16px] font-black text-text-primary uppercase tracking-tight italic">สแกนเพื่อจ่าย</h3>
              <p className="text-[11px] text-text-muted font-bold tracking-wider uppercase">{title}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-text-muted hover:text-text-primary transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 text-center bg-white">
          <div className="mb-6 flex flex-col items-center">
            <div className="bg-brand text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-4 shadow-lg shadow-brand/20">
              Prompt Pay
            </div>
            
            <div className="p-4 rounded-[2rem] border-4 border-background-muted bg-white shadow-inner">
              <QRCodeSVG 
                id="promptpay-qr"
                value={payload} 
                size={220} 
                level="H"
                includeMargin={false}
              />
            </div>
          </div>
          
          <div className="space-y-1 mb-8">
            <div className="flex items-center justify-center gap-1.5 text-text-muted mb-1">
              <User className="w-3.5 h-3.5" />
              <span className="text-[13px] font-bold text-text-secondary">{promptPayName}</span>
            </div>
            <div className="text-[36px] font-black text-brand tracking-tighter">
              ฿{amount.toLocaleString()}
            </div>
            <div className="text-[11px] text-emerald-600 font-bold uppercase tracking-widest bg-emerald-50 inline-block px-3 py-1 rounded-full border border-emerald-100 mt-1">
              ยอดเงินระบุอัตโนมัติ
            </div>
          </div>

          <button 
            onClick={downloadQR}
            className="w-full inline-flex items-center justify-center gap-2 py-4 bg-brand text-white rounded-2xl text-[14px] font-black uppercase tracking-widest hover:bg-brand-hover transition-all shadow-xl shadow-brand/20 active:scale-95"
          >
            <Download className="w-4 h-4" />
            บันทึกรูปภาพสแกน
          </button>
        </div>

        {/* Footer */}
        <div className="p-6 bg-background-tertiary/50 border-t border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-[11px] text-text-muted leading-relaxed text-left">
            ตรวจสอบชื่อ <span className="font-bold text-text-primary uppercase tracking-tight">{promptPayName}</span> ก่อนยืนยันการโอนเงินทุกครั้ง
          </p>
        </div>
      </div>
    </div>
  )
}
