"""Invoice presentation and settlement (PS rubric step 8).

The invoice ROW already existed -- an amount, a due date, a status. What did
not exist was everything around it that makes an invoice usable: how it was
paid, when, a document anyone can keep, and a way for the customer to pay
without a finance user doing it on their behalf.

Three things live here.

  * `record_payment` -- one settlement path shared by the finance desk and the
    customer portal, so a payment taken through either surface produces the
    same record: method, timestamp, remaining balance, and the order advancing
    to PAID once the balance clears. Two code paths writing payments is how a
    ledger ends up disagreeing with itself.

  * `invoice_pdf` -- a single page. An invoice is a document people file,
    forward and argue about, so it carries the company mark, both parties, the
    line detail, the tax split and the settlement status.

  * The customer-facing routes, which are ownership-checked against the
    signed-in account rather than trusting a reference in the URL.

Money is handled as `round(x, 2)` throughout, consistent with the rest of the
codebase. A real ledger would use integer minor units; that is a deliberate
scope call, not an oversight.
"""

from __future__ import annotations

import io
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import StreamingResponse

from . import fixtures as fx
from . import state
from .auth import require
from .deps import require_role
from .schemas import is_legal

# Same gate the rest of the storefront uses. Defined here rather than imported
# from storefront.py to keep the dependency one-way: billing knows nothing about
# the shop, and the shop can import billing without a cycle.
require_customer = require_role(["customer"])

__all__ = ["billing", "customer_billing", "record_payment", "invoice_pdf",
           "PAYMENT_METHODS"]


# The methods a customer can actually settle with. Kept server-side so the
# portal cannot invent one and the audit line always reads from a fixed set.
PAYMENT_METHODS: dict[str, str] = {
    "bank_transfer": "Bank transfer (NEFT/RTGS)",
    "upi": "UPI",
    "card": "Credit or debit card",
    "cheque": "Cheque",
    "credit_note": "Applied credit note",
}

COMPANY = dict(
    name="Clinch",
    line1="Clinch Sales Operations Pvt. Ltd.",
    line2="Level 4, Prestige Tech Park, Outer Ring Road",
    line3="Bengaluru 560103, Karnataka, India",
    gstin="29ABCDE1234F1Z5",
    email="billing@clinch.io",
)


def _logo_path() -> Path | None:
    """The mark used on the printed invoice.

    Resolved relative to this file rather than the working directory: the API
    is started from `backend/` in one script and from the repo root in another,
    and an invoice that silently loses its letterhead depending on how the
    server was launched is worse than one that never had it.
    """
    here = Path(__file__).resolve()
    for parent in here.parents:
        for name in ("CLINCH_LOGO_TRANSPARENT.png", "CLINCH_LOGO.png"):
            candidate = parent / "frontend" / "public" / name
            if candidate.exists():
                return candidate
    return None


# The source mark is 2816x1536 at 4 MB. reportlab embeds whatever it is given,
# so using it directly produced a 3.2 MB invoice for one page of text -- an
# invoice people email to each other. Downscaled once at first use and kept in
# memory: the letterhead is 30mm wide on the page and needs nothing near the
# original resolution.
_LOGO_CACHE: dict[str, tuple[bytes, float] | None] = {}
_LOGO_TARGET_PX = 640


def _logo_bitmap() -> tuple[bytes, float] | None:
    """PNG bytes plus the image's height/width ratio, or None if unavailable."""
    if "v" in _LOGO_CACHE:
        return _LOGO_CACHE["v"]

    result: tuple[bytes, float] | None = None
    path = _logo_path()
    if path is not None:
        try:
            from PIL import Image as PILImage

            with PILImage.open(path) as im:
                im = im.convert("RGBA")
                ratio = im.height / im.width
                if im.width > _LOGO_TARGET_PX:
                    im = im.resize(
                        (_LOGO_TARGET_PX, max(1, round(_LOGO_TARGET_PX * ratio))),
                        PILImage.LANCZOS)
                # Flatten onto white: an RGBA logo over a white page looks the
                # same, and a PDF viewer that ignores the alpha channel would
                # otherwise render the mark on black.
                flat = PILImage.new("RGB", im.size, (255, 255, 255))
                flat.paste(im, mask=im.split()[-1])
                buf = io.BytesIO()
                flat.save(buf, format="PNG", optimize=True)
                result = (buf.getvalue(), ratio)
        except Exception:
            # A missing or unreadable logo costs the letterhead, never the
            # invoice: the document still has to render.
            result = None

    _LOGO_CACHE["v"] = result
    return result


def find_invoice(ref: str) -> dict[str, Any] | None:
    return next((i for i in state.INVOICES if i["ref"] == ref), None)


def _balance(inv: dict[str, Any]) -> float:
    return round(float(inv["amount"]) - float(inv.get("amount_paid", 0.0)), 2)


def record_payment(
    inv: dict[str, Any],
    *,
    amount: float,
    method: str,
    actor: str,
    actor_role: str,
    reference: str | None = None,
) -> dict[str, Any]:
    """Settle an invoice, in whole or in part.

    Shared deliberately: finance taking a payment at the desk and a customer
    paying through the portal are the same event with a different author.
    """
    if inv["status"] == "paid":
        raise HTTPException(409, detail={
            "error": "already_paid", "ref": inv["ref"],
            "message": f"{inv['ref']} is already fully paid."})

    # An invoice is payable once it has been ISSUED, and not before.
    #
    # Payment used to be accepted against any invoice row regardless of where
    # its order had got to, which let the two drift apart in both directions:
    # an order still sitting at APPROVED -- not picked, not shipped -- had a
    # payable invoice, and money could be taken for goods that had not left the
    # warehouse. Tying settlement to the INVOICED state is what makes the chain
    # legible: approved, confirmed, shipped, invoiced, paid, in that order.
    order_ref = inv["order_ref"]
    order_state = state.state_of(order_ref)
    if order_state != "INVOICED":
        raise HTTPException(409, detail={
            "error": "not_yet_invoiced", "ref": inv["ref"],
            "order_ref": order_ref, "order_state": order_state,
            "message": (
                f"{inv['ref']} cannot be settled yet: order {order_ref} is "
                f"{order_state}. "
                + ("The goods have to ship and the invoice has to be raised first."
                   if order_state in ("APPROVED", "CONFIRMED")
                   else "The invoice has to be raised first."
                   if order_state == "FULFILLED"
                   else "This order is not at a stage where payment applies.")),
        })
    if method not in PAYMENT_METHODS:
        raise HTTPException(422, detail={
            "error": "unknown_method", "method": method,
            "message": f"{method!r} is not a supported payment method.",
            "supported": sorted(PAYMENT_METHODS)})

    try:
        amount = round(float(amount), 2)
    except (TypeError, ValueError):
        raise HTTPException(422, "amount must be a number")
    if amount <= 0:
        raise HTTPException(422, "a payment must be for a positive amount")

    outstanding = _balance(inv)
    if amount > outstanding + 0.01:
        raise HTTPException(422, detail={
            "error": "overpayment", "ref": inv["ref"],
            "outstanding": outstanding,
            "message": (f"{inv['ref']} has {outstanding:.2f} outstanding; "
                        f"cannot take {amount:.2f}.")})

    stamp = datetime.now().replace(microsecond=0).isoformat()
    entry = dict(amount=amount, method=method, method_label=PAYMENT_METHODS[method],
                 at=stamp, by=actor, by_role=actor_role, reference=reference)

    inv.setdefault("payments", []).append(entry)
    inv["amount_paid"] = round(float(inv.get("amount_paid", 0.0)) + amount, 2)
    inv["status"] = ("paid" if inv["amount_paid"] >= inv["amount"] - 0.01
                     else "partial" if inv["amount_paid"] > 0 else "unpaid")
    inv["method"] = method
    inv["method_label"] = PAYMENT_METHODS[method]
    # The moment of settlement, not the moment of the last part-payment: the
    # question an invoice has to answer is "when was this cleared?".
    inv["paid_at"] = stamp if inv["status"] == "paid" else inv.get("paid_at")
    inv["last_payment_at"] = stamp

    if inv["status"] == "paid":
        advance_order_to_paid(order_ref)

    state.record(order_ref, actor, actor_role, "paid",
                 reason=(f"{inv['ref']} {inv['status']} — "
                         f"{amount:,.2f} via {PAYMENT_METHODS[method]}"))

    return {**inv, "outstanding": _balance(inv),
            "order_state": state.state_of(order_ref)}


def advance_order_to_paid(order_ref: str) -> str:
    """Move a fully-settled order along the lifecycle until it reaches PAID.

    This was a single `is_legal(current, "PAID")` check. From FULFILLED that is
    false -- the chain runs FULFILLED -> INVOICED -> PAID -- so the check simply
    failed and nothing happened: the invoice was marked paid and its order was
    left behind, permanently, with no error anywhere. Three of the five invoices
    in the book had drifted this way.

    Walking the legal path instead of guessing one hop keeps the two in step,
    and refuses to invent a transition the machine does not allow.
    """
    guard = 0
    while state.state_of(order_ref) != "PAID" and guard < 6:
        guard += 1
        current = state.state_of(order_ref)
        nxt = next((t for t in ("CONFIRMED", "FULFILLED", "INVOICED", "PAID") if is_legal(current, t)), None)
        if nxt is None:
            break
        state.set_state(order_ref, nxt)
    return state.state_of(order_ref)


def reconcile_settlement() -> list[str]:
    """Bring orders back in step with invoices that are already settled.

    Called on boot. Repairs rows that drifted while the single-hop bug was in
    place, and is a no-op once everything agrees.
    """
    repaired: list[str] = []

    # An invoice whose face value disagrees with its order's total is the same
    # class of fiction the closed-book seed was written to remove, so say so
    # rather than letting it sit there looking authoritative.
    import logging
    log = logging.getLogger("clinch")
    for inv in state.INVOICES:
        ref = inv.get("order_ref")
        quote = state.build_quote(ref) if ref in state.QUOTES else None
        if quote is not None:
            from . import services as svc
            total = svc.totals(quote)["total"]
            if abs(total - float(inv["amount"])) > 1.0:
                log.warning(
                    "%s is for %.2f but order %s totals %.2f -- the invoice and "
                    "the order disagree", inv["ref"], float(inv["amount"]), ref, total)

    for inv in state.INVOICES:
        if inv.get("status") != "paid":
            continue
        ref = inv.get("order_ref")
        if not ref or ref not in state.QUOTES:
            continue
        if state.state_of(ref) == "PAID":
            continue
        before = state.state_of(ref)
        after = advance_order_to_paid(ref)
        if after != before:
            state.record(ref, "System", "system", "paid",
                         reason=(f"reconciled with {inv['ref']}: {before} -> {after}"))
            repaired.append(f"{ref} {before}->{after}")
    return repaired


# --------------------------------------------------------------------------- #
#  The document
# --------------------------------------------------------------------------- #

def invoice_pdf(inv: dict[str, Any]) -> StreamingResponse:
    """One page. Everything a filed invoice has to carry, and nothing else."""
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle)

    INK = colors.HexColor("#0D1B2A")
    MUTED = colors.HexColor("#7B8CA0")
    RULE = colors.HexColor("#E4E9EF")
    PAID = colors.HexColor("#1B7F5A")
    DUE = colors.HexColor("#B3541E")

    order_ref = inv["order_ref"]
    quote = state.build_quote(order_ref)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=14 * mm, bottomMargin=14 * mm,
        title=f"{inv['ref']} — {inv['customer']}", author=COMPANY["name"])

    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], fontSize=17, leading=20,
                        alignment=0, textColor=INK, spaceAfter=0)
    sub = ParagraphStyle("sub", parent=ss["Normal"], fontSize=8.5, textColor=MUTED,
                         leading=12)
    body = ParagraphStyle("body", parent=ss["Normal"], fontSize=9, textColor=INK,
                          leading=12.5)
    label = ParagraphStyle("label", parent=ss["Normal"], fontSize=7.5,
                           textColor=MUTED, leading=10)

    def money(v: float) -> str:
        return f"INR {v:,.2f}"

    story: list[Any] = []

    # ── Letterhead ──────────────────────────────────────────────────────────
    mark: Any = Paragraph(f"<b>{COMPANY['name']}</b>", h1)
    logo = _logo_bitmap()
    if logo:
        try:
            blob, ratio = logo
            width = 34 * mm
            # Height follows the source aspect ratio rather than a guessed
            # constant, so the mark is never stretched.
            mark = Image(io.BytesIO(blob), width=width, height=width * ratio)
            mark.hAlign = "LEFT"
        except Exception:
            pass

    head = Table(
        [[mark,
          Paragraph(f"<b>TAX INVOICE</b><br/>{inv['ref']}", h1)]],
        colWidths=[95 * mm, 79 * mm])
    head.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
    ]))
    story += [head, Spacer(1, 4)]

    parties = Table([[
        Paragraph("FROM", label),
        Paragraph("BILL TO", label),
        Paragraph("DETAILS", label),
    ], [
        Paragraph(f"{COMPANY['line1']}<br/>{COMPANY['line2']}<br/>"
                  f"{COMPANY['line3']}<br/>GSTIN {COMPANY['gstin']}<br/>"
                  f"{COMPANY['email']}", sub),
        Paragraph(f"<b>{inv['customer']}</b><br/>"
                  f"Account tier: {quote.tier if quote else '—'}<br/>"
                  f"Order {order_ref}", sub),
        Paragraph(f"Invoice date: {fx.TODAY.isoformat()}<br/>"
                  f"Due date: {inv.get('due_date', '—')}<br/>"
                  f"Sales rep: {fx.REP_NAME.get(quote.rep_id, quote.rep_id) if quote else '—'}",
                  sub),
    ]], colWidths=[62 * mm, 56 * mm, 56 * mm])
    parties.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEABOVE", (0, 0), (-1, 0), 0.6, RULE),
        ("TOPPADDING", (0, 0), (-1, 0), 6),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 8),
    ]))
    story += [parties]

    # ── Lines ───────────────────────────────────────────────────────────────
    rows: list[list[Any]] = [["Description", "Qty", "Amount"]]
    lines = inv.get("lines") or []
    if not lines and quote:
        lines = [dict(sku=l.sku, name=l.name, qty=l.qty,
                      amount=round(l.gross * (1 - quote.effective_discount(l) / 100.0), 2))
                 for l in quote.lines if not l.is_recurring]
    for l in lines:
        rows.append([Paragraph(f"{l['name']}<br/><font size=7 color='#7B8CA0'>"
                               f"{l['sku']}</font>", body),
                     str(l["qty"]), money(float(l["amount"]))])
    if len(rows) == 1:
        rows.append([Paragraph("Order total", body), "1",
                     money(round(float(inv["amount"]) / 1.18, 2))])

    net = sum(float(l["amount"]) for l in lines) if lines else round(float(inv["amount"]) / 1.18, 2)
    tax = round(float(inv["amount"]) - net, 2)

    table = Table(rows, colWidths=[110 * mm, 20 * mm, 44 * mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
        ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, RULE),
        ("LINEBELOW", (0, 1), (-1, -2), 0.3, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [Spacer(1, 6), table]

    totals = Table([
        ["Net", money(net)],
        ["Tax (18%)", money(tax)],
        ["Total", money(float(inv["amount"]))],
        ["Paid", money(float(inv.get("amount_paid", 0.0)))],
        ["Outstanding", money(_balance(inv))],
    ], colWidths=[44 * mm, 44 * mm], hAlign="RIGHT")
    totals.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 8.5),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ("FONTNAME", (0, 2), (-1, 2), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 2), (-1, 2), INK),
        ("LINEABOVE", (0, 2), (-1, 2), 0.6, RULE),
        ("LINEABOVE", (0, 4), (-1, 4), 0.6, RULE),
        ("FONTNAME", (0, 4), (-1, 4), "Helvetica-Bold"),
        ("TEXTCOLOR", (0, 4), (-1, 4), PAID if inv["status"] == "paid" else DUE),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    story += [Spacer(1, 8), totals]

    # ── Settlement ──────────────────────────────────────────────────────────
    status = str(inv["status"]).upper()
    if inv["status"] == "paid":
        note = (f"Settled in full on {inv.get('paid_at', '')[:10]} "
                f"at {inv.get('paid_at', '')[11:16]} via "
                f"{inv.get('method_label', PAYMENT_METHODS.get(inv.get('method', ''), '—'))}.")
    elif inv["status"] == "partial":
        note = (f"Part-paid. {money(_balance(inv))} remains due by "
                f"{inv.get('due_date', 'the due date')}.")
    else:
        note = f"Payable by {inv.get('due_date', 'the due date')}."

    stamp = Table([[Paragraph(f"<b>{status}</b>", body), Paragraph(note, sub)]],
                  colWidths=[24 * mm, 150 * mm])
    stamp.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TEXTCOLOR", (0, 0), (0, 0), PAID if inv["status"] == "paid" else DUE),
        ("LINEABOVE", (0, 0), (-1, 0), 0.6, RULE),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
    ]))
    story += [Spacer(1, 10), stamp]

    payments = inv.get("payments") or []
    if payments:
        prow: list[list[Any]] = [["Received", "Method", "Amount", "Recorded by"]]
        for pmt in payments:
            prow.append([pmt["at"].replace("T", " "), pmt.get("method_label", pmt["method"]),
                         money(float(pmt["amount"])), f"{pmt['by']} ({pmt['by_role']})"])
        ptable = Table(prow, colWidths=[42 * mm, 52 * mm, 34 * mm, 46 * mm])
        ptable.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 7.5),
            ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
            ("ALIGN", (2, 0), (2, -1), "RIGHT"),
            ("LINEBELOW", (0, 0), (-1, 0), 0.4, RULE),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ]))
        story += [Spacer(1, 8), Paragraph("PAYMENTS RECEIVED", label), ptable]

    story += [Spacer(1, 10),
              Paragraph("This is a computer-generated invoice issued by Clinch and is "
                        "valid without a signature.", sub)]

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{inv["ref"]}.pdf"'})


# --------------------------------------------------------------------------- #
#  Internal routes
# --------------------------------------------------------------------------- #

billing = APIRouter(tags=["billing"])


@billing.get("/payment-methods")
def payment_methods(_actor: dict[str, Any] = Depends(require("billing.view"))) -> list[dict[str, str]]:
    return [dict(key=k, label=v) for k, v in PAYMENT_METHODS.items()]


@billing.get("/invoices/{ref}/pdf")
def download_invoice(ref: str,
                     _actor: dict[str, Any] = Depends(require("billing.view"))) -> StreamingResponse:
    inv = find_invoice(ref)
    if inv is None:
        raise HTTPException(404, f"No invoice {ref}")
    return invoice_pdf(inv)


# --------------------------------------------------------------------------- #
#  Customer routes -- the portal half of the settlement loop
# --------------------------------------------------------------------------- #

customer_billing = APIRouter(prefix="/shop", tags=["storefront"])


def _mine(ref: str, user: dict[str, Any]) -> dict[str, Any]:
    """An invoice the signed-in customer actually owns.

    Ownership is checked against the account's own company, never against a
    reference supplied in the URL -- otherwise INV-1044 is readable by anyone
    who can count.
    """
    from . import customers as cust

    inv = find_invoice(ref)
    if inv is None:
        raise HTTPException(404, f"No invoice {ref}")
    acct = cust.by_user(user["id"])
    company = (acct or {}).get("company") or user.get("company")
    if not company or inv["customer"] != company:
        # 404, not 403: confirming that a reference exists is itself a leak.
        raise HTTPException(404, f"No invoice {ref}")
    return inv


def _public_invoice(inv: dict[str, Any]) -> dict[str, Any]:
    """Built up field by field, like every other customer payload here, so an
    internal field added later cannot leak by default."""
    return dict(
        ref=inv["ref"], order_ref=inv["order_ref"], customer=inv["customer"],
        amount=round(float(inv["amount"]), 2),
        amount_paid=round(float(inv.get("amount_paid", 0.0)), 2),
        outstanding=_balance(inv),
        status=inv["status"], due_date=inv.get("due_date"),
        paid_at=inv.get("paid_at"), method_label=inv.get("method_label"),
        lines=[dict(sku=l["sku"], name=l["name"], qty=l["qty"],
                    amount=round(float(l["amount"]), 2))
               for l in (inv.get("lines") or [])],
        payments=[dict(at=p["at"], amount=round(float(p["amount"]), 2),
                       method_label=p.get("method_label", p["method"]))
                  for p in (inv.get("payments") or [])],
    )


@customer_billing.get("/invoices")
def my_invoices(user: dict[str, Any] = Depends(require_customer)) -> list[dict[str, Any]]:
    from . import customers as cust

    acct = cust.by_user(user["id"])
    company = (acct or {}).get("company") or user.get("company")
    if not company:
        return []
    return [_public_invoice(i) for i in state.INVOICES if i["customer"] == company]


@customer_billing.get("/invoices/methods")
def my_payment_methods(_user: dict[str, Any] = Depends(require_customer)) -> list[dict[str, str]]:
    return [dict(key=k, label=v) for k, v in PAYMENT_METHODS.items()]


@customer_billing.get("/invoices/{ref}")
def my_invoice(ref: str, user: dict[str, Any] = Depends(require_customer)) -> dict[str, Any]:
    return _public_invoice(_mine(ref, user))


@customer_billing.get("/invoices/{ref}/pdf")
def my_invoice_pdf(ref: str,
                   user: dict[str, Any] = Depends(require_customer)) -> StreamingResponse:
    return invoice_pdf(_mine(ref, user))


@customer_billing.post("/invoices/{ref}/pay")
def pay_my_invoice(ref: str, body: dict[str, Any] = Body(default_factory=dict),
                   user: dict[str, Any] = Depends(require_customer)) -> dict[str, Any]:
    """The customer settles their own invoice.

    Paying in full is the default: the portal's job is to clear the balance,
    not to invite a customer to invent an amount. A partial figure is accepted
    when one is sent, because part-payment is a real thing customers do.
    """
    inv = _mine(ref, user)
    amount = body.get("amount")
    if amount in (None, "", 0):
        amount = _balance(inv)
    result = record_payment(
        inv,
        amount=amount,
        method=str(body.get("method", "bank_transfer")),
        actor=user.get("name") or inv["customer"],
        actor_role="customer",
        reference=body.get("reference"),
    )
    return _public_invoice(result)
