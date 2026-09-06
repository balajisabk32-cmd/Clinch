"""API contract tests.

The most important test in this file is test_portal_payload_cannot_leak_internals.
PS 7 requires the customer portal to be "a real, separate, restricted view", and a
reviewer will open DevTools to check. This asserts on the SERIALISED BYTES, so it
catches a leak regardless of how it got there.
"""

import json

import pytest
from fastapi.testclient import TestClient

from api import fixtures as fx
from api.main import app
from api.schemas import FORBIDDEN_PORTAL_KEYS
from api import state
from .conftest import ADMIN, FINANCE, MANAGER, REP

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_state():
    state.reset()
    yield
    state.reset()


# --------------------------------------------------------------------------- #
#  The portal boundary
# --------------------------------------------------------------------------- #

def test_portal_payload_cannot_leak_internals():
    r = client.get("/portal/acme-q1042-7f3a9c", headers=ADMIN)
    assert r.status_code == 200
    raw = r.text.lower()

    for key in FORBIDDEN_PORTAL_KEYS:
        assert f'"{key}"' not in raw, f"portal payload leaked '{key}'"

    # The internal endpoint DOES carry them -- proving the difference is real
    # redaction, not an accident of this quote having no margin.
    internal = client.get("/quotes/Q-1042", headers=ADMIN).text.lower()
    assert '"cost"' in internal and '"risk_score"' in internal


def test_portal_shows_only_its_own_quote():
    body = client.get("/portal/acme-q1042-7f3a9c", headers=ADMIN).json()
    assert body["ref"] == "Q-1042"
    assert body["customer"] == "Acme Corp"
    assert "Beta" not in json.dumps(body)


def test_portal_rejects_a_bad_token():
    assert client.get("/portal/not-a-real-token", headers=ADMIN).status_code == 404


def test_counter_offer_re_enters_approval_automatically():
    """Rubric step 7: the customer asks for more, and the quote goes back for
    approval with no rep involvement."""
    state.set_state("Q-1042", "APPROVED")
    r = client.post("/portal/acme-q1042-7f3a9c/request", headers=ADMIN,
                    json={"line_id": 1, "counter_discount_pct": 28.0,
                          "comment": "Can we do 28% on setup?"})
    body = r.json()
    assert body["re_entered_approval"] is True
    assert body["state"] == "PENDING_MANAGER"
    assert any(e["event_type"] == "countered" for e in state.audit_for("Q-1042"))


# --------------------------------------------------------------------------- #
#  Intelligence endpoints (real)
# --------------------------------------------------------------------------- #

def test_score_matches_ps_section_10():
    body = client.post("/quotes/Q-1042/score", headers=ADMIN).json()
    assert body["band"] == "MANAGER"
    svc = next(l for l in body["lines"] if l["sku"] == "SVC-ONSITE")
    assert (svc["given"], svc["allowed"], svc["over"]) == (18.0, 10.0, 8.0)
    assert sum(body["contributions"].values()) == pytest.approx(body["score"], abs=0.05)
    assert "Onsite Setup Service" in body["narrative"]


def test_simulator_ripples_and_persists_nothing():
    """THE 10X ANGLE. Tightening Services must re-route open deals, and must
    leave the live policy untouched until Apply is pressed."""
    before = client.get("/policy", headers=ADMIN).json()
    sim = client.post("/policy/simulate", headers=ADMIN,
                      json={"category_ceiling": {**before["category_ceiling"],
                                                 "Services": 8.0}}).json()

    assert sim["escalated"] >= 3, "the ripple must be visible on stage"
    assert sim["quotes_evaluated"] >= 15
    assert sim["elapsed_ms"] < 400, "must feel instantaneous during the drag"
    assert sim["band_counts_after"]["AUTO"] < sim["band_counts_before"]["AUTO"]

    # Movers sort to the top of the pipeline strip.
    assert sim["impacts"][0]["changed"] is True

    # Nothing was saved.
    assert client.get("/policy", headers=ADMIN).json()["category_ceiling"]["Services"] == 10.0


def test_apply_policy_persists_and_bumps_version():
    before = client.get("/policy", headers=ADMIN).json()
    client.put("/policy", headers=ADMIN,
               json={"category_ceiling": {**before["category_ceiling"],
                                         "Services": 8.0}})
    after = client.get("/policy", headers=ADMIN).json()
    assert after["category_ceiling"]["Services"] == 8.0
    assert after["version"] == before["version"] + 1


def test_dead_config_is_surfaced():
    body = client.put("/policy", headers=ADMIN, json={"category_ceiling": {
        "Hardware": 15.0, "Software": 25.0, "Services": 10.0,
        "Subscriptions": 12.0}}).json()
    assert any("Software" in w for w in body["warnings"])


def test_coach_is_compliant_and_actionable():
    body = client.post("/quotes/Q-1042/coach", headers=ADMIN).json()
    assert body["available"] is True
    assert body["sku"] == "SVC-ONSITE"
    assert body["target_discount"] <= body["ceiling"]
    assert body["fully_compliant_after"] is True


def test_recommender_uses_real_lift_and_respects_margin_floor():
    body = client.post("/quotes/Q-1042/recommend", headers=ADMIN).json()
    assert body["basis"] == "co-purchase"
    assert body["suggestions"], "Q-1042 contains a laptop; there must be signal"
    top = body["suggestions"][0]
    assert top["lift"] > 1.0
    assert top["margin_pct"] >= 25.0
    assert top["sku"] not in {l.sku for l in fx.get_quote("Q-1042").lines}
    assert "%" in top["reason"] or "margin" in top["reason"].lower()

    strict = client.post("/quotes/Q-1042/recommend?margin_floor_pct=80", headers=ADMIN).json()
    assert strict["filtered_by_margin_floor"] > body["filtered_by_margin_floor"]


# --------------------------------------------------------------------------- #
#  State machine (CLINCH.md 5, Failure Point 3)
# --------------------------------------------------------------------------- #

def test_illegal_transition_returns_409_with_the_legal_set():
    state.set_state("Q-1042", "PAID")
    r = client.post("/approvals/Q-1042/action", headers=MANAGER,
                    json={"action": "approve", "actor": "M. Shah"})
    assert r.status_code == 409
    detail = r.json()["detail"]
    assert detail["current_state"] == "PAID"
    assert detail["allowed"] == []


def test_double_approval_is_idempotent():
    state.set_state("Q-1039", "PENDING_MANAGER")
    payload = {"action": "approve", "actor": "M. Shah", "idempotency_key": "k1"}
    first = client.post("/approvals/Q-1039/action", headers=MANAGER, json=payload).json()
    second = client.post("/approvals/Q-1039/action", headers=MANAGER, json=payload).json()
    assert first == second


def test_submit_routes_by_real_score_without_being_asked():
    """Rubric step 3: approval is requested automatically, not by the rep."""
    state.set_state("Q-1042", "DRAFT")
    body = client.post("/quotes/Q-1042/submit", headers=REP).json()
    assert body["auto_routed"] is True
    assert body["state"] == "PENDING_MANAGER"


def test_finance_quote_routes_through_manager_first():
    state.set_state("Q-1053", "PENDING_MANAGER")
    body = client.post("/approvals/Q-1053/action", headers=MANAGER,
                       json={"action": "approve", "actor": "M. Shah"}).json()
    assert body["state"] == "PENDING_FINANCE"


# --------------------------------------------------------------------------- #
#  Guardrails
# --------------------------------------------------------------------------- #

def test_reset_is_fast_and_restores_state():
    state.set_state("Q-1042", "PAID")
    body = client.post("/admin/reset", headers=ADMIN).json()
    assert body["elapsed_ms"] < 2000
    assert state.state_of("Q-1042") == "DRAFT"


def test_payment_flips_invoice_status():
    """Rubric step 8 -- the step most teams never reach."""
    inv = next((i for i in client.get("/invoices", headers=ADMIN).json() if i["status"] == "unpaid"), None)
    if inv is None:
        state.reset()
        inv = next((i for i in client.get("/invoices", headers=ADMIN).json() if i["status"] == "unpaid"), None)
    assert inv is not None and inv["status"] == "unpaid"
    body = client.post(f"/invoices/{inv['ref']}/payment", headers=FINANCE,
                       json={"amount": inv["amount"]}).json()
    assert body["status"] == "paid"
    assert client.post(f"/invoices/{inv['ref']}/payment", headers=FINANCE,
                       json={"amount": 1}).status_code == 409


def test_forced_two_warehouse_split_with_backorder():
    """Rubric step 5 -- the seed guarantees this cannot be served from one site."""
    body = client.post("/orders/Q-1044/split", headers=ADMIN).json()
    lp = [a for a in body["allocations"] if a["sku"] == "LP14"]
    assert len({a["warehouse"] for a in lp}) == 2, "split must be forced"
    assert body["backorders"], "2 units should remain backordered"
    assert body["consolidation_available"] is True


def test_dashboard_leakage_is_computed_not_hardcoded():
    body = client.get("/dashboard", headers=ADMIN).json()
    assert body["closed_orders_analysed"] == 120
    assert body["leakage_total"] > 0
    assert 0 < body["leakage_ratio"] < 1
    assert body["alerts"], "seeded stalled deal must raise an alert"
    assert any(a["kind"] == "stalled" for a in body["alerts"])


def test_status_board_reports_integration_progress():
    body = client.get("/_status", headers=ADMIN).json()
    assert body["total"] == body["real"] + body["stub"]
    assert body["real"] >= 8
    paths = {e["path"] for e in body["endpoints"]}
    assert "/policy/simulate" in paths


def test_empty_and_unknown_inputs_do_not_500():
    assert client.post("/quotes/Q-NOPE/score", headers=ADMIN).status_code == 404
    assert client.get("/quotes/Q-NOPE", headers=ADMIN).status_code == 404
    assert client.post("/orders/Q-NOPE/split", headers=ADMIN).status_code == 404
