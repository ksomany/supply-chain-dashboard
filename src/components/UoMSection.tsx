import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import type { UoMRow } from '../types'

interface Props {
  data: UoMRow[]
  loading: boolean
}

const UOM_COLORS: Record<string, string> = {
  carton:   '#6366f1',
  Piece:    '#22d3ee',
  kg:       '#f59e0b',
  Unit:     '#10b981',
  'gal (US)': '#f43f5e',
  Unknown:  '#94a3b8',
}

function color(uom: string) {
  return UOM_COLORS[uom] ?? '#94a3b8'
}

function fmtQty(n: string | number) {
  const v = Number(n)
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}K`
  return Number(v.toFixed(2)).toLocaleString()
}

function fmtVal(n: string | number) {
  const v = Number(n)
  if (v >= 1_000_000) return `฿${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `฿${(v / 1_000).toFixed(0)}K`
  return `฿${v.toFixed(0)}`
}

function ReceiptBar({ pct }: { pct: number }) {
  const cls =
    pct >= 100 ? 'progress-success'
    : pct >= 80 ? 'progress-info'
    : pct >= 50 ? 'progress-warning'
    : 'progress-error'
  return <progress className={`progress ${cls} w-full mt-1`} value={Math.min(pct, 100)} max={100} />
}

export default function UoMSection({ data, loading }: Props) {
  if (loading && data.length === 0) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <div key={i} className="card bg-base-200 h-32 animate-pulse" />)}
        </div>
      </div>
    )
  }

  // Filter out rows with zero qty (null UoM lines)
  const rows = data.filter((r) => Number(r.total_ordered_qty) > 0)

  // Chart data: ordered vs received qty per UoM
  const chartData = rows.map((r) => ({
    uom: r.uom,
    Ordered:  Number(r.total_ordered_qty),
    Received: Number(r.total_received_qty),
  }))

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold opacity-70 uppercase tracking-wide">
        By Unit of Measure (UoM)
      </h2>

      {/* ── Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {rows.map((row) => {
          const pct = Number(row.pct_received ?? 0)
          return (
            <div
              key={row.uom}
              className="card bg-base-200 shadow-sm"
              style={{ borderTop: `3px solid ${color(row.uom)}` }}
            >
              <div className="card-body p-4 gap-1">
                <div
                  className="text-sm font-bold"
                  style={{ color: color(row.uom) }}
                >
                  {row.uom}
                </div>

                <div className="text-xl font-bold mt-1">
                  {fmtQty(row.total_ordered_qty)}
                </div>
                <div className="text-xs opacity-40">ordered</div>

                <ReceiptBar pct={pct} />
                <div className="flex justify-between text-xs opacity-50 mt-0.5">
                  <span>{fmtQty(row.total_received_qty)} recv'd</span>
                  <span>{pct}%</span>
                </div>

                <div className="divider my-1 opacity-20" />

                <div className="text-xs opacity-50">
                  {fmtVal(row.total_value_thb)} · {Number(row.line_count).toLocaleString()} lines
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Ordered vs Received qty bar chart ── */}
      {chartData.length > 0 && (
        <div className="card bg-base-200 shadow-sm">
          <div className="card-body p-4 pb-2">
            <h3 className="text-xs font-semibold opacity-60 uppercase tracking-wide mb-2">
              Ordered vs Received Quantity by UoM
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis
                  dataKey="uom"
                  tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.5)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => fmtQty(v)}
                  tick={{ fontSize: 11, fill: 'rgba(255,255,255,0.4)' }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  formatter={(val: number, name: string) => [
                    `${fmtQty(val)} ${chartData.find((d) => d.Ordered === val || d.Received === val)?.uom ?? ''}`,
                    name,
                  ]}
                  contentStyle={{
                    background: 'hsl(222 47% 11%)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Ordered"  fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Received" fill="#22d3ee" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
