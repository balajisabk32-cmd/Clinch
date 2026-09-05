"""
SQLite persistence.

WHY STDLIB sqlite3 AND NOT AN ORM
---------------------------------
The schema is twenty small tables that we own completely, the queries are all
single-table reads and writes, and we have already lost time once to a pinned
dependency conflict (fastapi/starlette). An ORM would add a second version
constraint on pydantic for no expressive gain here. CLINCH.md's "Do NOT Build"
list rules out a migration framework for the same reason: this schema is not in
production, so drop-and-reseed is the correct migration strategy.

WHY SQLITE AND NOT POSTGRES
---------------------------
No service to start, no credentials, no container that can fail to come up at
hour 23 — and the seeded .db file is a committable artefact, so any laptop
reproduces the exact demo state. The DDL stays Postgres-portable so "change the
connection string" remains an honest claim rather than a hopeful one.

THREADING
---------
FastAPI runs sync endpoints in a worker threadpool, so more than one thread will
touch this connection. `check_same_thread=False` permits that, and every write
goes through a re-entrant lock; WAL mode lets readers proceed during a write
instead of blocking on it.
"""

from __future__ import annotations

import sqlite3
import threading
from pathlib import Path
from typing import Any, Iterable, Sequence

import os

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
# CLINCH_DB lets a test run point at its own file. Without it, pytest and a
# running dev server share one database and fight over the same Windows file
# handles -- which shows up as PermissionError on the -wal file, not as
# anything that looks like a database problem.
DB_PATH = Path(os.environ.get("CLINCH_DB") or (DATA_DIR / "clinch.db"))
GOLDEN_PATH = DB_PATH.with_name(DB_PATH.stem + "_golden.db")

_lock = threading.RLock()
_conn: sqlite3.Connection | None = None


# --------------------------------------------------------------------------- #
#  Schema. Entity names mirror the standard ERP object graph (ARCHITECTURE.md §8)
#  so anyone from that world reads this and immediately knows what it is.
# --------------------------------------------------------------------------- #

SCHEMA = """
CREATE TABLE IF NOT EXISTS res_partner (
  name TEXT PRIMARY KEY, tier TEXT NOT NULL,
  currency TEXT DEFAULT 'INR', portal_email TEXT);

CREATE TABLE IF NOT EXISTS app_user (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','manager','finance','rep','customer')),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_login_at TEXT);
CREATE UNIQUE INDEX IF NOT EXISTS ux_app_user_email ON app_user(email);

CREATE TABLE IF NOT EXISTS product_variant (
  sku TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
  list_price REAL NOT NULL, cost REAL NOT NULL,
  uom TEXT DEFAULT 'Each', tax_pct REAL DEFAULT 18.0,
  is_recurring INTEGER DEFAULT 0, recurrence TEXT,
  is_promoted INTEGER DEFAULT 0, stock_total INTEGER DEFAULT 0,
  description TEXT, variants_json TEXT DEFAULT '[]');

CREATE TABLE IF NOT EXISTS price_list (
  tier TEXT NOT NULL, currency TEXT NOT NULL,
  adjustment_pct REAL DEFAULT 0, rule TEXT,
  PRIMARY KEY (tier, currency));

CREATE TABLE IF NOT EXISTS policy (
  id INTEGER PRIMARY KEY CHECK (id = 1), payload_json TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS warehouse (
  name TEXT PRIMARY KEY, ship_cost_weight REAL, fixed_shipment_cost REAL);

CREATE TABLE IF NOT EXISTS stock_quant (
  warehouse TEXT NOT NULL, sku TEXT NOT NULL,
  on_hand INTEGER DEFAULT 0, reserved INTEGER DEFAULT 0,
  PRIMARY KEY (warehouse, sku));

CREATE TABLE IF NOT EXISTS stock_move (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  warehouse TEXT, sku TEXT, kind TEXT, qty INTEGER,
  order_ref TEXT, at TEXT, on_hand_after INTEGER, available_after INTEGER);

CREATE TABLE IF NOT EXISTS sale_order (
  ref TEXT PRIMARY KEY, customer TEXT NOT NULL, tier TEXT NOT NULL,
  rep TEXT NOT NULL, state TEXT NOT NULL,
  order_discount_pct REAL DEFAULT 0,
  currency TEXT DEFAULT 'INR', fx_rate_to_base REAL DEFAULT 1.0);

CREATE TABLE IF NOT EXISTS sale_order_line (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref TEXT NOT NULL, position INTEGER NOT NULL,
  sku TEXT NOT NULL, qty INTEGER NOT NULL, discount_pct REAL DEFAULT 0,
  FOREIGN KEY (order_ref) REFERENCES sale_order(ref) ON DELETE CASCADE);
CREATE INDEX IF NOT EXISTS ix_line_order ON sale_order_line(order_ref, position);

CREATE TABLE IF NOT EXISTS allocation (
  order_ref TEXT PRIMARY KEY, plan_json TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS subscription (
  id INTEGER PRIMARY KEY, ref TEXT, customer TEXT, plan TEXT, sku TEXT,
  cycle TEXT, qty INTEGER, unit_price REAL,
  start_date TEXT, next_bill_date TEXT, status TEXT);

CREATE TABLE IF NOT EXISTS account_move (
  ref TEXT PRIMARY KEY, order_ref TEXT, customer TEXT, kind TEXT,
  amount REAL, amount_paid REAL DEFAULT 0, status TEXT,
  due_date TEXT, method TEXT, lines_json TEXT DEFAULT '[]');

CREATE TABLE IF NOT EXISTS portal_comment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref TEXT NOT NULL, line_id INTEGER, author TEXT, body TEXT,
  counter_discount_pct REAL, created_at TEXT);

-- THE AUDIT SPINE. Append-only: never UPDATE, never DELETE (PS A3).
CREATE TABLE IF NOT EXISTS deal_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_ref TEXT, actor TEXT, actor_role TEXT, event_type TEXT,
  reason TEXT, payload_json TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_events_order ON deal_events(order_ref, created_at);
"""


def connect() -> sqlite3.Connection:
    """Open (or reuse) the connection. WAL so readers never block on a writer."""
    global _conn
    with _lock:
        if _conn is None:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            _conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=30.0)
            _conn.row_factory = sqlite3.Row
            _conn.execute("PRAGMA journal_mode=WAL")
            _conn.execute("PRAGMA foreign_keys=ON")
            _conn.execute("PRAGMA synchronous=NORMAL")
            _conn.executescript(SCHEMA)
            _conn.commit()
            migrate(_conn)
        return _conn


def migrate(conn: sqlite3.Connection) -> None:
    """Bring an existing database up to the current schema.

    CREATE TABLE IF NOT EXISTS is a no-op against a table that already exists,
    so a shipped schema change would silently do nothing on any deployment that
    had run before -- the failure then surfaces much later as "no such column",
    far from its cause. This runs on every connect and is idempotent.
    """
    def columns(table: str) -> set[str]:
        return {r["name"] for r in conn.execute(f"PRAGMA table_info({table})")}

    # app_user gained credentials. Rows written before that had no password at
    # all and could never authenticate, so recreating the table loses nothing
    # real -- and it avoids SQLite's refusal to add NOT NULL columns without a
    # default. Accounts are re-provisioned by seed_users.py.
    existing = columns("app_user")
    if existing and "password_hash" not in existing:
        conn.execute("DROP TABLE app_user")
        conn.executescript(SCHEMA)
        conn.commit()


def close() -> None:
    global _conn
    with _lock:
        if _conn is not None:
            _conn.close()
            _conn = None


# --------------------------------------------------------------------------- #
#  Thin query helpers. Deliberately small: the point of choosing stdlib was to
#  keep the data layer legible, not to grow a private ORM.
# --------------------------------------------------------------------------- #

def query(sql: str, params: Sequence[Any] = ()) -> list[sqlite3.Row]:
    with _lock:
        return connect().execute(sql, params).fetchall()


def one(sql: str, params: Sequence[Any] = ()) -> sqlite3.Row | None:
    with _lock:
        return connect().execute(sql, params).fetchone()


def execute(sql: str, params: Sequence[Any] = ()) -> sqlite3.Cursor:
    with _lock:
        conn = connect()
        cur = conn.execute(sql, params)
        conn.commit()
        return cur


def executemany(sql: str, rows: Iterable[Sequence[Any]]) -> None:
    with _lock:
        conn = connect()
        conn.executemany(sql, rows)
        conn.commit()


def wipe() -> None:
    """Empty every table without dropping the schema."""
    with _lock:
        conn = connect()
        # app_user is deliberately absent: `reset()` restores demo DATA, and
        # wiping the credential table would sign everyone out and delete the
        # only administrator every time someone pressed the reset button.
        for t in ("deal_events", "portal_comment", "account_move", "subscription",
                  "allocation", "sale_order_line", "sale_order", "stock_move",
                  "stock_quant", "warehouse", "policy", "price_list",
                  "product_variant", "res_partner"):
            conn.execute(f"DELETE FROM {t}")
        conn.execute("DELETE FROM sqlite_sequence")
        conn.commit()


# --------------------------------------------------------------------------- #
#  Golden snapshot.
#
#  `POST /admin/reset` is a demo guardrail, so restoring must be a file copy
#  rather than a re-seed: copying a few hundred KB is bounded and predictable,
#  whereas regenerating rows leaves room for the reset itself to fail in front
#  of an audience.
# --------------------------------------------------------------------------- #

def save_golden() -> Path:
    """Snapshot via SQLite's own backup API.

    Not a file copy: copying the .db while a WAL exists either misses the most
    recent commits or captures a torn pair of files. backup() is transactional
    and understands WAL, so the snapshot is always consistent.
    """
    with _lock:
        source = connect()
        source.commit()
        target = sqlite3.connect(GOLDEN_PATH)
        try:
            source.backup(target)
            target.commit()
        finally:
            target.close()
    return GOLDEN_PATH


def restore_golden() -> bool:
    """Restore the working database from the golden snapshot.

    Also backup()-based, and deliberately so. The previous implementation closed
    the connection, copied the file, and deleted the -wal/-shm sidecars -- which
    throws PermissionError on Windows the moment any other process has them
    open, and risks pairing a fresh database with a stale WAL if the delete
    half-succeeds. backup() replaces the contents in place, needs no file
    handles of its own, and is safe with other readers attached.
    """
    if not GOLDEN_PATH.exists():
        return False
    with _lock:
        source = sqlite3.connect(GOLDEN_PATH)
        try:
            source.backup(connect())
            connect().commit()
        finally:
            source.close()
    return True


def has_data() -> bool:
    row = one("SELECT COUNT(*) AS n FROM sale_order")
    return bool(row and row["n"])
