"""End-to-end customer journey against the live server."""
import json, time, urllib.request, urllib.error, uuid
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
    print(f"  [{'PASS' if good else 'FAIL'}] {label}  (got {got!r}, want {want!r})")

for _ in range(40):
    try:
        urllib.request.urlopen(BASE + "/health", timeout=2); break
    except urllib.error.HTTPError: break
    except Exception: time.sleep(0.5)

stamp = uuid.uuid4().hex[:6]
email = f"priya.{stamp}@northwind.example"

print("\n1. Registration")
s, reg = call("POST", "/auth/register", {
    "name": "Priya Sharma", "email": email, "password": "Shop!Pass2026",
    "company": "Northwind Traders", "gst_number": "29ABCDE1234F1Z5",
    "phone": "+91 98450 11223", "city": "Bengaluru", "role": "admin"})
check("register -> 201", s, 201)
check("  role pinned to customer despite role:admin in body",
      (reg or {}).get("user", {}).get("role"), "customer")
check("  starts on Bronze", (reg or {}).get("user", {}).get("tier"), "Bronze")
tok = (reg or {}).get("access_token")

check("weak password rejected -> 422",
      call("POST", "/auth/register", {"name": "X", "email": f"w.{stamp}@a.example",
                                      "password": "weak", "company": "C"})[0], 422)
check("missing company rejected -> 422",
      call("POST", "/auth/register", {"name": "X", "email": f"n.{stamp}@a.example",
                                      "password": "Shop!Pass2026"})[0], 422)
check("duplicate email -> 409",
      call("POST", "/auth/register", {"name": "X", "email": email,
                                      "password": "Shop!Pass2026", "company": "C"})[0], 409)

print("\n2. The air gap holds for an account, not just a token")
s, cat = call("GET", "/shop/catalog", None, tok)
check("catalog -> 200", s, 200)
blob = json.dumps(cat)
for leaked in ("cost", "margin", "risk_score", "ceiling", "rep"):
    check(f"  '{leaked}' absent from catalogue payload", leaked in blob, False)
p0 = cat["products"][0]
check("  Bronze price == list price", p0["your_price"], p0["list_price"])

print("\n3. Internal routes are unreachable with a customer token")
for path in ("/quotes", "/approvals", "/dashboard", "/products", "/invoices", "/admin/users"):
    check(f"customer GET {path} -> 403", call("GET", path, None, tok)[0], 403)

print("\n4. Cart")
sku = p0["sku"]
check("add to cart -> 200", call("POST", "/shop/cart", {"sku": sku, "qty": 3}, tok)[0], 200)
s, cart = call("POST", "/shop/cart", {"sku": cat["products"][1]["sku"], "qty": 2}, tok)
check("second line -> 200", s, 200)
check("  cart counts 5 units", cart["count"], 5)
check("unknown sku -> 404", call("POST", "/shop/cart", {"sku": "NOPE", "qty": 1}, tok)[0], 404)
check("anonymous cart -> 401", call("GET", "/shop/cart")[0], 401)

print("\n5. Quotation request lands on a rep's desk")
s, qr = call("POST", "/shop/quote-requests", {"note": "Need this before month end."}, tok)
check("request -> 201", s, 201)
ref = (qr or {}).get("ref")
print(f"       created {ref}, assigned to {(qr or {}).get('rep')}")
check("  cart emptied", call("GET", "/shop/cart", None, tok)[1]["count"], 0)
check("empty cart request -> 422", call("POST", "/shop/quote-requests", {}, tok)[0], 422)

print("\n6. The customer sees only their own quotations")
s, mine = call("GET", "/shop/quotes", None, tok)
check("my quotes -> 200", s, 200)
check("  exactly the one just requested", [q["ref"] for q in mine], [ref])
check("another company's quote -> 404", call("GET", "/shop/quotes/Q-1042", None, tok)[0], 404)
s, detail = call("GET", f"/shop/quotes/{ref}", None, tok)
check("own quote detail -> 200", s, 200)
check("  no margin in detail", "margin" in json.dumps(detail), False)

print(f"\n{'='*62}\n  {ok} passed, {fail} failed\n{'='*62}")
raise SystemExit(1 if fail else 0)
