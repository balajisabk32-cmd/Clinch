"""Customer storefront: registration, the air gap, and the two-way separation.

The properties worth defending here are not "the shop works" but:
  1. registration cannot mint anything but a customer,
  2. no customer payload can carry cost, margin, risk or the rep,
  3. the customer and internal populations cannot reach each other's routes,
  4. a customer cannot see another company's quotation.
"""

import uuid

import pytest
from fastapi.testclient import TestClient

from api import customers, db
from api.main import app
from .conftest import ADMIN, FINANCE, MANAGER, REP

client = TestClient(app)

STRONG = "Str0ng!Passw0rd"


def _register(**over):
    stamp = uuid.uuid4().hex[:8]
    body = {
        "name": "Ravi Krishnan", "email": f"ravi.{stamp}@meridian.example",
        "password": STRONG, "company": f"Meridian {stamp}", "city": "Chennai",
    }
    body.update(over)
    r = client.post("/auth/register", json=body)
    assert r.status_code == 201, r.text
    d = r.json()
    return {"Authorization": f"Bearer {d['access_token']}"}, d


# --------------------------------------------------------------------------- #
#  Registration
# --------------------------------------------------------------------------- #

def test_registration_creates_a_bronze_customer():
    _, d = _register()
    assert d["user"]["role"] == "customer"
    assert d["user"]["tier"] == "Bronze", "every self-registered account starts on Bronze"


@pytest.mark.parametrize("field", ["name", "company"])
def test_registration_requires_identity_and_company(field):
    stamp = uuid.uuid4().hex[:8]
    body = {"name": "R", "email": f"x.{stamp}@a.example",
            "password": STRONG, "company": "C"}
    body[field] = "   "
    assert client.post("/auth/register", json=body).status_code == 422


@pytest.mark.parametrize("weak", ["Ab1x", "alllowercase1!", "NoDigitsHere!", "NoSpecial2026"])
def test_registration_enforces_the_password_policy_server_side(weak):
    stamp = uuid.uuid4().hex[:8]
    r = client.post("/auth/register", json={
        "name": "R", "email": f"w.{stamp}@a.example",
        "password": weak, "company": "C"})
    assert r.status_code == 422, f"{weak!r} was accepted"


# --------------------------------------------------------------------------- #
#  The air gap
# --------------------------------------------------------------------------- #

def test_no_customer_payload_carries_internal_fields():
    """Asserted on the serialised bytes, not the model.

    Checking attributes would pass even if a nested dict leaked a cost; the
    wire format is what actually reaches the browser.
    """
    hdr, _ = _register()
    client.post("/shop/cart", headers=hdr, json={"sku": "LP14", "qty": 2})
    ref = client.post("/shop/quote-requests", headers=hdr, json={}).json()["ref"]

    for path in ("/shop/catalog", "/shop/catalog/LP14", "/shop/cart",
                 "/shop/quotes", f"/shop/quotes/{ref}", "/shop/me"):
        body = client.get(path, headers=hdr).text.lower()
        for forbidden in ("cost", "margin", "risk_score", "ceiling", "unit_cost"):
            assert forbidden not in body, f"{path} leaked {forbidden!r}"


def test_bronze_pays_list_price_and_the_ladder_comes_from_the_engine():
    hdr, _ = _register()
    p = client.get("/shop/catalog/LP14", headers=hdr).json()
    assert p["your_price"] == p["list_price"], "Bronze carries no adjustment"


# --------------------------------------------------------------------------- #
#  Separation, both directions
# --------------------------------------------------------------------------- #

INTERNAL_PATHS = ["/quotes", "/approvals", "/dashboard", "/products",
                  "/invoices", "/subscriptions", "/warehouses", "/admin/users"]


@pytest.mark.parametrize("path", INTERNAL_PATHS)
def test_a_customer_cannot_reach_internal_routes(path):
    hdr, _ = _register()
    assert client.get(path, headers=hdr).status_code == 403, path


SHOP_PATHS = ["/shop/me", "/shop/catalog", "/shop/cart", "/shop/quotes"]


@pytest.mark.parametrize("path", SHOP_PATHS)
@pytest.mark.parametrize("role", ["rep", "manager", "finance", "admin"])
def test_internal_roles_cannot_reach_the_storefront(path, role):
    hdr = {"rep": REP, "manager": MANAGER, "finance": FINANCE, "admin": ADMIN}[role]
    assert client.get(path, headers=hdr).status_code == 403, f"{role} reached {path}"


@pytest.mark.parametrize("path", SHOP_PATHS)
def test_anonymous_cannot_reach_the_storefront(path):
    assert client.get(path).status_code == 401, path


# --------------------------------------------------------------------------- #
#  Basket -> quotation -> a rep's desk
# --------------------------------------------------------------------------- #

def test_the_basket_becomes_a_draft_quotation_owned_by_a_rep():
    hdr, _ = _register()
    client.post("/shop/cart", headers=hdr, json={"sku": "LP14", "qty": 3})
    r = client.post("/shop/quote-requests", headers=hdr, json={"note": "Before month end."})
    assert r.status_code == 201
    body = r.json()
    assert body["state"] == "DRAFT"
    assert body["rep"], "an unassigned request would sit in nobody's queue"
    assert client.get("/shop/cart", headers=hdr).json()["count"] == 0


def test_requesting_with_an_empty_basket_is_refused():
    hdr, _ = _register()
    assert client.post("/shop/quote-requests", headers=hdr, json={}).status_code == 422


def test_a_customer_sees_only_their_own_quotations():
    hdr, _ = _register()
    client.post("/shop/cart", headers=hdr, json={"sku": "LP14", "qty": 1})
    ref = client.post("/shop/quote-requests", headers=hdr, json={}).json()["ref"]

    assert [q["ref"] for q in client.get("/shop/quotes", headers=hdr).json()] == [ref]
    # 404 not 403: confirming a reference exists is itself a leak.
    assert client.get("/shop/quotes/Q-1042", headers=hdr).status_code == 404


def test_the_customer_never_sets_their_own_discount():
    """There is no field anywhere in the shop that writes discount_pct.

    A basket that carried a discount into a DRAFT would hand the buyer the one
    number the whole product exists to govern.
    """
    hdr, _ = _register()
    client.post("/shop/cart", headers=hdr,
                json={"sku": "LP14", "qty": 1, "discount_pct": 40})
    ref = client.post("/shop/quote-requests", headers=hdr,
                      json={"discount_pct": 40}).json()["ref"]
    lines = client.get(f"/shop/quotes/{ref}", headers=hdr).json()["lines"]
    assert all(l["discount_pct"] == 0 for l in lines)


# --------------------------------------------------------------------------- #
#  Tiering
# --------------------------------------------------------------------------- #

def test_tier_is_earned_by_spend():
    t = customers.DEFAULT_TIER_THRESHOLDS
    assert customers.tier_for_value(0) == "Bronze"
    assert customers.tier_for_value(t["Silver"] - 1) == "Bronze"
    assert customers.tier_for_value(t["Silver"]) == "Silver"
    assert customers.tier_for_value(t["Gold"]) == "Gold"


def test_a_negotiated_account_is_never_retiered_by_the_algorithm():
    """Seeded enterprise tiers are contract terms, not a function of spend.

    In this book they actively disagree with spend -- Acme holds the lowest
    lifetime value and is Gold -- so running promotion over them would rewrite
    the calibrated demo scenarios by changing Acme's discount ceiling.
    """
    _, d = _register()
    uid = d["user"]["id"]
    db.execute("UPDATE customer_account SET tier = 'Gold', tier_locked = 1 "
               "WHERE user_id = ?", (uid,))
    customers.record_purchase(uid, 5_000_000.0)
    assert customers.by_user(uid)["tier"] == "Gold"

    db.execute("UPDATE customer_account SET tier = 'Bronze', tier_locked = 0, "
               "lifetime_value = 0 WHERE user_id = ?", (uid,))
    customers.record_purchase(uid, customers.DEFAULT_TIER_THRESHOLDS["Silver"])
    assert customers.by_user(uid)["tier"] == "Silver", "an unlocked account is promoted"


def test_promotion_never_demotes():
    _, d = _register()
    uid = d["user"]["id"]
    customers.record_purchase(uid, customers.DEFAULT_TIER_THRESHOLDS["Gold"])
    assert customers.by_user(uid)["tier"] == "Gold"
    # Thresholds raised after the fact must not strip a tier already granted.
    customers.record_purchase(uid, 0.0, {"Silver": 9e9, "Gold": 9e9})
    assert customers.by_user(uid)["tier"] == "Gold"
