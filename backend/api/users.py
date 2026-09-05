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
    row = db.one("SELECT * FROM app_user WHERE email = ?", (normalize_email(email),))
    return _row_to_user(row, with_hash=with_hash) if row else None


def by_id(user_id: str, *, with_hash: bool = False) -> dict[str, Any] | None:
    row = db.one("SELECT * FROM app_user WHERE id = ?", (user_id,))
    return _row_to_user(row, with_hash=with_hash) if row else None


def list_all() -> list[dict[str, Any]]:
    return [_row_to_user(r) for r in
            db.query("SELECT * FROM app_user ORDER BY role, name")]


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
    return by_id(uid)  # type: ignore[return-value]


def set_active(user_id: str, active: bool) -> dict[str, Any] | None:
    db.execute("UPDATE app_user SET is_active = ? WHERE id = ?",
               (1 if active else 0, user_id))
    return by_id(user_id)


def set_password(user_id: str, password: str) -> dict[str, Any] | None:
    db.execute("UPDATE app_user SET password_hash = ? WHERE id = ?",
               (hash_password(password), user_id))
    return by_id(user_id)


def touch_login(user_id: str) -> None:
    db.execute("UPDATE app_user SET last_login_at = ? WHERE id = ?",
               (datetime.now(timezone.utc).isoformat(timespec="seconds"), user_id))


def count() -> int:
    row = db.one("SELECT COUNT(*) AS n FROM app_user")
    return row["n"] if row else 0
