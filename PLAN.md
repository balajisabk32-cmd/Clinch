# Build Plan — Screens, Warehouse, Database

Audited against the organisation's own wireframe (`DealFlow360 - End to End Product Flow 24 hours oxp.png`, 18 screens) and the PS module list.

---

## 1. Screen audit — 18 wireframe screens

| # | Wireframe screen | Status | Gap |
|---|---|---|---|
| 1 | Login / Signup | ⚠️ Partial | `Login.tsx` exists, mocked. **No signup**, no portal magic-link |
| 2 | **Sales Dashboard / Home** | ❌ **MISSING** | Landing tile for the whole workspace — Pending Approvals / Open Quotations / At-Risk cards + Recent Activity |
| 3 | Quotations (List) | ✅ Done | Kanban + table toggle |
| 4 | Quotation Detail | ✅ Done | `Builder.tsx` + upsell panel |
| 5 | Approvals (List) | ✅ Done | `Approvals.tsx` — queue, filters, risk band |
| 6 | Approval Detail | ⚠️ Partial | Actions exist; **"Why This Quote Was Flagged" table + stepper + audit trail** not laid out per wireframe |
| 7 | **Fulfilment & Stock (List)** | ⚠️ **Thin** | Has warehouse fetch only. **Missing: In Stock / Reserved / Available grid + Orders Awaiting Fulfilment table** |
| 8 | **Fulfilment Detail** | ❌ **MISSING** | Qty fulfilled / Est. shipments / Cost per depot, Consolidate prompt, Accept Split vs Manual Override |
| 9 | **Subscriptions (List)** | ❌ **MISSING** | Active / Paused / Cancelled filters, customer plan table |
| 10 | **Billing Detail** | ❌ **MISSING** | One-time vs Recurring lines, Modify / Cancel |
| 11 | **Customer Portal** | ❌ **MISSING** | 🔴 Also a **live bug** — `Workspace` redirects CUSTOMER to `/portal`, which does not exist |
| 12 | **Invoices (List)** | ❌ **MISSING** | Unpaid / Paid filters |
| 13 | **Invoice Detail** | ❌ **MISSING** | Order→Shipped→Invoiced→Paid stepper, Record Payment |
| 14 | Deal Health Dashboard | ✅ Done | `DealHealth.tsx` |
| 15 | **Admin / Reporting** | ❌ **MISSING** | Period / Team / Status / Product filters + **Export PDF / XLS** |
| 16 | **Product Dashboard** | ❌ **MISSING** | Catalogue table, New Product |
| 17 | **Product Detail + Pricelist** | ❌ **MISSING** | General info, Variants, Pricelist rules |
| 18 | **Discount Tiers & Approval Chain** | ❌ **MISSING** | Tier + Category ceilings, routing rules, Save config |

**Score: 5 complete, 3 partial, 10 missing.**

Backend readiness is much better than frontend: **31 of 35 endpoints are real.** Most missing screens are UI over working APIs.

### Nav gap
Wireframe top nav is `Dashboard · Quotations · Approvals · Fulfilment · Subscriptions · Invoices · Deal Health · Reports · Product`.
Ours is missing **Dashboard**, **Reports**, **Product**.

---

## 2. Warehouse & fulfilment — the specific lag

The **engine** is done and exact (`engine/fulfilment.py`, 2^W subset enumeration, 21 tests). What is missing is everything the wireframe shows *around* it:

| Needed | Backend | Frontend |
|---|---|---|
| Stock grid: In Stock / **Reserved** / Available per warehouse | ⚠️ `/warehouses` returns available only | ❌ |
| Orders Awaiting Fulfilment queue | ❌ no endpoint | ❌ |
| Per-depot Qty Fulfilled / Est. Shipments / Cost | ✅ `/orders/{ref}/split` | ❌ |
| Accept Suggested Split → persist allocation | ❌ not persisted | ❌ |
| Manual Override | ❌ | ❌ |
| Consolidate Remaining Backorder | ✅ `/orders/{ref}/consolidate` | ❌ |
| Replenishment rules per warehouse (PS A4) | ⚠️ `REPLENISH` constant, not configurable | ❌ |

**Work:** add `GET /fulfilment/queue`, expose `reserved` in `/warehouses`, add `POST /orders/{ref}/allocate` (persist accepted or overridden split), then build screens 7 + 8.

---

## 3. Database plan

### Current state
Everything lives in `api/state.py` as Python dicts, rebuilt from `api/fixtures.py` on `reset()`. It works, resets in 0.2 ms, and 74 tests pass against it — but it is not durable, not inspectable, and not what the PS's data-model deliverable expects.

### Target
**SQLite (WAL) + SQLModel**, file-backed, committed to the repo as a golden snapshot.

### Why SQLite and not Postgres
No service to start, no container, no credentials — and the `.db` file is a **committable artifact**, so any teammate's laptop reproduces the exact demo state. A container that will not start at hour 23 is how teams lose. Schema stays Postgres-portable so the claim "swap the URL" is honest.

### Schema (20 tables, ERP-aligned names)
```
res_partner · app_user · product_template · product_variant · price_list
discount_tier · category_ceiling · approval_rule · score_weight
warehouse · stock_quant · replenishment_rule
sale_order · sale_order_line · allocation · backorder
subscription · billing_schedule · account_move · account_payment
portal_comment · deal_events (APPEND-ONLY)
```
Full DDL already drafted in `ARCHITECTURE.md §8`.

### Migration strategy — repository pattern, zero UI churn
1. Add `api/db.py`: engine, session, `create_all()`, WAL pragma.
2. Add `api/models.py`: SQLModel tables mirroring the DDL.
3. **Keep `state.py` as the public interface.** Swap its internals from dicts → SQLite queries one function at a time (`build_quote`, `add_line`, `set_state`, `record`, …). Every function signature stays identical, so `services.py`, `routers.py` and the whole frontend are untouched.
4. `seed.py --db` writes `data/clinch_golden.db`; app boots from a working copy.
5. `POST /admin/reset` becomes **copy golden file → working file** — still sub-second, and now genuinely atomic.
6. Run the 74 tests after **each** function swap. Any red = revert that one function.

### Risk assessment — read this before scheduling it
This is the highest-risk change left and it moves **zero rubric lines**. Judges never see the storage layer; they see screens. `CLINCH.md`'s own "Do NOT Build" list warns against work that changes no rubric line.

**Recommendation: do the database *after* the missing screens**, unless persistence across restarts is explicitly graded. The repository pattern above means it can be done at any point without touching the UI.

---

## 4. Build order

**Phase A — unblock + your flagged gap**
1. 🔴 Customer Portal (11) — fixes the dead redirect, PS §7 graded, rubric step 7
2. Fulfilment & Stock list (7) + Fulfilment Detail (8) + backing endpoints — your flagged lag, rubric step 5

**Phase B — close the money tail**
3. Invoices list (12) + Invoice Detail (13) — rubric step 8
4. Subscriptions (9) + Billing Detail (10) — rubric step 6

**Phase C — admin & entry**
5. Sales Dashboard (2)
6. Discount Tiers & Approval Chain (18) — also the natural home for the Policy Simulator
7. Product Dashboard (16) + Product Detail (17) — PS A2
8. Admin / Reporting (15) + **Export PDF / XLS** — PS A7
9. Signup + portal link issuance (1) — PS A1

**Phase D — durability**
10. SQLite migration per §3

**Phase E — novelty (only once A–C are done)**
11. Policy Simulator UI on screen 18
