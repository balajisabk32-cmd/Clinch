# CLINCH.md — DealFlow360 Grand-Prize Battle Plan

> **Team:** Balaji · Nithin · Santhosh · Prabanjan
> **Tooling:** Balaji — Claude Pro | Nithin, Santhosh, Prabanjan — Gemini Pro
> **PS:** DealFlow360 — An Intelligent, Self-Governing Sales Operations Platform
> **Status:** Supersedes the v1 build plan. This is the execution contract. Read §4 and §5 aloud before writing a line of code.

---

## 0. The One-Line Thesis

> Every other team will build a **quotation form with an approval status field**.
> We build a **governance engine** — a pure function `(policy, quote, rep_history, stock) → decision + explanation` — and then we *prove* it is a real function by changing the policy live on stage and watching the entire pipeline re-decide itself.

Everything below serves that one sentence.

---

# 1. Core Problem Deconstruction

## 1.1 Root Pain Point — Who Actually Bleeds

The PS lists five roles. Only one is the *real* victim, and naming them correctly is the difference between a demo that shows features and a pitch that lands.

| Role | Surface complaint | Actual economic damage |
|---|---|---|
| Sales Rep | "Approvals are slow" | Cycle-time drag. A quote waiting on a manager is a quote the customer is re-shopping. Latency, not loss. |
| **Sales Manager / Deal Desk** | **"I approve everything, so I review nothing"** | **THE ROOT PAIN.** They are a human rubber stamp positioned as a control. Every quote routes to them; nothing tells them which of the 40 in the queue is actually dangerous. Approval becomes a formality, governance collapses, margin leaks silently. |
| Finance | "Margin came in under plan again" | Discovers leakage in the rear-view mirror at month-end close, when nothing can be recovered. |
| Customer | "Why does a 3-line change take 4 days?" | Email ping-pong. Every round-trip is a chance to churn to a competitor. |
| Admin | "The rules live in my head and a spreadsheet" | Policy is undocumented, unenforced, unauditable. |

**The sentence for the judges:**

> *"Discount approval today is a queue, not a filter. Managers approve 100% of what they see because nothing tells them which 8% is actually dangerous. DealFlow360 turns that queue into a ranked, explained, self-routing filter."*

### The Economic Cost — Computed, Not Claimed

Do **not** quote an industry statistic on stage. Judges discount external numbers instantly, and one skeptical "source?" kills momentum. Instead:

> **Compute the leakage number from our own seed data, live, on screen.**

We seed ~120 historical orders with realistic rep-level discounting behaviour. The platform then computes, as a first-class metric on the Deal Health dashboard:

```
Policy Leakage = Σ over all lines [ max(0, discount_given − ceiling_applicable) × list_price × qty ]
Leakage Ratio  = Policy Leakage / Total Gross Margin
```

On stage this renders as a live counter: **"₹18.4L given away beyond policy across 120 closed deals — 6.2% of gross margin."** That number is derived from data in the room, is trivially defensible ("here's the SQL"), and reframes the product from "nice CRM screen" to "this recovers money."

> ⚠️ **₹18.4L / 6.2% are placeholders.** Use whatever the seed actually computes — never hardcode this figure. §9 specifies the seed so the computed number lands in a credible band. If a judge asks how it was derived and the answer isn't a query, the entire pitch inverts on you.

Three cost buckets we quantify in-product:

1. **Leakage** — currency discounted beyond the applicable ceiling. *The headline number.*
2. **Latency** — median hours in `Pending Approval`; dashboard shows the distribution and flags the tail.
3. **Stall attrition** — count and value of quotes with zero activity for > N days (N configurable, per §B9).

### Why Existing Solutions Fail

| Incumbent | How it fails, precisely |
|---|---|
| **Spreadsheet + email approval** | No audit trail, no ceiling enforcement, no stall detection. Policy exists only as tribal knowledge. |
| **Generic CRM discount field** (HubSpot / Zoho / Pipedrive) | Discount is *a number on a record*, not *a governed quantity*. No ceiling, no category-awareness, no routing. |
| **Enterprise CPQ** (Salesforce CPQ, Oracle CPQ, Conga) | Three concrete failures: **(a)** approval rules are static per-line boolean triggers — `IF line.discount > tier.max THEN escalate` — which is exactly the `max()` failure mode the PS calls out in §10; **(b)** rule authoring is a multi-week admin project, so policy ossifies and stops matching reality; **(c)** the decision is opaque to the rep — they learn *that* they were blocked, never *why*, and never *what would unblock them*. |
| **All of the above** | **None close the customer loop.** The quote leaves the system as a PDF and returns as an email. Negotiation happens *outside* the governed system, so the counter-offer is never re-scored. The PS's B8 → B4 auto-re-entry requirement exists precisely because this gap is universal. |

**The gap, in one line:** *incumbents check the worst line; the PS demands you check the pattern.*

## 1.2 Unspoken Needs — What Judges Grade That the PS Doesn't Say

The PS is unusually generous with tells. Each of these is a near-certain grading axis.

**① §7 is a warning, not a guideline.**

> *"Core business rules... must be implemented in application logic, not hardcoded or faked for the demo."*

Translation: **a judge will try to break your engine with inputs you didn't rehearse.** They will open the admin screen, change a ceiling, and check whether anything downstream actually moves. Most teams fail here because their "risk score" is `if discount > 15: return "HIGH"`.

→ **Counter:** §2's 10x Angle is engineered specifically to pre-empt *and weaponize* this test.

**② §7 line 3 is an auth-boundary test.**

> *"The customer facing negotiation screen must be a real, separate, restricted view, not just another internal screen with a different label."*

Translation: a judge will open DevTools on the portal and hunt for cost, margin, internal notes, other customers' quotes, or a role flag to flip. Teams that render the internal component behind `{isCustomer && ...}` guards get caught.

→ **Counter:** enforce at the **serializer**, not the component. The portal endpoint returns a distinct DTO that *structurally cannot contain* `cost_price`, `margin`, `risk_score`, or `internal_notes`. Portal tokens are HMAC-signed and scoped to a single quote id. Rehearse a 10-second move: DevTools → Network → show the portal JSON → *"the margin field doesn't exist in this response; it isn't hidden by CSS."*

**③ §9 "Quick Test Flow" is the judging rubric, printed.**

Eight steps, and the PS says *"Each step should produce a visible, correct result before moving to the next one."* This is the script judges will run. Two traps hide inside it:

- **Step 5** says *"splitting across two warehouses if needed."* Your seed data **must** contain a product whose demand exceeds any single warehouse's stock, so the split is forced and visible. Design the seed for this deliberately.
- **Step 8** says *"record a payment, and check that the invoice status updates."* **Invoicing and payment are barely present in §4's module list** — they appear only in §5, §9, and wireframe screens 12–13. Most teams build to fulfilment and stop. Shipping Invoice → Register Payment → `Unpaid → Paid` is **cheap** (one table, one endpoint, one enum) and separates us from the field on the rubric's final step.

**④ Audit trail is a hidden architecture requirement.**

> §A3: *"All approvals, rejections, and edits must be logged with user, timestamp, and reason."*

An append-only event log is the honest implementation. Build it that way and three other requirements become free: the approval history table (screen 5), the real-time dashboard (screen 14), and the stall detector (`now − max(event.ts)`). Retrofitting this at hour 20 is impossible; deciding it at hour 0 is free. **Non-negotiable.**

**⑤ Explicit bonus points are on offer.**

> §7: *"Multi currency or multi company support is a bonus, not a requirement."*

Multi-currency is ~90 minutes *if* the schema carries `currency` + `fx_rate_to_base` from hour 0 and the price list already keys on currency (which §A2 requires anyway). Take the free points. **Do not** attempt multi-company.

**⑥ Non-code deliverables are graded.**

§8 lists four deliverables; two are documents — the **one-page architecture diagram** and the **"what we'd build next" note**. Teams that code to the last second and skip these lose points they never see. Both are owned and time-boxed in §4.

**⑦ Fidelity to the provided mockup is free credit.**

The wireframe pack specifies small things: `Reload Data`, `Close Workspace`, `Switch to Table View`, `Filter: Pending Only`, `Export PDF / Export XLS`, `Nudge Rep`, `Escalate`. Minutes each, and they signal *"we read the spec."* Judges notice when your screen matches theirs.

**⑧ The demo must survive being driven by someone else.**

Judges take the mouse. Anything that only works in the rehearsed order is a liability. See §5.

## 1.3 Sponsor / Platform Tie-In

**High-confidence read: this is an Odoo-affiliated hackathon.** The evidence:

- The project directory is literally `Desktop/Odoo`.
- The PS's domain model maps one-to-one onto Odoo's Sales stack: **price lists**, **product variants with attribute extra-price**, **multi-warehouse stock with replenishment rules**, **recurring plans with proration**, **credit notes**, **quotation → sales order → invoice → payment**. That exact vocabulary set is Odoo's, not Salesforce's or SAP's.
- The wireframe top-nav (Quotations / Approvals / Fulfilment / Subscriptions / Invoices / Reports) mirrors Odoo app-switcher ergonomics.

**Strategy — mirror the model, do not build on the platform.**

Building an actual Odoo module in 24 hours is a trap: environment setup, ORM learning curve, and XML view authoring will eat the entire budget, and §7 explicitly frees us from any platform. Instead:

1. **Name our entities after theirs.** `sale_order`, `sale_order_line`, `product_template` / `product_variant`, `stock_quant`, `account_move` (invoice), `account_payment`, `res_partner` (customer). Zero cost, instant recognition — a judge from that ecosystem reads our schema and immediately understands it.
2. **Put the mapping on the architecture diagram** as a side column: `our table → equivalent standard ERP object`. Reads as domain fluency, not mimicry.
3. **Make it the headline of the "what we'd build next" note:** *"Our data model is already isomorphic to the standard Sales/Inventory/Subscription object graph, so the natural next step is packaging the governance engine as a drop-in module that decorates the existing quotation object rather than replacing it. The scoring engine is a pure function with no UI coupling, so it ports as-is."* Written for one specific judge. It will land.
4. **Match the visual grammar** on internal screens (dense list views, status pills, breadcrumb + tab chrome — the wireframe already does this). Save the high-design treatment for the **customer portal**, where a deliberate visual break is *required* by §7. This is a design decision with a spec justification — say that out loud in the demo.

**Hedge:** if the sponsor read is wrong, all four actions remain net-positive (clean domain naming, better diagram, stronger next-steps note, coherent visual system). Zero downside. Proceed.

### Inferred Judging Weightage — and Where We Over-Invest

| Axis | Est. weight | Our play |
|---|---|---|
| Business-logic depth (§7 "not hardcoded") | **Highest** | The 10x Angle exists solely to prove this |
| End-to-end completeness (§9's 8 steps) | High | Steps 5 and 8 are the differentiators — build the invoice/payment tail |
| Customer-portal separation (§7) | High | Server-side DTO redaction + rehearsed DevTools proof |
| Wow / novelty | High | Policy Simulator + counterfactual coaching |
| UI/UX polish | Medium | Two screens beautiful, four screens clean — never six screens mediocre |
| Architecture & data model (§8 diagram) | Medium | Owned deliverable, time-boxed, not an afterthought |
| Bonus (multi-currency) | Low | Only if P1 lands early |

---

# 2. Competitive Moat & The Wow Factor

## 2.1 What ~800 Teams Will Build (and why we win on contrast)

Predicted median submission: a CRUD quotation builder, a hardcoded discount threshold, a static upsell lookup table, a warehouse split that picks the first warehouse with stock, a subscription line that displays a monthly price with no proration arithmetic, and a dashboard of three static KPI cards. It will work exactly once, in exactly one order.

Our contrast is not "more features." It is **one claim, proven three ways**: *the logic is real.*

## 2.2 The 10x Angle — The Live Policy Simulator ("Governance Console")

**The feature:** the Discount Tier & Approval Chain setup screen (§A3, wireframe screen 18) is not a CRUD form. It is a **live control plane with a blast-radius preview.**

When an admin drags the **Services ceiling from 10% → 8%**, the screen immediately shows, *before saving*:

- **14 open quotations re-scored in real time**, rendered as a pipeline strip of cards
- **3 cards flip from `Auto-Approved` → `Finance Required`**, animating amber → red
- **1 card flips `Manager` → `Auto-Approved`**, animating green
- A summary line: **"This policy change re-routes 4 of 14 open deals and captures ₹2.1L of currently-leaking margin."**
- Buttons: `Apply Policy` / `Discard`

### Why this is the winning move — five reasons

1. **It is the §7 compliance test, turned into a feature.** The judge was going to ask *"is this hardcoded?"* We answer before they ask, at higher resolution than the question. You cannot fake a blast-radius preview: it requires the scorer to be a genuine pure function of `(policy, quote)` that can be re-invoked N times against uncommitted policy. **Faking it is strictly harder than building it.**
2. **It costs almost nothing.** It is the *same scoring function*, executed in a loop over open quotes with an override policy object instead of the persisted one. If the engine is written correctly on the first try, the simulator is ~40 lines of backend and one screen. The entire moat is a *consequence of good architecture*, not extra scope.
3. **No other team will have it.** Everyone treats the config screen as boring plumbing to be built at hour 22. We treat it as the hero screen.
4. **It elevates the product category.** A quotation tool is a form. A tool where you can *reason about policy before committing to it* is a governance system. That reframing is what people remember.
5. **It gives the pitch its closing line:** *"Every other approval system tells you what happened. Ours tells you what would happen."*

### Supporting acts (same engine, more surface area)

These reuse identical machinery, so effort compounds instead of scattering:

- **Counterfactual coaching (rep-facing).** On the quote builder: *"Drop Setup Service to 10% and this quote auto-approves — you skip two reviewers and roughly 26 hours."* Computed by binary-searching the discount that lands the score just under the routing band. Same function, inverted.
- **Exact additive attribution ("why was I flagged").** Our score is a weighted sum, so each component's contribution is exactly computable — no sampling, no approximation. Rendered as a stacked contribution bar. **Judge-ready line:** *"For an additive model, Shapley values reduce in closed form to each term's contribution, so we compute them exactly rather than estimating them."*
- **Deal Time Machine.** Because state is event-sourced, a timeline scrubber replays any deal's state at any past timestamp. Free consequence of the audit-trail architecture; enormous perceived depth. *(P2 — build only if P1 lands early.)*

## 2.3 The Magic Moment — 15 Seconds, Second by Second

Placement: **~2:10 into a 5-minute demo**, immediately after establishing that Q-1042 is flagged and *why*. The audience already understands the rules; now we break their model of what the software is.

| t | On screen | Spoken |
|---|---|---|
| **0–2s** | Admin → Discount Tiers. Right pane shows 14 live open quotes as a pipeline strip. | "This is our policy screen. But watch the right-hand side." |
| **2–5s** | Cursor grabs the **Services ceiling** slider. Drag `10% → 8%`. *No save. No reload.* | "I'm tightening the Services ceiling by two points." |
| **5–9s** | **The pipeline re-scores live.** Three cards animate amber → red, badges flip `Auto-Approved → Finance Required`. One card animates → green. Counters at top roll: `Auto 9 → 6`, `Finance 2 → 5`. | *(silence — let it land)* |
| **9–12s** | Summary line types in: **"Re-routes 4 of 14 open deals · recovers ₹2.1L of leaking margin."** | "Four deals just re-routed themselves. Nothing was saved yet — this is a preview." |
| **12–15s** | Click one newly-red card → drills straight into its explainability panel, contribution bar already rendered. | "And every one of them can tell me exactly why." |

**Why this specific 15 seconds proves depth:** it demonstrates, without a word of explanation, that (a) the scorer is a pure function callable against hypothetical state, (b) it evaluates the *whole order pattern*, not one line, (c) the system holds real portfolio state rather than one rehearsed record, and (d) the explanation is generated, not written. Four architectural claims, zero slides.

**Rehearsal rules:**
- The slider drag must be **one continuous motion**. Practise it 20 times.
- The re-score must complete in **< 400 ms**. Pre-warm the open-quote set into memory at page load; the simulator hits an in-memory list, never a cold query.
- **Say nothing between 5s and 9s.** The silence is the point.
- Have the exact slider position marked. Do not hunt for the number on stage.

---

# 3. Architecture & Tech Stack

## 3.1 Selection Principles

Chosen for: **dev speed with a Gemini-assisted team**, **zero deployment risk** (nothing cloud-dependent during judging), **sub-100 ms interactions**, and **a schema that survives contact with a judge's curiosity.**

| Layer | Choice | Why this, and what we rejected |
|---|---|---|
| **Backend** | **FastAPI + Pydantic v2 + SQLModel** | Auto-generated OpenAPI → the frontend gets a typed client for free, which makes the P0 mock-layer swap a config change rather than a refactor. Pydantic gives validation for free. Python keeps the statistical work (robust z-scores, association rules) honest and short. *Rejected: Node/Express + Prisma — loses the stats ergonomics and the free OpenAPI contract that decouples our team.* |
| **Database** | **SQLite (WAL mode)**, Postgres-compatible DDL | Zero install, zero service to start, and **the seeded `.db` file is a committable artifact** — any laptop reproduces the exact demo state in seconds. This is a demo-safety decision as much as a speed one. *Rejected: Postgres/Docker — a container that won't start at hour 23 is how teams lose.* |
| **Frontend** | **Vite + React 18 + TypeScript + Tailwind** | Fastest HMR available; TS catches contract drift between Balaji's UI and three teammates' endpoints. |
| **Server state** | **TanStack Query** | Caching + optimistic updates + auto-refetch. The "instant margin update" feel comes from optimistic mutation, not from a fast server. |
| **Client state** | **Zustand** | One store, no boilerplate. *Rejected: Redux Toolkit — ceremony we cannot afford.* |
| **Motion** | **Framer Motion** in-app; GSAP + Lenis only on the pitch/landing page | Framer's `layout` + `AnimatePresence` handle number rolls, card re-colors, and list reshuffles — exactly our magic moment. GSAP's scroll machinery is wrong for a data app. |
| **Charts** | **Recharts** | Fast to wire, adequate for dashboard needs. |
| **Realtime** | **SSE** (`GET /events/stream`) + TanStack polling fallback | ~20 lines in FastAPI, no extra infra, survives any proxy. *Rejected: WebSockets — connection lifecycle bugs are a hackathon time sink for zero visible gain.* |
| **LLM narrator** | One server-side endpoint, 3 s timeout, **deterministic template fallback** | See §5. The narrator must never be able to block a screen. |
| **Auth** | JWT with role claim (internal); HMAC-signed, quote-scoped magic-link token (portal) | Satisfies §7's "real, separate, restricted view" at the serializer layer. |
| **Export** | Print stylesheet + `window.print()` → PDF; `SheetJS` → XLS | §A7 asks for PDF/XLS export. This is 30 minutes total. *Rejected: server-side PDF rendering — a headless-browser dependency we do not need.* |
| **Fonts** | **Self-hosted woff2** (bundled, not CDN) | Venue wifi failing to fetch Google Fonts is a classic silent demo killer. Bundle them. |
| **Run** | One `start.ps1` → uvicorn + vite, both localhost | No internet in the critical path. Optional tunnel *only* to show the portal on a phone. |

## 3.2 System Topology

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  CLIENTS                                                                     │
│                                                                              │
│  ┌────────────────────────────┐        ┌─────────────────────────────────┐   │
│  │  INTERNAL SPA               │        │  CUSTOMER PORTAL SPA            │   │
│  │  React · Vite · TS          │        │  Separate route + separate DTO  │   │
│  │  Workspace · Builder ·      │        │  Single-quote scope             │   │
│  │  Approvals · Fulfilment ·   │        │  NO cost / margin / risk in     │   │
│  │  Subscriptions · Invoices · │        │  the payload at all             │   │
│  │  Deal Health · Admin        │        │                                 │   │
│  └────────────┬───────────────┘        └───────────────┬─────────────────┘   │
│               │ JWT (role claim)                        │ HMAC magic-link    │
└───────────────┼─────────────────────────────────────────┼────────────────────┘
                │                                         │
                ▼                                         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  API — FastAPI                                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ AUTH & DTO GUARD   role→serializer selection · portal DTO redaction    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ DOMAIN SERVICES                                                        │  │
│  │  quote_svc · approval_svc (state machine) · fulfilment_svc ·           │  │
│  │  billing_svc · invoice_svc · reporting_svc                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ★ INTELLIGENCE CORE — pure functions, zero I/O, zero ORM               │  │
│  │                                                                        │  │
│  │   score_quote(policy, quote, rep_history) → RiskResult                 │  │
│  │   recommend(cart, cooccurrence, promos, margin_floor) → Suggestion[]   │  │
│  │   split_order(lines, stock, ship_costs, objective) → Allocation        │  │
│  │   prorate(sub, change, today) → CreditNote                             │  │
│  │   coach(quote, policy) → counterfactual target discount                │  │
│  │                                                                        │  │
│  │   ↑ Because these take policy as an ARGUMENT and touch no database,    │  │
│  │     the Policy Simulator is a loop over them. That is the whole moat.  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ NARRATOR   LLM call · 3s timeout · template fallback · hash-keyed cache│  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ EVENT BUS → append-only deal_events → SSE fan-out to dashboards        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  SQLite (WAL)   ── committable golden snapshot for instant demo reset ──      │
│                                                                              │
│  res_partner · product_template · product_variant · price_list ·             │
│  discount_tier · category_ceiling · approval_rule · warehouse · stock_quant · │
│  sale_order · sale_order_line · allocation · backorder ·                      │
│  subscription · billing_schedule · account_move · account_payment ·           │
│  portal_comment · deal_events (APPEND-ONLY, the audit spine)                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

## 3.3 Data Flow — Ingestion → Inference → Action → UI

```
  Rep edits a line
        │
        ▼
  ┌───────────────┐   optimistic local recompute (instant paint, no round-trip)
  │ Quote Builder │──────────────────────────────────────────────┐
  └───────┬───────┘                                              │
          │ PATCH /quotes/{id}/lines                             │
          ▼                                                      │
  ┌────────────────────────────────────────────┐                 │
  │ INGEST  resolve price list → tier ceiling  │                 │
  │         → category ceiling → effective     │                 │
  │         ceiling = min(tier, category)      │                 │
  └───────────────┬────────────────────────────┘                 │
                  ▼                                              │
  ┌────────────────────────────────────────────┐                 │
  │ INFER (pure)                               │                 │
  │  score_quote → {score, band, per-component │                 │
  │                 contributions, per-line}   │                 │
  │  recommend   → ranked suggestions + lift   │                 │
  │  coach       → "10% would auto-approve"    │                 │
  └───────────────┬────────────────────────────┘                 │
                  ▼                                              │
  ┌────────────────────────────────────────────┐                 │
  │ ACT   route to band → write deal_event     │                 │
  │       → emit SSE                           │                 │
  └───────────────┬────────────────────────────┘                 │
                  ▼                                              ▼
  ┌────────────────────────────────────────────┐   ┌──────────────────────────┐
  │ UI  margin bar recolors · badge flips ·    │◄──│ reconcile server truth   │
  │     contribution bar redraws · dashboard   │   │ with optimistic paint    │
  │     card animates via SSE                  │   └──────────────────────────┘
  └────────────────────────────────────────────┘

  APPROVED → split_order → allocation + backorders → SSE
           → subscription lines → billing_schedule → account_move
           → payment → status Unpaid→Paid → SSE → dashboard
```

## 3.4 The Blended Risk Score — Specified Precisely

This is the technical heart. §10 of the PS demands the *pattern*, not the worst line. Our formulation, all weights and bands stored as **editable rows**, never constants:

For each line *i*:

```
ceiling_i      = min(tier_ceiling, category_ceiling[, product_override])
over_i         = max(0, discount_i − ceiling_i)                  # points over
weight_i       = line_revenue_i / order_revenue                  # revenue exposure
leak_i         = (over_i / 100) × list_price_i × qty_i           # currency given away
```

Four components:

| Component | Formula | What it catches |
|---|---|---|
| **S — Severity** | `max_i(over_i)` | The single badly-broken line (§10's Setup Service example) |
| **A — Aggregate spread** | `Σ_i (over_i × weight_i)` | **The "blended" requirement.** Many lines each slightly over — 2 + 3 + 2 points — that no `max()` rule would ever catch |
| **L — Leakage ratio** | `Σ leak_i / order_gross_margin` | Absolute money at risk, not just percentages |
| **Z — Behavioural anomaly** | robust z-score of this order's effective discount vs. the rep's trailing history: `(x − median) / (1.4826 × MAD)` | §B9's *"discount well above a rep's historical average."* MAD instead of σ so one outlier quote can't mask the next one |

```
RiskScore = 100 × ( w_S·norm(S) + w_A·norm(A) + w_L·norm(L) + w_Z·norm(Z) )
```

**Routing bands** (rows in `approval_rule`, per the wireframe's screen 18):

| Band | Route |
|---|---|
| score < 20 | Auto-approve |
| 20 ≤ score < 60 | Sales Manager |
| score ≥ 60 | Sales Manager → Finance |
| *hard override:* any single `over_i` ≥ 15 pts | Force Finance regardless of score |

**Explainability is exact.** Because the model is an additive weighted sum, each component's contribution *is* its term — Shapley values reduce to it in closed form. We render a stacked contribution bar plus per-line rows: `given / allowed / over / ₹ leaked`.

## 3.5 The Other Three Engines, Briefly

**Recommender (§A6/B5) — association-rule mining, not a lookup table.**
Precompute an item-item co-occurrence matrix over ~120 seeded historical orders at startup. For candidate *j* given cart *C*: `support(C→j)`, `confidence(C→j)`, `lift(C→j) = conf / support(j)`. Rank by `lift × margin_delta × promo_boost`, hard-filter by the **minimum margin threshold** §A6 explicitly requires. Show `lift` and `+₹ margin delta` on the card — visible reasoning beats a silent suggestion every time.

**Warehouse split (§A4/B6) — optimal, and honestly describable.**
Two objectives, both real:
- *Minimize shipments* → greedy set-cover: repeatedly take the warehouse covering the most remaining demand value.
- *Minimize cost* → `cost = Σ(ship_weight_w × units_w) + fixed_shipment_cost × |warehouses used|`. With W ≤ 5, **enumerate all 2^W warehouse subsets** (32 cases) and allocate greedily within each, then take the minimum. Judge-ready line: *"We enumerate the full subset lattice — it's only 2^W — so the warehouse-selection decision is exact, not heuristic."*
- Unmet demand → `backorder` rows → the `Consolidate Remaining Backorder` prompt §B6 requires.

**Proration (§A5/B7) — show the arithmetic.**
```
credit = unit_price × Δqty × (days_remaining / days_in_cycle)
```
Actual calendar day-count. Render the numerator and denominator in the UI (`18 / 30 days remaining`) — judges check math, and visible arithmetic is unfalsifiable. Mid-cycle downgrade → credit note (`account_move` with negative sign), per §A5's partial-refund rule.

## 3.6 Team Split & The Hour-0 Decoupling Move

| Person | Tool | Owns |
|---|---|---|
| **Balaji** | Claude Pro | **Intelligence core** (scorer + attribution + coach, recommender, narrator) and **all frontend** (Builder + Upsell, Approval, Fulfilment, Subscription/Billing, Portal, Deal Health, Policy Simulator) |
| **Nithin** | Gemini Pro | Auth (internal JWT + portal magic link), Product/Variant/Price-List CRUD, Discount-tier & approval-chain persistence, **approval state machine** (consumes scorer output) |
| **Santhosh** | Gemini Pro | Warehouse & stock setup, split-allocation persistence + backorders, subscription plans, billing schedule, **invoice + payment tail (rubric step 8)** |
| **Prabanjan** | Gemini Pro | Seed-data generator (the 120-order history the scorer depends on), reporting aggregations + filters + PDF/XLS export, **architecture diagram**, **demo script**, **"what we'd build next" note** |

**The critical hour-0 move — freeze API contracts before anyone codes.** Write `contracts.md` + a FastAPI stub app returning fixture JSON for all of it in the first 60 minutes:

```
POST /quotes/{id}/score      → {score, band, components[], lines[], narrative}
POST /policy/simulate        → {policy, impacts[{quote_id, before, after, delta_₹}]}
POST /quotes/{id}/recommend  → {suggestions[{sku, lift, margin_delta, promo}]}
POST /orders/{id}/split      → {objective, allocations[], shipments, cost, backorders[]}
POST /subscriptions/{id}/change → {credit, days_remaining, days_in_cycle, schedule[]}
GET  /portal/{token}         → REDACTED DTO — no cost, margin, or risk fields
POST /invoices/{id}/payment  → {invoice_status}
GET  /events/stream          → SSE
```

Balaji builds the entire UI against these stubs from hour 1. Three teammates fill them in independently. **Nobody blocks anybody.** This single decision is worth more than any framework choice on this list.

---

# 4. Phased Implementation Roadmap

> Phases are stated on a 30-hour clock per the brief. **If the event is 24 hours**, use the compressed column: P2 collapses into H18–H22 and *only the top P2 item ships*. The phase gates matter more than the numbers — do not enter a phase until the previous gate passes.

## H0 → H1 — Contract Freeze (whole team, together, no exceptions)

Write `contracts.md`. Stand up the FastAPI stub returning fixtures. Agree the entity names (§3.1 naming). Commit the empty schema. **Gate: every teammate can `curl` every endpoint and get well-shaped JSON.** Do not skip this to "save time" — it is the highest-leverage hour of the build.

## P0 — Functional Core + Mock Layer (gate: **H12**, compressed H10)

The engine must be *correct* before anything is *pretty*.

**Balaji**
- [ ] `score_quote()` — all four components, exact attribution, configurable weights/bands. **Unit-tested against §10's worked example** (Laptop 12/15 OK, Setup Service 18/10 → 8 pts over → flagged). If our engine doesn't reproduce the PS's own example, nothing else matters.
- [ ] `recommend()` — co-occurrence matrix + lift ranking + margin floor
- [ ] `coach()` — counterfactual target discount by binary search
- [ ] Quote Builder UI + Upsell panel, fully wired **against stubs**, with live margin bar and optimistic updates
- [ ] Design system locked: fonts self-hosted, tokens set, one card component reused for catalog + upsell

**Nithin** — auth (both flavours), product/variant/price-list CRUD, discount-tier + category-ceiling persistence, approval state machine with an explicit legal-transitions table

**Santhosh** — warehouse + `stock_quant`, `split_order()` both objectives, backorder rows, subscription plans + `prorate()`

**Prabanjan** — **seed generator** (this is on the critical path — the scorer needs rep history and the recommender needs co-purchase data): 120 historical orders across 4 reps with distinct discounting personalities, ≥ 8 products across Hardware/Services/Subscriptions, and **at least one product deliberately short-stocked so the split is forced** (rubric step 5)

**GATE H12 — all must be true:**
1. `score_quote()` reproduces the PS §10 example exactly
2. Every screen renders with mock data end-to-end; no blank routes
3. `deal_events` is being written on every mutation
4. Seed DB loads clean from a single command

## P1 — Real Integration + Live Visuals (gate: **H24**, compressed H18)

**Swap stubs for real endpoints one at a time, verifying after each** — never all at once.

- [ ] Scorer wired to real policy tables and real rep history
- [ ] Approval flow live end-to-end: submit → route → Manager → Finance → confirm, with full audit trail rendered
- [ ] Fulfilment: real stock, both objectives toggling visibly, backorder prompt firing
- [ ] Subscription + billing schedule + proration with visible arithmetic
- [ ] **Invoice → Register Payment → `Unpaid → Paid`** (rubric step 8 — do not defer this)
- [ ] **Customer portal with server-side redaction** + counter-offer → auto re-entry into approval (rubric step 7). Rehearse the DevTools proof.
- [ ] SSE live dashboard: stalled deals, discount anomalies, leakage counter
- [ ] Narrator endpoint with fallback + cache
- [ ] **Reset Demo Data button** (see §5)

**GATE H24 — the full §9 eight-step flow runs start to finish, driven by a teammate who did not build it, without a single manual database edit.** If that fails, P2 does not begin.

## P2 — Hackathon Gold (gate: **H30**, compressed H22)

**Build in this order. Stop when time runs out — do not start two.**

1. **★ THE POLICY SIMULATOR** — the 10x Angle (§2.2). Non-negotiable; this is the submission's identity. The blast-radius preview with animated pipeline re-scoring, rolling counters, and the ₹-recovered summary line.
2. Contribution-bar polish + number-roll micro-animations on every changing figure (margin, score, split quantities, billing amounts) — one interaction pattern reused everywhere makes the whole app feel alive rather than like disconnected forms.
3. Deal Time Machine (event-replay scrubber) — *only* if #1 and #2 are done and rehearsed.
4. Multi-currency bonus — *only* if 1–3 are done.

## H-2 → H0 — Freeze (this is a phase, not a buffer)

- **Code freeze at T-120 minutes.** No exceptions, no "one small fix."
- Snapshot the golden SQLite file. Verify `Reset Demo Data` restores it in < 2 s.
- **Three full demo rehearsals**, one of them driven by a teammate who didn't build the feature being shown.
- Architecture diagram finalized (Prabanjan) · next-steps note written · export buttons verified.
- Charge laptops. Test the projector resolution. Set browser zoom so the pipeline strip fits on screen at 1080p. Close Slack, email, notifications.

## The "Do NOT Build" List

Scope creep is the only thing that can beat us. **These are forbidden.** If someone starts one, stop them and point at this line.

| Forbidden | Why |
|---|---|
| Real payment gateway (Stripe/Razorpay) | §9 says *"record a payment"* — a status flip satisfies the rubric. A gateway integration is hours for zero marks. |
| Real email sending | A "copy portal link" button is faster, more reliable, and demos better than waiting for an inbox. |
| Docker / Kubernetes / cloud deploy | A container that won't start at hour 23 is how teams lose. Localhost only. |
| Microservices, message queues, Redis, Celery | One process. One file DB. |
| Migration framework (Alembic) | Drop + recreate + seed. The schema is not in production. |
| OAuth / SSO / password reset / email verification | Not graded. JWT + seeded users. |
| Full test suite | Unit-test **the scorer and the proration math only**. Everything else is covered by the rehearsed flow. |
| Mobile-responsive internal screens | Judges watch a laptop or projector. Make the **portal** responsive (it demos well on a phone); leave internal screens desktop-only. |
| Light/dark theme toggle, i18n | Zero marks. |
| Server-side PDF generation | Print stylesheet + `window.print()`. 20 minutes vs. 3 hours. |
| Drag-and-drop kanban reordering | Looks like a feature, is a time sink, changes no rubric line. |
| Training or serving an actual ML model | Association rules and robust z-scores *are* the real algorithms here, they are explainable, and they run in microseconds. A trained model would be less defensible and slower. |
| Voice-to-quote / speech input | Tier-3 fantasy. Fails live 30% of the time. Cut. |
| Generic Inter/Roboto typography, flat cards, default blues | Per the team's own frontend protocol — instantly reads as AI-default and cheapens genuinely deep work. |

---

# 5. Edge Cases & Demo Guardrails

The engine being correct is necessary. The demo being *unkillable* is what actually wins. Assume a judge takes the mouse and clicks something you never tried.

## Failure Point 1 — The LLM Narrator Stalls or Dies

**Scenario:** venue wifi is congested, the API rate-limits, or latency spikes to 12 s. A spinner sits on the Deal Health card while four judges watch. Momentum dies.

**Why it's likely:** conference wifi at peak, everyone demoing simultaneously. This is the single most common live-demo death.

**Defenses (all four, layered):**

1. **Hard 3-second timeout with a deterministic template fallback.** The narrative is composed from the same structured `RiskResult` the LLM would have received:
   `"Setup Service is 8 points over its 10% ceiling and two other lines are marginally over; blended score 67 routes this to Finance. No rep activity for 2 days."`
   Honestly, this often reads *better* than the LLM output. The LLM is an upgrade, never a dependency.
2. **Pre-warm the cache.** Key on `hash(quote_lines + policy_version)`. At app start, generate narratives for all seed quotes. Every quote in the rehearsed path is a cache hit — zero network calls on the demo path.
3. **`DEMO_MODE=1` env flag** → cache-first, never call out on a miss, fall straight to template.
4. **Never block layout on it.** The narrator renders in its own card with a skeleton that resolves to the template text. Nothing downstream awaits it.

**Rule:** if the narrator is on the critical path of any sentence in the demo script, rewrite the script.

## Failure Point 2 — Empty, Zero, and Divide-by-Zero States

**Scenario:** a judge clicks `+ New Quotation` and immediately hits `Submit for Approval` on an empty quote. Or opens a brand-new rep with no history. Or a product with zero stock everywhere. Every one of these hits a division by zero or an undefined statistic in the intelligence core.

**Why it's likely:** near-certain. Judges test boundaries because it's the fastest way to find fakery, and the empty state is the first thing anyone clicks.

**The specific landmines:**

| Trigger | What breaks | Defense |
|---|---|---|
| Quote with zero lines | `weight_i = line_rev / order_rev` → 0/0 → NaN → margin bar renders `NaN%` | `safe_ratio(n, d, default=0)` used for **every** derived ratio, no exceptions |
| Rep with no history | robust z-score: MAD = 0 → division by zero | Explicit branch: if `n < 5` prior orders, drop the Z component and **renormalize the remaining weights**. Surface a UI chip: *"Insufficient history — scoring on policy components only."* This turns a crash into a feature that shows the model is honest about its inputs. |
| Order gross margin = 0 or negative | Leakage ratio explodes to ±∞ | Clamp `L` to `[0, 1]`; if margin ≤ 0, flag `NEGATIVE_MARGIN` as a hard Finance override — which is the correct business behaviour anyway |
| Zero stock across all warehouses | Split returns empty allocation, UI renders a blank card | Explicit `FULLY_BACKORDERED` state with copy and a `Consolidate Remaining Backorder` CTA (which §B6 requires anyway) |
| Discount = 100% or negative | Nonsense score | Clamp `[0, 100]` at the Pydantic layer; reject with a field error, not a 500 |
| Cart with one item | Recommender has no co-occurrence support | Fall back to promoted-products-above-margin-floor, labelled *"Promoted"* rather than *"Frequently bought together"* — honest labelling, no empty panel |
| Subscription change on day 0 or day 30 | `days_remaining / days_in_cycle` → 0 or 1 edge | Explicit boundary tests; a 0 credit renders as *"No proration — change effective at cycle start"* |

**The rule:** every empty state gets **designed copy**, not a blank div and not a crash. A well-handled empty state reads as maturity; a `NaN` on the projector reads as a prototype.

## Failure Point 3 — State Corruption from Out-of-Order Judge Actions

**Scenario:** a judge approves a quote, hits browser-back, and approves it again. Or the customer counters a quote that's already confirmed. Or two tabs are open and one holds stale state. Now the demo database is in a state your script assumes cannot exist — and the *next* three minutes of your demo are broken.

**Why it's likely:** this is the highest-consequence failure because it is **unrecoverable mid-demo** and it poisons everything downstream. Failure Points 1 and 2 embarrass you for ten seconds; this one ends the run.

**Defenses (all five):**

1. **Explicit state machine with a legal-transitions table**, server-side, single source of truth:
   ```
   DRAFT → PENDING_MANAGER → PENDING_FINANCE → APPROVED → CONFIRMED → FULFILLED → INVOICED → PAID
     ↕ NEGOTIATION (re-entrant from CONFIRMED per §B8, returns to PENDING_*)
     ↓ REJECTED / RETURNED_FOR_REVISION (→ DRAFT)
   ```
   Any illegal transition returns **409 Conflict** with `{current_state, allowed_transitions[]}` — never a 500, never a silent success.
2. **UI derives button state from the server's `allowed_transitions`.** Illegal actions are *disabled and explained* ("Already approved by M. Shah, Aug 21"), not merely hidden. A disabled button with a reason reads as rigour; a missing button reads as an unfinished screen.
3. **Idempotency keys on `approve`, `confirm`, and `payment`.** Replaying the same action returns the same result instead of double-writing. Double-click on a projector is a real hazard.
4. **`Reset Demo Data` button in admin** — restores the golden SQLite snapshot in **under 2 seconds**. Copy a file, reopen the connection, broadcast an SSE refresh. **Rehearse using it.** The recovery move is: *"Let me reset to a clean state — this is one click"* — which reads as production tooling rather than panic.
5. **Two browser profiles, pre-opened, pre-logged-in** — one internal (rep + manager), one portal (customer). Never log out and back in on stage. Never hunt for a URL.

## Failure Point 4 (bonus — the boring one that actually kills teams)

**Environment and connectivity.** Not intellectually interesting; disproportionately fatal.

- **Self-host fonts.** A Google Fonts CDN timeout leaves your beautiful typography rendering in Times New Roman on the projector.
- **No external CDN in the critical path.** Bundle every dependency through Vite.
- **Commit the seeded `.db` file.** Any teammate's laptop becomes the demo machine in 60 seconds if yours dies.
- **Fixed ports** (`8000` API, `5173` UI) hardcoded in one `.env`. No dynamic port discovery.
- **One `start.ps1`** that launches both processes. Test it on a second machine before freeze.
- **Set browser zoom for the projector** during rehearsal, not during the demo. Verify the Policy Simulator's pipeline strip fits on screen at 1080p.
- Notifications off. Slack quit. Battery charged. Wallpaper neutral.

## Judge Interrogation Prep

Rehearse these answers. Confidence in Q&A is a large share of the perceived score.

| Question | Answer |
|---|---|
| *"Is this score hardcoded?"* | "No — and rather than tell you, let me show you." → **run the Policy Simulator**. Best possible outcome for this question. |
| *"Is this real ML?"* | "It's a transparent additive model and item-item association rules. We chose explainability deliberately: a sales manager has to justify a routing decision to a rep, and a black box can't do that. Because the model is additive, Shapley values reduce in closed form to each term's contribution — so the explanation is exact, not estimated." |
| *"How is the customer portal actually separate?"* | → **DevTools → Network → portal payload.** "There's no margin field in this response. It isn't hidden by CSS — the serializer can't emit it." |
| *"What if a rep is new with no history?"* | "We drop the behavioural component and renormalize, and we say so in the UI." → point at the chip. |
| *"What would you build next?"* | The prepared sponsor-tie-in line from §1.3(3). |
| *"Why not just use the maximum line violation?"* | "Because §10 of your own problem statement warns against exactly that — three lines at 2, 3, and 2 points over pass every `max()` rule while quietly giving away real margin. That's what our aggregate component catches." *(Quoting the PS back, accurately, is a strong move.)* |

---

## Appendix A — Demo Script (5 minutes)

| Time | Beat |
|---|---|
| 0:00–0:20 | **Cold open on the leakage number.** "₹18.4L given away beyond policy across 120 closed deals. Nobody approved that — it approved itself, one line at a time." |
| 0:20–1:10 | Build Q-1042. Add a line. **Accept an upsell** — margin bar animates live (rubric step 4). Show the lift and margin-delta reasoning on the card. |
| 1:10–2:10 | Push Setup Service to 18%. Flagged. **Show the explainability panel** — per-line `given/allowed/over/₹ leaked` plus the contribution bar. Show the **coaching line**: "10% would auto-approve." (rubric steps 2–3) |
| **2:10–2:25** | **★ THE MAGIC MOMENT (§2.3).** Policy Simulator. Silence during the ripple. |
| 2:25–3:05 | Approve as Manager → Finance. Audit trail visible. **Warehouse split forced across two warehouses**; toggle objectives, numbers reshuffle. (rubric step 5) |
| 3:05–3:35 | Subscription + one-time on one order. Billing schedule. Mid-cycle change → proration with **visible arithmetic**. (rubric step 6) |
| 3:35–4:20 | **Second browser: customer portal.** Counter-offer → quote **auto re-enters approval**. (rubric step 7) Then the 10-second DevTools redaction proof. |
| 4:20–4:45 | Confirm → invoice → **register payment → status flips to Paid**. (rubric step 8) |
| 4:45–5:00 | Dashboard: the deal leaves the at-risk feed. Close on the leakage counter, now lower. **"Every other approval system tells you what happened. Ours tells you what would happen."** |

**Note:** this script covers **all eight** of §9's rubric steps in order. That is not a coincidence — build the script from the rubric, not from the features you're proudest of.

## Appendix B — Screen Investment Triage

One person owns all frontend, so investment must be uneven and deliberately so.

**Beautiful (judges' eyes live here):** Quotation Builder + Upsell panel · Deal Health dashboard · **Policy Simulator** · Customer Portal *(different visual language on purpose — §7 requires a genuinely separate view, so make that a design statement)*

**Clean and functional (correct beats pretty):** Approval detail · Fulfilment split · Subscription/Billing · Invoices · Admin config lists

**Consistent thread across everything:** any number that can change — margin, risk score, split quantities, billing amount, leakage counter — **visibly animates and recolors on update.** One interaction pattern, reused everywhere. That single rule is what makes six screens feel like one living product instead of a folder of forms.

## Appendix C — Definition of Done

- [ ] All 8 steps of PS §9 pass, driven by someone who didn't build them
- [ ] Scorer reproduces the PS §10 worked example exactly
- [ ] Policy Simulator re-scores the open pipeline in < 400 ms
- [ ] Portal payload provably contains no cost/margin/risk fields
- [ ] `Reset Demo Data` restores golden state in < 2 s
- [ ] Every empty/zero state has designed copy — zero `NaN` reachable
- [ ] Illegal transitions return 409 with allowed transitions; buttons disabled with reasons
- [ ] One-page architecture diagram delivered (Prabanjan)
- [ ] "What we'd build next" note written, with the platform-tie-in line
- [ ] Export PDF + XLS buttons work
- [ ] Fonts self-hosted; app runs with wifi switched off
- [ ] Seeded `.db` committed; second laptop verified as a backup demo machine
- [ ] Three full rehearsals complete, code frozen T-120 minutes

---

# 6. Pre-Mortem — It's Hour 30 and We Lost. Why?

Written *before* the build, so each cause has a pre-committed countermeasure and a **hard abort trigger**. The single biggest killer of good hackathon teams is sunk-cost persistence on a feature that stopped being worth it four hours ago. Decide now, while you're calm.

| # | Cause of death | Likelihood | Prevention | **Abort trigger (pre-committed)** |
|---|---|---|---|---|
| 1 | **Integration hell at H20.** Four people built against assumptions, not contracts. Nothing composes. | **High** | H0–H1 contract freeze is a gate, not a suggestion. Integrate one endpoint at a time from H14, never in a big-bang. | If any endpoint fails integration twice, **ship the stub for it** and mark it in the demo script as mock. A working mocked screen beats a broken real one. |
| 2 | **Balaji is the bottleneck.** One person owns the intelligence core *and* seven screens. | **High** | Screens are triaged (Appendix B): 4 beautiful, 5 functional. Stub-first UI means no idle waiting. | At **H16**, if fewer than 5 screens are integrated, Nithin takes over the Admin/config screens outright. Say this out loud at H16 — don't negotiate it then. |
| 3 | **The demo breaks in front of judges.** | Medium | All of §5. `Reset Demo Data`. Two pre-logged-in browser profiles. | If anything breaks live: **one click reset, keep talking, do not debug on stage.** Rehearse the sentence: *"Let me reset to a clean state — one click."* |
| 4 | **Scope creep ate P2.** Someone built a feature not on this list. | Medium | The Do NOT Build list. Anyone may invoke it on anyone, including Balaji. | Any unplanned feature: **stop within 15 minutes**, commit nothing, return to the roadmap. |
| 5 | **Seed data is thin, so nothing is dramatic.** The scorer is correct but every quote lands LOW, the split never actually splits, and the pipeline has 3 rows. | **High and under-rated** | §9 specifies the seed as a designed artifact, on the critical path, owned by Prabanjan, due at **H10**. | If seed isn't done at **H10**, Prabanjan drops reporting work and finishes it. Reporting is a filter UI; seed is the entire demo. |
| 6 | **We built a great engine and told the story badly.** Ran long, buried the magic moment, never said the leakage number. | Medium | Appendix D is a verbatim script. Three rehearsals with a timer. | If rehearsal #2 runs over 5:00, **cut the subscription/billing beat to 15 seconds** — it's the least differentiated minute in the demo. |
| 7 | **Non-code deliverables missing.** No architecture diagram, no next-steps note. | Medium | Both owned by Prabanjan, due **H26**, on the Definition of Done. | These are never cut. They're worth more per minute than any code written after H26. |

**The one-sentence rule:** *after H24, no new features — only rehearsal, guardrails, and deliverables.*

---

# 7. Reference Implementation — The Scorer

`norm()` was left undefined in §3.4. Here it is, concretely, because four people guessing at normalization independently is exactly how an engine becomes inconsistent. **This is the single most important file in the repo.** Balaji writes it first, before any UI.

```python
# engine/scoring.py — PURE. No ORM, no I/O, no globals. This is why the simulator works.
from dataclasses import dataclass
from statistics import median

def clip(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))

def safe_ratio(n, d, default=0.0):
    """Every derived ratio in this codebase goes through here. No exceptions."""
    return default if not d else n / d

def robust_z(x, history):
    """MAD-based z-score. Returns None when history is too thin to be honest."""
    if len(history) < 5:
        return None                      # -> triggers the renormalize branch
    m = median(history)
    mad = median([abs(h - m) for h in history])
    if mad == 0:
        return None                      # degenerate history, don't fake a signal
    return (x - m) / (1.4826 * mad)

@dataclass
class Policy:
    """Loaded from DB rows. NEVER a constant. Passed as an argument -> simulator works."""
    tier_ceiling: dict          # {"Gold": 15.0, ...}
    category_ceiling: dict      # {"Hardware": 15.0, "Services": 10.0, ...}
    weights: dict               # {"S": .35, "A": .30, "L": .20, "Z": .15}
    caps: dict                  # {"S": 20.0, "A": 10.0, "Z_lo": 1.0, "Z_hi": 3.0}
    bands: list                 # [(0,20,"AUTO"), (20,60,"MANAGER"), (60,101,"FINANCE")]
    hard_override_pts: float    # 15.0 -> any single line this far over forces FINANCE

def score_quote(policy: Policy, quote, rep_history):
    order_rev = sum(l.list_price * l.qty for l in quote.lines)
    order_gm  = sum((l.list_price - l.cost) * l.qty for l in quote.lines)

    lines, S, A, leak = [], 0.0, 0.0, 0.0
    for l in quote.lines:
        ceiling = min(policy.tier_ceiling[quote.tier],
                      policy.category_ceiling[l.category])
        over    = max(0.0, l.discount_pct - ceiling)
        weight  = safe_ratio(l.list_price * l.qty, order_rev)
        l_leak  = (over / 100.0) * l.list_price * l.qty
        S       = max(S, over)
        A      += over * weight              # <- THE BLENDED TERM. revenue-weighted.
        leak   += l_leak
        lines.append(dict(sku=l.sku, given=l.discount_pct, allowed=ceiling,
                          over=over, leaked=l_leak, weight=weight))

    L = clip(safe_ratio(leak, order_gm)) if order_gm > 0 else 1.0   # <=0 GM -> max risk

    eff_disc = safe_ratio(sum(l.discount_pct * l.list_price * l.qty for l in quote.lines),
                          order_rev)
    z = robust_z(eff_disc, rep_history)

    terms = {
        "S": clip(S / policy.caps["S"]),
        "A": clip(A / policy.caps["A"]),
        "L": L,
        "Z": None if z is None else clip((z - policy.caps["Z_lo"]) /
                                         (policy.caps["Z_hi"] - policy.caps["Z_lo"])),
    }

    # --- Honest degradation: drop Z and RENORMALIZE the survivors to sum to 1 ---
    w = dict(policy.weights)
    notes = []
    if terms["Z"] is None:
        del terms["Z"]; del w["Z"]
        total = sum(w.values())
        w = {k: v / total for k, v in w.items()}
        notes.append("Insufficient rep history — scoring on policy components only.")

    contributions = {k: 100 * w[k] * terms[k] for k in terms}   # EXACT attribution
    score = sum(contributions.values())

    band = next(b for lo, hi, b in policy.bands if lo <= score < hi)
    if S >= policy.hard_override_pts:
        band = "FINANCE"
        notes.append(f"Hard override: one line {S:.0f} pts over its ceiling.")
    if order_gm <= 0:
        band = "FINANCE"; notes.append("Negative or zero gross margin.")

    return dict(score=round(score, 1), band=band, terms=terms,
                contributions=contributions, lines=lines,
                leaked_total=leak, notes=notes)
```

**Why this exact shape wins:** `policy` is an *argument*, not a global. That one decision is what makes §2.2's Policy Simulator a 40-line loop instead of a rewrite. Protect it — if anyone reaches for a module-level constant or a DB call inside this file, the moat is gone.

### Worked example — must reproduce PS §10

Acme Corp (Gold), Q-1042. Hardware ceiling 15%, Services 10%.

| Line | Cat | Qty × Price | Given | Allowed | Over |
|---|---|---|---|---|---|
| Laptop Pro 14 | Hardware | 2 × ₹1,250 | 12% | 15% | **0** ✅ |
| Onsite Setup Service | Services | 1 × ₹400 | 18% | 10% | **8 pts** ❌ |
| Extended Warranty | Hardware | 1 × ₹180 | 15% | 15% | **0** ✅ |

```
order_rev = 3,080   |   S = 8   |   A = 8 × (400/3080) = 1.04
leak = 0.08 × 400 = ₹32        |   order_gm ≈ ₹1,078  ->  L = 0.030
eff_disc = 12.95%  |  rep median 8%, MAD 2  ->  z = 1.67  ->  norm(Z) = 0.335

score = 100 × (.35×0.400 + .30×0.104 + .20×0.030 + .15×0.335)  =  22.7  ->  MANAGER
```

✅ Matches PS §10's narrative exactly: *"the whole quotation gets flagged for approval"* because of one Services line, even though the customer's Gold tier allows 15%.

> **Calibration step (H11, 30 min, do not skip):** tune `caps` so the three seeded hero quotes land on their intended bands, then freeze the caps. Note the provided wireframe labels Q-1042 as `HIGH`; our math puts it at MEDIUM/Manager, which is what PS §10 actually describes. **Trust §10 over the wireframe label** — and if a judge raises it, that's a *strength*: "we calibrated against the worked example in your problem statement."

### The aggregate case — the quote that proves we're not everyone else

Q-1039, Beta Industries. **No line is more than 3 points over.** Every `max()`-based rule on earth passes this quote.

| Line | Over | Weight | Contribution to A |
|---|---|---|---|
| Rack Server | 3 pts | 0.34 | 1.02 |
| Install Service | 2 pts | 0.18 | 0.36 |
| Support SLA | 3 pts | 0.22 | 0.66 |
| Docking Station ×20 | 2 pts | 0.26 | 0.52 |
| | **S = 3 (looks fine)** | | **A = 2.56 (2.5× Q-1042's)** |

Our `A` term flags it. **Show this quote in the demo, immediately after Q-1042, for 15 seconds.** It is the single cleanest proof that we implemented §10's actual requirement rather than a threshold with extra steps.

---

# 8. Schema — Freeze This at H1

Compact, SQLite-valid, Postgres-portable. Entity names mirror the standard ERP object graph (§1.3). Paste this into `schema.sql` in hour one; every teammate codes against it.

```sql
CREATE TABLE res_partner (            -- customers
  id INTEGER PRIMARY KEY, name TEXT NOT NULL,
  tier TEXT NOT NULL,                 -- Bronze | Silver | Gold
  currency TEXT DEFAULT 'INR', portal_email TEXT);

CREATE TABLE app_user (
  id INTEGER PRIMARY KEY, name TEXT, email TEXT UNIQUE, pwd_hash TEXT,
  role TEXT NOT NULL);                -- rep | manager | finance | admin

CREATE TABLE product_template (
  id INTEGER PRIMARY KEY, name TEXT, category TEXT NOT NULL,
  uom TEXT, tax_pct REAL DEFAULT 18, description TEXT,
  is_recurring INTEGER DEFAULT 0, recurrence TEXT);   -- monthly|quarterly|yearly

CREATE TABLE product_variant (
  id INTEGER PRIMARY KEY, template_id INTEGER REFERENCES product_template(id),
  sku TEXT UNIQUE, attribute TEXT, value TEXT,
  list_price REAL NOT NULL, extra_price REAL DEFAULT 0,
  cost REAL NOT NULL,                 -- never exposed to the portal DTO
  is_promoted INTEGER DEFAULT 0);

CREATE TABLE price_list (
  id INTEGER PRIMARY KEY, tier TEXT, currency TEXT,
  rule TEXT, adjustment_pct REAL DEFAULT 0);

-- ---- POLICY: every row here is live-editable. Nothing below is a constant. ----
CREATE TABLE discount_tier    (tier TEXT PRIMARY KEY, max_discount REAL);
CREATE TABLE category_ceiling (category TEXT PRIMARY KEY, max_discount REAL);
CREATE TABLE approval_rule (
  id INTEGER PRIMARY KEY, score_min REAL, score_max REAL, route TEXT);
CREATE TABLE score_weight (component TEXT PRIMARY KEY, weight REAL, cap REAL);

CREATE TABLE warehouse (
  id INTEGER PRIMARY KEY, name TEXT, ship_cost_weight REAL,
  fixed_shipment_cost REAL DEFAULT 0);
CREATE TABLE stock_quant (
  warehouse_id INTEGER, variant_id INTEGER,
  on_hand INTEGER, reserved INTEGER DEFAULT 0, reorder_point INTEGER,
  PRIMARY KEY (warehouse_id, variant_id));

CREATE TABLE sale_order (
  id INTEGER PRIMARY KEY, ref TEXT UNIQUE,      -- 'Q-1042'
  partner_id INTEGER, rep_id INTEGER,
  state TEXT NOT NULL,                          -- see §5 state machine
  currency TEXT DEFAULT 'INR', fx_rate_to_base REAL DEFAULT 1.0,  -- bonus hook
  risk_score REAL, risk_band TEXT, policy_version INTEGER,
  created_at TEXT, last_activity_at TEXT);      -- <- stall detector reads this

CREATE TABLE sale_order_line (
  id INTEGER PRIMARY KEY, order_id INTEGER REFERENCES sale_order(id),
  variant_id INTEGER, qty INTEGER, list_price REAL, cost REAL,
  discount_pct REAL DEFAULT 0, is_recurring INTEGER DEFAULT 0);

CREATE TABLE allocation (
  id INTEGER PRIMARY KEY, order_id INTEGER, line_id INTEGER,
  warehouse_id INTEGER, qty INTEGER, objective TEXT);  -- shipments|cost
CREATE TABLE backorder (
  id INTEGER PRIMARY KEY, order_id INTEGER, line_id INTEGER,
  qty INTEGER, status TEXT);

CREATE TABLE subscription (
  id INTEGER PRIMARY KEY, order_id INTEGER, line_id INTEGER,
  plan TEXT, cycle TEXT, qty INTEGER, unit_price REAL,
  start_date TEXT, next_bill_date TEXT, status TEXT);
CREATE TABLE billing_schedule (
  id INTEGER PRIMARY KEY, subscription_id INTEGER,
  due_date TEXT, amount REAL, status TEXT);

CREATE TABLE account_move (                     -- invoice / credit note
  id INTEGER PRIMARY KEY, ref TEXT UNIQUE,      -- 'INV-1042'
  order_id INTEGER, kind TEXT,                  -- invoice | credit_note
  amount REAL, status TEXT, due_date TEXT);     -- unpaid | paid | partial
CREATE TABLE account_payment (
  id INTEGER PRIMARY KEY, move_id INTEGER, amount REAL, paid_at TEXT,
  idempotency_key TEXT UNIQUE);                 -- <- §5 double-click defence

CREATE TABLE portal_comment (
  id INTEGER PRIMARY KEY, order_id INTEGER, line_id INTEGER,
  author TEXT, body TEXT, counter_discount_pct REAL, created_at TEXT);

-- ---- THE AUDIT SPINE. Append-only. Never UPDATE, never DELETE. ----
CREATE TABLE deal_events (
  id INTEGER PRIMARY KEY, order_id INTEGER, actor TEXT, actor_role TEXT,
  event_type TEXT,          -- created|line_added|discount_changed|submitted|
                            -- approved|rejected|returned|countered|confirmed|
                            -- split|invoiced|paid|policy_changed
  payload_json TEXT, reason TEXT, created_at TEXT NOT NULL);
CREATE INDEX ix_events_order ON deal_events(order_id, created_at);
```

**Three rules on this schema, enforced in review:**
1. `cost` exists on the line but **must never appear in a portal DTO**. Grep for it before the demo.
2. `deal_events` is append-only. Any `UPDATE` against it is a bug.
3. `last_activity_at` is written on **every** mutation, or the stall detector silently reports nothing.

---

# 9. Seed Data Specification — The Demo Is Manufactured Here

> **This section is the difference between a correct engine and a compelling demo.** A perfect scorer over bland data produces a boring five minutes. Every dramatic beat in Appendix A is *engineered* below. Owner: **Prabanjan. Due H10. Critical path.**

**Use the wireframe's exact identifiers** — `Q-1042`, `Acme Corp`, `Beta Industries`, `Nova Retail`, `Zenith Co`, `Delta LLC`, `Laptop Pro 14`, `Onsite Setup Service`, `Extended Warranty`, `Docking Station`, `Wireless Mouse`, `Care Plan 2yr`, `Support SLA`, `Main Warehouse`, `East Depot`, `INV-1042`. When our running app matches the provided mockup down to the record IDs, the wireframe becomes our acceptance test and the judges see total spec fidelity for free.

### The six beats the seed must guarantee

| # | Beat | Seed requirement | Verifies |
|---|---|---|---|
| 1 | **§10 reproduces exactly** | Q-1042 / Acme (Gold): Laptop Pro 14 ×2 @12%, Onsite Setup ×1 @18%, Ext. Warranty ×1 @15% | Rubric steps 2–3 |
| 2 | **The aggregate catch** | Q-1039 / Beta: 4 lines at 3/2/3/2 pts over. `S=3` looks harmless, `A=2.56` flags it | **Our core differentiator** |
| 3 | **Forced 2-warehouse split** | Order needs **40** Laptop Pro 14. Main Warehouse available **28** (46 on hand − 18 reserved), East Depot **14**. Split is unavoidable; 2 units go to backorder → the Consolidate prompt fires | Rubric step 5 + §B6 |
| 4 | **Behavioural anomaly** | Rep `K. Iyer` history median 6%, MAD 1.5 → then writes a 19% quote. `Z` term dominates the contribution bar | §B9 anomaly alert |
| 5 | **Insufficient-history branch** | Rep `S. Nair` has exactly **3** closed orders → `robust_z` returns `None` → renormalize + UI chip. **Demo this on purpose** — it reads as intellectual honesty | §5 Failure Point 2 |
| 6 | **Stalled deal** | Q-1031 / Delta LLC: `last_activity_at` = today − **9 days**, threshold 7 | §B9 stalled deals |

### Volume and shape

- **120 closed historical orders** — enough that lift/confidence are meaningful and the leakage number is credible; small enough to seed in <2s.
- **4 reps with distinct discounting personalities** — this is what makes the `Z` term real rather than decorative:

| Rep | Median disc. | MAD | Closed orders | Role in demo |
|---|---|---|---|---|
| A. Rao | 8% | 2.0 | 42 | The baseline; owns Q-1042 |
| K. Iyer | 6% | 1.5 | 38 | Disciplined → his 19% quote spikes hard |
| M. Shah | 13% | 4.0 | 37 | Habitually loose → high leakage contributor |
| S. Nair | — | — | **3** | Triggers the insufficient-history branch |

- **~12 products** across Hardware / Services / Subscriptions, with **real `cost` values** — leakage and margin are meaningless without them.
- **Co-purchase structure, deliberately planted** so the recommender surfaces something with genuine lift:
  `Laptop Pro 14 → Docking Station` in ~70% of orders (lift ≈ 2.4) · `Laptop Pro 14 → Extended Warranty` ~55% · `Rack Server → Support SLA` ~80%. Without planted structure, association rules over 120 random orders return noise and the upsell panel looks arbitrary.
- **≥ 2 promoted products** with healthy margin (§A6 promo ranking) and **≥ 1 high-lift but low-margin product that must be filtered out** by the margin floor — worth demoing in one sentence: *"this one co-occurs constantly, but it's below our margin floor, so we don't suggest it."*
- **14 open quotations** across all bands — this is the pipeline the Policy Simulator ripples through. Fewer than ~12 and the magic moment looks thin; more than ~18 and it won't fit on the projector.
- **Calibrate the ripple:** tune the open quotes so that dragging Services 10% → 8% flips **exactly 3 to red and 1 to green.** Too few is unimpressive; everything flipping looks fake. **Rehearse the exact slider value.**

### Seed generator rules

1. **Deterministic.** `random.seed(42)`. The demo must be byte-identical every run.
2. **One command**, <2 seconds: `python seed.py --fresh`.
3. **Emits the golden snapshot** that `Reset Demo Data` restores (§5).
4. **Self-asserting.** The generator ends by running the six beats above as assertions and printing a pass/fail table. If beat 3 stops forcing a split because someone edited stock, you find out at seed time — not on stage.

---

## Appendix D — Verbatim Pitch Script (Open & Close)

Most teams wing the first and last 30 seconds. Those are the two moments judges actually remember. Learn these.

**OPEN (0:00–0:25) — do not touch the mouse yet.**

> "Every company has a discount policy. Almost none of them can tell you what it cost them to break it.
> This is 120 closed deals from one sales team. *(click — the leakage counter fills)*
> **₹—L was discounted beyond policy.** Nobody approved that. It approved itself, one line at a time, because every one of those quotes was technically within *somebody's* limit.
> DealFlow360 is the system that catches the pattern instead of the line."

**CLOSE (4:45–5:00) — stop clicking. Look up.**

> "Discount approval today is a queue. Managers approve everything because nothing tells them which deals are actually dangerous.
> We turned that queue into a filter that explains itself, routes itself, and re-decides itself the moment policy changes.
> **Every other approval system tells you what happened. Ours tells you what would happen.**"

**Two delivery rules:** (1) after the magic moment ripple, **say nothing for four seconds** — the silence is what makes it land; (2) never narrate the UI ("now I'm clicking on…"). Narrate the *decision* the software is making.

---

## Appendix E — Cheap Wins Punch List (H26–H28, ~15 min each)

Small, spec-visible, disproportionately credited. Assign to whoever is least loaded. Each one signals *"we read your document."*

- [ ] `Reload Data` · `Go to Back-end` · `Close Workspace` in the top nav (§B1 — named explicitly in the PS)
- [ ] `Switch to Table View` toggle on the quotations list (wireframe screen 3)
- [ ] `Filter: Pending Only` on the approvals list (wireframe screen 6)
- [ ] `Export PDF` / `Export XLS` on reporting (§A7 — explicitly required, widely skipped)
- [ ] `Nudge Rep` and `Escalate` buttons on dashboard alerts (§B9 — "automated nudge or escalation action")
- [ ] Reporting filters: Period · Sales Team/Rep · Approval Status · Product/Category (§A7 names all four)
- [ ] `Dismiss` button on upsell suggestions (§B5 names it alongside Add to Quote)
- [ ] `Accept Suggested Split` / `Manual Override` (§B6 names both)
- [ ] `Return for Revision` as a third approval action (§B4 — not just approve/reject)
- [ ] Status pills styled per wireframe: Draft · Pending Approval · Approved · Negotiation · Confirmed
- [ ] Empty-state copy on every list (§5 Failure Point 2)
- [ ] `README.md`: one command to run, seeded logins for all four roles, the portal link

---

## Appendix F — Self-Scored Audit (run this at H26, honestly)

Score 1–5. Anything ≤3 gets the remaining time. Do this with all four people in the room; the person who built it does not score it.

| Criterion | Weight | Evidence we can point at | Score |
|---|---|---|---|
| Business logic is real, not hardcoded | ×5 | Policy Simulator ripples live | ☐ |
| Blended score catches the *pattern* | ×5 | Q-1039 flags with `S=3` | ☐ |
| All 8 steps of PS §9 pass | ×5 | Non-builder drives it end to end | ☐ |
| Portal is genuinely restricted | ×4 | DevTools payload has no `cost` | ☐ |
| Explainability | ×4 | Exact contribution bar + per-line table | ☐ |
| Warehouse split is a real optimizer | ×3 | Objective toggle visibly reshuffles | ☐ |
| Proration math is correct and visible | ×3 | Numerator/denominator on screen | ☐ |
| Invoice → payment → status | ×3 | Rubric step 8 | ☐ |
| Audit trail complete | ×3 | Every action in `deal_events` | ☐ |
| UI polish on hero screens | ×3 | Builder · Dashboard · Simulator | ☐ |
| Architecture diagram | ×2 | One page, delivered | ☐ |
| Next-steps note | ×2 | Platform tie-in line included | ☐ |
| Demo under 5:00 | ×3 | Timed rehearsal | ☐ |
| Crash-proof | ×4 | Reset works; no reachable `NaN` | ☐ |

---

## Appendix G — Contingency: The 90-Second No-Laptop Pitch

If the machine dies, the projector fails, or the slot is cut to two minutes, **do not troubleshoot in front of judges.** Switch to this. Rehearse it once; you will almost certainly never need it, and that is exactly why it works — you'll stay calm.

1. **The problem (20s):** "Managers approve every discount because nothing ranks danger. Policy breaks one line at a time and nobody sees the total."
2. **The insight (20s):** "Real systems check the worst line. The problem statement's own §10 says that's wrong — three lines at two points over each pass every threshold rule and still give away real margin. We score the *pattern*, weighted by revenue."
3. **The proof (30s):** "Our scorer is a pure function of policy and quote — policy is an argument, not a constant. So we can re-run it against a policy you haven't saved yet, across every open deal, and show you the blast radius before you commit. Tighten Services by two points, four deals re-route, ₹2.1L stops leaking."
4. **The close (20s):** "Every other approval system tells you what happened. Ours tells you what would happen."

**Have the architecture diagram printed on paper.** Two copies. It costs nothing and it has saved demos.
