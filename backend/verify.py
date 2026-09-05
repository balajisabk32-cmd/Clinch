"""Pre-demo smoke check. Run this before every rehearsal and before presenting.

Asserts the six seeded demo beats still hold. If someone edits stock levels or a
discount and quietly breaks the forced warehouse split, you find out here rather
than on stage.
"""
import sys
sys.path.insert(0, ".")

# Windows consoles default to cp1252 and choke on the rupee sign. JSON over HTTP
# is UTF-8 so the browser is unaffected, but CLI output needs this.
try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass
from fastapi.testclient import TestClient
from api.main import app
c = TestClient(app)
ok = True

def check(label, cond, detail=""):
    global ok
    ok = ok and bool(cond)
    print(f"  [{'PASS' if cond else 'FAIL'}] {label}{(' - ' + detail) if detail else ''}")

print("\nDealFlow360 pre-demo check\n" + "-" * 58)
s = c.post("/quotes/Q-1042/score").json()
check("PS s10 example reproduces", s["band"] == "MANAGER" and
      next(l for l in s["lines"] if l["sku"] == "SVC-ONSITE")["over"] == 8.0,
      f"score {s['score']}")
a = c.post("/quotes/Q-1039/score").json()
check("aggregate case is caught", a["band"] != "AUTO" and
      a["contributions"]["A"] > a["contributions"]["S"],
      f"A={a['contributions']['A']} > S={a['contributions']['S']}")
sim = c.post("/policy/simulate", json={"category_ceiling": {
    "Hardware": 15.0, "Software": 15.0, "Services": 8.0, "Subscriptions": 12.0}}).json()
check("policy simulator ripples", sim["escalated"] >= 3, sim["headline"])
check("simulator is fast enough", sim["elapsed_ms"] < 400, f"{sim['elapsed_ms']} ms")
sp = c.post("/orders/Q-1044/split").json()
check("warehouse split is forced", len({x["warehouse"] for x in sp["allocations"]
                                        if x["sku"] == "LP14"}) == 2)
check("backorder prompt fires", bool(sp["backorders"]))
p = c.get("/portal/acme-q1042-7f3a9c").text.lower()
check("portal leaks nothing", not any(f'"{k}"' in p for k in
      ("cost", "margin", "risk_score", "ceiling", "over")))
d = c.get("/dashboard").json()
check("leakage is computed", d["leakage_total"] > 0 and d["closed_orders_analysed"] == 120,
      f"Rs {d['leakage_total']:,.0f} over {d['closed_orders_analysed']} orders")
check("stalled deal alerts", any(x["kind"] == "stalled" for x in d["alerts"]))
co = c.post("/quotes/Q-1042/coach").json()
check("coach is compliant", co["available"] and co["fully_compliant_after"], co["message"])
rec = c.post("/quotes/Q-1042/recommend").json()
check("recommender has real lift", rec["basis"] == "co-purchase" and
      rec["suggestions"][0]["lift"] > 1.0,
      f"top {rec['suggestions'][0]['sku']} lift {rec['suggestions'][0]['lift']}")
r = c.post("/admin/reset").json()
check("demo reset is instant", r["elapsed_ms"] < 2000, f"{r['elapsed_ms']} ms")
print("-" * 58)
print(("ALL DEMO BEATS HOLD" if ok else "SOMETHING IS BROKEN - FIX BEFORE DEMO") + "\n")
sys.exit(0 if ok else 1)
