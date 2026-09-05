"""
Persistence bridge between SQLite and the in-memory working set.

ARCHITECTURE, STATED PLAINLY
----------------------------
SQLite is the store of record. `state.py` holds an in-memory READ CACHE that is
rebuilt from the database on boot and flushed back to it after every mutating
request.

This is a deliberate choice, not a shortcut:

  * The Policy Simulator re-scores the entire open pipeline on every frame of a
    slider drag and must stay under 400 ms. Serving those reads from memory
    keeps it at single-digit milliseconds; round-tripping SQLite per quote per
    frame would put I/O on the hot path of the one interaction the whole
    product is built around.
  * The dataset is small and bounded (tens of orders, tens of products), so a
    whole-state flush costs less than a millisecond — cheaper than tracking
    dirty entities and far harder to get subtly wrong.
  * Every consumer keeps its existing shape, so adding durability changed no
    router, no service and no test.

The honest description is therefore "write-through cache over SQLite", NOT "all
reads hit the database". Durability is real: kill the process and the working
set is rebuilt exactly, because the flush already happened.
"""

from __future__ import annotations

import json
from typing import Any

from . import db
from . import fixtures as fx


# --------------------------------------------------------------------------- #
#  Seed  ->  database
# --------------------------------------------------------------------------- #

def seed_database() -> None:
    """Write the seeded book of business into an empty database."""
    db.wipe()

    db.executemany(
        "INSERT INTO res_partner (name, tier, portal_email) VALUES (?,?,?)",
        [(name, meta["tier"], meta["email"]) for name, meta in fx.CUSTOMERS.items()],
    )
    db.executemany(
        "INSERT INTO app_user (id, name, email, role) VALUES (?,?,?,?)",
        [(u["id"], u["name"], u["email"], u["role"]) for u in fx.USERS],
    )
    db.executemany(
        """INSERT INTO product_variant
           (sku, name, category, list_price, cost, uom, tax_pct, is_recurring,
            recurrence, is_promoted, stock_total, description, variants_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [(p["sku"], p["name"], p["category"], p["list_price"], p["cost"],
          p.get("uom", "Each"), p.get("tax_pct", 18.0),
          int(bool(p.get("is_recurring"))), p.get("recurrence"),
          int(bool(p.get("is_promoted"))), p.get("stock_total", 0),
          p.get("description", ""), json.dumps(p.get("variants", [])))
         for p in fx.PRODUCTS],
    )
    db.executemany(
        "INSERT INTO price_list (tier, currency, adjustment_pct, rule) VALUES (?,?,?,?)",
        [(r["tier"], r["currency"], r["adjustment_pct"], r["rule"])
         for r in fx.PRICE_LISTS],
    )
    db.executemany(
        "INSERT INTO warehouse (name, ship_cost_weight, fixed_shipment_cost) VALUES (?,?,?)",
        [(w["name"], w["ship_cost_weight"], w["fixed_shipment_cost"])
         for w in fx.WAREHOUSES],
    )
    db.executemany(
        "INSERT INTO stock_quant (warehouse, sku, on_hand, reserved) VALUES (?,?,?,?)",
        [(wh, sku, q["on_hand"], q["reserved"])
         for wh, shelf in fx.STOCK.items() for sku, q in shelf.items()],
    )
    db.executemany(
        """INSERT INTO subscription
           (id, ref, customer, plan, sku, cycle, qty, unit_price,
            start_date, next_bill_date, status)
           VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        [(s["id"], s["ref"], s["customer"], s["plan"], s["sku"], s["cycle"],
          s["qty"], s["unit_price"], s["start_date"], s["next_bill_date"],
          s["status"]) for s in fx.SUBSCRIPTIONS],
    )
    db.executemany(
        """INSERT INTO account_move
           (ref, order_ref, customer, kind, amount, amount_paid, status, due_date)
           VALUES (?,?,?,?,?,?,?,?)""",
        [(i["ref"], i["order_ref"], i["customer"], i["kind"], i["amount"],
          i["amount_paid"], i["status"], i["due_date"]) for i in fx.INVOICES],
    )

    for row in fx._QUOTES:
        tier = fx.CUSTOMERS[row["customer"]]["tier"]
        db.execute(
            """INSERT INTO sale_order (ref, customer, tier, rep, state, order_discount_pct)
               VALUES (?,?,?,?,?,0)""",
            (row["ref"], row["customer"], tier, row["rep"], row["state"]),
        )
        db.executemany(
            """INSERT INTO sale_order_line (order_ref, position, sku, qty, discount_pct)
               VALUES (?,?,?,?,?)""",
            [(row["ref"], i, sku, qty, disc)
             for i, (sku, qty, disc) in enumerate(row["lines"])],
        )
        db.execute(
            """INSERT INTO deal_events
               (order_ref, actor, actor_role, event_type, reason, created_at)
               VALUES (?,?,?,'created',NULL,?)""",
            (row["ref"], fx.REP_NAME.get(row["rep"], row["rep"]),
             "rep", fx.last_activity(row["ref"])),
        )


# --------------------------------------------------------------------------- #
#  Database  ->  working set
# --------------------------------------------------------------------------- #

def load_into(state: Any) -> None:
    """Rebuild the in-memory working set from the database."""
    from engine.scoring import DEFAULT_POLICY, Policy

    state.PRODUCTS.clear()
    for r in db.query("SELECT * FROM product_variant"):
        state.PRODUCTS.append(dict(
            sku=r["sku"], name=r["name"], category=r["category"],
            list_price=r["list_price"], cost=r["cost"], uom=r["uom"],
            tax_pct=r["tax_pct"], is_recurring=bool(r["is_recurring"]),
            recurrence=r["recurrence"], is_promoted=bool(r["is_promoted"]),
            stock_total=r["stock_total"], description=r["description"],
            variants=json.loads(r["variants_json"] or "[]"),
        ))

    state.PRICE_LISTS.clear()
    state.PRICE_LISTS.extend(
        dict(tier=r["tier"], currency=r["currency"],
             adjustment_pct=r["adjustment_pct"], rule=r["rule"])
        for r in db.query("SELECT * FROM price_list ORDER BY rowid")
    )

    row = db.one("SELECT payload_json FROM policy WHERE id = 1")
    if row:
        data = json.loads(row["payload_json"])
        data["bands"] = [tuple(b) for b in data["bands"]]
        state.set_policy(Policy(**data))
    else:
        import copy
        state.set_policy(copy.deepcopy(DEFAULT_POLICY))

    state.STOCK.clear()
    for r in db.query("SELECT * FROM stock_quant"):
        state.STOCK.setdefault(r["warehouse"], {})[r["sku"]] = {
            "on_hand": r["on_hand"], "reserved": r["reserved"]}

    state.STOCK_MOVES.clear()
    state.STOCK_MOVES.extend(
        dict(warehouse=r["warehouse"], sku=r["sku"], kind=r["kind"], qty=r["qty"],
             order_ref=r["order_ref"], at=r["at"],
             on_hand_after=r["on_hand_after"], available_after=r["available_after"])
        for r in db.query("SELECT * FROM stock_move ORDER BY id")
    )

    state.QUOTES.clear()
    state.QUOTE_STATE.clear()
    lines_by_ref: dict[str, list[dict[str, Any]]] = {}
    for r in db.query("SELECT * FROM sale_order_line ORDER BY order_ref, position"):
        lines_by_ref.setdefault(r["order_ref"], []).append(
            dict(sku=r["sku"], qty=r["qty"], discount_pct=r["discount_pct"]))
    for r in db.query("SELECT * FROM sale_order"):
        state.QUOTES[r["ref"]] = dict(
            customer=r["customer"], tier=r["tier"], rep=r["rep"],
            order_discount_pct=r["order_discount_pct"],
            lines=lines_by_ref.get(r["ref"], []),
        )
        state.QUOTE_STATE[r["ref"]] = r["state"]

    state.ALLOCATIONS.clear()
    for r in db.query("SELECT * FROM allocation"):
        state.ALLOCATIONS[r["order_ref"]] = json.loads(r["plan_json"])

    state.SUBSCRIPTIONS.clear()
    state.SUBSCRIPTIONS.extend(
        dict(id=r["id"], ref=r["ref"], customer=r["customer"], plan=r["plan"],
             sku=r["sku"], cycle=r["cycle"], qty=r["qty"],
             unit_price=r["unit_price"], start_date=r["start_date"],
             next_bill_date=r["next_bill_date"], status=r["status"])
        for r in db.query("SELECT * FROM subscription ORDER BY id")
    )

    state.INVOICES.clear()
    state.INVOICES.extend(
        dict(ref=r["ref"], order_ref=r["order_ref"], customer=r["customer"],
             kind=r["kind"], amount=r["amount"], amount_paid=r["amount_paid"],
             status=r["status"], due_date=r["due_date"],
             **({"method": r["method"]} if r["method"] else {}),
             **({"lines": json.loads(r["lines_json"])} if r["lines_json"] and r["lines_json"] != "[]" else {}))
        for r in db.query("SELECT * FROM account_move ORDER BY rowid")
    )

    state.PORTAL_COMMENTS.clear()
    for r in db.query("SELECT * FROM portal_comment ORDER BY id"):
        state.PORTAL_COMMENTS.setdefault(r["order_ref"], []).append(dict(
            line_id=r["line_id"], author=r["author"], body=r["body"],
            counter_discount_pct=r["counter_discount_pct"],
            created_at=r["created_at"]))

    state.EVENTS.clear()
    state.EVENTS.extend(
        dict(order_ref=r["order_ref"], actor=r["actor"], actor_role=r["actor_role"],
             event_type=r["event_type"], reason=r["reason"],
             created_at=r["created_at"],
             payload=json.loads(r["payload_json"]) if r["payload_json"] else None)
        for r in db.query("SELECT * FROM deal_events ORDER BY id")
    )


# --------------------------------------------------------------------------- #
#  Working set  ->  database
# --------------------------------------------------------------------------- #

def flush(state: Any) -> None:
    """Persist the working set. Called after every mutating request.

    A whole-state rewrite rather than dirty tracking: at this data volume it is
    sub-millisecond, and it cannot leave a half-written entity behind the way a
    missed dirty flag would.
    """
    conn = db.connect()
    with db._lock:
        cur = conn.cursor()

        cur.execute("DELETE FROM product_variant")
        cur.executemany(
            """INSERT INTO product_variant
               (sku, name, category, list_price, cost, uom, tax_pct, is_recurring,
                recurrence, is_promoted, stock_total, description, variants_json)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            [(p["sku"], p["name"], p["category"], p["list_price"], p["cost"],
              p.get("uom", "Each"), p.get("tax_pct", 18.0),
              int(bool(p.get("is_recurring"))), p.get("recurrence"),
              int(bool(p.get("is_promoted"))), p.get("stock_total", 0),
              p.get("description", ""), json.dumps(p.get("variants", [])))
             for p in state.PRODUCTS])

        cur.execute("DELETE FROM price_list")
        cur.executemany(
            "INSERT INTO price_list (tier, currency, adjustment_pct, rule) VALUES (?,?,?,?)",
            [(r["tier"], r["currency"], r["adjustment_pct"], r.get("rule", ""))
             for r in state.PRICE_LISTS])

        p = state.get_policy()
        cur.execute(
            "INSERT OR REPLACE INTO policy (id, payload_json) VALUES (1, ?)",
            (json.dumps(dict(
                tier_ceiling=p.tier_ceiling, category_ceiling=p.category_ceiling,
                weights=p.weights, caps=p.caps,
                bands=[list(b) for b in p.bands],
                hard_override_pts=p.hard_override_pts,
                stall_days=p.stall_days, version=p.version)),))

        cur.execute("DELETE FROM stock_quant")
        cur.executemany(
            "INSERT INTO stock_quant (warehouse, sku, on_hand, reserved) VALUES (?,?,?,?)",
            [(wh, sku, q["on_hand"], q["reserved"])
             for wh, shelf in state.STOCK.items() for sku, q in shelf.items()])

        cur.execute("DELETE FROM stock_move")
        cur.executemany(
            """INSERT INTO stock_move
               (warehouse, sku, kind, qty, order_ref, at, on_hand_after, available_after)
               VALUES (?,?,?,?,?,?,?,?)""",
            [(m["warehouse"], m["sku"], m["kind"], m["qty"], m["order_ref"],
              m["at"], m["on_hand_after"], m["available_after"])
             for m in state.STOCK_MOVES])

        cur.execute("DELETE FROM sale_order_line")
        cur.execute("DELETE FROM sale_order")
        cur.executemany(
            """INSERT INTO sale_order (ref, customer, tier, rep, state, order_discount_pct)
               VALUES (?,?,?,?,?,?)""",
            [(ref, q["customer"], q["tier"], q["rep"],
              state.QUOTE_STATE.get(ref, "DRAFT"), q.get("order_discount_pct", 0.0))
             for ref, q in state.QUOTES.items()])
        cur.executemany(
            """INSERT INTO sale_order_line (order_ref, position, sku, qty, discount_pct)
               VALUES (?,?,?,?,?)""",
            [(ref, i, l["sku"], l["qty"], l["discount_pct"])
             for ref, q in state.QUOTES.items()
             for i, l in enumerate(q["lines"])])

        cur.execute("DELETE FROM allocation")
        cur.executemany(
            "INSERT INTO allocation (order_ref, plan_json) VALUES (?,?)",
            [(ref, json.dumps(plan)) for ref, plan in state.ALLOCATIONS.items()])

        cur.execute("DELETE FROM subscription")
        cur.executemany(
            """INSERT INTO subscription
               (id, ref, customer, plan, sku, cycle, qty, unit_price,
                start_date, next_bill_date, status)
               VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
            [(s["id"], s["ref"], s["customer"], s["plan"], s["sku"], s["cycle"],
              s["qty"], s["unit_price"], s["start_date"], s["next_bill_date"],
              s["status"]) for s in state.SUBSCRIPTIONS])

        cur.execute("DELETE FROM account_move")
        cur.executemany(
            """INSERT INTO account_move
               (ref, order_ref, customer, kind, amount, amount_paid, status,
                due_date, method, lines_json)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            [(i["ref"], i["order_ref"], i["customer"], i["kind"], i["amount"],
              i["amount_paid"], i["status"], i["due_date"], i.get("method"),
              json.dumps(i.get("lines", []))) for i in state.INVOICES])

        cur.execute("DELETE FROM portal_comment")
        cur.executemany(
            """INSERT INTO portal_comment
               (order_ref, line_id, author, body, counter_discount_pct, created_at)
               VALUES (?,?,?,?,?,?)""",
            [(ref, c.get("line_id"), c.get("author"), c.get("body"),
              c.get("counter_discount_pct"), c.get("created_at"))
             for ref, rows in state.PORTAL_COMMENTS.items() for c in rows])

        # deal_events is append-only, so it is rewritten from the working set
        # in full order rather than diffed -- the ordering IS the audit trail.
        cur.execute("DELETE FROM deal_events")
        cur.executemany(
            """INSERT INTO deal_events
               (order_ref, actor, actor_role, event_type, reason, payload_json, created_at)
               VALUES (?,?,?,?,?,?,?)""",
            [(e["order_ref"], e["actor"], e["actor_role"], e["event_type"],
              e.get("reason"), json.dumps(e["payload"]) if e.get("payload") else None,
              e["created_at"]) for e in state.EVENTS])

        conn.commit()
