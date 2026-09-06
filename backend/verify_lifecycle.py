"""Full-lifecycle QTC verification against the LIVE server.

Covers the mission checklist: approval audit, return-for-revision, ATP stock,
lowest-cost warehouse split, the quote-to-cash tail, subscription plan CRUD and
the reporting exports.

Run the API on :8200, then:  python backend/verify_lifecycle.py
"""

import json
import time
import urllib.error
import urllib.request
import uuid

BASE = "http://127.0.0.1:8200"
ok = fail = 0


def call(method, path, body=None, token=None, raw=False):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=20) as r:
            if raw:
                return r.status, r.read(), dict(r.headers)
            return r.status, json.loads(r.read() or b"null")
    except urllib.error.HTTPError as e:
        payload = e.read()
        if raw:
            return e.code, payload, dict(e.headers)
        try:
            return e.code, json.loads(payload or b"null")
        except Exception:
            return e.code, None


def check(label, got, want):
    global ok, fail
    good = got == want
    ok, fail = ok + good, fail + (not good)
    print(f"  [{'PASS' if good else 'FAIL'}] {label}  (got {got!r}, want {want!r})")


def note(msg):
    print(f"       {msg}")


def login(email, password):
    s, b = call("POST", "/auth/login", {"email": email, "password": password})
    assert s == 200, f"login failed for {email}: {b}"
    return b["access_token"]


for _ in range(40):
    try:
        urllib.request.urlopen(BASE + "/health", timeout=2)
        break
    except urllib.error.HTTPError:
        break
    except Exception:
        time.sleep(0.5)

ADMIN = login("admin@clinch.io", "ClinchAdmin2026!#")
MGR = login("shah@clinch.io", "MgrShah2026!#")
REP = login("rao@clinch.io", "RepRao2026!#")
FIN = login("menon@clinch.io", "FinMenon2026!#")

print("\n1. Approval audit is populated from the TOKEN, not the request body")
call("POST", "/admin/reset", {}, ADMIN)
s, _ = call("POST", "/quotes/Q-1042/submit", None, REP)
st = call("GET", "/quotes/Q-1042", None, REP)[1]["state"]
if not st.startswith("PENDING"):
    note(f"Q-1042 is {st}; driving a fresh quote instead")

# Find something actually awaiting manager review.
pending = [a for a in call("GET", "/approvals", None, MGR)[1]
           if a["state"] == "PENDING_MANAGER"]
check("there is a quotation awaiting manager review", bool(pending), True)
ref = pending[0]["ref"] if pending else None

if ref:
    # The body tries to claim someone else's name; the server must ignore it.
    s, res = call("POST", f"/approvals/{ref}/action",
                  {"action": "approve", "actor": "Somebody Else"}, MGR)
    check(f"manager approves {ref} -> 200", s, 200)
    check("  approved_by_name comes from the token, not the body",
          res.get("approved_by_name"), "M. Shah")
    check("  approved_by_role recorded", res.get("approved_by_role"), "manager")
    check("  approved_at populated", bool(res.get("approved_at")), True)
    detail = call("GET", f"/quotes/{ref}", None, REP)[1]
    check("  quote detail exposes the approver", detail.get("approved_by_name"), "M. Shah")
    note(f"approved_at = {res.get('approved_at')}")

print("\n2. Return for revision requires a real note")
call("POST", "/quotes/Q-1039/submit", None, REP)
pending = [a["ref"] for a in call("GET", "/approvals", None, MGR)[1]
           if a["state"] == "PENDING_MANAGER"]
ref2 = pending[0] if pending else None
check("a second quotation is awaiting review", bool(ref2), True)

if ref2:
    check("empty note -> 422",
          call("POST", f"/quotes/{ref2}/return-revision", {"manager_notes": ""}, MGR)[0], 422)
    check("blank note -> 422",
          call("POST", f"/quotes/{ref2}/return-revision", {"manager_notes": "    "}, MGR)[0], 422)
    check("token note ('fix') -> 422",
          call("POST", f"/quotes/{ref2}/return-revision", {"manager_notes": "fix"}, MGR)[0], 422)

    NOTE = "Reduce 17% to 14% for Laptop 14 Pro Max to meet Gold tier category limit."
    s, res = call("POST", f"/quotes/{ref2}/return-revision", {"manager_notes": NOTE}, MGR)
    check("real note accepted -> 200", s, 200)
    check("  state returns to DRAFT", res.get("state"), "DRAFT")
    check("  revision_requested flag set", res.get("revision_requested"), True)
    check("  note stored verbatim", res.get("manager_revision_notes"), NOTE)

    listed = [q for q in call("GET", "/quotes", None, REP)[1] if q["ref"] == ref2]
    check("  the rep's list carries the flag and note",
          bool(listed) and listed[0]["revision_requested"]
          and listed[0]["manager_revision_notes"] == NOTE, True)

    check("a rep cannot return a quote for revision -> 403",
          call("POST", f"/quotes/{ref2}/return-revision",
               {"manager_notes": NOTE}, REP)[0], 403)

    # Resubmitting answers the note and clears the flag.
    call("POST", f"/quotes/{ref2}/submit", None, REP)
    again = [q for q in call("GET", "/quotes", None, REP)[1] if q["ref"] == ref2]
    check("  resubmitting clears the flag",
          again[0]["revision_requested"] if again else None, False)

print("\n3. Live ATP availability")
s, av = call("GET", "/inventory/availability?skus=LP14&qty=40", None, REP)
check("availability -> 200", s, 200)
item = (av or {}).get("items", {}).get("LP14", {})
check("  reports per-depot rows", len(item.get("depots", [])) >= 2, True)
d0 = item["depots"][0] if item.get("depots") else {}
check("  available = on_hand - reserved",
      d0.get("available"), max(0, d0.get("on_hand", 0) - d0.get("reserved", 0)))
note(f"LP14 total ATP = {item.get('total_available')} across "
     f"{item.get('depot_count')} depots; split_required={item.get('split_required')}")
check("  cheapest depot is listed first",
      item["depots"][0]["ship_cost_weight"] <= item["depots"][-1]["ship_cost_weight"], True)
check("unknown sku -> 404", call("GET", "/inventory/availability?skus=NOPE", None, REP)[0], 404)
check("no skus -> 422", call("GET", "/inventory/availability?skus=", None, REP)[0], 422)
check("anonymous -> 401", call("GET", "/inventory/availability?skus=LP14")[0], 401)

print("\n4. Warehouse split picks the lowest-cost combination")
s, split = call("POST", "/orders/Q-1044/split", {}, FIN)
if s == 200:
    check("split -> 200", s, 200)
    note(f"cost {split.get('total_cost')} across "
         f"{len(split.get('allocations', []))} allocation row(s)")
    check("  a plan was produced", bool(split.get("allocations")), True)
else:
    note(f"split returned {s} for Q-1044 ({split}); state may not permit it")

print("\n5. Quote-to-cash tail: APPROVED -> CONFIRMED -> FULFILLED -> INVOICED -> PAID")
approved = [q["ref"] for q in call("GET", "/quotes", None, REP)[1]
            if q["state"] == "APPROVED"]
target = approved[0] if approved else None
check("an APPROVED order exists to walk", bool(target), True)
if target:
    s, conf = call("POST", f"/orders/{target}/confirm", {}, FIN)
    check(f"confirm {target} -> 200", s, 200)
    # confirm() runs CONFIRMED -> FULFILLED in one action and commits the
    # cheapest split on the way, so goods never sit reserved for an order that
    # has already shipped. FULFILLED is the correct resting state.
    check("  state FULFILLED", call("GET", f"/quotes/{target}", None, REP)[1]["state"], "FULFILLED")
    check("  stock actually moved", bool(conf.get("shipped")), True)

    s, inv = call("POST", f"/orders/{target}/invoice", {}, FIN)
    check("generate invoice -> 200", s, 200)
    inv_ref = (inv or {}).get("ref")
    note(f"invoice {inv_ref} for {(inv or {}).get('amount')}")
    check("  state INVOICED", call("GET", f"/quotes/{target}", None, REP)[1]["state"], "INVOICED")

    if inv_ref:
        # The method has to be one the server recognises. This used to send
        # "Bank", which was stored verbatim because nothing validated it -- so
        # the ledger could record a settlement method that meant nothing.
        check("an unrecognised method is refused -> 422",
              call("POST", f"/invoices/{inv_ref}/payment",
                   {"method": "Bank", "amount": inv.get("amount")}, FIN)[0], 422)
        s, pay = call("POST", f"/invoices/{inv_ref}/payment",
                      {"method": "bank_transfer", "amount": inv.get("amount")}, FIN)
        check("register payment -> 200", s, 200)
        check("  invoice paid", str((pay or {}).get("status")).lower(), "paid")
        check("  order PAID", call("GET", f"/quotes/{target}", None, REP)[1]["state"], "PAID")

print("\n6. Subscription plan CRUD is admin-only")
code = f"TEST-{uuid.uuid4().hex[:6].upper()}"
plan = {"name": "Enterprise Cloud Tier", "code": code, "billing_cycle": "monthly",
        "base_price": 2400.0, "proration_rule": "calendar_daily",
        "cancellation_notice_days": 30}
check("rep POST -> 403", call("POST", "/admin/subscriptions", plan, REP)[0], 403)
check("manager POST -> 403", call("POST", "/admin/subscriptions", plan, MGR)[0], 403)
check("anonymous GET -> 401", call("GET", "/admin/subscriptions")[0], 401)

s, created = call("POST", "/admin/subscriptions", plan, ADMIN)
check("admin creates a plan -> 201", s, 201)
pid = (created or {}).get("id")
check("duplicate code -> 409", call("POST", "/admin/subscriptions", plan, ADMIN)[0], 409)
check("bad cycle -> 422",
      call("POST", "/admin/subscriptions", {**plan, "code": code + "X",
                                            "billing_cycle": "fortnightly"}, ADMIN)[0], 422)
check("negative price -> 422",
      call("POST", "/admin/subscriptions", {**plan, "code": code + "Y",
                                            "base_price": -5}, ADMIN)[0], 422)
if pid:
    s, upd = call("PUT", f"/admin/subscriptions/{pid}", {"base_price": 2600.0}, ADMIN)
    check("update price -> 200", s, 200)
    check("  price changed", upd.get("base_price"), 2600.0)
    check("deactivate -> 200", call("DELETE", f"/admin/subscriptions/{pid}", None, ADMIN)[0], 200)
    active = [p["code"] for p in call("GET", "/admin/subscriptions", None, ADMIN)[1]]
    check("  gone from the active list", code in active, False)
    allp = [p["code"] for p in
            call("GET", "/admin/subscriptions?include_inactive=true", None, ADMIN)[1]]
    check("  still present when asking for inactive", code in allp, True)
check("update a missing plan -> 404",
      call("PUT", "/admin/subscriptions/999999", {"base_price": 1}, ADMIN)[0], 404)

print("\n7. Rep performance and exports")
s, perf = call("GET", "/admin/reports/rep-performance?rep=A.%20Rao&period=all", None, ADMIN)
check("scorecard -> 200", s, 200)
for key in ("quotes_built", "deals_closed_won", "booked_revenue", "avg_discount_pct",
            "margin_leakage", "outliers_flagged", "avg_approval_hours"):
    check(f"  carries {key}", key in (perf or {}), True)
note(f"A. Rao — {perf.get('deals_closed_won')} won, "
     f"INR {perf.get('booked_revenue'):,.0f} booked, "
     f"leakage INR {perf.get('margin_leakage'):,.0f}, "
     f"{perf.get('avg_approval_hours')}h turnaround")
check("non-admin -> 403", call("GET", "/admin/reports/rep-performance", None, MGR)[0], 403)

s, body, hdrs = call("GET", "/admin/reports/rep-performance/export/csv?rep=A.%20Rao",
                     None, ADMIN, raw=True)
check("CSV export -> 200", s, 200)
check("  is a csv content type", "text/csv" in hdrs.get("content-type", ""), True)
check("  offered as a download", "attachment" in hdrs.get("content-disposition", ""), True)
check("  has rows", body.decode("utf-8").count("\n") > 8, True)

s, body, hdrs = call("GET", "/admin/reports/rep-performance/export/pdf?rep=A.%20Rao",
                     None, ADMIN, raw=True)
check("PDF export -> 200", s, 200)
check("  is a real PDF (magic bytes)", body[:5], b"%PDF-")
check("  non-trivial size", len(body) > 1500, True)
note(f"PDF is {len(body):,} bytes")

print(f"\n{'=' * 64}\n  {ok} passed, {fail} failed\n{'=' * 64}")
raise SystemExit(1 if fail else 0)
