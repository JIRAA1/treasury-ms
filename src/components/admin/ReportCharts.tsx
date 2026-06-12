'use client'

import { useState, useRef, useEffect } from 'react'
import { formatCurrency } from '@/lib/utils'
import { TrendingUp, Percent, Info, Calendar, AlertTriangle } from 'lucide-react'

interface CycleDataItem {
  week?: number
  title?: string
  label?: string
  period_order?: number
  amount: number
  collected: number
  paidCount: number
  pendingCount?: number
  rate?: number
}

interface ReportChartsProps {
  cycleData: CycleDataItem[]
  studentCount: number
  /** จำนวนนักศึกษาแยกตาม Tier — ถ้าส่งมาจะใช้คำนวณเส้นเป้าหมายที่แม่นยำขึ้น */
  tierBreakdown?: { A: number; B: number; C: number }
  /** จำนวนเงินต่องวดของแต่ละ Tier (บาท) */
  tierAmounts?: { A: number; B: number; C: number }
}

/** Smart number formatter for Y-axis ticks */
function fmtTick(v: number): string {
  if (v === 0) return '฿0'
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `฿${Math.round(v / 1_000)}k`
  return `฿${Math.round(v)}`
}

/** Shorten long labels for X-axis */
function shortLabel(item: CycleDataItem): string {
  const raw = item.label || item.title || `งวด ${item.period_order ?? item.week ?? '?'}`
  // Try to extract a short form — e.g. "งวดที่ 1" → "งวด 1"
  const numMatch = raw.match(/(\d+)/)
  if (numMatch) return `งวด\n${numMatch[1]}`
  if (raw.length <= 6) return raw
  return raw.substring(0, 5) + '…'
}

/** Round up to a "nice" number for chart scale */
function niceMax(val: number): number {
  if (val <= 0) return 100
  const magnitude = Math.pow(10, Math.floor(Math.log10(val)))
  return Math.ceil(val / magnitude) * magnitude
}

export default function ReportCharts({ cycleData, studentCount, tierBreakdown, tierAmounts }: ReportChartsProps) {
  const [hoveredIncomeIdx, setHoveredIncomeIdx] = useState<number | null>(null)
  const [hoveredBarIdx, setHoveredBarIdx] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  if (cycleData.length === 0) return null

  // ─── Chart Dimensions ─────────────────────────────────────────────
  const W = 460
  const H = 200
  const PL = 52   // left padding (Y-axis labels)
  const PR = 16   // right
  const PT = 20   // top
  const PB = 36   // bottom (X-axis labels)

  const CW = W - PL - PR   // chart inner width
  const CH = H - PT - PB   // chart inner height

  // ─── X positions ─────────────────────────────────────────────────
  const getX = (i: number) => {
    if (cycleData.length <= 1) return PL + CW / 2
    return PL + (i / (cycleData.length - 1)) * CW
  }

  // ─── Income Chart ─────────────────────────────────────────────────
  /**
   * คำนวณเป้าหมายต่องวด:
   * - ถ้ามี tierBreakdown + tierAmounts → ใช้ weighted sum (A×amtA + B×amtB + C×amtC)
   * - ถ้าไม่มี → fallback เป็น studentCount × period.amount (legacy)
   */
  const calcPeriodTarget = (periodBaseAmount: number): number => {
    if (tierBreakdown && tierAmounts) {
      return (
        tierBreakdown.A * tierAmounts.A +
        tierBreakdown.B * tierAmounts.B +
        tierBreakdown.C * tierAmounts.C
      )
    }
    return studentCount * periodBaseAmount
  }

  // Filter out absurd target values caused by wrong period.amount
  const validTargets = cycleData
    .map(c => calcPeriodTarget(c.amount))
    .filter(v => v > 0 && v < 10_000_000) // cap: 10M sanity check

  const maxCollected = Math.max(...cycleData.map(c => c.collected), 1)
  const maxTarget = validTargets.length > 0 ? Math.max(...validTargets) : 0
  const rawMax = Math.max(maxCollected, maxTarget)
  const maxVal = niceMax(rawMax)

  const getYIncome = (value: number) => PT + CH - Math.max(0, Math.min(1, value / maxVal)) * CH

  // Smooth polyline points
  const collectedPoints = cycleData
    .map((c, i) => `${getX(i)},${getYIncome(c.collected)}`)
    .join(' ')

  const areaPoints =
    `${getX(0)},${PT + CH} ` +
    collectedPoints +
    ` ${getX(cycleData.length - 1)},${PT + CH}`

  const targetPoints = cycleData
    .map((c, i) => {
      const t = calcPeriodTarget(c.amount)
      // If target is 0 or insane, use collected as fallback to keep line flat
      const safeT = t > 0 && t < 10_000_000 ? t : c.collected
      return `${getX(i)},${getYIncome(safeT)}`
    })
    .join(' ')

  // Y-axis ticks — 5 nice steps from 0 to maxVal
  const TICK_COUNT = 5
  const incomeTicks = Array.from({ length: TICK_COUNT }, (_, i) =>
    Math.round((maxVal / (TICK_COUNT - 1)) * i)
  )

  // ─── Completion Bar Chart ──────────────────────────────────────────
  const completionRates = cycleData.map(c =>
    studentCount > 0 ? Math.round((c.paidCount / studentCount) * 100) : 0
  )

  const getYPercent = (v: number) => PT + CH - (Math.min(100, Math.max(0, v)) / 100) * CH
  const percentTicks = [0, 25, 50, 75, 100]

  // ─── Column-based X for bars (fixes edge overflow) ───────────────────
  // Each period gets an equal column; bar is centered in its column
  const colW = CW / Math.max(1, cycleData.length)
  const getBarX = (i: number) => PL + (i + 0.5) * colW  // center of column i
  const barW = Math.max(14, Math.min(44, colW * 0.52))

  // ─── Tooltip position clamp (keeps inside SVG) ─────────────────────
  const tooltipX = (i: number, chartW: number) => {
    const pct = ((getX(i) - PL) / CW) * 100
    // Flip tooltip to left side when near right edge
    return pct > 65 ? 'auto' : `${Math.max(2, (getX(i) / W) * 100 - 20)}%`
  }
  const tooltipRight = (i: number) => {
    const pct = ((getX(i) - PL) / CW) * 100
    return pct > 65 ? `${Math.max(2, 100 - (getX(i) / W) * 100 - 20)}%` : 'auto'
  }

  // Check if target is unreliable (all 0, or no tier data AND identical to collected)
  const targetUnreliable =
    validTargets.length === 0 ||
    (!tierBreakdown && validTargets.every(v => v === maxCollected))

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* ── 1. Income Trend Line Chart ──────────────────────────────── */}
      <div className="bg-background-secondary border border-border rounded-2xl p-5 shadow-sm">
        <div className="mb-3">
          <h4 className="text-[13px] font-bold text-text-primary flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-brand" />
            รายรับจริงเทียบเป้าหมายรายงวด
          </h4>
          <p className="text-[11px] text-text-muted mt-0.5">ยอดที่เก็บได้จริงเทียบกับยอดเป้าหมายตามงวด</p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-[10px] font-semibold text-text-muted mb-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-brand inline-block" />
            <span>รายรับจริง</span>
          </div>
          {!targetUnreliable && (
            <div className="flex items-center gap-1.5">
              <span className="w-5 border-t border-dashed border-slate-400 inline-block" />
              <span>เป้าหมาย</span>
            </div>
          )}
          {targetUnreliable && (
            <div className="flex items-center gap-1 text-amber-500">
              <AlertTriangle className="w-3 h-3" />
              <span className="text-[9px]">เป้าหมายไม่พร้อมใช้ (multi-tier)</span>
            </div>
          )}
        </div>

        {/* SVG */}
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ height: 'auto', display: 'block' }}
          >
            <defs>
              <linearGradient id="rptAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b59410" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#b59410" stopOpacity="0.0" />
              </linearGradient>
              <clipPath id="rptChartClip">
                <rect x={PL} y={PT - 4} width={CW} height={CH + 8} />
              </clipPath>
            </defs>

            {/* Y-axis ticks + gridlines */}
            {incomeTicks.map((val, i) => {
              const y = getYIncome(val)
              return (
                <g key={i}>
                  <line
                    x1={PL} y1={y} x2={W - PR} y2={y}
                    stroke="currentColor"
                    className="text-border/50"
                    strokeWidth={i === 0 ? 1 : 0.75}
                    strokeDasharray={i === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={PL - 5} y={y + 3.5}
                    textAnchor="end"
                    fill="currentColor"
                    className="text-text-muted"
                    style={{ fontSize: 8.5, fontWeight: 700 }}
                  >
                    {fmtTick(val)}
                  </text>
                </g>
              )
            })}

            {/* Area fill (clipped) */}
            <g clipPath="url(#rptChartClip)">
              <polygon points={areaPoints} fill="url(#rptAreaGrad)" />
            </g>

            {/* Target dashed line */}
            {!targetUnreliable && (
              <polyline
                points={targetPoints}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="1.5"
                strokeDasharray="4 3"
                clipPath="url(#rptChartClip)"
              />
            )}

            {/* Collected line */}
            <polyline
              points={collectedPoints}
              fill="none"
              stroke="#b59410"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              clipPath="url(#rptChartClip)"
            />

            {/* Hover circles + invisible hit areas */}
            {cycleData.map((c, i) => {
              const x = getX(i)
              const y = getYIncome(c.collected)
              const hov = hoveredIncomeIdx === i
              return (
                <g key={i}>
                  <circle cx={x} cy={y} r={14} fill="transparent" className="cursor-pointer"
                    onMouseEnter={() => setHoveredIncomeIdx(i)}
                    onMouseLeave={() => setHoveredIncomeIdx(null)}
                  />
                  <circle cx={x} cy={y} r={hov ? 5.5 : 3.5}
                    fill="var(--color-background-secondary, #fff)"
                    stroke="#b59410"
                    strokeWidth={hov ? 2.5 : 1.5}
                    style={{ transition: 'r 80ms, stroke-width 80ms' }}
                    className="pointer-events-none"
                  />
                </g>
              )
            })}

            {/* X-axis labels — two-line in SVG */}
            {cycleData.map((c, i) => {
              const x = getX(i)
              const parts = shortLabel(c).split('\n')
              return (
                <g key={i}>
                  {parts.map((line, li) => (
                    <text
                      key={li}
                      x={x}
                      y={PT + CH + 14 + li * 11}
                      textAnchor="middle"
                      fill="currentColor"
                      className="text-text-muted"
                      style={{ fontSize: 8.5, fontWeight: 600 }}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              )
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoveredIncomeIdx !== null && (() => {
            const idx = hoveredIncomeIdx
            const item = cycleData[idx]
            return (
              <div
                className="absolute z-30 bg-background border border-border rounded-xl p-2.5 shadow-xl pointer-events-none text-left text-[10.5px] font-bold"
                style={{
                  width: 175,
                  left: tooltipX(idx, W),
                  right: tooltipRight(idx),
                  top: `${Math.max(0, (getYIncome(item.collected) / H) * 100 - 45)}%`,
                }}
              >
                <div className="flex items-center gap-1.5 border-b border-border/70 pb-1 mb-1.5 text-text-primary">
                  <Calendar className="w-3 h-3 text-brand" />
                  <span className="truncate">{item.label || item.title || `งวดที่ ${item.period_order ?? item.week}`}</span>
                </div>
                <div className="space-y-0.5 font-semibold text-text-secondary">
                  <div className="flex justify-between gap-2">
                    <span>รายรับจริง</span>
                    <span className="text-brand font-extrabold">{formatCurrency(item.collected)}</span>
                  </div>
                  {!targetUnreliable && (
                    <div className="flex justify-between gap-2">
                      <span>เป้าหมาย</span>
                      <span className="font-bold text-text-primary">{formatCurrency(calcPeriodTarget(item.amount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2">
                    <span>ผู้ชำระ</span>
                    <span className="font-bold text-text-primary">{item.paidCount} / {studentCount} คน</span>
                  </div>
                  {(item.rate ?? 0) > 0 && (
                    <div className="flex justify-between gap-2">
                      <span>อัตรา</span>
                      <span className="font-bold text-emerald-600">{item.rate}%</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── 2. Completion Bar Chart ─────────────────────────────────── */}
      <div className="bg-background-secondary border border-border rounded-2xl p-5 shadow-sm">
        <div className="mb-3">
          <h4 className="text-[13px] font-bold text-text-primary flex items-center gap-1.5">
            <Percent className="w-4 h-4 text-emerald-600" />
            อัตราการชำระเงินรายงวด (%)
          </h4>
          <p className="text-[11px] text-text-muted mt-0.5">ร้อยละของนักศึกษาที่ชำระเงินสำเร็จในแต่ละงวด</p>
        </div>

        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full"
            style={{ height: 'auto', display: 'block' }}
          >
            <defs>
              <linearGradient id="rptBarGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="1" />
                <stop offset="100%" stopColor="#059669" stopOpacity="0.8" />
              </linearGradient>
              <linearGradient id="rptBarGradHov" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#34d399" stopOpacity="1" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.9" />
              </linearGradient>
            </defs>

            {/* Y-axis ticks + gridlines */}
            {percentTicks.map((val, i) => {
              const y = getYPercent(val)
              return (
                <g key={i}>
                  <line
                    x1={PL} y1={y} x2={W - PR} y2={y}
                    stroke="currentColor"
                    className="text-border/50"
                    strokeWidth={val === 0 ? 1 : 0.75}
                    strokeDasharray={val === 0 ? undefined : '3 3'}
                  />
                  <text
                    x={PL - 5} y={y + 3.5}
                    textAnchor="end"
                    fill="currentColor"
                    className="text-text-muted"
                    style={{ fontSize: 8.5, fontWeight: 700 }}
                  >
                    {val}%
                  </text>
                </g>
              )
            })}

            {/* Bars */}
            {cycleData.map((c, i) => {
              const xCenter = getBarX(i)    // column-center
              const bx = xCenter - barW / 2
              const rate = completionRates[i]
              const barTop = getYPercent(rate)
              const barBottom = PT + CH
              const bh = Math.max(3, barBottom - barTop)
              const hov = hoveredBarIdx === i

              // Label: inside bar if tall enough, above bar otherwise
              const insideBar = bh >= 24
              const labelY = insideBar
                ? barTop + bh / 2 + 3.5       // vertically centered inside
                : Math.max(PT + 10, barTop - 5) // just above bar, clamped to top

              return (
                <g key={i}>
                  {/* Invisible hover zone — full column height */}
                  <rect
                    x={PL + i * colW}
                    y={PT}
                    width={colW}
                    height={CH}
                    fill="transparent"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredBarIdx(i)}
                    onMouseLeave={() => setHoveredBarIdx(null)}
                  />
                  {/* Track (background) — only chart inner area */}
                  <rect
                    x={bx} y={PT}
                    width={barW} height={CH}
                    rx={5} ry={5}
                    fill="currentColor"
                    className="text-border/20 pointer-events-none"
                  />
                  {/* Actual Bar */}
                  <rect
                    x={bx} y={barTop}
                    width={barW} height={bh}
                    rx={5} ry={5}
                    fill={hov ? 'url(#rptBarGradHov)' : 'url(#rptBarGrad)'}
                    style={{ transition: 'fill 100ms' }}
                    className="pointer-events-none"
                  />
                  {/* % label — inside bar (white) or above bar (colored) */}
                  <text
                    x={xCenter}
                    y={labelY}
                    textAnchor="middle"
                    fill={insideBar ? '#ffffff' : (hov ? '#059669' : 'currentColor')}
                    className={!insideBar ? 'text-text-secondary' : ''}
                    style={{ fontSize: 8.5, fontWeight: 800, transition: 'fill 100ms' }}
                  >
                    {rate}%
                  </text>
                  {/* paidCount: bottom of bar, only when bar is very tall */}
                  {bh > 32 && (
                    <text
                      x={xCenter}
                      y={barBottom - 5}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.80)"
                      style={{ fontSize: 7.5, fontWeight: 900 }}
                      className="pointer-events-none select-none"
                    >
                      {c.paidCount} คน
                    </text>
                  )}
                </g>
              )
            })}

            {/* X-axis labels — column-centered */}
            {cycleData.map((c, i) => {
              const x = getBarX(i)
              const parts = shortLabel(c).split('\n')
              return (
                <g key={i}>
                  {parts.map((line, li) => (
                    <text
                      key={li}
                      x={x}
                      y={PT + CH + 14 + li * 11}
                      textAnchor="middle"
                      fill="currentColor"
                      className="text-text-muted"
                      style={{ fontSize: 8.5, fontWeight: 600 }}
                    >
                      {line}
                    </text>
                  ))}
                </g>
              )
            })}
          </svg>

          {/* Floating Tooltip */}
          {hoveredBarIdx !== null && (() => {
            const idx = hoveredBarIdx
            const item = cycleData[idx]
            const rate = completionRates[idx]
            const xCenter = getBarX(idx)
            return (
              <div
                className="absolute z-30 bg-background border border-border rounded-xl p-2.5 shadow-xl pointer-events-none text-left text-[10.5px] font-bold"
                style={{
                  width: 175,
                  left: tooltipX(idx, W),
                  right: tooltipRight(idx),
                  top: `${Math.max(0, (getYPercent(rate) / H) * 100 - 45)}%`,
                }}
              >
                <div className="flex items-center gap-1.5 border-b border-border/70 pb-1 mb-1.5 text-text-primary">
                  <Info className="w-3 h-3 text-emerald-600" />
                  <span className="truncate">{item.label || item.title || `งวดที่ ${item.period_order ?? item.week}`}</span>
                </div>
                <div className="space-y-0.5 font-semibold text-text-secondary">
                  <div className="flex justify-between gap-2">
                    <span>ชำระแล้ว</span>
                    <span className="text-emerald-600 font-extrabold">{item.paidCount} คน</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>ยังไม่ชำระ</span>
                    <span className="text-red-500 font-bold">{studentCount - item.paidCount} คน</span>
                  </div>
                  {(item.pendingCount ?? 0) > 0 && (
                    <div className="flex justify-between gap-2">
                      <span>รออนุมัติ</span>
                      <span className="text-amber-500 font-bold">{item.pendingCount} คน</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-2 pt-0.5 border-t border-border/50 mt-0.5">
                    <span>อัตราความสำเร็จ</span>
                    <span className="text-emerald-600 font-extrabold">{rate}%</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

        {/* Summary row below chart */}
        <div className="mt-3 flex items-center justify-between text-[10.5px] font-semibold text-text-muted border-t border-border/40 pt-3">
          <span>ทั้งหมด {studentCount} คน</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              เฉลี่ย {completionRates.length > 0 ? Math.round(completionRates.reduce((s, r) => s + r, 0) / completionRates.length) : 0}%
            </span>
            <span className="flex items-center gap-1 text-brand">
              <span className="w-2 h-2 rounded-full bg-brand inline-block" />
              สูงสุด {completionRates.length > 0 ? Math.max(...completionRates) : 0}%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
