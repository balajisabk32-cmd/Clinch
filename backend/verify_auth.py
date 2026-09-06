"""Live auth verification -- drives the running server over real HTTP.

Run the API on :8200, then:  python backend/verify_auth.py
Unlike the pytest suite (which uses TestClient in-process), this proves the
deployed server refuses what it should refuse.
"""
import json, urllib.request, urllib.error, time, uuid

BASE = "http://127.0.0.1:8200"
ok = fail = 0

def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token: req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=10) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read() or b"null")
        except Exception: return e.code, None

def check(label, got, want):
    global ok, fail
    good = got == want
    ok, fail = ok + good, fail + (not good)
    print(f"  [{'PASS' if good else 'FAIL'}] {label}  (got {got}, want {want})")

for _ in range(40):
    try:
        urllib.request.urlopen(BASE + "/health", timeout=2); break
    except urllib.error.HTTPError: break
    except Exception: time.sleep(0.5)

print("\n1. Login")
s, body = call("POST", "/auth/login", {"email": "admin@clinch.io", "password": "ClinchAdmin2026!#"})
check("admin, correct password -> 200", s, 200)
admin_tok = body["access_token"] if s == 200 else None
print(f"       admin tabs: {[t['label'] for t in (body or {}).get('tabs', [])]}")
check("admin, WRONG password -> 401",
      call("POST", "/auth/login", {"email": "admin@clinch.io", "password": "wrong-password"})[0], 401)
check("unknown email -> 401",
      call("POST", "/auth/login", {"email": "nobody@clinch.io", "password": "ClinchAdmin2026!#"})[0], 401)
check("email case-insensitive -> 200",
      call("POST", "/auth/login", {"email": "ADMIN@CLINCH.IO", "password": "ClinchAdmin2026!#"})[0], 200)

s, body = call("POST", "/auth/login", {"email": "rao@clinch.io", "password": "RepRao2026!#"})
check("rep login -> 200", s, 200)
rep_tok = body["access_token"] if s == 200 else None
print(f"       rep tabs:   {[t['label'] for t in (body or {}).get('tabs', [])]}")
s, body = call("POST", "/auth/login", {"email": "menon@clinch.io", "password": "FinMenon2026!#"})
check("finance login -> 200", s, 200)
fin_tok = body["access_token"] if s == 200 else None

print("\n2. Admin provisioning is admin-only")
uniq = uuid.uuid4().hex[:8]
new_mgr = {"name": "Priya Nair", "email": f"priya.{uniq}@clinch.io",
           "password": "MgrPriya2026!#", "role": "manager"}
check("rep POST /admin/users -> 403", call("POST", "/admin/users", new_mgr, rep_tok)[0], 403)
check("finance POST /admin/users -> 403", call("POST", "/admin/users", new_mgr, fin_tok)[0], 403)
check("anonymous POST /admin/users -> 401", call("POST", "/admin/users", new_mgr)[0], 401)
check("rep GET /admin/users -> 403", call("GET", "/admin/users", None, rep_tok)[0], 403)

print("\n3. Password policy enforced server-side (not just in the form)")
for bad, why in [("alllowercase1!", "no uppercase"), ("ALLUPPERCASE1!", "no lowercase"),
                 ("NoDigitsHere!", "no number"), ("NoSpecial2026", "no special"),
                 ("Ab1!", "too short")]:
    check(f"reject weak password ({why}) -> 422",
          call("POST", "/admin/users", {**new_mgr, "password": bad}, admin_tok)[0], 422)

print("\n4. Admin creates a manager; the manager can log in immediately")
s, created = call("POST", "/admin/users", new_mgr, admin_tok)
check("admin POST /admin/users -> 201", s, 201)
s, mb = call("POST", "/auth/login", {"email": new_mgr["email"], "password": new_mgr["password"]})
check("brand-new manager logs in -> 200", s, 200)
mgr_tok = mb["access_token"] if s == 200 else None
check("duplicate email rejected -> 409", call("POST", "/admin/users", new_mgr, admin_tok)[0], 409)

print("\n5. Role boundaries on real endpoints")
check("manager GET /approvals -> 200", call("GET", "/approvals", None, mgr_tok)[0], 200)
# The approvals DESK is a reviewer tool and reps no longer hold
# fulfilment/approval visibility on it. Reps still track the status of their own
# work from the quotations list, which is what the PS asks for -- this endpoint
# is the queue a reviewer works, not a status board.
check("rep GET /approvals -> 403 (the desk is a reviewer tool)",
      call("GET", "/approvals", None, rep_tok)[0], 403)
check("rep GET /invoices -> 403 (money is not a rep's to see)",
      call("GET", "/invoices", None, rep_tok)[0], 403)
check("rep GET /subscriptions -> 403", call("GET", "/subscriptions", None, rep_tok)[0], 403)
check("manager POST /products -> 403 (admin owns the catalogue)",
      call("POST", "/products", {"sku": f"X-{uniq}", "name": "X", "category": "Hardware",
                                 "list_price": 100, "unit_cost": 50}, mgr_tok)[0], 403)
check("finance PUT /policy -> 403 (finance may not rewrite the rules it settles under)",
      call("PUT", "/policy", {"category_ceiling": {"Services": 99.0}}, fin_tok)[0], 403)
check("rep POST /admin/reset -> 403", call("POST", "/admin/reset", {}, rep_tok)[0], 403)

print("\n6. Reads are no longer anonymous")
for path in ["/quotes", "/approvals", "/products", "/dashboard", "/warehouses", "/invoices"]:
    check(f"anonymous GET {path} -> 401", call("GET", path)[0], 401)
check("anonymous POST /admin/reset -> 401", call("POST", "/admin/reset", {})[0], 401)

print("\n7. Token integrity")
check("no token -> 401", call("GET", "/auth/me")[0], 401)
check("garbage token -> 401", call("GET", "/auth/me", None, "not-a-jwt")[0], 401)
tampered = admin_tok[:-6] + ("aaaaaa" if not admin_tok.endswith("aaaaaa") else "bbbbbb")
check("tampered signature -> 401", call("GET", "/auth/me", None, tampered)[0], 401)
s, me = call("GET", "/auth/me", None, admin_tok)
check("valid token /auth/me -> 200", s, 200)
check("  reports role=admin", (me or {}).get("role"), "admin")

print("\n8. Deactivation takes effect on the very next request")
uid = (created or {}).get("id") if isinstance(created, dict) else None
if uid:
    call("PATCH", f"/admin/users/{uid}/status", {"is_active": False}, admin_tok)
    check("deactivated user's EXISTING token -> 401",
          call("GET", "/auth/me", None, mgr_tok)[0], 401)
    check("deactivated user cannot log in -> 403 (password was correct; account is off)",
          call("POST", "/auth/login",
               {"email": new_mgr["email"], "password": new_mgr["password"]})[0], 403)
else:
    print("       (skipped: no user id returned)")

print(f"\n{'='*60}\n  {ok} passed, {fail} failed\n{'='*60}")
raise SystemExit(1 if fail else 0)
