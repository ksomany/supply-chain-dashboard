import type { KPIs } from '../types'

interface Props {
  kpis: KPIs | null
  loading: boolean
}

function fmt(n: string | number | null | undefined, decimals = 0) {
  if (n === null || n === undefined) return '—'
  return Number(n).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function ReceiptBar({ pct }: { pct: number }) {
  const color =
    pct >= 100 ? 'progress-success'
    : pct >= 80 ? 'progress-info'
    : pct >= 50 ? 'progress-warning'
    : 'progress-error'
  return (
    <progress
      className={`progress ${color} w-full mt-1`}
      value={Math.min(pct, 100)}
      max={100}
    />
  )
}

export default function KPICards({ kpis, loading }: Props) {
  if (loading && !kpis) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card bg-base-200 h-28 animate-pulse" />
        ))}
      </div>
    )
  }

  const pctRecv = Number(kpis?.pct_received ?? 0)
  const pctInv  = Number(kpis?.pct_invoiced ?? 0)
  const orderedVal = Number(kpis?.total_ordered_value ?? 0)
  const receivedVal = Number(kpis?.total_received_value ?? 0)

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">

      {/* Total PO Value */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body p-4 gap-1">
          <div className="text-xs opacity-50 uppercase tracking-wider">Total PO Value</div>
          <div className="text-2xl font-bold text-primary">
            ฿{fmt(orderedVal / 1_000_000, 2)}M
          </div>
          <div className="text-xs opacity-40">
            {fmt(orderedVal)} THB
          </div>
        </div>
      </div>

      {/* Received Value */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body p-4 gap-1">
          <div className="text-xs opacity-50 uppercase tracking-wider">Received Value</div>
          <div className="text-2xl font-bold text-success">
            ฿{fmt(receivedVal / 1_000_000, 2)}M
          </div>
          <ReceiptBar pct={pctRecv} />
          <div className="text-xs opacity-40">{fmt(pctRecv, 1)}% of ordered value</div>
        </div>
      </div>

      {/* Invoice Coverage */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body p-4 gap-1">
          <div className="text-xs opacity-50 uppercase tracking-wider">Invoiced</div>
          <div className="text-2xl font-bold text-info">
            {fmt(pctInv, 1)}%
          </div>
          <ReceiptBar pct={pctInv} />
          <div className="text-xs opacity-40">of ordered value</div>
        </div>
      </div>

      {/* PO Lines & Months */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body p-4 gap-1">
          <div className="text-xs opacity-50 uppercase tracking-wider">PO Lines</div>
          <div className="text-2xl font-bold">
            {fmt(kpis?.total_lines)}
          </div>
          <div className="text-xs opacity-40">
            across {kpis?.distinct_months ?? '—'} months
          </div>
        </div>
      </div>

    </div>
  )
}
