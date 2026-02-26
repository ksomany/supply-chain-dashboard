import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import type { MonthlyRow } from '../types'

interface Props {
  data: MonthlyRow[]
  loading: boolean
}

// Stable colour palette for L1 categories
const PALETTE = [
  '#6366f1', '#22d3ee', '#f59e0b', '#10b981',
  '#f43f5e', '#a78bfa', '#34d399', '#fb923c',
]

function fmtMonth(m: string) {
  const [y, mo] = m.split('-')
  const name = new Date(parseInt(y), parseInt(mo) - 1).toLocaleString('en-US', { month: 'short' })
  return `${name} '${y.slice(2)}`
}

function fmtK(v: number) {
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `฿${(v / 1_000).toFixed(0)}K`
  return `฿${v.toFixed(0)}`
}

export default function MonthlyChart({ data, loading }: Props) {
  if (loading && data.length === 0) {
    return <div className="card bg-base-200 h-72 animate-pulse" />
  }

  // Pivot: [{ month, Cat1: val, Cat2: val, ... }]
  const categories = [...new Set(data.map((r) => r.category_l1))].sort()
  const monthMap: Record<string, Record<string, number>> = {}
  for (const row of data) {
    if (!monthMap[row.month]) monthMap[row.month] = {}
    monthMap[row.month][row.category_l1] = Number(row.ordered_value_thb)
  }
  const chartData = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({ month: fmtMonth(month), ...vals }))

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body p-4 pb-2">
        <h2 className="text-sm font-semibold opacity-70 uppercase tracking-wide mb-2">
          Ordered Value by Month
        </h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.45)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={fmtK}
              tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.45)' }}
              axisLine={false}
              tickLine={false}
              width={64}
            />
            <Tooltip
              formatter={(val: number, name: string) => [
                `฿${Number(val).toLocaleString()}`,
                name,
              ]}
              labelStyle={{ fontWeight: 600 }}
              contentStyle={{
                background: 'hsl(222 47% 11%)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {categories.map((cat, i) => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="a"
                fill={PALETTE[i % PALETTE.length]}
                radius={i === categories.length - 1 ? [3, 3, 0, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
