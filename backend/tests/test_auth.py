"""
Authentication, authorisation and provisioning.

These tests exist because the previous implementation looked like auth without
being auth: it matched an email against a fixture list, issued a token to anyone
who guessed one, and fell back to a REP identity when no header was sent at all.
Each test below pins one property that was previously false.
"""

import time

import pytest
from fastapi.testclient import TestClient

from api import db, users
from api.main import app
from core.security import (
    create_access_token, hash_password, normalize_email, password_score,
    validate_email, validate_password_strength, verify_password,
)

client = TestClient(app)

ADMIN_EMAIL = "admin@clinch.io"
ADMIN_PASS = "ClinchAdmin2026!#"
REP_EMAIL = "rao@clinch.io"
REP_PASS = "RepRao2026!#"
STRONG = "Str0ng!Passw0rd"


def _ensure_accounts():
    db.connect()
    if not users.by_email(ADMIN_EMAIL):
        users.create("Clinch Superadmin", ADMIN_EMAIL, ADMIN_PASS, "admin", "admin_root")
    if not users.by_email(REP_EMAIL):
        users.create("A. Rao", REP_EMAIL, REP_PASS, "rep", "rep_rao")


@pytest.fixture(autouse=True)
def accounts():
    _ensure_accounts()
    yield
    # Remove anything a test provisioned so runs stay independent.
    for row in users.list_all():
        if row["email"] not in (ADMIN_EMAIL, REP_EMAIL):
            db.execute("DELETE FROM app_user WHERE id = ?", (row["id"],))
    users.set_active("admin_root", True)
    users.set_password("admin_root", ADMIN_PASS)


def auth(email: str, password: str) -> dict[str, str]:
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


# --------------------------------------------------------------------------- #
#  Password hashing
# --------------------------------------------------------------------------- #

def test_passwords_are_bcrypt_hashed_never_stored_plain():
    record = users.by_email(ADMIN_EMAIL, with_hash=True)
    h = record["password_hash"]
    assert h.startswith("$2b$"), "must be a bcrypt hash"
    assert ADMIN_PASS not in h
    assert verify_password(ADMIN_PASS, h)
    assert not verify_password("wrong", h)


def test_the_same_password_hashes_differently_each_time():
    """Per-password salt: identical passwords must not produce identical rows,
    or the table leaks which accounts share a password."""
    assert hash_password(STRONG) != hash_password(STRONG)


def test_verify_survives_a_corrupt_hash():
    assert verify_password(STRONG, "not-a-hash") is False
    assert verify_password(STRONG, "") is False


# --------------------------------------------------------------------------- #
#  Validation
# --------------------------------------------------------------------------- #

@pytest.mark.parametrize("email", [
    "a@b.co", "first.last@sub.domain.org", "user+tag@example.io",
])
def test_valid_emails_accepted(email):
    assert validate_email(email)[0], email


@pytest.mark.parametrize("email", [
    "", "plainaddress", "@no-local.com", "no-at.example.com",
    "two..dots@example.com", ".leading@example.com", "trailing.@example.com",
    "no-tld@example", "spaced addr@example.com", "bad@-hyphen.com",
])
def test_invalid_emails_rejected(email):
    assert not validate_email(email)[0], email


def test_emails_are_normalised_for_storage_and_lookup():
    assert normalize_email("  Bob@Example.COM ") == "bob@example.com"
    users.create("Case Test", "MiXeD@Example.COM", STRONG, "rep")
    assert users.by_email("mixed@example.com") is not None
    assert users.by_email("MIXED@EXAMPLE.COM") is not None


@pytest.mark.parametrize("pwd,unmet", [
    ("Sh0rt!", "At least 8 characters"),
    ("alllowercase1!", "At least one uppercase letter"),
    ("ALLUPPERCASE1!", "At least one lowercase letter"),
    ("NoDigitsHere!", "At least one number"),
    ("NoSpecial123", "At least one special character"),
])
def test_password_policy_reports_each_unmet_rule(pwd, unmet):
    ok, problems = validate_password_strength(pwd)
    assert not ok
    assert unmet in problems


def test_strong_password_passes_and_scores_well():
    ok, problems = validate_password_strength(STRONG)
    assert ok and problems == []
    assert password_score(STRONG)[1] in ("Good", "Strong")


# --------------------------------------------------------------------------- #
#  Login
# --------------------------------------------------------------------------- #

def test_login_succeeds_and_returns_a_jwt():
    r = client.post("/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASS})
    assert r.status_code == 200
    body = r.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"].count(".") == 2, "a JWT has three segments"
    assert body["user"]["role"] == "admin"
    assert "password_hash" not in str(body), "hashes must never reach the client"


def test_wrong_password_is_401():
    r = client.post("/auth/login", json={"email": ADMIN_EMAIL, "password": "Wrong123!"})
    assert r.status_code == 401


def test_unknown_email_and_wrong_password_are_indistinguishable():
    """Different messages here would let an attacker enumerate real accounts."""
    a = client.post("/auth/login", json={"email": ADMIN_EMAIL, "password": "Wrong123!"})
    b = client.post("/auth/login", json={"email": "nobody@clinch.io", "password": "Wrong123!"})
    assert a.status_code == b.status_code == 401
    assert a.json()["detail"]["message"] == b.json()["detail"]["message"]


def test_malformed_email_is_rejected_before_any_lookup():
    r = client.post("/auth/login", json={"email": "not-an-email", "password": "x"})
    assert r.status_code == 422


def test_deactivated_account_cannot_log_in():
    users.create("Temp Rep", "temp@clinch.io", STRONG, "rep")
    uid = users.by_email("temp@clinch.io")["id"]
    users.set_active(uid, False)
    r = client.post("/auth/login", json={"email": "temp@clinch.io", "password": STRONG})
    assert r.status_code == 403
    assert r.json()["detail"]["error"] == "account_disabled"


def test_login_records_last_login():
    before = users.by_email(REP_EMAIL)["last_login_at"]
    auth(REP_EMAIL, REP_PASS)
    assert users.by_email(REP_EMAIL)["last_login_at"] != before or before is None


# --------------------------------------------------------------------------- #
#  Tokens
# --------------------------------------------------------------------------- #

def test_protected_route_requires_a_token():
    """The old implementation defaulted to REP when no header was present,
    which made every gated endpoint reachable by simply omitting it."""
    assert client.get("/auth/me").status_code == 401
    assert client.get("/admin/users").status_code == 401


def test_me_returns_the_signed_in_profile():
    me = client.get("/auth/me", headers=auth(REP_EMAIL, REP_PASS)).json()
    assert me["email"] == REP_EMAIL and me["role"] == "rep"
    assert "quote.edit" in me["permissions"]


def test_tampered_token_is_rejected():
    hdr = auth(ADMIN_EMAIL, ADMIN_PASS)
    tampered = hdr["Authorization"][:-4] + "AAAA"
    r = client.get("/auth/me", headers={"Authorization": tampered})
    assert r.status_code == 401


def test_token_signed_with_another_key_is_rejected():
    import jwt
    forged = jwt.encode({"sub": "admin_root", "role": "admin",
                         "exp": int(time.time()) + 600}, "attacker-key",
                        algorithm="HS256")
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {forged}"})
    assert r.status_code == 401


def test_expired_token_is_rejected():
    from datetime import timedelta
    stale = create_access_token({"sub": "admin_root", "role": "admin"},
                                expires_delta=timedelta(seconds=-10))
    r = client.get("/auth/me", headers={"Authorization": f"Bearer {stale}"})
    assert r.status_code == 401
    assert "expired" in r.json()["detail"]["message"].lower()


def test_token_for_a_deleted_account_is_rejected():
    """A valid signature is not proof the account still exists."""
    users.create("Ghost", "ghost@clinch.io", STRONG, "rep")
    hdr = auth("ghost@clinch.io", STRONG)
    db.execute("DELETE FROM app_user WHERE email = 'ghost@clinch.io'")
    assert client.get("/auth/me", headers=hdr).status_code == 401


def test_deactivation_takes_effect_on_the_next_request():
    """Not on the next login -- the role is re-read from the database each time."""
    users.create("Soon Off", "off@clinch.io", STRONG, "rep")
    hdr = auth("off@clinch.io", STRONG)
    assert client.get("/auth/me", headers=hdr).status_code == 200
    users.set_active(users.by_email("off@clinch.io")["id"], False)
    r = client.get("/auth/me", headers=hdr)
    # 401, not 403: the token no longer identifies an active principal, so it
    # is void rather than insufficient. The browser client ends the session on
    # 401 only -- a 403 would leave a deactivated user inside the app.
    assert r.status_code == 401


# --------------------------------------------------------------------------- #
#  Admin provisioning  (there is no public signup)
# --------------------------------------------------------------------------- #

def test_registration_cannot_mint_an_internal_role():
    """Customers may self-register. Internal roles may not — ever.

    This test used to assert that no registration endpoint existed at all. The
    storefront needs one, so the invariant is restated rather than dropped:
    the endpoint exists, and no request body can make it produce anything but a
    customer. That is the property that actually matters; "no endpoint" was only
    ever a way of guaranteeing it.
    """
    # Unique per run: registration is a real write, and a fixed address makes
    # the second execution of this suite hit 409 instead of exercising the rule.
    import uuid as _uuid
    stamp = _uuid.uuid4().hex[:8]
    for role in ("admin", "manager", "finance", "rep"):
        r = client.post("/auth/register", json={
            "name": "Mallory", "email": f"mallory.{role}.{stamp}@evil.example",
            "password": STRONG, "company": "Evil Corp", "role": role,
        })
        assert r.status_code == 201, r.text
        assert r.json()["user"]["role"] == "customer", (
            f"a body asking for {role!r} produced {r.json()['user']['role']!r}")

    # And the older aliases stay closed, so no second door appears by accident.
    for path in ("/auth/signup", "/register", "/signup"):
        assert client.post(path, json={}).status_code == 404, path


def test_non_admin_cannot_create_users():
    r = client.post("/admin/users", headers=auth(REP_EMAIL, REP_PASS),
                    json={"name": "X", "email": "x@clinch.io",
                          "password": STRONG, "role": "manager"})
    assert r.status_code == 403
    assert r.json()["detail"]["error"] == "forbidden"


def test_admin_provisions_a_manager_who_can_then_log_in():
    hdr = auth(ADMIN_EMAIL, ADMIN_PASS)
    r = client.post("/admin/users", headers=hdr, json={
        "name": "New Manager", "email": "NewMgr@Clinch.io",
        "password": STRONG, "role": "manager"})
    assert r.status_code == 201, "creating a user creates a resource"
    created = r.json()
    assert created["email"] == "newmgr@clinch.io", "email must be normalised"
    assert created["role"] == "manager" and created["is_active"] is True
    assert "password" not in created and "password_hash" not in created

    me = client.get("/auth/me", headers=auth("newmgr@clinch.io", STRONG)).json()
    assert me["role"] == "manager"
    assert "approval.manager" in me["permissions"]


def test_weak_password_is_refused_at_the_api_not_just_the_form():
    r = client.post("/admin/users", headers=auth(ADMIN_EMAIL, ADMIN_PASS),
                    json={"name": "Weak", "email": "weak@clinch.io",
                          "password": "password", "role": "rep"})
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert detail["error"] == "weak_password"
    assert len(detail["unmet"]) >= 3


def test_duplicate_email_is_refused():
    hdr = auth(ADMIN_EMAIL, ADMIN_PASS)
    body = {"name": "Dup", "email": "dup@clinch.io", "password": STRONG, "role": "rep"}
    assert client.post("/admin/users", headers=hdr, json=body).status_code == 201
    r = client.post("/admin/users", headers=hdr, json=body)
    assert r.status_code == 409


def test_customer_role_cannot_be_provisioned_internally():
    """Customers reach the portal by signed link; an internal login would
    contradict the whole point of the redacted portal."""
    r = client.post("/admin/users", headers=auth(ADMIN_EMAIL, ADMIN_PASS),
                    json={"name": "Buyer", "email": "buyer@acme.example",
                          "password": STRONG, "role": "customer"})
    assert r.status_code == 422


def test_admin_can_deactivate_and_reactivate():
    hdr = auth(ADMIN_EMAIL, ADMIN_PASS)
    client.post("/admin/users", headers=hdr, json={
        "name": "Toggle", "email": "toggle@clinch.io",
        "password": STRONG, "role": "rep"})
    uid = users.by_email("toggle@clinch.io")["id"]

    assert client.patch(f"/admin/users/{uid}/status", headers=hdr,
                        json={"is_active": False}).json()["is_active"] is False
    assert client.post("/auth/login", json={"email": "toggle@clinch.io",
                                            "password": STRONG}).status_code == 403
    assert client.patch(f"/admin/users/{uid}/status", headers=hdr,
                        json={"is_active": True}).json()["is_active"] is True
    assert client.post("/auth/login", json={"email": "toggle@clinch.io",
                                            "password": STRONG}).status_code == 200


def test_admin_cannot_deactivate_themselves():
    hdr = auth(ADMIN_EMAIL, ADMIN_PASS)
    r = client.patch("/admin/users/admin_root/status", headers=hdr,
                     json={"is_active": False})
    assert r.status_code == 409
    assert r.json()["detail"]["error"] == "self_deactivation"


def test_admin_resets_a_password_and_the_old_one_stops_working():
    hdr = auth(ADMIN_EMAIL, ADMIN_PASS)
    client.post("/admin/users", headers=hdr, json={
        "name": "Reset Me", "email": "reset@clinch.io",
        "password": STRONG, "role": "rep"})
    uid = users.by_email("reset@clinch.io")["id"]

    new = "An0ther!Secret1"
    assert client.post(f"/admin/users/{uid}/reset-password", headers=hdr,
                       json={"password": new}).status_code == 200
    assert client.post("/auth/login", json={"email": "reset@clinch.io",
                                            "password": STRONG}).status_code == 401
    assert client.post("/auth/login", json={"email": "reset@clinch.io",
                                            "password": new}).status_code == 200


def test_reset_password_enforces_the_policy():
    hdr = auth(ADMIN_EMAIL, ADMIN_PASS)
    r = client.post("/admin/users/admin_root/reset-password", headers=hdr,
                    json={"password": "weak"})
    assert r.status_code == 422


def test_admin_user_list_never_exposes_hashes():
    body = client.get("/admin/users", headers=auth(ADMIN_EMAIL, ADMIN_PASS)).text
    assert "password_hash" not in body and "$2b$" not in body
