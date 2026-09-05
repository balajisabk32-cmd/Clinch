"""
Authentication and admin user provisioning.

PS §A1 and the role matrix say internal accounts are created by an
administrator, never by public signup. There is therefore deliberately NO
registration endpoint here: `POST /admin/users` is the only path that creates an
internal user, and it is admin-gated.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, Header, HTTPException

from core.security import (
    ACCESS_TOKEN_HOURS,
    create_access_token,
    normalize_email,
    password_score,
    validate_email,
    validate_password_strength,
    verify_password,
)

from . import state, users
from .auth import permissions_for, tabs_for
from .deps import get_current_user, require_admin

accounts = APIRouter(tags=["auth"])
admin = APIRouter(prefix="/admin", tags=["admin"])


def _public(user: dict[str, Any]) -> dict[str, Any]:
    """Strip anything that must never leave the server."""
    return {
        "id": user["id"], "name": user["name"], "email": user["email"],
        "role": user["role"], "is_active": user["is_active"],
        "created_at": user["created_at"], "last_login_at": user.get("last_login_at"),
        "manager_id": user.get("manager_id"), "team": user.get("team"),
    }


# --------------------------------------------------------------------------- #
#  Authentication
# --------------------------------------------------------------------------- #

@accounts.post("/auth/login")
def login(body: dict[str, Any] = Body(...)) -> dict[str, Any]:
    email = normalize_email(body.get("email", ""))
    password = body.get("password") or ""

    ok, why = validate_email(email)
    if not ok:
        raise HTTPException(422, {"error": "invalid_email", "message": why})

    record = users.by_email(email, with_hash=True)

    # One message for "no such account" and "wrong password", deliberately.
    # Distinguishing them turns this form into a user-enumeration oracle: an
    # attacker learns which addresses are real before trying a single password.
    invalid = HTTPException(401, {
        "error": "invalid_credentials",
        "message": "Email or password is incorrect.",
    })
    if record is None:
        raise invalid
    if not verify_password(password, record.get("password_hash") or ""):
        raise invalid

    # 403 rather than 401 here, deliberately, and the asymmetry with deps.py is
    # intended: at this point the caller has PROVEN the password, so telling
    # them the account is disabled leaks nothing they could not already infer,
    # and "contact your administrator" is far more useful than a generic
    # rejection. Enumeration is still prevented, because a wrong password never
    # reaches this line.
    if not record["is_active"]:
        raise HTTPException(403, {
            "error": "account_disabled",
            "message": "This account has been deactivated. Contact your administrator.",
        })

    users.touch_login(record["id"])
    token = create_access_token({
        "sub": record["id"], "email": record["email"], "role": record["role"],
    })
    profile = _public(users.by_id(record["id"]))          # re-read for last_login_at
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_HOURS * 3600,
        "user": {**profile, "permissions": sorted(permissions_for(record["role"]))},
        "tabs": tabs_for(record["role"]),
    }


@accounts.get("/auth/me")
def me(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return {**_public(user), "permissions": user["permissions"],
            "tabs": tabs_for(user["role"])}


@accounts.post("/auth/logout")
def logout() -> dict[str, Any]:
    """Tokens are stateless, so this is the client discarding its copy.

    Kept as an endpoint anyway: it gives the frontend one obvious call to make,
    and it is where a revocation list would attach if sessions ever need to be
    killable server-side.
    """
    return {"ok": True}


@accounts.post("/auth/password-policy")
def check_password(body: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Score a candidate password. The UI meter can run offline; this exists so
    the client and server can be shown to agree on the same rules."""
    candidate = body.get("password", "")
    ok, problems = validate_password_strength(candidate)
    score, label = password_score(candidate)
    return {"valid": ok, "unmet": problems, "score": score, "label": label}


# --------------------------------------------------------------------------- #
#  Admin provisioning  (no public signup exists anywhere)
# --------------------------------------------------------------------------- #

@admin.get("/users")
def list_users(_: dict[str, Any] = Depends(require_admin)) -> list[dict[str, Any]]:
    return [_public(u) for u in users.list_all()]


@admin.post("/users", status_code=201)
def create_user(body: dict[str, Any] = Body(...),
                actor: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    name = (body.get("name") or "").strip()
    email = normalize_email(body.get("email", ""))
    password = body.get("password") or ""
    role = (body.get("role") or "").strip().lower()

    if not name:
        raise HTTPException(422, {"error": "invalid_name",
                                  "message": "Full name is required."})

    ok, why = validate_email(email)
    if not ok:
        raise HTTPException(422, {"error": "invalid_email", "message": why})

    # Customers reach the portal through a signed, single-quote link. Creating
    # them here would imply an internal login they must never have.
    if role not in ("rep", "manager", "finance", "admin"):
        raise HTTPException(422, {
            "error": "invalid_role",
            "message": "Role must be one of rep, manager, finance or admin.",
        })

    # Server-side enforcement. The frontend meter is a courtesy; this is the
    # control, and it runs before anything is hashed or stored.
    strong, problems = validate_password_strength(password)
    if not strong:
        raise HTTPException(422, {
            "error": "weak_password",
            "unmet": problems,
            "message": "Password does not meet the security policy.",
        })

    if users.by_email(email):
        raise HTTPException(409, {
            "error": "duplicate_email",
            "message": f"An account already exists for {email}.",
        })

    created = users.create(name, email, password, role)
    state.record("*", actor["name"], "admin", "user_created",
                 reason=f"{created['email']} as {role}")
    return _public(created)


@admin.patch("/users/{user_id}/status")
def set_status(user_id: str, body: dict[str, Any] = Body(...),
               actor: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    target = users.by_id(user_id)
    if target is None:
        raise HTTPException(404, {"error": "not_found",
                                  "message": f"No user {user_id}."})

    active = bool(body.get("is_active", True))

    # An admin who deactivates themselves locks the console for everyone if they
    # are the last one standing. Refuse rather than require a database repair.
    if not active and target["id"] == actor["id"]:
        raise HTTPException(409, {
            "error": "self_deactivation",
            "message": "You cannot deactivate your own account.",
        })
    if not active and target["role"] == "admin":
        remaining = [u for u in users.list_all()
                     if u["role"] == "admin" and u["is_active"] and u["id"] != target["id"]]
        if not remaining:
            raise HTTPException(409, {
                "error": "last_admin",
                "message": "This is the only active administrator. "
                           "Provision another admin before deactivating this one.",
            })

    updated = users.set_active(user_id, active)
    state.record("*", actor["name"], "admin",
                 "user_activated" if active else "user_deactivated",
                 reason=target["email"])
    return _public(updated)  # type: ignore[arg-type]


@admin.post("/users/{user_id}/reset-password")
def reset_password(user_id: str, body: dict[str, Any] = Body(...),
                   actor: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    target = users.by_id(user_id)
    if target is None:
        raise HTTPException(404, {"error": "not_found",
                                  "message": f"No user {user_id}."})

    password = body.get("password") or ""
    strong, problems = validate_password_strength(password)
    if not strong:
        raise HTTPException(422, {
            "error": "weak_password", "unmet": problems,
            "message": "Password does not meet the security policy.",
        })

    users.set_password(user_id, password)
    state.record("*", actor["name"], "admin", "password_reset",
                 reason=target["email"])
    return {"ok": True, "user": _public(users.by_id(user_id))}  # type: ignore[arg-type]
