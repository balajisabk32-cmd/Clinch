# Clinch — Demo Script

Two scenarios: a **primary high-risk flow** (the main show) and a
**secondary stalled-deal flow** (proves the dashboard handles multiple
statuses, not just the happy path).

All demo entities are pre-seeded with `DEMO-` prefixed IDs — see
`src/data/*.json`. Nothing in this script requires typing new data live;
presenters can point straight at the pre-loaded records.

---

## Scenario 1 (primary): High-discount deal → risk flag → approvals → fulfillment

**Seed anchor:** `DEMO-DEAL-002` — ABC Industries, rep Rahul, 5× Server, 25% discount.

1. Salesperson (Rahul) selects customer **ABC Industries** (`DEMO-CUST-001`).
2. Adds **Server** (`DEMO-PROD-001`) × 5 to the quotation.
3. Applies a **25% discount** — steeply above Rahul's own historical average.
   - Rahul's discount history (from `GET /api/reports/sales-rep-discount-history`):
     `[5, 7, 8, 10, 9]` → average ≈ 7.8%. 25% is a clear outlier.
4. Balaji's risk engine scores the quote (`POST /score-quote`) → in the seed
   snapshot this is already recorded as `riskScore: 82`, `riskLevel: HIGH`.
5. The engine's explanation surfaces on screen: *"Discount is significantly
   above the sales representative's historical average."*
6. Because the deal is HIGH risk, Nithin's approval workflow requires
   sign-off. Seed state shows `approvalStage: SALES_MANAGER` (next: Finance).
7. Walk through Sales Manager → Finance approval (Nithin's module).
8. Once approved, the deal proceeds to Santhosh's warehouse fulfillment.
   `DEMO-DEAL-009` shows what that looks like once complete (a smaller,
   already-finished version of the same ABC Industries/Rahul/Server pattern:
   approved, fulfilled, split 2 units to Warehouse A / 1 to Warehouse B).
9. Open the **Deal Health Dashboard** and show `DEMO-DEAL-002` sitting in the
   **AT_RISK** bucket (`GET /api/reports/at-risk-deals`), with its discount,
   risk score, and current approval stage all visible.
10. Show `GET /api/reports/deal-health-summary` ticking up `atRiskDeals`
    and reflecting the deal's value in `openPipelineValue`.

**Supporting secondary risk example:** `DEMO-DEAL-005` (XYZ Technologies,
rep Arun, 22% discount, `riskLevel: MEDIUM`) — use this to show the at-risk
list isn't a single hard-coded row; it's a real filtered aggregation.

## Scenario 2 (secondary): Stalled deal

**Seed anchor:** `DEMO-DEAL-003` — Global Retail, rep Priya, Cloud
Subscription × 20, no activity for 8 days.

1. Open the dashboard's **Stalled Deals** panel
   (`GET /api/reports/stalled-deals`).
2. Point out `DEMO-DEAL-003` and `DEMO-DEAL-015` — both Global Retail /
   Priya deals that have gone quiet (8 and 12 days respectively), with no
   risk flag involved. This shows the dashboard surfaces two *independent*
   problems (risk vs. neglect), not just one signal.
3. Contrast with a healthy deal, e.g. `DEMO-DEAL-001` (Acme Corporation,
   rep Karthik, 8% discount, recent activity) to show what "healthy" looks
   like by comparison.

## Bonus beats (if time allows)

- **Upsell/cross-sell:** `DEMO-DEAL-006` and `DEMO-DEAL-001` are flagged
  `upsellOpportunity: true` with `suggestedUpsellProducts` — hand off to
  Balaji's recommendation panel.
- **Warehouse fulfillment:** `DEMO-DEAL-007` (Global Retail, 100 Printers)
  shows a 60/40 warehouse split, matching Santhosh's fulfillment output
  contract.
- **Subscription:** `DEMO-DEAL-008` (Acme Corporation, Cloud Subscription
  × 50 seats) shows a live `SUBSCRIBED` deal for Santhosh's billing screen.
- **Rejected deal:** `DEMO-DEAL-014` (28% discount, `riskScore: 90`) shows
  the workflow's negative outcome, if you want to demonstrate a rejection.

## One-liner for judges

> "Every number on this dashboard is a live aggregation over real deal
> records — nothing is hard-coded. Change a discount or a risk score in the
> underlying data, and the summary, the at-risk list, and the rep discount
> history all update automatically."

To prove it live: call `POST /api/admin/reset-seed` before the demo to get
a clean run, or edit `src/data/deals.json` and hit any report endpoint to
show the numbers move.
