"""
Role-based access control.

THE RULE: permission is decided on the SERVER. The frontend asks
`GET /auth/me` what it may do and renders accordingly, but that is a
convenience for the user — never the control. A client-side role check reads
localStorage, and localStorage is editable by anyone with DevTools open, so a
"Manager only" screen guarded in the browser is not guarded at all.

Every sensitive endpoint therefore carries a `Depends(require(...))`, and the
token is HMAC-signed so a viewer cannot simply mint themselves a new role.

The matrix below is taken directly from PS §3 "User Roles":

  Sales Rep        builds quotations, applies discounts, adds upsell items,
                   tracks approval status, responds to negotiation
  Sales Manager    reviews/approves/rejects over-threshold quotes, CONFIGURES
                   discount tiers and approval chains, monitors deal health
  Finance / Ops    second-level approvals, manages warehouse fulfilment splits
                   and backorder decisions, reconciles recurring billing and
                   credit notes
  Customer         portal only
  Admin            backend setup (products, price lists, discount tiers,
                   warehouses, subscription plans) + platform-wide analytics

Note what this means in practice: a Manager may set discount policy but may NOT
create products or warehouses. Finance may settle money and move stock but may
NOT rewrite the discount policy that governs it. Separating those two is the
whole point of a governance tool — the person who sets the limits should not
also be the person who books the revenue against them.
"""

from __future__ import annotations

from typing import Any, Iterable

from fastapi import Header, HTTPException

Role = str  # rep | manager | finance | admin | customer

# --------------------------------------------------------------------------- #
#  Permission matrix
# --------------------------------------------------------------------------- #

PERMISSIONS: dict[Role, set[str]] = {
    "rep": {
        "quote.view", "quote.edit", "quote.submit",
        "product.view", "fulfilment.view", "dealhealth.view", "portal.share",
    },
    "manager": {
        "quote.view", "quote.edit", "quote.submit",
        "product.view", "fulfilment.view", "dealhealth.view", "portal.share",
        "approval.manager",          # first-level sign-off
        "policy.config",             # PS: "Configures discount tiers and approval chains"
        "reports.view",
    },
    "finance": {
        "quote.view", "product.view", "fulfilment.view", "dealhealth.view",
        "approval.finance",          # second-level sign-off only
        "fulfilment.allocate",       # PS: "Manages warehouse fulfilment splits"
        "billing.view", "billing.modify", "invoice.manage",
        "reports.view",
    },
    "admin": set(),                  # filled below — admin holds everything
    # A customer account grants authority over its own basket and its own
    # quotations, and nothing else. None of these appear in any internal
    # role, and no internal permission appears here -- the two sets are
    # disjoint by construction, so there is no route both can reach.
    "customer": {"portal.view", "shop.browse", "shop.cart", "shop.quote"},
}

ALL_PERMISSIONS: set[str] = {
    "quote.view", "quote.edit", "quote.submit",
    "approval.manager", "approval.finance",
    "fulfilment.view", "fulfilment.allocate",
    "billing.view", "billing.modify", "invoice.manage",
    "policy.config", "product.manage", "product.view",
    "warehouse.manage", "plan.manage",
    "reports.view", "dealhealth.view", "portal.share", "admin.reset",
    "user.manage",
}
PERMISSIONS["admin"] = set(ALL_PERMISSIONS)

# Human-readable reasons, so a 403 explains itself instead of just refusing.
PERMISSION_LABEL: dict[str, str] = {
    "approval.manager": "approving quotations at manager level",
    "approval.finance": "second-level finance approval",
    "fulfilment.allocate": "committing warehouse allocations",
    "billing.modify": "changing subscriptions and issuing credit notes",
    "invoice.manage": "issuing invoices and registering payments",
    "policy.config": "changing discount tiers and approval chains",
    "product.manage": "creating or editing products and price lists",
    "warehouse.manage": "creating or editing warehouses and stock rules",
    "plan.manage": "creating or editing subscription plans",
    "reports.view": "viewing platform reporting",
}

# Which workspace tabs each role may see. Derived from permissions rather than
# hardcoded per role, so the nav can never drift from what the server allows.
TAB_PERMISSION: list[tuple[str, str, str]] = [
    ("/app/dashboard",     "Dashboard",     "quote.view"),
    ("/app/quotations",    "Quotations",    "quote.view"),
    ("/app/pipeline",      "Pipeline",      "quote.view"),
    ("/app/approvals",     "Approvals",     "approval.manager"),
    ("/app/fulfilment",    "Fulfilment",    "fulfilment.view"),
    ("/app/subscriptions", "Subscriptions", "billing.view"),
    ("/app/invoices",      "Invoices",      "invoice.manage"),
    ("/app/health",        "Deal Health",   "dealhealth.view"),
    ("/app/reports",       "Reports",       "reports.view"),
    ("/app/products",      "Products",      "product.view"),
    ("/app/settings",      "Settings",      "policy.config"),
    ("/app/users",              "Users",         "user.manage"),
    ("/app/admin/subscriptions","Plans",         "plan.manage"),
    ("/app/admin/reports",      "Rep reports",   "user.manage"),
    ("/app/profile",       "Profile",       "quote.view"),
]


def permissions_for(role: Role) -> set[str]:
    return PERMISSIONS.get(role, set())


def tabs_for(role: Role) -> list[dict[str, str]]:
    perms = permissions_for(role)
    # Approvals is visible to anyone who can sign off at EITHER level.
    return [
        {"to": to, "label": label}
        for to, label, need in TAB_PERMISSION
        if need in perms
        or (need == "approval.manager" and "approval.finance" in perms)
    ]


# --------------------------------------------------------------------------- #
#  Tokens
# --------------------------------------------------------------------------- #

# The legacy HMAC token pair (issue_token / parse_token) has been removed.
# It signed `<user>.<role>.<hmac>` with a hardcoded module constant, carried no
# expiry, and was minted without ever checking a password. Sessions are now real
# JWTs issued by accounts.py after a bcrypt verification.


def current_user(authorization: str | None = Header(default=None)) -> dict[str, Any]:
    """Resolve the caller from a verified JWT, or raise 401.

    This previously returned a REP identity when no Authorization header was
    present. That single line made every "permission-gated" endpoint in the
    application reachable by anyone who simply omitted the header -- the guards
    were real, but nothing was ever unauthenticated enough to hit them.
    Anonymous is now anonymous.
    """
    from .deps import get_current_user
    return get_current_user(authorization)


def require(*needed: str):
    """FastAPI dependency enforcing one or more permissions."""
    def _guard(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        user = current_user(authorization)
        held = set(user["permissions"])
        missing = [p for p in needed if p not in held]
        if missing:
            what = PERMISSION_LABEL.get(missing[0], missing[0])
            raise HTTPException(status_code=403, detail={
                "error": "forbidden",
                "role": user["role"],
                "required": list(needed),
                "missing": missing,
                "message": (f"Your role ({user['role']}) is not permitted to perform "
                            f"{what}."),
            })
        return user
    return _guard


def any_of(*needed: str):
    """Dependency satisfied by holding ANY one of the listed permissions."""
    def _guard(authorization: str | None = Header(default=None)) -> dict[str, Any]:
        user = current_user(authorization)
        if not set(needed) & set(user["permissions"]):
            raise HTTPException(status_code=403, detail={
                "error": "forbidden", "role": user["role"],
                "required_any": list(needed),
                "message": (f"Your role ({user['role']}) is not permitted to perform "
                            f"{PERMISSION_LABEL.get(needed[0], needed[0])}."),
            })
        return user
    return _guard
