'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

interface TierPaymentData {
  tier: string
  paid: number
  unpaid: number
}

interface Props {
  data: TierPaymentData[]
}

export default function PaymentRateChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-[12px] italic">
        ยังไม่มีข้อมูล
      </div>
    )
  }

  // Adjust radius based on if the other part is zero
  const renderData = data.map(d => ({
    ...d,
    paidRadius: d.unpaid === 0 ? [4, 4, 4, 4] : [0, 0, 4, 4],
    unpaidRadius: d.paid === 0 ? [4, 4, 4, 4] : [4, 4, 0, 0],
  }))

  return (
    <div className="w-full h-56 mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={renderData}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis 
            dataKey="tier" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} 
            dy={10} 
          />
          <YAxis 
            axisLine={false} 
            tickLine={false} 
            tick={{ fontSize: 11, fill: '#64748b' }} 
            allowDecimals={false}
          />
          <Tooltip 
            cursor={{ fill: '#f1f5f9' }}
            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
            formatter={(value: any, name: any) => [
              `${value} คน`, 
              name === 'paid' ? 'ชำระแล้ว' : 'ค้างชำระ'
            ]}
          />
          <Legend 
            iconType="circle" 
            wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} 
            formatter={(value) => value === 'paid' ? 'ชำระแล้ว' : 'ค้างชำระ'}
          />
          <Bar dataKey="paid" name="paid" stackId="a" fill="#10b981" barSize={36} radius={[0, 0, 4, 4]} />
          <Bar dataKey="unpaid" name="unpaid" stackId="a" fill="#f43f5e" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
