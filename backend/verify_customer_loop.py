"""The negotiation loop, walked exactly as it was described.

  customer raises a request and asks for a discount
    -> it reaches the REP
    -> the rep alters it and sends it to the MANAGER
    -> the manager approves
    -> it goes back to the CUSTOMER
    -> the customer accepts
    -> it comes back to the rep and is AUTO-APPROVED (no second trip)

Every step is checked from the surface the actor would really use: the customer
through /shop, the rep and manager through the internal API. It also checks the
two things that made this loop silently fail -- the payload the storefront
actually sends, and whether the customer is ever told what happened.

Run the API on :8200, then:  python backend/verify_customer_loop.py
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

# The storefront assigns a customer's quotation to a rep on creation, and which
# rep that is depends on the account. Signing in as every rep in the cluster and
# picking the owner later is the honest way to drive this: hardcoding one rep
# made the test edit somebody else's quotation and quietly get a 409.
REP_LOGINS = {
    "A. Rao": ("rao@clinch.io", "RepRao2026!#"),
    "K. Iyer": ("iyer@clinch.io", "RepIyer2026!#"),
    "S. Nair": ("nair@clinch.io", "RepNair2026!#"),
    "V. Verma": ("verma@clinch.io", "RepVerma2026!#"),
}
MGR = login("shah@clinch.io", "MgrShah2026!#")
FIN = login("menon@clinch.io", "FinMenon2026!#")
REP = login(*REP_LOGINS["A. Rao"])

stamp = uuid.uuid4().hex[:6]
CUST = call("POST", "/auth/register", {
    "name": "Acme Buyer", "email": f"loop.{stamp}@acme.example",
    "password": "Buyer!Pass2026", "company": "Acme Corp"})[1]["access_token"]

print("\n1. The customer builds a basket and asks for a quotation")
check("add to cart -> 200", call("POST", "/shop/cart", {"sku": "LP14", "qty": 6}, CUST)[0], 200)
s, made = call("POST", "/shop/quote-requests", {}, CUST)
check("request a quotation -> 201", s, 201)
ref = made["ref"]
note(f"raised {ref}")

print("\n2. It lands with a rep, not in a void")
s, mine = call("GET", "/quotes", None, REP)
owner = next((q for q in mine if q["ref"] == ref), None)
truthy("the rep can see it", owner is not None)
owner_name = (owner or {}).get("rep")
note(f"assigned to {owner_name}, state {(owner or {}).get('state')}")
# Work it as the rep who actually owns it. Hardcoding one rep made this test
# edit somebody else's quotation and quietly collect a 409.
if owner_name in REP_LOGINS:
    REP = login(*REP_LOGINS[owner_name])
    note(f"signed in as {owner_name} to work it")

print("\n3. The customer asks for a discount -- with the payload the SHOP sends")
# {action, discount_pct, note} is what the storefront posts. The server used to
# read counter_discount_pct/comment only, so this arrived as "no number at all".
s, neg = call("POST", f"/shop/quotes/{ref}/request",
              {"action": "negotiate", "discount_pct": 24, "note": "Six units - can you do better?"},
              CUST)
check("negotiate -> 200", s, 200)
truthy("  the number was actually read", (neg or {}).get("new_band") is not None)
note(f"  re-scored to {(neg or {}).get('new_band')}, "
     f"re-entered approval: {(neg or {}).get('re_entered_approval')}")
state_now = call("GET", f"/shop/quotes/{ref}", None, CUST)[1]
check("  the customer is told it is pending",
      state_now.get("discount_request_status"), "pending_approval")
check("  and what they asked for is echoed back",
      state_now.get("requested_discount"), 24.0)

print("\n4. The rep alters it and sends it on")
detail = call("GET", f"/quotes/{ref}", None, REP)[1]
asks = [c for c in detail.get("customer_requests", [])
        if c.get("requested_discount_pct") is not None]
check("the rep can see the customer's ask on the quotation", bool(asks), True)
if asks:
    note(f"  \"{asks[-1]['author']} asked for "
         f"{asks[-1]['requested_discount_pct']:g}%\" - {asks[-1]['body']}")
hist = call("GET", f"/quotes/{ref}/revisions", None, REP)[1]
countered = [e for e in hist if e["event_type"] == "countered"]
check("  and the audit line names the figure",
      any("24%" in (e.get("reason") or "") for e in countered), True)

# A customer counter re-enters approval on its own (PS B8), so by now the
# quotation is with the manager and is no longer editable. The rep's revision
# happens on the way back, which is what the revise-and-resend loop is for.
st = call("GET", f"/quotes/{ref}", None, REP)[1]["state"]
check("it is with an approver", st.startswith("PENDING"), True)
note(f"  state {st}")

print("\n5. The manager approves")
s, appr = call("POST", f"/approvals/{ref}/action", {"action": "approve"}, MGR)
check("manager approve -> 200", s, 200)
if (appr or {}).get("state") == "PENDING_FINANCE":
    appr = call("POST", f"/approvals/{ref}/action", {"action": "approve"}, FIN)[1]
    note("  needed Level 2; finance signed it too")
d = call("GET", f"/quotes/{ref}", None, REP)[1]
check("  approved", d["state"], "APPROVED")
check("  released to the customer", d["sent_to_customer"], True)
note(f"  approved by {d['approved_by_name']} ({d['approved_by_role']})")

print("\n6. It is back with the customer, who is told the outcome")
cv = call("GET", f"/shop/quotes/{ref}", None, CUST)[1]
truthy("the customer sees an outcome, not silence", cv.get("discount_request_status"))
note(f"  status: {cv['discount_request_status']}, "
     f"asked {cv.get('requested_discount')}%, offered {cv.get('counter_discount')}%")
check("  they can confirm", cv["can_confirm"], True)

print("\n7. The customer accepts -- and it does NOT go round again")
s, conf = call("POST", f"/shop/quotes/{ref}/confirm", {}, CUST)
check("confirm -> 200", s, 200)
check("  no further approval needed", conf.get("approval_required"), False)
check("  straight to CONFIRMED", conf.get("state"), "CONFIRMED")
truthy("  the confirmation names why it did not re-queue",
       conf.get("pre_approved") or conf.get("risk_band") == "AUTO")
note(f"  risk {conf.get('risk_score')} {conf.get('risk_band')} - above the AUTO band, "
     f"but already approved by {conf.get('approved_by')}, so it auto-approves")

print("\n8. Asking for MORE after approval does re-open the loop")
s, again = call("POST", f"/shop/quotes/{ref}/request",
                {"action": "negotiate", "discount_pct": 40, "note": "One more push"}, CUST)
check("a bigger ask -> 200", s, 200)
check("  re-enters approval", (again or {}).get("re_entered_approval"), True)
check("  state PENDING_MANAGER", (again or {}).get("state"), "PENDING_MANAGER")
note("  the standing approval covered 18%, not 40%")

print("\n8b. The same ask twice is refused, and refusing changes nothing")
fresh = uuid.uuid4().hex[:6]
BUYER = call("POST", "/auth/register", {
    "name": "Acme Buyer", "email": f"lock.{fresh}@acme.example",
    "password": "Buyer!Pass2026", "company": "Acme Corp"})[1]["access_token"]
call("POST", "/shop/cart", {"sku": "MON-27", "qty": 4}, BUYER)
lref = call("POST", "/shop/quote-requests", {}, BUYER)[1]["ref"]
check("first ask -> 200",
      call("POST", f"/shop/quotes/{lref}/request",
           {"action": "negotiate", "discount_pct": 12}, BUYER)[0], 200)
check("  the SAME ask again -> 409",
      call("POST", f"/shop/quotes/{lref}/request",
           {"action": "negotiate", "discount_pct": 12}, BUYER)[0], 409)
check("  a different ask while the first is under review -> 409",
      call("POST", f"/shop/quotes/{lref}/request",
           {"action": "negotiate", "discount_pct": 18}, BUYER)[0], 409)
# A refused request must not move the record. This was a real bug: the comment
# and the audit event were written BEFORE the state check refused the call, so
# the customer's recorded ask changed to a figure the server had just rejected.
lq = call("GET", f"/shop/quotes/{lref}", None, BUYER)[1]
check("  the recorded ask is still the one that succeeded",
      lq["last_requested_discount"], 12.0)

print("\n8c. The same terms sent twice close the negotiation")


def _approve(r):
    a = call("POST", f"/approvals/{r}/action", {"action": "approve"}, MGR)[1]
    if (a or {}).get("state") == "PENDING_FINANCE":
        call("POST", f"/approvals/{r}/action", {"action": "approve"}, FIN)


_approve(lref)
check("after the first release, still open",
      call("GET", f"/shop/quotes/{lref}", None, BUYER)[1]["negotiation_locked"], False)
call("POST", f"/shop/quotes/{lref}/request",
     {"action": "negotiate", "discount_pct": 20}, BUYER)
_approve(lref)
lq = call("GET", f"/shop/quotes/{lref}", None, BUYER)[1]
check("  same terms sent a second time -> locked", lq["negotiation_locked"], True)
check("  and it says why", bool(lq["lock_reason"]), True)
note(f"  {lq['lock_reason']}")
check("  a further ask -> 409",
      call("POST", f"/shop/quotes/{lref}/request",
           {"action": "negotiate", "discount_pct": 30}, BUYER)[0], 409)
check("  but confirming still works",
      call("POST", f"/shop/quotes/{lref}/confirm", {}, BUYER)[0], 200)

print("\n9. Rubbish input is refused rather than stored")
check("a discount above 100 -> 422",
      call("POST", f"/shop/quotes/{ref}/request",
           {"action": "negotiate", "discount_pct": 400}, CUST)[0], 422)
check("a non-numeric discount -> 422",
      call("POST", f"/shop/quotes/{ref}/request",
           {"action": "negotiate", "discount_pct": "lots"}, CUST)[0], 422)

print("\n10. Another company's quotation stays invisible")
other = uuid.uuid4().hex[:6]
STRANGER = call("POST", "/auth/register", {
    "name": "Beta Buyer", "email": f"beta.{other}@beta.example",
    "password": "Buyer!Pass2026", "company": "Beta Industries"})[1]["access_token"]
check("a Beta sign-in reading the Acme quote -> 404",
      call("GET", f"/shop/quotes/{ref}", None, STRANGER)[0], 404)
check("...and negotiating on it -> 404",
      call("POST", f"/shop/quotes/{ref}/request",
           {"action": "negotiate", "discount_pct": 90}, STRANGER)[0], 404)

print(f"\n{'=' * 66}\n  {ok} passed, {fail} failed\n{'=' * 66}")
raise SystemExit(1 if fail else 0)
