"""Master subscription plans — admin CRUD.

A plan is a commercial template: what it costs, how often it bills, how a
mid-cycle change is prorated, and how much notice a cancellation needs. Live
subscriptions reference it; changing a plan therefore changes the terms of the
next cycle, not the invoices already raised.

DELETE deactivates rather than removes. A plan with subscriptions against it
cannot be deleted without orphaning them, and the billing history has to stay
explainable long after a plan is withdrawn from sale.
"""

from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Body, Depends, HTTPException

from . import db
from .deps import require_admin

plans = APIRouter(prefix="/admin/subscriptions", tags=["admin"])

CYCLES = ("monthly", "quarterly", "yearly")
PRORATION_RULES = ("calendar_daily", "none", "full_period")


def _row(r: sqlite3.Row) -> dict[str, Any]:
    d = dict(r)
    d["is_active"] = bool(d["is_active"])
    return d


def _validate(body: dict[str, Any], *, partial: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {}

    if "name" in body or not partial:
        name = (body.get("name") or "").strip()
        if not name:
            raise HTTPException(422, {"error": "name_required",
                                      "message": "Give the plan a name."})
        out["name"] = name

    if "code" in body or not partial:
        code = (body.get("code") or "").strip().upper()
        if not code:
            raise HTTPException(422, {"error": "code_required",
                                      "message": "Give the plan a short code."})
        out["code"] = code

    if "billing_cycle" in body or not partial:
        cycle = (body.get("billing_cycle") or "").strip().lower()
        if cycle not in CYCLES:
            raise HTTPException(422, {
                "error": "bad_cycle", "allowed": list(CYCLES),
                "message": f"Billing cycle must be one of {', '.join(CYCLES)}."})
        out["billing_cycle"] = cycle

    if "base_price" in body or not partial:
        try:
            price = float(body.get("base_price"))
        except (TypeError, ValueError):
            raise HTTPException(422, {"error": "bad_price",
                                      "message": "Base price must be a number."})
        if price < 0:
            raise HTTPException(422, {"error": "bad_price",
                                      "message": "Base price cannot be negative."})
        out["base_price"] = price

    if "proration_rule" in body:
        rule = (body.get("proration_rule") or "calendar_daily").strip()
        if rule not in PRORATION_RULES:
            raise HTTPException(422, {
                "error": "bad_proration", "allowed": list(PRORATION_RULES),
                "message": f"Proration rule must be one of {', '.join(PRORATION_RULES)}."})
        out["proration_rule"] = rule

    if "cancellation_notice_days" in body:
        try:
            days = int(body.get("cancellation_notice_days"))
        except (TypeError, ValueError):
            raise HTTPException(422, {"error": "bad_notice",
                                      "message": "Notice period must be a whole number of days."})
        if not 0 <= days <= 365:
            raise HTTPException(422, {"error": "bad_notice",
                                      "message": "Notice period must be between 0 and 365 days."})
        out["cancellation_notice_days"] = days

    if "is_active" in body:
        out["is_active"] = 1 if body.get("is_active") else 0

    return out


@plans.get("")
def list_plans(include_inactive: bool = False,
               _actor: dict[str, Any] = Depends(require_admin)) -> list[dict[str, Any]]:
    sql = "SELECT * FROM subscription_plan"
    if not include_inactive:
        sql += " WHERE is_active = 1"
    sql += " ORDER BY is_active DESC, name"
    return [_row(r) for r in db.query(sql)]


@plans.post("", status_code=201)
def create_plan(body: dict[str, Any] = Body(...),
                _actor: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    f = _validate(body)
    if db.one("SELECT 1 FROM subscription_plan WHERE code = ?", (f["code"],)):
        raise HTTPException(409, {
            "error": "code_taken",
            "message": f"A plan with code {f['code']} already exists."})
    cur = db.execute(
        """INSERT INTO subscription_plan
             (name, code, billing_cycle, base_price, proration_rule,
              cancellation_notice_days, is_active, created_at)
           VALUES (?,?,?,?,?,?,?,?)""",
        (f["name"], f["code"], f["billing_cycle"], f["base_price"],
         f.get("proration_rule", "calendar_daily"),
         f.get("cancellation_notice_days", 30),
         f.get("is_active", 1),
         datetime.now(timezone.utc).isoformat(timespec="seconds")),
    )
    return _row(db.one("SELECT * FROM subscription_plan WHERE id = ?", (cur.lastrowid,)))


@plans.put("/{plan_id}")
def update_plan(plan_id: int, body: dict[str, Any] = Body(...),
                _actor: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    if not db.one("SELECT 1 FROM subscription_plan WHERE id = ?", (plan_id,)):
        raise HTTPException(404, f"No plan {plan_id}")
    f = _validate(body, partial=True)
    if not f:
        raise HTTPException(422, {"error": "nothing_to_update",
                                  "message": "Send at least one field to change."})
    if "code" in f:
        clash = db.one("SELECT id FROM subscription_plan WHERE code = ? AND id != ?",
                       (f["code"], plan_id))
        if clash:
            raise HTTPException(409, {"error": "code_taken",
                                      "message": f"Code {f['code']} is already in use."})
    clause = ", ".join(f"{k} = ?" for k in f)
    db.execute(f"UPDATE subscription_plan SET {clause} WHERE id = ?",
               (*f.values(), plan_id))
    return _row(db.one("SELECT * FROM subscription_plan WHERE id = ?", (plan_id,)))


@plans.delete("/{plan_id}")
def deactivate_plan(plan_id: int,
                    _actor: dict[str, Any] = Depends(require_admin)) -> dict[str, Any]:
    """Soft delete. See the module note: live subscriptions reference this row,
    and the billing history has to stay explainable after withdrawal."""
    row = db.one("SELECT * FROM subscription_plan WHERE id = ?", (plan_id,))
    if row is None:
        raise HTTPException(404, f"No plan {plan_id}")
    db.execute("UPDATE subscription_plan SET is_active = 0 WHERE id = ?", (plan_id,))
    return {"id": plan_id, "is_active": False,
            "message": f"{row['name']} withdrawn from sale. Existing subscriptions continue."}
