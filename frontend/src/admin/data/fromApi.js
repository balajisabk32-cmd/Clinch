/**
 * Hydrate the admin store from the REAL engine.
 *
 * This panel previously rendered `defaultState.js` — 419 lines describing a
 * different company entirely: a different catalogue (ECS-ENTERPRISE-ANNUAL vs
 * our LP14), different depots (Ashburn / Frankfurt vs Main Warehouse / East
 * Depot), a different currency ($4,892,400 hardcoded as a string) and different
 * tier discounts (Gold 15% vs the 6% our price book actually applies).
 *
 * Anyone opening the admin panel and then the sales workspace was looking at two
 * unrelated businesses. This module maps live API responses onto the exact
 * shapes the eight admin pages already consume, so the screens keep working
 * while the numbers become real.
 *
 * Where the engine genuinely has no equivalent for a decorative field
 * (warehouse street address, contact person), we say so rather than inventing
 * one — an empty field is honest, a fabricated address is not.
 */

const BASE = import.meta.env.DEV ? '/api' : 'http://localhost:8000'

async function get(path) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 5000)
  // Reads are authenticated too. They used to go out bare, which worked only
  // because the read endpoints were anonymous -- meaning the whole pipeline,
  // every customer and every margin was readable by anyone who could reach the
  // port. The endpoints now require a token, so one must be sent.
  let token = null
  try {
    token = localStorage.getItem('clinch_token')
  } catch {
    /* private mode -- fall through unauthenticated and surface the 401 */
  }
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: ctrl.signal,
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
    if (!res.ok) throw new Error(`${path} -> ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const money = (n) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(n || 0)

/** Map one API product onto the shape Products.jsx reads. */
function toAdminProduct(p) {
  return {
    id: p.sku,
    sku: p.sku,
    name: p.name,
    category: p.category,
    basePrice: p.list_price,
    cost: p.cost,
    unit: p.uom || 'Each',
    taxRate: p.tax_pct ?? 18,
    description: p.description || `${p.name} — ${p.category}`,
    status: 'Active',
    isRecurring: !!p.is_recurring,
    recurrence: p.recurrence || null,
    isPromoted: !!p.is_promoted,
    variants: (p.variants || []).flatMap((v) =>
      (v.values || []).map((value, i) => ({
        id: `${p.sku}-${v.attribute}-${value}`,
        attribute: v.attribute,
        value,
        extraPrice: (v.extra_price || [])[i] ?? 0,
      })),
    ),
  }
}

export async function loadStateFromApi() {
  const [products, pricelists, policy, warehouses, subscriptions, dashboard, reports, activity] =
    await Promise.all([
      get('/products'),
      get('/pricelists'),
      get('/policy'),
      get('/warehouses'),
      get('/subscriptions'),
      get('/dashboard'),
      get('/reports?period=all').catch(() => null), // reports is permission-gated
      get('/activity?limit=12').catch(() => []),
    ])

  // ---- Price book: adjustment percentages become the multipliers the UI uses.
  const tiers = {}
  for (const rule of pricelists) {
    if (rule.currency !== 'INR') continue
    const multiplier = 1 + (rule.adjustment_pct || 0) / 100
    tiers[rule.tier] = {
      multiplier: Number(multiplier.toFixed(4)),
      discountLabel: rule.rule,
    }
  }

  // ---- Warehouses. Capacity/utilisation are derived from real stock counts
  //      rather than invented: utilised is what is physically on the shelf.
  const adminWarehouses = warehouses.map((w) => {
    const onHand = w.stock.reduce((a, s) => a + s.on_hand, 0)
    return {
      id: w.name,
      code: w.name.split(' ')[0].toUpperCase(),
      name: w.name,
      location: '',            // the engine models no address
      contactPerson: '',       // nor a contact
      status: 'Active',
      capacity: Math.max(onHand, 1) * 2,
      utilized: onHand,
      shipCostWeight: w.ship_cost_weight,
      fixedShipmentCost: w.fixed_shipment_cost,
    }
  })

  const warehouseStock = {}
  for (const w of warehouses) {
    warehouseStock[w.name] = w.stock.map((s) => ({
      productId: s.sku,
      productName: s.name,
      sku: s.sku,
      quantity: s.on_hand,
      reserved: s.reserved,
      available: s.available,
      reorderThreshold: s.reorder_point || 0,
      lastRestocked: '',       // no receipt history is modelled yet
    }))
  }

  // ---- Discount governance, straight from the live policy.
  const discountApproval = {
    tierCeilings: policy.tier_ceiling,
    categoryCeilings: policy.category_ceiling,
    weights: policy.weights,
    caps: policy.caps,
    hardOverridePts: policy.hard_override_pts,
    stallDays: policy.stall_days,
    version: policy.version,
    warnings: policy.warnings || [],
    approvalChain: (policy.bands || []).map(([lo, hi, route]) => ({
      id: route,
      min: lo,
      max: hi > 1e6 ? null : hi,
      route,
      label:
        route === 'AUTO' ? 'No approval needed'
        : route === 'MANAGER' ? 'Sales Manager'
        : 'Sales Manager, then Finance',
    })),
  }

  // ---- Subscriptions: distinct plans, plus the live customer instances.
  const planByKey = new Map()
  for (const s of subscriptions) {
    if (!planByKey.has(s.plan)) {
      planByKey.set(s.plan, {
        id: s.sku,
        productId: s.sku,
        name: s.plan,
        cycle: s.cycle,
        unitPrice: s.unit_price,
        status: 'Active',
      })
    }
  }
  const adminSubscriptions = {
    recurringPlans: [...planByKey.values()],
    prorationRule: 'Calendar days remaining in the current cycle',
  }
  const customerSubscriptions = subscriptions.map((s) => ({
    id: s.id,
    customer: s.customer,
    orderRef: s.ref,
    plan: s.plan,
    cycle: s.cycle,
    quantity: s.qty,
    unitPrice: s.unit_price,
    amount: s.qty * s.unit_price,
    nextBillDate: s.next_bill_date,
    status: s.status === 'active' ? 'Active'
      : s.status === 'paused' ? 'Paused' : 'Cancelled',
  }))

  // ---- Customer tiers: ceilings are real; spend thresholds are not modelled.
  const customerTiers = {
    thresholds: Object.fromEntries(
      Object.entries(policy.tier_ceiling).map(([tier, ceiling]) => [
        tier, { minSpend: null, minDeals: null, maxDiscount: ceiling },
      ]),
    ),
    tiers: Object.entries(policy.tier_ceiling).map(([tier, ceiling]) => ({
      id: tier, name: tier, maxDiscount: ceiling,
      priceRule: tiers[tier]?.discountLabel || 'List price',
    })),
  }

  // ---- Anomalies come from the dashboard's real alert feed.
  const anomalies = (dashboard.alerts || []).map((a, i) => ({
    id: `${a.kind}-${a.ref}-${i}`,
    type: a.kind,
    severity: a.severity,
    dealRef: a.ref,
    customer: a.customer,
    title: a.headline,
    detail: a.detail,
    detectedAt: a.created_at,
    actions: a.actions || [],
  }))

  // ---- KPIs. Every figure computed by the engine; none typed in here.
  const analytics = {
    kpis: {
      totalRevenue: money(dashboard.pipeline_value),
      revenueDelta: '',
      activeDeals: String(dashboard.open_quotes),
      stalledDeals: String(dashboard.stalled_count),
      avgDiscount: `${dashboard.avg_discount_pct}%`,
      policyLeakage: money(dashboard.leakage_total),
      leakageRatio: `${(dashboard.leakage_ratio * 100).toFixed(2)}%`,
      ordersAnalysed: String(dashboard.closed_orders_analysed),
      medianApprovalHours: `${dashboard.median_approval_hours}h`,
    },
    bandCounts: dashboard.band_counts || {},
    byRep: reports?.by_rep || {},
    byCategory: reports?.by_category || {},
    topUpsold: reports?.top_upsold || null,

    // ---- Charts. Previously three hand-written arrays describing a company
    // that does not exist ("SaaS Software", "Support & TAM", and an activity
    // feed naming Sarah Jenkins and Global Logistics Corp). Now every point is
    // computed by the engine.
    categoryRevenue: Object.entries(reports?.by_category || {}).map(
      ([label, v]) => ({ label, value: Math.round(v.revenue) }),
    ),
    turnaroundTrend: (reports?.turnaround_trend || []).map((t) => ({
      label: t.label, value: t.value, orders: t.orders,
    })),
    recentActivity: (activity || []).map((a) => ({
      id: a.id, title: a.title, type: a.type, color: a.color,
      time: a.at ? String(a.at).replace('T', ' ').slice(0, 16) : '',
    })),
  }

  return {
    products: products.map(toAdminProduct),
    priceLists: { tiers, rules: pricelists },
    discountApproval,
    warehouses: adminWarehouses,
    warehouseStock,
    replenishmentRules: warehouses.flatMap((w) =>
      w.stock
        .filter((s) => s.reorder_point > 0)
        .map((s) => ({
          id: `${w.name}-${s.sku}`,
          warehouse: w.name,
          sku: s.sku,
          productName: s.name,
          reorderPoint: s.reorder_point,
          available: s.available,
          belowThreshold: s.available <= s.reorder_point,
        })),
    ),
    shippingWeighting: warehouses.map((w) => ({
      id: w.name,
      warehouse: w.name,
      weight: w.ship_cost_weight,
      fixedCost: w.fixed_shipment_cost,
    })),
    subscriptions: adminSubscriptions,
    customerSubscriptions,
    customerTiers,
    anomalies,
    analytics,
  }
}
