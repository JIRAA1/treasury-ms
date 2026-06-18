'use client'

import { useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { Printer, CheckCircle, ArrowLeft, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

interface ReceiptData {
  receiptId: string
  issueDate: string
  payer: { fullname: string; student_id: string; tier: string }
  period: { label: string; deadline: string | null }
  payment: {
    id: string
    trans_ref: string | null
    baseAmount: number
    fineAmount: number
    totalPaid: number
  }
  approver: { fullname: string; student_id: string } | null
  orgName: string
}

interface Props {
  data: ReceiptData
}

function formatThaiDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCurrency(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function ReceiptPrintClient({ data }: Props) {
  const receiptRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => window.print()

  const verifyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/student/history/receipt/${data.payment.id}`
    : `/student/history/receipt/${data.payment.id}`

  return (
    <>
      {/* ======= Print styles (inlined for no external CSS dependency) ======= */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;500;600;700;800&display=swap');

        @media print {
          body * { visibility: hidden !important; }
          #receipt-document, #receipt-document * { visibility: visible !important; }
          #receipt-document { position: fixed !important; left: 0 !important; top: 0 !important; width: 100% !important; }
          .no-print { display: none !important; }
          @page { size: A5 portrait; margin: 10mm; }
        }

        .receipt-font { font-family: 'Sarabun', 'Noto Sans Thai', sans-serif; }
      `}</style>

      {/* ======= Toolbar (hidden when printing) ======= */}
      <div className="no-print min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 p-4 sm:p-8">
        {/* Top navigation */}
        <div className="max-w-2xl mx-auto mb-6 flex items-center justify-between">
          <Link
            href="/student/history"
            className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-semibold text-sm transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            กลับประวัติ
          </Link>
          <button
            onClick={handlePrint}
            id="btn-print-receipt"
            className="flex items-center gap-2 bg-brand text-white font-bold px-5 py-2.5 rounded-xl shadow-lg hover:opacity-90 transition-opacity active:scale-95 text-sm"
          >
            <Printer className="w-4 h-4" />
            พิมพ์ / บันทึก PDF
          </button>
        </div>

        {/* Receipt card preview */}
        <div className="max-w-2xl mx-auto">
          <ReceiptDocument data={data} verifyUrl={verifyUrl} />
        </div>

        <p className="text-center text-slate-400 text-xs mt-6 no-print">
          กด &quot;พิมพ์ / บันทึก PDF&quot; แล้วเลือก &quot;Save as PDF&quot; เพื่อบันทึกใบเสร็จลงอุปกรณ์ของคุณ
        </p>
      </div>

      {/* ======= Print target — this is what gets printed ======= */}
      <div id="receipt-document">
        <ReceiptDocument data={data} verifyUrl={verifyUrl} forPrint />
      </div>
    </>
  )
}

function ReceiptDocument({ data, verifyUrl, forPrint = false }: { data: ReceiptData; verifyUrl: string; forPrint?: boolean }) {
  const tierColors: Record<string, string> = {
    A: '#059669',
    B: '#475569',
    C: '#d97706',
  }
  const tierColor = tierColors[data.payer.tier] ?? '#475569'

  return (
    <div
      ref={undefined}
      className="receipt-font bg-white shadow-2xl rounded-2xl overflow-hidden"
      style={{ maxWidth: '540px', margin: '0 auto', border: '1px solid #e2e8f0' }}
    >
      {/* ── Header ── */}
      <div
        className="px-8 pt-8 pb-6"
        style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', color: 'white' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '10px', letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)', marginBottom: '4px' }}>
              ใบเสร็จรับเงิน
            </div>
            <div style={{ fontSize: '22px', fontWeight: '800', lineHeight: 1.1 }}>
              {data.orgName}
            </div>
            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle style={{ width: '14px', height: '14px', color: '#34d399' }} />
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', fontWeight: '600' }}>
                ชำระเงินสำเร็จและได้รับการยืนยันแล้ว
              </span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginBottom: '2px' }}>เลขที่ใบเสร็จ</div>
            <div style={{ fontSize: '13px', fontWeight: '800', letterSpacing: '0.05em', color: '#facc15' }}>
              {data.receiptId}
            </div>
          </div>
        </div>

        {/* Decorative line */}
        <div style={{ height: '1px', background: 'linear-gradient(to right, rgba(255,255,255,0.1), rgba(255,255,255,0.3), rgba(255,255,255,0.1))', marginTop: '20px' }} />
      </div>

      {/* ── Body ── */}
      <div style={{ padding: '28px 32px' }}>
        {/* Issue date */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '12px' }}>
          <span style={{ color: '#94a3b8' }}>วันที่ออกใบเสร็จ</span>
          <span style={{ fontWeight: '600', color: '#1e293b' }}>{formatThaiDate(data.issueDate)}</span>
        </div>

        {/* Payer info */}
        <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px 20px', marginBottom: '20px', border: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>
            ข้อมูลผู้ชำระเงิน
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a' }}>{data.payer.fullname}</div>
              <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>รหัสนักศึกษา: {data.payer.student_id}</div>
            </div>
            <div
              style={{
                padding: '4px 12px',
                borderRadius: '999px',
                fontSize: '11px',
                fontWeight: '700',
                background: `${tierColor}18`,
                color: tierColor,
                border: `1px solid ${tierColor}30`,
              }}
            >
              Tier {data.payer.tier}
            </div>
          </div>
        </div>

        {/* Payment details table */}
        <div style={{ marginBottom: '20px' }}>
          <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '10px' }}>
            รายละเอียดการชำระเงิน
          </div>

          {/* Period */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px dashed #e2e8f0', fontSize: '13px' }}>
            <span style={{ color: '#475569' }}>รายการ</span>
            <span style={{ fontWeight: '600', color: '#1e293b' }}>{data.period.label}</span>
          </div>

          {/* Base */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px dashed #e2e8f0', fontSize: '13px' }}>
            <span style={{ color: '#475569' }}>ค่าธรรมเนียมพื้นฐาน</span>
            <span style={{ fontWeight: '600', color: '#1e293b' }}>฿{formatCurrency(data.payment.baseAmount)}</span>
          </div>

          {/* Fine (only show if > 0) */}
          {data.payment.fineAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px dashed #e2e8f0', fontSize: '13px' }}>
              <span style={{ color: '#ef4444' }}>ค่าปรับล่าช้า</span>
              <span style={{ fontWeight: '600', color: '#ef4444' }}>+฿{formatCurrency(data.payment.fineAmount)}</span>
            </div>
          )}

          {/* Transaction ref */}
          {data.payment.trans_ref && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px dashed #e2e8f0', fontSize: '12px' }}>
              <span style={{ color: '#94a3b8' }}>เลขที่อ้างอิง</span>
              <span style={{ fontFamily: 'monospace', color: '#64748b', fontSize: '11px' }}>{data.payment.trans_ref}</span>
            </div>
          )}

          {/* Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', marginTop: '10px', borderRadius: '10px', background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)', border: '1px solid #bbf7d0' }}>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#15803d' }}>ยอดชำระรวม</span>
            <span style={{ fontSize: '20px', fontWeight: '800', color: '#15803d' }}>฿{formatCurrency(data.payment.totalPaid)}</span>
          </div>
        </div>

        {/* Approver signature area */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid #f1f5f9' }}>
          {/* QR verification */}
          <div style={{ textAlign: 'center' }}>
            <QRCodeSVG
              value={verifyUrl}
              size={72}
              bgColor="#ffffff"
              fgColor="#1e293b"
              level="M"
            />
            <div style={{ fontSize: '9px', color: '#94a3b8', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '2px', justifyContent: 'center' }}>
              <ShieldCheck style={{ width: '9px', height: '9px' }} /> ตรวจสอบ
            </div>
          </div>

          {/* Signature */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ width: '140px', borderBottom: '1.5px solid #cbd5e1', marginBottom: '6px', height: '32px' }} />
            <div style={{ fontSize: '12px', fontWeight: '700', color: '#1e293b' }}>
              {data.approver?.fullname ?? 'เหรัญญิกสาขา'}
            </div>
            {data.approver?.student_id && (
              <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '1px' }}>
                รหัส {data.approver.student_id}
              </div>
            )}
            <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>ผู้ตรวจสอบและอนุมัติ</div>
          </div>
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ background: '#f8fafc', borderTop: '1px solid #e2e8f0', padding: '12px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '10px', color: '#94a3b8' }}>
          เอกสารนี้ออกโดยระบบ TreasuryMS อัตโนมัติ · ใบเสร็จฉบับนี้ถือเป็นหลักฐานการชำระเงินที่ถูกต้องตามกฎหมาย
        </div>
      </div>
    </div>
  )
}
