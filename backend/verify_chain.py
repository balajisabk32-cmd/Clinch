"""The order chain: customer request -> fulfilment -> payment, in that order.

The fulfilment screen used to show a split plan and three buttons with no idea
what state the order was in, so it offered actions the server was certain to
refuse -- pressing "Confirm & Ship" on a shipped order surfaced the state
machine's own complaint as an error. And payment was accepted against any
invoice row regardless of whether the goods had shipped or the invoice had been
raised, so the invoice book and the order book drifted apart in both directions.

This walks one order the whole way and asserts that each stage is only
reachable, and only offered, once the one before it is done.

Run the API on :8200, then:  python backend/verify_chain.py
"""

import json
import time
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8200"
ok = fail = 0


def call(method, path, body=None, token=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data, timeout=25) as r:
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


for _ in range(60):
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


def status(ref):
    return call("GET", f"/orders/{ref}/fulfilment", None, FIN)[1]


print("\n1. An approved order knows it has not shipped")
ref = call("POST", "/quotes", {"customer": "Acme Corp"}, REP)[1]["ref"]
call("POST", f"/quotes/{ref}/lines", {"sku": "DOCK-01", "qty": 5, "discount_pct": 3.0}, REP)
call("POST", f"/quotes/{ref}/submit", None, REP)
st = call("GET", f"/quotes/{ref}", None, REP)[1]["state"]
if st.startswith("PENDING"):
    a = call("POST", f"/approvals/{ref}/action", {"action": "approve"}, MGR)[1]
    if (a or {}).get("state") == "PENDING_FINANCE":
        call("POST", f"/approvals/{ref}/action", {"action": "approve"}, FIN)
note(f"{ref} is {call('GET', f'/quotes/{ref}', None, REP)[1]['state']}")

d = status(ref)
check("stage 0 (Approved)", d["stage"], 0)
check("  may allocate", d["can_allocate"], True)
check("  may ship", d["can_ship"], True)
check("  may NOT invoice yet", d["can_invoice"], False)
check("  may NOT take payment yet", d["can_take_payment"], False)
check("  nothing shipped", len(d["shipped"]), 0)
check("  no invoice", d["invoice"], None)

print("\n2. Invoicing before shipping is refused")
check("invoice an unshipped order -> 409",
      call("POST", f"/orders/{ref}/invoice", {}, FIN)[0], 409)

print("\n3. Shipping moves it on, and closes the shipping actions")
call("POST", f"/orders/{ref}/allocate", {"objective": "cost"}, FIN)
check("confirm & ship -> 200", call("POST", f"/orders/{ref}/confirm", {}, FIN)[0], 200)
d = status(ref)
check("stage 2 (Shipped)", d["stage"], 2)
check("  may no longer allocate", d["can_allocate"], False)
# This is the exact control that produced "Q-1042 is FULFILLED; CONFIRMED is not
# a legal next state" -- offered on an order that had already shipped.
check("  may no longer ship", d["can_ship"], False)
check("  may invoice", d["can_invoice"], True)
check("  stock actually moved", len(d["shipped"]) > 0, True)
note("  " + ", ".join(
    f"{m['qty']}x {m['sku']} from {m['warehouse']}" for m in d["shipped"]))

print("\n4. Paying before the invoice is raised is refused")
inv_guess = f"INV-{ref.split('-')[-1]}"
s, denied = call("POST", f"/invoices/{inv_guess}/payment", {"method": "upi"}, FIN)
check("pay a not-yet-raised invoice -> 404", s, 404)

print("\n5. Invoicing opens payment, and only then")
s, inv = call("POST", f"/orders/{ref}/invoice", {}, FIN)
check("generate invoice -> 200", s, 200)
inv_ref = inv["ref"]
d = status(ref)
check("stage 3 (Invoiced)", d["stage"], 3)
check("  may take payment", d["can_take_payment"], True)
check("  invoice is attached to the order", d["invoice"]["ref"], inv_ref)
check("  and it is unpaid", d["invoice"]["status"], "unpaid")

print("\n6. An unsupported method is refused, a real one settles it")
check("method 'Cash' -> 422",
      call("POST", f"/invoices/{inv_ref}/payment", {"method": "Cash"}, FIN)[0], 422)
s, paid = call("POST", f"/invoices/{inv_ref}/payment", {"method": "bank_transfer"}, FIN)
check("bank transfer -> 200", s, 200)
check("  invoice paid", paid["status"], "paid")

print("\n7. Settling the invoice carries the ORDER to PAID")
# The old code tried a single hop to PAID. From FULFILLED that is not legal --
# the chain is FULFILLED -> INVOICED -> PAID -- so the invoice went paid and the
# order was silently left behind.
d = status(ref)
check("order state PAID", d["state"], "PAID")
check("  stage 4 (Paid)", d["stage"], 4)
check("  nothing further offered",
      [d["can_allocate"], d["can_ship"], d["can_invoice"], d["can_take_payment"]],
      [False, False, False, False])
check("  settlement time recorded", bool(d["invoice"]["paid_at"]), True)
note(f"  settled {d['invoice']['paid_at']} via {d['invoice']['method_label']}")

print("\n8. Every invoice in the book agrees with its order")
q = {x["ref"]: x["state"] for x in call("GET", "/quotes", None, FIN)[1]}
bad = []
for i in call("GET", "/invoices", None, FIN)[1]:
    order_state = q.get(i["order_ref"])
    if order_state is None:
        continue
    if (i["status"] == "paid") != (order_state == "PAID"):
        bad.append(f"{i['ref']} {i['status']} but {i['order_ref']} is {order_state}")
check("no invoice contradicts its order", bad, [])
for b in bad:
    note(f"  {b}")

print(f"\n{'=' * 66}\n  {ok} passed, {fail} failed\n{'=' * 66}")
raise SystemExit(1 if fail else 0)
