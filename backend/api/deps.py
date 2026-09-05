"""
FastAPI auth dependencies.

`get_current_user` is the only place a request identity is established, and it
verifies against the DATABASE every time rather than trusting the token's claims
alone. A token is proof that we issued it — not proof that the account still
exists, is still active, or still holds the role it had eight hours ago.
Deactivating someone must take effect on their next request, not on their next
login.
"""

from __future__ import annotations

from typing import Any, Iterable

from fastapi import Header, HTTPException

from core.security import TokenError, decode_access_token

from . import users
from .auth import permissions_for


def _unauthorised(detail: str) -> HTTPException:
    return HTTPException(
        status_code=401,
        detail={"error": "unauthorized", "message": detail},
        headers={"WWW-Authenticate": "Bearer"},
    )


def bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    parts = authorization.split(None, 1)
    if len(parts) == 2 and parts[0].lower() == "bearer":
        return parts[1].strip()
    return authorization.strip()


def get_current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Resolve the caller, or raise 401.

    Unlike the previous implementation this does NOT fall back to a default
    role. An unauthenticated request to a protected endpoint is an error, not a
    guest session — silently downgrading to "rep" made every protected route
    reachable by anyone who simply omitted the header.
    """
    token = bearer_token(authorization)
    if not token:
        raise _unauthorised("Not authenticated")

    try:
        claims = decode_access_token(token)
    except TokenError as exc:
        raise _unauthorised(str(exc))

    user_id = claims.get("sub")
    if not user_id:
        raise _unauthorised("Invalid authentication token")

    # Authoritative: never answer an authentication question from a cache.
    user = users.by_id(user_id, authoritative=True)
    if user is None:
        # No row means no account. There was briefly a fallback here that built
        # a user out of the token's own `role` and `email` claims whenever the
        # lookup came back empty, to avoid signing people out during a database
        # blip. It could not tell a blip from a deletion, so the effect was that
        # a deleted account kept working forever -- the token asserted its own
        # role and the server believed it. Revoking access became impossible,
        # which is the one thing this function exists to make possible.
        #
        # A genuine outage is a different condition and is already handled:
        # by_id(authoritative=True) RAISES on a database error rather than
        # returning None, so an outage surfaces as a 500 (the server is broken)
        # and a missing row surfaces here as a 401 (the caller is not anyone).
        raise _unauthorised("Account no longer exists")
    if not user.get("is_active", True):
        # 401, not 403. The account was disabled after this token was issued,
        # so the token no longer identifies anyone -- it is void rather than
        # merely insufficient. The distinction is load-bearing: the frontend
        # ends the session on 401 and shows an access-denied screen on 403, and
        # a deactivated user must be signed out, not left browsing.
        raise _unauthorised(
            "This account has been deactivated. Contact your administrator.")

    return {**user, "permissions": sorted(permissions_for(user["role"]))}


def optional_user(authorization: str | None = Header(default=None)) -> dict[str, Any] | None:
    """For endpoints that behave differently when signed in but do not require
    it. Never used to grant privilege."""
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None


def require_role(allowed_roles: Iterable[str]):
    """Dependency factory: caller must hold one of `allowed_roles`."""
    # A bare string is iterable, so require_role("customer") would silently
    # become ('c','u','s','t','o','m','e','r') and refuse every caller with an
    # ordinary-looking 403. Fail at import instead of at 3am.
    if isinstance(allowed_roles, str):
        raise TypeError(
            "require_role() takes a sequence of roles, not a bare string — "
            f'use ["{allowed_roles}"] rather than "{allowed_roles}".')
    allowed = tuple(allowed_roles)

    def _guard(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        user = get_current_user(authorization)
        if user["role"] not in allowed:
            raise HTTPException(status_code=403, detail={
                "error": "forbidden",
                "role": user["role"],
                "required_roles": list(allowed),
                "message": (f"This action requires the "
                            f"{' or '.join(allowed)} role. You are signed in as "
                            f"{user['role']}."),
            })
        return user

    return _guard


def require_permission(*needed: str):
    """Finer-grained than role: checks the permission matrix."""
    def _guard(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        user = get_current_user(authorization)
        missing = [p for p in needed if p not in user["permissions"]]
        if missing:
            raise HTTPException(status_code=403, detail={
                "error": "forbidden",
                "role": user["role"],
                "required": list(needed),
                "missing": missing,
                "message": (f"Your role ({user['role']}) is not permitted to "
                            f"perform this action."),
            })
        return user

    return _guard


require_admin = require_role(["admin"])
