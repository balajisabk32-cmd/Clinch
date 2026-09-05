/**
 * API client.
 *
 * Every figure this app displays comes from the running engine. Where a number
 * appears on the marketing surface it is fetched, not typed — that is the whole
 * point of the pitch ("the leakage number is computed, here's the query"), and
 * hardcoding it into the landing page would quietly make that claim false.
 */

import { request as authedRequest } from './authClient'


export type Band = 'AUTO' | 'MANAGER' | 'FINANCE'

export interface DashboardData {
  pipeline_value: number
  open_quotes: number
  stalled_count: number
  stalled_value: number
  avg_discount_pct: number
  leakage_total: number
  leakage_ratio: number
  closed_orders_analysed: number
  median_approval_hours: number
  band_counts: Record<Band, number>
  alerts: Array<{
    kind: string; severity: string; ref: string; customer: string
    headline: string; detail: string; created_at: string; actions: string[]
  }>
}

export interface ScoreLine {
  sku: string; name: string; category: string; qty: number
  given: number; allowed: number; over: number; leaked: number
  revenue_weight: number; ok: boolean
}

export interface ScoreData {
  ref: string; score: number; band: Band
  terms: Record<string, number>
  weights_used: Record<string, number>
  contributions: Record<string, number>
  lines: ScoreLine[]
  leaked_total: number; order_revenue: number; order_margin: number
  notes: string[]; narrative: string; narrative_source: string
}

export interface SimulateData {
  quotes_evaluated: number; quotes_changed: number
  escalated: number; relaxed: number
  leakage_before: number; leakage_after: number; leakage_recovered: number
  band_counts_before: Record<Band, number>
  band_counts_after: Record<Band, number>
  headline: string; elapsed_ms: number
  impacts: Array<{
    ref: string; customer: string; total: number
    score_before: number; score_after: number
    band_before: Band; band_after: Band
    leaked_before: number; leaked_after: number
    changed: boolean; direction: 'escalated' | 'relaxed' | 'unchanged'
  }>
}

export interface StatusData {
  real: number; stub: number; total: number; percent_real: number
  endpoints: Array<{ method: string; path: string; owner: string; impl: 'real' | 'stub'; note: string }>
}

/**
 * All application requests go through the authenticated client, so the bearer
 * token is attached in exactly one place and a 401 tears the session down in
 * exactly one place. Two request paths would mean two ways to be signed out.
 */
async function req<T>(path: string, init?: RequestInit): Promise<T> {
  return authedRequest<T>(path, init ?? {})
}

export interface QuoteLine {
  id: number; sku: string; name: string; category: string; qty: number
  list_price: number; discount_pct: number; effective_discount: number
  net: number; is_recurring: boolean
  cost: number; margin: number; ceiling: number; over: number
}

export interface QuoteDetail {
  ref: string; customer: string; tier: string; rep: string; state: string
  total: number; subtotal: number; discount_total: number; tax_total: number
  total_recurring: number; margin_pct: number
  risk_score: number; risk_band: Band
  order_discount_pct: number
  narrative: string
  contributions: Record<string, number>
  notes: string[]
  allowed_transitions: string[]
  lines: QuoteLine[]
  last_activity_at: string; days_inactive: number; is_stalled: boolean
}

export interface Product {
  sku: string; name: string; category: string
  list_price: number; cost: number
  is_recurring?: boolean; is_promoted?: boolean; stock_total?: number
}

export interface Suggestion {
  sku: string; name: string; category: string; list_price: number
  support: number; confidence: number; lift: number
  margin_delta: number; margin_pct: number; is_promoted: boolean; reason: string
}

export interface Coach {
  available: boolean; sku?: string; name?: string; line_index?: number
  current_discount?: number; target_discount?: number; ceiling?: number
  points_sacrificed?: number; revenue_recovered?: number
  fully_compliant_after?: boolean; from_band?: string; to_band?: string
  score_before?: number; score_after?: number; message?: string
}

export interface StockRow {
  sku: string; name: string
  on_hand: number; reserved: number; available: number; reorder_point: number
}
export interface Warehouse {
  name: string; ship_cost_weight: number; fixed_shipment_cost: number
  stock: StockRow[]
}
export interface QueueRow {
  ref: string; customer: string; state: string; status: string
  warehouses: string[]; warehouse_label: string
  units: number; backordered: number; shipment_count: number
  total_cost: number; allocated: boolean
}

export const api = {
  dashboard: () => req<DashboardData>('/dashboard'),
  status: () => req<StatusData>('/_status'),
  score: (ref: string) => req<ScoreData>(`/quotes/${ref}/score`, { method: 'POST' }),
  quotes: () => req<any[]>('/quotes'),
  quote: (ref: string) => req<QuoteDetail>(`/quotes/${ref}`),
  products: () => req<Product[]>('/products'),
  product: (sku: string) => req<any>(`/products/${sku}`),
  createProduct: (body: Record<string, unknown>) =>
    req<any>('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (sku: string, body: Record<string, unknown>) =>
    req<any>(`/products/${sku}`, { method: 'PATCH', body: JSON.stringify(body) }),
  pricelists: () => req<any[]>('/pricelists'),
  reports: (query = '') => req<any>(`/reports${query ? `?${query}` : ''}`),

  // Builder mutations. Each returns the FULLY recomputed quotation, so the cart,
  // margin bar, risk band and upsell ranking can never drift apart.
  createQuote: (customer: string, rep = 'rep_rao') =>
    req<QuoteDetail>('/quotes', { method: 'POST', body: JSON.stringify({ customer, rep }) }),
  addLine: (ref: string, sku: string, qty = 1, discount_pct = 0) =>
    req<QuoteDetail>(`/quotes/${ref}/lines`, {
      method: 'POST', body: JSON.stringify({ sku, qty, discount_pct }),
    }),
  patchLine: (ref: string, idx: number, patch: { qty?: number; discount_pct?: number }) =>
    req<QuoteDetail>(`/quotes/${ref}/lines/${idx}`, {
      method: 'PATCH', body: JSON.stringify(patch),
    }),
  deleteLine: (ref: string, idx: number) =>
    req<QuoteDetail>(`/quotes/${ref}/lines/${idx}`, { method: 'DELETE' }),
  setOrderDiscount: (ref: string, order_discount_pct: number) =>
    req<QuoteDetail>(`/quotes/${ref}`, {
      method: 'PATCH', body: JSON.stringify({ order_discount_pct }),
    }),
  submit: (ref: string) => req<any>(`/quotes/${ref}/submit`, { method: 'POST' }),
  policy: () => req<any>('/policy'),
  applyPolicy: (body: Record<string, unknown>) =>
    req<any>('/policy', { method: 'PUT', body: JSON.stringify(body) }),
  simulate: (body: Record<string, unknown>) =>
    req<SimulateData>('/policy/simulate', { method: 'POST', body: JSON.stringify(body) }),
  coach: (ref: string) => req<Coach>(`/quotes/${ref}/coach`, { method: 'POST' }),
  recommend: (ref: string) =>
    req<{ ref: string; suggestions: Suggestion[]; basis: string; filtered_by_margin_floor: number }>(
      `/quotes/${ref}/recommend`, { method: 'POST' }),
  split: (ref: string, objective: string) =>
    req<any>(`/orders/${ref}/split?objective=${objective}`, { method: 'POST' }),
  warehouses: () => req<Warehouse[]>('/warehouses'),
  fulfilmentQueue: () => req<QueueRow[]>('/fulfilment/queue'),
  allocate: (ref: string, body: Record<string, unknown>) =>
    req<any>(`/orders/${ref}/allocate`, { method: 'POST', body: JSON.stringify(body) }),
  consolidate: (ref: string) =>
    req<any>(`/orders/${ref}/consolidate`, { method: 'POST' }),
  confirmOrder: (ref: string) =>
    req<any>(`/orders/${ref}/confirm`, { method: 'POST', body: '{}' }),
  invoices: () => req<any[]>('/invoices'),
  payInvoice: (ref: string, body: Record<string, unknown>) =>
    req<any>(`/invoices/${ref}/payment`, { method: 'POST', body: JSON.stringify(body) }),
  subscriptions: () => req<any[]>('/subscriptions'),
  changeSubscription: (id: number, body: Record<string, unknown>) =>
    req<any>(`/subscriptions/${id}/change`, { method: 'POST', body: JSON.stringify(body) }),
  orderBilling: (ref: string) => req<any>(`/orders/${ref}/billing`),
  portal: (token: string) => req<any>(`/portal/${token}`),
  portalRequest: (token: string, body: Record<string, unknown>) =>
    req<any>(`/portal/${token}/request`, { method: 'POST', body: JSON.stringify(body) }),
  // Deal Health reads the SAME engine as everything else. There is deliberately
  // no fabricated fallback here: this dashboard's entire claim is that its
  // figures are computed rather than asserted, so silently substituting invented
  // numbers when the API is unreachable would make the pitch a lie. A failure
  // propagates and the screen says the engine is unreachable.
  dealHealthDashboard: () => req<DealHealthDashboardData>('/deal-health/dashboard'),
  dealHealthDeals: () => req<EnrichedDeal[]>('/deal-health/deals'),
}

export interface DealHealthSummary {
  totalDeals: number
  healthyDeals: number
  atRiskDeals: number
  stalledDeals: number
  closedLostDeals: number
  averageDiscount: number
  openPipelineValue: number
  currency: string
  generatedAt: string
}

export interface AtRiskDeal {
  dealId: string
  customerName: string
  salesRep: string
  discount: number
  riskScore: number | null
  riskLevel: string | null
  riskExplanation: string | null
  approvalStage: string
  status: string
}

export interface StalledDeal {
  dealId: string
  customerName: string
  salesRep: string
  value: number
  daysStalled: number
  status: string
}

export interface SalesRepDiscountHistory {
  salesRepId: string
  salesRepName: string
  totalDeals: number
  averageDiscount: number
  highestDiscount: number
  discountHistory: number[]
}

export interface DealStatusDistribution {
  byStage: Array<{ stage: string; count: number }>
  byHealthCategory: Array<{ healthCategory: string; count: number }>
  totalDeals: number
}

export interface DealHealthDashboardData {
  summary: DealHealthSummary
  atRiskDeals: AtRiskDeal[]
  stalledDeals: StalledDeal[]
  salesRepDiscountHistory: SalesRepDiscountHistory[]
  statusDistribution: DealStatusDistribution
  generatedAt: string
}

export interface DealProduct {
  productId: string
  name: string
  qty: number
  unitPrice: number
}

export interface WarehouseAllocation {
  warehouseId: string
  name: string
  unitsAllocated: number
}

export interface DealSubscription {
  planName: string
  billingCycle: string
  seats?: number
  prorationNote?: string
  [key: string]: unknown
}

export interface EnrichedDeal {
  id: string
  customerId: string
  customerName: string
  salesRepId: string
  salesRepName: string
  products: DealProduct[]
  currency: string
  grossValue: number
  discountPercent: number
  value: number
  stage: string
  approvalStage: string
  riskScore: number | null
  riskLevel: string | null
  riskExplanation: string | null
  createdDaysAgo?: number
  lastActivityDaysAgo?: number
  createdAt?: string
  lastActivityAt?: string
  daysSinceLastActivity: number
  healthCategory: 'HEALTHY' | 'AT_RISK' | 'STALLED' | 'CLOSED_LOST'
  upsellOpportunity?: boolean
  suggestedUpsellProducts?: Array<{ productId: string; name: string }>
  scenarioTags?: string[]
  warehouseSplit?: WarehouseAllocation[]
  subscription?: DealSubscription
}

export const inr = (n: number, opts: Intl.NumberFormatOptions = {}) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0, ...opts }).format(n)

export const num = (n: number, d = 0) =>
  new Intl.NumberFormat('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n)
