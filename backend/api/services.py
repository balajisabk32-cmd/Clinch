"""Shared derivations used by more than one router.

Kept out of the routers so that the narrative, the totals and the portal
redaction have exactly one implementation each. Two implementations of "order
total" that disagree by a rupee is the kind of bug that surfaces on stage.
"""

from __future__ import annotations

import time
from typing import Any

from engine.recommender import build_index
from engine.scoring import Policy, Quote, RiskResult, score_quote

from . import fixtures as fx
from . import state

# Built once at import: ~120 historical baskets -> co-occurrence statistics.
CO_PURCHASE_INDEX = build_index(
    [[sku for sku, _q, _d in o["lines"]] for o in fx.CLOSED_ORDERS]
)


# --------------------------------------------------------------------------- #
#  Totals
# --------------------------------------------------------------------------- #

def totals(quote: Quote) -> dict[str, float]:
    def net_of(l):
        return l.gross * (1 - quote.effective_discount(l) / 100.0)

    subtotal = sum(l.gross for l in quote.lines)
    net = sum(net_of(l) for l in quote.lines)
    recurring = sum(net_of(l) for l in quote.lines if l.is_recurring)
    margin = sum((l.list_price - l.cost) * l.qty for l in quote.lines)
    discounted_margin = net - sum(l.cost * l.qty for l in quote.lines)
    tax = net * 0.18
    return {
        "subtotal": round(subtotal, 2),
        "discount_total": round(subtotal - net, 2),
        "tax_total": round(tax, 2),
        "total": round(net + tax, 2),
        "total_recurring": round(recurring, 2),
        "margin": round(margin, 2),
        "margin_pct": round(100.0 * discounted_margin / net, 1) if net else 0.0,
    }


def score_for(ref: str, policy: Policy | None = None) -> tuple[Quote, RiskResult]:
    quote = state.build_quote(ref)
    if quote is None:
        raise KeyError(ref)
    p = policy or state.get_policy()
    return quote, score_quote(p, quote, fx.history_for(quote.rep_id))


# --------------------------------------------------------------------------- #
#  Narrator.
#
#  CLINCH.md 5, Failure Point 1: the LLM is an UPGRADE, never a dependency. This
#  template path is the guaranteed one; an LLM call would sit in front of it with
#  a 3-second timeout and fall back to exactly this text. Venue wifi at peak, with
#  every team demoing at once, is the most common live-demo death there is.
# --------------------------------------------------------------------------- #

def narrate(quote: Quote, r: RiskResult, days_idle: int = 0) -> str:
    if not quote.lines:
        return "Empty quotation — add a product line to see a risk assessment."

    breaches = [l for l in r.lines if not l["ok"]]
    bits: list[str] = []

    if not breaches:
        bits.append("Every line is within its discount ceiling.")
    elif len(breaches) == 1:
        b = breaches[0]
        bits.append(
            f"{b['name']} is {b['over']:.0f} points over its "
            f"{b['allowed']:.0f}% {b['category']} ceiling "
            f"({b['given']:.0f}% given)."
        )
    else:
        worst = max(breaches, key=lambda b: b["over"])
        bits.append(
            f"{len(breaches)} lines are over their ceilings — worst is "
            f"{worst['name']} at {worst['over']:.0f} points over. "
            f"No single line looks alarming, but the pattern across the order does."
        )

    if r.leaked_total > 0:
        bits.append(f"That is ₹{r.leaked_total:,.0f} discounted beyond policy.")

    if r.contributions.get("Z", 0) > 6:
        bits.append("The discount is also well above this rep's own historical average.")

    route = {
        "AUTO": "No approval needed.",
        "MANAGER": "Routing to Sales Manager.",
        "FINANCE": "Blended risk is high enough to require Sales Manager, then Finance.",
    }[r.band]
    bits.append(f"Blended score {r.score:.0f} — {route}")

    if days_idle > 0:
        bits.append(f"No activity for {days_idle} day{'s' if days_idle != 1 else ''}.")

    return " ".join(bits)


# --------------------------------------------------------------------------- #
#  Portfolio-level metrics. Computed, never hardcoded (CLINCH.md 1.1).
# --------------------------------------------------------------------------- #

def leakage_report(policy: Policy | None = None) -> dict[str, Any]:
    """The cold-open number: how much was discounted beyond policy across all
    CLOSED business. Derived from data in the room, so it survives "source?"."""
    p = policy or state.get_policy()
    leaked = margin = revenue = 0.0
    disc_weighted = 0.0
    for q in fx.closed_as_quotes():
        r = score_quote(p, q, fx.history_for(q.rep_id))
        leaked += r.leaked_total
        margin += r.order_margin
        revenue += r.order_revenue
        disc_weighted += sum(l.discount_pct * l.gross for l in q.lines)
    return {
        "leakage_total": round(leaked, 2),
        "leakage_ratio": round(leaked / margin, 4) if margin else 0.0,
        "gross_margin": round(margin, 2),
        "revenue": round(revenue, 2),
        "avg_discount_pct": round(disc_weighted / revenue, 2) if revenue else 0.0,
        "closed_orders_analysed": len(fx.CLOSED_ORDERS),
    }


def open_pipeline(policy: Policy | None = None) -> list[dict[str, Any]]:
    p = policy or state.get_policy()
    out = []
    for q in (state.build_quote(ref) for ref in state.QUOTES):
        r = score_quote(p, q, fx.history_for(q.rep_id))
        t = totals(q)
        out.append(dict(quote=q, result=r, totals=t,
                        state=state.state_of(q.ref),
                        days_idle=fx.days_idle(q.ref)))
    return out


def simulate(overrides: dict[str, Any]) -> dict[str, Any]:
    """THE 10X ANGLE (CLINCH.md 2.2).

    Re-score every open quotation against a policy that has NOT been saved, and
    report the blast radius. This is a ~40 line function purely because
    score_quote() takes policy as an argument and touches no I/O -- faking this
    would be strictly harder than building it.
    """
    started = time.perf_counter()
    live = state.get_policy()
    clean = {k: v for k, v in overrides.items() if v is not None}
    proposed = live.clone(**clean) if clean else live

    impacts: list[dict[str, Any]] = []
    before_counts = {"AUTO": 0, "MANAGER": 0, "FINANCE": 0}
    after_counts = {"AUTO": 0, "MANAGER": 0, "FINANCE": 0}
    leak_before = leak_after = 0.0
    rank = {"AUTO": 0, "MANAGER": 1, "FINANCE": 2}

    for q in (state.build_quote(ref) for ref in state.QUOTES):
        hist = fx.history_for(q.rep_id)
        b = score_quote(live, q, hist)
        a = score_quote(proposed, q, hist)
        before_counts[b.band] += 1
        after_counts[a.band] += 1
        leak_before += b.leaked_total
        leak_after += a.leaked_total

        if a.band == b.band:
            direction = "unchanged"
        elif rank[a.band] > rank[b.band]:
            direction = "escalated"
        else:
            direction = "relaxed"

        impacts.append(dict(
            ref=q.ref, customer=q.customer, total=totals(q)["total"],
            score_before=b.score, score_after=a.score,
            band_before=b.band, band_after=a.band,
            leaked_before=round(b.leaked_total, 2),
            leaked_after=round(a.leaked_total, 2),
            changed=a.band != b.band, direction=direction,
        ))

    escalated = sum(1 for i in impacts if i["direction"] == "escalated")
    relaxed = sum(1 for i in impacts if i["direction"] == "relaxed")
    changed = escalated + relaxed
    recovered = leak_after - leak_before

    # Sort so the movers are at the top of the pipeline strip on screen.
    impacts.sort(key=lambda i: (not i["changed"], -abs(i["score_after"] - i["score_before"])))

    if changed:
        headline = (
            f"Re-routes {changed} of {len(impacts)} open deals · "
            f"exposes ₹{abs(recovered):,.0f} of "
            f"{'leaking' if recovered >= 0 else 'over-governed'} margin"
        )
    else:
        headline = f"No change to any of {len(impacts)} open deals."

    return dict(
        proposed=_policy_dict(proposed),
        impacts=impacts,
        quotes_evaluated=len(impacts),
        quotes_changed=changed,
        escalated=escalated,
        relaxed=relaxed,
        leakage_before=round(leak_before, 2),
        leakage_after=round(leak_after, 2),
        leakage_recovered=round(recovered, 2),
        band_counts_before=before_counts,
        band_counts_after=after_counts,
        headline=headline,
        elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
    )


def _policy_dict(p: Policy) -> dict[str, Any]:
    return dict(
        tier_ceiling=p.tier_ceiling, category_ceiling=p.category_ceiling,
        weights=p.weights, caps=p.caps, bands=p.bands,
        hard_override_pts=p.hard_override_pts, stall_days=p.stall_days,
        version=p.version, warnings=p.dead_config_warnings(),
    )
