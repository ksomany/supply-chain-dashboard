const express = require('express')
const { Pool } = require('pg')
const cors = require('cors')
const path = require('path')
const session = require('express-session')
require('dotenv').config()

const app = express()
const PORT = process.env.PORT || 3001

const pool = new Pool({
  host:     process.env.PGHOST,
  port:     parseInt(process.env.PGPORT || '5432'),
  database: process.env.PGDATABASE,
  user:     process.env.PGUSER,
  password: process.env.PGPASSWORD,
})

pool.on('error', (err) => console.error('Unexpected DB error', err))

app.use(cors())
app.use(express.json())
app.set('trust proxy', 1)

app.use(session({
  secret: process.env.SESSION_SECRET || 'change-me-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 8 * 60 * 60 * 1000, // 8-hour sessions
  },
}))

// ─── Auth routes (no guard) ──────────────────────────────────────────────────

app.get('/login', (_req, res) =>
  res.sendFile(path.join(__dirname, 'login.html'))
)
app.use('/api/auth', express.urlencoded({ extended: false }))
app.post('/api/auth/login', (req, res) => {
  if (
    req.body.username === process.env.DASHBOARD_USER &&
    req.body.password === process.env.DASHBOARD_PASS
  ) {
    req.session.authenticated = true
    return req.session.save(() => res.redirect('/'))
  }
  res.redirect('/login?error=1')
})
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'))
})

// ─── Auth guard — protects all routes below ─────────────────────────────────

function requireAuth(req, res, next) {
  if (process.env.NODE_ENV !== 'production') return next()
  if (req.session?.authenticated) return next()
  if (req.originalUrl.startsWith('/api/')) return res.status(401).json({ error: 'Unauthorised' })
  res.redirect('/login')
}
app.use('/api/po', requireAuth)

// ─── SQL helpers ────────────────────────────────────────────────────────────

const BASE_JOINS = `
  FROM purchase_order_line pol
  JOIN purchase_order po     ON po.id = pol.order_id
  JOIN product_product pp    ON pp.id = pol.product_id
  JOIN product_template pt   ON pt.id = pp.product_tmpl_id
  LEFT JOIN product_category pc  ON pc.id = pt.categ_id
  LEFT JOIN uom_uom uom_pol      ON uom_pol.id = pol.product_uom
`

/**
 * Build a parameterised WHERE clause from query-string filters.
 * Returns { where: string, params: any[] }
 */
function buildWhere(query) {
  const params = []
  const conds = ["po.state IN ('purchase','done')"]

  // Date from (default: start of 2025)
  const rawFrom = query.dateFrom || '2025-01'
  params.push(rawFrom + '-01')
  conds.push(`po.date_order >= $${params.length}::date`)

  // Date to (inclusive month)
  if (query.dateTo) {
    const [y, m] = query.dateTo.split('-').map(Number)
    const nextMonth =
      m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
    params.push(nextMonth)
    conds.push(`po.date_order < $${params.length}::date`)
  } else {
    conds.push("po.date_order < '2099-01-01'")
  }

  // Category levels (exact match)
  if (query.catL1) {
    params.push(query.catL1)
    conds.push(`NULLIF(split_part(pc.complete_name,' / ',1),'') = $${params.length}`)
  }
  if (query.catL2) {
    params.push(query.catL2)
    conds.push(`NULLIF(split_part(pc.complete_name,' / ',2),'') = $${params.length}`)
  }
  if (query.catL3) {
    params.push(query.catL3)
    conds.push(`NULLIF(split_part(pc.complete_name,' / ',3),'') = $${params.length}`)
  }

  // Free-text search (SKU prefix or product name)
  if (query.search) {
    params.push(`%${query.search}%`)
    const n = params.length
    conds.push(`(COALESCE(pp.default_code,pt.default_code) ILIKE $${n} OR pt.name->>'en_US' ILIKE $${n})`)
  }

  // Specific SKUs selected via typeahead (comma-separated)
  if (query.skus) {
    const skuList = query.skus.split(',').map((s) => s.trim()).filter(Boolean)
    if (skuList.length > 0) {
      const placeholders = skuList.map((_, i) => `$${params.length + 1 + i}`).join(', ')
      params.push(...skuList)
      conds.push(`COALESCE(pp.default_code,pt.default_code) IN (${placeholders})`)
    }
  }

  // Template-level filter (productTmplIds comma-separated integers)
  if (query.productTmplIds) {
    const ids = query.productTmplIds
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
    if (ids.length > 0) {
      const placeholders = ids.map((_, i) => `$${params.length + 1 + i}`).join(', ')
      params.push(...ids)
      conds.push(`pp.product_tmpl_id IN (${placeholders})`)
    }
  }

  return { where: conds.join(' AND '), params }
}

// ─── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/po/kpis
 * Summary KPI numbers, respect all filters.
 */
app.get('/api/po/kpis', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query)
    const sql = `
      SELECT
        COUNT(*)                                                           AS total_lines,
        COALESCE(SUM(pol.product_qty * pol.price_unit), 0)                AS total_ordered_value,
        COALESCE(SUM(pol.product_qty), 0)                                 AS total_ordered_qty,
        COALESCE(SUM(pol.qty_received * pol.price_unit), 0)               AS total_received_value,
        COALESCE(SUM(pol.qty_invoiced * pol.price_unit), 0)               AS total_invoiced_value,
        ROUND(
          100.0 * COALESCE(SUM(pol.qty_received * pol.price_unit), 0)
                / NULLIF(SUM(pol.product_qty * pol.price_unit), 0), 1
        )                                                                  AS pct_received,
        ROUND(
          100.0 * COALESCE(SUM(pol.qty_invoiced * pol.price_unit), 0)
                / NULLIF(SUM(pol.product_qty * pol.price_unit), 0), 1
        )                                                                  AS pct_invoiced,
        COUNT(DISTINCT TO_CHAR(date_trunc('month', po.date_order),'YYYY-MM')) AS distinct_months
      ${BASE_JOINS}
      WHERE ${where}
    `
    const { rows } = await pool.query(sql, params)
    res.json(rows[0])
  } catch (err) {
    console.error('/api/po/kpis', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/po/monthly
 * Ordered value by month × category_l1 for the stacked bar chart.
 */
app.get('/api/po/monthly', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query)
    const sql = `
      SELECT
        TO_CHAR(date_trunc('month', po.date_order),'YYYY-MM')                     AS month,
        COALESCE(NULLIF(split_part(pc.complete_name,' / ',1),''), 'Uncategorized') AS category_l1,
        SUM(pol.product_qty * pol.price_unit)                                      AS ordered_value_thb,
        COUNT(*)                                                                    AS line_count
      ${BASE_JOINS}
      WHERE ${where}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `
    const { rows } = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('/api/po/monthly', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/po/by-category
 * Value breakdown; drills L1 → L2 → L3 based on filters applied.
 */
app.get('/api/po/by-category', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query)
    const level = req.query.catL2 ? 3 : req.query.catL1 ? 2 : 1
    const catExpr = `COALESCE(NULLIF(split_part(pc.complete_name,' / ',${level}),''),'Uncategorized')`
    const sql = `
      SELECT
        ${catExpr}                            AS category,
        SUM(pol.product_qty * pol.price_unit) AS total_value,
        COUNT(*)                              AS line_count
      ${BASE_JOINS}
      WHERE ${where}
      GROUP BY 1
      ORDER BY total_value DESC
    `
    const { rows } = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('/api/po/by-category', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/po/lines
 * Paginated, sortable PO rollup table (mirrors the user's original query).
 * Query params: dateFrom, dateTo, catL1, catL2, catL3, search,
 *               page (1-based), pageSize, sortBy, sortDir
 */
app.get('/api/po/lines', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query)
    const page     = Math.max(1, parseInt(req.query.page     || '1'))
    const pageSize = Math.min(200, Math.max(10, parseInt(req.query.pageSize || '50')))
    const offset   = (page - 1) * pageSize

    const SORTABLE = {
      month:              'month',
      sku:                'sku',
      product_name_en:    'product_name_en',
      category_l1:        'category_l1',
      category_l2:        'category_l2',
      category_l3:        'category_l3',
      ordered_qty:        'ordered_qty_po_uom',
      received_qty:       'received_qty_po_uom',
      invoiced_qty:       'invoiced_qty_po_uom',
      ordered_value:      'ordered_value_thb',
      avg_price:          'avg_price_unit_thb',
    }
    const sortCol = SORTABLE[req.query.sortBy] || 'month'
    const sortDir = req.query.sortDir === 'asc' ? 'ASC' : 'DESC'

    // Count query (grouped rows, not raw lines)
    const countSql = `
      SELECT COUNT(*) AS total
      FROM (
        SELECT pp.id, uom_pol.id AS uom_id, date_trunc('month', po.date_order)
        ${BASE_JOINS}
        WHERE ${where}
        GROUP BY pp.id, uom_pol.id, date_trunc('month', po.date_order)
      ) AS g
    `

    // Data query
    const dataSql = `
      WITH po_lines AS (
        SELECT
          TO_CHAR(date_trunc('month', po.date_order),'YYYY-MM')                AS month,
          pp.id                                                                  AS variant_id,
          COALESCE(pp.default_code, pt.default_code)                            AS sku,
          pt.name->>'en_US'                                                      AS product_name_en,
          pc.complete_name                                                       AS category_path,
          NULLIF(split_part(pc.complete_name,' / ',1),'')                       AS category_l1,
          NULLIF(split_part(pc.complete_name,' / ',2),'')                       AS category_l2,
          NULLIF(split_part(pc.complete_name,' / ',3),'')                       AS category_l3,
          array_length(string_to_array(pc.complete_name,' / '),1)               AS category_depth,
          (string_to_array(pc.complete_name,' / '))[
            array_length(string_to_array(pc.complete_name,' / '),1)
          ]                                                                      AS category_leaf,
          pol.product_qty                                                        AS ordered_qty_po_uom,
          uom_pol.name->>'en_US'                                                 AS po_uom,
          pol.qty_received                                                       AS received_qty_po_uom,
          pol.qty_invoiced                                                       AS invoiced_qty_po_uom,
          (pol.product_qty * pol.price_unit)                                     AS ordered_value_thb,
          pol.price_unit                                                         AS price_unit_thb
        ${BASE_JOINS}
        WHERE ${where}
      )
      SELECT
        month, variant_id, sku, product_name_en,
        category_path, category_l1, category_l2, category_l3, category_depth, category_leaf,
        SUM(ordered_qty_po_uom)   AS ordered_qty_po_uom,
        po_uom,
        SUM(received_qty_po_uom)  AS received_qty_po_uom,
        SUM(invoiced_qty_po_uom)  AS invoiced_qty_po_uom,
        SUM(ordered_value_thb)    AS ordered_value_thb,
        AVG(price_unit_thb)       AS avg_price_unit_thb
      FROM po_lines
      GROUP BY
        month, variant_id, sku, product_name_en,
        category_path, category_l1, category_l2, category_l3, category_depth, category_leaf, po_uom
      ORDER BY ${sortCol} ${sortDir}, sku ${sortDir === 'DESC' ? 'ASC' : 'DESC'}
      LIMIT ${pageSize} OFFSET ${offset}
    `

    const [countResult, dataResult] = await Promise.all([
      pool.query(countSql, params),
      pool.query(dataSql, params),
    ])

    res.json({
      total:    parseInt(countResult.rows[0].total),
      page,
      pageSize,
      data:     dataResult.rows,
    })
  } catch (err) {
    console.error('/api/po/lines', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/po/filters
 * Distinct months + category hierarchy for populating dropdowns.
 */
app.get('/api/po/filters', async (req, res) => {
  try {
    const [monthsRes, catsRes] = await Promise.all([
      pool.query(`
        SELECT DISTINCT TO_CHAR(date_trunc('month', po.date_order),'YYYY-MM') AS month
        FROM purchase_order po
        WHERE po.state IN ('purchase','done')
          AND po.date_order >= '2025-01-01'
          AND po.date_order < '2099-01-01'
        ORDER BY month
      `),
      pool.query(`
        SELECT DISTINCT
          NULLIF(split_part(pc.complete_name,' / ',1),'') AS l1,
          NULLIF(split_part(pc.complete_name,' / ',2),'') AS l2,
          NULLIF(split_part(pc.complete_name,' / ',3),'') AS l3
        FROM product_category pc
        WHERE pc.id IN (
          SELECT DISTINCT pt.categ_id
          FROM purchase_order_line pol
          JOIN purchase_order po ON po.id = pol.order_id
          JOIN product_product pp ON pp.id = pol.product_id
          JOIN product_template pt ON pt.id = pp.product_tmpl_id
          WHERE po.state IN ('purchase','done')
            AND po.date_order >= '2025-01-01'
            AND po.date_order < '2099-01-01'
        )
        ORDER BY 1, 2, 3
      `),
    ])

    const months = monthsRes.rows.map((r) => r.month)
    const l1s = [...new Set(catsRes.rows.map((r) => r.l1).filter(Boolean))].sort()
    const hierarchy = {}
    for (const row of catsRes.rows) {
      if (!row.l1) continue
      if (!hierarchy[row.l1]) hierarchy[row.l1] = {}
      if (row.l2) {
        if (!hierarchy[row.l1][row.l2]) hierarchy[row.l1][row.l2] = []
        if (row.l3) hierarchy[row.l1][row.l2].push(row.l3)
      }
    }

    res.json({ months, l1s, hierarchy })
  } catch (err) {
    console.error('/api/po/filters', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/po/price-trend
 * Daily weighted-average unit price (THB/unit) with 30-day and 90-day rolling averages.
 * Weighted avg = SUM(qty * price) / SUM(qty) per day — most meaningful when
 * filters narrow to a single category / UoM / SKU.
 */
app.get('/api/po/price-trend', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query)
    const sql = `
      WITH daily AS (
        SELECT
          po.date_order::date                               AS order_date,
          SUM(pol.product_qty * pol.price_unit)            AS total_value,
          SUM(pol.product_qty)                             AS total_qty
        ${BASE_JOINS}
        WHERE ${where}
          AND pol.product_qty > 0
        GROUP BY po.date_order::date
        HAVING SUM(pol.product_qty) > 0
      )
      SELECT
        TO_CHAR(order_date, 'YYYY-MM-DD')                  AS date,
        ROUND((total_value / total_qty)::numeric, 4)       AS price,
        ROUND(AVG(total_value / total_qty) OVER (
          ORDER BY order_date
          RANGE BETWEEN '30 days' PRECEDING AND CURRENT ROW
        )::numeric, 4)                                     AS ma_30d,
        ROUND(AVG(total_value / total_qty) OVER (
          ORDER BY order_date
          RANGE BETWEEN '90 days' PRECEDING AND CURRENT ROW
        )::numeric, 4)                                     AS ma_3m
      FROM daily
      ORDER BY order_date
    `
    const { rows } = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('/api/po/price-trend', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/po/price-by-quarter
 * Weighted-average unit price grouped by year and quarter.
 * Returns one row per (year, quarter) combination so the frontend can
 * draw one line per year across Q1–Q4.
 */
app.get('/api/po/price-by-quarter', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query)
    const sql = `
      SELECT
        EXTRACT(YEAR    FROM po.date_order)::int  AS year,
        EXTRACT(QUARTER FROM po.date_order)::int  AS quarter,
        ROUND(
          (SUM(pol.product_qty * pol.price_unit) /
           NULLIF(SUM(pol.product_qty), 0))::numeric, 4
        ) AS price
      ${BASE_JOINS}
      WHERE ${where}
        AND pol.product_qty > 0
      GROUP BY 1, 2
      ORDER BY 1, 2
    `
    const { rows } = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('/api/po/price-by-quarter', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/po/products?q=xxx
 * Typeahead: up to 20 product templates matching the query string.
 * Respects date and category filters for context-aware results.
 */
app.get('/api/po/products', async (req, res) => {
  try {
    const q = (req.query.q || '').trim()
    if (q.length < 1) return res.json([])
    const { where, params } = buildWhere(req.query)
    const likeIdx = params.length + 1
    params.push(`%${q}%`)
    const sql = `
      SELECT DISTINCT
        pt.id                           AS tmpl_id,
        TRIM(pt.name->>'en_US')         AS product_name,
        pt.default_code                 AS template_sku
      ${BASE_JOINS}
      WHERE ${where}
        AND (
          TRIM(pt.name->>'en_US') ILIKE $${likeIdx}
          OR pt.default_code ILIKE $${likeIdx}
        )
      ORDER BY product_name
      LIMIT 20
    `
    const { rows } = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('/api/po/products', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/po/skus?q=xxx[&tmplId=n]
 * Typeahead: up to 20 variant SKUs matching the query string.
 * When tmplId is provided, results are scoped to that product template's variants.
 */
app.get('/api/po/skus', async (req, res) => {
  try {
    const q = (req.query.q || '').trim()
    if (q.length < 1) return res.json([])
    const { where, params } = buildWhere(req.query)

    // Optional: scope to variants of a specific template (used by the variant picker
    // when exactly one product template is selected in the product picker)
    let tmplCond = ''
    if (req.query.tmplId) {
      const id = parseInt(req.query.tmplId, 10)
      if (Number.isFinite(id) && id > 0) {
        params.push(id)
        tmplCond = `AND pp.product_tmpl_id = $${params.length}`
      }
    }

    const likeIdx = params.length + 1
    params.push(`%${q}%`)
    const sql = `
      SELECT DISTINCT
        COALESCE(pp.default_code, pt.default_code)  AS sku,
        TRIM(pt.name->>'en_US')                      AS product_name
      ${BASE_JOINS}
      WHERE ${where}
        ${tmplCond}
        AND (
          COALESCE(pp.default_code, pt.default_code) ILIKE $${likeIdx}
          OR TRIM(pt.name->>'en_US') ILIKE $${likeIdx}
        )
      ORDER BY sku
      LIMIT 20
    `
    const { rows } = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('/api/po/skus', err.message)
    res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/po/by-uom
 * Ordered qty, received qty, value and receipt rate grouped by UoM.
 * Respects all standard filters.
 */
app.get('/api/po/by-uom', async (req, res) => {
  try {
    const { where, params } = buildWhere(req.query)
    const sql = `
      SELECT
        COALESCE(uom_pol.name->>'en_US', 'Unknown')   AS uom,
        COUNT(*)                                        AS line_count,
        SUM(pol.product_qty)                           AS total_ordered_qty,
        SUM(pol.qty_received)                          AS total_received_qty,
        SUM(pol.product_qty * pol.price_unit)          AS total_value_thb,
        ROUND(
          100.0 * SUM(pol.qty_received)
                / NULLIF(SUM(pol.product_qty), 0), 1
        )                                              AS pct_received
      ${BASE_JOINS}
      WHERE ${where}
        AND uom_pol.name IS NOT NULL
      GROUP BY uom_pol.name->>'en_US'
      ORDER BY total_value_thb DESC
    `
    const { rows } = await pool.query(sql, params)
    res.json(rows)
  } catch (err) {
    console.error('/api/po/by-uom', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ─── Serve built frontend in production ─────────────────────────────────────

if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist')
  app.use(express.static(distPath, { index: false }))
  app.get('*', requireAuth, (_req, res) => res.sendFile(path.join(distPath, 'index.html')))
}

// ─── Start ───────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n  API server → http://localhost:${PORT}\n`)
})
