# DealFlow360 — 24-Hour Hackathon Build Plan

**Team:** Balaji, Nithin, Santhosh, Prabanjan
**Tools:** Balaji — Claude Pro | Nithin, Santhosh, Prabanjan — Gemini Pro
**Problem Statement Chosen:** DealFlow360 — Intelligent, Self-Governing Sales Operations Platform

---

## 1. Why This Problem Statement

Out of the three options (PeoplePay360 HR/Payroll, Urban Furniture Accounting, DealFlow360), DealFlow360 has the highest novelty ceiling:

| Problem | Ceiling | Why |
|---|---|---|
| Urban Furniture (Accounting) | Low | Double-entry bookkeeping is a solved, rigid domain — hardest to differentiate |
| PeoplePay360 (HR/Payroll) | Medium | CRUD + reports shape, some room for smart features |
| **DealFlow360 (Sales Ops)** | **High** | Explicitly requires real decision logic: risk scoring, recommendations, optimization, live negotiation |

DealFlow360 rewards genuine algorithmic work (anomaly detection, recommender systems, optimization) over static forms — most of the ~800 competing teams will hardcode thresholds instead of computing them, which is our opening.

---

## 2. The Vision (One-Paragraph Pitch)

A sales rep builds a quote in a workspace that feels like Salesforce CPQ. While they add products, a live recommender (like Amazon's "frequently bought together") suggests margin-boosting add-ons. If a line's discount breaks its own category limit, the system computes a blended risk score across the whole order — not just one worst line — and auto-routes it for approval, the way an expense report auto-escalates in SAP Concur. Once approved, stock is split across warehouses like a fulfillment engine (ShipBob/NetSuite), and the order can mix one-time hardware with a recurring subscription line (Stripe Billing-style proration). The customer negotiates the quote live in a portal that feels like Google Docs comments crossed with DocuSign — and if their counter-offer breaks a threshold, it automatically re-enters approval with zero manual resubmission. A manager watches deal health on a dashboard styled like Gong/Clari, catching stalled or over-discounted deals before they die quietly.

---

## 3. Wow Factors / Novelty (Prioritized)

### Tier 1 — Build these first (core novelty story)
1. **Real blended risk score, not if/else** — compute each rep's historical discounting pattern, flag statistical deviations (z-score or isolation-forest-style), and show a line-by-line "why this was flagged" breakdown (SHAP-style explainability).
2. **Real upsell/cross-sell recommender** — lightweight item-item collaborative filtering or association-rule mining over seeded co-purchase data, not a hardcoded lookup table.
3. **AI deal narrator** — one LLM call that reads a quote's numbers and writes a plain-language risk/stall summary (e.g., "8 points over limit on Setup Service, plus 2 days of inactivity — trending toward stalled").

*These three reuse the same core skill (compute something real from data → explain it in plain language) so effort compounds instead of scattering.*

### Tier 2 — Strong demo moments, moderate effort
4. **Live "what-if" pricing slider** — drag discount, watch margin/approval-likelihood update before submitting.
5. **Presence/typing indicators on customer portal** — "Acme Corp is viewing this quote," Google Docs-style.
6. **Rep-facing coaching** — "Drop this line to 14% to skip Finance approval entirely."
7. **Warehouse split as a real toggle-able optimizer** — "Minimize Shipments" vs "Minimize Cost," visibly reshuffling numbers.

### Tier 3 — High wow, higher risk (only if Tier 1 lands early)
8. Voice/text-to-quote ("10 laptops for Acme, 12% off" → auto-drafted line via LLM parse).
9. Predictive stall/churn scoring (reuses Tier 1's statistical machinery).

**Decision rule:** Don't touch Tier 3 unless Tier 1 is fully working with hours to spare.

---

## 4. Team Split

| Person | Tool | Owns |
|---|---|---|
| **Balaji** | Claude Pro | **Intelligence layer**: risk-scoring engine + explainability, upsell/cross-sell recommender, AI deal narrator. **All frontend**: Quotation Builder, Upsell panel, Warehouse-split screen, Subscription/Billing screen, Customer Portal negotiation screen, Deal Health dashboard UI |
| **Nithin** | Gemini Pro | Auth (login/signup, portal magic link), Product & Price List backend, Discount Tier & Approval Chain setup + approval routing state machine (consumes risk score output, routes Sales Manager → Finance) |
| **Santhosh** | Gemini Pro | Warehouse & Fulfillment setup + split allocation logic, Subscription/Recurring plan setup + proration calculation |
| **Prabanjan** | Gemini Pro | Reporting/dashboard data aggregation backend (stalled-deal lists, per-rep discount history feeding the scorer), seed/demo data, demo script + one-page architecture diagram |

**Key decoupling move:** Define API contracts at hour 0 (e.g., `POST /score-quote` → `{score, explanation}`, `POST /recommend` → `{items[]}`) so backend teammates aren't blocked waiting on Balaji's logic, and Balaji can build against mocked data early.

### Frontend triage (since one person owns all six screens)
- **Build fully real/polished:** Quotation Builder + Upsell panel, Deal Health dashboard — this is where the novelty is visible and where judges' eyes go.
- **Build simple-but-functional:** Customer Portal, Warehouse-split screen, Subscription/Billing screen — plainer UI wrapping straightforward backend logic is fine here.

---

## 5. Timeline

| Hours | Focus |
|---|---|
| 0–1 | Define API contracts together (score, recommend, warehouse split, approval state) |
| 1–14 | Parallel build: Balaji builds intelligence layer + Tier-1 frontend (Quotation Builder, Upsell panel, Dashboard) against mocked data. Nithin/Santhosh/Prabanjan build backend independently |
| 14–18 | Integrate real backend APIs into frontend; build out Tier-2 screens (Portal, Warehouse split, Subscription) |
| 18–22 | End-to-end test both demo flows; fix breakages |
| 22–24 | Demo rehearsal, architecture diagram, pitch polish (Prabanjan leads) |

---

## 6. Screen-by-Screen Breakdown (Real-World App Analogies)

### Stage 0: Sales Workspace (entry point)
**Feels like:** Notion sidebar + Salesforce top nav
Top bar: Quotations | Pipeline | Reports | Go to Back-end. Quotations shown as Kanban-style cards (customer, amount, status pill). Clicking a card slides open the Quotation Builder without a full page reload (like Superhuman's reading pane).

### Stage 1: Product Catalog (Flipkart-style — needed before the cart)
**Feels like:** Flipkart/Amazon product grid
Search bar + category tabs (Hardware | Services | Subscriptions). Grid of product cards: thumbnail, name, price, stock tag ("In Stock"/"Limited Stock"), "Add to Quote" button. Variant selector pops up for products with options (Size, Pack), same interaction as picking size/color on a Flipkart tile. *Reuse the same card component for the Upsell panel — just swap the button label and drop the margin-delta tag on this version.*

### Stage 2: Quotation Builder + Upsell Panel
**Feels like:** Shopify checkout cart (left) + Amazon "frequently bought together" (right)
Left 65%: running cart with quantity steppers, per-line discount input, live margin bar that recolors green→amber→red (like Uber's live fare estimate). Right 35%: vertical suggestion cards with product thumbnail, "+4% margin" tag, promo ribbon, "Add to Quote" button — adding one animates it into the cart and updates the margin bar instantly. *This live feedback loop is the single most important demo beat.*

### Stage 3: Discount Approval Screen
**Feels like:** Airline boarding-pass tracker + GitHub PR checks
Vertical stepper: Sales Manager → Finance (Finance only appears if triggered), each with a status icon. Below it, a card explains the trigger in plain language ("Setup Service: 18% given, 10% allowed, +8 pts over") — like a credit card app explaining a flagged transaction instead of a vague decline.

### Stage 4: Warehouse Split Screen
**Feels like:** DoorDash multi-restaurant split / FedEx tracker
Cards per warehouse showing units allocated + stock level. Toggle: "Minimize Shipments" / "Minimize Cost" — flipping it visibly reshuffles numbers, same instant-recalc feel as flight search "cheapest vs fastest" filters.

### Stage 5: Subscription & Billing Screen
**Feels like:** Netflix/Spotify billing page next to a normal receipt
Two sections: "One-Time Items" (plain receipt) and "Recurring Plan" (plan name, billing cycle badge, next billing date, mini calendar strip). Mid-cycle quantity change triggers a toast ("Prorated credit of ₹450 applied") — same pattern as Notion/Slack seat downgrades.

### Stage 6: Customer Portal (Negotiation)
**Feels like:** Google Docs comments + DocuSign review flow
Deliberately different visual language from internal screens — single-column document layout, inline comment bubbles per line item, status badge (Sent/Under Negotiation/Confirmed) styled like a DocuSign envelope status. Big "Confirm Quotation" button styled like a checkout "Place Order" button.

### Stage 7: Deal Health Dashboard
**Feels like:** Google Analytics overview + Robinhood alert feed
Top row: KPI cards (Total Pipeline Value, Stalled Deals, Avg Discount) styled like Stripe's dashboard homepage. Below: scrolling alert feed, each card with a colored left-border stripe, one-line description, timestamp — like a stock-alert feed or GitHub notifications. Clicking an alert opens the related quotation directly.

**Consistent thread across all screens:** any number that can change (margin, risk score, split quantities, billing amount) should visibly animate/recolor on update — one interaction pattern, reused everywhere, makes the whole app feel alive instead of like disconnected forms.

---

## 7. Demo Script (Two End-to-End Flows for the 5-Minute Demo)

**Flow A — Quote to Fulfillment:**
1. Build a quote, add an upsell suggestion (margin updates live)
2. Apply an over-limit discount → auto-routes to approval with explainable risk score
3. Manager approves → warehouse split appears, toggle between optimization modes
4. Order includes a subscription line → billing screen shows both one-time and recurring correctly

**Flow B — Negotiation Loop:**
1. Customer opens portal, requests a bigger discount
2. Quote automatically re-enters approval (no manual resubmission)
3. Approved → order confirmed → Deal Health dashboard reflects the closed deal, no longer flagged

---

## 8. Deliverables Checklist

- [ ] Working backend + frontend with seed data
- [ ] Both demo flows working end-to-end
- [ ] One-page architecture diagram (data model + module connections) — Prabanjan
- [ ] Short "what we'd build next" note
- [ ] 5-minute live demo rehearsed at least once before presenting
