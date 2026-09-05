"""Sales-rep performance, and the exports of it.

Every figure here is computed from the same pipeline and closed book the rest of
the product reads. Nothing is a stored aggregate: a scorecard that disagrees
with the dashboard it sits next to is worse than no scorecard, and the only way
to guarantee it cannot is to derive both from one source at read time.

"Margin leakage" is the same quantity the governance dashboard reports — revenue
discounted beyond what policy allowed — not simply total discount given. A rep
who discounts 10% within a 15% ceiling has leaked nothing.
"""

from __future__ import annotations

import csv
import io
from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse

from . import fixtures as fx, services as svc, state
from .deps import require_admin

reporting = APIRouter(prefix="/admin/reports", tags=["admin"])

PERIODS = {"today": 1, "week": 7, "last30": 30, "quarter": 90, "all": None}


def _rep_names() -> list[str]:
    return sorted({fx.REP_NAME.get(u["id"], u["id"])
                   for u in fx.USERS if u["role"] == "rep"})


def _closed_for(rep_name: str | None, cutoff: str | None) -> list[dict[str, Any]]:
    out = []
    for o in fx.CLOSED_ORDERS:
        if rep_name and fx.REP_NAME.get(o["rep"], o["rep"]) != rep_name:
            continue
        if cutoff and o.get("closed_at", "") < cutoff:
            continue
        out.append(o)
    return out


def scorecard(rep_name: str | None = None, period: str = "all") -> dict[str, Any]:
    horizon = PERIODS.get(period, None)
    cutoff = (fx.TODAY - timedelta(days=horizon)).isoformat() if horizon else None

    # ── Open pipeline: what they are working on now ────────────────────────
    rows = svc.open_pipeline()
    if rep_name:
        rows = [r for r in rows if fx.REP_NAME.get(r["quote"].rep_id) == rep_name]

    quotes_built = len(rows)
    outliers = sum(1 for r in rows if r["result"].band != "AUTO")
    # effective_discount() is per LINE (line discount + order discount), so a
    # quote's figure is the revenue-weighted average across its lines rather
    # than a flat mean -- a 40% discount on one cable and 2% on fifty laptops
    # is not a 21% deal, and reporting it as one would flatter the rep.
    weighted, base = 0.0, 0.0
    for r in rows:
        q = r["quote"]
        for line in q.lines:
            gross = line.list_price * line.qty
            weighted += gross * q.effective_discount(line)
            base += gross
    avg_discount = round(weighted / base, 2) if base else 0.0

    # ── Closed book: what they actually booked ─────────────────────────────
    closed = _closed_for(rep_name, cutoff)
    policy = state.get_policy()
    booked = 0.0
    leakage = 0.0
    for o in closed:
        for sku, qty, disc in o["lines"]:
            p = fx.BY_SKU.get(sku)
            if not p:
                continue
            gross = p["list_price"] * qty
            booked += gross * (1 - disc / 100.0)
            # Leakage is only the portion beyond the ceiling that applied.
            ceiling = policy.ceiling_for("Gold", p["category"])
            if disc > ceiling:
                leakage += gross * (disc - ceiling) / 100.0

    turnarounds = [o["approval_hours"] for o in closed if o.get("approval_hours")]
    avg_turnaround = round(sum(turnarounds) / len(turnarounds), 1) if turnarounds else 0.0

    compliant = len(closed) - sum(
        1 for o in closed
        for sku, _q, disc in o["lines"]
        if (p := fx.BY_SKU.get(sku)) and disc > policy.ceiling_for("Gold", p["category"]))
    compliance_rate = round(100.0 * max(0, compliant) / len(closed), 1) if closed else 100.0

    return {
        "rep": rep_name or "All reps",
        "period": period,
        "quotes_built": quotes_built,
        "deals_closed_won": len(closed),
        "booked_revenue": round(booked, 2),
        "avg_discount_pct": avg_discount,
        "margin_leakage": round(leakage, 2),
        "outliers_flagged": outliers,
        "avg_approval_hours": avg_turnaround,
        "compliance_rate_pct": compliance_rate,
        "deals": [
            {
                "ref": o["ref"],
                "customer": o["customer"],
                "closed_at": o.get("closed_at", "")[:10],
                "approval_hours": o.get("approval_hours"),
                "value": round(sum(
                    (fx.BY_SKU[sku]["list_price"] * qty * (1 - disc / 100.0))
                    for sku, qty, disc in o["lines"] if sku in fx.BY_SKU), 2),
                "avg_discount": round(sum(d for _s, _q, d in o["lines"]) / len(o["lines"]), 1)
                                if o["lines"] else 0.0,
            }
            for o in sorted(closed, key=lambda x: x.get("closed_at", ""), reverse=True)
        ],
    }


@reporting.get("/rep-performance")
def rep_performance(rep_id: str | None = Query(None),
                    rep: str | None = Query(None),
                    period: str = Query("all"),
                    _actor: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    """Scorecard for one rep, or for the whole team when none is named."""
    name = rep or (fx.REP_NAME.get(rep_id) if rep_id else None)
    return {**scorecard(name, period), "available_reps": _rep_names()}


# --------------------------------------------------------------------------- #
#  Exports
# --------------------------------------------------------------------------- #

def _filename(name: str, period: str, ext: str) -> str:
    safe = (name or "all-reps").replace(" ", "-").replace(".", "").lower()
    return f"clinch-rep-performance-{safe}-{period}.{ext}"


@reporting.get("/rep-performance/export/csv")
def export_csv(rep_id: str | None = Query(None), rep: str | None = Query(None),
               period: str = Query("all"),
               _actor: dict[str, Any] = Depends(require_admin)) -> StreamingResponse:
    name = rep or (fx.REP_NAME.get(rep_id) if rep_id else None)
    d = scorecard(name, period)

    buf = io.StringIO()
    w = csv.writer(buf, lineterminator="\n")
    w.writerow(["Clinch — Sales Rep Performance"])
    w.writerow(["Rep", d["rep"]])
    w.writerow(["Period", d["period"]])
    w.writerow([])
    w.writerow(["Metric", "Value"])
    for label, key, suffix in [
        ("Quotations built", "quotes_built", ""),
        ("Deals closed won", "deals_closed_won", ""),
        ("Booked revenue (INR)", "booked_revenue", ""),
        ("Average discount", "avg_discount_pct", "%"),
        ("Margin leakage (INR)", "margin_leakage", ""),
        ("Outlier quotes flagged", "outliers_flagged", ""),
        ("Average approval turnaround", "avg_approval_hours", "h"),
        ("Policy compliance", "compliance_rate_pct", "%"),
    ]:
        w.writerow([label, f"{d[key]}{suffix}"])

    w.writerow([])
    w.writerow(["Ref", "Customer", "Closed", "Value (INR)", "Avg discount %", "Approval hours"])
    for row in d["deals"]:
        w.writerow([row["ref"], row["customer"], row["closed_at"],
                    row["value"], row["avg_discount"], row["approval_hours"]])

    # BOM so Excel opens the rupee figures in the right encoding without a
    # manual import step -- the file is opened by double-click, not by a wizard.
    data = ("﻿" + buf.getvalue()).encode("utf-8")
    return StreamingResponse(
        io.BytesIO(data), media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition":
                 f'attachment; filename="{_filename(d["rep"], period, "csv")}"'})


@reporting.get("/rep-performance/export/pdf")
def export_pdf(rep_id: str | None = Query(None), rep: str | None = Query(None),
               period: str = Query("all"),
               _actor: dict[str, Any] = Depends(require_admin)) -> StreamingResponse:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle)

    name = rep or (fx.REP_NAME.get(rep_id) if rep_id else None)
    d = scorecard(name, period)

    INK = colors.HexColor("#0D1B2A")
    MUTED = colors.HexColor("#7B8CA0")
    RULE = colors.HexColor("#E4E9EF")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=16 * mm, bottomMargin=16 * mm,
        title=f"Rep performance — {d['rep']}", author="Clinch")

    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], fontSize=18, leading=22,
                        alignment=0, textColor=INK, spaceAfter=2)
    sub = ParagraphStyle("sub", parent=ss["Normal"], fontSize=9, textColor=MUTED)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], fontSize=10.5,
                        textColor=INK, spaceBefore=14, spaceAfter=6)

    story: list[Any] = [
        Paragraph("Sales rep performance", h1),
        Paragraph(f"{d['rep']} · period: {d['period']} · generated by Clinch", sub),
        Spacer(1, 10),
    ]

    def money(v: float) -> str:
        return f"INR {v:,.0f}"

    kpis = [
        ["Deals closed won", str(d["deals_closed_won"]),
         "Booked revenue", money(d["booked_revenue"])],
        ["Quotations built", str(d["quotes_built"]),
         "Margin leakage", money(d["margin_leakage"])],
        ["Average discount", f"{d['avg_discount_pct']}%",
         "Outliers flagged", str(d["outliers_flagged"])],
        ["Approval turnaround", f"{d['avg_approval_hours']}h",
         "Policy compliance", f"{d['compliance_rate_pct']}%"],
    ]
    kpi_table = Table(kpis, colWidths=[42 * mm, 32 * mm, 42 * mm, 32 * mm])
    kpi_table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("TEXTCOLOR", (2, 0), (2, -1), MUTED),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica-Bold"),
        ("FONTNAME", (3, 0), (3, -1), "Helvetica-Bold"),
        ("TEXTCOLOR", (1, 0), (1, -1), INK),
        ("TEXTCOLOR", (3, 0), (3, -1), INK),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, RULE),
    ]))
    story += [kpi_table, Paragraph("Closed deals", h2)]

    if d["deals"]:
        head = ["Ref", "Customer", "Closed", "Value", "Avg disc.", "Approval"]
        body = [[r["ref"], r["customer"], r["closed_at"], money(r["value"]),
                 f"{r['avg_discount']}%",
                 f"{r['approval_hours']}h" if r["approval_hours"] else "—"]
                for r in d["deals"][:40]]
        deals = Table([head] + body,
                      colWidths=[24 * mm, 46 * mm, 24 * mm, 32 * mm, 22 * mm, 22 * mm],
                      repeatRows=1)
        deals.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("TEXTCOLOR", (0, 0), (-1, 0), MUTED),
            ("TEXTCOLOR", (0, 1), (-1, -1), INK),
            ("ALIGN", (3, 0), (-1, -1), "RIGHT"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, RULE),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ]))
        story.append(deals)
        if len(d["deals"]) > 40:
            story += [Spacer(1, 6),
                      Paragraph(f"Showing the 40 most recent of {len(d['deals'])} "
                                "closed deals. The CSV export carries them all.", sub)]
    else:
        story.append(Paragraph("No closed deals in this period.", sub))

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition":
                 f'attachment; filename="{_filename(d["rep"], period, "pdf")}"'})
