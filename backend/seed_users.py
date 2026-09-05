"""
Account provisioning for a clean deployment.

    python seed_users.py            # create any missing accounts
    python seed_users.py --force    # also reset existing passwords

There is no public signup anywhere in this system, so a fresh database with no
users is unusable: nobody could log in to provision the first person. This
script solves exactly that bootstrap problem and nothing else.

The demo accounts below exist so the walkthrough is drivable. In a real
deployment you would seed ONLY the superadmin and provision the rest through the
admin console, which is precisely why the credentials are printed rather than
hidden: a password you can see is one you remember to change.
"""

from __future__ import annotations

import argparse
import sys

sys.path.insert(0, ".")

from api import db, users                                    # noqa: E402
from core.security import validate_password_strength         # noqa: E402

SUPERADMIN = dict(
    id="admin_root",
    name="Clinch Superadmin",
    email="admin@clinch.io",
    password="ClinchAdmin2026!#",
    role="admin",
)

# Demo operators, one per internal role, so each permission boundary can be
# exercised without an admin having to create three accounts by hand first.
DEMO_USERS = [
    dict(id="rep_rao", name="A. Rao", email="rao@clinch.io",
         password="RepRao2026!#", role="rep"),
    dict(id="mgr_shah", name="M. Shah", email="shah@clinch.io",
         password="MgrShah2026!#", role="manager"),
    dict(id="fin_menon", name="R. Menon", email="menon@clinch.io",
         password="FinMenon2026!#", role="finance"),
]


def provision(spec: dict[str, str], force: bool) -> str:
    existing = users.by_email(spec["email"])
    if existing and not force:
        return "exists"
    if existing:
        users.set_password(existing["id"], spec["password"])
        users.set_active(existing["id"], True)
        return "reset"

    # Never seed a credential the API itself would reject -- that would ship a
    # password the admin console could not recreate.
    ok, problems = validate_password_strength(spec["password"])
    if not ok:
        raise SystemExit(f"Seed password for {spec['email']} violates policy: {problems}")

    users.create(spec["name"], spec["email"], spec["password"],
                 spec["role"], user_id=spec.get("id"))
    return "created"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true",
                    help="reset passwords on accounts that already exist")
    ap.add_argument("--admin-only", action="store_true",
                    help="provision only the superadmin (production posture)")
    args = ap.parse_args()

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    db.connect()
    specs = [SUPERADMIN] + ([] if args.admin_only else DEMO_USERS)

    print("\nClinch — account provisioning")
    print("-" * 78)
    for spec in specs:
        outcome = provision(spec, args.force)
        print(f"  [{outcome:>7}]  {spec['role']:<8} {spec['email']:<22} {spec['password']}")
    print("-" * 78)
    print(f"  {users.count()} account(s) in the database.")
    print("  Passwords are bcrypt-hashed; these plaintexts are printed once, here.")
    print("  Change them before any real deployment.\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
