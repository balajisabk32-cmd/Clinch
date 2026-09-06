"""The full negotiation loop, against the LIVE server.

  customer requests  ->  rep prices and revises  ->  sends to customer
  ->  customer confirms  ->  within policy  = straight to fulfilment
                          over policy       = routed to the rep's manager

Run the API on :8200, then:  python backend/verify_negotiation.py
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


def login(email, pw):
    s, b = call("POST", "/auth/login", {"email": email, "password": pw})
    assert s == 200, f"login {email}: {b}"
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

# A customer of our own, so the run is repeatable.
stamp = uuid.uuid4().hex[:6]
s, reg = call("POST", "/auth/register", {
    "name": "Neha Iyer", "email": f"neha.{stamp}@bluepeak.example",
    "password": "Buyer!Pass2026", "company": f"Bluepeak {stamp}", "city": "Pune"})
assert s == 201, reg
CUST = reg["access_token"]

print("\n1. Customer raises a quotation request")
call("POST", "/shop/cart", {"sku": "SVC-INST", "qty": 4}, CUST)
call("POST", "/shop/cart", {"sku": "LP14", "qty": 2}, CUST)
s, req = call("POST", "/shop/quote-requests", {"note": "Need pricing this week."}, CUST)
check("request -> 201", s, 201)
ref = req["ref"]
note(f"{ref} landed with {req['rep']}")

listed = [q for q in call("GET", "/quotes", None, REP)[1] if q["ref"] == ref]
check("  rep sees it flagged as a customer request",
      listed[0]["is_customer"] if listed else None, True)

print("\n2. Rep prices it over the ceiling, then revises it back")
lines = call("GET", f"/quotes/{ref}", None, REP)[1]["lines"]
svc_idx = next(i for i, l in enumerate(lines) if l["sku"] == "SVC-INST")
call("PATCH", f"/quotes/{ref}/lines/{svc_idx}", {"discount_pct": 26.0}, REP)
d = call("GET", f"/quotes/{ref}", None, REP)[1]
check("over-ceiling draft is flagged", d["risk_band"] != "AUTO", True)
note(f"at 26%: score {d['risk_score']} {d['risk_band']}")

s, sent = call("POST", f"/quotes/{ref}/revise-send", {}, REP)
check("first send -> 200", s, 200)
check("  state is NEGOTIATION", sent.get("state"), "NEGOTIATION")
check("  a portal link was minted", bool(sent.get("portal_url")), True)
note(f"revision {sent.get('revision')}, band {sent.get('risk_band')}")

check("resending with nothing changed -> 409",
      call("POST", f"/quotes/{ref}/revise-send", {}, REP)[0], 409)

# Pull it back inside policy and resend.
call("PATCH", f"/quotes/{ref}/lines/{svc_idx}", {"discount_pct": 8.0}, REP)
s, sent2 = call("POST", f"/quotes/{ref}/revise-send", {}, REP)
check("resend after a real change -> 200", s, 200)
check("  revision counter advanced", sent2.get("revision"), 2)
check("  now within policy", sent2.get("within_policy"), True)
check("  no approval was requested", call("GET", f"/quotes/{ref}", None, REP)[1]["state"],
      "NEGOTIATION")

print("\n3. Revision history records who changed what")
s, hist = call("GET", f"/quotes/{ref}/revisions", None, REP)
check("history -> 200", s, 200)
reasons = [e.get("reason") or "" for e in hist]
check("  the reduction is described in words",
      any("reduced" in r and "26" in r and "8" in r for r in reasons), True)
for r in reasons[-4:]:
    note(r)

print("\n4. Customer confirms terms that are WITHIN policy")
s, conf = call("POST", f"/shop/quotes/{ref}/confirm", {}, CUST)
check("confirm -> 200", s, 200)
check("  no approval required", conf.get("approval_required"), False)
check("  state CONFIRMED", conf.get("state"), "CONFIRMED")
sugg = conf.get("fulfilment_suggestion") or {}
check("  fulfilment was suggested",
      bool(sugg.get("allocations") or sugg.get("backorders")), True)
note(f"  plan: {len(sugg.get('allocations', []))} allocation(s), "
     f"{len(sugg.get('backorders', []))} backorder(s)")
check("  message says so", conf.get("message"), "Confirmed - proceeding to fulfilment.")

print("\n5. A customer confirming OVER policy re-enters approval")
call("POST", "/shop/cart", {"sku": "SVC-INST", "qty": 4}, CUST)
ref2 = call("POST", "/shop/quote-requests", {}, CUST)[1]["ref"]
lines2 = call("GET", f"/quotes/{ref2}", None, REP)[1]["lines"]
i2 = next(i for i, l in enumerate(lines2) if l["sku"] == "SVC-INST")
call("PATCH", f"/quotes/{ref2}/lines/{i2}", {"discount_pct": 9.0}, REP)
call("POST", f"/quotes/{ref2}/revise-send", {}, REP)

# The customer counters ABOVE the ceiling on the way in.
s, conf2 = call("POST", f"/shop/quotes/{ref2}/confirm",
                {"counter_discount_pct": 30.0,
                 "comment": "We can only sign at 30%."}, CUST)
check("confirm with a 30% counter -> 200", s, 200)
check("  approval IS required", conf2.get("approval_required"), True)
check("  state PENDING_MANAGER", conf2.get("state"), "PENDING_MANAGER")
check("  routed to a named manager", bool(conf2.get("routed_to")), True)
check("  message says so", conf2.get("message"),
      "Confirmed - routed for manager approval due to final discount terms.")
note(f"score {conf2.get('risk_score')} {conf2.get('risk_band')} -> {conf2.get('routed_to')}")

print("\n6. It lands in the ASSIGNED manager's queue")
# The approvals list is filtered per manager, so query as the manager it routed
# to rather than assuming one person owns every rep.
routed_to = conf2.get("routed_to")
admin = login("admin@clinch.io", "ClinchAdmin2026!#")
all_queue = [a["ref"] for a in call("GET", "/approvals", None, admin)[1]]
check("  in the approvals queue", ref2 in all_queue, True)
note(f"assigned manager is {routed_to}")
MGR_LOGINS = {"M. Shah": ("shah@clinch.io", "MgrShah2026!#")}
if routed_to in MGR_LOGINS:
    mine = [a["ref"] for a in call("GET", "/approvals", None,
                                   login(*MGR_LOGINS[routed_to]))[1]]
    check(f"  visible to {routed_to}", ref2 in mine, True)
else:
    note(f"no seeded login for {routed_to}; the unfiltered queue was checked")

print("\n7. Guards")
check("a customer cannot revise-and-send",
      call("POST", f"/quotes/{ref2}/revise-send", {}, CUST)[0], 403)
check("a rep cannot confirm on the customer's behalf",
      call("POST", f"/shop/quotes/{ref2}/confirm", {}, REP)[0], 403)
check("confirming a quote already in approval -> 409",
      call("POST", f"/shop/quotes/{ref2}/confirm", {}, CUST)[0], 409)
check("revise-send on a pending quote -> 409",
      call("POST", f"/quotes/{ref2}/revise-send", {}, REP)[0], 409)

print(f"\n{'=' * 66}\n  {ok} passed, {fail} failed\n{'=' * 66}")
raise SystemExit(1 if fail else 0)
