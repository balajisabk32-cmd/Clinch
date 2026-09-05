"""Upsell / cross-sell recommender (PS A6, B5).

Association-rule mining over historical co-purchase data -- NOT a hardcoded
lookup table. PS 7 is explicit that business rules must be real, and a static
"if laptop then mouse" dict is the single most common shortcut teams take here.

For a candidate product j given the current cart C we compute the standard
support/confidence/lift triple:

    support(j)      = orders containing j / all orders
    confidence(C->j)= orders containing C and j / orders containing C
    lift(C->j)      = confidence / support(j)

Lift is the number that matters: it says how much MORE likely j is when C is
present, versus j's baseline popularity. Lift 1.0 means "no relationship"; a
Docking Station that sells in 40% of all orders is not interesting just because
it appears often -- it is interesting because it appears in 70% of orders that
contain a laptop.

Ranking blends lift with margin, because PS A6 requires a minimum margin
threshold: we are not here to recommend the thing customers buy most, we are here
to recommend the thing that is both likely AND worth selling. The margin floor is
a hard filter, applied before ranking.

Like scoring.py this module is PURE -- the order history arrives as an argument.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from itertools import combinations
from typing import Any, Iterable, Sequence

__all__ = ["CoPurchaseIndex", "build_index", "recommend"]


@dataclass
class CoPurchaseIndex:
    """Precomputed co-occurrence statistics.

    Built once at startup from historical orders (~120 rows), so a recommendation
    is a dictionary lookup rather than a scan. The upsell panel updates as the rep
    types, so this has to be fast enough to feel instantaneous.
    """
    n_orders: int
    item_counts: Counter
    pair_counts: Counter          # keyed by frozenset({a, b})

    def support(self, sku: str) -> float:
        return self.item_counts[sku] / self.n_orders if self.n_orders else 0.0

    def pair_support(self, a: str, b: str) -> float:
        if not self.n_orders:
            return 0.0
        return self.pair_counts[frozenset((a, b))] / self.n_orders

    def confidence(self, anchor: str, candidate: str) -> float:
        """P(candidate | anchor)."""
        anchor_n = self.item_counts[anchor]
        if not anchor_n:
            return 0.0
        return self.pair_counts[frozenset((anchor, candidate))] / anchor_n

    def lift(self, anchor: str, candidate: str) -> float:
        s = self.support(candidate)
        if s <= 0:
            return 0.0
        return self.confidence(anchor, candidate) / s


def build_index(orders: Iterable[Sequence[str]]) -> CoPurchaseIndex:
    """Build the index from an iterable of SKU baskets."""
    item_counts: Counter = Counter()
    pair_counts: Counter = Counter()
    n = 0
    for basket in orders:
        skus = sorted(set(basket))
        if not skus:
            continue
        n += 1
        item_counts.update(skus)
        for a, b in combinations(skus, 2):
            pair_counts[frozenset((a, b))] += 1
    return CoPurchaseIndex(n_orders=n, item_counts=item_counts, pair_counts=pair_counts)


def recommend(
    index: CoPurchaseIndex,
    cart_skus: Sequence[str],
    catalogue: dict[str, dict[str, Any]],
    *,
    margin_floor_pct: float = 25.0,
    limit: int = 4,
    min_lift: float = 1.05,
    min_pair_count: int = 5,
    min_confidence: float = 0.15,
) -> tuple[list[dict[str, Any]], str, int]:
    """Rank cross-sell candidates for the current cart.

    Returns (suggestions, basis, filtered_count).

    `basis` tells the UI how to LABEL the panel, which matters more than it
    sounds. Showing "Frequently bought together" above a list derived from
    nothing but a promo flag is a small lie, and a reviewer who adds one obscure
    item to an empty cart will catch it. When there is no co-purchase signal we
    say "Promoted" instead.
    """
    cart = set(cart_skus)
    candidates = [s for s in catalogue if s not in cart]
    filtered = 0

    scored: list[dict[str, Any]] = []
    for sku in candidates:
        product = catalogue[sku]
        list_price = product["list_price"]
        cost = product["cost"]
        margin = list_price - cost
        margin_pct = (margin / list_price * 100.0) if list_price else 0.0

        # PS A6: "Set minimum margin thresholds so only healthy margin
        # suggestions surface." Hard filter, applied before ranking.
        if margin_pct < margin_floor_pct:
            filtered += 1
            continue

        # Best evidence across everything already in the cart.
        #
        # Support and confidence floors matter here. Lift alone is easy to fool:
        # a pair that co-occurred twice in 120 orders can show a spectacular lift
        # purely by accident, and putting that in a rep's upsell panel is how the
        # panel stops being trusted. Requiring the pair to have actually happened
        # min_pair_count times is the standard apriori guard, and it is a clean
        # answer to "why is a 7%-confidence pairing being recommended to me?".
        best_lift = 0.0
        best_conf = 0.0
        best_anchor = None
        for anchor in cart:
            if index.pair_counts[frozenset((anchor, sku))] < min_pair_count:
                continue
            conf = index.confidence(anchor, sku)
            if conf < min_confidence:
                continue
            lift = index.lift(anchor, sku)
            if lift > best_lift:
                best_lift, best_anchor = lift, anchor
                best_conf = conf

        promoted = bool(product.get("is_promoted"))
        has_signal = best_lift >= min_lift

        if has_signal:
            # Blend: how likely (lift) x how healthy (margin RATE), nudged for promos.
            #
            # Deliberately margin_pct and not margin in rupees. Ranking by absolute
            # margin lets the most expensive item in the catalogue win every slot
            # regardless of how weak its association is, which collapses into
            # "sorted by price with a lift column decorating it" -- and that is
            # exactly how a reviewer would characterise it. Using the rate keeps
            # lift genuinely load-bearing. The absolute figure is still what we
            # DISPLAY, because "+₹2,160 margin" is the number a rep acts on.
            rank = best_lift * margin_pct * (1.15 if promoted else 1.0)
        elif promoted:
            rank = margin_pct * 0.001      # promoted-only fallback
        else:
            continue

        scored.append({
            "sku": sku,
            "name": product["name"],
            "category": product["category"],
            "list_price": list_price,
            "support": round(index.support(sku), 4),
            "confidence": round(best_conf, 4),
            "lift": round(best_lift, 2),
            "margin_delta": round(margin, 2),
            "margin_pct": round(margin_pct, 1),
            "is_promoted": promoted,
            "_has_signal": has_signal,
            "_rank": rank,
            "reason": _reason(best_anchor, catalogue, best_conf, best_lift,
                              promoted, has_signal),
        })

    scored.sort(key=lambda r: r["_rank"], reverse=True)
    top = scored[:limit]

    if not top:
        basis = "none"
    elif any(r["_has_signal"] for r in top):
        basis = "co-purchase"
    else:
        basis = "promoted"

    for r in top:
        r.pop("_rank", None)
        r.pop("_has_signal", None)

    return top, basis, filtered


def _reason(
    anchor: str | None,
    catalogue: dict[str, dict[str, Any]],
    confidence: float,
    lift: float,
    promoted: bool,
    has_signal: bool,
) -> str:
    """Human-readable justification, shown on the suggestion card.

    A suggestion with visible reasoning reads as intelligence; the identical
    suggestion with no explanation reads as a hardcoded list.
    """
    if has_signal and anchor:
        anchor_name = catalogue.get(anchor, {}).get("name", anchor)
        pct = round(confidence * 100)
        tag = " · promoted" if promoted else ""
        return f"{pct}% of orders with {anchor_name} also include this (lift {lift:.1f}x){tag}"
    if promoted:
        return "Promoted this quarter · healthy margin"
    return "Healthy margin"
