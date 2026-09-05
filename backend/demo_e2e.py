"""
End-to-end demo walkthrough against a RUNNING server.

`verify.py` checks the engine in-process. This drives the real HTTP surface the
way a reviewer will: log in as each role, walk PS §9's eight steps in order, and
fail loudly if any of them stops producing a visible, correct result.

    python demo_e2e.py                  # against http://127.0.0.1:8100
    python demo_e2e.py --base URL       # anywhere else
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.request

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


class Api:
    def __init__(self, base: str) -> None:
        self.base = base.rstrip("/")

    def __call__(self, method: str, path: str, body=None, token: str | None = None):
        req = urllib.request.Request(f"{self.base}{path}", method=method)
        req.add_header("Content-Type", "application/json")
        if token:
            req.add_header("Authorization", f"Bearer {token}")
        data = json.dumps(body).encode() if body is not None else None
        try:
            with urllib.request.urlopen(req, data, timeout=10) as r:
                raw = r.read()
                return r.status, (json.loads(raw) if raw else {})
        except urllib.error.HTTPError as e:
            raw = e.read()
            try:
                return e.code, json.loads(raw or b"{}")
            except json.JSONDecodeError:
                return e.code, {"_raw": raw.decode(errors="replace")[:200]}
        except urllib.error.URLError as e:
            raise SystemExit(f"\nCannot reach {self.base} — is the API running?\n  {e}\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="http://127.0.0.1:8100")
    args = ap.parse_args()
    api = Api(args.base)

    results: list[tuple[bool, str, str]] = []

    def step(n, label: str, ok: bool, detail: str = "") -> None:
        results.append((bool(ok), f"Step {n}. {label}", detail))

    api("POST", "/admin/reset")
    print(f"\nCLINCH — end-to-end walkthrough against {args.base}")
    print("=" * 86)

    # 1 ---------------------------------------------------------------- login
    _, rep = api("POST", "/auth/login", {"email": "rao@dealflow.example"})
    _, mgr = api("POST", "/auth/login", {"email": "shah@dealflow.example"})
    _, fin = api("POST", "/auth/login", {"email": "menon@dealflow.example"})
    _, pol = api("GET", "/policy")
    _, whs = api("GET", "/warehouses")
    _, subs = api("GET", "/subscriptions")
    step(1, "Login + backend setup present",
         rep.get("user", {}).get("role") == "rep"
         and pol["tier_ceiling"]["Gold"] == 15.0 and len(whs) >= 2 and len(subs) >= 1,
         f"{len(whs)} depots · Gold {pol['tier_ceiling']['Gold']}% · {len(subs)} plans")

    # 2 -------------------------------------------------- over-limit discount
    _, q = api("GET", "/quotes/Q-1042")
    svc = next((l for l in q["lines"] if l["sku"] == "SVC-ONSITE"), None)
    step(2, "Over-limit line recognised",
         bool(svc) and svc["over"] == 8.0,
         f"Setup Service {svc['effective_discount']}% vs {svc['ceiling']}% ceiling "
         f"= {svc['over']} pts over")

    # 4 --------------------------------------------------------- upsell beat
    # Runs BEFORE the submit even though the spec numbers it after: PS §9 says
    # "while building the quote, accept one upsell suggestion", and a submitted
    # quotation is correctly locked against edits. Doing it in printed order
    # would test nothing except our own 409.
    _, before = api("GET", "/quotes/Q-1042")
    _, recs = api("POST", "/quotes/Q-1042/recommend")
    top = (recs.get("suggestions") or [{}])[0]
    code, after = api("POST", "/quotes/Q-1042/lines",
                      {"sku": top.get("sku"), "qty": 1}, rep["token"])
    step(4, "Upsell updates total and margin at once",
         code == 200
         and isinstance(after.get("margin_pct"), (int, float))
         and isinstance(before.get("margin_pct"), (int, float))
         and after["total"] > before["total"]
         and after["margin_pct"] != before["margin_pct"],
         f"{top.get('sku')} lift {top.get('lift')} · margin "
         f"{before.get('margin_pct')}% → {after.get('margin_pct')}% · "
         f"total {before.get('total'):,.0f} → {after.get('total', 0):,.0f}")

    # 3 ------------------------------------------------ automatic escalation
    _, sub = api("POST", "/quotes/Q-1042/submit", {}, rep["token"])
    step(3, "Auto-routed for approval, unasked",
         sub.get("auto_routed") and sub.get("state") == "PENDING_MANAGER",
         f"score {sub.get('risk_score')} → {sub.get('state')}")

    # And a submitted quotation must refuse further edits.
    code, _ = api("POST", "/quotes/Q-1042/lines",
                  {"sku": "DOCK-01", "qty": 1}, rep["token"])
    step(3.5, "Submitted quote is locked against edits", code == 409, f"HTTP {code}")

    # 5 ------------------------------------------------- multi-warehouse split
    _, sp = api("POST", "/orders/Q-1044/split?objective=cost")
    depots = {a["warehouse"] for a in sp.get("allocations", []) if a["sku"] == "LP14"}
    back = sum(b["qty"] for b in sp.get("backorders", []))
    step(5, "Split across two depots + backorder",
         len(depots) == 2 and back > 0,
         f"{len(depots)} depots · {back} unit(s) backordered · {sp.get('subsets_evaluated')} subsets searched")

    # 6 --------------------------------------------------------- hybrid billing
    _, led = api("GET", "/orders/Q-1042/billing")
    _, pr = api("POST", "/subscriptions/1/change", {"new_qty": 5}, fin["token"])
    step(6, "One-time + recurring billed separately",
         led.get("one_time_total", 0) > 0 and led.get("recurring_total", 0) > 0
         and pr.get("kind") == "credit_note",
         pr.get("formula", ""))

    # 7 ------------------------------------------------------- portal counter
    api("POST", "/approvals/Q-1042/action",
        {"action": "approve", "actor": "M. Shah"}, mgr["token"])
    _, ctr = api("POST", "/portal/acme-q1042-7f3a9c/request",
                 {"line_id": 1, "counter_discount_pct": 28.0,
                  "comment": "Better rate on the setup service?"})
    _, praw = api("GET", "/portal/acme-q1042-7f3a9c")
    leaked = [k for k in ("cost", "margin", "risk_score", "ceiling", "over")
              if f'"{k}"' in json.dumps(praw)]
    step(7, "Counter re-enters approval · portal leaks nothing",
         ctr.get("re_entered_approval") and ctr.get("state") == "PENDING_MANAGER"
         and not leaked,
         f"state {ctr.get('state')} · leaked fields: {leaked or 'none'}")

    # 8 -------------------------------------------------- invoice and payment
    api("POST", "/approvals/Q-1042/action",
        {"action": "approve", "actor": "M. Shah"}, mgr["token"])
    api("POST", "/orders/Q-1042/confirm", {})
    _, inv = api("POST", "/orders/Q-1042/invoice", {}, fin["token"])
    _, paid = api("POST", f"/invoices/{inv.get('ref')}/payment",
                  {"amount": inv.get("amount"), "method": "bank_transfer"}, fin["token"])
    step(8, "Invoice → payment → PAID",
         paid.get("status") == "paid" and paid.get("order_state") == "PAID",
         f"{inv.get('ref')} {inv.get('amount', 0):,.0f} → {paid.get('status')} · "
         f"order {paid.get('order_state')}")

    # ------------------------------------------------------------- guardrails
    code, _ = api("POST", "/approvals/Q-1039/action", {"action": "approve"}, rep["token"])
    step(9, "A rep cannot approve (RBAC enforced server-side)", code == 403,
         f"HTTP {code}")

    _, reset = api("POST", "/admin/reset")
    step(10, "Demo reset restores golden state",
         reset.get("ok") and reset.get("elapsed_ms", 9999) < 2000,
         f"{reset.get('elapsed_ms')} ms")

    for ok, label, detail in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label:<48} {detail}")
    print("=" * 86)

    failed = [r for r in results if not r[0]]
    if failed:
        print(f"{len(failed)} STEP(S) FAILED — fix before demoing\n")
        return 1
    print(f"ALL {len(results)} STEPS PASS END TO END\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
