import { useState, useEffect, useRef } from 'react'
import type { Filters, FilterOptions, SkuSuggestion, ProductSuggestion } from '../types'

interface Props {
  filters: Filters
  options: FilterOptions
  onChange: (f: Filters) => void
}

function ProductPicker({
  selected,
  onAdd,
  onRemove,
  dateFrom,
  dateTo,
  catL1,
  catL2,
  catL3,
}: {
  selected: ProductSuggestion[]
  onAdd: (p: ProductSuggestion) => void
  onRemove: (tmplId: number) => void
  dateFrom: string
  dateTo: string
  catL1: string
  catL2: string
  catL3: string
}) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<ProductSuggestion[]>([])
  const [open, setOpen]       = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef          = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced search — hits /api/po/products
  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); return }
    const selectedIds = selected.map((p) => p.tmpl_id)
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams({ q: query })
        if (dateFrom) qs.set('dateFrom', dateFrom)
        if (dateTo)   qs.set('dateTo', dateTo)
        if (catL1)    qs.set('catL1', catL1)
        if (catL2)    qs.set('catL2', catL2)
        if (catL3)    qs.set('catL3', catL3)
        const r = await fetch(`/api/po/products?${qs}`)
        const data: ProductSuggestion[] = await r.json()
        setResults(data.filter((p) => !selectedIds.includes(p.tmpl_id)))
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => clearTimeout(t)
  }, [query, selected, dateFrom, dateTo, catL1, catL2, catL3])

  const pick = (p: ProductSuggestion) => {
    onAdd(p)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected product chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selected.map((p) => (
            <span key={p.tmpl_id} className="badge badge-secondary badge-sm gap-1">
              {p.template_sku
                ? <span className="font-mono text-xs">{p.template_sku}</span>
                : <span className="text-xs">{p.product_name}</span>
              }
              <button
                className="cursor-pointer opacity-70 hover:opacity-100"
                onClick={() => onRemove(p.tmpl_id)}
                aria-label={`Remove ${p.product_name}`}
              >✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          placeholder={selected.length ? 'Add product…' : 'Type product name…'}
          className="input input-sm input-bordered w-full pr-6"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 loading loading-spinner loading-xs opacity-50" />
        )}
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-base-300 border border-base-content/10 rounded-lg shadow-xl text-sm">
          {results.map((p) => (
            <li
              key={p.tmpl_id}
              className="px-3 py-2 cursor-pointer hover:bg-base-content/10 flex gap-2 items-baseline"
              onMouseDown={(e) => { e.preventDefault(); pick(p) }}
            >
              {p.template_sku && (
                <span className="font-mono text-xs text-secondary shrink-0">{p.template_sku}</span>
              )}
              <span className="truncate text-xs">{p.product_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function SkuPicker({
  selected,
  onAdd,
  onRemove,
  dateFrom,
  dateTo,
  catL1,
  catL2,
  catL3,
  tmplId,
}: {
  selected: string[]
  onAdd: (sku: string) => void
  onRemove: (sku: string) => void
  dateFrom: string
  dateTo: string
  catL1: string
  catL2: string
  catL3: string
  tmplId?: number
}) {
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<SkuSuggestion[]>([])
  const [open, setOpen]           = useState(false)
  const [loading, setLoading]     = useState(false)
  const containerRef              = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Debounced search
  useEffect(() => {
    if (query.length < 1) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const qs = new URLSearchParams({ q: query })
        if (dateFrom) qs.set('dateFrom', dateFrom)
        if (dateTo)   qs.set('dateTo', dateTo)
        if (catL1)    qs.set('catL1', catL1)
        if (catL2)    qs.set('catL2', catL2)
        if (catL3)    qs.set('catL3', catL3)
        if (tmplId)   qs.set('tmplId', String(tmplId))
        const r = await fetch(`/api/po/skus?${qs}`)
        const data: SkuSuggestion[] = await r.json()
        setResults(data.filter((s) => !selected.includes(s.sku)))
        setOpen(true)
      } finally {
        setLoading(false)
      }
    }, 280)
    return () => clearTimeout(t)
  }, [query, selected, dateFrom, dateTo, catL1, catL2, catL3, tmplId])

  const pick = (sku: string) => {
    onAdd(sku)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected SKU chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {selected.map((sku) => (
            <span key={sku} className="badge badge-primary badge-sm gap-1">
              {sku}
              <button
                className="cursor-pointer opacity-70 hover:opacity-100"
                onClick={() => onRemove(sku)}
                aria-label={`Remove ${sku}`}
              >✕</button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <input
          type="text"
          placeholder={selected.length ? 'Add variant…' : 'Type variant SKU…'}
          className="input input-sm input-bordered w-full pr-6"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {loading && (
          <span className="absolute right-2 top-1/2 -translate-y-1/2 loading loading-spinner loading-xs opacity-50" />
        )}
      </div>

      {/* Dropdown results */}
      {open && results.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto bg-base-300 border border-base-content/10 rounded-lg shadow-xl text-sm">
          {results.map((s) => (
            <li
              key={s.sku}
              className="px-3 py-2 cursor-pointer hover:bg-base-content/10 flex gap-2 items-baseline"
              onMouseDown={(e) => { e.preventDefault(); pick(s.sku) }}
            >
              <span className="font-mono text-xs text-primary shrink-0">{s.sku}</span>
              <span className="opacity-60 truncate text-xs">{s.product_name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function FiltersBar({ filters, options, onChange }: Props) {
  // Full ProductSuggestion objects kept locally for chip display.
  // The canonical source of truth (productTmplIds numbers) lives in filters.
  const [selectedProducts, setSelectedProducts] = useState<ProductSuggestion[]>([])

  // When productTmplIds is cleared externally (e.g. Reset), clear display state too
  useEffect(() => {
    if (filters.productTmplIds.length === 0) setSelectedProducts([])
  }, [filters.productTmplIds])

  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch })

  const l2s = filters.catL1
    ? Object.keys(options.hierarchy[filters.catL1] || {}).sort()
    : []
  const l3s = filters.catL1 && filters.catL2
    ? (options.hierarchy[filters.catL1]?.[filters.catL2] || []).filter(Boolean).sort()
    : []

  // When exactly one product is selected, scope the variant picker to its variants
  const scopedTmplId: number | undefined =
    selectedProducts.length === 1 ? selectedProducts[0].tmpl_id : undefined

  const hasFilters =
    filters.dateFrom !== '2025-01' || filters.dateTo ||
    filters.catL1 || filters.catL2 || filters.catL3 ||
    filters.search || filters.skus.length > 0 || filters.productTmplIds.length > 0

  const reset = () => {
    setSelectedProducts([])
    onChange({ dateFrom: '2025-01', dateTo: '', catL1: '', catL2: '', catL3: '', search: '', skus: [], productTmplIds: [] })
  }

  const handleProductAdd = (p: ProductSuggestion) => {
    const next = [...selectedProducts, p]
    setSelectedProducts(next)
    set({ productTmplIds: next.map((x) => x.tmpl_id) })
  }

  const handleProductRemove = (tmplId: number) => {
    const next = selectedProducts.filter((p) => p.tmpl_id !== tmplId)
    setSelectedProducts(next)
    set({ productTmplIds: next.map((x) => x.tmpl_id) })
  }

  return (
    <div className="bg-base-200 border-b border-base-300 px-4 py-3">
      <div className="flex flex-wrap gap-3 items-end max-w-[1600px] mx-auto">

        {/* Date from */}
        <div className="form-control">
          <label className="label py-0"><span className="label-text text-xs opacity-60">From</span></label>
          <input
            type="month"
            className="input input-sm input-bordered w-36"
            value={filters.dateFrom}
            min="2025-01"
            onChange={(e) => set({ dateFrom: e.target.value })}
          />
        </div>

        {/* Date to */}
        <div className="form-control">
          <label className="label py-0"><span className="label-text text-xs opacity-60">To</span></label>
          <input
            type="month"
            className="input input-sm input-bordered w-36"
            value={filters.dateTo}
            min="2025-01"
            onChange={(e) => set({ dateTo: e.target.value })}
          />
        </div>

        {/* Category L1 */}
        <div className="form-control">
          <label className="label py-0"><span className="label-text text-xs opacity-60">Category</span></label>
          <select
            className="select select-sm select-bordered w-44"
            value={filters.catL1}
            onChange={(e) => set({ catL1: e.target.value, catL2: '', catL3: '' })}
          >
            <option value="">All categories</option>
            {options.l1s.map((l1) => (
              <option key={l1} value={l1}>{l1}</option>
            ))}
          </select>
        </div>

        {/* Category L2 */}
        {l2s.length > 0 && (
          <div className="form-control">
            <label className="label py-0"><span className="label-text text-xs opacity-60">Sub-category</span></label>
            <select
              className="select select-sm select-bordered w-40"
              value={filters.catL2}
              onChange={(e) => set({ catL2: e.target.value, catL3: '' })}
            >
              <option value="">All</option>
              {l2s.map((l2) => (
                <option key={l2} value={l2}>{l2}</option>
              ))}
            </select>
          </div>
        )}

        {/* Category L3 */}
        {l3s.length > 0 && (
          <div className="form-control">
            <label className="label py-0"><span className="label-text text-xs opacity-60">Type</span></label>
            <select
              className="select select-sm select-bordered w-36"
              value={filters.catL3}
              onChange={(e) => set({ catL3: e.target.value })}
            >
              <option value="">All</option>
              {l3s.map((l3) => (
                <option key={l3} value={l3}>{l3}</option>
              ))}
            </select>
          </div>
        )}

        {/* Product (template-level) typeahead */}
        <div className="form-control flex-1 min-w-[200px] max-w-xs">
          <label className="label py-0">
            <span className="label-text text-xs opacity-60">Product</span>
            {selectedProducts.length > 0 && (
              <span className="label-text-alt text-xs opacity-40">
                {selectedProducts.length} selected
              </span>
            )}
          </label>
          <ProductPicker
            selected={selectedProducts}
            onAdd={handleProductAdd}
            onRemove={handleProductRemove}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            catL1={filters.catL1}
            catL2={filters.catL2}
            catL3={filters.catL3}
          />
        </div>

        {/* Variant (SKU-level) typeahead */}
        <div className="form-control flex-1 min-w-[200px] max-w-xs">
          <label className="label py-0">
            <span className="label-text text-xs opacity-60">
              {scopedTmplId ? 'Variant (scoped)' : 'Variant / SKU'}
            </span>
            {filters.skus.length > 0 && (
              <span className="label-text-alt text-xs opacity-40">
                {filters.skus.length} selected
              </span>
            )}
          </label>
          <SkuPicker
            selected={filters.skus}
            onAdd={(sku) => set({ skus: [...filters.skus, sku] })}
            onRemove={(sku) => set({ skus: filters.skus.filter((s) => s !== sku) })}
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            catL1={filters.catL1}
            catL2={filters.catL2}
            catL3={filters.catL3}
            tmplId={scopedTmplId}
          />
        </div>

        {/* Reset */}
        {hasFilters && (
          <button className="btn btn-sm btn-ghost opacity-60 hover:opacity-100 self-end" onClick={reset}>
            ✕ Reset
          </button>
        )}
      </div>
    </div>
  )
}
