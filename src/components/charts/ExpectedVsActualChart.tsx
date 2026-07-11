'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface ExpectedActualData {
  label: string
  expected: number
  actual: number
}

interface Props {
  data: ExpectedActualData[]
}

// Custom function to format currency
const formatAmt = (val: number) => {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(val)
}

export default function ExpectedVsActualChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-[12px] italic">
        ยังไม่มีข้อมูล
      </div>
    )
  }

  return (
    <div className="w-full h-56 mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="label" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
            dy={10} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: '#64748b' }} 
            tickFormatter={(value) => value >= 1000 ? `${value / 1000}k` : value}
          />
          <Tooltip 
            cursor={{ fill: '#f1f5f9' }}
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
            formatter={(value: any, name: any) => [
              formatAmt(Number(value) || 0), 
              name === 'expected' ? 'คาดหวัง' : 'รับจริง'
            ]}
          />
          <Legend 
            iconType="circle" 
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
            formatter={(value) => value === 'expected' ? 'คาดหวัง' : 'รับจริง'}
          />
          <Bar dataKey="expected" name="expected" fill="#cbd5e1" barSize={16} radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" name="actual" fill="#3d52d5" barSize={16} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
