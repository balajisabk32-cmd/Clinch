"""Live integration board.

CLINCH.md P1 says: "swap stubs for real endpoints ONE AT A TIME, verifying after
each -- never all at once." This registry is how all four of us see that progress
without interrupting each other to ask.

When you make an endpoint real, change ONE word here. GET /_status then reports
it, and the UI shows a small badge so Balaji knows which screens are still
running on fixtures.
"""

from __future__ import annotations

REGISTRY: list[dict[str, str]] = [
    # --- Balaji: intelligence core. REAL from hour one -- the engine exists. ---
    dict(method="POST", path="/quotes/{ref}/score",     owner="Balaji",    impl="real",
         note="Blended risk score + exact additive attribution"),
    dict(method="POST", path="/quotes/{ref}/coach",     owner="Balaji",    impl="real",
         note="Counterfactual: cheapest compliant cut to reach a target band"),
    dict(method="POST", path="/quotes/{ref}/recommend", owner="Balaji",    impl="real",
         note="Association rules over closed orders, margin-floor filtered"),
    dict(method="GET",  path="/policy",                 owner="Balaji",    impl="real",
         note="Live governance policy + dead-config warnings"),
    dict(method="POST", path="/policy/simulate",        owner="Balaji",    impl="real",
         note="THE 10X ANGLE. Blast radius, nothing persisted"),
    dict(method="PUT",  path="/policy",                 owner="Nithin",    impl="real",
         note="In-memory today; DB-backed when the schema lands"),

    # --- Nithin: auth, catalogue, quotations, approvals ---
    dict(method="POST", path="/auth/login",             owner="Nithin",    impl="stub"),
    dict(method="GET",  path="/products",               owner="Nithin",    impl="real",
         note="Editable catalogue"),
    dict(method="GET",  path="/quotes",                 owner="Nithin",    impl="stub",
         note="Pipeline/list. Scores are real; persistence is not"),
    dict(method="GET",  path="/quotes/{ref}",           owner="Balaji",    impl="real",
         note="Full detail incl. per-line ceiling + overage"),
    dict(method="POST", path="/quotes",                 owner="Balaji",    impl="real",
         note="Create draft quotation"),
    dict(method="POST", path="/quotes/{ref}/lines",     owner="Balaji",    impl="real",
         note="Add product; returns the fully recomputed quote"),
    dict(method="PATCH", path="/quotes/{ref}/lines/{i}", owner="Balaji",   impl="real",
         note="Quantity / line discount"),
    dict(method="DELETE", path="/quotes/{ref}/lines/{i}", owner="Balaji",  impl="real",
         note="Remove line"),
    dict(method="PATCH", path="/quotes/{ref}",          owner="Balaji",    impl="real",
         note="Order-level discount (PS B3)"),
    dict(method="POST", path="/quotes/{ref}/submit",    owner="Nithin",    impl="real",
         note="Routes by real score; state machine enforced"),
    dict(method="GET",  path="/approvals",              owner="Nithin",    impl="real",
         note="Live pipeline with real bands"),
    dict(method="GET",  path="/approvals/{ref}",        owner="Nithin",    impl="real",
         note="Steps, audit trail, contributions"),
    dict(method="POST", path="/approvals/{ref}/action", owner="Nithin",    impl="real",
         note="409 on illegal transition; idempotency key honoured"),

    # --- Santhosh: fulfilment, subscriptions, billing ---
    dict(method="GET",  path="/warehouses",             owner="Santhosh",  impl="real",
         note="Live stock levels"),
    dict(method="POST", path="/orders/{ref}/split",     owner="Santhosh",  impl="real",
         note="Two objectives; exact over the 2^W warehouse subset lattice"),
    dict(method="GET",  path="/subscriptions",          owner="Santhosh",  impl="real",
         note="Live subscription rows"),
    dict(method="POST", path="/subscriptions/{id}/change", owner="Santhosh", impl="real",
         note="Proration with the arithmetic exposed for the UI"),
    dict(method="GET",  path="/invoices",               owner="Santhosh",  impl="real",
         note="Live ledger incl. generated invoices + credit notes"),
    dict(method="POST", path="/invoices/{ref}/payment", owner="Santhosh",  impl="real",
         note="Rubric step 8. Idempotent"),

    dict(method="POST", path="/orders/{ref}/consolidate", owner="Santhosh", impl="real",
         note="PS B6 consolidate remaining backorder"),
    dict(method="GET",  path="/orders/{ref}/billing",   owner="Santhosh",  impl="real",
         note="Unified hybrid ledger: one-time + recurring"),
    dict(method="POST", path="/orders/{ref}/confirm",   owner="Santhosh",  impl="real",
         note="APPROVED -> CONFIRMED -> FULFILLED"),
    dict(method="POST", path="/orders/{ref}/invoice",   owner="Santhosh",  impl="real",
         note="Generates the invoice FROM the order ledger"),

    # --- Balaji: the portal boundary. Redaction is REAL from hour one. ---
    dict(method="GET",  path="/portal/{token}",         owner="Balaji",    impl="real",
         note="SEPARATE DTO. cost/margin/risk cannot be emitted"),
    dict(method="POST", path="/portal/{token}/request", owner="Balaji",    impl="real",
         note="Counter-offer re-enters approval automatically"),

    # --- Prabanjan: dashboard & reporting ---
    dict(method="GET",  path="/dashboard",              owner="Prabanjan", impl="real",
         note="Leakage headline is COMPUTED from closed orders"),
    dict(method="GET",  path="/activity",              owner="Prabanjan", impl="real",
         note="Recent activity from the append-only audit log"),
    dict(method="GET",  path="/reports",                owner="Prabanjan", impl="real",
         note="Period / rep / status / category filters + KPIs"),
    dict(method="GET",  path="/products/{sku}",         owner="Nithin",    impl="real",
         note="Detail incl. variants, tier prices, stock"),
    dict(method="POST", path="/products",               owner="Nithin",    impl="real",
         note="Admin only"),
    dict(method="PATCH", path="/products/{sku}",        owner="Nithin",    impl="real",
         note="Admin only"),
    dict(method="GET",  path="/pricelists",             owner="Nithin",    impl="real"),
    dict(method="PUT",  path="/pricelists",             owner="Nithin",    impl="real",
         note="Admin only"),

    # --- Shared infrastructure ---
    dict(method="GET",  path="/events/stream",          owner="Balaji",    impl="real",
         note="SSE fan-out"),
    dict(method="POST", path="/admin/reset",            owner="Balaji",    impl="real",
         note="Demo guardrail: restore golden state"),
]


def summary() -> dict:
    real = sum(1 for e in REGISTRY if e["impl"] == "real")
    total = len(REGISTRY)
    return {
        "real": real,
        "stub": total - real,
        "total": total,
        "percent_real": round(100.0 * real / total, 1) if total else 0.0,
        "endpoints": [
            dict(method=e["method"], path=e["path"], owner=e["owner"],
                 impl=e["impl"], note=e.get("note", ""))
            for e in REGISTRY
        ],
    }
