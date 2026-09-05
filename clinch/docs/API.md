# Clinch Reporting & Dashboard Data Backend — API Reference

Owner: **Prabanjan** (Reporting/Dashboard Data Backend + Seed Data)

Base URL (local dev): `http://localhost:4000`

This service aggregates deal data and exposes it as clean JSON for Balaji's
Deal Health Dashboard UI. It does **not** compute risk scores, run approval
routing, or decide warehouse allocation — it reads those fields once they
exist and reports on them. See [ARCHITECTURE.md](./ARCHITECTURE.md) for how
this fits with the other three modules.

---

## Reporting Endpoints

### `GET /api/reports/deal-health-summary`
High-level counts for the dashboard's summary tiles.

```json
{
  "totalDeals": 16,
  "healthyDeals": 11,
  "atRiskDeals": 2,
  "stalledDeals": 2,
  "closedLostDeals": 1,
  "averageDiscount": 12.4,
  "openPipelineValue": 10013370,
  "currency": "INR",
  "generatedAt": "2026-09-05T05:08:07.303Z"
}
```

### `GET /api/reports/stalled-deals`
Deals with no activity for 5+ days that are still open.

```json
[
  {
    "dealId": "DEMO-DEAL-015",
    "customerName": "Global Retail",
    "salesRep": "Priya",
    "value": 354900,
    "daysStalled": 12,
    "status": "STALLED"
  }
]
```

### `GET /api/reports/at-risk-deals`
Open/pending deals already flagged `HIGH` or `MEDIUM` risk by Balaji's
scoring engine (`riskScore` / `riskLevel` are read as-is, never computed here).

```json
[
  {
    "dealId": "DEMO-DEAL-002",
    "customerName": "ABC Industries",
    "salesRep": "Rahul",
    "discount": 25,
    "riskScore": 82,
    "riskLevel": "HIGH",
    "riskExplanation": "Discount is significantly above the sales representative's historical average.",
    "approvalStage": "SALES_MANAGER",
    "status": "AT_RISK"
  }
]
```

### `GET /api/reports/sales-rep-discount-history`
Per-rep historical + current discount data — this is the primary feed for
Balaji's risk-scoring engine's "compare against rep's own average" input.

```json
[
  {
    "salesRepId": "DEMO-REP-001",
    "salesRepName": "Rahul",
    "totalDeals": 8,
    "averageDiscount": 10.6,
    "highestDiscount": 25,
    "discountHistory": [5, 7, 8, 10, 9, 25, 15, 6]
  }
]
```

### `GET /api/reports/deal-status-distribution`
Counts grouped two ways: by raw workflow `stage`, and by dashboard
`healthCategory`.

```json
{
  "byStage": [
    { "stage": "OPEN", "count": 9 },
    { "stage": "PENDING_APPROVAL", "count": 3 },
    { "stage": "FULFILLED", "count": 2 },
    { "stage": "SUBSCRIBED", "count": 1 },
    { "stage": "REJECTED", "count": 1 }
  ],
  "byHealthCategory": [
    { "healthCategory": "HEALTHY", "count": 11 },
    { "healthCategory": "AT_RISK", "count": 2 },
    { "healthCategory": "STALLED", "count": 2 },
    { "healthCategory": "CLOSED_LOST", "count": 1 }
  ],
  "totalDeals": 16
}
```

### `GET /api/reports/dashboard`
Everything above in one response, so the dashboard UI can render from a
single fetch:

```json
{
  "summary": { "...": "see deal-health-summary" },
  "atRiskDeals": ["..."],
  "stalledDeals": ["..."],
  "salesRepDiscountHistory": ["..."],
  "statusDistribution": { "...": "see deal-status-distribution" },
  "generatedAt": "2026-09-05T05:08:07.303Z"
}
```

---

## Seed Data Passthrough Endpoints

Convenience read-only endpoints over the same demo dataset, for teammates
who don't yet have their own database wired up. Not business-logic APIs.

| Method | Path | Returns |
|---|---|---|
| GET | `/api/customers` | All demo customers |
| GET | `/api/sales-reps` | All demo sales reps + historical discounts |
| GET | `/api/products` | Product catalog |
| GET | `/api/warehouses` | Warehouse list |
| GET | `/api/deals` | All deals, enriched with `customerName`, `salesRepName`, `healthCategory` |
| GET | `/api/deals/:id` | A single enriched deal, 404 if not found |

## Admin

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/reset-seed` | Reloads seed JSON from disk and re-resolves relative dates ("N days ago") against current time |

---

## How `healthCategory` is derived

This is the only categorization logic Prabanjan's service applies (see
`src/services/reportingService.js::classifyHealth`):

1. `REJECTED` / `CLOSED_LOST` stage → **CLOSED_LOST**
2. Open or pending-approval deal, inactive ≥ 5 days → **STALLED**
3. Open or pending-approval deal with `riskLevel` of `HIGH` or `MEDIUM` → **AT_RISK**
4. Everything else (including `APPROVED` / `FULFILLED` / `SUBSCRIBED`) → **HEALTHY**

`riskLevel` itself is never invented here — it's `null` until Balaji's
`/score-quote` engine (or equivalent) writes a value onto the deal record.

## Data model quick reference

A deal object looks like:

```json
{
  "id": "DEMO-DEAL-002",
  "customerId": "DEMO-CUST-001",
  "salesRepId": "DEMO-REP-001",
  "products": [{ "productId": "DEMO-PROD-001", "name": "Server", "qty": 5, "unitPrice": 250000 }],
  "currency": "INR",
  "grossValue": 1250000,
  "discountPercent": 25,
  "value": 937500,
  "stage": "PENDING_APPROVAL",
  "approvalStage": "SALES_MANAGER",
  "riskScore": 82,
  "riskLevel": "HIGH",
  "riskExplanation": "...",
  "upsellOpportunity": false,
  "suggestedUpsellProducts": [],
  "warehouseSplit": [{ "warehouseId": "DEMO-WH-001", "name": "Warehouse A", "unitsAllocated": 60 }],
  "subscription": { "planName": "...", "billingCycle": "MONTHLY" },
  "scenarioTags": ["high-discount", "at-risk", "approval-required"]
}
```

`stage` values: `OPEN`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED`,
`FULFILLED`, `SUBSCRIBED`. `approvalStage` values: `NONE`,
`SALES_MANAGER`, `FINANCE`, `APPROVED`, `REJECTED`.

## Running locally

```bash
npm install
npm start          # starts on http://localhost:4000
npm run smoke-test # starts the server, hits every endpoint, checks 200s
```
