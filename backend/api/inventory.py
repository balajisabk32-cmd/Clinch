"""Available-to-promise, and the plan for meeting a demand.

ATP = on_hand - reserved, per depot. The distinction matters: on-hand is what
is on the shelf, reserved is what is already promised to another order, and only
the difference can be sold again. A quote builder that shows on-hand is how a
sales team commits stock twice.

This module answers two questions a rep asks while building a line:
  * how much can I promise, and from where?
  * if this one depot cannot cover it, what would the split look like?

Both are read-only. Nothing here reserves anything — allocation is a decision
made at confirmation, in engine/fulfilment.py, against the same numbers.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, HTTPException

from . import fixtures as fx, state
from .auth import require

inventory = APIRouter(tags=["inventory"])


def _depot_rows(sku: str) -> list[dict[str, Any]]:
    rows = []
    for w in fx.WAREHOUSES:
        name = w["name"]
        q = state.STOCK.get(name, {}).get(sku)
        if q is None:
            continue
        on_hand = int(q.get("on_hand", 0))
        reserved = int(q.get("reserved", 0))
        rows.append(dict(
            warehouse=name,
            on_hand=on_hand,
            reserved=reserved,
            available=max(0, on_hand - reserved),
            ship_cost_weight=w.get("ship_cost_weight", 1.0),
            fixed_shipment_cost=w.get("fixed_shipment_cost", 0.0),
        ))
    # Cheapest first, so "the depot we would ship from" is row one and the UI
    # does not have to know the cost model to present a sensible default.
    rows.sort(key=lambda r: (r["ship_cost_weight"], -r["available"]))
    return rows


def availability_for(sku: str, requested: int = 0) -> dict[str, Any]:
    depots = _depot_rows(sku)
    total = sum(d["available"] for d in depots)
    stocked = [d for d in depots if d["available"] > 0]

    plan: list[dict[str, Any]] = []
    remaining = max(0, int(requested))
    for d in stocked:
        if remaining <= 0:
            break
        take = min(d["available"], remaining)
        plan.append({"warehouse": d["warehouse"], "units": take})
        remaining -= take

    return dict(
        sku=sku,
        total_available=total,
        depot_count=len(stocked),
        depots=depots,
        requested=int(requested),
        shortfall=remaining,                      # unmet units -> backorder
        # A split is only "required" when one depot genuinely cannot cover the
        # ask. Reporting a split for a quantity the cheapest depot can absorb
        # would push freight cost up for no reason.
        split_required=len(plan) > 1,
        plan=plan,
    )


@inventory.get("/inventory/availability")
def availability(
    skus: str = Query(..., description="Comma-separated SKUs"),
    qty: int = Query(0, ge=0, description="Quantity being considered, for the split hint"),
    # `product.view`, not `fulfilment.view`. A rep needs to know what they can
    # promise while building a quotation -- that is quoting information, not
    # warehouse operations, and reps do not hold fulfilment.view. Gating it
    # there silently emptied the live stock indicator in the Quote Builder for
    # the one role that uses it most.
    _actor: dict[str, Any] = Depends(require("product.view")),
) -> dict[str, Any]:
    """Live ATP per depot for one or more SKUs.

    `qty` is optional and only shapes the split hint; the depot numbers are the
    same either way.
    """
    wanted = [s.strip() for s in skus.split(",") if s.strip()]
    if not wanted:
        raise HTTPException(422, {"error": "no_skus",
                                  "message": "Pass at least one SKU."})
    if len(wanted) > 50:
        raise HTTPException(422, {"error": "too_many_skus",
                                  "message": "Ask for at most 50 SKUs at a time."})
    known = {p["sku"] for p in state.PRODUCTS}
    missing = [s for s in wanted if s not in known]
    if missing:
        raise HTTPException(404, {"error": "unknown_sku", "skus": missing,
                                  "message": f"No such product: {', '.join(missing)}"})
    return {"items": {s: availability_for(s, qty) for s in wanted}}
