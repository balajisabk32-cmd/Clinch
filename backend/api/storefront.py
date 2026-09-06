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
from .schemas import is_legal
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
        image=p.get("image"),
        image_url=p.get("image"),
        tier=tier,
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
        assigned_rep=_assign_rep(company),
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


def _assign_rep(company: str | None = None) -> str:
    """Which rep owns this customer.

    An account that already HAS an owner keeps it. This used to round-robin
    across all twelve reps in all three clusters regardless of the company, so a
    buyer signing up for Acme Corp could be handed to a rep in a different
    manager's cluster. Everything downstream then disagreed with itself: the
    internal `POST /quotes` refuses to let a rep quote into an account they do
    not own, and the approval desk routes to the OWNING rep's manager -- who
    would answer 403, because the deal had been parked with someone else's rep.
    A quotation could reach a state where no manager in the company was able to
    approve it.

    Round-robin remains the fallback, and only for a company nobody owns yet --
    a genuinely new self-registered account, where spreading the book is the
    right instinct.
    """
    if company:
        owner = fx.owner_of(company)
        if owner:
            return owner

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
    # The whole company record, not a subset. The account screen renders a
    # "Company Details" panel and a delivery/invoicing tab, and with address,
    # postcode and the account's own creation date missing it filled the gaps
    # with a hardcoded Mumbai address and an invented GSTIN -- fabricated
    # details presented to the customer as their own.
    rep_id = acct.get("assigned_rep")
    return {
        **_public_user(user),
        "permissions": sorted(permissions_for("customer")),
        "company": acct["company"],
        "gst_number": acct["gst_number"],
        "phone": acct["phone"],
        "address": acct.get("address"),
        "city": acct["city"],
        "postcode": acct.get("postcode"),
        "created_at": acct.get("created_at"),
        # Who to talk to. The customer has an account manager; not naming them
        # is the difference between a portal and a form.
        "account_manager": fx.REP_NAME.get(rep_id, rep_id) if rep_id else None,
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
            image=p.get("image"),
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
    try:
        acct = _account_or_404(user)
        lines = customers.cart_rows(user["id"])
        if not lines:
            raise HTTPException(422, {"error": "empty_cart",
                                      "message": "Add at least one product before requesting a quotation."})

        rep_id = acct["assigned_rep"] or "rep_rao"
        ref = state.create_quote(acct["company"], rep_id, tier=acct["tier"])
        # Tag the origin the same way the rest of the app reads it, so this shows
        # up in the rep's and manager's "Customer requests" section rather than
        # looking like a quote the rep opened themselves.
        state.QUOTES[ref]["source"] = "Customer Request"

        note = (body.get("note") or "").strip()
        line_discounts = body.get("line_discounts") or {}
        if not isinstance(line_discounts, dict):
            line_discounts = {}

        # Support items array format as well: [{"sku": "LP14", "discount_pct": 10}, ...]
        if isinstance(body.get("items"), list):
            for it in body["items"]:
                if isinstance(it, dict) and "sku" in it:
                    d = it.get("discount_pct") or it.get("discount")
                    if d is not None:
                        line_discounts[it["sku"]] = d

        # Add each line item to the quotation with the discount configured for that product in the cart
        for row in lines:
            sku = row["sku"]
            disc = 0.0
            if sku in line_discounts:
                try:
                    disc = max(0.0, min(100.0, float(line_discounts[sku])))
                except (TypeError, ValueError):
                    disc = 0.0
            state.add_line(ref, sku, row["qty"], round(disc, 2))

        # The customer may say what discount they are HOPING for per product or overall.
        # It is recorded as a request against the quotation, never written directly onto a line:
        # the docstring above is the rule, and this does not bend it. The rep sees the number and
        # decides; the engine still scores whatever the rep actually prices.
        asked = body.get("requested_discount_pct")
        if asked not in (None, ""):
            try:
                asked = float(asked)
            except (TypeError, ValueError):
                raise HTTPException(422, {
                    "error": "bad_discount",
                    "message": "The requested discount must be a number."})
            if not 0 <= asked <= 100:
                raise HTTPException(422, {
                    "error": "bad_discount",
                    "message": "A discount must be between 0 and 100 percent."})
        else:
            asked = None

        # If per-product discount allotments are provided, compute the effective overall discount
        if asked is None and isinstance(line_discounts, dict) and line_discounts:
            subtotals = [_tier_price(r["sku"], acct["tier"]) * r["qty"] for r in lines]
            tot_sub = sum(subtotals)
            tot_disc = 0.0
            for sub, r in zip(subtotals, lines):
                disc_val = line_discounts.get(r["sku"], 0.0)
                try:
                    tot_disc += sub * (float(disc_val) / 100.0)
                except (TypeError, ValueError):
                    pass
            if tot_sub > 0 and tot_disc > 0:
                asked = round((tot_disc / tot_sub) * 100.0, 2)

        # Record itemized per-product discount allotments in comments so the rep sees each product's request
        if isinstance(line_discounts, dict):
            for i, row in enumerate(lines):
                sku = row["sku"]
                p_disc = line_discounts.get(sku)
                if p_disc not in (None, ""):
                    try:
                        p_disc = float(p_disc)
                        if p_disc > 0:
                            prod_name = next((p["name"] for p in state.PRODUCTS if p["sku"] == sku), sku)
                            state.PORTAL_COMMENTS.setdefault(ref, []).append(dict(
                                line_id=i, author=user["name"],
                                body=f"Requested {p_disc:g}% discount on {prod_name} ({sku})",
                                counter_discount_pct=p_disc, created_at=state.last_activity(ref),
                            ))
                    except (TypeError, ValueError):
                        pass

        reason = note or f"Quotation requested from the storefront by {acct['company']}"
        if asked is not None:
            reason = f"asked for {asked:g}%" + (f" - {note}" if note else "")
        state.record(ref, user["name"], "customer", "requested", reason=reason,
                     requested_discount_pct=asked)
        if note or asked is not None:
            state.PORTAL_COMMENTS.setdefault(ref, []).append(dict(
                line_id=None, author=user["name"],
                body=note or "Discount requested with the original quotation request.",
                counter_discount_pct=asked, created_at=state.last_activity(ref),
            ))

        customers.cart_clear(user["id"])
        state.persist()
        return {"ref": ref, "state": state.state_of(ref),
                "rep": fx.REP_NAME.get(rep_id, rep_id),
                "message": "Your request is with your account manager."}
    except HTTPException:
        raise
    except Exception as exc:
        import logging
        logging.getLogger("clinch").error("Failed to process quotation request: %s", exc, exc_info=True)
        raise HTTPException(500, detail={"error": "quote_request_failed", "message": str(exc)})


# --------------------------------------------------------------------------- #
#  The customer's own quotations
# --------------------------------------------------------------------------- #

def _owns(acct: dict[str, Any], ref: str) -> bool:
    row = state.QUOTES.get(ref)
    return bool(row) and row.get("customer") == acct["company"]


def _negotiation_view(ref: str, quote: Any) -> dict[str, Any]:
    """What happened to the discount the customer asked for.

    The storefront has always rendered four outcomes -- pending, approved,
    declined, counter-offer -- but the payload carried none of the fields those
    branches read, so every one of them was dead markup. A customer submitted a
    request and the screen simply never mentioned it again; the "if the manager
    accepts, it goes back to the customer" half of the loop was invisible from
    the customer's side.

    Derived here from state that already exists rather than stored as a second
    status field: the audit trail says what the customer asked for, the line
    discounts say what they are being offered, and the lifecycle state says who
    is holding it. A stored flag would be a fifth thing to keep in sync with
    those three.
    """
    asks = [c for c in state.PORTAL_COMMENTS.get(ref, [])
            if c.get("counter_discount_pct") is not None]
    if not asks:
        return dict(discount_request_status=None, requested_discount=None,
                    counter_discount=None, counter_notes=None)

    asked = float(asks[-1]["counter_discount_pct"])
    internal = state.state_of(ref)
    # What is actually on the quotation now, as one comparable number.
    offered = max((float(l.discount_pct) for l in quote.lines), default=0.0)

    if internal == "REJECTED":
        status = "rejected"
    elif internal.startswith("PENDING"):
        status = "pending_approval"
    elif offered + 1e-9 >= asked:
        # They are being given what they asked for, or better.
        status = "approved"
    elif offered > 0:
        # A reviewer moved the price, but not all the way to the ask.
        status = "counter_offer"
    else:
        status = "rejected"

    notes = state.approval_meta(ref).get("manager_revision_notes") \
        or next((c.get("body") for c in reversed(state.PORTAL_COMMENTS.get(ref, []))
                 if c.get("body") and c.get("counter_discount_pct") is None), None)

    return dict(
        discount_request_status=status,
        requested_discount=round(asked, 2),
        counter_discount=round(offered, 2) if status == "counter_offer" else None,
        counter_notes=notes,
    )


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
        last_activity_at=state.last_activity(ref),
        can_confirm=internal in ("APPROVED", "NEGOTIATION"),
        can_negotiate=internal in ("APPROVED", "NEGOTIATION", "CONFIRMED"),
        comments=state.PORTAL_COMMENTS.get(ref, []),
        revision_count=state.revision_meta(ref)["revision_count"],
        lines=[dict(id=i, name=l.name, category=l.category, qty=l.qty,
                    unit_price=l.list_price, discount_pct=l.discount_pct,
                    line_total=round(l.net, 2))
               for i, l in enumerate(quote.lines)],
        **_negotiation_view(ref, quote),
        # Whether they may keep negotiating, and if not, why. Without this the
        # portal offers a counter-offer form that the server will refuse.
        **state.negotiation_lock(ref),
    )


@storefront.get("/shop/quotes")
def my_quotes(user: dict[str, Any] = Depends(require_customer)) -> list[dict[str, Any]]:
    acct = _account_or_404(user)

    def _summary(ref: str) -> dict[str, Any]:
        """List rows carry WHAT was bought, not the full pricing breakdown.

        `lines` is stripped because unit prices and per-line discounts belong on
        the detail page, but stripping it entirely left the account screen's
        order panel unable to say what was in an order -- the one thing a list
        of past orders has to show. `items` is the compact answer: name, qty and
        line total, no pricing internals.
        """
        full = _customer_quote(ref)
        lines = full.pop("lines", [])
        full["items"] = [
            dict(name=l["name"], qty=l["qty"], line_total=l["line_total"])
            for l in lines
        ]
        full["item_count"] = sum(l["qty"] for l in lines)
        return full

    return [_summary(ref) for ref in state.QUOTES if _owns(acct, ref)]


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


# --------------------------------------------------------------------------- #
#  Customer confirmation — the decision point of the negotiation loop
# --------------------------------------------------------------------------- #

@storefront.post("/shop/quotes/{ref}/confirm")
def confirm_quotation(ref: str, body: dict[str, Any] = Body(default_factory=dict),
                      user: dict[str, Any] = Depends(require_customer)) -> dict[str, Any]:
    """The customer accepts. What happens next is decided by the score, here.

    This is the point the whole revision loop exists to reach, and the rule is
    that ACCEPTANCE DOES NOT MEAN APPROVAL. The final terms -- including any
    counter-discount the customer attaches to this very request -- are scored
    again by the same `score_quote` the approval desk uses:

      * within every ceiling -> CONFIRMED, and the order proceeds directly to
        fulfilment and billing. No approval step is triggered at all, because
        there is nothing for anyone to approve.
      * still over a ceiling -> PENDING_MANAGER, routed to the rep's assigned
        manager, and to Finance afterwards if the band says so.

    Scoring at confirmation rather than trusting the score recorded when the
    quote was sent is what makes the loop safe: a customer can counter on the
    way in, and the terms that get committed are the terms that get checked.
    """
    acct = _account_or_404(user)
    if not _owns(acct, ref):
        raise HTTPException(404, "No such quotation")

    current = state.state_of(ref)
    if current not in ("APPROVED", "NEGOTIATION"):
        raise HTTPException(409, {
            "error": "not_confirmable", "ref": ref, "current_state": current,
            "message": f"This quotation is {current.lower().replace('_', ' ')} "
                       "and is not awaiting your confirmation.",
        })

    # A last-minute counter is applied first, so it is part of what gets scored.
    counter = body.get("counter_discount_pct")
    if counter is not None:
        try:
            pct = float(counter)
        except (TypeError, ValueError):
            raise HTTPException(422, {"error": "bad_counter",
                                      "message": "Enter a discount as a number."})
        if not 0 <= pct <= 100:
            raise HTTPException(422, {"error": "bad_counter",
                                      "message": "Discount must be between 0 and 100."})
        line_id = body.get("line_id")
        row = state.QUOTES[ref]
        for i, line in enumerate(row["lines"]):
            if line_id is None or i == int(line_id):
                line["discount_pct"] = pct
        state.PORTAL_COMMENTS.setdefault(ref, []).append(dict(
            line_id=line_id, author=user["name"],
            body=body.get("comment") or f"Accepted at {pct:g}%",
            counter_discount_pct=pct, created_at=state.last_activity(ref)))

    quote, r = svc.score_for(ref)

    # Two ways this needs no approval:
    #   1. the terms are inside every ceiling, so no one had to look; or
    #   2. a manager already approved these exact terms and the customer has
    #      accepted them unchanged. Sending that back round the loop would ask
    #      the same approver the same question about the same numbers.
    #
    # `terms_within_approval` compares line by line, so a customer who counters
    # for MORE discount on the way in loses the standing approval and routes.
    pre_approved = state.terms_within_approval(ref)
    within = r.band == "AUTO" or pre_approved

    if within:
        for target in ("CONFIRMED",):
            if not is_legal(state.state_of(ref), target):
                raise HTTPException(409, {
                    "error": "illegal_transition", "ref": ref,
                    "current_state": state.state_of(ref),
                    "message": f"{ref} cannot move to {target}."})
            state.set_state(ref, target)
        state.record(
            ref, user["name"], "customer", "customer_confirmed",
            reason=(f"accepted terms already approved by "
                    f"{state.approval_meta(ref)['approved_by_name']} "
                    f"(score {r.score}, {r.band})"
                    if pre_approved and r.band != "AUTO"
                    else f"accepted within policy (score {r.score}, {r.band})"),
            risk_score=r.score, risk_band=r.band, pre_approved=pre_approved)

        # Proceed to fulfilment and billing. Suggested only -- the allocation is
        # committed by Finance on the fulfilment screen, because moving stock is
        # not something a customer's click should do.
        suggestion = _split_suggestion(ref)
        state.persist()
        return {
            "ref": ref, "state": state.state_of(ref),
            "approval_required": False,
            "risk_score": r.score, "risk_band": r.band,
            "fulfilment_suggestion": suggestion,
            "pre_approved": pre_approved and r.band != "AUTO",
            "approved_by": state.approval_meta(ref)["approved_by_name"],
            "message": "Confirmed - proceeding to fulfilment.",
        }

    # Over a ceiling: back into the approval chain, routed by the score.
    #
    # Via NEGOTIATION, because APPROVED does not reach PENDING_MANAGER directly
    # and should not -- a customer countering upward IS a negotiation, and the
    # audit trail should read that way rather than showing an approved quote
    # teleporting back into a queue. This mirrors the token portal's path.
    current_now = state.state_of(ref)
    if current_now != "NEGOTIATION":
        if not is_legal(current_now, "NEGOTIATION"):
            raise HTTPException(409, {
                "error": "illegal_transition", "ref": ref,
                "current_state": current_now,
                "message": f"{ref} cannot move to NEGOTIATION."})
        state.set_state(ref, "NEGOTIATION")

    target = "PENDING_MANAGER"
    if not is_legal(state.state_of(ref), target):
        raise HTTPException(409, {
            "error": "illegal_transition", "ref": ref,
            "current_state": state.state_of(ref),
            "message": f"{ref} cannot move to {target}."})
    state.set_state(ref, target)

    manager = fx.REP_TO_MANAGER.get(quote.rep_id) or fx.REP_TO_MANAGER.get(
        fx.REP_NAME.get(quote.rep_id, ""), "M. Shah")
    state.record(ref, user["name"], "customer", "customer_confirmed",
                 reason=(f"accepted at terms above policy (score {r.score}, {r.band}); "
                         f"routed to {manager}"),
                 risk_score=r.score, risk_band=r.band, routed_to=manager)
    state.persist()
    return {
        "ref": ref, "state": state.state_of(ref),
        "approval_required": True,
        "risk_score": r.score, "risk_band": r.band,
        "routed_to": manager,
        "needs_finance": r.band == "FINANCE",
        "message": "Confirmed - routed for manager approval due to final discount terms.",
    }


def _split_suggestion(ref: str) -> dict[str, Any] | None:
    """Lowest-cost warehouse split for the confirmed order, as a suggestion."""
    try:
        from .routers import _split_for
        plan = _split_for(ref, "cost")
        if not plan:
            return None
        if not plan.get("allocations") and not plan.get("backorders"):
            return None
        # An order with nothing allocatable and everything on backorder is a
        # real, useful answer -- "we cannot ship this yet" is exactly what
        # fulfilment needs to see. Treating it as "no suggestion" hid it.
        return {"total_cost": plan.get("total_cost"),
                "allocations": plan.get("allocations"),
                "backorders": plan.get("backorders", [])}
    except Exception as exc:
        # A suggestion is a convenience. If it cannot be computed the order is
        # still confirmed, and Finance will run the split on the fulfilment
        # screen as usual -- but say why rather than swallowing it, or a
        # permanently-empty panel looks like a design choice.
        return {"unavailable": True, "reason": f"{type(exc).__name__}: {exc}"}
