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

from api.auth import issue_token   # noqa: E402

# Signed session headers per role, matching the seeded users.
REP = {"Authorization": f"Bearer {issue_token('rep_rao', 'rep')}"}
MANAGER = {"Authorization": f"Bearer {issue_token('rep_shah', 'manager')}"}
FINANCE = {"Authorization": f"Bearer {issue_token('fin_menon', 'finance')}"}
ADMIN = {"Authorization": f"Bearer {issue_token('admin', 'admin')}"}
