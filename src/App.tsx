import { useState, useEffect, useCallback } from 'react'
import type { Filters, KPIs, MonthlyRow, CategoryRow, LinesResponse, FilterOptions, UoMRow, PriceTrendRow, PriceByQuarterRow, SortKey, SortDir } from './types'
import FiltersBar from './components/Filters'
import KPICards from './components/KPICards'
import MonthlyChart from './components/MonthlyChart'
import CategoryChart from './components/CategoryChart'
import UoMSection from './components/UoMSection'
import PriceTrendChart from './components/PriceTrendChart'
import PriceQuarterChart from './components/PriceQuarterChart'
import DataTable from './components/DataTable'

const DEFAULT_FILTERS: Filters = {
  dateFrom: '2025-01',
  dateTo: '',
  catL1: '',
  catL2: '',
  catL3: '',
  search: '',
  skus: [],
}

function toQS(filters: Filters, extra: Record<string, string | number> = {}) {
  const p = new URLSearchParams()
  // Scalar filter fields
  const { skus, ...scalar } = filters
  Object.entries(scalar).forEach(([k, v]) => {
    if (v !== '') p.set(k, String(v))
  })
  // Array field: send as comma-separated
  if (skus.length > 0) p.set('skus', skus.join(','))
  // Extra params (pagination / sort)
  Object.entries(extra).forEach(([k, v]) => {
    if (v !== '' && v !== null && v !== undefined) p.set(k, String(v))
  })
  return p.toString()
}

export default function App() {
  const [filters, setFilters]         = useState<Filters>(DEFAULT_FILTERS)
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null)

  const [kpis, setKpis]               = useState<KPIs | null>(null)
  const [monthly, setMonthly]         = useState<MonthlyRow[]>([])
  const [byCategory, setByCategory]   = useState<CategoryRow[]>([])
  const [byUom, setByUom]             = useState<UoMRow[]>([])
  const [priceTrend, setPriceTrend]   = useState<PriceTrendRow[]>([])
  const [priceByQtr, setPriceByQtr]   = useState<PriceByQuarterRow[]>([])
  const [lines, setLines]             = useState<LinesResponse | null>(null)

  const [page, setPage]               = useState(1)
  const [pageSize]                    = useState(50)
  const [sortBy, setSortBy]           = useState<SortKey>('month')
  const [sortDir, setSortDir]         = useState<SortDir>('desc')

  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // Load filter options once on mount
  useEffect(() => {
    fetch('/api/po/filters')
      .then((r) => r.json())
      .then(setFilterOptions)
      .catch((e) => setError(e.message))
  }, [])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    const qs      = toQS(filters)
    const tableQs = toQS(filters, { page, pageSize, sortBy, sortDir })
    try {
      const [kpisRes, monthlyRes, catRes, uomRes, priceRes, priceQtrRes, linesRes] = await Promise.all([
        fetch(`/api/po/kpis?${qs}`),
        fetch(`/api/po/monthly?${qs}`),
        fetch(`/api/po/by-category?${qs}`),
        fetch(`/api/po/by-uom?${qs}`),
        fetch(`/api/po/price-trend?${qs}`),
        fetch(`/api/po/price-by-quarter?${qs}`),
        fetch(`/api/po/lines?${tableQs}`),
      ])
      const [k, m, c, u, pt, pq, l] = await Promise.all([
        kpisRes.json(), monthlyRes.json(), catRes.json(), uomRes.json(), priceRes.json(), priceQtrRes.json(), linesRes.json(),
      ])
      if (k.error) throw new Error(k.error)
      setKpis(k)
      setMonthly(m)
      setByCategory(c)
      setByUom(u)
      setPriceTrend(pt)
      setPriceByQtr(pq)
      setLines(l)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [filters, page, pageSize, sortBy, sortDir])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleFiltersChange = (f: Filters) => {
    setPage(1)
    setFilters(f)
  }

  const handleSort = (col: SortKey) => {
    if (col === sortBy) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(col)
      setSortDir('desc')
    }
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-base-100 text-base-content">
      {/* ── Header ── */}
      <header className="navbar bg-base-200 border-b border-base-300 px-4 sticky top-0 z-30">
        <div className="flex-1">
          <span className="text-lg font-bold tracking-wide">Supply Chain — PO Dashboard</span>
        </div>
        <div className="flex-none gap-2">
          {loading && <span className="loading loading-spinner loading-sm opacity-60" />}
          <button className="btn btn-sm btn-ghost" onClick={fetchAll} title="Refresh">
            ↺ Refresh
          </button>
        </div>
      </header>

      {/* ── Filters ── */}
      {filterOptions && (
        <FiltersBar
          filters={filters}
          options={filterOptions}
          onChange={handleFiltersChange}
        />
      )}

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-4 mt-4">
          <div className="alert alert-error text-sm">
            <span>⚠ {error}</span>
            <button className="btn btn-xs btn-ghost ml-auto" onClick={() => setError(null)}>✕</button>
          </div>
        </div>
      )}

      <main className="p-4 space-y-6 max-w-[1600px] mx-auto">
        {/* ── KPI cards ── */}
        <KPICards kpis={kpis} loading={loading} />

        {/* ── Charts ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2">
            <MonthlyChart data={monthly} loading={loading} />
          </div>
          <div>
            <CategoryChart
              data={byCategory}
              loading={loading}
              activeL1={filters.catL1}
              activeL2={filters.catL2}
              onDrillDown={(cat, level) => {
                if (level === 1) handleFiltersChange({ ...filters, catL1: cat, catL2: '', catL3: '' })
                else if (level === 2) handleFiltersChange({ ...filters, catL2: cat, catL3: '' })
                else handleFiltersChange({ ...filters, catL3: cat })
              }}
            />
          </div>
        </div>

        {/* ── UoM section ── */}
        <UoMSection data={byUom} loading={loading} />

        {/* ── Price trend chart ── */}
        <PriceTrendChart
          data={priceTrend}
          loading={loading}
          activeFilters={{
            catL1: filters.catL1,
            catL2: filters.catL2,
            catL3: filters.catL3,
            skus: filters.skus,
          }}
        />

        {/* ── Price by quarter chart ── */}
        <PriceQuarterChart
          data={priceByQtr}
          loading={loading}
          activeFilters={{
            catL1: filters.catL1,
            catL2: filters.catL2,
            catL3: filters.catL3,
            skus: filters.skus,
          }}
        />

        {/* ── Data table ── */}
        <DataTable
          data={lines}
          loading={loading}
          page={page}
          pageSize={pageSize}
          sortBy={sortBy}
          sortDir={sortDir}
          onPageChange={setPage}
          onSort={handleSort}
        />
      </main>
    </div>
  )
}
