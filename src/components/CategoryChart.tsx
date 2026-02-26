import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { CategoryRow } from '../types'

interface Props {
  data: CategoryRow[]
  loading: boolean
  activeL1: string
  activeL2: string
  onDrillDown: (cat: string, level: 1 | 2 | 3) => void
}

const PALETTE = [
  '#6366f1','#22d3ee','#f59e0b','#10b981',
  '#f43f5e','#a78bfa','#34d399','#fb923c',
]

function fmtK(v: number) {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(0)}K`
  return String(Math.round(v))
}

export default function CategoryChart({ data, loading, activeL1, activeL2, onDrillDown }: Props) {
  if (loading && data.length === 0) {
    return <div className="card bg-base-200 h-72 animate-pulse" />
  }

  const level: 1 | 2 | 3 = activeL2 ? 3 : activeL1 ? 2 : 1
  const nextLevel: 1 | 2 | 3 = level === 1 ? 1 : level === 2 ? 2 : 3

  const chartData = data
    .filter((r) => r.category !== 'Uncategorized')
    .slice(0, 12)
    .map((r) => ({
      name: r.category.length > 20 ? r.category.slice(0, 19) + '…' : r.category,
      fullName: r.category,
      value: Number(r.total_value),
    }))

  const levelLabel = level === 1 ? 'L1' : level === 2 ? 'L2' : 'L3'
  const breadcrumb = [activeL1, activeL2].filter(Boolean).join(' › ')

  return (
    <div className="card bg-base-200 shadow-sm h-full">
      <div className="card-body p-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold opacity-70 uppercase tracking-wide">
            By Category {levelLabel}
          </h2>
          {breadcrumb && (
            <button
              className="btn btn-xs btn-ghost opacity-60"
              onClick={() => onDrillDown('', 1)}
              title="Back to L1"
            >
              ✕ {breadcrumb}
            </button>
          )}
        </div>
        <p className="text-xs opacity-40 mb-2">
          {level < 3 ? 'Click a bar to drill down' : 'Deepest level'}
        </p>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 0, right: 8, left: 4, bottom: 4 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" horizontal={false} />
            <XAxis
              type="number"
              tickFormatter={fmtK}
              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={90}
              tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.55)' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(val: number, _: string, props: { payload?: { fullName?: string } }) => [
                `฿${Number(val).toLocaleString()}`,
                props?.payload?.fullName || '',
              ]}
              contentStyle={{
                background: 'hsl(222 47% 11%)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              cursor={level < 3 ? 'pointer' : 'default'}
              onClick={(item: { fullName: string }) => {
                if (level < 3) onDrillDown(item.fullName, nextLevel)
              }}
            >
              {chartData.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
