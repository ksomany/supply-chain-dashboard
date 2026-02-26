import {
  ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ReferenceLine,
} from 'recharts'
import type { PriceTrendRow } from '../types'

interface Props {
  data: PriceTrendRow[]
  loading: boolean
  activeFilters: { catL1: string; catL2: string; catL3: string; skus: string[] }
}

function fmtDate(d: string) {
  // 'YYYY-MM-DD' → 'DD MMM YY'
  const dt = new Date(d + 'T00:00:00')
  return dt.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtPrice(v: number) {
  return `฿${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function contextLabel(f: Props['activeFilters']) {
  if (f.skus.length > 0) return f.skus.join(', ')
  const parts = [f.catL1, f.catL2, f.catL3].filter(Boolean)
  return parts.length > 0 ? parts.join(' › ') : 'All categories'
}

// Thin out to at most N evenly-spaced X-axis ticks
function xTicks(data: PriceTrendRow[], max = 10): string[] {
  if (data.length <= max) return data.map((r) => r.date)
  const step = Math.ceil(data.length / max)
  return data.filter((_, i) => i % step === 0).map((r) => r.date)
}

export default function PriceTrendChart({ data, loading, activeFilters }: Props) {
  if (loading && data.length === 0) {
    return <div className="card bg-base-200 h-72 animate-pulse" />
  }

  const multiUom =
    activeFilters.skus.length === 0 &&
    !activeFilters.catL1 &&
    !activeFilters.catL2 &&
    !activeFilters.catL3

  // Compute overall average for reference line
  const avg =
    data.length > 0
      ? data.reduce((s, r) => s + Number(r.price), 0) / data.length
      : null

  const ticks = xTicks(data)

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body p-4 pb-2">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-sm font-semibold opacity-70 uppercase tracking-wide">
              Cost Price Trend
            </h2>
            <p className="text-xs opacity-40 mt-0.5">{contextLabel(activeFilters)}</p>
          </div>
          {multiUom && (
            <div className="tooltip tooltip-left" data-tip="Viewing all categories mixes different UoMs (kg, Piece, carton…). Filter to a single category or SKU for a meaningful price comparison.">
              <span className="badge badge-warning badge-sm cursor-help">⚠ Mixed UoM</span>
            </div>
          )}
        </div>

        {data.length === 0 ? (
          <div className="flex items-center justify-center h-52 opacity-30 text-sm">
            No data for current filters
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />

              <XAxis
                dataKey="date"
                ticks={ticks}
                tickFormatter={fmtDate}
                tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tickFormatter={(v) => `฿${Number(v).toLocaleString()}`}
                tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                axisLine={false}
                tickLine={false}
                width={72}
              />

              <Tooltip
                labelFormatter={fmtDate}
                formatter={(val: number, name: string) => [fmtPrice(val), name]}
                contentStyle={{
                  background: 'hsl(222 47% 11%)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value) =>
                  value === 'price' ? 'Daily price'
                  : value === 'ma_30d' ? '30-day MA'
                  : '3-month MA'
                }
              />

              {/* Average reference line */}
              {avg !== null && (
                <ReferenceLine
                  y={avg}
                  stroke="rgba(255,255,255,0.15)"
                  strokeDasharray="4 4"
                  label={{
                    value: `Avg ${fmtPrice(avg)}`,
                    position: 'insideTopRight',
                    fontSize: 10,
                    fill: 'rgba(255,255,255,0.3)',
                  }}
                />
              )}

              {/* Daily price — thin bars for context / volatility */}
              <Bar
                dataKey="price"
                fill="rgba(255,255,255,0.08)"
                stroke="rgba(255,255,255,0.18)"
                strokeWidth={0.5}
                barSize={4}
                isAnimationActive={false}
              />

              {/* 30-day moving average */}
              <Line
                type="monotone"
                dataKey="ma_30d"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />

              {/* 3-month moving average */}
              <Line
                type="monotone"
                dataKey="ma_3m"
                stroke="#f59e0b"
                strokeWidth={2.5}
                strokeDasharray="6 3"
                dot={false}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
