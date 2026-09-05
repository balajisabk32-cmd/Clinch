"""
The judging walkthrough, executable (PS §9).

The problem statement prints its own acceptance test: eight steps, each of which
"should produce a visible, correct result before moving to the next one". This
file runs all eight against the real API in order, on one quotation, exactly the
way a reviewer would drive it by hand.

If this file is green, the core flow the rubric tests is solid. If it is red, no
amount of polish elsewhere matters.
"""

import pytest
from fastapi.testclient import TestClient

from api import fixtures as fx
from api import state
from api.main import app
from api.schemas import FORBIDDEN_PORTAL_KEYS
from .conftest import ADMIN, FINANCE, MANAGER, REP

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean():
    state.reset()
    yield
    state.reset()


# --------------------------------------------------------------------------- #

def test_step_1_login_and_seed_data_present():
    """Step 1: sign in, and confirm the backend setup exists — a discount tier,
    a warehouse, and a subscription plan."""
    me = client.post("/auth/login", json={
        "email": "rao@clinch.io", "password": "RepRao2026!#"})
    assert me.status_code == 200
    assert me.json()["user"]["role"] == "rep"
    assert me.json()["access_token"].count(".") == 2

    policy = client.get("/policy", headers=ADMIN).json()
    assert policy["tier_ceiling"]["Gold"] == 15.0          # discount tier
    assert policy["category_ceiling"]["Services"] == 10.0  # category ceiling

    warehouses = client.get("/warehouses", headers=MANAGER).json()
    assert len(warehouses) >= 2                            # warehouse

    subs = client.get("/subscriptions", headers=FINANCE).json()
    assert len(subs) >= 1                                  # subscription plan

    products = client.get("/products", headers=REP).json()
    assert {p["category"] for p in products} >= {"Hardware", "Services", "Subscriptions"}


def test_step_2_over_discounted_line_is_recognised():
    """Step 2: add a product line with a discount higher than normally allowed."""
    q = client.get("/quotes/Q-1042", headers=ADMIN).json()
    svc = next(l for l in q["lines"] if l["sku"] == "SVC-ONSITE")
    assert svc["discount_pct"] == 18.0
    assert svc["ceiling"] == 10.0
    assert svc["over"] == 8.0, "the 8-point breach from PS §10 must be visible"


def test_step_3_approval_is_requested_automatically():
    """Step 3: the quotation asks for manager approval BY ITSELF — the rep never
    presses a 'request approval' button."""
    assert state.state_of("Q-1042") == "DRAFT"
    res = client.post("/quotes/Q-1042/submit", headers=REP).json()

    assert res["auto_routed"] is True
    assert res["state"] == "PENDING_MANAGER"
    assert res["risk_band"] == "MANAGER"
    # And it is recorded as such in the audit spine.
    assert any(e["event_type"] == "submitted" for e in state.audit_for("Q-1042"))


def test_step_4_upsell_updates_the_total_and_margin_right_away():
    """Step 4: accept one upsell suggestion, confirm order total and margin
    update immediately."""
    before = client.get("/quotes/Q-1042", headers=ADMIN).json()
    rec = client.post("/quotes/Q-1042/recommend", headers=ADMIN).json()
    assert rec["basis"] == "co-purchase"
    assert rec["suggestions"], "a laptop in the cart must produce real signal"

    top = rec["suggestions"][0]
    assert top["lift"] > 1.0 and top["margin_pct"] >= 25.0

    after = client.post("/quotes/Q-1042/lines", headers=REP,
                        json={"sku": top["sku"], "qty": 1}).json()
    assert len(after["lines"]) == len(before["lines"]) + 1
    assert after["total"] != before["total"]
    assert after["margin_pct"] != before["margin_pct"]


def test_step_5_stock_splits_across_two_warehouses_with_backorder():
    """Step 5: confirm stock is pulled from the correct warehouse, splitting
    across two when needed."""
    for objective in ("cost", "shipments"):
        r = client.post(f"/orders/Q-1044/split?objective={objective}", headers=ADMIN).json()
        depots = {a["warehouse"] for a in r["allocations"] if a["sku"] == "LP14"}
        assert len(depots) == 2, f"{objective}: split must be forced across both depots"
        assert r["backorders"], "remaining units must be backordered, not silently dropped"
        assert r["consolidation_available"] is True
        assert r["subsets_evaluated"] >= 3, "allocation must be searched, not first-fit"

    # And the consolidation prompt actually ships the remainder.
    con = client.post("/orders/Q-1044/consolidate", headers=ADMIN).json()
    assert sum(a["qty"] for a in con["allocations"]) > 0
    assert con["fully_allocated"] is True


def test_step_6_one_time_and_recurring_bill_separately_on_one_order():
    """Step 6: a one-time product and a recurring subscription on the same order
    are billed correctly and separately."""
    ledger = client.get("/orders/Q-1042/billing", headers=ADMIN).json()
    assert ledger["one_time_total"] > 0
    assert ledger["recurring_total"] > 0, "Q-1042 carries a Care Plan subscription"
    # Invoiced today is the one-time portion only; the subscription follows its
    # own schedule rather than being lumped into the first invoice.
    assert ledger["invoice_today"] == ledger["one_time_total"]
    assert len(ledger["schedule"]) >= 1

    # Mid-cycle downgrade -> exact calendar proration -> credit note.
    pr = client.post("/subscriptions/1/change", headers=FINANCE, json={"new_qty": 5}).json()
    assert pr["kind"] == "credit_note"
    assert pr["days_in_cycle"] == 31 and pr["days_remaining"] == 11
    assert pr["credit"] == pytest.approx(240.0 * 5 * (11 / 31), abs=0.01)
    assert pr["credit_note_ref"] is not None
    note = next(i for i in state.INVOICES if i["ref"] == pr["credit_note_ref"])
    assert note["amount"] < 0, "a credit note is a NEGATIVE account_move"


def test_step_7_portal_counter_offer_reenters_approval():
    """Step 7: as the customer, request a bigger discount from the portal and
    confirm the quote goes back for approval automatically."""
    state.set_state("Q-1042", "APPROVED")

    # The portal payload must not carry internal economics over the wire.
    raw = client.get("/portal/acme-q1042-7f3a9c", headers=ADMIN).text.lower()
    for key in FORBIDDEN_PORTAL_KEYS:
        assert f'"{key}"' not in raw, f"portal leaked '{key}'"

    res = client.post("/portal/acme-q1042-7f3a9c/request", headers=ADMIN,
                      json={"line_id": 1, "counter_discount_pct": 28.0,
                            "comment": "Can we do 28% on the setup service?"}).json()
    assert res["re_entered_approval"] is True
    assert res["state"] == "PENDING_MANAGER"

    events = [e["event_type"] for e in state.audit_for("Q-1042")]
    assert "countered" in events and "submitted" in events
    assert events.index("countered") < len(events) - events[::-1].index("submitted") - 1 + 1


def test_step_8_invoice_payment_flips_status_to_paid():
    """Step 8: confirm the order, record a payment, check the invoice status
    updates — the step most teams never reach."""
    # Walk the state machine the way the app does.
    client.post("/quotes/Q-1042/submit", headers=REP)
    client.post("/approvals/Q-1042/action", headers=MANAGER,
                json={"action": "approve", "actor": "M. Shah"})
    assert state.state_of("Q-1042") == "APPROVED"

    client.post("/orders/Q-1042/confirm", headers=FINANCE)
    assert state.state_of("Q-1042") == "FULFILLED"

    inv = client.post("/orders/Q-1042/invoice", headers=FINANCE).json()
    assert inv["status"] == "unpaid" and inv["amount"] > 0
    assert state.state_of("Q-1042") == "INVOICED"

    paid = client.post(f"/invoices/{inv['ref']}/payment", headers=FINANCE,
                       json={"amount": inv["amount"], "method": "bank_transfer"}).json()
    assert paid["status"] == "paid"
    assert paid["order_state"] == "PAID", "the ORDER must reach PAID, not just the invoice"

    # Paying twice is refused rather than silently double-crediting.
    assert client.post(f"/invoices/{inv['ref']}/payment", headers=FINANCE,
                       json={"amount": 1}).status_code == 409


# --------------------------------------------------------------------------- #
#  Guardrails the walkthrough depends on
# --------------------------------------------------------------------------- #

def test_illegal_transitions_are_refused_at_every_stage():
    """A reviewer clicking out of order must never corrupt the demo."""
    # Cannot invoice before fulfilment.
    assert client.post("/orders/Q-1042/invoice", headers=FINANCE).status_code == 409
    # Cannot approve a draft that was never submitted.
    r = client.post("/approvals/Q-1042/action", headers=MANAGER,
                    json={"action": "approve"})
    assert r.status_code == 409
    assert "allowed" in r.json()["detail"]


def test_whole_walkthrough_is_repeatable_after_reset():
    """The demo must be re-runnable in seconds between judging panels."""
    client.post("/quotes/Q-1042/submit", headers=REP)
    body = client.post("/admin/reset", headers=ADMIN).json()
    assert body["elapsed_ms"] < 2000
    assert state.state_of("Q-1042") == "DRAFT"
    assert len(client.get("/quotes/Q-1042", headers=ADMIN).json()["lines"]) == 3
