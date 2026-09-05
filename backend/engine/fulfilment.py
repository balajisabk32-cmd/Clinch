"""
Multi-warehouse fulfilment allocation (PS A4 / B6).

PURE MODULE. Same contract as scoring.py: warehouses, stock and the order all
arrive as arguments. No ORM, no I/O, no globals — so allocation can be replayed
against hypothetical stock exactly the way the Policy Simulator replays scoring
against hypothetical policy.

THE COST MODEL
--------------
    cost = Σ_w (ship_cost_weight_w × units_w) + fixed_shipment_cost × |warehouses used|

The fixed per-shipment term is what makes this interesting. Without it, "minimise
cost" and "minimise shipments" would be the same objective and the toggle in the
UI would be decorative. With it, the two genuinely disagree: a cheap-per-unit
depot can still lose because opening it adds a whole shipment.

WHY EXACT, NOT GREEDY
---------------------
A greedy pass ("fill from the cheapest depot until it runs dry") is not optimal
under a fixed per-shipment cost: it will happily open a third warehouse to save a
few rupees of per-unit weight. The honest fix is to enumerate every subset of
warehouses — with W ≤ 5 that is 2^5 = 32 cases — allocate greedily *within* each
subset, and keep the cheapest feasible result. The subset choice is therefore
provably optimal rather than heuristic, which is a defensible claim to make out
loud.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations
from typing import Any, Iterable, Sequence

__all__ = [
    "Warehouse",
    "DemandLine",
    "Allocation",
    "Backorder",
    "SplitResult",
    "split_order",
    "consolidate_backorders",
]


@dataclass(frozen=True)
class Warehouse:
    name: str
    ship_cost_weight: float          # per-unit shipping weight from this site
    fixed_shipment_cost: float = 0.0  # cost of opening a shipment at all


@dataclass
class DemandLine:
    sku: str
    name: str
    qty: int
    is_physical: bool = True          # services/licences ship nothing


@dataclass
class Allocation:
    warehouse: str
    sku: str
    name: str
    qty: int
    unit_ship_cost: float

    @property
    def cost(self) -> float:
        return self.qty * self.unit_ship_cost


@dataclass
class Backorder:
    sku: str
    name: str
    qty: int
    status: str = "awaiting_stock"


@dataclass
class SplitResult:
    objective: str
    allocations: list[Allocation] = field(default_factory=list)
    backorders: list[Backorder] = field(default_factory=list)
    shipment_count: int = 0
    total_cost: float = 0.0
    warehouses_used: list[str] = field(default_factory=list)
    subsets_evaluated: int = 0
    explanation: str = ""

    @property
    def fully_allocated(self) -> bool:
        return not self.backorders

    @property
    def consolidation_available(self) -> bool:
        return bool(self.backorders)

    def to_dict(self) -> dict[str, Any]:
        return {
            "objective": self.objective,
            "allocations": [
                {
                    "warehouse": a.warehouse, "sku": a.sku, "name": a.name,
                    "qty": a.qty, "unit_ship_cost": a.unit_ship_cost,
                    "cost": round(a.cost, 2),
                }
                for a in self.allocations
            ],
            "backorders": [
                {"sku": b.sku, "name": b.name, "qty": b.qty, "status": b.status}
                for b in self.backorders
            ],
            "shipment_count": self.shipment_count,
            "total_cost": round(self.total_cost, 2),
            "warehouses_used": self.warehouses_used,
            "subsets_evaluated": self.subsets_evaluated,
            "fully_allocated": self.fully_allocated,
            "consolidation_available": self.consolidation_available,
            "explanation": self.explanation,
        }


# --------------------------------------------------------------------------- #

def _allocate_within(
    subset: Sequence[Warehouse],
    lines: Sequence[DemandLine],
    stock: dict[str, dict[str, int]],
) -> tuple[list[Allocation], list[Backorder]]:
    """Fill demand using only `subset`, cheapest site first.

    Within a fixed subset the fixed-shipment term is already decided (every site
    in the subset is being opened), so per-unit cost is the only remaining
    variable and cheapest-first is genuinely optimal here.
    """
    order = sorted(subset, key=lambda w: w.ship_cost_weight)
    remaining_stock = {w.name: dict(stock.get(w.name, {})) for w in order}

    allocations: list[Allocation] = []
    backorders: list[Backorder] = []

    for line in lines:
        if not line.is_physical:
            continue
        outstanding = line.qty
        for wh in order:
            if outstanding <= 0:
                break
            available = max(0, remaining_stock[wh.name].get(line.sku, 0))
            take = min(outstanding, available)
            if take > 0:
                allocations.append(Allocation(
                    warehouse=wh.name, sku=line.sku, name=line.name,
                    qty=take, unit_ship_cost=wh.ship_cost_weight,
                ))
                remaining_stock[wh.name][line.sku] = available - take
                outstanding -= take
        if outstanding > 0:
            backorders.append(Backorder(sku=line.sku, name=line.name, qty=outstanding))

    return allocations, backorders


def _cost_of(allocations: Iterable[Allocation], warehouses: dict[str, Warehouse]) -> tuple[float, list[str]]:
    used = sorted({a.warehouse for a in allocations})
    variable = sum(a.cost for a in allocations)
    fixed = sum(warehouses[name].fixed_shipment_cost for name in used)
    return variable + fixed, used


def split_order(
    warehouses: Sequence[Warehouse],
    lines: Sequence[DemandLine],
    stock: dict[str, dict[str, int]],
    objective: str = "cost",
) -> SplitResult:
    """Allocate an order across warehouses.

    objective="cost"      -> minimise total shipping cost including the fixed
                             per-shipment term.
    objective="shipments" -> minimise the number of distinct shipments first,
                             breaking ties on cost.

    Both objectives are evaluated over the full subset lattice, so the answer is
    optimal for the stated objective rather than a first-fit approximation.
    """
    if objective not in ("cost", "shipments"):
        raise ValueError(f"unknown objective {objective!r}")

    by_name = {w.name: w for w in warehouses}
    physical = [l for l in lines if l.is_physical and l.qty > 0]

    # Nothing physical to ship is a legitimate state (an all-services order),
    # not an error.
    if not physical:
        return SplitResult(
            objective=objective, shipment_count=0, total_cost=0.0,
            subsets_evaluated=0,
            explanation="No physical lines on this order — nothing to ship.",
        )

    best: SplitResult | None = None
    evaluated = 0

    # Enumerate every non-empty subset of warehouses. W is small by construction
    # (a handful of depots), so 2^W is trivial and the search is exhaustive.
    for size in range(1, len(warehouses) + 1):
        for subset in combinations(warehouses, size):
            evaluated += 1
            allocations, backorders = _allocate_within(subset, physical, stock)
            if not allocations:
                continue
            cost, used = _cost_of(allocations, by_name)
            unmet = sum(b.qty for b in backorders)

            candidate = SplitResult(
                objective=objective, allocations=allocations, backorders=backorders,
                shipment_count=len(used), total_cost=cost, warehouses_used=used,
            )

            # Serving the customer outranks saving money: a plan that leaves
            # fewer units on backorder always wins, whatever the objective.
            if objective == "shipments":
                key = (unmet, len(used), cost)
                best_key = (
                    sum(b.qty for b in best.backorders), best.shipment_count, best.total_cost
                ) if best else None
            else:
                key = (unmet, cost, len(used))
                best_key = (
                    sum(b.qty for b in best.backorders), best.total_cost, best.shipment_count
                ) if best else None

            if best_key is None or key < best_key:
                best = candidate

    if best is None:
        return SplitResult(
            objective=objective,
            backorders=[Backorder(sku=l.sku, name=l.name, qty=l.qty) for l in physical],
            explanation="No warehouse holds stock for any line — fully backordered.",
        )

    best.subsets_evaluated = evaluated
    unmet = sum(b.qty for b in best.backorders)
    best.explanation = (
        f"{len(best.allocations)} allocation(s) across {best.shipment_count} "
        f"warehouse(s), optimal over {evaluated} subset(s) for "
        f"{'fewest shipments' if objective == 'shipments' else 'lowest cost'}"
        + (f"; {unmet} unit(s) backordered." if unmet else ".")
    )
    return best


def consolidate_backorders(
    warehouses: Sequence[Warehouse],
    backorders: Sequence[Backorder],
    stock: dict[str, dict[str, int]],
) -> SplitResult:
    """PS B6: "If stock arrives mid fulfilment, a Consolidate Remaining Backorder
    prompt appears automatically."

    Re-runs allocation for the outstanding units alone, against replenished
    stock, minimising shipments so the remainder goes out in one parcel where it
    can.
    """
    lines = [DemandLine(sku=b.sku, name=b.name, qty=b.qty) for b in backorders]
    return split_order(warehouses, lines, stock, objective="shipments")
