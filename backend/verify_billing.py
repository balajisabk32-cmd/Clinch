"""The settlement tail: invoice -> payment -> PDF, from both surfaces.

Covers what item 3 of the fix list asked for:
  * an invoice per placed order, with paid/unpaid tracking
  * a payment method and the date and time it was taken
  * a one-page invoice PDF anyone can download
  * the customer paying from their own portal, flipping unpaid -> paid
  * stock actually moving when the goods ship

Run the API on :8200, then:  python backend/verify_billing.py
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
        with urllib.request.urlopen(req, data, timeout=25) as r:
            payload = r.read()
            return r.status, (payload if raw else json.loads(payload or b"null"))
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


def truthy(label, value):
    global ok, fail
    good = bool(value)
    ok, fail = ok + good, fail + (not good)
    print(f"  [{'PASS' if good else 'FAIL'}] {label}  ({value!r})")


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

print("\n1. Payment methods come from the server, not the form")
s, methods = call("GET", "/payment-methods", None, FIN)
check("GET /payment-methods -> 200", s, 200)
keys = [m["key"] for m in methods]
note(f"offered: {keys}")
check("  bank transfer, UPI, card, cheque, credit note",
      sorted(keys), sorted(["bank_transfer", "upi", "card", "cheque", "credit_note"]))

print("\n2. An order is taken all the way to an invoice")
ref = call("POST", "/quotes", {"customer": "Acme Corp"}, REP)[1]["ref"]
call("POST", f"/quotes/{ref}/lines", {"sku": "MON-27", "qty": 3, "discount_pct": 2.0}, REP)
call("POST", f"/quotes/{ref}/submit", None, REP)
st = call("GET", f"/quotes/{ref}", None, REP)[1]["state"]
if st.startswith("PENDING"):
    a = call("POST", f"/approvals/{ref}/action", {"action": "approve"}, MGR)[1]
    if a.get("state") == "PENDING_FINANCE":
        call("POST", f"/approvals/{ref}/action", {"action": "approve"}, FIN)
note(f"{ref} is {call('GET', f'/quotes/{ref}', None, REP)[1]['state']}")

before = {w["name"]: {r["sku"]: r for r in w["stock"]}
          for w in call("GET", "/warehouses", None, FIN)[1]}

call("POST", f"/orders/{ref}/allocate", {"objective": "cost"}, FIN)
s, shipped = call("POST", f"/orders/{ref}/confirm", {}, FIN)
check("confirm & ship -> 200", s, 200)

print("\n3. Shipping actually moves stock")
after = {w["name"]: {r["sku"]: r for r in w["stock"]}
         for w in call("GET", "/warehouses", None, FIN)[1]}
moved = 0
for depot, shelf in after.items():
    b = before[depot].get("MON-27", {})
    a = shelf.get("MON-27", {})
    if b and a and b["on_hand"] != a["on_hand"]:
        moved += b["on_hand"] - a["on_hand"]
        note(f"{depot}: on_hand {b['on_hand']} -> {a['on_hand']}, "
             f"reserved {b['reserved']} -> {a['reserved']}")
check("3 monitors left the shelf", moved, 3)

s, inv = call("POST", f"/orders/{ref}/invoice", {}, FIN)
check("invoice generated -> 200", s, 200)
inv_ref = inv["ref"]
note(f"{inv_ref} for {inv['amount']}, due {inv['due_date']}")
check("  starts unpaid", inv["status"], "unpaid")

print("\n4. The invoice reaches the customer's own portal")
stamp = uuid.uuid4().hex[:6]
CUST = call("POST", "/auth/register", {
    "name": "Acme Buyer", "email": f"pay.{stamp}@acme.example",
    "password": "Buyer!Pass2026", "company": "Acme Corp"})[1]["access_token"]
s, mine = call("GET", "/shop/invoices", None, CUST)
check("GET /shop/invoices -> 200", s, 200)
refs = [i["ref"] for i in mine]
check(f"  {inv_ref} is there", inv_ref in refs, True)
row = next(i for i in mine if i["ref"] == inv_ref)
check("  outstanding equals the full amount", row["outstanding"], inv["amount"])
truthy("  no internal fields leak into the portal payload",
       not any(k in row for k in ("kind", "method", "last_payment_at")))

print("\n5. A customer cannot read another company's invoice")
s, denied = call("GET", "/shop/invoices/INV-1044", None, CUST)   # Beta Industries
check("Beta's invoice from an Acme sign-in -> 404", s, 404)

print("\n6. Bad payments are refused")
check("unknown method -> 422",
      call("POST", f"/shop/invoices/{inv_ref}/pay",
           {"method": "goldbars", "amount": 10}, CUST)[0], 422)
check("negative amount -> 422",
      call("POST", f"/shop/invoices/{inv_ref}/pay",
           {"method": "upi", "amount": -5}, CUST)[0], 422)
check("more than is outstanding -> 422",
      call("POST", f"/shop/invoices/{inv_ref}/pay",
           {"method": "upi", "amount": inv["amount"] * 2}, CUST)[0], 422)

print("\n7. A part payment leaves it partial, with a timestamp")
half = round(inv["amount"] / 2, 2)
s, part = call("POST", f"/shop/invoices/{inv_ref}/pay",
               {"method": "upi", "amount": half}, CUST)
check("part payment -> 200", s, 200)
check("  status partial", part["status"], "partial")
check("  outstanding halves", part["outstanding"], round(inv["amount"] - half, 2))
truthy("  the payment carries a date and time", part["payments"][0]["at"])
note(f"  {part['payments'][0]['at']} via {part['payments'][0]['method_label']}")

print("\n8. Paying the balance flips it to paid and moves the ORDER to PAID")
s, done = call("POST", f"/shop/invoices/{inv_ref}/pay", {"method": "card"}, CUST)
check("settle the balance -> 200", s, 200)
check("  status paid", done["status"], "paid")
check("  outstanding zero", done["outstanding"], 0.0)
truthy("  paid_at stamped", done["paid_at"])
check("  order state PAID", call("GET", f"/quotes/{ref}", None, REP)[1]["state"], "PAID")
check("  paying again -> 409", call("POST", f"/shop/invoices/{inv_ref}/pay",
                                    {"method": "upi"}, CUST)[0], 409)

print("\n9. The invoice is a real one-page PDF, from both surfaces")
for who, tok, path in (("finance", FIN, f"/invoices/{inv_ref}/pdf"),
                       ("customer", CUST, f"/shop/invoices/{inv_ref}/pdf")):
    s, blob = call("GET", path, None, tok, raw=True)
    check(f"{who} download -> 200", s, 200)
    truthy(f"  {who} gets a PDF", isinstance(blob, bytes) and blob[:5] == b"%PDF-")
    if isinstance(blob, bytes):
        note(f"  {len(blob):,} bytes, {blob.count(b'/Type /Page') or blob.count(b'/Type/Page')} page object(s)")

s, blob = call("GET", f"/shop/invoices/INV-1044/pdf", None, CUST, raw=True)
check("another company's PDF -> 404", s, 404)

print(f"\n{'=' * 66}\n  {ok} passed, {fail} failed\n{'=' * 66}")
raise SystemExit(1 if fail else 0)
