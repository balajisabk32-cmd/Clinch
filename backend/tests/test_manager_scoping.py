"""
Tests for manager cluster scoping and revision workflow.

Ensures that when a manager logs in:
1. /quotes only returns quotes belonging to their cluster of reps.
2. /approvals only returns approvals for their cluster of reps.
3. Return for revision enforces >= 10 character notes and properly transitions state.
4. Admins retain global visibility across all clusters.
"""

import pytest
from fastapi.testclient import TestClient

from api import state
from api.main import app
from .conftest import ADMIN, MANAGER, REP

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_state():
    state.reset()
    yield
    state.reset()


def test_manager_sees_only_assigned_cluster_quotes():
    """M. Shah should only see quotes from their assigned reps (A. Rao, K. Iyer, S. Nair, V. Verma)."""
    quotes = client.get("/quotes", headers=MANAGER).json()
    assert len(quotes) > 0

    allowed_reps = {"A. Rao", "K. Iyer", "S. Nair", "V. Verma", "M. Shah"}
    for q in quotes:
        assert q["rep"] in allowed_reps, f"Quote {q['ref']} has rep {q['rep']} not in M. Shah cluster"


def test_admin_sees_all_clusters():
    """Admins have global visibility across all clusters."""
    admin_quotes = client.get("/quotes", headers=ADMIN).json()
    manager_quotes = client.get("/quotes", headers=MANAGER).json()
    assert len(admin_quotes) >= len(manager_quotes)


def test_manager_sees_only_assigned_approvals():
    """M. Shah should only see approvals for their cluster of reps."""
    state.set_state("Q-1050", "PENDING_MANAGER")
    approvals = client.get("/approvals", headers=MANAGER).json()
    for a in approvals:
        assert a.get("assigned_to") in ("M. Shah", "—", "R. Menon")


def test_return_revision_validation_and_transition():
    """Return for revision requires at least 10 characters."""
    state.set_state("Q-1050", "PENDING_MANAGER")

    # Short note (< 10 chars) rejected
    bad = client.post("/quotes/Q-1050/return-revision", headers=MANAGER,
                      json={"manager_notes": "short"})
    assert bad.status_code == 422

    # Valid note (>= 10 chars) accepted
    valid_note = "Reduce discount on Hardware to 14% to meet Gold ceiling."
    ok = client.post("/quotes/Q-1050/return-revision", headers=MANAGER,
                     json={"manager_notes": valid_note})
    assert ok.status_code == 200
    assert ok.json()["state"] == "DRAFT"
    assert ok.json()["revision_requested"] is True
    assert ok.json()["manager_revision_notes"] == valid_note
