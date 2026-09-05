# DealFlow360 — Technical Architecture Map

> **Purpose:** review preparation. Every section gives you the **Plain English** version (what you say to a judge), the **Technical** version (what the code actually does), and **Why** (the design reasoning you'll be challenged on).
>
> **Maintained doc.** Updated every time code changes. If something here disagrees with the code, the code wins — tell me and I'll fix this file.

**Last updated:** after contracts + stubs landed
**Build state:** backend complete through the intelligence layer · frontend not started
**Tests:** 43 passing (23 engine · 20 API) · **Endpoints:** 28 (9 real, 19 stub) · **Backend:** ~3,500 lines

---

## 0. The 60-Second Version

If you only remember one thing:

> We built a **governance engine**, not a quotation form. The core is a **pure function** — `(policy, quote, rep_history) → decision + explanation`. Because policy is an *argument* rather than a hardcoded constant, we can re-run that function against a policy nobody has saved yet, across the whole open pipeline, and show the blast radius before committing. That's the Policy Simulator, and it's ~40 lines *only because* of that one design decision.

Three claims you can defend with a click:

| Claim | Proof |
|---|---|
| The logic is real, not hardcoded | Policy Simulator ripples 4 of 15 deals live |
| We check the *pattern*, not the worst line | Q-1039 has no line worse than 3 pts over and still flags |
| The portal is genuinely restricted | DevTools → the margin field doesn't exist in the response |

---

## 1. System Map

```
┌─────────────────────────────────────────────────────────────────────┐
│ LAYER 4 — HTTP          api/routers.py  (668 lines, 28 endpoints)   │
│   intelligence · sales · operations · portal · insights · infra     │
│   Owns: request/response, status codes, 409 on illegal transitions  │
└────────────────────────────┬────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────┐
│ LAYER 3 — DERIVATIONS   api/services.py  (229 lines)                │
│   totals() · narrate() · leakage_report() · open_pipeline()         │
│   simulate()  ← THE MOAT lives here                                 │
│   Owns: anything computed from more than one place, exactly once    │
└────────────────────────────┬────────────────────────────────────────┘
                             │
        ┌────────────────────┴───────────────────┐
        │                                        │
┌───────▼────────────────────────┐   ┌───────────▼──────────────────┐
│ LAYER 2 — STATE                │   │ LAYER 1 — ENGINE (PURE)      │
│ api/state.py  (144 lines)      │   │ engine/scoring.py     (548)  │
│                                │   │ engine/recommender.py (222)  │
│  · policy (live, mutable)      │   │                              │
│  · quote states                │   │  score_quote()               │
│  · deal_events  APPEND-ONLY    │   │  coach()                     │
│  · idempotency cache           │   │  recommend()                 │
│  · SSE subscriber fan-out      │   │                              │
│  · reset() → golden state      │   │  NO database. NO HTTP.       │
│                                │   │  NO globals. NO config read. │
└────────────────────────────────┘   │  Policy arrives as an ARG.   │
                                     └──────────────┬───────────────┘
                                                    │
┌───────────────────────────────────────────────────▼─────────────────┐
│ LAYER 0 — DATA          api/fixtures.py  (378 lines)                │
│   14 products · 7 customers · 6 users · 15 open quotes              │
│   120 closed orders (seed 42, deterministic) · 2 warehouses         │
│   Swappable for SQLite later without touching any layer above       │
└─────────────────────────────────────────────────────────────────────┘
```

**The one rule that makes this work:** dependencies only ever point *downward*. The engine imports nothing from the API. That's what lets the simulator call the scorer 15 times in 4 milliseconds with a policy that doesn't exist in the database.

---

## 2. Layer 1 — The Engine (`engine/scoring.py`)

### 2.1 What it is

**Plain English:** The bit that decides whether a discount needs approval, and explains why.

**Technical:** A pure module. `score_quote(policy, quote, rep_history) → RiskResult`. No I/O of any kind. Every input arrives as a parameter; the same inputs always produce the same output.

**Why it matters more than any other file:** [`scoring.py:1-32`](backend/engine/scoring.py) carries a docstring stating this rule, because breaking it destroys the product. If someone adds a database read inside `score_quote()`, the Policy Simulator becomes impossible and the demo loses its centrepiece.

### 2.2 The four terms

The score blends four **orthogonal** signals. Orthogonal matters — each catches something the others cannot.

| Term | Plain English | Technical | Catches |
|---|---|---|---|
| **S** Severity | "One line is way over the limit" | `max(over_i)` across lines | The flagrant single breach — PS §10's Setup Service |
| **A** Aggregate | "Lots of lines are a bit over, and it adds up" | `Σ(over_i × revenue_weight_i)` | **The blended requirement.** 2+3+2 points spread across an order |
| **L** Leakage | "How much money did we actually give away" | `Σ leaked / order_gross_margin` | Absolute exposure, not just percentages |
| **Z** Behavioural | "This is unusual *for this rep*" | robust z-score vs their own history | PS §B9's "discount well above a rep's historical average" |

```
score = 100 × ( 0.35·norm(S) + 0.30·norm(A) + 0.20·norm(L) + 0.15·norm(Z) )
```

Normalisation caps (`caps` in the policy, [`scoring.py:520`](backend/engine/scoring.py)):
`S_cap = 20 pts` · `A_cap = 5 pts` · `Z` maps `[1σ, 3σ] → [0, 1]`

**Routing bands** — rows in the policy, not constants:

| Score | Route |
|---|---|
| < 20 | Auto-approve |
| 20 – 60 | Sales Manager |
| ≥ 60 | Sales Manager → Finance |
| *any line ≥ 15 pts over* | **Hard override → Finance** regardless of score |

### 2.3 The effective ceiling — the mechanic judges will probe

```python
ceiling = min(tier_ceiling[tier], category_ceiling[category])
```
[`scoring.py:155`](backend/engine/scoring.py)

**Plain English:** A Gold customer is allowed 15%. But Services are only allowed 10% because they're thin-margin. The *stricter* limit wins, so a Services line on a Gold order is governed at 10%.

**The subtlety I hit while building this:** category ceilings can only **restrict**, never **grant**. Setting Software to 20% while the top tier caps at 15% does *nothing* — the tier still binds. That's dead config, and an admin who writes it will think a rule is active when it isn't. So `dead_config_warnings()` ([`scoring.py:172`](backend/engine/scoring.py)) detects and surfaces it on the admin screen.

> **If asked "why min()?"** — because PS §10 describes categories as *further restrictions* on the tier allowance, not as escalations above it.

### 2.4 Why MAD instead of standard deviation

**Plain English:** We measure "unusual for this rep" using the median rather than the average, because averages get dragged around by the very outliers we're hunting.

**Technical:** `robust_z()` ([`scoring.py:76`](backend/engine/scoring.py)) uses `(x − median) / (1.4826 × MAD)`, where MAD is the median absolute deviation. The 1.4826 constant makes MAD comparable to σ for normally-distributed data.

**Why:** One wild 30% quote inflates a rep's σ enough to make the *next* wild quote look normal. That's precisely the failure mode an anomaly detector must not have.

### 2.5 Honest degradation — the branch worth demoing on purpose

`robust_z()` returns `None` in two cases: fewer than 5 prior orders, or MAD = 0 (rep gave the identical discount every time).

When that happens, `score_quote()` **drops the Z term and renormalises the surviving weights to sum to 1** ([`scoring.py:~340`](backend/engine/scoring.py)), then attaches a note:

> *"Insufficient rep history (3 prior orders) — scoring on policy components only."*

**Why renormalise rather than just skip?** If we dropped Z's 0.15 weight without redistributing it, every score for a new rep would be silently 15% lower — meaning **a brand-new rep could discount more freely than a veteran**. That's a real governance bug, not a cosmetic one.

**Demo this deliberately** (Q-1047, rep S. Nair). A model that says out loud what it doesn't know reads as trustworthy.

### 2.6 Attribution is exact, not estimated

```python
contributions = {k: 100 × weight[k] × term[k] for k in terms}
```

`sum(contributions.values()) == score`, always. Asserted in [`test_scoring.py::test_contributions_sum_exactly_to_score`](backend/tests/test_scoring.py).

> **If asked "is this SHAP?"** — *"For an additive model, Shapley values reduce in closed form to each term's contribution, so we compute them exactly rather than sampling."* That's true and it's a strong answer.

### 2.7 Worked example — memorise this

**Q-1042 / Acme Corp (Gold)** — PS §10's example, verbatim:

| Line | Category | Qty × Price | Given | Allowed | Over |
|---|---|---|---|---|---|
| Laptop Pro 14 | Hardware | 2 × ₹1,250 | 12% | 15% | 0 ✅ |
| Onsite Setup Service | Services | 1 × ₹400 | 18% | **10%** | **8 pts** ❌ |
| Extended Warranty | Hardware | 1 × ₹180 | 15% | 15% | 0 ✅ |

**Result: score 25.9 → MANAGER.** Contributions: `S=14.0 · A=6.23 · Z=5.03 · L=0.59`

Severity dominates — correct, because this quote's story *is* the single ceiling breach.

### 2.8 The differentiator — Q-1039

**Q-1039 / Beta Industries.** Four lines, over by **3, 2, 3, 2** points. Nothing dramatic anywhere.

**Result: score 22.1 → MANAGER.** Contributions: `A=15.37 · S=5.25 · L=1.49 · Z=0`

Every `max()`-based rule on earth auto-approves this quote. Ours flags it, and the aggregate term is 3× the severity term — so the contribution bar *visually explains itself*.

> **Show this for 15 seconds right after Q-1042.** It is the single cleanest proof we implemented PS §10's actual requirement rather than a threshold with extra steps.

### 2.9 `coach()` — the same engine, inverted

**Plain English:** "Drop Onsite Setup Service to 10% and this quote auto-approves."

**Technical:** [`scoring.py:400`](backend/engine/scoring.py). Score is monotonic in any single line's discount, so we binary-search each line (24 iterations) for the highest discount that still reaches the target band, round down to a clean 0.5% step, and verify.

**Two design decisions I'd expect to be asked about:**

1. **Prefers lines that are actually over their ceiling.** The naive "cheapest cut" answer suggested trimming a *compliant* Laptop line — because lowering the order-wide discount cheaply reduces the Z term. Technically it works; as advice it's useless, and a rep who follows it and gets flagged again stops trusting the coach.

2. **Advice is capped at the ceiling.** The band edge and the ceiling are different numbers. Because the score is blended, a small line can sit 6 points over policy and still land under the AUTO threshold once revenue-weighted. Coaching to *that* number means telling a rep *"stay over policy, you'll slip through"* — which is the exact behaviour this product exists to stop.

---

## 3. The Policy Simulator — the moat (`api/services.py:145`)

### What the audience sees

Admin drags the Services ceiling 10% → 8%. **Before saving**, the open pipeline re-scores live: cards flip colour, band counters roll, and a headline appears:

> **"Re-routes 4 of 15 open deals · exposes ₹846 of leaking margin"** — in **~4 ms**

### What the code does

```python
proposed = live_policy.clone(**overrides)      # a COPY. nothing persisted.
for q in all_quotes():
    before = score_quote(live_policy, q, history)
    after  = score_quote(proposed,    q, history)
    ...classify: escalated / relaxed / unchanged
```

That's it. **The entire moat is a for-loop**, possible only because `score_quote` takes policy as an argument and touches no I/O.

### Why this is the winning feature

1. **Faking it is strictly harder than building it.** A blast-radius preview requires the scorer to be genuinely re-invokable against uncommitted state. You cannot hardcode "3 turn red" and survive a judge dragging the slider to an arbitrary value.
2. **It costs almost nothing** — the same function, in a loop.
3. **It pre-empts the §7 interrogation.** When asked "is this hardcoded?", the answer is a gesture, not a sentence.

### ⚠️ A directional fact you must know before rehearsing

**Tightening a ceiling can only ever raise scores.** A single downward drag therefore produces **escalations only** — never a green flip. (CLINCH.md originally called for "3 red, 1 green"; that's directionally impossible and I corrected it.)

To show two-way movement, **drag the slider back**. The reverse ripple is the cleanest possible non-hardcoded proof. Keep it in reserve for Q&A rather than spending it in the scripted 15 seconds.

`clone()` is defensive — [`test_scoring.py::test_simulation_does_not_mutate_the_live_policy`](backend/tests/test_scoring.py) asserts that mutating a simulated policy can't corrupt the live one. Without that, a judge playing with the slider silently poisons the demo database.

---

## 4. The Recommender (`engine/recommender.py`)

**Plain English:** "73% of orders containing a laptop also contain a docking station" — learned from 120 historical orders, not typed into a lookup table.

**Technical:** Association-rule mining. Precompute an item-pair co-occurrence index at startup ([`build_index()`](backend/engine/recommender.py)), then for each candidate:

```
support(j)       = orders with j / all orders
confidence(C→j)  = orders with C and j / orders with C
lift(C→j)        = confidence / support(j)
```

**Lift is the number that matters.** A docking station appearing in 40% of *all* orders isn't interesting. It's interesting because it appears in 73% of orders that contain a laptop — lift 2.6×.

### Three filters, each defensible

| Filter | Value | Why |
|---|---|---|
| **Margin floor** | ≥25% margin | PS §A6 explicitly requires it. Hard filter, applied before ranking |
| **Minimum pair count** | ≥5 co-occurrences | Standard apriori guard. A pair seen twice in 120 orders can show spectacular lift *by accident* |
| **Minimum confidence** | ≥15% | Stops 7%-confidence coincidences reaching a rep's panel |

I added the last two after seeing 7% and 9%-confidence suggestions surface. *"Why is a 7%-confidence pairing being recommended to me?"* is a fair hit, and now it can't happen.

### Ranking uses margin **rate**, not rupees

```python
rank = lift × margin_pct × (1.15 if promoted else 1.0)
```

**Why:** ranking by absolute margin made a ₹5,400 Support SLA outrank the laptop's actual companion products every time. That collapses into *"sorted by price with a lift column decorating it"* — exactly how a sharp reviewer would characterise it. Using the rate keeps lift load-bearing. The absolute ₹ figure is still what we **display**, because that's the number a rep acts on.

### The `basis` field — small honesty that matters

The response carries `basis: "co-purchase" | "promoted" | "none"`, and **the UI labels the panel from it**. Showing "Frequently bought together" above results derived from nothing but a promo flag is a small lie — and a reviewer who adds one obscure item to an empty cart will catch it.

---

## 5. The Portal Boundary (`api/routers.py:~590`)

PS §7 requires *"a real, separate, restricted view, not just another internal screen with a different label."* This is graded, and a judge will open DevTools.

### How it's enforced

**Not** by hiding fields in the UI. **Not** by filtering the internal object. The portal handler **builds a fresh dictionary field by field**, containing only customer-facing data.

```
Internal  /quotes/Q-1042  →  cost, margin, risk_score, ceiling, over, rep, contributions
Portal    /portal/{token} →  name, qty, unit_price, discount_pct, line_total
```

**Why structural rather than filtered:** if we filtered a shared object, adding a field internally next week would silently leak it. Building a separate structure means a leak requires someone to *deliberately type the field name* into the portal handler.

[`test_api.py::test_portal_payload_cannot_leak_internals`](backend/tests/test_api.py) asserts on the **serialised bytes** — it catches a leak no matter how it got there. The same test then confirms the internal endpoint *does* carry those fields, proving the difference is real redaction rather than an accident of this quote having no margin.

### Rehearsed demo move (10 seconds)

DevTools → Network → the portal payload → *"The margin field doesn't exist in this response. It isn't hidden by CSS — the serialiser can't emit it."*

### The negotiation loop (rubric step 7)

`POST /portal/{token}/request` with a counter-offer:
1. Quote enters **NEGOTIATION** (legal from APPROVED/CONFIRMED)
2. Re-scored **as if the counter were accepted**
3. If the new band ≠ AUTO → **automatically** moves to PENDING_MANAGER, no rep action

> A test caught me jumping straight to PENDING_MANAGER, skipping NEGOTIATION. Going through it keeps the audit trail's ordering honest: the customer asked, *then* the system re-routed.

---

## 6. State, Audit & Guardrails (`api/state.py`)

### The state machine

```
DRAFT → PENDING_MANAGER → PENDING_FINANCE → APPROVED → CONFIRMED
                                                → FULFILLED → INVOICED → PAID
  ↕ NEGOTIATION (re-entrant, per PS B8)
  ↓ REJECTED / returned to DRAFT
```

Defined once in [`schemas.py:LEGAL_TRANSITIONS`](backend/api/schemas.py) so the UI and server cannot drift.

**Illegal transitions return `409`** — never 500, never silent success — with the legal set attached:

```json
{ "error": "illegal_transition", "current_state": "PAID",
  "attempted": "APPROVED", "allowed": [] }
```

The UI derives button state from `allowed_transitions`, so illegal actions are **disabled with a reason** ("Already approved by M. Shah, Aug 21"). A disabled button that explains itself reads as rigour; a missing one reads as an unfinished screen.

**Why this is the highest-stakes guardrail:** a judge approving twice or hitting browser-back is the one failure that's *unrecoverable mid-demo* — it poisons every subsequent step. A crashed narrator embarrasses you for ten seconds; corrupted state ends the run.

### Idempotency

`approve`, `confirm` and `payment` accept an `idempotency_key`. Replaying returns the identical response rather than double-writing. A double-click on a projector is a real hazard.

### The audit spine

`deal_events` is **append-only** — every mutation writes actor, role, event type, reason, timestamp (PS §A3). Three other features are projections of it, for free:

- Approval history table (screen 5)
- Real-time dashboard (via SSE fan-out)
- Stall detector (`now − max(event.timestamp)`)

Deciding this at hour 0 was free; retrofitting it at hour 20 would have been impossible.

### `POST /admin/reset`

Restores golden state in **0.19 ms**. This is a demo guardrail, not a convenience. Rehearse the line: *"Let me reset to a clean state — one click."* That reads as production tooling; debugging on stage does not.

---

## 7. Request Walkthroughs

### "Rep changes a discount"

```
PATCH /quotes/Q-1042/lines
  → resolve tier ceiling ∩ category ceiling  → effective ceiling
  → score_quote(policy, quote, rep_history)  → S, A, L, Z → score → band
  → coach(...)                                → "10% would auto-approve"
  → recommend(...)                            → lift-ranked upsells
  → state.record(...)                         → deal_events row
  → state.publish(...)                        → SSE to every open dashboard
```
UI paints optimistically first, then reconciles — that's where the "instant" feel comes from, not from server speed.

### "Admin drags the ceiling slider"

```
POST /policy/simulate  { category_ceiling: { Services: 8 } }
  → policy.clone(overrides)          ← nothing saved
  → 15 × score_quote(proposed, ...)  ← ~4 ms total
  → classify escalated/relaxed, sort movers first
  → headline string
```
Nothing persists until `PUT /policy`, which bumps `version` and writes a `policy_changed` event.

### "Customer counters from the portal"

```
POST /portal/{token}/request  { line_id, counter_discount_pct }
  → state → NEGOTIATION
  → re-score AS IF accepted
  → band ≠ AUTO?  → PENDING_MANAGER, automatically
  → deal_events: countered, then submitted (System)
```

---

## 8. Numbers to Have Memorised

| Thing | Value |
|---|---|
| Leakage headline | **₹31,080** across **120** closed orders (2.74% of gross margin) |
| Open pipeline | ₹242,351 · 15 quotes · 1 stalled |
| Band split | AUTO 7 · MANAGER 6 · FINANCE 2 |
| Q-1042 | 25.9 → MANAGER, driven by **S** (14.0) |
| Q-1039 | 22.1 → MANAGER, driven by **A** (15.37) |
| Simulator ripple | **4 of 15** re-route · ₹846 exposed · **4 ms** |
| Demo reset | 0.19 ms |
| Tests | 43 (23 engine, 20 API) |

> The leakage figure is **computed from the seeded history, never hardcoded**. If a judge asks where it comes from, the answer is a query. Never quote an external industry statistic — one "source?" kills momentum.

---

## 9. Judge Q&A Drill

| Question | Answer |
|---|---|
| *Is the score hardcoded?* | "Rather than tell you — let me show you." → **run the simulator** |
| *Is this real ML?* | "Transparent additive model plus item-item association rules. We chose explainability deliberately: a manager has to justify a routing decision to a rep, and a black box can't. Being additive, Shapley values reduce in closed form, so attribution is exact rather than estimated." |
| *Why not just use the worst line?* | "PS §10 warns against exactly that. Three lines at 2, 3 and 2 points over pass every `max()` rule while giving away real margin — that's our aggregate term." (Quoting their own document back, accurately, lands hard.) |
| *How is the portal actually separate?* | DevTools → payload → "the margin field doesn't exist here" |
| *What if a rep is new?* | "We drop the behavioural term and renormalise, and say so in the UI." → point at the chip |
| *Why MAD, not standard deviation?* | "One outlier inflates σ enough to hide the next outlier — the exact failure an anomaly detector can't have." |
| *Why is that item recommended?* | Point at the reason line: confidence %, lift, and margin, all on the card |
| *What would you build next?* | "The data model is already isomorphic to the standard Sales/Inventory/Subscription object graph, so the next step is packaging the engine as a drop-in module that decorates the existing quotation object. The scorer is a pure function with no UI coupling — it ports as-is." |

---

## 10. What's Real vs Stubbed — be honest about this

Judges respect a clear answer far more than a vague one. `GET /_status` shows the live board.

**Real (9):** score · coach · recommend · policy (get/put) · policy/simulate · portal read · events/stream · admin/reset

**Stubbed (19):** auth · products · quotes CRUD · submit · approvals · warehouses/split · subscriptions · invoices/payment · dashboard · reports

**How to say it:** *"The intelligence layer is real today. The CRUD around it returns contract-shaped fixtures so the UI could be built in parallel — each one swaps to a real handler without changing a response shape."*

Note the stubs aren't dumb: `submit` routes off the **real score**, the dashboard's leakage is **genuinely computed**, and the state machine is **fully enforced**.

---

## 11. Glossary — you must be able to define these cold

| Term | One-line definition |
|---|---|
| **Blended risk score** | 0–100 number combining four signals to decide approval routing |
| **Effective ceiling** | The stricter of the customer-tier limit and the product-category limit |
| **Overage** | Points a line's discount exceeds its effective ceiling |
| **Revenue weight** | A line's share of order revenue; how the aggregate term is weighted |
| **Leakage** | Currency discounted beyond policy — `overage% × list × qty` |
| **Robust z-score** | Deviation measured with median/MAD instead of mean/σ |
| **MAD** | Median absolute deviation — outlier-resistant spread measure |
| **Additive attribution** | Each term's exact contribution; sums to the score |
| **Lift** | How much more likely item B is given item A, vs B's baseline rate |
| **Confidence** | P(B | A) — share of A-orders that also contain B |
| **Support** | Share of all orders containing an item |
| **Band** | Routing outcome: AUTO / MANAGER / FINANCE |
| **Hard override** | Any line ≥15 pts over forces Finance regardless of score |
| **Idempotency key** | Token making a repeated request safe to replay |
| **SSE** | Server-Sent Events — one-way live push over plain HTTP |
| **Dead config** | A policy row that can never fire (category ceiling above every tier) |

---

## 12. File Index

| File | Lines | What it owns |
|---|---|---|
| [`engine/scoring.py`](backend/engine/scoring.py) | 548 | **The core.** Score, ceilings, attribution, coach, Policy |
| [`engine/recommender.py`](backend/engine/recommender.py) | 222 | Association rules, lift, margin filtering |
| [`api/schemas.py`](backend/api/schemas.py) | 504 | The frozen contract + state machine table |
| [`api/fixtures.py`](backend/api/fixtures.py) | 378 | Demo data; every dramatic beat is engineered here |
| [`api/routers.py`](backend/api/routers.py) | 668 | 28 endpoints across 6 routers |
| [`api/services.py`](backend/api/services.py) | 229 | Totals, narrator, leakage, **simulate()** |
| [`api/state.py`](backend/api/state.py) | 144 | Policy, states, audit log, SSE, reset |
| [`api/registry.py`](backend/api/registry.py) | 100 | Real-vs-stub integration board |
| [`backend/verify.py`](backend/verify.py) | 60 | **Pre-demo smoke check — run before every rehearsal** |
| [`CONTRACTS.md`](CONTRACTS.md) | — | What the team codes against |

### Commands

```bash
cd dealflow360/backend && ../.venv/Scripts/python.exe verify.py
```

```bash
cd dealflow360/backend && ../.venv/Scripts/python.exe -m pytest -q
```

---

## 13. Known Gaps — say these before a judge finds them

1. **Frontend not started.** Next up: Quotation Builder, then the Policy Simulator screen.
2. **19 endpoints still stubbed** — see §10 for the honest framing.
3. **In-memory state**, not SQLite yet. Response shapes are frozen, so the swap is invisible to the UI.
4. **Narrator is template-based**, not LLM. Deliberate: the LLM is an upgrade behind a 3s timeout, never a dependency. The template output is often better anyway.
5. **Warehouse split is greedy**, not yet the exact 2^W subset enumeration (Santhosh's task).
