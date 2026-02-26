import type { LinesResponse, PoLine, SortKey, SortDir } from '../types'

interface Props {
  data: LinesResponse | null
  loading: boolean
  page: number
  pageSize: number
  sortBy: SortKey
  sortDir: SortDir
  onPageChange: (p: number) => void
  onSort: (col: SortKey) => void
}

function fmt(v: string | number | null | undefined, dec = 0) {
  if (v === null || v === undefined || v === '') return '—'
  return Number(v).toLocaleString('en-US', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })
}

function ReceiptBadge({ ordered, received }: { ordered: string; received: string }) {
  const pct = Number(ordered) > 0 ? (Number(received) / Number(ordered)) * 100 : 0
  const cls =
    pct >= 100 ? 'badge-success'
    : pct >= 80 ? 'badge-info'
    : pct >= 50 ? 'badge-warning'
    : 'badge-error'
  return (
    <span className={`badge badge-sm ${cls} font-mono`}>
      {pct.toFixed(0)}%
    </span>
  )
}

function SortIcon({ col, sortBy, sortDir }: { col: SortKey; sortBy: SortKey; sortDir: SortDir }) {
  if (col !== sortBy) return <span className="opacity-20 ml-1">↕</span>
  return <span className="opacity-80 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
}

function Th({
  col, label, sortBy, sortDir, onSort, className = '',
}: {
  col: SortKey; label: string; sortBy: SortKey; sortDir: SortDir
  onSort: (c: SortKey) => void; className?: string
}) {
  return (
    <th
      className={`cursor-pointer select-none whitespace-nowrap hover:bg-base-300 ${className}`}
      onClick={() => onSort(col)}
    >
      {label}
      <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
    </th>
  )
}

export default function DataTable({
  data, loading, page, pageSize, sortBy, sortDir, onPageChange, onSort,
}: Props) {
  const rows: PoLine[] = data?.data ?? []
  const total = data?.total ?? 0
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="card bg-base-200 shadow-sm">
      <div className="card-body p-0">
        {/* Table header row */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <h2 className="text-sm font-semibold opacity-70 uppercase tracking-wide">
            PO Lines
          </h2>
          <span className="text-xs opacity-40">
            {total.toLocaleString()} rows
            {loading && <span className="ml-2 loading loading-dots loading-xs" />}
          </span>
        </div>

        {/* Scrollable table */}
        <div className="overflow-x-auto">
          <table className="table table-xs po-table w-full">
            <thead>
              <tr className="text-xs opacity-60">
                <Th col="month"           label="Month"       sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <Th col="sku"             label="SKU"         sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <Th col="product_name_en" label="Product"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="min-w-[180px]" />
                <Th col="category_l1"     label="L1"          sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <Th col="category_l2"     label="L2"          sortBy={sortBy} sortDir={sortDir} onSort={onSort} />
                <th>L3</th>
                <th className="text-right">UoM</th>
                <Th col="ordered_qty"     label="Ordered"     sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
                <Th col="received_qty"    label="Received"    sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
                <th className="text-right">Recv%</th>
                <Th col="ordered_value"   label="Value (THB)" sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
                <Th col="avg_price"       label="Avg Price"   sortBy={sortBy} sortDir={sortDir} onSort={onSort} className="text-right" />
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={12} className="text-center opacity-40 py-12">
                    No data for the selected filters.
                  </td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr key={`${row.variant_id}-${row.month}-${i}`}>
                  <td className="font-mono text-xs opacity-70">{row.month}</td>
                  <td className="font-mono text-xs">{row.sku || '—'}</td>
                  <td className="max-w-[240px] truncate" title={row.product_name_en}>
                    {row.product_name_en?.trim() || '—'}
                  </td>
                  <td className="text-xs opacity-70">{row.category_l1 || '—'}</td>
                  <td className="text-xs opacity-70">{row.category_l2 || '—'}</td>
                  <td className="text-xs opacity-60">{row.category_l3 || row.category_leaf || '—'}</td>
                  <td className="text-right text-xs opacity-60">{row.po_uom}</td>
                  <td className="text-right font-mono">{fmt(row.ordered_qty_po_uom)}</td>
                  <td className="text-right font-mono">{fmt(row.received_qty_po_uom)}</td>
                  <td className="text-right">
                    <ReceiptBadge
                      ordered={row.ordered_qty_po_uom}
                      received={row.received_qty_po_uom}
                    />
                  </td>
                  <td className="text-right font-mono">฿{fmt(row.ordered_value_thb)}</td>
                  <td className="text-right font-mono text-xs opacity-70">
                    {fmt(row.avg_price_unit_thb, 2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t border-base-300">
            <span className="text-xs opacity-40">
              Page {page} of {totalPages}
            </span>
            <div className="join">
              <button
                className="join-item btn btn-xs"
                disabled={page <= 1}
                onClick={() => onPageChange(1)}
              >«</button>
              <button
                className="join-item btn btn-xs"
                disabled={page <= 1}
                onClick={() => onPageChange(page - 1)}
              >‹</button>
              {/* Page number buttons (window of 5) */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(1, Math.min(page - 2, totalPages - 4))
                const p = start + i
                return (
                  <button
                    key={p}
                    className={`join-item btn btn-xs ${p === page ? 'btn-active' : ''}`}
                    onClick={() => onPageChange(p)}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                className="join-item btn btn-xs"
                disabled={page >= totalPages}
                onClick={() => onPageChange(page + 1)}
              >›</button>
              <button
                className="join-item btn btn-xs"
                disabled={page >= totalPages}
                onClick={() => onPageChange(totalPages)}
              >»</button>
            </div>
            <span className="text-xs opacity-40">
              {((page - 1) * pageSize + 1).toLocaleString()}–
              {Math.min(page * pageSize, total).toLocaleString()} of {total.toLocaleString()}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
