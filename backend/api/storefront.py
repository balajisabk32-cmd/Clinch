"""Customer storefront — registration, catalogue, cart, quotation requests.

THE AIR GAP, RESTATED FOR A LOGGED-IN CUSTOMER.

The token portal proves the redaction structurally: it builds a fresh dict of
customer-safe fields, so adding a field to the internal model cannot leak it.
A customer with an ACCOUNT is a bigger surface than a customer with a link, so
the same discipline applies here and for the same reason — every payload below
is constructed field by field. `cost`, `margin`, `risk_score`, `ceiling`, `over`
and `rep` are never assembled into a customer response, so they cannot escape by
someone later adding a field to the internal product or quote model.

REGISTRATION. Public, and deliberately so: the standing rule is that REPS,
MANAGERS and FINANCE cannot self-register, because an internal role is an
authority grant. A customer account grants authority over nothing but its own
basket. The role is pinned to "customer" in code and never read from the request
body — a body carrying {"role": "admin"} creates a customer.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException

from . import customers, fixtures as fx, services as svc, state, users
from .auth import permissions_for
from .deps import get_current_user, require_role
from core.security import (
    create_access_token, hash_password, normalize_email,
    validate_email, validate_password_strength,
)

storefront = APIRouter(tags=["storefront"])

require_customer = require_role(["customer"])


# --------------------------------------------------------------------------- #
#  Helpers
# --------------------------------------------------------------------------- #

def _tier_price(sku: str, tier: str) -> float:
    """Tier pricing, delegated to the engine's own price list.

    Deliberately `fx.price_for` rather than arithmetic here. A storefront that
    computes its own ladder will eventually disagree with the engine, and then
    the customer is shown one number and charged another. Bronze 0%, Silver -3%,
    Gold -6% live in PRICE_LISTS and there is exactly one copy of them.
    """
    return fx.price_for(sku, tier)


def _public_product(p: dict[str, Any], tier: str) -> dict[str, Any]:
    """Built field by field. `cost` is not in this dict and cannot be."""
    return dict(
        sku=p["sku"],
        name=p["name"],
        category=p["category"],
        description=p.get("description") or "",
        uom=p.get("uom") or "Each",
        tax_pct=p.get("tax_pct", 18.0),
        is_recurring=bool(p.get("is_recurring")),
        recurrence=p.get("recurrence"),
        is_promoted=bool(p.get("is_promoted")),
        list_price=p["list_price"],
        your_price=_tier_price(p["sku"], tier),
        # Availability, not the exact shelf count -- a competitor should not be
        # able to read our inventory position by registering an account.
        availability=("in_stock" if (p.get("stock_total") or 0) > 20
                      else "low_stock" if (p.get("stock_total") or 0) > 0
                      else "made_to_order"),
        variants=p.get("variants") or [],
    )


def _account_or_404(user: dict[str, Any]) -> dict[str, Any]:
    acct = customers.by_user(user["id"])
    if acct is None:
        raise HTTPException(404, {
            "error": "no_customer_account",
            "message": "This sign-in has no customer profile attached.",
        })
    return acct


def _thresholds() -> dict[str, float]:
    policy = state.get_policy()
    return getattr(policy, "tier_thresholds", None) or customers.DEFAULT_TIER_THRESHOLDS


# --------------------------------------------------------------------------- #
#  Registration
# --------------------------------------------------------------------------- #

@storefront.post("/auth/register", status_code=201)
def register(body: dict[str, Any] = Body(...)) -> dict[str, Any]:
    name = (body.get("name") or "").strip()
    email = normalize_email(body.get("email", ""))
    password = body.get("password") or ""
    company = (body.get("company") or "").strip()

    if not name:
        raise HTTPException(422, {"error": "name_required",
                                  "message": "Enter your full name."})
    if not company:
        raise HTTPException(422, {"error": "company_required",
                                  "message": "Enter your company name."})
    # Both validators return (ok, why) -- the tuple is always truthy, so a
    # walrus on the call itself rejects every address ever submitted.
    ok, why = validate_email(email)
    if not ok:
        raise HTTPException(422, {"error": "invalid_email", "message": why})
    strong, problems = validate_password_strength(password)
    if not strong:
        raise HTTPException(422, {"error": "weak_password", "unmet": problems,
                                  "message": "Password does not meet the policy."})
    if users.by_email(email):
        # Same wording the login endpoint uses, so registration cannot be used
        # to enumerate which addresses already hold accounts.
        raise HTTPException(409, {"error": "email_taken",
                                  "message": "That email address cannot be registered."})

    # The role is pinned here. It is never taken from the request body: a
    # payload carrying {"role": "admin"} creates a customer like any other.
    user = users.create(name, email, password, "customer")

    customers.create_account(
        user["id"], company,
        gst_number=(body.get("gst_number") or "").strip() or None,
        phone=(body.get("phone") or "").strip() or None,
        address=(body.get("address") or "").strip() or None,
        city=(body.get("city") or "").strip() or None,
        postcode=(body.get("postcode") or "").strip() or None,
        tier="Bronze",           # everyone starts here; spend earns the rest
        tier_locked=False,
        assigned_rep=_assign_rep(),
    )

    token = create_access_token({"sub": user["id"], "email": user["email"],
                                 "role": "customer"})
    acct = customers.by_user(user["id"])
    return {
        "access_token": token, "token_type": "bearer",
        "user": {**_public_user(user), "company": acct["company"], "tier": acct["tier"]},
    }


def _public_user(u: dict[str, Any]) -> dict[str, Any]:
    return {"id": u["id"], "name": u["name"], "email": u["email"],
            "role": u["role"], "is_active": bool(u["is_active"])}


def _assign_rep() -> str:
    """Round-robin across the reps who actually exist.

    Least-loaded would be better, but it needs a live open-quote count per rep
    and this runs before the customer has any quotes at all. Rotating keeps the
    book from piling onto one name, which is the failure that matters here.
    """
    reps = [u["id"] for u in fx.USERS if u["role"] == "rep"] or ["rep_rao"]
    n = db_count_customers()
    return reps[n % len(reps)]


def db_count_customers() -> int:
    from . import db
    row = db.one("SELECT COUNT(*) AS n FROM customer_account")
    return int(row["n"]) if row else 0


# --------------------------------------------------------------------------- #
#  Me
# --------------------------------------------------------------------------- #

@storefront.get("/shop/me")
def shop_me(user: dict[str, Any] = Depends(require_customer)) -> dict[str, Any]:
    acct = _account_or_404(user)
    return {
        **_public_user(user),
        "permissions": sorted(permissions_for("customer")),
        "company": acct["company"],
        "gst_number": acct["gst_number"],
        "phone": acct["phone"],
        "city": acct["city"],
        **customers.tier_progress(acct, _thresholds()),
    }


# --------------------------------------------------------------------------- #
#  Catalogue
# --------------------------------------------------------------------------- #

@storefront.get("/shop/catalog")
def catalog(category: str | None = None, q: str | None = None,
            user: dict[str, Any] = Depends(require_customer)) -> dict[str, Any]:
    acct = _account_or_404(user)
    rows = state.PRODUCTS
    if category and category.lower() != "all":
        rows = [p for p in rows if (p.get("category") or "").lower() == category.lower()]
    if q:
        needle = q.strip().lower()
        rows = [p for p in rows
                if needle in p["name"].lower() or needle in p["sku"].lower()]
    return {
        "tier": acct["tier"],
        "categories": sorted({p["category"] for p in state.PRODUCTS if p.get("category")}),
        "products": [_public_product(p, acct["tier"]) for p in rows],
    }


@storefront.get("/shop/catalog/{sku}")
def catalog_item(sku: str,
                 user: dict[str, Any] = Depends(require_customer)) -> dict[str, Any]:
    acct = _account_or_404(user)
    p = next((x for x in state.PRODUCTS if x["sku"] == sku), None)
    if p is None:
        raise HTTPException(404, f"No product {sku}")
    return _public_product(p, acct["tier"])


# --------------------------------------------------------------------------- #
#  Cart
# --------------------------------------------------------------------------- #

def _cart_payload(user_id: str, tier: str) -> dict[str, Any]:
    lines, subtotal = [], 0.0
    for row in customers.cart_rows(user_id):
        p = next((x for x in state.PRODUCTS if x["sku"] == row["sku"]), None)
        if p is None:
            continue                      # product withdrawn; drop it silently
        unit = _tier_price(p["sku"], tier)
        line_total = round(unit * row["qty"], 2)
        subtotal += line_total
        lines.append(dict(
            sku=p["sku"], name=p["name"], category=p["category"],
            qty=row["qty"], list_price=p["list_price"], your_price=unit,
            line_total=line_total, is_recurring=bool(p.get("is_recurring")),
        ))
    return {"lines": lines, "subtotal": round(subtotal, 2),
            "count": sum(l["qty"] for l in lines), "tier": tier}


@storefront.get("/shop/cart")
def get_cart(user: dict[str, Any] = Depends(require_customer)) -> dict[str, Any]:
    acct = _account_or_404(user)
    return _cart_payload(user["id"], acct["tier"])


@storefront.post("/shop/cart")
def put_cart(body: dict[str, Any] = Body(...),
             user: dict[str, Any] = Depends(require_customer)) -> dict[str, Any]:
    acct = _account_or_404(user)
    sku = (body.get("sku") or "").strip()
    qty = int(body.get("qty") or 0)
    if not any(p["sku"] == sku for p in state.PRODUCTS):
        raise HTTPException(404, f"No product {sku}")
    if qty <= 0:
        customers.cart_remove(user["id"], sku)
    else:
        if qty > 999:
            raise HTTPException(422, {"error": "qty_too_large",
                                      "message": "Maximum 999 units per line."})
        customers.cart_put(user["id"], sku, qty)
    return _cart_payload(user["id"], acct["tier"])


@storefront.delete("/shop/cart/{sku}")
def delete_cart_line(sku: str,
                     user: dict[str, Any] = Depends(require_customer)) -> dict[str, Any]:
    acct = _account_or_404(user)
    customers.cart_remove(user["id"], sku)
    return _cart_payload(user["id"], acct["tier"])


# --------------------------------------------------------------------------- #
#  Quotation requests  —  cart  ->  DRAFT quote  ->  a rep's queue
# --------------------------------------------------------------------------- #

@storefront.post("/shop/quote-requests", status_code=201)
def request_quotation(body: dict[str, Any] = Body(default_factory=dict),
                      user: dict[str, Any] = Depends(require_customer)) -> dict[str, Any]:
    """Turn the basket into a real quotation on a rep's desk.

    The customer never sets a discount here. They ask; the rep prices it and the
    engine routes it. Letting the basket carry a discount straight into a DRAFT
    would hand the customer the pen on the one number the whole product exists to
    govern.
    """
    acct = _account_or_404(user)
    lines = customers.cart_rows(user["id"])
    if not lines:
        raise HTTPException(422, {"error": "empty_cart",
                                  "message": "Add at least one product before requesting a quotation."})

    rep_id = acct["assigned_rep"] or "rep_rao"
    ref = state.create_quote(acct["company"], rep_id, tier=acct["tier"])
    for row in lines:
        state.add_line(ref, row["sku"], row["qty"], 0.0)

    note = (body.get("note") or "").strip()
    state.record(ref, user["name"], "customer", "requested",
                 reason=note or f"Quotation requested from the storefront by {acct['company']}")
    if note:
        state.PORTAL_COMMENTS.setdefault(ref, []).append(dict(
            line_id=None, author=user["name"], body=note,
            counter_discount_pct=None, created_at=state.last_activity(ref),
        ))

    customers.cart_clear(user["id"])
    state.persist()
    return {"ref": ref, "state": state.state_of(ref),
            "rep": fx.REP_NAME.get(rep_id, rep_id),
            "message": "Your request is with your account manager."}


# --------------------------------------------------------------------------- #
#  The customer's own quotations
# --------------------------------------------------------------------------- #

def _owns(acct: dict[str, Any], ref: str) -> bool:
    row = state.QUOTES.get(ref)
    return bool(row) and row.get("customer") == acct["company"]


def _customer_quote(ref: str) -> dict[str, Any]:
    """The same field-by-field construction the token portal uses.

    `state.build_quote`, not `fx.get_quote`: the latter reads only the seeded
    fixture rows, so every quotation created during the session — which is all
    of a storefront customer's — came back as None.
    """
    quote = state.build_quote(ref)
    if quote is None:
        raise HTTPException(404, f"No quotation {ref}")
    t = svc.totals(quote)
    internal = state.state_of(ref)
    status = ("Confirmed" if internal in ("CONFIRMED", "FULFILLED", "INVOICED", "PAID")
              else "Under Negotiation" if internal == "NEGOTIATION"
              else "Awaiting your account manager" if internal.startswith("PENDING")
              else "Draft" if internal == "DRAFT"
              else "Declined" if internal == "REJECTED"
              else "Ready for your review")
    return dict(
        ref=ref, customer=quote.customer, status=status,
        awaiting_us=internal.startswith("PENDING") or internal == "DRAFT",
        currency="INR", subtotal=t["subtotal"], discount_total=t["discount_total"],
        tax_total=t["tax_total"], total=t["total"],
        recurring_total=t["total_recurring"],
        can_confirm=internal in ("APPROVED", "NEGOTIATION"),
        can_negotiate=internal in ("APPROVED", "NEGOTIATION", "CONFIRMED"),
        comments=state.PORTAL_COMMENTS.get(ref, []),
        lines=[dict(id=i, name=l.name, category=l.category, qty=l.qty,
                    unit_price=l.list_price, discount_pct=l.discount_pct,
                    line_total=round(l.net, 2))
               for i, l in enumerate(quote.lines)],
    )


@storefront.get("/shop/quotes")
def my_quotes(user: dict[str, Any] = Depends(require_customer)) -> list[dict[str, Any]]:
    acct = _account_or_404(user)
    return [
        {k: v for k, v in _customer_quote(ref).items() if k != "lines"}
        for ref in state.QUOTES
        if _owns(acct, ref)
    ]


@storefront.get("/shop/quotes/{ref}")
def my_quote(ref: str,
             user: dict[str, Any] = Depends(require_customer)) -> dict[str, Any]:
    acct = _account_or_404(user)
    # 404 rather than 403 for someone else's quotation: confirming that a
    # reference exists is itself a leak, and a customer has no legitimate way to
    # learn another company's quote numbers.
    if not _owns(acct, ref):
        raise HTTPException(404, "No such quotation")
    return _customer_quote(ref)


@storefront.post("/shop/quotes/{ref}/request")
def my_quote_request(ref: str, body: dict[str, Any] = Body(...),
                     user: dict[str, Any] = Depends(require_customer)) -> dict[str, Any]:
    """Ask for a better price.

    Delegates to the SAME negotiation engine the token portal uses, rather than
    reimplementing it: the counter is re-scored as if accepted and, per PS B8, a
    quote that breaks a threshold re-enters approval automatically with no rep
    action. A second implementation here would be a second discount policy, and
    the product exists to have exactly one.
    """
    acct = _account_or_404(user)
    if not _owns(acct, ref):
        raise HTTPException(404, "No such quotation")

    from .routers import portal_request
    token = next((t for t, r in fx.PORTAL_TOKENS.items() if r == ref), None)
    if token is None:
        token = f"acct-{ref.lower()}"
        fx.PORTAL_TOKENS[token] = ref
    return portal_request(token, body)
