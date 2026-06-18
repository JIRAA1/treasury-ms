'use client'

import { useState } from 'react'
import type { ExpenseCategory } from '@/types'

interface CategoryData {
  category: ExpenseCategory
  amount: number
}

interface Props {
  data: CategoryData[]
  totalAmount: number
}

const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; color: string; bg: string }> = {
  activity: { label: 'กิจกรรม',             color: '#6366f1', bg: '#eef2ff' },
  supplies: { label: 'อุปกรณ์',              color: '#0ea5e9', bg: '#f0f9ff' },
  food:     { label: 'อาหาร/เครื่องดื่ม',    color: '#f59e0b', bg: '#fffbeb' },
  transport:{ label: 'ค่าเดินทาง',            color: '#10b981', bg: '#f0fdf4' },
  other:    { label: 'อื่นๆ',                color: '#94a3b8', bg: '#f8fafc' },
}

const STROKE_WIDTH = 10
const RADIUS = 38
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default function ExpenseDonutChart({ data, totalAmount }: Props) {
  const [hovered, setHovered] = useState<ExpenseCategory | null>(null)

  // Filter categories that have amount > 0
  const filtered = data.filter(d => d.amount > 0)

  if (filtered.length === 0 || totalAmount === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-8 text-text-muted text-[12px] italic">
        ยังไม่มีข้อมูลค่าใช้จ่าย
      </div>
    )
  }

  // Compute stroke arcs
  let offset = 0
  const arcs = filtered.map((item) => {
    const ratio = item.amount / totalAmount
    const dash = ratio * CIRCUMFERENCE
    const gap = CIRCUMFERENCE - dash
    const startOffset = offset
    offset += dash
    return { ...item, dash, gap, startOffset }
  })

  const hoveredItem = hovered ? data.find(d => d.category === hovered) : null

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 w-full">
      {/* SVG Donut */}
      <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
        <svg width={120} height={120} viewBox="0 0 100 100">
          {/* Background ring */}
          <circle
            cx="50" cy="50" r={RADIUS}
            fill="none"
            stroke="#f1f5f9"
            strokeWidth={STROKE_WIDTH}
          />
          {/* Colored arcs */}
          {arcs.map((arc) => {
            const cfg = CATEGORY_CONFIG[arc.category as ExpenseCategory]
            const isHov = hovered === arc.category
            return (
              <circle
                key={arc.category}
                cx="50" cy="50" r={RADIUS}
                fill="none"
                stroke={cfg.color}
                strokeWidth={isHov ? STROKE_WIDTH + 2 : STROKE_WIDTH}
                strokeDasharray={`${arc.dash} ${arc.gap}`}
                strokeDashoffset={-arc.startOffset + CIRCUMFERENCE * 0.25}
                strokeLinecap="round"
                style={{ transition: 'stroke-width 0.2s, opacity 0.2s', opacity: hovered && !isHov ? 0.35 : 1, cursor: 'pointer' }}
                onMouseEnter={() => setHovered(arc.category as ExpenseCategory)}
                onMouseLeave={() => setHovered(null)}
              />
            )
          })}
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          {hoveredItem ? (
            <>
              <div className="text-[10px] text-text-muted font-semibold text-center leading-tight px-1">
                {CATEGORY_CONFIG[hoveredItem.category].label}
              </div>
              <div className="text-[12px] font-black text-text-primary mt-0.5">
                {Math.round((hoveredItem.amount / totalAmount) * 100)}%
              </div>
            </>
          ) : (
            <>
              <div className="text-[9px] text-text-muted uppercase tracking-wide">รายจ่าย</div>
              <div className="text-[11px] font-black text-text-primary mt-0.5">
                ฿{totalAmount >= 1000 ? `${(totalAmount / 1000).toFixed(1)}K` : totalAmount.toLocaleString()}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-col gap-1.5 w-full min-w-0">
        {filtered.map((item) => {
          const cfg = CATEGORY_CONFIG[item.category as ExpenseCategory]
          const pct = Math.round((item.amount / totalAmount) * 100)
          const isHov = hovered === item.category
          return (
            <div
              key={item.category}
              className="flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1 transition-all"
              style={{ background: isHov ? cfg.bg : 'transparent' }}
              onMouseEnter={() => setHovered(item.category as ExpenseCategory)}
              onMouseLeave={() => setHovered(null)}
            >
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: cfg.color }} />
              <div className="flex-1 text-[12px] font-medium text-text-secondary truncate">{cfg.label}</div>
              <div className="text-[11px] font-bold text-text-muted">{pct}%</div>
              <div className="text-[11px] font-semibold text-text-primary">
                ฿{item.amount.toLocaleString()}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
