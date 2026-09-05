"""Wire contracts for DealFlow360.

THIS FILE IS THE CONTRACT. It is frozen at H1 and changed only by agreement of
all four of us, because every one of us codes against it in parallel:

    Balaji     builds the entire UI against these shapes, using stub responses,
               long before the real handlers exist.
    Nithin     fills in auth / catalogue / policy / approvals.
    Santhosh   fills in fulfilment / subscriptions / billing.
    Prabanjan  fills in seed / reporting / dashboard aggregations.

If a field name changes here without telling everyone, someone loses an hour at
02:00. Add fields freely; rename and remove only by agreement.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

# --------------------------------------------------------------------------- #
#  Enumerations shared across the whole system
# --------------------------------------------------------------------------- #

Band = Literal["AUTO", "MANAGER", "FINANCE"]
Category = Literal["Hardware", "Software", "Services", "Subscriptions"]
Tier = Literal["Bronze", "Silver", "Gold"]
Role = Literal["rep", "manager", "finance", "admin"]

QuoteState = Literal[
    "DRAFT",
    "PENDING_MANAGER",
    "PENDING_FINANCE",
    "APPROVED",
    "NEGOTIATION",
    "CONFIRMED",
    "FULFILLED",
    "INVOICED",
    "PAID",
    "REJECTED",
]

# --------------------------------------------------------------------------- #
#  THE STATE MACHINE (CLINCH.md 5, Failure Point 3).
#
#  Single source of truth, defined here so the UI and the server cannot drift.
#  A judge WILL approve something twice, or hit browser-back and re-submit. Any
#  illegal transition returns 409 with the legal set -- never a 500, and never a
#  silent success that corrupts the rest of the demo.
# --------------------------------------------------------------------------- #

LEGAL_TRANSITIONS: dict[str, list[str]] = {
    "DRAFT":           ["PENDING_MANAGER", "APPROVED"],   # APPROVED = auto-approve path
    "PENDING_MANAGER": ["PENDING_FINANCE", "APPROVED", "REJECTED", "DRAFT"],
    "PENDING_FINANCE": ["APPROVED", "REJECTED", "DRAFT"],
    "APPROVED":        ["CONFIRMED", "NEGOTIATION"],
    "NEGOTIATION":     ["PENDING_MANAGER", "PENDING_FINANCE", "CONFIRMED", "APPROVED"],
    "CONFIRMED":       ["FULFILLED", "NEGOTIATION"],
    "FULFILLED":       ["INVOICED"],
    "INVOICED":        ["PAID"],
    "PAID":            [],
    "REJECTED":        ["DRAFT"],
}


def is_legal(current: str, target: str) -> bool:
    return target in LEGAL_TRANSITIONS.get(current, [])


# --------------------------------------------------------------------------- #
#  Catalogue
# --------------------------------------------------------------------------- #

class Product(BaseModel):
    sku: str
    name: str
    category: Category
    list_price: float
    cost: float                       # INTERNAL ONLY. Never in a portal payload.
    uom: str = "Unit"
    tax_pct: float = 18.0
    is_recurring: bool = False
    recurrence: str | None = None     # monthly | quarterly | yearly
    is_promoted: bool = False
    stock_total: int = 0
    variants: list[dict[str, Any]] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
#  Quotations
# --------------------------------------------------------------------------- #

class QuoteLineIn(BaseModel):
    sku: str
    qty: int = 1
    discount_pct: float = Field(default=0.0, ge=0.0, le=100.0)


class QuoteLineOut(BaseModel):
    id: int
    sku: str
    name: str
    category: Category
    qty: int
    list_price: float
    discount_pct: float
    net: float
    is_recurring: bool = False
    # Internal-only analytics. The portal serialiser drops these entirely.
    cost: float | None = None
    margin: float | None = None
    ceiling: float | None = None
    over: float | None = None


class QuoteSummary(BaseModel):
    """Card shape for the pipeline / list views."""
    ref: str
    customer: str
    tier: Tier
    rep: str
    state: QuoteState
    total: float
    risk_score: float | None = None
    risk_band: Band | None = None
    last_activity_at: str
    days_inactive: int = 0
    is_stalled: bool = False


class QuoteDetail(QuoteSummary):
    lines: list[QuoteLineOut] = Field(default_factory=list)
    subtotal: float = 0.0
    discount_total: float = 0.0
    tax_total: float = 0.0
    total_recurring: float = 0.0
    margin_pct: float = 0.0
    allowed_transitions: list[str] = Field(default_factory=list)


# --------------------------------------------------------------------------- #
#  Intelligence (Balaji) -- these are REAL from hour one.
# --------------------------------------------------------------------------- #

class ScoreLine(BaseModel):
    sku: str
    name: str
    category: str
    qty: int
    given: float
    allowed: float
    over: float
    leaked: float
    revenue_weight: float
    ok: bool


class ScoreResponse(BaseModel):
    ref: str
    score: float
    band: Band
    terms: dict[str, float]
    weights_used: dict[str, float]
    contributions: dict[str, float]      # sums EXACTLY to score
    lines: list[ScoreLine]
    leaked_total: float
    order_revenue: float
    order_margin: float
    notes: list[str]
    narrative: str                        # plain-language summary
    narrative_source: Literal["llm", "template"] = "template"


class CoachResponse(BaseModel):
    available: bool
    line_index: int | None = None
    sku: str | None = None
    name: str | None = None
    current_discount: float | None = None
    target_discount: float | None = None
    ceiling: float | None = None
    points_sacrificed: float | None = None
    revenue_recovered: float | None = None
    fixes_violation: bool | None = None
    fully_compliant_after: bool | None = None
    from_band: str | None = None
    to_band: str | None = None
    score_before: float | None = None
    score_after: float | None = None
    message: str | None = None


class PolicyModel(BaseModel):
    tier_ceiling: dict[str, float]
    category_ceiling: dict[str, float]
    weights: dict[str, float]
    caps: dict[str, float]
    bands: list[tuple[float, float, str]]
    hard_override_pts: float = 15.0
    stall_days: int = 7
    version: int = 1
    warnings: list[str] = Field(default_factory=list)


class SimulateRequest(BaseModel):
    """Proposed policy overrides. Anything omitted keeps its live value.

    NOTHING IS PERSISTED by /policy/simulate. That is the entire point: the admin
    sees the blast radius before committing.
    """
    tier_ceiling: dict[str, float] | None = None
    category_ceiling: dict[str, float] | None = None
    weights: dict[str, float] | None = None
    caps: dict[str, float] | None = None
    bands: list[tuple[float, float, str]] | None = None
    hard_override_pts: float | None = None


class SimulateImpact(BaseModel):
    ref: str
    customer: str
    total: float
    score_before: float
    score_after: float
    band_before: Band
    band_after: Band
    leaked_before: float
    leaked_after: float
    changed: bool
    direction: Literal["escalated", "relaxed", "unchanged"]


class SimulateResponse(BaseModel):
    proposed: PolicyModel
    impacts: list[SimulateImpact]
    quotes_evaluated: int
    quotes_changed: int
    escalated: int
    relaxed: int
    leakage_before: float
    leakage_after: float
    leakage_recovered: float
    band_counts_before: dict[str, int]
    band_counts_after: dict[str, int]
    headline: str
    elapsed_ms: float


class Suggestion(BaseModel):
    sku: str
    name: str
    category: Category
    list_price: float
    support: float
    confidence: float
    lift: float
    margin_delta: float          # rupees added to order margin if accepted
    margin_pct: float
    is_promoted: bool
    reason: str                  # visible "why this suggestion"


class RecommendResponse(BaseModel):
    ref: str
    suggestions: list[Suggestion]
    basis: Literal["co-purchase", "promoted", "none"]
    filtered_by_margin_floor: int = 0


# --------------------------------------------------------------------------- #
#  Approvals (Nithin)
# --------------------------------------------------------------------------- #

class ApprovalStep(BaseModel):
    role: Literal["Sales Manager", "Finance"]
    status: Literal["pending", "approved", "rejected", "skipped", "returned"]
    actor: str | None = None
    acted_at: str | None = None
    note: str | None = None


class AuditEntry(BaseModel):
    actor: str
    actor_role: str
    event_type: str
    reason: str | None = None
    created_at: str


class ApprovalDetail(BaseModel):
    ref: str
    customer: str
    tier: Tier
    state: QuoteState
    risk_score: float
    risk_band: Band
    steps: list[ApprovalStep]
    audit: list[AuditEntry]
    allowed_transitions: list[str]


class ApprovalAction(BaseModel):
    action: Literal["approve", "reject", "return"]
    actor: str
    reason: str | None = None
    idempotency_key: str | None = None


# --------------------------------------------------------------------------- #
#  Fulfilment (Santhosh)
# --------------------------------------------------------------------------- #

class Allocation(BaseModel):
    warehouse: str
    sku: str
    name: str
    qty: int
    unit_ship_cost: float


class SplitResponse(BaseModel):
    ref: str
    objective: Literal["shipments", "cost"]
    allocations: list[Allocation]
    shipment_count: int
    total_cost: float
    backorders: list[dict[str, Any]]
    fully_allocated: bool
    consolidation_available: bool
    explanation: str


# --------------------------------------------------------------------------- #
#  Billing & invoicing (Santhosh)
# --------------------------------------------------------------------------- #

class BillingLine(BaseModel):
    due_date: str
    amount: float
    status: Literal["scheduled", "invoiced", "paid"]


class SubscriptionDetail(BaseModel):
    id: int
    ref: str
    plan: str
    cycle: Literal["monthly", "quarterly", "yearly"]
    qty: int
    unit_price: float
    start_date: str
    next_bill_date: str
    status: Literal["active", "paused", "cancelled"]
    schedule: list[BillingLine]


class SubscriptionChange(BaseModel):
    new_qty: int | None = None
    action: Literal["change_qty", "cancel"] = "change_qty"
    effective_date: str | None = None


class ProrationResponse(BaseModel):
    subscription_id: int
    days_remaining: int
    days_in_cycle: int
    delta_qty: int
    unit_price: float
    credit: float                 # negative = charge, positive = credit to customer
    credit_note_ref: str | None = None
    # The arithmetic, rendered verbatim in the UI. Judges check the maths, and
    # visible arithmetic is unfalsifiable.
    formula: str
    schedule: list[BillingLine]


class InvoiceDetail(BaseModel):
    ref: str
    order_ref: str
    kind: Literal["invoice", "credit_note"]
    customer: str
    amount: float
    amount_paid: float
    status: Literal["unpaid", "partial", "paid"]
    due_date: str
    lines: list[dict[str, Any]] = Field(default_factory=list)


class PaymentRequest(BaseModel):
    amount: float
    method: str = "bank_transfer"
    idempotency_key: str | None = None


# --------------------------------------------------------------------------- #
#  Customer portal -- THE REDACTED DTO (PS 7)
#
#  This model is the security boundary. It is a SEPARATE type, not a filtered
#  view of QuoteDetail, precisely so that adding a field to the internal model
#  can never accidentally leak it to a customer. There is no `cost`, no `margin`,
#  no `risk_score`, no `ceiling`, no internal notes -- and there is a test that
#  asserts the serialised payload contains none of those keys.
# --------------------------------------------------------------------------- #

class PortalLine(BaseModel):
    id: int
    name: str
    category: str
    qty: int
    unit_price: float
    discount_pct: float
    line_total: float


class PortalQuote(BaseModel):
    ref: str
    customer: str
    status: Literal["Sent", "Under Negotiation", "Confirmed"]
    valid_until: str
    currency: str = "INR"
    lines: list[PortalLine]
    subtotal: float
    discount_total: float
    tax_total: float
    total: float
    recurring_total: float = 0.0
    comments: list[dict[str, Any]] = Field(default_factory=list)
    can_confirm: bool = True


FORBIDDEN_PORTAL_KEYS = {
    "cost", "margin", "margin_pct", "risk_score", "risk_band", "score",
    "ceiling", "over", "leaked", "contributions", "terms", "internal_notes",
    "rep", "rep_id",
}


class PortalRequest(BaseModel):
    line_id: int | None = None
    comment: str | None = None
    counter_discount_pct: float | None = Field(default=None, ge=0.0, le=100.0)


# --------------------------------------------------------------------------- #
#  Dashboard & reporting (Prabanjan)
# --------------------------------------------------------------------------- #

class DashboardAlert(BaseModel):
    kind: Literal["stalled", "discount_anomaly", "delivery_slippage", "margin"]
    severity: Literal["low", "medium", "high"]
    ref: str
    customer: str
    headline: str
    detail: str
    created_at: str
    actions: list[str] = Field(default_factory=list)   # nudge | escalate | open


class DashboardResponse(BaseModel):
    pipeline_value: float
    open_quotes: int
    stalled_count: int
    stalled_value: float
    avg_discount_pct: float
    # The headline number for the cold open. COMPUTED, never hardcoded.
    leakage_total: float
    leakage_ratio: float
    closed_orders_analysed: int
    median_approval_hours: float
    band_counts: dict[str, int]
    alerts: list[DashboardAlert]


class ReportFilters(BaseModel):
    period_from: str | None = None
    period_to: str | None = None
    rep: str | None = None
    approval_status: str | None = None
    category: str | None = None


# --------------------------------------------------------------------------- #
#  Meta
# --------------------------------------------------------------------------- #

class EndpointStatus(BaseModel):
    method: str
    path: str
    owner: str
    impl: Literal["real", "stub"]
    note: str = ""


class StatusResponse(BaseModel):
    """Live integration board. Rendered at GET /_status.

    P1 in CLINCH.md is 'swap stubs for real endpoints ONE AT A TIME, verifying
    after each'. This endpoint is how we all see that progress without asking.
    """
    real: int
    stub: int
    total: int
    percent_real: float
    endpoints: list[EndpointStatus]
