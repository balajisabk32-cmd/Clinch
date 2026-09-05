"""
Tests for Finance Manager Segregation of Duties (SoD) and Level-by-Level Approvals.

Verifies:
1. Quotation-to-shipment task panels (Fulfilment, Invoices, Subscriptions) are
   restricted to Finance Manager only; Rep and Manager receive 403 Forbidden.
2. Workspace navigation tabs reflect this strict SoD.
3. Level-by-level approvals for high-risk discounts:
   - Level 1: Sales Manager sign-off moves deal to PENDING_FINANCE.
   - Level 2: Finance Manager handles second-level approval for high risk discounts.
   - Sales Manager is forbidden (403) from approving Level 2 deals in PENDING_FINANCE.
   - Finance Manager sign-off moves deal to APPROVED.
"""

import pytest
from fastapi.testclient import TestClient

from api import state
from api.auth import tabs_for
from api.main import app
from .conftest import ADMIN, FINANCE, MANAGER, REP

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_state():
    state.reset()
    yield
    state.reset()


def test_quotation_to_shipment_task_panels_restricted_to_finance():
    """PS §3 SoD: Allocating shipments, subscriptions, and invoices are Finance-only."""
    # Rep is forbidden from operational panels and allocation actions
    assert client.get("/warehouses", headers=REP).status_code == 403
    assert client.get("/subscriptions", headers=REP).status_code == 403
    assert client.get("/invoices", headers=REP).status_code == 403
    assert client.post("/orders/Q-1044/allocate", headers=REP).status_code == 403
    assert client.post("/orders/Q-1044/confirm", headers=REP).status_code == 403

    # Sales Manager is forbidden from operational panels and allocation actions
    assert client.get("/subscriptions", headers=MANAGER).status_code == 403
    assert client.get("/invoices", headers=MANAGER).status_code == 403
    assert client.post("/orders/Q-1044/allocate", headers=MANAGER).status_code == 403
    assert client.post("/orders/Q-1044/confirm", headers=MANAGER).status_code == 403

    # Finance Manager is permitted across all quotation-to-shipment panels
    assert client.get("/warehouses", headers=FINANCE).status_code == 200
    assert client.get("/fulfilment/queue", headers=FINANCE).status_code == 200
    assert client.get("/subscriptions", headers=FINANCE).status_code == 200
    assert client.get("/invoices", headers=FINANCE).status_code == 200
    assert client.post("/orders/Q-1044/split?objective=cost", headers=FINANCE).status_code == 200


def test_tabs_for_enforce_finance_only_operational_panels():
    """Navigation tabs strictly expose Fulfilment, Subscriptions, and Invoices only to Finance."""
    rep_tabs = {t["label"] for t in tabs_for("rep")}
    assert "Fulfilment" not in rep_tabs
    assert "Subscriptions" not in rep_tabs
    assert "Invoices" not in rep_tabs

    mgr_tabs = {t["label"] for t in tabs_for("manager")}
    assert "Fulfilment" not in mgr_tabs
    assert "Subscriptions" not in mgr_tabs
    assert "Invoices" not in mgr_tabs

    admin_tabs = {t["label"] for t in tabs_for("admin")}
    assert "Fulfilment" not in admin_tabs
    assert "Subscriptions" not in admin_tabs
    assert "Invoices" not in admin_tabs

    fin_tabs = {t["label"] for t in tabs_for("finance")}
    assert "Fulfilment" in fin_tabs
    assert "Subscriptions" in fin_tabs
    assert "Invoices" in fin_tabs
    assert "Approvals" in fin_tabs


def test_level_by_level_approval_for_high_risk_discounts():
    """
    High-risk discounts require level-by-level approval:
    1. Sales Manager approves Level 1 -> moves to PENDING_FINANCE.
    2. Sales Manager cannot approve PENDING_FINANCE (403 finance_approval_required).
    3. Finance Manager approves Level 2 -> moves to APPROVED.
    """
    # Set high discount so Q-1042 is in FINANCE band (Score >= 60)
    state.QUOTES["Q-1042"]["lines"][0]["discount_pct"] = 28.0
    state.set_state("Q-1042", "PENDING_MANAGER")

    # Finance cannot sign off Level 1 (Sales Manager required)
    fin_l1 = client.post("/approvals/Q-1042/action", headers=FINANCE,
                         json={"action": "approve"})
    assert fin_l1.status_code == 403
    assert fin_l1.json()["detail"]["error"] == "manager_approval_required"

    # Sales Manager (M. Shah manages A. Rao's Q-1042) approves Level 1
    mgr_l1 = client.post("/approvals/Q-1042/action", headers=MANAGER,
                         json={"action": "approve"})
    assert mgr_l1.status_code == 200
    body1 = mgr_l1.json()
    assert body1["state"] == "PENDING_FINANCE"
    assert body1["level1_approved_by_name"] == "M. Shah"

    # Sales Manager CANNOT approve Level 2 (Finance sign-off required)
    mgr_l2 = client.post("/approvals/Q-1042/action", headers=MANAGER,
                         json={"action": "approve"})
    assert mgr_l2.status_code == 403
    assert mgr_l2.json()["detail"]["error"] == "finance_approval_required"

    # Finance Manager approves Level 2
    fin_l2 = client.post("/approvals/Q-1042/action", headers=FINANCE,
                         json={"action": "approve"})
    assert fin_l2.status_code == 200
    body2 = fin_l2.json()
    assert body2["state"] == "APPROVED"
    assert body2["approved_by_role"] == "finance"
    assert body2["approved_by_name"] == "R. Menon"


def test_manager_approves_normal_risk_directly_to_approved():
    """Moderate risk (MANAGER band) only requires Sales Manager Level 1 sign-off."""
    # Q-1050 is in M. Shah cluster and has MANAGER risk band
    state.set_state("Q-1050", "PENDING_MANAGER")

    mgr_action = client.post("/approvals/Q-1050/action", headers=MANAGER,
                             json={"action": "approve"})
    assert mgr_action.status_code == 200
    assert mgr_action.json()["state"] == "APPROVED"
    assert mgr_action.json()["approved_by_role"] == "manager"
    assert mgr_action.json()["approved_by_name"] == "M. Shah"
