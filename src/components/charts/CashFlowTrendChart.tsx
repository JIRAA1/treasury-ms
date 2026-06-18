'use client'

import { useState } from 'react'

interface MonthPoint {
  month: string  // e.g. "ม.ค. 68"
  income: number
  expense: number
  balance: number
}

interface Props {
  data: MonthPoint[]
}

const W = 560
const H = 180
const PAD_L = 52
const PAD_R = 16
const PAD_T = 16
const PAD_B = 36

function formatAmt(n: number) {
  if (n >= 1000) return `฿${(n / 1000).toFixed(1)}K`
  return `฿${n}`
}

function scaledY(value: number, min: number, max: number): number {
  if (max === min) return PAD_T + (H - PAD_T - PAD_B) / 2
  return PAD_T + ((max - value) / (max - min)) * (H - PAD_T - PAD_B)
}

function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx = (prev.x + curr.x) / 2
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`
  }
  return d
}

export default function CashFlowTrendChart({ data }: Props) {
  const [tooltip, setTooltip] = useState<{ idx: number; x: number; y: number } | null>(null)

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-text-muted text-[12px] italic">
        ยังไม่มีข้อมูลกระแสเงินสด
      </div>
    )
  }

  const allValues = data.flatMap(d => [d.income, d.expense, d.balance])
  const rawMin = Math.min(...allValues, 0)
  const rawMax = Math.max(...allValues, 1)
  const padding = (rawMax - rawMin) * 0.15
  const yMin = rawMin - padding
  const yMax = rawMax + padding

  const chartW = W - PAD_L - PAD_R
  const step = data.length > 1 ? chartW / (data.length - 1) : chartW

  const pts = (key: keyof MonthPoint) =>
    data.map((d, i) => ({ x: PAD_L + i * step, y: scaledY(d[key] as number, yMin, yMax) }))

  const incomePts = pts('income')
  const expensePts = pts('expense')
  const balancePts = pts('balance')

  // Y-axis gridlines (4 lines)
  const gridValues = [0, 0.33, 0.67, 1].map(t => yMin + t * (yMax - yMin))

  const hovered = tooltip ? data[tooltip.idx] : null

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', maxWidth: W, minWidth: 280, height: 'auto' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {gridValues.map((v, i) => {
          const y = scaledY(v, yMin, yMax)
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e2e8f0" strokeWidth={1} strokeDasharray="4 3" />
              <text x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#94a3b8">{formatAmt(v)}</text>
            </g>
          )
        })}

        {/* Zero line if crosses zero */}
        {yMin < 0 && yMax > 0 && (
          <line x1={PAD_L} y1={scaledY(0, yMin, yMax)} x2={W - PAD_R} y2={scaledY(0, yMin, yMax)} stroke="#cbd5e1" strokeWidth={1.5} />
        )}

        {/* Income area fill */}
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area fills */}
        <path
          d={`${smoothPath(incomePts)} L ${incomePts[incomePts.length - 1].x} ${H - PAD_B} L ${PAD_L} ${H - PAD_B} Z`}
          fill="url(#incomeGrad)"
        />
        <path
          d={`${smoothPath(expensePts)} L ${expensePts[expensePts.length - 1].x} ${H - PAD_B} L ${PAD_L} ${H - PAD_B} Z`}
          fill="url(#expenseGrad)"
        />

        {/* Lines */}
        <path d={smoothPath(incomePts)} fill="none" stroke="#10b981" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={smoothPath(expensePts)} fill="none" stroke="#f43f5e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <path d={smoothPath(balancePts)} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" strokeLinecap="round" />

        {/* Interaction zones + dot markers */}
        {data.map((d, i) => {
          const ix = incomePts[i].x
          const iy = incomePts[i].y
          const ex = expensePts[i].x
          const ey = expensePts[i].y
          const bx = balancePts[i].x
          const by = balancePts[i].y
          const isHov = tooltip?.idx === i
          return (
            <g key={i}>
              {/* Hover detection area */}
              <rect
                x={ix - step / 2} y={PAD_T} width={step} height={H - PAD_T - PAD_B}
                fill="transparent"
                onMouseEnter={() => setTooltip({ idx: i, x: ix, y: 0 })}
              />
              {/* Dots */}
              <circle cx={ix} cy={iy} r={isHov ? 4 : 2.5} fill="#10b981" stroke="white" strokeWidth={1.5} style={{ transition: 'r 0.15s' }} />
              <circle cx={ex} cy={ey} r={isHov ? 4 : 2.5} fill="#f43f5e" stroke="white" strokeWidth={1.5} style={{ transition: 'r 0.15s' }} />
              <circle cx={bx} cy={by} r={isHov ? 3.5 : 2} fill="#6366f1" stroke="white" strokeWidth={1} style={{ transition: 'r 0.15s' }} />
              {/* Vertical hover line */}
              {isHov && (
                <line x1={ix} y1={PAD_T} x2={ix} y2={H - PAD_B} stroke="#cbd5e1" strokeWidth={1} strokeDasharray="3 2" />
              )}
              {/* X-axis label */}
              <text x={ix} y={H - 4} textAnchor="middle" fontSize={9} fill="#94a3b8">{d.month}</text>
            </g>
          )
        })}

        {/* Tooltip */}
        {hovered && tooltip && (() => {
          const tx = Math.min(tooltip.x, W - 110)
          const tooltipX = tx < PAD_L + 40 ? tx : tx - 100
          return (
            <g>
              <rect x={tooltipX} y={PAD_T + 4} width={104} height={68} rx={6} fill="#1e293b" opacity={0.92} />
              <text x={tooltipX + 52} y={PAD_T + 18} textAnchor="middle" fontSize={9} fill="#94a3b8" fontWeight="600">
                {hovered.month}
              </text>
              <text x={tooltipX + 8} y={PAD_T + 32} fontSize={9} fill="#10b981">● รายรับ</text>
              <text x={tooltipX + 96} y={PAD_T + 32} textAnchor="end" fontSize={9} fill="#10b981" fontWeight="700">
                {formatAmt(hovered.income)}
              </text>
              <text x={tooltipX + 8} y={PAD_T + 46} fontSize={9} fill="#f43f5e">● รายจ่าย</text>
              <text x={tooltipX + 96} y={PAD_T + 46} textAnchor="end" fontSize={9} fill="#f43f5e" fontWeight="700">
                {formatAmt(hovered.expense)}
              </text>
              <text x={tooltipX + 8} y={PAD_T + 60} fontSize={9} fill="#a5b4fc">◆ คงเหลือ</text>
              <text x={tooltipX + 96} y={PAD_T + 60} textAnchor="end" fontSize={9} fill="#a5b4fc" fontWeight="700">
                {formatAmt(hovered.balance)}
              </text>
            </g>
          )
        })()}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-2 px-1">
        {[
          { color: '#10b981', label: 'รายรับ', dash: false },
          { color: '#f43f5e', label: 'รายจ่าย', dash: false },
          { color: '#6366f1', label: 'คงเหลือ', dash: true },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className="w-5 h-[2px]" style={{ background: l.dash ? `repeating-linear-gradient(to right, ${l.color} 0, ${l.color} 4px, transparent 4px, transparent 7px)` : l.color }} />
            <span className="text-[10px] text-text-muted font-medium">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
