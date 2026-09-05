"""
Durability tests.

A database that is never read back is just a slower log file. These tests
therefore never assert "we called INSERT" — they mutate through the API, throw
the entire working set away, rebuild it from SQLite, and check the change
survived. That is the only property that actually matters.
"""

import json

import pytest
from fastapi.testclient import TestClient

from api import db, repository, state
from api.main import app

from .conftest import ADMIN, FINANCE, MANAGER, REP

client = TestClient(app)


def _reboot() -> None:
    """Simulate a process restart: discard memory, reload from disk."""
    state.persist()
    state.QUOTES.clear(); state.QUOTE_STATE.clear(); state.EVENTS.clear()
    state.INVOICES.clear(); state.SUBSCRIPTIONS.clear(); state.STOCK.clear()
    state.ALLOCATIONS.clear(); state.PRODUCTS.clear(); state.PRICE_LISTS.clear()
    state.PORTAL_COMMENTS.clear(); state.STOCK_MOVES.clear()
    repository.load_into(state)


@pytest.fixture(autouse=True)
def fresh():
    state.boot()
    state.restore()
    yield
    state.restore()


# --------------------------------------------------------------------------- #
#  The schema exists and is populated
# --------------------------------------------------------------------------- #

def test_schema_has_every_table_the_architecture_promises():
    names = {r["name"] for r in db.query(
        "SELECT name FROM sqlite_master WHERE type='table'")}
    assert {
        "res_partner", "app_user", "product_variant", "price_list", "policy",
        "warehouse", "stock_quant", "stock_move", "sale_order",
        "sale_order_line", "allocation", "subscription", "account_move",
        "portal_comment", "deal_events",
    } <= names


def test_seeded_book_of_business_is_actually_in_the_database():
    assert db.one("SELECT COUNT(*) n FROM sale_order")["n"] == 15
    assert db.one("SELECT COUNT(*) n FROM product_variant")["n"] >= 14
    assert db.one("SELECT COUNT(*) n FROM warehouse")["n"] == 2
    assert db.one("SELECT COUNT(*) n FROM stock_quant")["n"] > 0
    assert db.one("SELECT COUNT(*) n FROM deal_events")["n"] > 0


def test_wal_mode_is_on():
    """WAL lets readers proceed during a write instead of blocking on it."""
    assert db.query("PRAGMA journal_mode")[0][0].lower() == "wal"


# --------------------------------------------------------------------------- #
#  Mutations survive a restart
# --------------------------------------------------------------------------- #

def test_quote_edits_survive_a_restart():
    client.post("/quotes/Q-1042/lines", headers=REP, json={"sku": "DOCK-01", "qty": 3})
    client.patch("/quotes/Q-1042", headers=REP, json={"order_discount_pct": 4.5})
    before = client.get("/quotes/Q-1042", headers=ADMIN).json()

    _reboot()

    after = client.get("/quotes/Q-1042", headers=ADMIN).json()
    assert len(after["lines"]) == len(before["lines"])
    assert after["order_discount_pct"] == 4.5
    assert any(l["sku"] == "DOCK-01" for l in after["lines"])
    # And the score recomputes to the same number from the reloaded rows.
    assert after["risk_score"] == before["risk_score"]


def test_state_transitions_survive_a_restart():
    client.post("/quotes/Q-1042/submit", headers=REP)
    assert state.state_of("Q-1042") == "PENDING_MANAGER"
    _reboot()
    assert state.state_of("Q-1042") == "PENDING_MANAGER"


def test_the_audit_trail_survives_and_keeps_its_order():
    """The ordering IS the audit trail — a reload that scrambles it is useless."""
    client.post("/quotes/Q-1042/submit", headers=REP)
    client.post("/approvals/Q-1042/action", headers=MANAGER,
                json={"action": "approve", "actor": "M. Shah"})
    before = [e["event_type"] for e in state.audit_for("Q-1042")]

    _reboot()

    assert [e["event_type"] for e in state.audit_for("Q-1042")] == before
    assert "submitted" in before and "approved" in before


def test_stock_movements_survive_a_restart():
    client.post("/orders/Q-1044/allocate", headers=FINANCE, json={})
    reserved = state.STOCK["Main Warehouse"]["LP14"]["reserved"]
    moves = len(state.STOCK_MOVES)
    assert reserved > 18 and moves > 0

    _reboot()

    assert state.STOCK["Main Warehouse"]["LP14"]["reserved"] == reserved
    assert len(state.STOCK_MOVES) == moves
    assert state.ALLOCATIONS.get("Q-1044") is not None


def test_policy_changes_survive_a_restart():
    policy = client.get("/policy", headers=ADMIN).json()
    client.put("/policy", headers=ADMIN,
               json={"category_ceiling": {**policy["category_ceiling"], "Services": 7.5}})
    _reboot()
    assert client.get("/policy", headers=ADMIN).json()["category_ceiling"]["Services"] == 7.5


def test_catalogue_changes_survive_a_restart():
    client.post("/products", headers=ADMIN, json={
        "sku": "PERSIST-1", "name": "Durability Widget", "category": "Hardware",
        "list_price": 500, "cost": 200})
    _reboot()
    assert any(p["sku"] == "PERSIST-1" for p in client.get("/products", headers=ADMIN).json())
    row = db.one("SELECT * FROM product_variant WHERE sku = 'PERSIST-1'")
    assert row is not None and row["list_price"] == 500


def test_invoice_and_payment_survive_a_restart():
    client.post("/quotes/Q-1042/submit", headers=REP)
    client.post("/approvals/Q-1042/action", headers=MANAGER, json={"action": "approve"})
    client.post("/orders/Q-1042/confirm", headers=FINANCE)
    inv = client.post("/orders/Q-1042/invoice", headers=FINANCE).json()
    client.post(f"/invoices/{inv['ref']}/payment", headers=FINANCE,
                json={"amount": inv["amount"]})

    _reboot()

    stored = db.one("SELECT * FROM account_move WHERE ref = ?", (inv["ref"],))
    assert stored["status"] == "paid"
    assert state.state_of("Q-1042") == "PAID"


def test_portal_comments_survive_a_restart():
    state.set_state("Q-1042", "APPROVED")
    client.post("/portal/acme-q1042-7f3a9c/request", headers=ADMIN,
                json={"line_id": 1, "counter_discount_pct": 26.0, "comment": "Keep this"})
    _reboot()
    body = client.get("/portal/acme-q1042-7f3a9c", headers=ADMIN).json()
    assert any(c["body"] == "Keep this" for c in body["comments"])


# --------------------------------------------------------------------------- #
#  The demo guardrail
# --------------------------------------------------------------------------- #

def test_reset_restores_golden_state_from_the_snapshot():
    client.post("/quotes/Q-1042/lines", headers=REP, json={"sku": "DOCK-01", "qty": 9})
    client.post("/quotes/Q-1042/submit", headers=REP)

    body = client.post("/admin/reset", headers=ADMIN).json()

    assert body["ok"] is True
    assert body["elapsed_ms"] < 2000, "must be usable mid-sentence on stage"
    assert state.state_of("Q-1042") == "DRAFT"
    assert len(client.get("/quotes/Q-1042", headers=ADMIN).json()["lines"]) == 3
    # And the database agrees with memory, not just the cache.
    assert db.one("SELECT state FROM sale_order WHERE ref='Q-1042'")["state"] == "DRAFT"


def test_reset_also_clears_derived_records():
    client.post("/orders/Q-1044/allocate", headers=FINANCE, json={})
    client.post("/admin/reset", headers=ADMIN)
    assert state.ALLOCATIONS == {}
    assert state.STOCK["Main Warehouse"]["LP14"]["reserved"] == 18
    assert db.one("SELECT COUNT(*) n FROM allocation")["n"] == 0


def test_golden_snapshot_exists_on_disk():
    assert db.GOLDEN_PATH.exists(), "reset() depends on this file being present"
    assert db.GOLDEN_PATH.stat().st_size > 0


# --------------------------------------------------------------------------- #
#  The hot path must stay fast
# --------------------------------------------------------------------------- #

def test_simulator_is_still_fast_with_persistence_wired_in():
    """Adding durability must not put I/O on the Policy Simulator's path."""
    policy = client.get("/policy", headers=ADMIN).json()
    sim = client.post("/policy/simulate", headers=ADMIN, json={
        "category_ceiling": {**policy["category_ceiling"], "Services": 8.0}}).json()
    assert sim["elapsed_ms"] < 400
    assert sim["escalated"] >= 3


def test_a_read_does_not_write():
    """GETs must not trigger a flush; only mutations persist."""
    before = db.one("SELECT COUNT(*) n FROM deal_events")["n"]
    for _ in range(5):
        client.get("/quotes", headers=ADMIN)
        client.get("/dashboard", headers=ADMIN)
    assert db.one("SELECT COUNT(*) n FROM deal_events")["n"] == before
