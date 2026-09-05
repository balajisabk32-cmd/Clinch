"""
Cryptographic primitives and credential policy.

Everything security-relevant lives here so there is exactly one place to audit:
one hashing function, one verifier, one policy, one token issuer, one decoder.

DESIGN NOTES WORTH DEFENDING
----------------------------
* bcrypt, not a homegrown hash. Work factor 12 is roughly a quarter-second per
  verification on current hardware -- slow enough that an offline attack on a
  stolen table is expensive, fast enough that a login still feels instant.

* Password rules are enforced HERE, on the server, and the API calls them before
  hashing. The frontend meter is a courtesy to the person typing; it is not a
  control. Anyone can POST straight to the endpoint.

* Login failures never say WHICH half was wrong. "No such email" and "wrong
  password" returning different messages turns the login form into a user
  enumeration oracle.
"""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

# --------------------------------------------------------------------------- #
#  Configuration
# --------------------------------------------------------------------------- #

# A real deployment injects this from the environment. The fallback is random
# per-process, so a forgotten secret invalidates sessions loudly on restart
# rather than silently shipping a known key to production.
import os

JWT_SECRET: str = os.environ.get("CLINCH_JWT_SECRET") or secrets.token_urlsafe(48)
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_HOURS = 8          # internal session length

BCRYPT_ROUNDS = 12

PASSWORD_MIN = 8
PASSWORD_MAX = 64
SPECIALS = "!@#$%^&*()_+-=[]{}|;:,.<>?"

# RFC 5322-practical: the full grammar admits addresses no mail system accepts.
# This rejects consecutive/leading/trailing dots, demands a dotted domain, and
# requires a TLD of at least two alphabetic characters.
EMAIL_RE = re.compile(
    r"^(?!\.)(?!.*\.\.)[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}(?<!\.)"
    r"@"
    r"(?!-)[A-Za-z0-9-]{1,63}(?<!-)"
    r"(?:\.(?!-)[A-Za-z0-9-]{1,63}(?<!-))*"
    r"\.[A-Za-z]{2,63}$"
)


# --------------------------------------------------------------------------- #
#  Email
# --------------------------------------------------------------------------- #

def normalize_email(email: str) -> str:
    """Lowercase and trim. Storage and lookup must agree, or a user can be
    created twice under Bob@x.com and bob@x.com."""
    return (email or "").strip().lower()


def validate_email(email: str) -> tuple[bool, str]:
    e = normalize_email(email)
    if not e:
        return False, "Email is required."
    if len(e) > 254:
        return False, "Email address is too long."
    if not EMAIL_RE.match(e):
        return False, "Enter a valid email address."
    return True, ""


# --------------------------------------------------------------------------- #
#  Passwords
# --------------------------------------------------------------------------- #

def validate_password_strength(plain: str) -> tuple[bool, list[str]]:
    """Return (ok, list of unmet requirements).

    Returns every failure rather than the first, so the caller can render a
    checklist instead of making the user rediscover one rule at a time.
    """
    problems: list[str] = []
    p = plain or ""

    if len(p) < PASSWORD_MIN:
        problems.append(f"At least {PASSWORD_MIN} characters")
    if len(p) > PASSWORD_MAX:
        problems.append(f"No more than {PASSWORD_MAX} characters")
    if not any(c.isupper() for c in p):
        problems.append("At least one uppercase letter")
    if not any(c.islower() for c in p):
        problems.append("At least one lowercase letter")
    if not any(c.isdigit() for c in p):
        problems.append("At least one number")
    if not any(c in SPECIALS for c in p):
        problems.append("At least one special character")

    return (not problems), problems


def password_score(plain: str) -> tuple[int, str]:
    """0-4 and a label, for the UI meter. Advisory only -- never a gate."""
    p = plain or ""
    if not p:
        return 0, "Empty"
    score = 0
    if len(p) >= PASSWORD_MIN:
        score += 1
    if len(p) >= 12:
        score += 1
    if any(c.isupper() for c in p) and any(c.islower() for c in p):
        score += 1
    if any(c.isdigit() for c in p) and any(c in SPECIALS for c in p):
        score += 1
    return score, ["Weak", "Weak", "Fair", "Good", "Strong"][score]


def hash_password(plain: str) -> str:
    if not plain:
        raise ValueError("Cannot hash an empty password")
    # bcrypt silently truncates beyond 72 bytes; refuse rather than hash a
    # prefix and let someone believe their long passphrase was used in full.
    raw = plain.encode("utf-8")
    if len(raw) > 72:
        raise ValueError("Password exceeds the 72-byte bcrypt limit")
    return bcrypt.hashpw(raw, bcrypt.gensalt(rounds=BCRYPT_ROUNDS)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    if not plain or not hashed:
        return False
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except (ValueError, TypeError):
        # A malformed hash in the table must read as "does not match", never as
        # an exception that a caller might mistake for success.
        return False


# --------------------------------------------------------------------------- #
#  Tokens
# --------------------------------------------------------------------------- #

def create_access_token(data: dict[str, Any],
                        expires_delta: timedelta | None = None) -> str:
    now = datetime.now(timezone.utc)
    expire = now + (expires_delta or timedelta(hours=ACCESS_TOKEN_HOURS))
    payload = {
        **data,
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


class TokenError(Exception):
    """Raised for any token that cannot be trusted, with a safe reason."""


def decode_access_token(token: str) -> dict[str, Any]:
    if not token:
        raise TokenError("Not authenticated")
    try:
        # algorithms is an allow-list on purpose: accepting the token's own
        # `alg` header is how "alg: none" forgeries get in.
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise TokenError("Session expired")
    except jwt.InvalidTokenError:
        raise TokenError("Invalid authentication token")
