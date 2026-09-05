# API Contracts — FROZEN AT H1

**Do not rename or remove a field without telling everyone.** Adding fields is always safe. This document plus `backend/api/schemas.py` are the same contract; the schemas file is the machine-checked version and wins any disagreement.

Live, always-current versions of everything below:

```bash
cd dealflow360/backend && ../.venv/Scripts/python.exe -m uvicorn api.main:app --reload --port 8000
```

| URL | What |
|---|---|
| http://localhost:8000/docs | Interactive OpenAPI — click "Try it out" on any endpoint |
| http://localhost:8000/_status | **Integration board** — which endpoints are real vs stub |
| http://localhost:8000/health | Liveness |

---

## How this unblocks all four of us

Balaji builds the **entire UI against these shapes today**, using the stub responses. Nithin, Santhosh and Prabanjan replace stub bodies with real ones, **one endpoint at a time**, without touching the response shape. Nobody waits for anybody.

When you make an endpoint real, change **one word** in `backend/api/registry.py` (`impl="stub"` → `impl="real"`). `/_status` picks it up immediately, and the UI shows a badge so Balaji knows which screens are still on fixtures.

Current state: **11 real / 18 stub**. The intelligence core is real from hour one because the engine already exists.

---

## Ownership

| Owner | Endpoints |
|---|---|
| **Balaji** | score · coach · recommend · policy · policy/simulate · portal (read) · events/stream · admin/reset |
| **Nithin** | auth · products · quotes · submit · approvals · approvals/action |
| **Santhosh** | warehouses · orders/split · subscriptions · subscriptions/change · invoices · invoices/payment |
| **Prabanjan** | dashboard · reports · **the seed generator that all of the above reads from** |

---

## Rules that apply to every endpoint

1. **Illegal state transitions return `409`**, never `500`, and the body always carries the legal set:
   ```json
   { "detail": { "error": "illegal_transition", "ref": "Q-1042",
                 "current_state": "PAID", "attempted": "APPROVED", "allowed": [] } }
   ```
   The UI disables buttons from `allowed_transitions` and shows *why*. A disabled button that explains itself reads as rigour; a missing one reads as an unfinished screen.

2. **Mutating endpoints accept `idempotency_key`.** Replaying returns the identical response rather than double-writing. A double-click on a projector is a real hazard.

3. **Unknown ids return `404`.** Never a 500, never an empty 200.

4. **Every mutation writes a `deal_events` row** — actor, role, event type, reason, timestamp (PS §A3). This is the audit spine; the approval history, the dashboard, and the stall detector are all projections of it.

5. **Money is a float in INR**, rounded to 2dp at the edge. Percentages are 0–100, not 0–1.

---

## The intelligence endpoints (REAL — build against these with confidence)

### `POST /quotes/{ref}/score`

The heart of the product. Returns the blended risk score with **exact** additive attribution.

```jsonc
{
  "ref": "Q-1042",
  "score": 25.9,
  "band": "MANAGER",                    // AUTO | MANAGER | FINANCE
  "terms":         { "S": 0.4, "A": 0.2078, "L": 0.0297, "Z": 0.3355 },
  "weights_used":  { "S": 0.35, "A": 0.30, "L": 0.20, "Z": 0.15 },
  "contributions": { "S": 14.0, "A": 6.23, "L": 0.59, "Z": 5.03 },  // SUMS TO score
  "lines": [
    { "sku": "SVC-ONSITE", "name": "Onsite Setup Service", "category": "Services",
      "qty": 1, "given": 18.0, "allowed": 10.0, "over": 8.0,
      "leaked": 32.0, "revenue_weight": 0.1299, "ok": false }
  ],
  "leaked_total": 32.0,
  "order_revenue": 3080.0,
  "order_margin": 1079.0,
  "notes": [],                          // e.g. "Insufficient rep history..."
  "narrative": "Onsite Setup Service is 8 points over its 10% Services ceiling...",
  "narrative_source": "template"        // "llm" when the narrator upgrade is live
}
```

**UI notes.** `contributions` renders as the stacked contribution bar — it sums exactly to `score`, so the bar needs no fudging. `lines` renders the per-line `given / allowed / over / ₹ leaked` table. `notes` renders as chips (the insufficient-history chip is a *feature*, not an error — it shows the model is honest about its inputs).

### `POST /quotes/{ref}/coach?target_band=AUTO`

Counterfactual: the cheapest **compliant** change that reaches a target band.

```jsonc
{ "available": true, "line_index": 1, "sku": "SVC-ONSITE",
  "current_discount": 18.0, "target_discount": 10.0, "ceiling": 10.0,
  "points_sacrificed": 8.0, "revenue_recovered": 32.0,
  "fixes_violation": true, "fully_compliant_after": true,
  "from_band": "MANAGER", "to_band": "AUTO",
  "score_before": 25.9, "score_after": 5.0,
  "message": "Drop Onsite Setup Service to 10% and this quote auto-approves." }
```

`{"available": false}` when already compliant — render nothing, not an empty card.

> Advice is **capped at the line's ceiling** by design. The band edge and the ceiling are different numbers, and coaching to the band edge would mean telling a rep "stay 6 points over policy, you'll slip through". We are a governance tool.

### `POST /quotes/{ref}/recommend?limit=4&margin_floor_pct=25`

Association rules over 120 historical orders. Not a lookup table.

```jsonc
{ "ref": "Q-1042", "basis": "co-purchase",     // co-purchase | promoted | none
  "filtered_by_margin_floor": 3,
  "suggestions": [
    { "sku": "DOCK-01", "name": "Docking Station", "category": "Hardware",
      "list_price": 320.0, "support": 0.35, "confidence": 0.70, "lift": 2.0,
      "margin_delta": 112.0, "margin_pct": 35.0, "is_promoted": true,
      "reason": "70% of orders with Laptop Pro 14 also include this (lift 2.0x) · promoted" }
  ] }
```

**Label the panel from `basis`.** `"co-purchase"` → "Frequently bought together". `"promoted"` → "Promoted". Showing the former above promo-only results is a small lie a reviewer will catch by adding one obscure item to an empty cart.

### `GET /policy` · `PUT /policy`

```jsonc
{ "tier_ceiling":     { "Bronze": 5.0, "Silver": 10.0, "Gold": 15.0 },
  "category_ceiling": { "Hardware": 15.0, "Software": 15.0,
                        "Services": 10.0, "Subscriptions": 12.0 },
  "weights": { "S": 0.35, "A": 0.30, "L": 0.20, "Z": 0.15 },
  "caps":    { "S": 20.0, "A": 5.0, "Z_lo": 1.0, "Z_hi": 3.0 },
  "bands":   [[0, 20, "AUTO"], [20, 60, "MANAGER"], [60, 1e9, "FINANCE"]],
  "hard_override_pts": 15.0, "stall_days": 7, "version": 1,
  "warnings": [] }
```

`warnings` carries dead config — a category ceiling above every tier ceiling can never fire, because the effective ceiling is `min(tier, category)`. Render these inline on the admin screen.

### `POST /policy/simulate` — ★ THE 10X ANGLE

Send partial policy overrides. **Nothing is persisted.**

```jsonc
// request
{ "category_ceiling": { "Hardware": 15.0, "Software": 15.0,
                        "Services": 8.0, "Subscriptions": 12.0 } }

// response
{ "proposed": { /* full policy */ },
  "quotes_evaluated": 15, "quotes_changed": 4, "escalated": 4, "relaxed": 0,
  "band_counts_before": { "AUTO": 7, "MANAGER": 6, "FINANCE": 2 },
  "band_counts_after":  { "AUTO": 4, "MANAGER": 8, "FINANCE": 3 },
  "leakage_before": 2103.0, "leakage_after": 2949.0, "leakage_recovered": 846.0,
  "headline": "Re-routes 4 of 15 open deals · exposes ₹846 of leaking margin",
  "elapsed_ms": 12.4,
  "impacts": [   // pre-sorted: movers first, largest delta first
    { "ref": "Q-1054", "customer": "Vertex Labs", "total": 8930.0,
      "score_before": 57.9, "score_after": 62.3,
      "band_before": "MANAGER", "band_after": "FINANCE",
      "leaked_before": 339.0, "leaked_after": 457.0,
      "changed": true, "direction": "escalated" } ]  // escalated|relaxed|unchanged
}
```

**UI notes.** `impacts` is already sorted so movers appear first in the pipeline strip. Animate on `direction`. Call this on slider *drag*, not on release — it runs in ~12 ms, so the ripple tracks the thumb.

> **Direction matters, and it is worth knowing before you rehearse.** Tightening a ceiling can only ever *raise* scores, so a single downward drag produces escalations only — never a green flip. To show two-way movement, drag the slider **back**; the reverse ripple is the cleanest possible proof that nothing is hardcoded. Keep that in reserve for Q&A.

---

## The portal boundary (REAL — this is a graded requirement)

### `GET /portal/{token}`

Demo tokens: `acme-q1042-7f3a9c` → Q-1042 · `beta-q1039-2b81de` → Q-1039

```jsonc
{ "ref": "Q-1042", "customer": "Acme Corp",
  "status": "Sent",                     // Sent | Under Negotiation | Confirmed
  "valid_until": "2026-09-30", "currency": "INR",
  "lines": [ { "id": 0, "name": "Laptop Pro 14", "category": "Hardware",
               "qty": 2, "unit_price": 1250.0, "discount_pct": 12.0,
               "line_total": 2200.0 } ],
  "subtotal": 3080.0, "discount_total": 172.0, "tax_total": 523.4,
  "total": 3431.4, "recurring_total": 0.0,
  "comments": [], "can_confirm": true }
```

**There is no `cost`, `margin`, `risk_score`, `ceiling`, `over`, or `rep` in this response — those fields do not exist in the portal DTO.** It is a separate type built field by field, not a filtered copy of the internal one, so adding a field internally cannot leak it. `tests/test_api.py::test_portal_payload_cannot_leak_internals` asserts this on the serialised bytes.

*Rehearsed demo move:* DevTools → Network → this payload → *"the margin field doesn't exist in this response; it isn't hidden by CSS."*

### `POST /portal/{token}/request`

```jsonc
// request
{ "line_id": 1, "counter_discount_pct": 28.0, "comment": "Can we do 28% on setup?" }
// response
{ "ok": true, "ref": "Q-1042", "re_entered_approval": true,
  "new_band": "FINANCE", "state": "PENDING_MANAGER" }
```

The quote enters `NEGOTIATION`, is re-scored **as if the counter were accepted**, and if the new terms breach thresholds it re-enters approval automatically — no rep action (PS §B8, rubric step 7).

---

## Stub endpoints — shapes are frozen, bodies are yours

### Nithin

| Endpoint | Returns |
|---|---|
| `POST /auth/login` `{email}` | `{token, user{id,name,email,role}}` |
| `GET /products?category=&q=` | `[{sku,name,category,list_price,cost,is_recurring,is_promoted,stock_total,variants}]` |
| `GET /quotes?state=` | `[QuoteSummary]` — card shape for pipeline/list |
| `GET /quotes/{ref}` | `QuoteDetail` + `lines[]` + `allowed_transitions[]` |
| `POST /quotes/{ref}/submit` | `{ref,state,risk_score,risk_band,auto_routed,requires_finance,allowed_transitions}` |
| `GET /approvals?pending_only=` | `[{ref,customer,tier,state,risk_score,risk_band,stage,assigned_to}]` |
| `GET /approvals/{ref}` | `{steps[],audit[],contributions,lines,narrative,allowed_transitions}` |
| `POST /approvals/{ref}/action` | `{action: approve\|reject\|return, actor, reason, idempotency_key}` |

> `submit` must route from the **real score** with no rep request — that is rubric step 3. Approving a `FINANCE`-band quote at manager level goes to `PENDING_FINANCE`, not `APPROVED`.

### Santhosh

| Endpoint | Returns |
|---|---|
| `GET /warehouses` | `[{name,ship_cost_weight,fixed_shipment_cost,stock{sku:available}}]` |
| `POST /orders/{ref}/split?objective=shipments\|cost` | `{allocations[],shipment_count,total_cost,backorders[],fully_allocated,consolidation_available,explanation}` |
| `GET /subscriptions` | `[SubscriptionDetail]` |
| `POST /subscriptions/{id}/change` | `{days_remaining,days_in_cycle,delta_qty,credit,credit_note_ref,formula,schedule[]}` |
| `GET /invoices` | `[InvoiceDetail]` |
| `POST /invoices/{ref}/payment` | `{...,status: unpaid\|partial\|paid}` |

> The stub split is greedy. Replace it with the exact **2^W subset enumeration** — with W ≤ 5 that is 32 cases, so warehouse selection is *optimal, not heuristic*, which is a strong thing to be able to say. Keep `formula` populated on proration: reviewers check the maths, and visible arithmetic is unfalsifiable.

### Prabanjan

| Endpoint | Returns |
|---|---|
| `GET /dashboard` | `{pipeline_value,open_quotes,stalled_count,stalled_value,avg_discount_pct,leakage_total,leakage_ratio,closed_orders_analysed,median_approval_hours,band_counts,alerts[]}` |
| `GET /reports?rep=&category=&approval_status=` | `{filters,rows[],by_category,total_value}` |

> `leakage_total` is the **cold-open number** and it is computed from the closed-order history, never hardcoded. If a reviewer asks where it comes from, the answer must be a query.

---

## Infrastructure

- `GET /events/stream` — SSE. Emits `{type, ref, actor, at}` on every mutation, plus a 15 s keep-alive comment. Reconnect on error; fall back to 2 s polling.
- `POST /admin/reset` — restores golden state in **< 5 ms**. This is a demo guardrail: the recovery move on stage is one click, not debugging.

---

## Seeded demo data

Identifiers match the supplied wireframe pack exactly, so the mockup doubles as our acceptance test.

**Logins** (any password): `rao@` rep · `iyer@` rep · `shah@` manager · `menon@` finance · `admin@` admin — all `@dealflow.example`

**The six hero records:**

| Ref | Why it exists |
|---|---|
| **Q-1042** Acme Corp | PS §10's worked example, verbatim. Score 25.9 → MANAGER, driven by **S** (the Services breach) |
| **Q-1039** Beta Industries | The aggregate case. No line worse than 3 pts over, so every `max()` rule passes it — ours flags it at 22.1, driven by **A** |
| **Q-1044** Orion Systems | 44 × LP14 against 28 + 14 available → split is **forced**, 2 units backorder |
| **Q-1046** Vertex Labs | Disciplined rep at 19% → behavioural term fires |
| **Q-1047** Nova Retail | Rep with 3 prior orders → insufficient-history branch |
| **Q-1031** Delta LLC | 9 days idle against a 7-day threshold → stalled alert |
| **Q-1054** Vertex Labs | Sits at 57.9, just under the 60 Finance edge — escalates during the simulator ripple |
