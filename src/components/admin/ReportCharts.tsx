'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Percent, Info } from 'lucide-react'

interface CycleDataItem {
  week: number
  title: string
  amount: number
  collected: number
  paidCount: number
}

interface ReportChartsProps {
  cycleData: CycleDataItem[]
  studentCount: number
}

export default function ReportCharts({ cycleData, studentCount }: ReportChartsProps) {
  const [activeTab, setActiveTab] = useState<'income' | 'completion'>('income')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  if (cycleData.length === 0) return null

  // Parameters for charts rendering
  const width = 600
  const height = 240
  const paddingLeft = 60
  const paddingRight = 30
  const paddingTop = 20
  const paddingBottom = 40

  const chartWidth = width - paddingLeft - paddingRight
  const chartHeight = height - paddingTop - paddingBottom

  // Data processing for Income Chart (Area Chart)
  const maxCollected = Math.max(...cycleData.map(c => c.collected), 100)
  
  // Data processing for Completion Chart (Bar Chart)
  const completionRates = cycleData.map(c => {
    const rate = studentCount > 0 ? (c.paidCount / studentCount) * 100 : 0
    return Math.round(rate)
  })

  // Helper to get X coordinate for index
  const getX = (index: number) => {
    if (cycleData.length <= 1) return paddingLeft + chartWidth / 2
    return paddingLeft + (index / (cycleData.length - 1)) * chartWidth
  }

  // Helper to get Y coordinate for value
  const getY = (value: number) => {
    return paddingTop + chartHeight - (value / maxCollected) * chartHeight
  }

  // Helper to get Y coordinate for percentage (0 - 100)
  const getYPercent = (value: number) => {
    return paddingTop + chartHeight - (value / 100) * chartHeight
  }

  // Draw Line and Area path for Income Chart
  const linePoints = cycleData.map((c, i) => `${getX(i)},${getY(c.collected)}`).join(' ')
  const areaPoints = cycleData.length > 0 
    ? `${getX(0)},${paddingTop + chartHeight} ` + 
      linePoints + 
      ` ${getX(cycleData.length - 1)},${paddingTop + chartHeight}`
    : ''

  // Generate grid values for collected amounts
  const yTicks = 4
  const gridTicks = Array.from({ length: yTicks + 1 }, (_, i) => (maxCollected / yTicks) * i)

  // Generate grid values for percentage
  const gridPercentTicks = [0, 25, 50, 75, 100]

  return (
    <div className="bg-background-secondary border border-border rounded-[2rem] p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-[16px] font-bold text-text-primary tracking-tight">แผนภูมิวิเคราะห์สถิติ</h3>
          <p className="text-[12px] text-text-muted mt-0.5 font-medium">ข้อมูลแนวโน้มและอัตราการชำระเงินในแต่ละงวด</p>
        </div>
        
        {/* Tab Buttons */}
        <div className="flex bg-background border border-border rounded-xl p-1 shadow-inner self-start sm:self-center">
          <button
            onClick={() => { setActiveTab('income'); setHoveredIndex(null) }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11.5px] font-black uppercase tracking-tight transition-all cursor-pointer ${
              activeTab === 'income'
                ? 'bg-brand text-white shadow-md'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            แนวโน้มรายรับ
          </button>
          <button
            onClick={() => { setActiveTab('completion'); setHoveredIndex(null) }}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[11.5px] font-black uppercase tracking-tight transition-all cursor-pointer ${
              activeTab === 'completion'
                ? 'bg-brand text-white shadow-md'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Percent className="w-3.5 h-3.5" />
            อัตราการจ่ายเงิน
          </button>
        </div>
      </div>

      <div className="relative w-full">
        {/* SVG Canvas wrapper with responsive viewBox */}
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
          {/* Gradients definition */}
          <defs>
            {/* Area gradient for Income */}
            <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b59410" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#b59410" stopOpacity="0.0" />
            </linearGradient>
            {/* Bar gradient for Completion */}
            <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#b59410" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#b59410" stopOpacity="0.5" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {activeTab === 'income' ? (
            gridTicks.map((val, i) => {
              const y = getY(val)
              return (
                <g key={i} className="opacity-40">
                  <line
                    x1={paddingLeft}
                    y1={y}
                    x2={width - paddingRight}
                    y2={y}
                    stroke="currentColor"
                    className="text-border"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="currentColor"
                    className="text-[9px] font-bold text-text-muted"
                  >
                    {val >= 1000 ? `฿${Math.round(val / 1000)}k` : `฿${val}`}
                  </text>
                </g>
              )
            })
          ) : (
            gridPercentTicks.map((val, i) => {
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
                    strokeWidth="1"
                    strokeDasharray="4 4"
                  />
                  <text
                    x={paddingLeft - 8}
                    y={y + 4}
                    textAnchor="end"
                    fill="currentColor"
                    className="text-[9px] font-bold text-text-muted"
                  >
                    {val}%
                  </text>
                </g>
              )
            })
          )}

          {/* Render Area/Line Chart for Income */}
          {activeTab === 'income' && (
            <>
              {/* Filled Area */}
              <polygon
                points={areaPoints}
                fill="url(#incomeGradient)"
                className="transition-all duration-300"
              />

              {/* Line */}
              <polyline
                points={linePoints}
                fill="none"
                stroke="#b59410"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-300"
              />

              {/* Data points */}
              {cycleData.map((c, i) => {
                const x = getX(i)
                const y = getY(c.collected)
                const isHovered = hoveredIndex === i

                return (
                  <g key={i}>
                    {/* Invisible larger hover circle */}
                    <circle
                      cx={x}
                      cy={y}
                      r="16"
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                    />
                    {/* Visible circle */}
                    <circle
                      cx={x}
                      cy={y}
                      r={isHovered ? "7" : "4.5"}
                      fill="var(--background-secondary, #ffffff)"
                      stroke="#b59410"
                      strokeWidth={isHovered ? "3.5" : "2"}
                      className="transition-all duration-150 pointer-events-none"
                    />
                  </g>
                )
              })}
            </>
          )}

          {/* Render Bar Chart for Completion */}
          {activeTab === 'completion' && (
            <g>
              {cycleData.map((c, i) => {
                const xCenter = getX(i)
                // Determine bar width based on number of items
                const barWidth = Math.min(32, (chartWidth / cycleData.length) * 0.5)
                const x = xCenter - barWidth / 2
                const rate = completionRates[i]
                const y = getYPercent(rate)
                const barHeight = Math.max(2, paddingTop + chartHeight - y)
                const isHovered = hoveredIndex === i

                return (
                  <g key={i}>
                    {/* Bar rectangle with rounded corners */}
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      rx="6"
                      ry="6"
                      fill="url(#barGradient)"
                      className="transition-all duration-200 cursor-pointer hover:opacity-95"
                      onMouseEnter={() => setHoveredIndex(i)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      style={{
                        transformOrigin: `${xCenter}px ${paddingTop + chartHeight}px`,
                        transform: isHovered ? 'scaleX(1.05)' : 'none',
                      }}
                    />
                    {/* Top percentage text if hovered */}
                    {isHovered && (
                      <text
                        x={xCenter}
                        y={y - 6}
                        textAnchor="middle"
                        fill="#b59410"
                        className="text-[10px] font-black"
                      >
                        {rate}%
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          )}

          {/* X Axis labels */}
          {cycleData.map((c, i) => {
            const x = getX(i)
            return (
              <text
                key={i}
                x={x}
                y={paddingTop + chartHeight + 18}
                textAnchor="middle"
                fill="currentColor"
                className="text-[9px] sm:text-[10px] font-bold text-text-muted"
              >
                {c.title ? (c.title.length > 7 ? c.title.substring(0, 7) + '..' : c.title) : `งวด ${c.week}`}
              </text>
            )
          })}
        </svg>

        {/* Floating HTML Tooltip inside parent */}
        {hoveredIndex !== null && (
          <div
            className="absolute z-20 bg-background/95 backdrop-blur-md border border-border rounded-xl p-3 shadow-xl transition-all duration-100 pointer-events-none text-left w-[180px] text-[11.5px] font-bold animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${Math.min(
                Math.max(10, (getX(hoveredIndex) / width) * 100 - 15),
                80
              )}%`,
              top: `${Math.max(
                0,
                (getY(cycleData[hoveredIndex].collected) / height) * 100 - 35
              )}%`,
            }}
          >
            <div className="flex items-center gap-1.5 border-b border-border/80 pb-1.5 mb-1.5">
              <Info className="w-3.5 h-3.5 text-brand" />
              <span className="text-text-primary">{cycleData[hoveredIndex].title || `งวดที่ ${cycleData[hoveredIndex].week}`}</span>
            </div>
            <div className="space-y-1 font-semibold text-text-secondary">
              <div className="flex justify-between">
                <span>ยอดเงินชำระ:</span>
                <span className="text-brand font-bold">{formatCurrency(cycleData[hoveredIndex].collected)}</span>
              </div>
              <div className="flex justify-between">
                <span>จำนวนผู้จ่าย:</span>
                <span className="text-text-primary font-bold">{cycleData[hoveredIndex].paidCount} / {studentCount} คน</span>
              </div>
              <div className="flex justify-between">
                <span>อัตราการจ่าย:</span>
                <span className="text-emerald-600 font-bold">{completionRates[hoveredIndex]}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
