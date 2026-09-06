"""Authoring rights, account ownership, and the approved-terms round trip.

Covers the three rules that were asked for explicitly:
  * only a rep may build, price or submit a quotation
  * a rep may only quote for accounts they own
  * terms a manager has already approved confirm without going round again

Run the API on :8200, then:  python backend/verify_flow_rbac.py
"""

import json
import time
import urllib.error
import urllib.request
import uuid

BASE = "http://127.0.0.1:8200"
ok = fail = 0


def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=20) as r:
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"null")
        except Exception:
            return e.code, None


def check(label, got, want):
    global ok, fail
    good = got == want
    ok, fail = ok + good, fail + (not good)
    print(f"  [{'PASS' if good else 'FAIL'}] {label}  (got {got!r}, want {want!r})")


def note(msg):
    print(f"       {msg}")


def login(e, p):
    s, b = call("POST", "/auth/login", {"email": e, "password": p})
    assert s == 200, f"{e}: {b}"
    return b["access_token"]


for _ in range(40):
    try:
        urllib.request.urlopen(BASE + "/health", timeout=2)
        break
    except urllib.error.HTTPError:
        break
    except Exception:
        time.sleep(0.5)

REP = login("rao@clinch.io", "RepRao2026!#")
MGR = login("shah@clinch.io", "MgrShah2026!#")
FIN = login("menon@clinch.io", "FinMenon2026!#")
ADM = login("admin@clinch.io", "ClinchAdmin2026!#")

print("\n1. Only a rep may author a quotation")
body = {"customer": "Acme Corp"}
for who, tok in (("manager", MGR), ("finance", FIN), ("admin", ADM)):
    check(f"{who} POST /quotes -> 403", call("POST", "/quotes", body, tok)[0], 403)
s, made = call("POST", "/quotes", body, REP)
check("rep POST /quotes -> 200", s, 200)
ref = made["ref"]
note(f"created {ref} for Acme Corp")

print("\n2. ...and only a rep may price or submit one")
line = {"sku": "SVC-INST", "qty": 4, "discount_pct": 0.0}
for who, tok in (("manager", MGR), ("finance", FIN), ("admin", ADM)):
    check(f"{who} add line -> 403", call("POST", f"/quotes/{ref}/lines", line, tok)[0], 403)
    check(f"{who} submit -> 403", call("POST", f"/quotes/{ref}/submit", None, tok)[0], 403)
    check(f"{who} revise-send -> 403",
          call("POST", f"/quotes/{ref}/revise-send", {}, tok)[0], 403)
check("rep add line -> 200", call("POST", f"/quotes/{ref}/lines", line, REP)[0], 200)

print("\n3. ...but everyone can still SEE it")
for who, tok in (("manager", MGR), ("finance", FIN), ("admin", ADM)):
    check(f"{who} GET the quotation -> 200", call("GET", f"/quotes/{ref}", None, tok)[0], 200)

print("\n4. A rep quotes only for their own accounts")
s, mine = call("GET", "/my/customers", None, REP)
check("/my/customers -> 200", s, 200)
names = [c["name"] for c in mine]
note(f"A. Rao's book: {names}")
check("  holds Acme Corp", "Acme Corp" in names, True)
check("  excludes Vertex Labs (K. Iyer's)", "Vertex Labs" in names, False)
s, denied = call("POST", "/quotes", {"customer": "Vertex Labs"}, REP)
check("quoting into another rep's account -> 403", s, 403)
note(f"  message: {(denied or {}).get('detail', {}).get('message')}")

print("\n5. Manager approval releases the quote to the customer")
lines = call("GET", f"/quotes/{ref}", None, REP)[1]["lines"]
idx = next(i for i, l in enumerate(lines) if l["sku"] == "SVC-INST")
call("PATCH", f"/quotes/{ref}/lines/{idx}", {"discount_pct": 26.0}, REP)
call("POST", f"/quotes/{ref}/submit", None, REP)
st = call("GET", f"/quotes/{ref}", None, REP)[1]["state"]
check("over-ceiling quote routes for approval", st.startswith("PENDING"), True)

s, appr = call("POST", f"/approvals/{ref}/action", {"action": "approve"}, MGR)
if appr and appr.get("state") == "PENDING_FINANCE":
    appr = call("POST", f"/approvals/{ref}/action", {"action": "approve"}, FIN)[1]
    note("  needed a second level; finance signed off too")
d = call("GET", f"/quotes/{ref}", None, REP)[1]
check("approved", d["state"], "APPROVED")
check("  released to the customer", d["sent_to_customer"], True)
check("  and marked pre-approved", d["pre_approved"], True)
note(f"  approved by {d['approved_by_name']} ({d['approved_by_role']})")

print("\n6. The customer accepting approved terms does NOT re-queue")
stamp = uuid.uuid4().hex[:6]
cust = call("POST", "/auth/register", {
    "name": "Acme Buyer", "email": f"buyer.{stamp}@acme.example",
    "password": "Buyer!Pass2026", "company": "Acme Corp"})[1]["access_token"]
s, conf = call("POST", f"/shop/quotes/{ref}/confirm", {}, cust)
check("confirm -> 200", s, 200)
check("  no approval required", conf.get("approval_required"), False)
check("  state CONFIRMED", conf.get("state"), "CONFIRMED")
check("  recognised as pre-approved", conf.get("pre_approved"), True)
note(f"  risk was {conf.get('risk_score')} {conf.get('risk_band')} - above threshold, "
     f"but already signed off by {conf.get('approved_by')}")

print("\n7. A customer countering for MORE loses the standing approval")
ref2 = call("POST", "/quotes", {"customer": "Acme Corp"}, REP)[1]["ref"]
call("POST", f"/quotes/{ref2}/lines", {"sku": "SVC-INST", "qty": 4,
                                       "discount_pct": 26.0}, REP)
call("POST", f"/quotes/{ref2}/submit", None, REP)
a = call("POST", f"/approvals/{ref2}/action", {"action": "approve"}, MGR)[1]
if a.get("state") == "PENDING_FINANCE":
    call("POST", f"/approvals/{ref2}/action", {"action": "approve"}, FIN)
check("approved at 26%", call("GET", f"/quotes/{ref2}", None, REP)[1]["state"], "APPROVED")
s, conf2 = call("POST", f"/shop/quotes/{ref2}/confirm",
                {"counter_discount_pct": 40.0, "comment": "We want 40%."}, cust)
check("customer counters to 40% -> 200", s, 200)
check("  approval IS required again", conf2.get("approval_required"), True)
check("  state PENDING_MANAGER", conf2.get("state"), "PENDING_MANAGER")
note("  the standing approval covered 26%, not 40%")

print(f"\n{'=' * 66}\n  {ok} passed, {fail} failed\n{'=' * 66}")
raise SystemExit(1 if fail else 0)
