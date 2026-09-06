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

from . import billing
from . import db
from . import fixtures as fx


# --------------------------------------------------------------------------- #
#  Seed  ->  database
# --------------------------------------------------------------------------- #

def ensure_catalogue() -> None:
    """Re-assert the fixture catalogue over whatever the database holds.

    The product master is defined in code (fx.PRODUCTS) and cached in
    product_variant. seed_database() only writes it into an EMPTY database, so
    after any catalogue change -- a rename, a repricing, adding photography --
    the two silently disagreed and the database won. That is how the storefront
    ended up quoting a laptop at the old toy price with no image, against a
    fixtures file that had said otherwise for an hour.

    UPSERT rather than replace: rows an administrator created at runtime are not
    in fx.PRODUCTS and must survive. Stock is deliberately NOT overwritten --
    stock_quant is live operational data, not catalogue reference data, and
    resetting it on every boot would undo real movements.
    """
    for p in fx.PRODUCTS:
        db.execute(
            """INSERT INTO product_variant
                 (sku, name, category, list_price, cost, uom, tax_pct,
                  is_recurring, recurrence, is_promoted, stock_total,
                  description, variants_json, image)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
               ON CONFLICT(sku) DO UPDATE SET
                 name          = excluded.name,
                 category      = excluded.category,
                 list_price    = excluded.list_price,
                 cost          = excluded.cost,
                 uom           = excluded.uom,
                 tax_pct       = excluded.tax_pct,
                 is_recurring  = excluded.is_recurring,
                 recurrence    = excluded.recurrence,
                 is_promoted   = excluded.is_promoted,
                 description   = excluded.description,
                 variants_json = excluded.variants_json,
                 image         = excluded.image""",
            (p["sku"], p["name"], p["category"], p["list_price"], p["cost"],
             p.get("uom", "Each"), p.get("tax_pct", 18.0),
             int(bool(p.get("is_recurring"))), p.get("recurrence"),
             int(bool(p.get("is_promoted"))), p.get("stock_total", 0),
             p.get("description", ""), json.dumps(p.get("variants", [])),
             p.get("image")),
        )


def ensure_reference_data() -> None:
    """Reference rows that must exist in every database, always.

    Separate from seed_database() because that only runs against an EMPTY
    database. Subscription plans are the price book the recurring SKUs are sold
    against, so they have to survive three things seed_database() does not
    cover: a database that was already seeded before plans existed, a golden
    snapshot restored by /admin/reset that predates them, and a fresh migration
    on an existing deployment. INSERT OR IGNORE on the unique code makes
    calling this on every boot free.
    """
    ensure_catalogue()

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    db.executemany(
        """INSERT OR IGNORE INTO subscription_plan
             (name, code, billing_cycle, base_price, proration_rule,
              cancellation_notice_days, is_active, created_at)
           VALUES (?,?,?,?,?,?,1,?)""",
        [(n, c, cyc, price, rule, notice, now)
         for n, c, cyc, price, rule, notice in [
            ("Enterprise Cloud Tier", "ENT-CLOUD",  "yearly",    180000.0, "calendar_daily", 60),
            ("Pro Seat",              "PRO-SEAT",   "monthly",      960.0, "calendar_daily", 30),
            ("CloudSync Storage",     "CLOUD-SYNC", "monthly",       60.0, "calendar_daily", 30),
            ("Admin Support SLA",     "SLA-GOLD",   "quarterly",  15400.0, "full_period",    90),
            ("Care Plan 2yr",         "CARE-2YR",   "yearly",      3240.0, "none",           30),
         ]],
    )

    # Ensure all enterprise customers from the seeded quote book exist
    from core.security import hash_password
    default_pass_hash = hash_password("password123")

    SEEDED_CUSTOMERS = [
        dict(id="customer_rajesh",    name="Rajesh Kumar",      email="rajesh@acme.com",        company="Acme Corp",       tier="Gold",   rep="rep_rao",    city="Bengaluru", ltv=242815.0),
        dict(id="customer_vikram",    name="Vikram Malhotra",   email="buying@beta.example",     company="Beta Industries", tier="Gold",   rep="rep_rao",    city="Mumbai",    ltv=489200.0),
        dict(id="customer_ananya",    name="Ananya Sen",        email="it@novaretail.example",   company="Nova Retail",     tier="Silver", rep="rep_nair",   city="Kolkata",   ltv=310500.0),
        dict(id="customer_arjun",     name="Arjun Kapoor",      email="proc@zenith.example",     company="Zenith Co",       tier="Silver", rep="rep_bhatia", city="Delhi",     ltv=295400.0),
        dict(id="customer_kavita",    name="Kavita Reddy",      email="admin@delta.example",     company="Delta LLC",       tier="Bronze", rep="rep_reddy",  city="Hyderabad", ltv=145000.0),
        dict(id="customer_sameer",    name="Sameer Verma",      email="pm@orion.example",        company="Orion Systems",   tier="Gold",   rep="rep_chopra", city="Pune",      ltv=520000.0),
        dict(id="customer_siddharth", name="Dr. Siddharth Roy", email="lab@vertex.example",      company="Vertex Labs",     tier="Silver", rep="rep_sen",    city="Bengaluru", ltv=585586.0),
    ]

    for c in SEEDED_CUSTOMERS:
        if not db.one("SELECT id FROM app_user WHERE id = ?", (c["id"],)):
            db.execute(
                """INSERT INTO app_user (id, name, email, password_hash, role, is_active, created_at)
                   VALUES (?, ?, ?, ?, 'customer', 1, ?)""",
                (c["id"], c["name"], c["email"], default_pass_hash, now)
            )
        db.execute(
            """INSERT OR IGNORE INTO customer_account
                 (user_id, company, gst_number, phone, address, city, postcode,
                  tier, tier_locked, lifetime_value, assigned_rep, created_at)
               VALUES (?, ?, '29ABCDE1234F1Z5', '+91 98450 11223',
                       'Plot 42, Tech Park', ?, '560100',
                       ?, 1, ?, ?, ?)""",
            (c["id"], c["company"], c["city"], c["tier"], c["ltv"], c["rep"], now)
        )


def seed_database() -> None:
    """Write the seeded book of business into an empty database."""
    db.wipe()

    db.executemany(
        "INSERT INTO res_partner (name, tier, portal_email) VALUES (?,?,?)",
        [(name, meta["tier"], meta["email"]) for name, meta in fx.CUSTOMERS.items()],
    )
    # Accounts are NOT seeded from fixtures: they carry password hashes and are
    # provisioned by seed.py / the admin console instead. Re-seeding them here
    # would overwrite real credentials with role rows that cannot log in.
    db.executemany(
        """INSERT INTO product_variant
           (sku, name, category, list_price, cost, uom, tax_pct, is_recurring,
            recurrence, is_promoted, stock_total, description, variants_json, image)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
        [(p["sku"], p["name"], p["category"], p["list_price"], p["cost"],
          p.get("uom", "Each"), p.get("tax_pct", 18.0),
          int(bool(p.get("is_recurring"))), p.get("recurrence"),
          int(bool(p.get("is_promoted"))), p.get("stock_total", 0),
          p.get("description", ""), json.dumps(p.get("variants", [])),
          p.get("image"))
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
           (ref, order_ref, customer, kind, amount, amount_paid, status,
            due_date, method, paid_at, last_payment_at, payments_json)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)""",
        # Settlement detail is seeded too. Dropping it meant a seeded "paid"
        # invoice knew it was paid but not when, how, or by whom -- and the
        # printed invoice read "Settled in full on  at  via".
        [(i["ref"], i["order_ref"], i["customer"], i["kind"], i["amount"],
          i["amount_paid"], i["status"], i["due_date"], i.get("method"),
          i.get("paid_at"), i.get("last_payment_at"),
          json.dumps(i.get("payments", []))) for i in fx.INVOICES],
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
            image=r["image"] if "image" in r.keys() else None,
        ))
    state.sync_by_sku()

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
        keys = r.keys()
        state.QUOTES[r["ref"]] = dict(
            customer=r["customer"], tier=r["tier"], rep=r["rep"],
            order_discount_pct=r["order_discount_pct"],
            lines=lines_by_ref.get(r["ref"], []),
            # Guarded with `in keys` so a database written before the approval
            # columns existed still loads: migrate() adds them on connect, but
            # a golden snapshot restored mid-session can be older than that.
            approved_by_id=r["approved_by_id"] if "approved_by_id" in keys else None,
            approved_by_name=r["approved_by_name"] if "approved_by_name" in keys else None,
            approved_by_role=r["approved_by_role"] if "approved_by_role" in keys else None,
            approved_at=r["approved_at"] if "approved_at" in keys else None,
            manager_revision_notes=(r["manager_revision_notes"]
                                    if "manager_revision_notes" in keys else None),
            revision_requested=bool(r["revision_requested"])
                               if "revision_requested" in keys else False,
            sent_snapshot=json.loads(r["sent_snapshot_json"] or "[]")
                          if "sent_snapshot_json" in keys else [],
            revision_count=int(r["revision_count"] or 0)
                           if "revision_count" in keys else 0,
            source=r["source"] if "source" in keys else None,
        )
        state.QUOTE_STATE[r["ref"]] = r["state"]

    highest_ref = 1055
    for ref_str in state.QUOTES:
        if ref_str.startswith("Q-"):
            try:
                num = int(ref_str.split("-")[1])
                if num > highest_ref:
                    highest_ref = num
            except (ValueError, IndexError):
                pass
    if hasattr(state, "_next_ref"):
        state._next_ref[0] = max(state._next_ref[0], highest_ref)

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
             **({"method": r["method"],
                 "method_label": billing.PAYMENT_METHODS.get(r["method"], r["method"])}
                if r["method"] else {}),
             **({"paid_at": r["paid_at"]} if _col(r, "paid_at") else {}),
             **({"last_payment_at": r["last_payment_at"]}
                if _col(r, "last_payment_at") else {}),
             **({"payments": json.loads(r["payments_json"])}
                if _col(r, "payments_json") and r["payments_json"] not in (None, "[]") else {}),
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

    # Resume the reference counter above the highest ref on file.
    #
    # It was left at its module default (1055) on every restart, while the
    # quotations loaded from the database ran well past that. The next quote a
    # rep created was therefore issued a reference that ALREADY EXISTED, and
    # `QUOTES[ref] = ...` overwrote a live deal in place -- its customer, its
    # lines and its approval state replaced silently, with the old invoice still
    # pointing at the reference. Durable data made this worse, not better: the
    # longer the database lived, the more quotes there were to collide with.
    highest = 0
    for ref in state.QUOTES:
        _, _, tail = ref.partition("-")
        if tail.isdigit():
            highest = max(highest, int(tail))
    if highest:
        state._next_ref[0] = max(state._next_ref[0], highest)


# --------------------------------------------------------------------------- #
#  Working set  ->  database
# --------------------------------------------------------------------------- #

def _col(row, name: str) -> Any:
    """Read a column that may not exist on an older row.

    sqlite3.Row raises IndexError for an unknown key rather than returning
    None, so a database that has not been migrated yet would blow up on load
    instead of simply having no settlement detail.
    """
    try:
        return row[name]
    except (IndexError, KeyError):
        return None


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
                recurrence, is_promoted, stock_total, description, variants_json, image)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            [(p["sku"], p["name"], p["category"], p["list_price"], p["cost"],
              p.get("uom", "Each"), p.get("tax_pct", 18.0),
              int(bool(p.get("is_recurring"))), p.get("recurrence"),
              int(bool(p.get("is_promoted"))), p.get("stock_total", 0),
              p.get("description", ""), json.dumps(p.get("variants", [])),
              p.get("image"))
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
            """INSERT INTO sale_order
                 (ref, customer, tier, rep, state, order_discount_pct,
                  approved_by_id, approved_by_name, approved_by_role, approved_at,
                  manager_revision_notes, revision_requested,
                  sent_snapshot_json, revision_count, source)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            [(ref, q["customer"], q["tier"], q["rep"],
              state.QUOTE_STATE.get(ref, "DRAFT"), q.get("order_discount_pct", 0.0),
              q.get("approved_by_id"), q.get("approved_by_name"),
              q.get("approved_by_role"), q.get("approved_at"),
              q.get("manager_revision_notes"), 1 if q.get("revision_requested") else 0,
              json.dumps(q.get("sent_snapshot") or []), int(q.get("revision_count", 0)),
              q.get("source"))
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
                due_date, method, lines_json, paid_at, last_payment_at,
                payments_json)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)""",
            [(i["ref"], i["order_ref"], i["customer"], i["kind"], i["amount"],
              i["amount_paid"], i["status"], i["due_date"], i.get("method"),
              json.dumps(i.get("lines", [])), i.get("paid_at"),
              i.get("last_payment_at"), json.dumps(i.get("payments", [])))
             for i in state.INVOICES])

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
