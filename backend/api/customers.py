"""Customer accounts, tiering and cart.

Two things here are load-bearing and easy to get subtly wrong.

TIERING. A self-registered customer starts on Bronze and is promoted by what
they actually spend. But the seeded enterprise accounts must NOT be tiered that
way: their tiers are negotiated contract terms, and in this book they do not
track spend at all — Acme Corp holds the lowest lifetime value (₹242,815) and is
Gold, while Vertex Labs holds the highest (₹585,586) and is Silver. Running the
promotion rule over them would demote Acme, which changes its discount ceiling,
which changes Q-1042's risk score, which quietly rewrites the calibrated demo.
`tier_locked` is the flag that keeps the two populations apart.

THRESHOLDS ARE POLICY. They live in the policy record, not in this file, so an
administrator can change them without a deploy — and so the numbers are visible
and auditable rather than buried in code. The defaults are taken from the real
book: ₹250,000 is just under the lowest observed enterprise lifetime and
₹500,000 just under the highest.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from . import db

TIERS = ("Bronze", "Silver", "Gold")

DEFAULT_TIER_THRESHOLDS: dict[str, float] = {"Silver": 250_000.0, "Gold": 500_000.0}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _row_to_account(row) -> dict[str, Any] | None:
    if row is None:
        return None
    d = dict(row)
    d["tier_locked"] = bool(d["tier_locked"])
    return d


# --------------------------------------------------------------------------- #
#  Accounts
# --------------------------------------------------------------------------- #

def create_account(user_id: str, company: str, *, gst_number: str | None = None,
                   phone: str | None = None, address: str | None = None,
                   city: str | None = None, postcode: str | None = None,
                   tier: str = "Bronze", tier_locked: bool = False,
                   assigned_rep: str | None = None) -> dict[str, Any]:
    db.execute(
        """INSERT INTO customer_account
             (user_id, company, gst_number, phone, address, city, postcode,
              tier, tier_locked, lifetime_value, assigned_rep, created_at)
           VALUES (?,?,?,?,?,?,?,?,?,0,?,?)""",
        (user_id, company.strip(), gst_number, phone, address, city, postcode,
         tier, 1 if tier_locked else 0, assigned_rep, _now()),
    )
    return by_user(user_id)  # type: ignore[return-value]


def all_accounts() -> list[dict[str, Any]]:
    """Every storefront account, for rep-ownership lookups."""
    return [_row_to_account(r) for r in db.query("SELECT * FROM customer_account")]


def by_user(user_id: str) -> dict[str, Any] | None:
    return _row_to_account(
        db.one("SELECT * FROM customer_account WHERE user_id = ?", (user_id,)))


def update_profile(user_id: str, fields: dict[str, Any]) -> dict[str, Any] | None:
    allowed = {"company", "gst_number", "phone", "address", "city", "postcode"}
    sets = {k: v for k, v in fields.items() if k in allowed}
    if sets:
        clause = ", ".join(f"{k} = ?" for k in sets)
        db.execute(f"UPDATE customer_account SET {clause} WHERE user_id = ?",
                   (*sets.values(), user_id))
    return by_user(user_id)


# --------------------------------------------------------------------------- #
#  Tiering
# --------------------------------------------------------------------------- #

def tier_for_value(lifetime_value: float,
                   thresholds: dict[str, float] | None = None) -> str:
    """Highest tier whose threshold the customer has met."""
    t = {**DEFAULT_TIER_THRESHOLDS, **(thresholds or {})}
    if lifetime_value >= t.get("Gold", DEFAULT_TIER_THRESHOLDS["Gold"]):
        return "Gold"
    if lifetime_value >= t.get("Silver", DEFAULT_TIER_THRESHOLDS["Silver"]):
        return "Silver"
    return "Bronze"


def record_purchase(user_id: str, amount: float,
                    thresholds: dict[str, float] | None = None) -> dict[str, Any] | None:
    """Add to lifetime value and re-derive the tier.

    Promotion only. A customer is never demoted by a refund or an adjustment
    here: tier is a standing commercial relationship, and silently downgrading
    someone mid-negotiation would change the ceiling on a quote they are already
    looking at.
    """
    acct = by_user(user_id)
    if acct is None:
        return None
    total = float(acct["lifetime_value"]) + float(amount)

    if acct["tier_locked"]:
        db.execute("UPDATE customer_account SET lifetime_value = ? WHERE user_id = ?",
                   (total, user_id))
        return by_user(user_id)

    earned = tier_for_value(total, thresholds)
    current = acct["tier"]
    new_tier = earned if TIERS.index(earned) > TIERS.index(current) else current
    db.execute("UPDATE customer_account SET lifetime_value = ?, tier = ? WHERE user_id = ?",
               (total, new_tier, user_id))
    return by_user(user_id)


def tier_progress(acct: dict[str, Any],
                  thresholds: dict[str, float] | None = None) -> dict[str, Any]:
    """What the customer needs to reach the next tier, for the storefront."""
    t = {**DEFAULT_TIER_THRESHOLDS, **(thresholds or {})}
    value = float(acct["lifetime_value"])
    if acct["tier_locked"]:
        return {"tier": acct["tier"], "lifetime_value": value, "next_tier": None,
                "remaining": None, "progress_pct": None, "locked": True}
    if acct["tier"] == "Gold":
        return {"tier": "Gold", "lifetime_value": value, "next_tier": None,
                "remaining": None, "progress_pct": 100.0, "locked": False}
    next_tier = "Silver" if acct["tier"] == "Bronze" else "Gold"
    target = float(t[next_tier])
    floor = 0.0 if next_tier == "Silver" else float(t["Silver"])
    span = max(target - floor, 1.0)
    return {
        "tier": acct["tier"], "lifetime_value": value, "next_tier": next_tier,
        "remaining": round(max(target - value, 0.0), 2),
        "progress_pct": round(min(100.0, max(0.0, (value - floor) / span * 100)), 1),
        "locked": False,
    }


# --------------------------------------------------------------------------- #
#  Cart
# --------------------------------------------------------------------------- #

def cart_rows(user_id: str) -> list[dict[str, Any]]:
    return [dict(r) for r in db.query(
        "SELECT sku, qty, added_at FROM cart_item WHERE user_id = ? ORDER BY added_at",
        (user_id,))]


def cart_put(user_id: str, sku: str, qty: int) -> None:
    """Set the quantity for a line, inserting it if new."""
    db.execute(
        """INSERT INTO cart_item (user_id, sku, qty, added_at) VALUES (?,?,?,?)
           ON CONFLICT(user_id, sku) DO UPDATE SET qty = excluded.qty""",
        (user_id, sku, int(qty), _now()),
    )


def cart_remove(user_id: str, sku: str) -> None:
    db.execute("DELETE FROM cart_item WHERE user_id = ? AND sku = ?", (user_id, sku))


def cart_clear(user_id: str) -> None:
    db.execute("DELETE FROM cart_item WHERE user_id = ?", (user_id,))
