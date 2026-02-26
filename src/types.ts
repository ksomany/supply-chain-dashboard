// ─── Filter state ────────────────────────────────────────────────────────────

export interface Filters {
  dateFrom: string   // 'YYYY-MM'
  dateTo: string     // 'YYYY-MM'
  catL1: string
  catL2: string
  catL3: string
  search: string
  skus: string[]     // specific SKUs selected via typeahead
}

// ─── API response shapes ─────────────────────────────────────────────────────

export interface KPIs {
  total_lines: string
  total_ordered_value: string
  total_received_value: string
  total_invoiced_value: string
  pct_received: string
  pct_invoiced: string
  distinct_months: string
}

export interface MonthlyRow {
  month: string           // 'YYYY-MM'
  category_l1: string
  ordered_value_thb: string
  line_count: string
}

export interface CategoryRow {
  category: string
  total_value: string
  line_count: string
}

export interface UoMRow {
  uom: string
  line_count: string
  total_ordered_qty: string
  total_received_qty: string
  total_value_thb: string
  pct_received: string
}

export interface SkuSuggestion {
  sku: string
  product_name: string
}

export interface PriceTrendRow {
  date: string       // 'YYYY-MM-DD'
  price: string      // weighted avg unit price that day
  ma_30d: string     // 30-day rolling avg
  ma_3m: string      // 90-day rolling avg
}

export interface PoLine {
  month: string
  variant_id: number
  sku: string
  product_name_en: string
  category_path: string
  category_l1: string | null
  category_l2: string | null
  category_l3: string | null
  category_depth: number
  category_leaf: string | null
  ordered_qty_po_uom: string
  po_uom: string
  received_qty_po_uom: string
  invoiced_qty_po_uom: string
  ordered_value_thb: string
  avg_price_unit_thb: string
}

export interface LinesResponse {
  total: number
  page: number
  pageSize: number
  data: PoLine[]
}

export interface FilterOptions {
  months: string[]
  l1s: string[]
  hierarchy: Record<string, Record<string, string[]>>
}

// ─── Sort state ───────────────────────────────────────────────────────────────

export type SortKey =
  | 'month' | 'sku' | 'product_name_en' | 'category_l1' | 'category_l2'
  | 'ordered_qty' | 'received_qty' | 'ordered_value' | 'avg_price'

export type SortDir = 'asc' | 'desc'
