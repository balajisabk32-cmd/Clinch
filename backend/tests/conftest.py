"""Shared auth helpers.

Sensitive endpoints are permission-gated server-side, so tests must present the
role that would really be doing the action. Driving finance endpoints as a rep
and expecting them to work would be testing a system we do not ship.
"""

import os
import pathlib
import sys

sys.path.insert(0, ".")

# Point the test run at its OWN database file before anything imports api.db.
# Sharing one file with a running dev server makes Windows refuse the -wal
# handle, which surfaces as PermissionError rather than as anything that looks
# like a database problem -- and it lets a test run stomp on demo data.
os.environ.setdefault("CLINCH_DB", str(
    pathlib.Path(__file__).resolve().parent.parent / "data" / "clinch_test.db"))

from api import db, users                       # noqa: E402
from core.security import create_access_token   # noqa: E402

# Real accounts with real bcrypt hashes, then real JWTs -- the same path a
# browser takes. Fabricating a token here would test a door we do not ship.
TEST_ACCOUNTS = [
    ("admin_root", "Clinch Superadmin", "admin@clinch.io",  "ClinchAdmin2026!#", "admin"),
    ("rep_rao",    "A. Rao",            "rao@clinch.io",    "RepRao2026!#",      "rep"),
    ("mgr_shah",   "M. Shah",           "shah@clinch.io",   "MgrShah2026!#",     "manager"),
    ("fin_menon",  "R. Menon",          "menon@clinch.io",  "FinMenon2026!#",    "finance"),
]


def _provision() -> dict[str, dict[str, str]]:
    db.connect()
    headers = {}
    for uid, name, email, password, role in TEST_ACCOUNTS:
        if not users.by_email(email):
            users.create(name, email, password, role, user_id=uid)
        token = create_access_token({"sub": uid, "email": email, "role": role})
        headers[role] = {"Authorization": f"Bearer {token}"}
    return headers


import pytest

_H = _provision()
REP, MANAGER, FINANCE, ADMIN = _H["rep"], _H["manager"], _H["finance"], _H["admin"]


@pytest.fixture(autouse=True)
def ensure_test_accounts():
    db.connect()
    for uid, name, email, password, role in TEST_ACCOUNTS:
        if not users.by_email(email):
            users.create(name, email, password, role, user_id=uid)
