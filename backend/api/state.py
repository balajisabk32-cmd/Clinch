"""Mutable demo state + the event bus.

Everything the stub layer mutates lives here, so `POST /admin/reset` can restore
the golden fixtures in one call. That reset is a demo guardrail, not a
convenience (CLINCH.md 5, Failure Point 3): when a reviewer drives the app into a
state our script did not anticipate, the recovery move is one click, not a
debugging session in front of an audience.

When the real SQLite layer lands this module becomes a thin wrapper over it and
nothing above it changes.
"""

from __future__ import annotations

import asyncio
import copy
import json
from datetime import datetime, timezone
from typing import Any

from engine.scoring import DEFAULT_POLICY, Line, Policy, Quote

from . import fixtures as fx

# --------------------------------------------------------------------------- #
#  Mutable state
# --------------------------------------------------------------------------- #

_policy: Policy = copy.deepcopy(DEFAULT_POLICY)
QUOTE_STATE: dict[str, str] = {}
# Editable quotations. The builder mutates these, so they cannot be rebuilt from
# the static fixtures on every read -- an edit has to survive the next request.
# Shape: ref -> {customer, tier, rep, order_discount_pct, lines: [{sku,qty,discount_pct}]}
QUOTES: dict[str, dict[str, Any]] = {}
_next_ref = [1055]
EVENTS: list[dict[str, Any]] = []          # append-only audit spine
INVOICES: list[dict[str, Any]] = []
SUBSCRIPTIONS: list[dict[str, Any]] = []
PORTAL_COMMENTS: dict[str, list[dict[str, Any]]] = {}
# Accepted / overridden warehouse splits, keyed by order ref.
ALLOCATIONS: dict[str, dict[str, Any]] = {}
# Live stock per warehouse per SKU: {"on_hand": int, "reserved": int}.
# Copied from fixtures on reset and MUTATED as orders move, so the warehouse
# screen shows the real position rather than a snapshot that never changes.
STOCK: dict[str, dict[str, dict[str, int]]] = {}
# Append-only stock ledger. Every movement stays explainable after the fact.
STOCK_MOVES: list[dict[str, Any]] = []
# Editable catalogue + price book (PS A2). Admin-managed.
PRODUCTS: list[dict[str, Any]] = []
PRICE_LISTS: list[dict[str, Any]] = []
_IDEMPOTENCY: dict[str, Any] = {}
_subscribers: list[asyncio.Queue] = []


def get_policy() -> Policy:
    return _policy


def set_policy(p: Policy) -> None:
    global _policy
    _policy = p


def get_product(sku: str) -> dict[str, Any] | None:
    """Find product in current working state, falling back to static fixtures."""
    for p in PRODUCTS:
        if p["sku"] == sku:
            return p
    return fx.BY_SKU.get(sku)


def sync_by_sku() -> None:
    """Synchronize mutable products with fx.BY_SKU dictionary."""
    for p in PRODUCTS:
        fx.BY_SKU[p["sku"]] = p


def reset(persist: bool = True) -> None:
    """Restore golden demo state.

    Rebuilds the in-memory working set from the fixtures and, unless the
    caller opts out, rewrites the database to match. Still well under a
    second, which is what makes it usable mid-sentence on stage.
    """
    global _policy, _IDEMPOTENCY
    _policy = copy.deepcopy(DEFAULT_POLICY)
    QUOTE_STATE.clear()
    QUOTE_STATE.update({r["ref"]: r["state"] for r in fx._QUOTES})
    EVENTS.clear()
    INVOICES.clear()
    INVOICES.extend(copy.deepcopy(fx.INVOICES))
    SUBSCRIPTIONS.clear()
    SUBSCRIPTIONS.extend(copy.deepcopy(fx.SUBSCRIPTIONS))
    PORTAL_COMMENTS.clear()
    ALLOCATIONS.clear()
    STOCK.clear()
    STOCK.update({wh: {sku: dict(q) for sku, q in shelf.items()}
                  for wh, shelf in fx.STOCK.items()})
    STOCK_MOVES.clear()
    PRODUCTS.clear()
    PRODUCTS.extend(copy.deepcopy(fx.PRODUCTS))
    sync_by_sku()
    PRICE_LISTS.clear()
    PRICE_LISTS.extend(copy.deepcopy(fx.PRICE_LISTS))
    _IDEMPOTENCY = {}
    QUOTES.clear()
    for r in fx._QUOTES:
        QUOTES[r["ref"]] = dict(
            customer=r["customer"], tier=fx.CUSTOMERS[r["customer"]]["tier"],
            rep=r["rep"], order_discount_pct=0.0,
            lines=[dict(sku=sku, qty=qty, discount_pct=disc)
                   for sku, qty, disc in r["lines"]],
        )
    _next_ref[0] = 1055
    for r in fx._QUOTES:
        EVENTS.append(dict(
            order_ref=r["ref"], actor=fx.REP_NAME.get(r["rep"], r["rep"]),
            actor_role="rep", event_type="created", reason=None,
            created_at=fx.last_activity(r["ref"]),
        ))


def state_of(ref: str) -> str:
    return QUOTE_STATE.get(ref, "DRAFT")


def set_state(ref: str, new: str) -> None:
    QUOTE_STATE[ref] = new


# --------------------------------------------------------------------------- #
#  Append-only audit log (PS A3: "logged with user, timestamp, and reason")
# --------------------------------------------------------------------------- #

def record(ref: str, actor: str, actor_role: str, event_type: str,
           reason: str | None = None, **payload: Any) -> dict[str, Any]:
    entry = dict(
        order_ref=ref, actor=actor, actor_role=actor_role,
        event_type=event_type, reason=reason,
        created_at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        payload=payload or None,
    )
    EVENTS.append(entry)
    publish({"type": event_type, "ref": ref, "actor": actor,
             "at": entry["created_at"]})
    return entry


def audit_for(ref: str) -> list[dict[str, Any]]:
    return [e for e in EVENTS if e["order_ref"] == ref]


def last_activity(ref: str) -> str:
    entries = audit_for(ref)
    return entries[-1]["created_at"] if entries else fx.last_activity(ref)


# --------------------------------------------------------------------------- #
#  Idempotency (CLINCH.md 5: a double-click on a projector is a real hazard)
# --------------------------------------------------------------------------- #

def idempotent(key: str | None) -> Any | None:
    return _IDEMPOTENCY.get(key) if key else None


def remember(key: str | None, value: Any) -> Any:
    if key:
        _IDEMPOTENCY[key] = value
    return value


# --------------------------------------------------------------------------- #
#  SSE fan-out. Chosen over WebSockets deliberately: ~20 lines, no extra infra,
#  survives any proxy, and connection-lifecycle bugs are a hackathon time sink.
# --------------------------------------------------------------------------- #

def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.append(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    if q in _subscribers:
        _subscribers.remove(q)


def publish(event: dict[str, Any]) -> None:
    payload = json.dumps(event)
    for q in list(_subscribers):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            # A slow client must never block the request that produced the event.
            pass


reset()


# --------------------------------------------------------------------------- #
#  Quotation construction and mutation (PS B3).
#
#  Lives here rather than in fixtures.py because these rows are editable; the
#  fixtures module only supplies the starting book of business.
# --------------------------------------------------------------------------- #

def make_line(sku: str, qty: int, discount_pct: float = 0.0) -> Line:
    p = get_product(sku)
    if not p:
        p = fx.BY_SKU.get(sku)
    if not p:
        raise KeyError(f"Unknown SKU: {sku}")
    return Line(
        sku=p["sku"],
        name=p.get("name") or p["sku"],
        category=p.get("category", "Hardware"),
        qty=qty,
        list_price=float(p.get("list_price", 0.0)),
        cost=float(p.get("cost", 0.0)),
        discount_pct=float(discount_pct),
        is_recurring=bool(p.get("is_recurring", False)),
    )


def build_quote(ref: str) -> Quote | None:
    row = QUOTES.get(ref)
    if row is None:
        return None
    return Quote(
        ref=ref, customer=row["customer"], tier=row["tier"], rep_id=row["rep"],
        order_discount_pct=row.get("order_discount_pct", 0.0),
        lines=[make_line(l["sku"], l["qty"], l["discount_pct"]) for l in row["lines"]],
    )


def create_quote(customer: str, rep: str, tier: str | None = None) -> str:
    """Open a DRAFT quotation.

    `tier` is explicit for self-registered customers, whose company is not in
    the seeded CUSTOMERS map — they carry their own earned tier on their account
    instead. Looking it up unconditionally raised KeyError the moment a customer
    who signed up through the storefront requested a quotation.
    """
    _next_ref[0] += 1
    ref = f"Q-{_next_ref[0]}"
    QUOTES[ref] = dict(
        customer=customer,
        tier=tier or fx.CUSTOMERS.get(customer, {}).get("tier", "Bronze"),
        rep=rep,
        order_discount_pct=0.0, lines=[],
    )
    QUOTE_STATE[ref] = "DRAFT"
    return ref


def add_line(ref: str, sku: str, qty: int = 1, discount_pct: float = 0.0) -> int:
    """Add a product. Adding a SKU already in the cart bumps its quantity rather
    than creating a duplicate row -- two lines for the same product would make
    the revenue weighting misleading and read as a bug to anyone watching."""
    row = QUOTES[ref]
    for i, l in enumerate(row["lines"]):
        if l["sku"] == sku:
            l["qty"] += qty
            return i
    row["lines"].append(dict(sku=sku, qty=qty, discount_pct=discount_pct))
    return len(row["lines"]) - 1


def update_line(ref: str, idx: int, qty: int | None = None,
                discount_pct: float | None = None) -> None:
    line = QUOTES[ref]["lines"][idx]
    if qty is not None:
        line["qty"] = max(1, int(qty))
    if discount_pct is not None:
        line["discount_pct"] = max(0.0, min(100.0, float(discount_pct)))


def remove_line(ref: str, idx: int) -> None:
    QUOTES[ref]["lines"].pop(idx)


def set_order_discount(ref: str, pct: float) -> None:
    QUOTES[ref]["order_discount_pct"] = max(0.0, min(100.0, float(pct)))


# --------------------------------------------------------------------------- #
#  Stock movement (PS A4).
#
#  Two distinct quantities, and conflating them is the classic inventory bug:
#    on_hand    physically present in the depot
#    reserved   already promised to an order, still physically present
#    available  on_hand - reserved  <- the only number safe to sell against
#
#  Reserving does NOT reduce on_hand; shipping reduces both. Selling against
#  on_hand is how a warehouse promises the same laptop to two customers.
# --------------------------------------------------------------------------- #

def available(warehouse: str, sku: str) -> int:
    q = STOCK.get(warehouse, {}).get(sku)
    return max(0, q["on_hand"] - q["reserved"]) if q else 0


def on_hand(warehouse: str, sku: str) -> int:
    q = STOCK.get(warehouse, {}).get(sku)
    return q["on_hand"] if q else 0


def _move(warehouse: str, sku: str, kind: str, qty: int, ref: str) -> None:
    STOCK_MOVES.append(dict(
        warehouse=warehouse, sku=sku, kind=kind, qty=qty, order_ref=ref,
        at=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        on_hand_after=on_hand(warehouse, sku),
        available_after=available(warehouse, sku),
    ))


def reserve(warehouse: str, sku: str, qty: int, ref: str) -> int:
    """Promise stock to an order. Returns the quantity actually reserved."""
    shelf = STOCK.setdefault(warehouse, {}).setdefault(sku, {"on_hand": 0, "reserved": 0})
    take = max(0, min(qty, shelf["on_hand"] - shelf["reserved"]))
    shelf["reserved"] += take
    if take:
        _move(warehouse, sku, "reserve", take, ref)
    return take


def release(warehouse: str, sku: str, qty: int, ref: str) -> None:
    """Give a reservation back (order cancelled, or allocation replaced)."""
    shelf = STOCK.get(warehouse, {}).get(sku)
    if not shelf:
        return
    give = max(0, min(qty, shelf["reserved"]))
    shelf["reserved"] -= give
    if give:
        _move(warehouse, sku, "release", give, ref)


def ship(warehouse: str, sku: str, qty: int, ref: str) -> None:
    """Goods leave the building: on_hand and reserved both fall."""
    shelf = STOCK.get(warehouse, {}).get(sku)
    if not shelf:
        return
    out = max(0, min(qty, shelf["on_hand"]))
    shelf["on_hand"] -= out
    shelf["reserved"] = max(0, shelf["reserved"] - out)
    if out:
        _move(warehouse, sku, "ship", out, ref)


def receive(warehouse: str, sku: str, qty: int, ref: str = "replenishment") -> None:
    """Replenishment arrives (PS A4, and the B6 consolidate prompt)."""
    shelf = STOCK.setdefault(warehouse, {}).setdefault(sku, {"on_hand": 0, "reserved": 0})
    shelf["on_hand"] += max(0, qty)
    if qty:
        _move(warehouse, sku, "receive", qty, ref)


def release_allocation(ref: str) -> None:
    """Hand back everything this order currently holds.

    Must be called BEFORE recomputing a split for the same order. Otherwise the
    new plan is calculated against stock that this very order is still holding,
    the depot looks empty, and the re-split silently allocates nothing.

    IDEMPOTENT BY CONSTRUCTION: the allocation record is popped as it is
    released, so calling this twice cannot release the same units twice. That
    matters because release() clamps to whatever is currently reserved -- a
    second release would silently eat OTHER orders' reservations off the same
    shelf. Invariant: an entry in ALLOCATIONS exists if and only if its units
    are reserved.
    """
    previous = ALLOCATIONS.pop(ref, None)
    if not previous:
        return
    for a in previous.get("allocations", []):
        release(a["warehouse"], a["sku"], int(a["qty"]), ref)


def apply_allocation(ref: str, allocations: list[dict[str, Any]]) -> None:
    """Reserve everything an accepted split commits to."""
    release_allocation(ref)
    for a in allocations:
        reserve(a["warehouse"], a["sku"], int(a["qty"]), ref)


def ship_allocation(ref: str) -> list[dict[str, Any]]:
    """Fulfil a committed allocation: reserved stock physically leaves."""
    plan = ALLOCATIONS.get(ref)
    if not plan:
        return []
    for a in plan.get("allocations", []):
        ship(a["warehouse"], a["sku"], int(a["qty"]), ref)
    return plan.get("allocations", [])


# --------------------------------------------------------------------------- #
#  Durability
# --------------------------------------------------------------------------- #

def persist() -> None:
    """Write the working set to SQLite. Called after every mutating request."""
    from . import repository
    repository.flush(_module())


def _module():
    import sys
    return sys.modules[__name__]


def boot() -> None:
    """Start-up path.

    An existing database is authoritative and is loaded as-is -- that is what
    makes the data durable across restarts. An empty one is seeded from the
    fixtures and a golden snapshot is taken, so `POST /admin/reset` can restore
    by file copy rather than by re-running the seed in front of an audience.
    """
    from . import db, repository

    db.connect()
    if db.has_data():
        repository.load_into(_module())
        return

    reset(persist=False)
    repository.seed_database()
    repository.load_into(_module())
    db.save_golden()


def restore() -> float:
    """Demo reset: golden file copy where possible, re-seed otherwise."""
    import time
    from . import db, repository

    started = time.perf_counter()
    if db.restore_golden():
        repository.load_into(_module())
    else:
        reset(persist=False)
        repository.seed_database()
        repository.load_into(_module())
        db.save_golden()
    return (time.perf_counter() - started) * 1000
