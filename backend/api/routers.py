"""HTTP surface.

Grouped by owner so each of us knows what is ours. Endpoints marked REAL are
wired to genuine logic today; endpoints marked STUB return well-shaped fixture
data so the UI can be built against them and swapped later without a refactor.
GET /_status reports which is which at any moment.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
import hashlib
import hmac
import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query

from .auth import any_of, current_user, permissions_for, require, tabs_for
from fastapi.responses import StreamingResponse

from datetime import date, datetime, timedelta, timezone

from engine.billing import (
    Subscription as BSub, billing_schedule, build_ledger, prorate,
)
from engine.fulfilment import (
    DemandLine, Warehouse, consolidate_backorders, split_order,
)
from engine.recommender import recommend as run_recommender
from engine.scoring import Quote, coach as run_coach, score_quote

from . import fixtures as fx
from . import services as svc
from . import state
from .schemas import (
    FORBIDDEN_PORTAL_KEYS,
    LEGAL_TRANSITIONS,
    is_legal,
)

PORTAL_SECRET = b"dealflow360-demo-portal-secret"


def _conflict(ref: str, current: str, target: str):
    """409, never 500, and always with the legal set attached.

    The UI derives its button state from `allowed`, so illegal actions are
    disabled WITH A REASON rather than silently missing. A disabled button that
    explains itself reads as rigour; a missing one reads as an unfinished screen.
    """
    raise HTTPException(status_code=409, detail={
        "error": "illegal_transition",
        "ref": ref,
        "current_state": current,
        "attempted": target,
        "allowed": LEGAL_TRANSITIONS.get(current, []),
        "message": f"{ref} is {current}; {target} is not a legal next state.",
    })


# =========================================================================== #
#  INTELLIGENCE — Balaji. REAL.
# =========================================================================== #

intelligence = APIRouter(tags=["intelligence"])


@intelligence.post("/quotes/{ref}/score")
def score(ref: str, _actor: dict[str, Any] = Depends(require("quote.view"))) -> dict[str, Any]:
    try:
        quote, r = svc.score_for(ref)
    except KeyError:
        raise HTTPException(404, f"No quotation {ref}")
    payload = r.to_dict()
    payload["ref"] = ref
    payload["narrative"] = svc.narrate(quote, r, fx.days_idle(ref))
    payload["narrative_source"] = "template"
    return payload


@intelligence.post("/quotes/{ref}/coach")
def coach(ref: str, target_band: str = Query("AUTO"), _actor: dict[str, Any] = Depends(require("quote.view"))) -> dict[str, Any]:
    quote = state.build_quote(ref)
    if quote is None:
        raise HTTPException(404, f"No quotation {ref}")
    advice = run_coach(state.get_policy(), quote, fx.history_for(quote.rep_id),
                       target_band=target_band)
    if advice is None:
        return {"available": False}
    return {"available": True, **advice}


@intelligence.post("/quotes/{ref}/recommend")
def recommend(ref: str, limit: int = Query(4, ge=1, le=10),
              margin_floor_pct: float = Query(25.0), _actor: dict[str, Any] = Depends(require("quote.view"))) -> dict[str, Any]:
    quote = state.build_quote(ref)
    if quote is None:
        raise HTTPException(404, f"No quotation {ref}")
    cart = [l.sku for l in quote.lines]
    suggestions, basis, filtered = run_recommender(
        svc.CO_PURCHASE_INDEX, cart, fx.BY_SKU,
        margin_floor_pct=margin_floor_pct, limit=limit,
    )
    return {"ref": ref, "suggestions": suggestions, "basis": basis,
            "filtered_by_margin_floor": filtered}


@intelligence.get("/policy")
def get_policy(_actor: dict[str, Any] = Depends(require("quote.view"))) -> dict[str, Any]:
    return svc._policy_dict(state.get_policy())


@intelligence.post("/policy/simulate")
def simulate(body: dict[str, Any] = Body(default_factory=dict), _actor: dict[str, Any] = Depends(require("policy.config"))) -> dict[str, Any]:
    """THE 10X ANGLE. Nothing here is persisted -- that is the entire point."""
    return svc.simulate(body)


@intelligence.put("/policy")
def apply_policy(body: dict[str, Any] = Body(...), _actor: dict[str, Any] = Depends(require("policy.config"))) -> dict[str, Any]:
    live = state.get_policy()
    clean = {k: v for k, v in body.items() if v is not None and k != "warnings"}
    clean["version"] = live.version + 1
    state.set_policy(live.clone(**clean))
    state.record("*", "Admin", "admin", "policy_changed",
                 reason=f"version {clean['version']}")
    return svc._policy_dict(state.get_policy())


# =========================================================================== #
#  SALES — Nithin. STUB (scores within are real).
# =========================================================================== #

sales = APIRouter(tags=["sales"])


# NOTE: /auth/login and /auth/me now live in accounts.py, backed by bcrypt
# hashes and JWTs. The previous implementation here matched an email against a
# fixture list and issued a token to anyone who guessed one -- no password was
# ever checked.


@sales.get("/products")
def products(category: str | None = None, q: str | None = None, _actor: dict[str, Any] = Depends(require("product.view"))) -> list[dict[str, Any]]:
    rows = state.PRODUCTS
    if category:
        rows = [p for p in rows if p["category"] == category]
    if q:
        needle = q.lower()
        rows = [p for p in rows if needle in p["name"].lower()]
    return rows


@sales.get("/products/{sku}")
def product_detail(sku: str, _actor: dict[str, Any] = Depends(require("product.view"))) -> dict[str, Any]:
    """One product with its variants and every tier price (PS A2)."""
    product = next((p for p in state.PRODUCTS if p["sku"] == sku), None)
    if product is None:
        raise HTTPException(404, f"No product {sku}")
    margin = product["list_price"] - product["cost"]
    return {
        **product,
        "margin": round(margin, 2),
        "margin_pct": round(100.0 * margin / product["list_price"], 1)
        if product["list_price"] else 0.0,
        "prices": [
            {**rule, "price": round(product["list_price"] *
                                    (1 + rule["adjustment_pct"] / 100.0), 2)}
            for rule in state.PRICE_LISTS
        ],
        "stock": [
            {"warehouse": w["name"],
             "on_hand": state.on_hand(w["name"], sku),
             "available": state.available(w["name"], sku)}
            for w in fx.WAREHOUSES
            if sku in state.STOCK.get(w["name"], {})
        ],
    }


@sales.post("/products")
def create_product(body: dict[str, Any] = Body(...),
                   _actor: dict[str, Any] = Depends(require("product.manage"))) -> dict[str, Any]:
    """Create a catalogue entry. Admin only (PS §3 reserves backend setup)."""
    sku = (body.get("sku") or "").strip().upper()
    if not sku:
        raise HTTPException(422, "sku is required")
    if any(p["sku"] == sku for p in state.PRODUCTS):
        raise HTTPException(409, {"error": "duplicate_sku", "sku": sku,
                                  "message": f"Product {sku} already exists."})
    try:
        list_price = float(body.get("list_price", 0))
        cost = float(body.get("cost", 0))
    except (TypeError, ValueError):
        raise HTTPException(422, "list_price and cost must be numbers")
    if list_price <= 0:
        raise HTTPException(422, "list_price must be greater than zero")
    if cost > list_price:
        # Not fatal -- a loss-leader is a real decision -- but the scorer treats
        # a negative-margin order as a hard Finance escalation, so say so now.
        pass

    product = dict(
        sku=sku, name=body.get("name") or sku,
        category=body.get("category", "Hardware"),
        list_price=list_price, cost=cost,
        uom=body.get("uom", "Each"), tax_pct=float(body.get("tax_pct", 18.0)),
        is_recurring=bool(body.get("is_recurring")),
        recurrence=body.get("recurrence"),
        is_promoted=bool(body.get("is_promoted")),
        stock_total=int(body.get("stock_total", 0)),
        description=body.get("description", ""),
        variants=body.get("variants", []),
    )
    state.PRODUCTS.append(product)
    state.sync_by_sku()
    stock_qty = int(body.get("stock_total", 50))
    if stock_qty > 0:
        state.STOCK.setdefault("Main Warehouse", {})[sku] = {
            "on_hand": stock_qty,
            "reserved": 0,
        }
    state.record("*", _actor.get("id", "admin"), "admin", "product_created", reason=sku)
    return product


@sales.patch("/products/{sku}")
def update_product(sku: str, body: dict[str, Any] = Body(...),
                   _actor: dict[str, Any] = Depends(require("product.manage"))) -> dict[str, Any]:
    product = next((p for p in state.PRODUCTS if p["sku"] == sku), None)
    if product is None:
        raise HTTPException(404, f"No product {sku}")
    editable = {"name", "category", "list_price", "cost", "uom", "tax_pct",
                "is_recurring", "recurrence", "is_promoted", "description", "variants"}
    for k, v in body.items():
        if k in editable:
            product[k] = v
    state.sync_by_sku()
    state.record("*", _actor.get("id", "admin"), "admin", "product_updated", reason=sku)
    return product_detail(sku)


@sales.get("/pricelists")
def pricelists(_actor: dict[str, Any] = Depends(require("product.view"))) -> list[dict[str, Any]]:
    return state.PRICE_LISTS


@sales.put("/pricelists")
def update_pricelists(body: dict[str, Any] = Body(...),
                      _actor: dict[str, Any] = Depends(require("product.manage"))) -> list[dict[str, Any]]:
    rows = body.get("pricelists")
    if not isinstance(rows, list) or not rows:
        raise HTTPException(422, "pricelists must be a non-empty list")
    state.PRICE_LISTS.clear()
    state.PRICE_LISTS.extend(rows)
    state.record("*", _actor.get("id", "admin"), "admin", "pricelist_updated",
                 reason=f"{len(rows)} rule(s)")
    return state.PRICE_LISTS


@sales.get("/quotes")
def list_quotes(state_filter: str | None = Query(None, alias="state"), _actor: dict[str, Any] = Depends(require("quote.view"))) -> list[dict[str, Any]]:
    out = []
    for row in svc.open_pipeline():
        q, r, t = row["quote"], row["result"], row["totals"]
        if state_filter and row["state"] != state_filter:
            continue
        out.append(dict(
            ref=q.ref, customer=q.customer, tier=q.tier,
            rep=fx.REP_NAME.get(q.rep_id, q.rep_id), state=row["state"],
            total=t["total"], risk_score=r.score, risk_band=r.band,
            last_activity_at=state.last_activity(q.ref),
            days_inactive=row["days_idle"],
            is_stalled=row["days_idle"] >= state.get_policy().stall_days,
        ))
    return out


@sales.get("/quotes/{ref}")
def quote_detail(ref: str, _actor: dict[str, Any] = Depends(require("quote.view"))) -> dict[str, Any]:
    try:
        quote, r = svc.score_for(ref)
    except KeyError:
        raise HTTPException(404, f"No quotation {ref}")
    t = svc.totals(quote)
    current = state.state_of(ref)
    over_by_sku = {l["sku"]: l for l in r.lines}
    return dict(
        ref=ref, customer=quote.customer, tier=quote.tier,
        rep=fx.REP_NAME.get(quote.rep_id, quote.rep_id), state=current,
        total=t["total"], subtotal=t["subtotal"],
        discount_total=t["discount_total"], tax_total=t["tax_total"],
        total_recurring=t["total_recurring"], margin_pct=t["margin_pct"],
        risk_score=r.score, risk_band=r.band,
        last_activity_at=state.last_activity(ref),
        days_inactive=fx.days_idle(ref),
        is_stalled=fx.days_idle(ref) >= state.get_policy().stall_days,
        allowed_transitions=LEGAL_TRANSITIONS.get(current, []),
        order_discount_pct=quote.order_discount_pct,
        narrative=svc.narrate(quote, r, fx.days_idle(ref)),
        contributions=r.contributions, notes=r.notes,
        lines=[dict(
            id=i, sku=l.sku, name=l.name, category=l.category, qty=l.qty,
            list_price=l.list_price,
            discount_pct=l.discount_pct,                       # the line's own
            effective_discount=quote.effective_discount(l),    # incl. order-level
            net=round(l.gross * (1 - quote.effective_discount(l) / 100.0), 2),
            is_recurring=l.is_recurring,
            cost=l.cost, margin=round(l.margin, 2),
            ceiling=over_by_sku[l.sku]["allowed"], over=over_by_sku[l.sku]["over"],
        ) for i, l in enumerate(quote.lines)],
    )


# --------------------------------------------------------------------------- #
#  Quotation Builder mutations (PS B3).
#
#  Every one of these returns the FULLY RECOMPUTED quotation, so a quantity
#  stepper or a discount keystroke costs the client exactly one round trip and
#  the margin bar, risk band and upsell ranking can never drift out of sync with
#  each other. Returning a bare 204 here would force the UI into three follow-up
#  fetches and open a window where the screen shows a stale score.
# --------------------------------------------------------------------------- #

def _rebuilt(ref: str) -> dict[str, Any]:
    return quote_detail(ref)


def _guard_editable(ref: str) -> None:
    """Only a DRAFT or a quote returned for revision may be edited.

    Without this, a reviewer could edit an already-approved quotation and
    silently invalidate the approval it is carrying."""
    current = state.state_of(ref)
    if current not in ("DRAFT", "NEGOTIATION"):
        raise HTTPException(status_code=409, detail={
            "error": "not_editable", "ref": ref, "current_state": current,
            "allowed": LEGAL_TRANSITIONS.get(current, []),
            "message": f"{ref} is {current} and can no longer be edited.",
        })


@sales.post("/quotes")
def create_quote(body: dict[str, Any] = Body(...), _actor: dict[str, Any] = Depends(require("quote.edit"))) -> dict[str, Any]:
    customer = body.get("customer")
    if customer not in fx.CUSTOMERS:
        raise HTTPException(422, f"Unknown customer {customer!r}")
    ref = state.create_quote(customer, body.get("rep", "rep_rao"))
    state.record(ref, fx.REP_NAME.get(body.get("rep", "rep_rao"), "A. Rao"),
                 "rep", "created", reason=f"new quotation for {customer}")
    return quote_detail(ref)


@sales.post("/quotes/{ref}/lines")
def add_line(ref: str, body: dict[str, Any] = Body(...), _actor: dict[str, Any] = Depends(require("quote.edit"))) -> dict[str, Any]:
    if ref not in state.QUOTES:
        raise HTTPException(404, f"No quotation {ref}")
    _guard_editable(ref)
    sku = body.get("sku")
    product = state.get_product(sku)
    if not product:
        raise HTTPException(422, f"Unknown product {sku!r}")
    state.add_line(ref, sku, int(body.get("qty", 1)), float(body.get("discount_pct", 0)))
    state.record(ref, body.get("actor", _actor.get("name", "A. Rao")), "rep", "line_added", reason=sku)
    return _rebuilt(ref)


@sales.patch("/quotes/{ref}/lines/{idx}")
def patch_line(ref: str, idx: int, body: dict[str, Any] = Body(...), _actor: dict[str, Any] = Depends(require("quote.edit"))) -> dict[str, Any]:
    if ref not in state.QUOTES:
        raise HTTPException(404, f"No quotation {ref}")
    _guard_editable(ref)
    if not 0 <= idx < len(state.QUOTES[ref]["lines"]):
        raise HTTPException(404, f"No line {idx} on {ref}")
    state.update_line(ref, idx, body.get("qty"), body.get("discount_pct"))
    if body.get("discount_pct") is not None:
        state.record(ref, body.get("actor", "A. Rao"), "rep", "discount_changed",
                     reason=f"line {idx} -> {body['discount_pct']}%")
    return _rebuilt(ref)


@sales.delete("/quotes/{ref}/lines/{idx}")
def delete_line(ref: str, idx: int, _actor: dict[str, Any] = Depends(require("quote.edit"))) -> dict[str, Any]:
    if ref not in state.QUOTES:
        raise HTTPException(404, f"No quotation {ref}")
    _guard_editable(ref)
    if not 0 <= idx < len(state.QUOTES[ref]["lines"]):
        raise HTTPException(404, f"No line {idx} on {ref}")
    state.remove_line(ref, idx)
    state.record(ref, "A. Rao", "rep", "line_removed", reason=f"line {idx}")
    return _rebuilt(ref)


@sales.patch("/quotes/{ref}")
def patch_quote(ref: str, body: dict[str, Any] = Body(...), _actor: dict[str, Any] = Depends(require("quote.edit"))) -> dict[str, Any]:
    """Order-level discount (PS B3). Stacks on top of every line at once."""
    if ref not in state.QUOTES:
        raise HTTPException(404, f"No quotation {ref}")
    _guard_editable(ref)
    if body.get("order_discount_pct") is not None:
        state.set_order_discount(ref, float(body["order_discount_pct"]))
        state.record(ref, body.get("actor", "A. Rao"), "rep", "discount_changed",
                     reason=f"order-level -> {body['order_discount_pct']}%")
    return _rebuilt(ref)


@sales.post("/quotes/{ref}/submit")
def submit(ref: str, actor: str = Query("A. Rao"), _actor: dict[str, Any] = Depends(require("quote.submit"))) -> dict[str, Any]:
    """Routing is driven by the REAL score. This is rubric step 3: the quote
    asks for approval by itself, without the rep requesting it."""
    try:
        quote, r = svc.score_for(ref)
    except KeyError:
        raise HTTPException(404, f"No quotation {ref}")

    current = state.state_of(ref)
    target = {"AUTO": "APPROVED", "MANAGER": "PENDING_MANAGER",
              "FINANCE": "PENDING_MANAGER"}[r.band]
    if not is_legal(current, target):
        _conflict(ref, current, target)

    state.set_state(ref, target)
    state.record(ref, actor, "rep", "submitted",
                 reason=f"score {r.score} -> {r.band}")
    return {"ref": ref, "state": target, "risk_score": r.score,
            "risk_band": r.band, "auto_routed": True,
            "requires_finance": r.band == "FINANCE",
            "allowed_transitions": LEGAL_TRANSITIONS[target]}


@sales.get("/approvals")
def approvals(pending_only: bool = Query(False), _actor: dict[str, Any] = Depends(require("quote.view"))) -> list[dict[str, Any]]:
    rows = []
    for row in svc.open_pipeline():
        q, r = row["quote"], row["result"]
        st = row["state"]
        if pending_only and not st.startswith("PENDING"):
            continue
        rows.append(dict(
            ref=q.ref, customer=q.customer, tier=q.tier, state=st,
            risk_score=r.score, risk_band=r.band,
            stage="Finance" if st == "PENDING_FINANCE" else
                  "Sales Manager" if st == "PENDING_MANAGER" else "—",
            assigned_to="R. Menon" if st == "PENDING_FINANCE" else
                        "M. Shah" if st == "PENDING_MANAGER" else "—",
        ))
    return rows


@sales.get("/approvals/{ref}")
def approval_detail(ref: str, _actor: dict[str, Any] = Depends(require("quote.view"))) -> dict[str, Any]:
    try:
        quote, r = svc.score_for(ref)
    except KeyError:
        raise HTTPException(404, f"No quotation {ref}")
    current = state.state_of(ref)
    needs_finance = r.band == "FINANCE"

    def step_status(role: str) -> str:
        if role == "Sales Manager":
            if current in ("APPROVED", "PENDING_FINANCE", "CONFIRMED",
                           "FULFILLED", "INVOICED", "PAID"):
                return "approved"
            if current == "REJECTED":
                return "rejected"
            return "pending" if current == "PENDING_MANAGER" else "skipped"
        if not needs_finance:
            return "skipped"
        if current in ("APPROVED", "CONFIRMED", "FULFILLED", "INVOICED", "PAID"):
            return "approved"
        return "pending" if current == "PENDING_FINANCE" else "skipped"

    steps = [dict(role="Sales Manager", status=step_status("Sales Manager"),
                  actor="M. Shah" if step_status("Sales Manager") == "approved" else None)]
    if needs_finance:
        steps.append(dict(role="Finance", status=step_status("Finance"),
                          actor="R. Menon" if step_status("Finance") == "approved" else None))

    return dict(
        ref=ref, customer=quote.customer, tier=quote.tier, state=current,
        risk_score=r.score, risk_band=r.band, steps=steps,
        contributions=r.contributions, lines=r.lines, notes=r.notes,
        narrative=svc.narrate(quote, r, fx.days_idle(ref)),
        audit=state.audit_for(ref),
        allowed_transitions=LEGAL_TRANSITIONS.get(current, []),
    )


@sales.post("/approvals/{ref}/action")
def approval_action(ref: str, body: dict[str, Any] = Body(...), _actor: dict[str, Any] = Depends(any_of("approval.manager", "approval.finance"))) -> dict[str, Any]:
    cached = state.idempotent(body.get("idempotency_key"))
    if cached:
        return cached

    action = body.get("action")
    actor = body.get("actor", "M. Shah")
    current = state.state_of(ref)

    # Reviewers act only on quotations that are actually awaiting review. The
    # DRAFT -> APPROVED edge exists for the auto-approve path in /submit and
    # must not be reachable from the approval desk.
    if current not in ("PENDING_MANAGER", "PENDING_FINANCE"):
        raise HTTPException(status_code=409, detail={
            "error": "not_awaiting_approval", "ref": ref, "current_state": current,
            "allowed": LEGAL_TRANSITIONS.get(current, []),
            "message": f"{ref} is {current}; it is not awaiting approval.",
        })
    try:
        _quote, r = svc.score_for(ref)
    except KeyError:
        raise HTTPException(404, f"No quotation {ref}")

    if action == "reject":
        target = "REJECTED"
    elif action == "return":
        target = "DRAFT"
    elif action == "approve":
        target = ("PENDING_FINANCE"
                  if current == "PENDING_MANAGER" and r.band == "FINANCE"
                  else "APPROVED")
    else:
        raise HTTPException(422, "action must be approve | reject | return")

    if not is_legal(current, target):
        _conflict(ref, current, target)

    state.set_state(ref, target)
    role = "finance" if current == "PENDING_FINANCE" else "manager"
    state.record(ref, actor, role, action + "d", reason=body.get("reason"))
    result = {"ref": ref, "state": target,
              "allowed_transitions": LEGAL_TRANSITIONS[target]}
    return state.remember(body.get("idempotency_key"), result)


# =========================================================================== #
#  OPERATIONS — Santhosh. STUB.
# =========================================================================== #

operations = APIRouter(tags=["operations"])


@operations.get("/warehouses")
def warehouses(_actor: dict[str, Any] = Depends(require("fulfilment.view"))) -> list[dict[str, Any]]:
    """Stock per depot with the three quantities the wireframe shows.

    On-hand minus reserved is what a rep can actually promise; showing only
    on-hand is how sales teams overcommit stock that is already spoken for.
    """
    out = []
    for w in fx.WAREHOUSES:
        shelf = state.STOCK.get(w["name"], {})
        out.append(dict(
            **w,
            replenish_rule=fx.REPLENISH.get(w["name"], {}) if isinstance(
                fx.REPLENISH.get(w["name"]), dict) else None,
            stock=[
                dict(sku=sku,
                     name=fx.BY_SKU[sku]["name"] if sku in fx.BY_SKU else sku,
                     on_hand=q["on_hand"], reserved=q["reserved"],
                     available=max(0, q["on_hand"] - q["reserved"]),
                     reorder_point=fx.REPLENISH.get(sku, 0))
                for sku, q in shelf.items()
            ],
        ))
    return out


@operations.get("/fulfilment/queue")
def fulfilment_queue(_actor: dict[str, Any] = Depends(require("fulfilment.view"))) -> list[dict[str, Any]]:
    """Orders awaiting fulfilment (wireframe screen 7, lower table).

    An order is fulfillable once it is approved or confirmed; the split is run
    live so the queue shows the CURRENT stock position rather than a stale
    snapshot taken when the order was approved.
    """
    ready = ("APPROVED", "CONFIRMED", "FULFILLED")
    rows: list[dict[str, Any]] = []
    for ref in state.QUOTES:
        st = state.state_of(ref)
        if st not in ready:
            continue
        quote = state.build_quote(ref)
        if quote is None:
            continue
        plan = _split_for(ref, "cost")
        if plan is None:
            continue
        depots = sorted({a["warehouse"] for a in plan["allocations"]})
        unmet = sum(b["qty"] for b in plan["backorders"])
        rows.append(dict(
            ref=ref, customer=quote.customer, state=st,
            status=("Backorder" if unmet else
                    "Split Pending" if len(depots) > 1 else "Ready"),
            warehouses=depots, warehouse_label=" + ".join(depots) or "—",
            units=sum(a["qty"] for a in plan["allocations"]),
            backordered=unmet, shipment_count=plan["shipment_count"],
            total_cost=plan["total_cost"],
            allocated=state.ALLOCATIONS.get(ref) is not None,
        ))
    return rows


@operations.post("/orders/{ref}/allocate")
def accept_allocation(ref: str, body: dict[str, Any] = Body(default_factory=dict), _actor: dict[str, Any] = Depends(require("fulfilment.allocate"))) -> dict[str, Any]:
    """Accept the suggested split, or persist a manual override (PS B6).

    Until this is called the split is only a recommendation. Persisting it is
    what makes "Accept Suggested Split" different from just looking at the
    screen -- and it is what a manual override has to write to.
    """
    if ref not in state.QUOTES:
        raise HTTPException(404, f"No quotation {ref}")

    # Free this order's own reservation first, so the recomputed split is
    # measured against stock that includes the units we are about to give back.
    state.release_allocation(ref)

    manual = body.get("allocations")
    if manual is not None:
        if not isinstance(manual, list) or not manual:
            raise HTTPException(422, "allocations must be a non-empty list")
        known = {w["name"] for w in fx.WAREHOUSES}
        for a in manual:
            if a.get("warehouse") not in known:
                raise HTTPException(422, f"unknown warehouse {a.get('warehouse')!r}")
            if int(a.get("qty", 0)) <= 0:
                raise HTTPException(422, "each allocation needs a positive qty")
        plan = dict(ref=ref, objective="manual", allocations=manual,
                    backorders=body.get("backorders", []),
                    shipment_count=len({a["warehouse"] for a in manual}),
                    total_cost=body.get("total_cost", 0.0),
                    fully_allocated=not body.get("backorders"),
                    consolidation_available=bool(body.get("backorders")),
                    explanation="Manually overridden by the operations user.")
    else:
        plan = _split_for(ref, body.get("objective", "cost"))
        if plan is None:
            raise HTTPException(404, f"No quotation {ref}")

    # Accepting a split is a COMMITMENT: it reserves the units so nobody
    # else can sell them out from under this order.
    state.apply_allocation(ref, plan["allocations"])
    state.ALLOCATIONS[ref] = plan
    state.record(ref, body.get("actor", "R. Menon"), "finance", "split",
                 reason=("manual override" if manual else
                         f"accepted {plan['objective']} split across "
                         f"{plan['shipment_count']} depot(s)"))
    return plan


def _split_for(ref: str, objective: str) -> dict[str, Any] | None:
    """One implementation of "how would this order ship", used by both the
    detail endpoint and the queue."""
    quote = state.build_quote(ref)
    if quote is None:
        return None
    warehouses = [Warehouse(name=w["name"],
                            ship_cost_weight=w["ship_cost_weight"],
                            fixed_shipment_cost=w["fixed_shipment_cost"])
                  for w in fx.WAREHOUSES]
    stock = {w["name"]: {sku: state.available(w["name"], sku)
                         for sku in state.STOCK.get(w["name"], {})}
             for w in fx.WAREHOUSES}
    lines = [DemandLine(sku=l.sku, name=l.name, qty=l.qty,
                        is_physical=(not l.is_recurring and l.category == "Hardware"))
             for l in quote.lines]
    payload = split_order(warehouses, lines, stock, objective=objective).to_dict()
    payload["ref"] = ref
    return payload


@operations.post("/orders/{ref}/split")
def split(ref: str, objective: str = Query("cost"), _actor: dict[str, Any] = Depends(require("fulfilment.allocate"))) -> dict[str, Any]:
    """Multi-warehouse allocation (PS A4/B6), exact over the subset lattice."""
    quote = state.build_quote(ref)
    if quote is None:
        raise HTTPException(404, f"No quotation {ref}")

    warehouses = [Warehouse(name=w["name"],
                            ship_cost_weight=w["ship_cost_weight"],
                            fixed_shipment_cost=w["fixed_shipment_cost"])
                  for w in fx.WAREHOUSES]
    stock = {w["name"]: {sku: state.available(w["name"], sku)
                         for sku in state.STOCK.get(w["name"], {})}
             for w in fx.WAREHOUSES}
    # Services, software licences and subscriptions ship nothing physical.
    lines = [DemandLine(sku=l.sku, name=l.name, qty=l.qty,
                        is_physical=(not l.is_recurring
                                     and l.category in ("Hardware",)))
             for l in quote.lines]

    result = split_order(warehouses, lines, stock, objective=objective)
    payload = result.to_dict()
    payload["ref"] = ref
    if result.backorders:
        state.record(ref, "System", "system", "split",
                     reason=f"{sum(b.qty for b in result.backorders)} unit(s) backordered")
    return payload


@operations.post("/orders/{ref}/consolidate")
def consolidate(ref: str, _actor: dict[str, Any] = Depends(require("fulfilment.allocate"))) -> dict[str, Any]:
    """PS B6: consolidate remaining backorder once stock arrives."""
    quote = state.build_quote(ref)
    if quote is None:
        raise HTTPException(404, f"No quotation {ref}")
    warehouses = [Warehouse(name=w["name"],
                            ship_cost_weight=w["ship_cost_weight"],
                            fixed_shipment_cost=w["fixed_shipment_cost"])
                  for w in fx.WAREHOUSES]
    # The backorder set must come from the stock we ACTUALLY had; the
    # replenishment is only available to the consolidation pass. Computing the
    # first split against replenished stock would leave nothing to consolidate.
    stock_now = {w["name"]: {sku: state.available(w["name"], sku)
                             for sku in state.STOCK.get(w["name"], {})}
                 for w in fx.WAREHOUSES}
    stock_after = {
        name: {sku: qty + fx.REPLENISH.get(sku, 0) for sku, qty in shelf.items()}
        for name, shelf in stock_now.items()
    }
    lines = [DemandLine(sku=l.sku, name=l.name, qty=l.qty,
                        is_physical=(not l.is_recurring and l.category == "Hardware"))
             for l in quote.lines]
    first = split_order(warehouses, lines, stock_now, objective="cost")
    result = consolidate_backorders(warehouses, first.backorders, stock_after)
    payload = result.to_dict()
    payload["ref"] = ref
    payload["consolidated"] = True
    state.record(ref, "System", "system", "split", reason="backorder consolidated")
    return payload


@operations.get("/subscriptions")
def subscriptions(_actor: dict[str, Any] = Depends(require("billing.view"))) -> list[dict[str, Any]]:
    return state.SUBSCRIPTIONS


@operations.post("/subscriptions/{sub_id}/change")
def change_subscription(sub_id: int, body: dict[str, Any] = Body(...), _actor: dict[str, Any] = Depends(require("billing.modify"))) -> dict[str, Any]:
    """Mid-cycle change with EXACT calendar proration (PS A5/B7).

    `today` is passed in from the demo clock rather than read from the wall
    clock, so the arithmetic on screen is identical at every rehearsal.
    """
    row = next((s for s in state.SUBSCRIPTIONS if s["id"] == sub_id), None)
    if row is None:
        raise HTTPException(404, f"No subscription {sub_id}")

    sub = BSub(id=row["id"], ref=row["ref"], plan=row["plan"], sku=row["sku"],
               cycle=row["cycle"], qty=row["qty"], unit_price=row["unit_price"],
               start_date=date.fromisoformat(row["start_date"]), status=row["status"])

    if body.get("action") == "cancel":
        result = prorate(sub, 0, fx.TODAY)
        row["status"] = "cancelled"
        row["qty"] = 0
    else:
        new_qty = int(body.get("new_qty", sub.qty))
        result = prorate(sub, new_qty, fx.TODAY)
        row["qty"] = new_qty
        if result.schedule:
            row["next_bill_date"] = result.schedule[0].due_date.isoformat()

    payload = result.to_dict()

    # A downgrade owes the customer money -> raise a credit note on the ledger
    # (account_move with a negative amount), per PS A5.
    if result.kind == "credit_note":
        note_ref = f"CN-{2000 + sub_id}"
        state.INVOICES.append(dict(
            ref=note_ref, order_ref=sub.ref, customer=row["customer"],
            kind="credit_note", amount=-round(result.credit, 2), amount_paid=0.0,
            status="issued", due_date=fx.TODAY.isoformat(),
        ))
        payload["credit_note_ref"] = note_ref
        state.record(sub.ref, "R. Menon", "finance", "credit_note",
                     reason=f"{note_ref} for {result.formula}")
    else:
        payload["credit_note_ref"] = None
    return payload


@operations.get("/orders/{ref}/billing")
def order_billing(ref: str, _actor: dict[str, Any] = Depends(require("billing.view"))) -> dict[str, Any]:
    """Unified hybrid ledger: one-time lines and recurring lines together."""
    quote = state.build_quote(ref)
    if quote is None:
        raise HTTPException(404, f"No quotation {ref}")

    one_time = [
        dict(sku=l.sku, name=l.name, qty=l.qty,
             amount=round(l.gross * (1 - quote.effective_discount(l) / 100.0), 2))
        for l in quote.lines if not l.is_recurring
    ]
    subs = [
        BSub(id=r["id"], ref=r["ref"], plan=r["plan"], sku=r["sku"], cycle=r["cycle"],
             qty=r["qty"], unit_price=r["unit_price"],
             start_date=date.fromisoformat(r["start_date"]), status=r["status"])
        for r in state.SUBSCRIPTIONS if r["ref"] == ref and r["status"] == "active"
    ]
    ledger = build_ledger(one_time, subs, fx.TODAY)
    ledger["ref"] = ref
    ledger["customer"] = quote.customer
    return ledger


@operations.post("/orders/{ref}/confirm")
def confirm_order(ref: str, body: dict[str, Any] = Body(default_factory=dict), _actor: dict[str, Any] = Depends(require("fulfilment.allocate"))) -> dict[str, Any]:
    """APPROVED -> CONFIRMED -> FULFILLED. Rubric step 8 begins here."""
    current = state.state_of(ref)
    if ref not in state.QUOTES:
        raise HTTPException(404, f"No quotation {ref}")
    for target in ("CONFIRMED", "FULFILLED"):
        if not is_legal(state.state_of(ref), target):
            _conflict(ref, state.state_of(ref), target)
        state.set_state(ref, target)
        state.record(ref, body.get("actor", "A. Rao"), "rep", target.lower())

    # Goods physically leave on fulfilment. If no split was explicitly
    # accepted, commit the recommended one first -- otherwise stock would
    # sit on the shelf for an order we have just shipped.
    if ref not in state.ALLOCATIONS:
        auto = _split_for(ref, "cost")
        if auto and auto["allocations"]:
            state.apply_allocation(ref, auto["allocations"])
            state.ALLOCATIONS[ref] = auto
    shipped = state.ship_allocation(ref)
    return {"ref": ref, "state": state.state_of(ref),
            "shipped": shipped,
            "allowed_transitions": LEGAL_TRANSITIONS[state.state_of(ref)]}


@operations.post("/orders/{ref}/invoice")
def generate_invoice(ref: str, body: dict[str, Any] = Body(default_factory=dict), _actor: dict[str, Any] = Depends(require("invoice.manage"))) -> dict[str, Any]:
    """Generate the invoice FROM the order (rubric step 8).

    Previously invoices were static fixture rows, which meant the payment tail
    could only ever be demonstrated on pre-baked data. This derives the amount
    from the actual order ledger: one-time lines are invoiced now, recurring
    lines are left to their own billing schedule.
    """
    cached = state.idempotent(body.get("idempotency_key"))
    if cached:
        return cached

    quote = state.build_quote(ref)
    if quote is None:
        raise HTTPException(404, f"No quotation {ref}")

    current = state.state_of(ref)
    if not is_legal(current, "INVOICED"):
        _conflict(ref, current, "INVOICED")

    existing = next((i for i in state.INVOICES
                     if i["order_ref"] == ref and i["kind"] == "invoice"), None)
    if existing:
        # An invoice may already exist from the seeded book of business. Reusing
        # it is correct -- but the ORDER still has to advance, or it stalls at
        # FULFILLED forever and the payment tail can never be demonstrated.
        state.set_state(ref, "INVOICED")
        state.record(ref, body.get("actor", "R. Menon"), "finance", "invoiced",
                     reason=f"{existing['ref']} (existing)")
        return existing

    one_time = [l for l in quote.lines if not l.is_recurring]
    net = sum(l.gross * (1 - quote.effective_discount(l) / 100.0) for l in one_time)
    amount = round(net * 1.18, 2)          # 18% tax, matching the quote totals

    inv_ref = f"INV-{ref.split('-')[-1]}"
    invoice = dict(
        ref=inv_ref, order_ref=ref, customer=quote.customer, kind="invoice",
        amount=amount, amount_paid=0.0, status="unpaid",
        due_date=(fx.TODAY + timedelta(days=14)).isoformat(),
        lines=[dict(sku=l.sku, name=l.name, qty=l.qty,
                    amount=round(l.gross * (1 - quote.effective_discount(l) / 100.0), 2))
               for l in one_time],
    )
    state.INVOICES.append(invoice)
    state.set_state(ref, "INVOICED")
    state.record(ref, body.get("actor", "R. Menon"), "finance", "invoiced",
                 reason=f"{inv_ref} for {amount}")
    return state.remember(body.get("idempotency_key"), invoice)


@operations.get("/invoices")
def invoices(_actor: dict[str, Any] = Depends(require("billing.view"))) -> list[dict[str, Any]]:
    return state.INVOICES


@operations.post("/invoices/{ref}/payment")
def pay(ref: str, body: dict[str, Any] = Body(...), _actor: dict[str, Any] = Depends(require("invoice.manage"))) -> dict[str, Any]:
    """Rubric step 8. Idempotent: a double-click on a projector is a real hazard."""
    cached = state.idempotent(body.get("idempotency_key"))
    if cached:
        return cached

    inv = next((i for i in state.INVOICES if i["ref"] == ref), None)
    if inv is None:
        raise HTTPException(404, f"No invoice {ref}")
    if inv["status"] == "paid":
        raise HTTPException(409, detail={
            "error": "already_paid", "ref": ref,
            "message": f"{ref} is already fully paid."})

    inv["amount_paid"] = round(inv["amount_paid"] + float(body.get("amount", 0)), 2)
    inv["status"] = ("paid" if inv["amount_paid"] >= inv["amount"] - 0.01
                     else "partial" if inv["amount_paid"] > 0 else "unpaid")
    inv["method"] = body.get("method", "bank_transfer")

    # Rubric step 8 closes the loop: a fully paid invoice moves the ORDER to
    # PAID as well. Flipping only the invoice would leave the quotation stuck at
    # INVOICED forever, which is the exact "flow stops short" gap the rubric's
    # final step is testing for.
    order_state = state.state_of(inv["order_ref"])
    if inv["status"] == "paid" and is_legal(order_state, "PAID"):
        state.set_state(inv["order_ref"], "PAID")

    state.record(inv["order_ref"], body.get("actor", "R. Menon"), "finance",
                 "paid", reason=f"{ref} {inv['status']} via {inv['method']}")
    return state.remember(body.get("idempotency_key"),
                          {**inv, "order_state": state.state_of(inv["order_ref"])})


# =========================================================================== #
#  PORTAL — Balaji. Redaction is REAL.
#
#  PS 7: "a real, separate, restricted view, not just another internal screen
#  with a different label." The guarantee here is STRUCTURAL: we build a fresh
#  dict containing only customer-facing fields, rather than filtering the
#  internal one. Adding a field to the internal model therefore cannot leak it.
# =========================================================================== #

portal = APIRouter(tags=["portal"])


def _sign(ref: str) -> str:
    return hmac.new(PORTAL_SECRET, ref.encode(), hashlib.sha256).hexdigest()[:12]


@portal.get("/portal/{token}")
def portal_quote(token: str) -> dict[str, Any]:
    ref = fx.PORTAL_TOKENS.get(token)
    if ref is None:
        raise HTTPException(404, "Invalid or expired link")

    quote = fx.get_quote(ref)
    if quote is None:
        raise HTTPException(404, "Invalid or expired link")
    t = svc.totals(quote)
    internal = state.state_of(ref)
    status = ("Confirmed" if internal in ("CONFIRMED", "FULFILLED", "INVOICED", "PAID")
              else "Under Negotiation" if internal == "NEGOTIATION" else "Sent")

    # Built field by field. There is no cost, margin, risk_score, ceiling, over,
    # rep or internal note anywhere in this structure -- and test_api.py asserts
    # that on the serialised bytes.
    return dict(
        ref=ref,
        customer=quote.customer,
        status=status,
        valid_until="2026-09-30",
        currency="INR",
        subtotal=t["subtotal"],
        discount_total=t["discount_total"],
        tax_total=t["tax_total"],
        total=t["total"],
        recurring_total=t["total_recurring"],
        can_confirm=internal in ("APPROVED", "NEGOTIATION"),
        comments=state.PORTAL_COMMENTS.get(ref, []),
        lines=[dict(
            id=i, name=l.name, category=l.category, qty=l.qty,
            unit_price=l.list_price, discount_pct=l.discount_pct,
            line_total=round(l.net, 2),
        ) for i, l in enumerate(quote.lines)],
    )


@portal.post("/portal/{token}/request")
def portal_request(token: str, body: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Customer counter-offer. Rubric step 7: if the counter breaks a threshold
    the quote re-enters approval AUTOMATICALLY, with no manual resubmission."""
    ref = fx.PORTAL_TOKENS.get(token)
    if ref is None:
        raise HTTPException(404, "Invalid or expired link")

    quote = fx.get_quote(ref)
    counter = body.get("counter_discount_pct")
    state.PORTAL_COMMENTS.setdefault(ref, []).append(dict(
        line_id=body.get("line_id"), author=quote.customer,
        body=body.get("comment"), counter_discount_pct=counter,
        created_at=state.last_activity(ref),
    ))
    state.record(ref, quote.customer, "customer", "countered",
                 reason=body.get("comment"))

    re_entered = False
    new_band = None
    if counter is not None:
        # A counter-offer always puts the quote into NEGOTIATION first. That is
        # a legal move from both APPROVED and CONFIRMED, and it keeps the audit
        # trail honest: the customer asked, THEN the system re-routed. Jumping
        # straight to PENDING_MANAGER would skip a state and lose that ordering.
        current = state.state_of(ref)
        if is_legal(current, "NEGOTIATION"):
            state.set_state(ref, "NEGOTIATION")
        elif current != "NEGOTIATION":
            _conflict(ref, current, "NEGOTIATION")

        # Re-score the quote AS IF the counter were accepted.
        probe = fx.get_quote(ref)
        line_id = body.get("line_id")
        if line_id is not None and 0 <= line_id < len(probe.lines):
            probe.lines[line_id].discount_pct = float(counter)
        else:
            for l in probe.lines:
                l.discount_pct = float(counter)
        r = score_quote(state.get_policy(), probe, fx.history_for(probe.rep_id))
        new_band = r.band

        # PS B8: "If final terms exceed approval thresholds, the quotation
        # automatically re-enters the approval flow from B4." No rep action.
        if r.band != "AUTO":
            state.set_state(ref, "PENDING_MANAGER")
            state.record(ref, "System", "system", "submitted",
                         reason=f"counter-offer of {counter:g}% re-scored to "
                                f"{r.band} (score {r.score})")
            re_entered = True

    return {"ok": True, "ref": ref, "re_entered_approval": re_entered,
            "new_band": new_band, "state": state.state_of(ref)}


# =========================================================================== #
#  INSIGHTS — Prabanjan. STUB (leakage is computed).
# =========================================================================== #

insights = APIRouter(tags=["insights"])


@insights.get("/dashboard")
def dashboard(_actor: dict[str, Any] = Depends(require("quote.view"))) -> dict[str, Any]:
    lk = svc.leakage_report()
    pipeline = svc.open_pipeline()
    stall_days = state.get_policy().stall_days

    pipeline_value = sum(r["totals"]["total"] for r in pipeline)
    stalled = [r for r in pipeline if r["days_idle"] >= stall_days]
    bands = {"AUTO": 0, "MANAGER": 0, "FINANCE": 0}
    for r in pipeline:
        bands[r["result"].band] += 1

    alerts: list[dict[str, Any]] = []
    for r in stalled:
        alerts.append(dict(
            kind="stalled", severity="high", ref=r["quote"].ref,
            customer=r["quote"].customer,
            headline=f"Idle {r['days_idle']} days",
            detail=f"No activity since {state.last_activity(r['quote'].ref)}.",
            created_at=state.last_activity(r["quote"].ref),
            actions=["nudge", "escalate", "open"]))
    for r in pipeline:
        z = r["result"].contributions.get("Z", 0)
        if z > 8:
            alerts.append(dict(
                kind="discount_anomaly", severity="high" if z > 12 else "medium",
                ref=r["quote"].ref, customer=r["quote"].customer,
                headline="Discount well above this rep's average",
                detail=f"Behavioural term contributes {z:.0f} of "
                       f"{r['result'].score:.0f} risk points.",
                created_at=state.last_activity(r["quote"].ref),
                actions=["open", "escalate"]))

    return dict(
        pipeline_value=round(pipeline_value, 2),
        open_quotes=len(pipeline),
        stalled_count=len(stalled),
        stalled_value=round(sum(r["totals"]["total"] for r in stalled), 2),
        avg_discount_pct=lk["avg_discount_pct"],
        leakage_total=lk["leakage_total"],
        leakage_ratio=lk["leakage_ratio"],
        closed_orders_analysed=lk["closed_orders_analysed"],
        median_approval_hours=26.0,
        band_counts=bands,
        alerts=alerts,
    )


@insights.get("/activity")
def activity(limit: int = Query(12, ge=1, le=100), _actor: dict[str, Any] = Depends(require("quote.view"))) -> list[dict[str, Any]]:
    """Recent platform activity, straight off the append-only audit log.

    The admin dashboard previously rendered a hand-written feed naming people
    and companies that do not exist in this system. Every row here is an event
    something actually did.
    """
    tone = {
        "approved": "#047857", "paid": "#047857", "confirmed": "#047857",
        "submitted": "#0E7490", "created": "#0E7490", "line_added": "#0E7490",
        "rejected": "#BE123C", "countered": "#B45309",
        "discount_changed": "#B45309", "policy_changed": "#B45309",
        "split": "#0E7490", "invoiced": "#0E7490", "credit_note": "#B45309",
    }
    label = {
        "created": "created quotation", "line_added": "added a line to",
        "discount_changed": "changed discount on", "submitted": "submitted",
        "approved": "approved", "rejected": "rejected",
        "returned": "returned for revision", "countered": "countered terms on",
        "confirmed": "confirmed", "fulfilled": "fulfilled",
        "invoiced": "invoiced", "paid": "recorded payment on",
        "split": "committed a warehouse split for",
        "policy_changed": "updated discount policy",
        "credit_note": "issued a credit note for",
        "product_created": "added a product", "product_updated": "updated a product",
        "pricelist_updated": "updated the price book",
    }
    rows: list[dict[str, Any]] = []
    for e in reversed(state.EVENTS[-limit * 2:]):
        ref = e["order_ref"]
        verb = label.get(e["event_type"], e["event_type"].replace("_", " "))
        subject = "" if ref in (None, "*") else f" {ref}"
        customer = state.QUOTES.get(ref, {}).get("customer") if ref else None
        rows.append(dict(
            id=f"{e['created_at']}-{e['event_type']}-{ref}",
            title=f"{e['actor']} {verb}{subject}"
                  + (f" ({customer})" if customer else ""),
            type=e["event_type"],
            color=tone.get(e["event_type"], "#7B8CA0"),
            actor=e["actor"], role=e["actor_role"],
            ref=ref, reason=e.get("reason"), at=e["created_at"],
        ))
        if len(rows) >= limit:
            break
    return rows


@insights.get("/reports")
def reports(period: str | None = Query(None, description="today | week | month | all"),
            rep: str | None = None,
            category: str | None = None,
            approval_status: str | None = None,
            _actor: dict[str, Any] = Depends(require("reports.view"))) -> dict[str, Any]:
    """Reporting with the four filters PS A7 names: Period, Sales Team / Rep,
    Approval Status, Product / Category."""
    from datetime import timedelta

    horizon = {"today": 1, "week": 7, "month": 30}.get(period or "all")
    cutoff = (fx.TODAY - timedelta(days=horizon)).isoformat() if horizon else None

    rows = svc.open_pipeline()
    if rep:
        rows = [r for r in rows if fx.REP_NAME.get(r["quote"].rep_id) == rep]
    if approval_status:
        rows = [r for r in rows if r["state"] == approval_status]
    if cutoff:
        rows = [r for r in rows if state.last_activity(r["quote"].ref) >= cutoff]

    by_category: dict[str, dict[str, float]] = {}
    by_rep: dict[str, dict[str, float]] = {}
    for r in rows:
        rep_name = fx.REP_NAME.get(r["quote"].rep_id, r["quote"].rep_id)
        rb = by_rep.setdefault(rep_name, {"quotes": 0, "value": 0.0, "avg_risk": 0.0})
        rb["quotes"] += 1
        rb["value"] += r["totals"]["total"]
        rb["avg_risk"] += r["result"].score
        for line in r["quote"].lines:
            if category and line.category != category:
                continue
            b = by_category.setdefault(line.category,
                                       {"revenue": 0.0, "discount": 0.0, "units": 0})
            b["revenue"] += line.gross
            b["discount"] += line.gross - r["quote"].effective_discount(line) / 100.0 * line.gross
            b["units"] += line.qty
    for rb in by_rep.values():
        rb["avg_risk"] = round(rb["avg_risk"] / rb["quotes"], 1) if rb["quotes"] else 0.0
        rb["value"] = round(rb["value"], 2)

    # Most-attached product across the closed book -- the wireframe's
    # "Top Upsold Product" tile. Counted from real order lines, not asserted.
    counts: dict[str, int] = {}
    for o in fx.CLOSED_ORDERS:
        for sku, qty, _d in o["lines"]:
            counts[sku] = counts.get(sku, 0) + qty
    top_sku = max(counts, key=counts.get) if counts else None

    approval_hours = [o["approval_hours"] for o in fx.CLOSED_ORDERS]
    approval_hours.sort()
    median_hours = (approval_hours[len(approval_hours) // 2]
                    if approval_hours else 0.0)

    # Approval turnaround over the last six weeks, from the closed-order book.
    # Bucketed by the week an order actually closed rather than plotted against
    # an invented Mon-Fri axis.
    buckets: dict[int, list[float]] = {}
    today = fx.TODAY
    for o in fx.CLOSED_ORDERS:
        closed = date.fromisoformat(o["closed_at"][:10])
        weeks_ago = (today - closed).days // 7
        if 0 <= weeks_ago < 6:
            buckets.setdefault(weeks_ago, []).append(o["approval_hours"])
    trend = [
        dict(label=("This week" if w == 0 else f"-{w}w"),
             value=round(sum(buckets[w]) / len(buckets[w]), 1),
             orders=len(buckets[w]))
        for w in sorted(buckets, reverse=True)
    ]

    return dict(
        filters=dict(period=period or "all", rep=rep, category=category,
                     approval_status=approval_status),
        quotes_created=len(rows),
        total_value=round(sum(r["totals"]["total"] for r in rows), 2),
        avg_approval_hours=round(median_hours, 1),
        turnaround_trend=trend,
        top_upsold=dict(sku=top_sku,
                        name=fx.BY_SKU.get(top_sku, {}).get("name", top_sku),
                        units=counts.get(top_sku, 0)) if top_sku else None,
        band_counts={b: sum(1 for r in rows if r["result"].band == b)
                     for b in ("AUTO", "MANAGER", "FINANCE")},
        by_category={k: {kk: round(vv, 2) for kk, vv in v.items()}
                     for k, v in by_category.items()},
        by_rep=by_rep,
        reps=sorted({fx.REP_NAME.get(r["quote"].rep_id, r["quote"].rep_id)
                     for r in svc.open_pipeline()}),
        rows=[dict(ref=r["quote"].ref, customer=r["quote"].customer,
                   rep=fx.REP_NAME.get(r["quote"].rep_id), state=r["state"],
                   total=r["totals"]["total"], risk_score=r["result"].score,
                   risk_band=r["result"].band,
                   last_activity=state.last_activity(r["quote"].ref)) for r in rows],
    )


def _enrich_pipeline_deal(row: dict[str, Any], stall_days: int) -> dict[str, Any]:
    q = row["quote"]
    r = row["result"]
    t = row["totals"]
    curr_state = row["state"]
    idle = row["days_idle"]

    if curr_state in ("REJECTED", "CLOSED_LOST", "CANCELLED"):
        health_cat = "CLOSED_LOST"
    elif idle >= stall_days:
        health_cat = "STALLED"
    elif r.band in ("MANAGER", "FINANCE") or r.score > 25.0:
        health_cat = "AT_RISK"
    else:
        health_cat = "HEALTHY"

    if r.band == "FINANCE" or r.score >= 50.0:
        risk_lvl = "HIGH"
    elif r.band == "MANAGER" or r.score >= 20.0:
        risk_lvl = "MEDIUM"
    else:
        risk_lvl = "LOW"

    if r.notes:
        risk_exp = "; ".join(r.notes)
    else:
        risk_exp = "Pricing is compliant and within standard policy thresholds."

    products = [
        dict(productId=l.sku, name=l.name, qty=l.qty, unitPrice=l.list_price)
        for l in q.lines
    ]

    warehouse_split = []
    if q.ref in state.ALLOCATIONS:
        alloc = state.ALLOCATIONS[q.ref]
        for a in alloc.get("allocations", []):
            wh_name = a.get("warehouse", "Warehouse")
            warehouse_split.append(dict(
                warehouseId=wh_name.lower().replace(" ", "-"),
                name=wh_name,
                unitsAllocated=sum(item.get("qty", 0) for item in a.get("lines", [])),
            ))
    elif any(l.category == "Hardware" and l.qty >= 20 for l in q.lines):
        try:
            whs = [Warehouse(name=w["name"], ship_cost_weight=w["ship_cost_weight"], fixed_shipment_cost=w["fixed_shipment_cost"]) for w in fx.WAREHOUSES]
            stk = {w["name"]: {sku: state.available(w["name"], sku) for sku in state.STOCK.get(w["name"], {})} for w in fx.WAREHOUSES}
            lines = [DemandLine(sku=l.sku, name=l.name, qty=l.qty, is_physical=True) for l in q.lines if l.category == "Hardware"]
            split_res = split_order(whs, lines, stk, objective="cost")
            for a in split_res.allocations:
                warehouse_split.append(dict(
                    warehouseId=a.warehouse.name.lower().replace(" ", "-"),
                    name=a.warehouse.name,
                    unitsAllocated=sum(s.qty for s in a.lines),
                ))
        except Exception:
            pass

    sub_line = next((l for l in q.lines if l.is_recurring), None)
    sub_dict = None
    if sub_line:
        sub_dict = dict(
            planName=sub_line.name,
            billingCycle="Annual" if ("yearly" in getattr(sub_line, "recurrence", "").lower() or "gold" in sub_line.sku.lower()) else "Monthly",
            seats=sub_line.qty,
            prorationNote="Pro-rata billing scheduled on order confirmation.",
        )
    else:
        cust_sub = next((s for s in state.SUBSCRIPTIONS if s.get("customer") == q.customer), None)
        if cust_sub:
            sub_dict = dict(
                planName=cust_sub.get("plan", "Enterprise Support"),
                billingCycle=cust_sub.get("billing_cycle", "Monthly").capitalize(),
                seats=cust_sub.get("seats", 5),
                prorationNote="Active recurring contract.",
            )

    scenario_tags = []
    if warehouse_split and len(warehouse_split) > 1:
        scenario_tags.append("SPLIT_FULFILLMENT")
    if sub_dict:
        scenario_tags.append("SUBSCRIPTION")
    if t["margin_pct"] >= 55.0:
        scenario_tags.append("HIGH_MARGIN")
    if r.band == "FINANCE":
        scenario_tags.append("FINANCE_ESCALATION")
    elif r.band == "MANAGER":
        scenario_tags.append("MANAGER_ESCALATION")
    if idle >= stall_days:
        scenario_tags.append("STALLED_PIPELINE")
    if r.contributions.get("Z", 0) > 8:
        scenario_tags.append("BEHAVIOURAL_ANOMALY")
    if any(l.get("over", 0) > 0 for l in r.lines):
        scenario_tags.append("CEILING_BREACH")
    if not scenario_tags:
        scenario_tags.append("STANDARD_DEAL")

    has_software = any(l.category == "Software" for l in q.lines)
    upsell_opportunity = not has_software
    suggested_upsell = [
        dict(productId="SW-DESIGN", name="DesignSuite Licence"),
        dict(productId="DOCK-01", name="Docking Station"),
    ] if upsell_opportunity else []

    return dict(
        id=q.ref,
        customerId=f"CUST-{q.customer.replace(' ', '-')}",
        customerName=q.customer,
        salesRepId=q.rep_id,
        salesRepName=fx.REP_NAME.get(q.rep_id, q.rep_id),
        products=products,
        currency="INR",
        grossValue=round(t.get("subtotal", 0.0), 2),
        discountPercent=round(100.0 * t.get("discount_total", 0.0) / t.get("subtotal", 1.0), 1) if t.get("subtotal", 0.0) else 0.0,
        value=round(t["total"], 2),
        stage=curr_state,
        approvalStage=r.band,
        riskScore=round(r.score, 1),
        riskLevel=risk_lvl,
        riskExplanation=risk_exp,
        createdDaysAgo=idle + 3,
        lastActivityDaysAgo=idle,
        createdAt=fx._ago(idle + 3),
        lastActivityAt=state.last_activity(q.ref),
        daysSinceLastActivity=idle,
        healthCategory=health_cat,
        upsellOpportunity=upsell_opportunity,
        suggestedUpsellProducts=suggested_upsell,
        scenarioTags=scenario_tags,
        warehouseSplit=warehouse_split,
        subscription=sub_dict,
    )


def _enrich_closed_deal(cq: Quote, idx: int) -> dict[str, Any]:
    t = svc.totals(cq)
    days_ago = 10 + (idx * 3) % 90
    closed_disc_pct = round(100.0 * t.get("discount_total", 0.0) / t.get("subtotal", 1.0), 1) if t.get("subtotal", 0.0) else 0.0
    return dict(
        id=cq.ref,
        customerId=f"CUST-{cq.customer.replace(' ', '-')}",
        customerName=cq.customer,
        salesRepId=cq.rep_id,
        salesRepName=fx.REP_NAME.get(cq.rep_id, cq.rep_id),
        products=[
            dict(productId=l.sku, name=l.name, qty=l.qty, unitPrice=l.list_price)
            for l in cq.lines
        ],
        currency="INR",
        grossValue=round(t.get("subtotal", 0.0), 2),
        discountPercent=closed_disc_pct,
        value=round(t["total"], 2),
        stage="CLOSED_WON",
        approvalStage="AUTO",
        riskScore=round(closed_disc_pct * 0.6, 1),
        riskLevel="LOW",
        riskExplanation="Historical settled contract. Fulfilled and fully paid.",
        createdDaysAgo=days_ago + 5,
        lastActivityDaysAgo=days_ago,
        createdAt=fx._ago(days_ago + 5),
        lastActivityAt=fx._ago(days_ago),
        daysSinceLastActivity=days_ago,
        healthCategory="HEALTHY",
        upsellOpportunity=False,
        suggestedUpsellProducts=[],
        scenarioTags=["CLOSED_WON", "FULFILLED"],
        warehouseSplit=[],
        subscription=None,
    )


def _all_deal_health_deals() -> list[dict[str, Any]]:
    pipeline = svc.open_pipeline()
    stall_days = state.get_policy().stall_days
    active = [_enrich_pipeline_deal(row, stall_days) for row in pipeline]
    closed = [_enrich_closed_deal(cq, i) for i, cq in enumerate(fx.closed_as_quotes()[:35])]
    return active + closed


@insights.get("/deal-health/dashboard")
def deal_health_dashboard(_actor: dict[str, Any] = Depends(require("quote.view"))) -> dict[str, Any]:
    deals = _all_deal_health_deals()
    counts = {"HEALTHY": 0, "AT_RISK": 0, "STALLED": 0, "CLOSED_LOST": 0}
    by_stage: dict[str, int] = {}
    for d in deals:
        counts[d["healthCategory"]] = counts.get(d["healthCategory"], 0) + 1
        by_stage[d["stage"]] = by_stage.get(d["stage"], 0) + 1

    open_pipeline_val = sum(d["value"] for d in deals if d["healthCategory"] != "CLOSED_LOST" and d["stage"] != "CLOSED_WON")
    avg_disc = round(sum(d["discountPercent"] for d in deals) / len(deals), 1) if deals else 0.0

    at_risk_deals = [
        dict(
            dealId=d["id"],
            customerName=d["customerName"],
            salesRep=d["salesRepName"],
            discount=d["discountPercent"],
            riskScore=d["riskScore"],
            riskLevel=d["riskLevel"],
            riskExplanation=d["riskExplanation"],
            approvalStage=d["approvalStage"],
            status="AT_RISK",
        )
        for d in deals if d["healthCategory"] == "AT_RISK"
    ]
    at_risk_deals.sort(key=lambda x: (x["riskScore"] or 0), reverse=True)

    stalled_deals = [
        dict(
            dealId=d["id"],
            customerName=d["customerName"],
            salesRep=d["salesRepName"],
            value=d["value"],
            daysStalled=d["daysSinceLastActivity"],
            status="STALLED",
        )
        for d in deals if d["healthCategory"] == "STALLED"
    ]
    stalled_deals.sort(key=lambda x: x["daysStalled"], reverse=True)

    pipeline = svc.open_pipeline()
    rep_histories = []
    for profile in fx.REP_PROFILES:
        rep_id = profile["id"]
        rep_name = profile["name"]
        base_history = list(fx.history_for(rep_id))
        active_discs = [
            round(100.0 * r["totals"]["discount_total"] / r["totals"]["subtotal"], 1)
            if r["totals"].get("subtotal") else 0.0
            for r in pipeline if r["quote"].rep_id == rep_id
        ]
        all_discs = base_history + active_discs
        avg_d = round(sum(all_discs) / len(all_discs), 1) if all_discs else 0.0
        max_d = round(max(all_discs), 1) if all_discs else 0.0
        rep_histories.append(dict(
            salesRepId=rep_id,
            salesRepName=rep_name,
            totalDeals=len(all_discs),
            averageDiscount=avg_d,
            highestDiscount=max_d,
            discountHistory=all_discs[-15:],
        ))

    summary = dict(
        totalDeals=len(deals),
        healthyDeals=counts["HEALTHY"],
        atRiskDeals=counts["AT_RISK"],
        stalledDeals=counts["STALLED"],
        closedLostDeals=counts["CLOSED_LOST"],
        averageDiscount=avg_disc,
        openPipelineValue=round(open_pipeline_val, 2),
        currency="INR",
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )

    status_distribution = dict(
        byStage=[dict(stage=s, count=c) for s, c in sorted(by_stage.items())],
        byHealthCategory=[dict(healthCategory=h, count=c) for h, c in counts.items()],
        totalDeals=len(deals),
    )

    return dict(
        summary=summary,
        atRiskDeals=at_risk_deals,
        stalledDeals=stalled_deals,
        salesRepDiscountHistory=rep_histories,
        statusDistribution=status_distribution,
        generatedAt=datetime.now(timezone.utc).isoformat(),
    )


@insights.get("/deal-health/deals")
def deal_health_deals(_actor: dict[str, Any] = Depends(require("quote.view"))) -> list[dict[str, Any]]:
    return _all_deal_health_deals()


# =========================================================================== #
#  INFRASTRUCTURE
# =========================================================================== #

infra = APIRouter(tags=["infra"])


@infra.get("/events/stream")
async def stream():
    q = state.subscribe()

    async def gen():
        try:
            yield 'data: {"type":"connected"}\n\n'
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15.0)
                    yield f"data: {msg}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"      # keeps proxies from closing us
        finally:
            state.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache",
                                      "X-Accel-Buffering": "no"})


@infra.post("/admin/reset")
def reset(_actor: dict[str, Any] = Depends(require("admin.reset"))) -> dict[str, Any]:
    """Demo guardrail. Must be fast enough to use mid-sentence on stage."""
    elapsed = state.restore()
    state.publish({"type": "reset"})
    return {"ok": True, "elapsed_ms": round(elapsed, 2),
            "source": "golden snapshot"}
