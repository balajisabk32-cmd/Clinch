"""In-memory demo dataset.

This stands in for the seeded SQLite database until Prabanjan's generator lands
(CLINCH.md 9). It is deliberately the SAME records -- same refs, same customers,
same SKUs -- so that swapping the real DB in later changes nothing the UI can see.

Identifiers are taken verbatim from the supplied wireframe pack (Q-1042, Acme
Corp, Laptop Pro 14, Main Warehouse, INV-1042, ...). When the running app matches
the mockup down to the record IDs, the wireframe becomes our acceptance test and
the reviewers see spec fidelity for free.

We are a hardware + software vendor, so the catalogue spans four categories with
genuinely different margin profiles: Software licences carry ~85% margin, Hardware
~35%, Services ~35%, Subscriptions ~40%. Those cost figures are not decoration --
they drive the leakage term in the scorer and the margin ranking in the recommender.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from engine.scoring import Line, Policy, Quote

TODAY = date(2026, 9, 5)
NOW = datetime(2026, 9, 5, 10, 0, 0)


def _iso(d: date | datetime) -> str:
    return d.isoformat()


def _ago(days: int, hours: int = 0) -> str:
    return _iso(NOW - timedelta(days=days, hours=hours))


# --------------------------------------------------------------------------- #
#  Catalogue
# --------------------------------------------------------------------------- #

PRODUCTS: list[dict[str, Any]] = [
    # --- Hardware (healthy margin, 15% ceiling per PS 10) ---
    dict(sku="LP14", name="Laptop Pro 14", category="Hardware",
         list_price=1250.0, cost=812.0, stock_total=42,
         variants=[{"attribute": "RAM", "values": ["16GB", "32GB"], "extra_price": [0, 130]}]),
    dict(sku="SRV-RACK", name="Rack Server R740", category="Hardware",
         list_price=4200.0, cost=2940.0, stock_total=11),
    dict(sku="DOCK-01", name="Docking Station", category="Hardware",
         list_price=320.0, cost=208.0, stock_total=96, is_promoted=True),
    dict(sku="MON-27", name="UltraWide Monitor 27", category="Hardware",
         list_price=540.0, cost=378.0, stock_total=54),
    dict(sku="WAR-EXT", name="Extended Warranty", category="Hardware",
         list_price=180.0, cost=117.0, stock_total=999),

    # --- Software (very high margin -- this is where upsell margin lives) ---
    dict(sku="SW-DESIGN", name="DesignSuite Licence", category="Software",
         list_price=900.0, cost=135.0, stock_total=999, is_promoted=True),
    dict(sku="SW-SECURE", name="SecureEndpoint Licence", category="Software",
         list_price=420.0, cost=63.0, stock_total=999),
    dict(sku="SW-BI", name="InsightBI Licence", category="Software",
         list_price=1600.0, cost=240.0, stock_total=999),

    # --- Services (thin margin, 10% ceiling per PS 10) ---
    dict(sku="SVC-ONSITE", name="Onsite Setup Service", category="Services",
         list_price=400.0, cost=260.0, stock_total=999),
    dict(sku="SVC-INST", name="Install Service", category="Services",
         list_price=4400.0, cost=2860.0, stock_total=999),
    dict(sku="SVC-TRAIN", name="Admin Training", category="Services",
         list_price=750.0, cost=490.0, stock_total=999),

    # --- Subscriptions (protect the run-rate, 12% ceiling) ---
    dict(sku="SLA-GOLD", name="Support SLA Gold", category="Subscriptions",
         list_price=5400.0, cost=3240.0, is_recurring=True, recurrence="yearly",
         stock_total=999),
    dict(sku="CARE-2Y", name="Care Plan 2yr", category="Subscriptions",
         list_price=240.0, cost=144.0, is_recurring=True, recurrence="monthly",
         stock_total=999),
    dict(sku="SW-CLOUD", name="CloudSync Seat", category="Subscriptions",
         list_price=60.0, cost=12.0, is_recurring=True, recurrence="monthly",
         stock_total=999),
]

BY_SKU: dict[str, dict[str, Any]] = {p["sku"]: p for p in PRODUCTS}

# Sensible catalogue defaults so every product carries the fields the wireframe's
# product detail page shows, without repeating them on all fourteen rows.
for _p in PRODUCTS:
    _p.setdefault("uom", "Each")
    _p.setdefault("tax_pct", 18.0)
    _p.setdefault("variants", [])
    _p.setdefault("description", f"{_p['name']} - {_p['category']}")

# Price lists (PS A2): tier-based rules, currency-aware. The rule is stored as
# an adjustment against list price rather than a duplicated price per tier, so a
# catalogue price change cannot leave one tier silently stale.
PRICE_LISTS: list[dict[str, Any]] = [
    dict(tier="Bronze", currency="INR", adjustment_pct=0.0,
         rule="List price, no adjustment"),
    dict(tier="Silver", currency="INR", adjustment_pct=-3.0,
         rule="List price minus 3 percent"),
    dict(tier="Gold", currency="INR", adjustment_pct=-6.0,
         rule="List price minus 6 percent"),
    dict(tier="Gold", currency="USD", adjustment_pct=-6.0,
         rule="List price minus 6 percent, USD book"),
]


def price_for(sku: str, tier: str, currency: str = "INR") -> float:
    """Tier price for a product. Pure lookup, no I/O."""
    product = BY_SKU.get(sku)
    if not product:
        return 0.0
    rule = next((r for r in PRICE_LISTS
                 if r["tier"] == tier and r["currency"] == currency), None)
    adj = rule["adjustment_pct"] if rule else 0.0
    return round(product["list_price"] * (1 + adj / 100.0), 2)


def make_line(sku: str, qty: int, discount_pct: float = 0.0) -> Line:
    p = BY_SKU.get(sku)
    if not p:
        from . import state
        p = state.get_product(sku)
    if not p:
        raise KeyError(f"Unknown SKU: {sku}")
    return Line(
        sku=p["sku"], name=p.get("name") or p["sku"], category=p.get("category", "Hardware"), qty=qty,
        list_price=float(p.get("list_price", 0.0)), cost=float(p.get("cost", 0.0)), discount_pct=float(discount_pct),
        is_recurring=bool(p.get("is_recurring", False)),
    )


# --------------------------------------------------------------------------- #
#  People
# --------------------------------------------------------------------------- #

CUSTOMERS = {
    "Acme Corp":       dict(tier="Gold",   email="ops@acme.example"),
    "Beta Industries": dict(tier="Gold",   email="buying@beta.example"),
    "Nova Retail":     dict(tier="Silver", email="it@novaretail.example"),
    "Zenith Co":       dict(tier="Silver", email="proc@zenith.example"),
    "Delta LLC":       dict(tier="Bronze", email="admin@delta.example"),
    "Orion Systems":   dict(tier="Gold",   email="pm@orion.example"),
    "Vertex Labs":     dict(tier="Silver", email="lab@vertex.example"),
}

USERS = [
    dict(id="rep_rao",   name="A. Rao",   email="rao@dealflow.example",   role="rep",     manager_id="rep_shah"),
    dict(id="rep_iyer",  name="K. Iyer",  email="iyer@dealflow.example",  role="rep",     manager_id="rep_shah"),
    dict(id="rep_shah",  name="M. Shah",  email="shah@dealflow.example",  role="manager", manager_id=None),
    dict(id="rep_nair",  name="S. Nair",  email="nair@dealflow.example",  role="rep",     manager_id="rep_shah"),
    dict(id="fin_menon", name="R. Menon",  email="menon@dealflow.example", role="finance", manager_id=None),
    dict(id="admin",     name="Admin",    email="admin@dealflow.example", role="admin",   manager_id=None),
]

MANAGER_FOR_REP: dict[str, str | None] = {
    u["id"]: u.get("manager_id") for u in USERS if u.get("role") == "rep"
}

# Trailing effective-discount history per rep (CLINCH.md §9).
REP_PROFILES = [
    dict(id="rep_rao",    name="A. Rao",    median=8.0,  mad=2.0, deals=42, note="baseline; owns Q-1042"),
    dict(id="rep_iyer",   name="K. Iyer",   median=6.0,  mad=1.5, deals=38, note="disciplined; a 19% quote spikes the Z term"),
    dict(id="rep_shah",   name="M. Shah",   median=13.0, mad=4.0, deals=37, note="habitually loose; largest leakage contributor"),
    dict(id="rep_nair",   name="S. Nair",   median=7.0,  mad=1.0, deals=3,  note="thin history; forces Z to be dropped"),
    dict(id="rep_verma",  name="V. Verma",  median=9.0,  mad=2.0, deals=0),
    dict(id="rep_gupta",  name="R. Gupta",  median=10.0, mad=2.5, deals=0),
    dict(id="rep_joshi",  name="S. Joshi",  median=8.5,  mad=1.8, deals=0),
    dict(id="rep_patel",  name="D. Patel",  median=7.5,  mad=1.5, deals=0),
    dict(id="rep_reddy",  name="N. Reddy",  median=9.5,  mad=2.2, deals=0),
    dict(id="rep_chopra", name="M. Chopra", median=11.0, mad=3.0, deals=0),
    dict(id="rep_mehta",  name="T. Mehta",  median=8.0,  mad=2.0, deals=0),
    dict(id="rep_sen",    name="B. Sen",    median=6.5,  mad=1.2, deals=0),
    dict(id="rep_bhatia", name="P. Bhatia", median=9.0,  mad=2.1, deals=0),
]

REP_TO_MANAGER: dict[str, str] = {
    # Cluster 1 -> M. Shah
    "rep_rao": "M. Shah", "rep_iyer": "M. Shah", "rep_nair": "M. Shah",
    "rep_verma": "M. Shah", "rep_shah": "M. Shah", "mgr_shah": "M. Shah",
    "A. Rao": "M. Shah", "K. Iyer": "M. Shah", "S. Nair": "M. Shah",
    "V. Verma": "M. Shah", "M. Shah": "M. Shah",

    # Cluster 2 -> P. Deshmukh
    "rep_gupta": "P. Deshmukh", "rep_joshi": "P. Deshmukh",
    "rep_patel": "P. Deshmukh", "rep_reddy": "P. Deshmukh",
    "mgr_deshmukh": "P. Deshmukh",
    "R. Gupta": "P. Deshmukh", "S. Joshi": "P. Deshmukh",
    "D. Patel": "P. Deshmukh", "N. Reddy": "P. Deshmukh",
    "P. Deshmukh": "P. Deshmukh",

    # Cluster 3 -> A. Kulkarni
    "rep_chopra": "A. Kulkarni", "rep_mehta": "A. Kulkarni",
    "rep_sen": "A. Kulkarni", "rep_bhatia": "A. Kulkarni",
    "mgr_kulkarni": "A. Kulkarni",
    "M. Chopra": "A. Kulkarni", "T. Mehta": "A. Kulkarni",
    "B. Sen": "A. Kulkarni", "P. Bhatia": "A. Kulkarni",
    "A. Kulkarni": "A. Kulkarni",
}

MANAGER_TO_REPS: dict[str, list[str]] = {
    "M. Shah": ["A. Rao", "K. Iyer", "S. Nair", "V. Verma"],
    "P. Deshmukh": ["R. Gupta", "S. Joshi", "D. Patel", "N. Reddy"],
    "A. Kulkarni": ["M. Chopra", "T. Mehta", "B. Sen", "P. Bhatia"],
}


def is_rep_managed_by(rep_id_or_name: str | None, manager_name_or_id: str | None) -> bool:
    """Check whether a rep belongs to the specified manager."""
    if not rep_id_or_name or not manager_name_or_id:
        return False
    mgr = REP_TO_MANAGER.get(rep_id_or_name)
    if mgr:
        return (mgr == manager_name_or_id or
                mgr.lower() in manager_name_or_id.lower() or
                manager_name_or_id.lower() in mgr.lower())
    for m_name, reps in MANAGER_TO_REPS.items():
        if m_name == manager_name_or_id or m_name.lower() in manager_name_or_id.lower() or manager_name_or_id.lower() in m_name.lower():
            if rep_id_or_name in reps:
                return True
    return False


def get_manager_assigned_reps(manager_name_or_id: str | None) -> list[str]:
    """Return the list of rep names for a manager."""
    if not manager_name_or_id:
        return []
    for m_name, reps in MANAGER_TO_REPS.items():
        if m_name == manager_name_or_id or m_name.lower() in manager_name_or_id.lower() or manager_name_or_id.lower() in m_name.lower():
            return list(reps)
    return []


def discounts_for(median: float, mad: float, deals: int) -> list[float]:
    """Build a history whose REALISED median and MAD hit the targets.

    Absolute deviations are laid out as a uniform ramp across [0, 2*mad]; the
    median of that ramp is exactly mad. Signs alternate, so the values stay
    symmetric about the median and the realised median is the median.
    """
    if deals <= 1:
        return [round(median, 1)] * max(0, deals)
    devs = [2.0 * mad * (i + 0.5) / deals for i in range(deals)]
    out = [
        round(max(0.0, median + (d if i % 2 else -d)), 1)
        for i, d in enumerate(devs)
    ]
    return out


REP_HISTORY: dict[str, list[float]] = {
    p["id"]: discounts_for(p["median"], p["mad"], p["deals"]) for p in REP_PROFILES
}

REP_NAME = {u["id"]: u["name"] for u in USERS}


# --------------------------------------------------------------------------- #
#  Open pipeline.
#
#  CALIBRATION NOTE. These quotes are tuned so that tightening the Services
#  ceiling from 10% to 8% visibly re-routes several of them (CLINCH.md 2.3).
#  Several sit deliberately just under a band boundary WITH Services exposure,
#  so a two-point tightening pushes them across.
#
#  Direction matters and is worth stating plainly: tightening a ceiling can only
#  ever raise scores. A single downward drag therefore produces escalations only.
#  To show movement in both directions on stage, drag the slider back -- the
#  reverse ripple is the cleanest possible proof that nothing is hardcoded.
# --------------------------------------------------------------------------- #

_QUOTES: list[dict[str, Any]] = [
    # --- HERO 1: the PS section-10 worked example, verbatim. -------------
    dict(ref="Q-1042", customer="Acme Corp", rep="rep_rao", state="DRAFT",
         days_idle=0,
         lines=[("LP14", 2, 12.0), ("SVC-ONSITE", 1, 18.0), ("WAR-EXT", 1, 15.0)]),

    # --- HERO 2: the aggregate case. No line badly over; pattern is bad. --
    dict(ref="Q-1039", customer="Beta Industries", rep="rep_shah",
         state="PENDING_MANAGER", days_idle=1,
         lines=[("SRV-RACK", 2, 18.0), ("SVC-INST", 1, 12.0),
                ("SLA-GOLD", 1, 15.0), ("DOCK-01", 20, 17.0)]),

    # --- HERO 3: forced two-warehouse split (44 needed, 28 + 14 available) -
    dict(ref="Q-1044", customer="Orion Systems", rep="rep_rao", state="APPROVED",
         days_idle=0,
         lines=[("LP14", 44, 10.0), ("DOCK-01", 30, 8.0), ("SW-DESIGN", 20, 12.0)]),

    # --- HERO 4: behavioural anomaly. Disciplined rep, sudden 19%. --------
    dict(ref="Q-1046", customer="Vertex Labs", rep="rep_iyer", state="DRAFT",
         days_idle=0,
         lines=[("SW-BI", 4, 19.0), ("SVC-TRAIN", 2, 9.0)]),

    # --- HERO 5: new rep, no history -> insufficient-history branch -------
    dict(ref="Q-1047", customer="Nova Retail", rep="rep_nair", state="DRAFT",
         days_idle=0,
         lines=[("LP14", 3, 11.0), ("SVC-ONSITE", 12, 12.0)]),

    # --- HERO 6: stalled deal (9 days idle, threshold 7) ------------------
    dict(ref="Q-1031", customer="Delta LLC", rep="rep_shah",
         state="PENDING_MANAGER", days_idle=9,
         lines=[("MON-27", 8, 6.0), ("SVC-ONSITE", 2, 11.0)]),

    # --- Boundary-tuned: Services exposure, just under a band edge --------
    # Recipe for a boundary quote: heavy Services revenue sitting EXACTLY at the
    # 10% ceiling (so it is compliant today), plus a ~2-3 point overage elsewhere
    # to lift the baseline into the 15-19 range. Tightening Services to 8% then
    # pushes the aggregate term across the 20-point band edge.
    dict(ref="Q-1048", customer="Zenith Co", rep="rep_rao", state="DRAFT",
         days_idle=2,
         lines=[("SVC-INST", 1, 10.0), ("SVC-TRAIN", 2, 10.0), ("SLA-GOLD", 1, 15.0)]),
    dict(ref="Q-1049", customer="Acme Corp", rep="rep_rao", state="DRAFT",
         days_idle=1,
         lines=[("SVC-INST", 2, 10.0), ("DOCK-01", 10, 19.0), ("SW-SECURE", 4, 12.0)]),
    dict(ref="Q-1050", customer="Beta Industries", rep="rep_rao",
         state="PENDING_MANAGER", days_idle=3,
         lines=[("SVC-ONSITE", 8, 10.0), ("LP14", 4, 17.0), ("SLA-GOLD", 1, 14.0)]),
    dict(ref="Q-1051", customer="Orion Systems", rep="rep_shah", state="DRAFT",
         days_idle=0,
         lines=[("SVC-TRAIN", 5, 10.0), ("SRV-RACK", 2, 18.0), ("SVC-INST", 1, 10.0)]),
    # Sits just under the 60-point Finance edge, so the same drag escalates it
    # a SECOND level. One quote moving two bands is the most convincing card
    # on the board.
    dict(ref="Q-1054", customer="Vertex Labs", rep="rep_iyer", state="PENDING_MANAGER",
         days_idle=1,
         lines=[("SVC-INST", 1, 16.0), ("SVC-TRAIN", 2, 15.0), ("SW-SECURE", 2, 10.0)]),

    # --- Clean / compliant quotes so the pipeline is not uniformly red ----
    dict(ref="Q-1035", customer="Nova Retail", rep="rep_iyer", state="APPROVED",
         days_idle=1,
         lines=[("LP14", 3, 5.0), ("DOCK-01", 3, 5.0)]),
    dict(ref="Q-1036", customer="Zenith Co", rep="rep_rao", state="DRAFT",
         days_idle=0,
         lines=[("SW-DESIGN", 10, 8.0), ("SW-CLOUD", 25, 6.0)]),
    dict(ref="Q-1052", customer="Vertex Labs", rep="rep_iyer", state="DRAFT",
         days_idle=4,
         lines=[("MON-27", 12, 7.0), ("DOCK-01", 12, 6.0)]),

    # --- One genuinely severe quote so FINANCE is populated ---------------
    dict(ref="Q-1053", customer="Delta LLC", rep="rep_shah", state="PENDING_FINANCE",
         days_idle=2,
         lines=[("SVC-INST", 2, 26.0), ("SRV-RACK", 1, 19.0), ("SVC-TRAIN", 3, 22.0)]),

    # --- Cluster 1 Extra (Manager: M. Shah / Enterprise North) ------------
    dict(ref="Q-1055", customer="Acme Corp", rep="rep_verma", state="PENDING_MANAGER",
         days_idle=1,
         lines=[("LP14", 4, 15.0), ("DOCK-01", 8, 14.0), ("SVC-ONSITE", 1, 12.0)]),

    # --- Cluster 2 (Manager: P. Deshmukh / Strategic South) ---------------
    dict(ref="Q-1060", customer="Zenith Co", rep="rep_gupta", state="PENDING_MANAGER",
         days_idle=1,
         lines=[("SRV-RACK", 2, 17.0), ("SVC-INST", 1, 14.0), ("SLA-GOLD", 1, 15.0)]),
    dict(ref="Q-1061", customer="Nova Retail", rep="rep_joshi", state="PENDING_MANAGER",
         days_idle=2,
         lines=[("LP14", 5, 14.0), ("DOCK-01", 10, 15.0), ("SVC-ONSITE", 2, 12.0)]),
    dict(ref="Q-1062", customer="Acme Corp", rep="rep_patel", state="DRAFT",
         days_idle=0,
         lines=[("SW-DESIGN", 15, 8.0), ("SW-CLOUD", 20, 6.0)]),
    dict(ref="Q-1063", customer="Delta LLC", rep="rep_reddy", state="APPROVED",
         days_idle=1,
         lines=[("MON-27", 6, 6.0), ("DOCK-01", 6, 5.0)]),

    # --- Cluster 3 (Manager: A. Kulkarni / Commercial West) ---------------
    dict(ref="Q-1070", customer="Orion Systems", rep="rep_chopra", state="PENDING_MANAGER",
         days_idle=1,
         lines=[("SVC-TRAIN", 4, 15.0), ("SRV-RACK", 1, 16.0), ("SW-SECURE", 2, 11.0)]),
    dict(ref="Q-1071", customer="Beta Industries", rep="rep_mehta", state="PENDING_MANAGER",
         days_idle=3,
         lines=[("SVC-ONSITE", 6, 13.0), ("LP14", 3, 16.0), ("SLA-GOLD", 1, 14.0)]),
    dict(ref="Q-1072", customer="Vertex Labs", rep="rep_sen", state="DRAFT",
         days_idle=0,
         lines=[("SW-BI", 5, 9.0), ("SVC-TRAIN", 2, 8.0)]),
    dict(ref="Q-1073", customer="Zenith Co", rep="rep_bhatia", state="APPROVED",
         days_idle=2,
         lines=[("MON-27", 10, 5.0), ("DOCK-01", 10, 5.0)]),
]


def build_quote(row: dict[str, Any]) -> Quote:
    return Quote(
        ref=row["ref"],
        customer=row["customer"],
        tier=CUSTOMERS[row["customer"]]["tier"],
        rep_id=row["rep"],
        lines=[make_line(sku, qty, disc) for sku, qty, disc in row["lines"]],
    )


QUOTE_ROWS: dict[str, dict[str, Any]] = {r["ref"]: r for r in _QUOTES}


def all_quotes() -> list[Quote]:
    return [build_quote(r) for r in _QUOTES]


def get_quote(ref: str) -> Quote | None:
    row = QUOTE_ROWS.get(ref)
    return build_quote(row) if row else None


def history_for(rep_id: str) -> list[float]:
    return REP_HISTORY.get(rep_id, [])


def last_activity(ref: str) -> str:
    """Seeded idle time. Unknown refs are quotes created during the session, so
    they are brand new -- never a KeyError. A reviewer's first click is
    "New Quotation", and that must not 500."""
    row = QUOTE_ROWS.get(ref)
    return _ago(int(row.get("days_idle", 0)) if row else 0)


def days_idle(ref: str) -> int:
    row = QUOTE_ROWS.get(ref)
    return int(row.get("days_idle", 0)) if row else 0


# --------------------------------------------------------------------------- #
#  Closed history -- the basis for the leakage headline and the recommender.
#
#  Generated deterministically so the demo is byte-identical on every run and on
#  every laptop (CLINCH.md 9, "Seed generator rules").
# --------------------------------------------------------------------------- #

# Planted co-purchase structure. Association rules over genuinely random baskets
# return noise, and an upsell panel built on noise looks arbitrary the first time
# a reviewer inspects it.
CO_PURCHASE_ANCHORS: dict[str, list[tuple[str, float]]] = {
    "LP14":      [("DOCK-01", 0.70), ("WAR-EXT", 0.55), ("SW-SECURE", 0.40)],
    "SRV-RACK":  [("SLA-GOLD", 0.80), ("SVC-INST", 0.60), ("SW-BI", 0.35)],
    "MON-27":    [("DOCK-01", 0.45)],
    "SW-DESIGN": [("SW-CLOUD", 0.50), ("SVC-TRAIN", 0.40)],
}


def _closed_orders() -> list[dict[str, Any]]:
    """120 closed orders, split across the reps in proportion to their profiles
    (42 + 38 + 37 + 3 = 120). Deterministic: one fixed seed, no clock reads, so
    the demo is byte-identical on every laptop."""
    import random
    rng = random.Random(42)

    orders: list[dict[str, Any]] = []
    customers = list(CUSTOMERS)
    seq = 900

    for profile in REP_PROFILES:
        rep = profile["id"]
        hist = REP_HISTORY[rep]
        for i in range(profile["deals"]):
            anchor = rng.choice(list(CO_PURCHASE_ANCHORS))
            skus = [anchor]
            for partner, prob in CO_PURCHASE_ANCHORS[anchor]:
                if rng.random() < prob:
                    skus.append(partner)
            if rng.random() < 0.25:
                skus.append(rng.choice([p["sku"] for p in PRODUCTS]))

            base = hist[i % len(hist)]
            lines = [
                (sku, rng.randint(1, 12), max(0.0, round(base + rng.uniform(-1.5, 2.5), 1)))
                for sku in dict.fromkeys(skus)
            ]
            seq += 1
            orders.append(dict(
                ref=f"SO-{seq}",
                customer=customers[seq % len(customers)],
                rep=rep,
                closed_at=_ago(rng.randint(5, 180)),
                approval_hours=round(abs(rng.gauss(26, 14)) + 1, 1),
                lines=lines,
            ))

    rng.shuffle(orders)
    return orders


CLOSED_ORDERS = _closed_orders()


def closed_as_quotes() -> list[Quote]:
    return [
        Quote(ref=o["ref"], customer=o["customer"],
              tier=CUSTOMERS[o["customer"]]["tier"], rep_id=o["rep"],
              lines=[make_line(s, q, d) for s, q, d in o["lines"]])
        for o in CLOSED_ORDERS
    ]


# --------------------------------------------------------------------------- #
#  Warehouses & stock.
#
#  Tuned so Q-1044 (44 x LP14) CANNOT be served from one site: Main has 28
#  available, East has 14, so the split is forced and 2 units go to backorder,
#  which is what makes the "Consolidate Remaining Backorder" prompt fire without
#  anyone staging it (PS B6, rubric step 5).
# --------------------------------------------------------------------------- #

WAREHOUSES = [
    dict(name="Main Warehouse", ship_cost_weight=1.0, fixed_shipment_cost=40.0),
    dict(name="East Depot",     ship_cost_weight=1.4, fixed_shipment_cost=29.0),
]

STOCK = {
    "Main Warehouse": {"LP14": dict(on_hand=46, reserved=18), "DOCK-01": dict(on_hand=65, reserved=12),
                       "SRV-RACK": dict(on_hand=7, reserved=1), "MON-27": dict(on_hand=30, reserved=4),
                       "WAR-EXT": dict(on_hand=500, reserved=0)},
    "East Depot":     {"LP14": dict(on_hand=14, reserved=0),  "DOCK-01": dict(on_hand=31, reserved=0),
                       "SRV-RACK": dict(on_hand=4, reserved=0), "MON-27": dict(on_hand=24, reserved=0),
                       "WAR-EXT": dict(on_hand=499, reserved=0)},
}


# Replenishment that "arrives mid-fulfilment", used by the Consolidate Remaining
# Backorder flow (PS B6). Seeded rather than random so the prompt resolves the
# same way at every rehearsal.
REPLENISH = {"LP14": 6, "SRV-RACK": 3, "MON-27": 10}


def available(warehouse: str, sku: str) -> int:
    q = STOCK.get(warehouse, {}).get(sku)
    return max(0, q["on_hand"] - q["reserved"]) if q else 0


# --------------------------------------------------------------------------- #
#  Subscriptions & invoices
# --------------------------------------------------------------------------- #

SUBSCRIPTIONS = [
    dict(id=1, ref="Q-1042", customer="Acme Corp", plan="Care Plan 2yr", sku="CARE-2Y",
         cycle="monthly", qty=10, unit_price=240.0,
         start_date="2026-08-16", next_bill_date="2026-09-16", status="active"),
    dict(id=2, ref="Q-1039", customer="Beta Industries", plan="Support SLA Gold",
         sku="SLA-GOLD", cycle="yearly", qty=1, unit_price=5400.0,
         start_date="2026-03-01", next_bill_date="2027-03-01", status="active"),
    dict(id=3, ref="Q-1036", customer="Zenith Co", plan="CloudSync Seat", sku="SW-CLOUD",
         cycle="monthly", qty=25, unit_price=60.0,
         start_date="2026-08-20", next_bill_date="2026-09-20", status="active"),
]

INVOICES = [
    dict(ref="INV-1042", order_ref="Q-1042", customer="Acme Corp", kind="invoice",
         amount=2739.0, amount_paid=0.0, status="unpaid", due_date="2026-09-19"),
    dict(ref="INV-1043", order_ref="Q-1035", customer="Nova Retail", kind="invoice",
         amount=840.0, amount_paid=840.0, status="paid", due_date="2026-09-10"),
    dict(ref="INV-1044", order_ref="Q-1039", customer="Beta Industries", kind="invoice",
         amount=8759.0, amount_paid=0.0, status="unpaid", due_date="2026-09-30"),
]

PORTAL_TOKENS = {
    "acme-q1042-7f3a9c": "Q-1042",
    "beta-q1039-2b81de": "Q-1039",
}
