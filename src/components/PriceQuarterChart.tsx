import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { PriceByQuarterRow } from '../types'

interface Props {
  data: PriceByQuarterRow[]
  loading: boolean
  activeFilters: { catL1: string; catL2: string; catL3: string; skus: string[] }
}

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4']

// Distinct colors for up to 6 years
const YEAR_COLORS = ['#22d3ee', '#f59e0b', '#a78bfa', '#34d399', '#f87171', '#fb923c']

function fmtPrice(v: number) {
  return `฿${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function contextLabel(f: Props['activeFilters']) {
  if (f.skus.length > 0) return f.skus.join(', ')
  const parts = [f.catL1, f.catL2, f.catL3].filter(Boolean)
  return parts.length > 0 ? parts.join(' › ') : 'All categories'
}

// Transform flat rows → [{ quarter: 'Q1', 2024: price, 2025: price, … }, …]
function buildChartData(rows: PriceByQuarterRow[]) {
  const years = [...new Set(rows.map((r) => r.year))].sort()
  const byYearQ: Record<number, Record<number, number>> = {}
  for (const r of rows) {
    if (!byYearQ[r.year]) byYearQ[r.year] = {}
    byYearQ[r.year][r.quarter] = Number(r.price)
  }
  return {
    years,
    chartRows: [1, 2, 3, 4].map((q) => {
      const entry: Record<string, string | number> = { quarter: QUARTER_LABELS[q - 1] }
      for (const y of years) {
        if (byYearQ[y]?.[q] !== undefined) entry[y] = byYearQ[y][q]
      }
      return entry
    }),
  }
}

export default function PriceQuarterChart({ data, loading, activeFilters }: Props) {
  if (loading && data.length === 0) {
    return <div className="card bg-base-200 h-72 animate-pulse" />
  }

  const multiUom =
    activeFilters.skus.length === 0 &&
    !activeFilters.catL1 &&
    !activeFilters.catL2 &&
    !activeFilters.catL3

  const { years, chartRows } = buildChartData(data)

  const allValues = data.map((r) => Number(r.price)).filter((v) => !isNaN(v))
  const yDomain: [number | string, number | string] =
    allValues.length > 0
      ? [Math.min(...allValues) * 0.8, Math.max(...allValues) * 1.2]
      : ['auto', 'auto']

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body p-4 pb-2">
        {/* Header */}
        <div className="flex items-start justify-between mb-1">
          <div>
            <h2 className="text-sm font-semibold opacity-70 uppercase tracking-wide">
              Cost Price by Quarter
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
            <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />

              <XAxis
                dataKey="quarter"
                tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={(v) => fmtPrice(Number(v))}
                tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                axisLine={false}
                tickLine={false}
                width={72}
                domain={yDomain}
              />

              <Tooltip
                formatter={(val: number, name: string) => [fmtPrice(val), String(name)]}
                contentStyle={{
                  background: 'hsl(222 47% 11%)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />

              {years.map((year, i) => (
                <Bar
                  key={year}
                  dataKey={year}
                  fill={YEAR_COLORS[i % YEAR_COLORS.length]}
                  radius={[3, 3, 0, 0]}
                  isAnimationActive={false}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
