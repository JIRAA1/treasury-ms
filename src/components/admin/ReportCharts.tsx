'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Percent, Info, Calendar } from 'lucide-react'

interface CycleDataItem {
  week?: number
  title?: string
  label?: string
  period_order?: number
  amount: number
  collected: number
  paidCount: number
}

interface ReportChartsProps {
  cycleData: CycleDataItem[]
  studentCount: number
}

export default function ReportCharts({ cycleData, studentCount }: ReportChartsProps) {
  const [hoveredIncomeIdx, setHoveredIncomeIdx] = useState<number | null>(null)
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null)

  if (cycleData.length === 0) return null

  // Chart Dimensions (Compact)
  const width = 400
  const height = 170
  const paddingLeft = 45
  const paddingRight = 15
  const paddingTop = 25
  const paddingBottom = 25

  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  // Coordinates helpers
  const getX = (index: number) => {
    if (cycleData.length <= 1) return paddingLeft + chartWidth / 2
    return paddingLeft + (index / (cycleData.length - 1)) * chartWidth
  }

  // 1. Income Chart Scaling
  const maxCollected = Math.max(...cycleData.map(c => c.collected), 100)
  const maxTarget = Math.max(...cycleData.map(c => studentCount * c.amount), 100)
  const maxVal = Math.max(maxCollected, maxTarget)

  const getYIncome = (value: number) => {
    return paddingTop + chartHeight - (value / maxVal) * chartHeight
  }

  // Line & Area points
  const incomeLinePoints = cycleData.map((c, i) => `${getX(i)},${getYIncome(c.collected)}`).join(' ')
  const incomeAreaPoints = cycleData.length > 0 
    ? `${getX(0)},${paddingTop + chartHeight} ` + 
      incomeLinePoints + 
      ` ${getX(cycleData.length - 1)},${paddingTop + chartHeight}`
    : ''

  const targetLinePoints = cycleData.map((c, i) => `${getX(i)},${getYIncome(studentCount * c.amount)}`).join(' ')

  const yIncomeTicks = Array.from({ length: 4 }, (_, i) => (maxVal / 3) * i)

  // 2. Completion Chart Scaling
  const getYPercent = (value: number) => {
    return paddingTop + chartHeight - (value / 100) * chartHeight
  }
  const completionRates = cycleData.map(c => {
    const rate = studentCount > 0 ? (c.paidCount / studentCount) * 100 : 0
    return Math.round(rate)
  })

  const yPercentTicks = [0, 50, 100]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* 1. Income Trend Chart Card */}
      <div className="bg-background-secondary border border-border rounded-3xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h4 className="text-[13.5px] font-bold text-text-primary flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-brand" />
                เปรียบเทียบรายรับกับยอดเป้าหมาย
              </h4>
              <p className="text-[11px] text-text-muted mt-0.5 font-medium">เส้นรายรับที่จ่ายจริงเทียบกับเป้าหมายตามงวด</p>
            </div>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 text-[10px] font-bold text-text-muted mb-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand inline-block" />
              <span>รายรับจริง (Collected)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 border-t border-dashed border-text-muted/60 inline-block" />
              <span>เป้าหมาย (Target)</span>
            </div>
          </div>
        </div>

        {/* SVG Canvas Area Chart */}
        <div className="relative w-full">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            <defs>
              <linearGradient id="incAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b59410" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#b59410" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* Gridlines */}
            {yIncomeTicks.map((val, i) => {
              const y = getYIncome(val)
              return (
                <g key={i} className="opacity-40">
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth="0.75"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={paddingLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="currentColor"
                    className="text-[8.5px] font-black text-text-muted"
                  >
                    {val >= 1000 ? `฿${Math.round(val / 1000)}k` : `฿${Math.round(val)}`}
                  </text>
                </g>
              )
            })}

            {/* Area */}
            <polygon points={incomeAreaPoints} fill="url(#incAreaGrad)" />

            {/* Target Dashed Line */}
            <polyline
              points={targetLinePoints}
              fill="none"
              stroke="currentColor"
              className="text-text-muted/50"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />

            {/* Collected Actual Line */}
            <polyline
              points={incomeLinePoints}
              fill="none"
              stroke="#b59410"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Data Points hover circles */}
            {cycleData.map((c, i) => {
              const x = getX(i)
              const y = getYIncome(c.collected)
              const isHovered = hoveredIncomeIdx === i

              return (
                <g key={i}>
                  <circle
                    cx={x}
                    cy={y}
                    r="12"
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredIncomeIdx(i)}
                    onMouseLeave={() => setHoveredIncomeIdx(null)}
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r={isHovered ? "5" : "3"}
                    fill="var(--background-secondary, #ffffff)"
                    stroke="#b59410"
                    strokeWidth={isHovered ? "3" : "1.5"}
                    className="transition-all duration-100 pointer-events-none"
                  />
                </g>
              )
            })}

            {/* X Labels */}
            {cycleData.map((c, i) => {
              const x = getX(i)
              return (
                <text
                  key={i}
                  x={x}
                  y={paddingTop + chartHeight + 14}
                  textAnchor="middle"
                  fill="currentColor"
                  className="text-[8.5px] font-bold text-text-muted"
                >
                  {c.title ? (c.title.length > 6 ? c.title.substring(0, 5) + '..' : c.title) : `งวด ${c.week}`}
                </text>
              )
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoveredIncomeIdx !== null && (
            <div
              className="absolute z-20 bg-background/95 backdrop-blur-md border border-border rounded-xl p-2.5 shadow-xl transition-all pointer-events-none text-left w-[170px] text-[10.5px] font-bold animate-in fade-in zoom-in-95 duration-100"
              style={{
                left: `${Math.min(Math.max(8, (getX(hoveredIncomeIdx) / width) * 100 - 15), 58)}%`,
                top: `${Math.max(0, (getYIncome(cycleData[hoveredIncomeIdx].collected) / height) * 100 - 38)}%`,
              }}
            >
              <div className="flex items-center gap-1.5 border-b border-border/80 pb-1 mb-1 text-text-primary">
                <Calendar className="w-3 h-3 text-brand" />
                <span>{cycleData[hoveredIncomeIdx].title || `งวดที่ ${cycleData[hoveredIncomeIdx].week}`}</span>
              </div>
              <div className="space-y-0.5 font-semibold text-text-secondary">
                <div className="flex justify-between">
                  <span>รายรับจริง:</span>
                  <span className="text-brand font-extrabold">{formatCurrency(cycleData[hoveredIncomeIdx].collected)}</span>
                </div>
                <div className="flex justify-between">
                  <span>เป้าหมายยอด:</span>
                  <span className="text-text-primary font-bold">{formatCurrency(studentCount * cycleData[hoveredIncomeIdx].amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ผู้จ่ายเงิน:</span>
                  <span className="text-text-primary font-bold">{cycleData[hoveredIncomeIdx].paidCount} / {studentCount} คน</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Completion Bar Chart Card */}
      <div className="bg-background-secondary border border-border rounded-3xl p-5 shadow-sm flex flex-col justify-between">
        <div>
          <h4 className="text-[13.5px] font-bold text-text-primary flex items-center gap-1.5 mb-0.5">
            <Percent className="w-4 h-4 text-emerald-600" />
            อัตราความคืบหน้าการชำระเงิน (%)
          </h4>
          <p className="text-[11px] text-text-muted font-medium mb-4">ร้อยละของนักศึกษาที่ชำระเงินเสร็จสิ้นเปรียบเทียบรายงวด</p>
        </div>

        {/* SVG Canvas Bar Chart */}
        <div className="relative w-full">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            <defs>
              <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.75" />
              </linearGradient>
            </defs>

            {/* Gridlines */}
            {yPercentTicks.map((val, i) => {
              const y = getYPercent(val)
              return (
                <g key={i} className="opacity-40">
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth="0.75"
                    strokeDasharray="3 3"
                  />
                  <text
                    x={paddingLeft - 6}
                    y={y + 3}
                    textAnchor="end"
                    fill="currentColor"
                    className="text-[8.5px] font-black text-text-muted"
                  >
                    {val}%
                  </text>
                </g>
              )
            })}

            {/* Bars */}
            {cycleData.map((c, i) => {
              const xCenter = getX(i)
              const barWidth = Math.min(26, (chartWidth / cycleData.length) * 0.45)
              const x = xCenter - barWidth / 2
              const rate = completionRates[i]
              const y = getYPercent(rate)
              const barHeight = Math.max(2, paddingTop + chartHeight - y)
              const isHovered = hoveredBarIdx === i

              return (
                <g key={i}>
                  {/* Invisible Hover Rect */}
                  <rect
                    x={xCenter - (chartWidth / cycleData.length) / 2}
                    y={paddingTop}
                    width={chartWidth / cycleData.length}
                    height={chartHeight}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredBarIdx(i)}
                    onMouseLeave={() => setHoveredBarIdx(null)}
                  />
                  {/* Actual Bar */}
                  <rect
                    x={x}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    rx="4"
                    ry="4"
                    fill="url(#barGrad)"
                    className="transition-all duration-150 pointer-events-none"
                    style={{
                      transformOrigin: `${xCenter}px ${paddingTop + chartHeight}px`,
                      transform: isHovered ? 'scaleX(1.08)' : 'none',
                    }}
                  />
                  {/* Inline Percentage above bar */}
                  <text
                    x={xCenter}
                    y={y - 5}
                    textAnchor="middle"
                    fill="currentColor"
                    className={`text-[8.5px] font-black transition-all ${isHovered ? 'text-emerald-600 scale-105' : 'text-text-secondary'}`}
                  >
                    {rate}%
                  </text>
                  {/* Paid Ratio Label inside/below bar */}
                  <text
                    x={xCenter}
                    y={paddingTop + chartHeight - 4}
                    textAnchor="middle"
                    fill="#ffffff"
                    className="text-[8px] font-black tracking-tighter opacity-90 pointer-events-none select-none"
                    style={{ display: barHeight > 15 ? 'block' : 'none' }}
                  >
                    {c.paidCount}
                  </text>
                </g>
              )
            })}

            {/* X Labels */}
            {cycleData.map((c, i) => {
              const x = getX(i)
              return (
                <text
                  key={i}
                  x={x}
                  y={paddingTop + chartHeight + 14}
                  textAnchor="middle"
                  fill="currentColor"
                  className="text-[8.5px] font-bold text-text-muted"
                >
                  {c.title ? (c.title.length > 6 ? c.title.substring(0, 5) + '..' : c.title) : `งวด ${c.week}`}
                </text>
              )
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoveredBarIdx !== null && (
            <div
              className="absolute z-20 bg-background/95 backdrop-blur-md border border-border rounded-xl p-2.5 shadow-xl transition-all pointer-events-none text-left w-[170px] text-[10.5px] font-bold animate-in fade-in zoom-in-95 duration-100"
              style={{
                left: `${Math.min(Math.max(8, (getX(hoveredBarIdx) / width) * 100 - 15), 58)}%`,
                top: `${Math.max(0, (getYPercent(completionRates[hoveredBarIdx]) / height) * 100 - 38)}%`,
              }}
            >
              <div className="flex items-center gap-1.5 border-b border-border/80 pb-1 mb-1 text-text-primary">
                <Info className="w-3.5 h-3.5 text-emerald-600" />
                <span>{cycleData[hoveredBarIdx].title || `งวดที่ ${cycleData[hoveredBarIdx].week}`}</span>
              </div>
              <div className="space-y-0.5 font-semibold text-text-secondary">
                <div className="flex justify-between">
                  <span>ผู้จ่ายเงินแล้ว:</span>
                  <span className="text-emerald-600 font-extrabold">{cycleData[hoveredBarIdx].paidCount} คน</span>
                </div>
                <div className="flex justify-between">
                  <span>ยังไม่ได้ชำระ:</span>
                  <span className="text-red-500 font-bold">{studentCount - cycleData[hoveredBarIdx].paidCount} คน</span>
                </div>
                <div className="flex justify-between">
                  <span>อัตราความสำเร็จ:</span>
                  <span className="text-emerald-600 font-bold">{completionRates[hoveredBarIdx]}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
