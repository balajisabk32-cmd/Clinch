"""
User store — the `app_user` table.

Reads and writes go straight to SQLite rather than through the in-memory
working set. Credentials are not demo data: they must never be reachable from a
`reset()` that restores fixtures, and they must not sit in a cache that a flush
could overwrite with a seeded list.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from core.security import hash_password, normalize_email

from . import db

ROLES = ("admin", "manager", "finance", "rep", "customer")
INTERNAL_ROLES = ("admin", "manager", "finance", "rep")


_USERS_CACHE: dict[str, dict[str, Any]] = {}


def _row_to_user(r: Any, *, with_hash: bool = False) -> dict[str, Any]:
    user = {
        "id": r["id"],
        "name": r["name"],
        "email": r["email"],
        "role": r["role"],
        "is_active": bool(r["is_active"]),
        "created_at": r["created_at"],
        "last_login_at": r["last_login_at"],
    }
    if with_hash:
        user["password_hash"] = r["password_hash"]
    return user


def by_email(email: str, *, with_hash: bool = False) -> dict[str, Any] | None:
    norm = normalize_email(email)
    try:
        row = db.one("SELECT * FROM app_user WHERE email = ?", (norm,))
        user = _row_to_user(row, with_hash=with_hash) if row else None
        if user and not with_hash:
            _USERS_CACHE[user["id"]] = user
        return user
    except Exception:
        if not with_hash:
            for u in _USERS_CACHE.values():
                if u.get("email") == norm:
                    return u
        return None


def by_id(user_id: str, *, with_hash: bool = False,
          authoritative: bool = False) -> dict[str, Any] | None:
    """Look up a user.

    `authoritative=True` bypasses the cache and fails closed. Authentication
    MUST use it, and `deps.get_current_user` does.

    The cache is a convenience for display lookups, but on the auth path it was
    a hole: it was consulted before the database and only evicted by writes that
    went through this module, so a row deleted by anything else -- a raw DELETE,
    the admin panel, another process -- left the account fully usable until the
    server restarted. Deleting an account did not revoke its live tokens, which
    is the opposite of what deps.py promises ("re-reads the user from the
    database every request"). The old `except: return _USERS_CACHE.get(...)`
    made it worse still, serving stale users whenever the database erred.
    """
    if not authoritative and not with_hash and user_id in _USERS_CACHE:
        return _USERS_CACHE[user_id]
    try:
        row = db.one("SELECT * FROM app_user WHERE id = ?", (user_id,))
    except Exception:
        # Fail closed on the auth path; only a display lookup may fall back.
        if authoritative:
            raise
        return _USERS_CACHE.get(user_id)
    user = _row_to_user(row, with_hash=with_hash) if row else None
    if user is None:
        _USERS_CACHE.pop(user_id, None)      # the row is gone; so is the cache
        return None
    if not with_hash:
        _USERS_CACHE[user_id] = user
    return user


def list_all() -> list[dict[str, Any]]:
    rows = [_row_to_user(r) for r in
            db.query("SELECT * FROM app_user ORDER BY role, name")]
    for u in rows:
        _USERS_CACHE[u["id"]] = u
    return rows


def create(name: str, email: str, password: str, role: str,
           user_id: str | None = None) -> dict[str, Any]:
    """Create a user. Callers must have validated email and password first."""
    email = normalize_email(email)
    if role not in ROLES:
        raise ValueError(f"Unknown role {role!r}")
    if by_email(email):
        raise ValueError("A user with that email already exists")

    uid = user_id or f"{role}_{email.split('@')[0].replace('.', '_')}"
    # Collisions are possible when two people share a local-part across domains.
    if by_id(uid):
        suffix = 2
        while by_id(f"{uid}_{suffix}"):
            suffix += 1
        uid = f"{uid}_{suffix}"

    db.execute(
        """INSERT INTO app_user
           (id, name, email, password_hash, role, is_active, created_at, last_login_at)
           VALUES (?,?,?,?,?,1,?,NULL)""",
        (uid, name.strip(), email, hash_password(password), role,
         datetime.now(timezone.utc).isoformat(timespec="seconds")),
    )
    _USERS_CACHE.pop(uid, None)
    return by_id(uid)  # type: ignore[return-value]


def set_active(user_id: str, active: bool) -> dict[str, Any] | None:
    _USERS_CACHE.pop(user_id, None)
    db.execute("UPDATE app_user SET is_active = ? WHERE id = ?",
               (1 if active else 0, user_id))
    return by_id(user_id)


def set_password(user_id: str, password: str) -> dict[str, Any] | None:
    _USERS_CACHE.pop(user_id, None)
    db.execute("UPDATE app_user SET password_hash = ? WHERE id = ?",
               (hash_password(password), user_id))
    return by_id(user_id)


def touch_login(user_id: str) -> None:
    db.execute("UPDATE app_user SET last_login_at = ? WHERE id = ?",
               (datetime.now(timezone.utc).isoformat(timespec="seconds"), user_id))


def count() -> int:
    row = db.one("SELECT COUNT(*) AS n FROM app_user")
    return row["n"] if row else 0
