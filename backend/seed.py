"""
Deterministic seed generator (CLINCH.md §9).

    python seed.py            # generate, assert the demo beats, print a report
    python seed.py --json     # emit the dataset as JSON for other tooling

WHY THIS FILE IS ON THE CRITICAL PATH
-------------------------------------
A perfect scoring engine over bland data produces a boring five minutes. Every
dramatic beat in the demo is *engineered here*: the PS §10 worked example, the
aggregate catch, the forced warehouse split, the behavioural anomaly, the
thin-history fallback, the stalled deal. So this script does not just build rows
— it ASSERTS that each beat still holds, and exits non-zero if one has broken.
If someone edits a stock level and quietly kills the forced split, they find out
here rather than on stage.

Deterministic by construction: one fixed RNG seed, no wall-clock reads. The same
bytes every run, on every laptop.
"""

from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
import time
from datetime import date, timedelta
from typing import Any

sys.path.insert(0, ".")

from api import fixtures as fx                                    # noqa: E402
from engine.scoring import DEFAULT_POLICY, Quote, score_quote      # noqa: E402

RNG_SEED = 42
TODAY = fx.TODAY

# --------------------------------------------------------------------------- #
#  Rep discounting profiles (CLINCH.md §9).
#
#  These are what make the behavioural term real rather than decorative. Each
#  rep gets a distinct median and spread, and S. Nair deliberately has too few
#  closed deals to score — which exercises the thin-history fallback on stage.
# --------------------------------------------------------------------------- #

# Imported, not redefined: fixtures owns the profiles so the app and this
# generator can never drift apart. seed.py's job is to VERIFY them.
REP_PROFILES = fx.REP_PROFILES


# Co-purchase structure and the closed-order book both live in fixtures, which
# is what the running app reads. Rebuilding them here would produce a second,
# divergent dataset and the seed would certify numbers the demo never shows.
ANCHORS = fx.CO_PURCHASE_ANCHORS


def build_history(rng: random.Random) -> dict[str, list[float]]:
    """The rep history the running app actually uses."""
    return dict(fx.REP_HISTORY)


def build_closed_orders(history: dict[str, list[float]], rng: random.Random) -> list[dict[str, Any]]:
    """The 120-order book the running app actually reads."""
    return fx.CLOSED_ORDERS


# --------------------------------------------------------------------------- #
#  The demo beats. Each is asserted, not assumed.
# --------------------------------------------------------------------------- #

def _score(ref: str, history: dict[str, list[float]]):
    quote = fx.get_quote(ref)
    if quote is None:
        raise SystemExit(f"seed: quotation {ref} is missing from fixtures")
    return quote, score_quote(DEFAULT_POLICY, quote, history.get(quote.rep_id, []))


def check_beats(history: dict[str, list[float]], orders: list[dict[str, Any]]) -> list[tuple[str, bool, str]]:
    results: list[tuple[str, bool, str]] = []

    def beat(label: str, ok: bool, detail: str = "") -> None:
        results.append((label, bool(ok), detail))

    # 1. PS §10 worked example, verbatim.
    q, r = _score("Q-1042", history)
    svc = next((l for l in r.lines if l["sku"] == "SVC-ONSITE"), None)
    beat("Q-1042 reproduces PS §10",
         svc is not None and svc["over"] == 8.0 and r.band == "MANAGER",
         f"score {r.score} -> {r.band}, Setup Service {svc['over'] if svc else '?'} pts over")

    # 2. The aggregate catch: no line badly over, flagged anyway.
    q39, r39 = _score("Q-1039", history)
    worst = max((l["over"] for l in r39.lines), default=0)
    beat("Q-1039 aggregate catch",
         worst <= 3.0 and r39.band != "AUTO" and r39.contributions["A"] > r39.contributions["S"],
         f"worst line {worst} pts, score {r39.score}, A={r39.contributions['A']} > S={r39.contributions['S']}")

    # 3. Forced multi-warehouse split with a real backorder.
    need = next((qty for sku, qty, _ in fx.QUOTE_ROWS["Q-1044"]["lines"] if sku == "LP14"), 0)
    have = sum(fx.available(w["name"], "LP14") for w in fx.WAREHOUSES)
    single = max(fx.available(w["name"], "LP14") for w in fx.WAREHOUSES)
    beat("Q-1044 forces a two-depot split + backorder",
         need > single and need > have,
         f"need {need}, best single depot {single}, total {have} -> {need - have} backordered")

    # 4. Behavioural anomaly on a disciplined rep.
    _, r46 = _score("Q-1046", history)
    beat("Q-1046 behavioural anomaly fires",
         r46.contributions.get("Z", 0) > 6,
         f"Z contributes {r46.contributions.get('Z', 0)} of {r46.score}")

    # 5. Thin history -> Z dropped and weights renormalised.
    _, r47 = _score("Q-1047", history)
    beat("Q-1047 thin-history fallback",
         "Z" not in r47.terms
         and abs(sum(r47.weights_used.values()) - 1.0) < 1e-6
         and any("Insufficient" in n for n in r47.notes),
         f"weights renormalised to {sum(r47.weights_used.values()):.3f}")

    # 6. Stalled deal.
    idle = fx.days_idle("Q-1031")
    beat("Q-1031 is stalled", idle >= DEFAULT_POLICY.stall_days,
         f"{idle} days idle vs {DEFAULT_POLICY.stall_days}-day threshold")

    # 7. Rep profiles land on their targets.
    for p in REP_PROFILES:
        h = history[p["id"]]
        if len(h) < 5:
            beat(f"{p['name']} thin history", len(h) == p["deals"], f"{len(h)} deals (intentional)")
            continue
        med = statistics.median(h)
        mad = statistics.median([abs(x - med) for x in h])
        beat(f"{p['name']} profile",
             abs(med - p["median"]) < 0.6 and abs(mad - p["mad"]) < 0.9 and len(h) == p["deals"],
             f"median {med:.1f} (want {p['median']}), MAD {mad:.1f} (want {p['mad']}), {len(h)} deals")

    beat("120 closed orders generated", len(orders) == 120, f"{len(orders)} orders")

    # 8. Leakage headline is non-trivial and computed.
    leaked = margin = 0.0
    for o in orders:
        oq = Quote(ref=o["ref"], customer=o["customer"],
                   tier=fx.CUSTOMERS[o["customer"]]["tier"], rep_id=o["rep"],
                   lines=[fx.make_line(s, q_, d) for s, q_, d in o["lines"]])
        res = score_quote(DEFAULT_POLICY, oq, history[o["rep"]])
        leaked += res.leaked_total
        margin += res.order_margin
    ratio = (leaked / margin) if margin else 0
    beat("Leakage headline is material",
         leaked > 0 and 0.001 < ratio < 0.5,
         f"Rs {leaked:,.0f} across {len(orders)} orders = {ratio * 100:.2f}% of gross margin")

    return results


def main() -> int:
    ap = argparse.ArgumentParser(description="Clinch deterministic seed generator")
    ap.add_argument("--json", action="store_true", help="emit the dataset as JSON")
    args = ap.parse_args()

    started = time.perf_counter()
    rng = random.Random(RNG_SEED)
    history = build_history(rng)
    orders = build_closed_orders(history, rng)
    elapsed = time.perf_counter() - started

    if args.json:
        json.dump({"history": history, "closed_orders": orders,
                   "open_quotes": list(fx.QUOTE_ROWS.values()),
                   "products": fx.PRODUCTS, "warehouses": fx.WAREHOUSES,
                   "stock": fx.STOCK},
                  sys.stdout, indent=1)
        return 0

    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    print(f"\nClinch seed  ·  RNG seed {RNG_SEED}  ·  generated in {elapsed * 1000:.0f} ms")
    print("-" * 74)
    for p in REP_PROFILES:
        h = history[p["id"]]
        med = statistics.median(h)
        mad = statistics.median([abs(x - med) for x in h]) if len(h) > 1 else 0.0
        print(f"  {p['name']:<9} {len(h):>3} deals   median {med:>5.1f}%   MAD {mad:>4.1f}   {p['note']}")
    print("-" * 74)

    results = check_beats(history, orders)
    for label, ok, detail in results:
        print(f"  [{'PASS' if ok else 'FAIL'}] {label:<42} {detail}")

    failed = [r for r in results if not r[1]]
    print("-" * 74)
    if failed:
        print(f"{len(failed)} BEAT(S) BROKEN — fix before demoing\n")
        return 1
    print(f"ALL {len(results)} DEMO BEATS HOLD  ·  seed completed in {elapsed * 1000:.0f} ms\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
