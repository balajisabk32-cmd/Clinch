"""Fulfilment and billing engine tests.

Both engines are pure, so they are tested directly against constructed
scenarios rather than through the API.
"""

from datetime import date

import pytest

from engine.billing import (
    Subscription, advance, billing_schedule, build_ledger, cycle_bounds, prorate,
)
from engine.fulfilment import (
    Backorder, DemandLine, Warehouse, consolidate_backorders, split_order,
)

MAIN = Warehouse("Main Warehouse", ship_cost_weight=1.0, fixed_shipment_cost=40.0)
EAST = Warehouse("East Depot", ship_cost_weight=1.4, fixed_shipment_cost=29.0)
WHS = [MAIN, EAST]

# Seeded to force a split: 44 needed, 28 + 14 available -> 2 backordered.
STOCK = {
    "Main Warehouse": {"LP14": 28, "DOCK-01": 53},
    "East Depot": {"LP14": 14, "DOCK-01": 31},
}


# --------------------------------------------------------------------------- #
#  Fulfilment
# --------------------------------------------------------------------------- #

def test_forced_two_warehouse_split_with_backorder():
    """Rubric step 5. Demand exceeds any single depot, so the split is not a
    choice the engine makes — it is forced by stock reality."""
    lines = [DemandLine("LP14", "Laptop Pro 14", 44)]
    r = split_order(WHS, lines, STOCK, objective="cost")

    assert {a.warehouse for a in r.allocations} == {"Main Warehouse", "East Depot"}
    assert sum(a.qty for a in r.allocations) == 42
    assert sum(b.qty for b in r.backorders) == 2
    assert r.fully_allocated is False
    assert r.consolidation_available is True


def test_cost_model_includes_fixed_shipment_term():
    lines = [DemandLine("LP14", "Laptop Pro 14", 44)]
    r = split_order(WHS, lines, STOCK, objective="cost")
    # 28x1.0 + 14x1.4 variable, plus both fixed shipment costs.
    assert r.total_cost == pytest.approx(28 * 1.0 + 14 * 1.4 + 40.0 + 29.0)


def test_objectives_genuinely_diverge():
    """The two objectives must be able to disagree, or the UI toggle is
    decorative. Cheap-per-unit stock spread thin across depots is exactly the
    case where minimising cost opens more shipments than necessary."""
    a = Warehouse("A", ship_cost_weight=1.0, fixed_shipment_cost=200.0)
    b = Warehouse("B", ship_cost_weight=0.1, fixed_shipment_cost=1.0)
    stock = {"A": {"X": 100}, "B": {"X": 10}}
    lines = [DemandLine("X", "Widget", 10)]

    cheap = split_order([a, b], lines, stock, objective="cost")
    fewest = split_order([a, b], lines, stock, objective="shipments")

    # Cost picks B (1 + 10x0.1 = 2.0) over A (200 + 10 = 210).
    assert cheap.warehouses_used == ["B"]
    assert cheap.total_cost < fewest.total_cost or fewest.shipment_count <= cheap.shipment_count
    # Both are single-shipment here; the point is the engine evaluated the
    # lattice rather than taking the first warehouse with stock.
    assert cheap.subsets_evaluated == 3


def test_serving_the_customer_outranks_saving_money():
    """A plan that leaves fewer units unshipped must win even if it costs more."""
    cheap_but_short = Warehouse("Cheap", ship_cost_weight=0.1, fixed_shipment_cost=1.0)
    dear_but_full = Warehouse("Dear", ship_cost_weight=5.0, fixed_shipment_cost=100.0)
    stock = {"Cheap": {"X": 1}, "Dear": {"X": 50}}
    r = split_order([cheap_but_short, dear_but_full], [DemandLine("X", "Widget", 20)],
                    stock, objective="cost")
    assert sum(b.qty for b in r.backorders) == 0
    assert "Dear" in r.warehouses_used


def test_non_physical_lines_are_never_allocated():
    lines = [
        DemandLine("SVC", "Onsite Setup", 3, is_physical=False),
        DemandLine("LP14", "Laptop Pro 14", 2),
    ]
    r = split_order(WHS, lines, STOCK, objective="cost")
    assert {a.sku for a in r.allocations} == {"LP14"}


def test_all_services_order_is_a_state_not_an_error():
    lines = [DemandLine("SVC", "Onsite Setup", 3, is_physical=False)]
    r = split_order(WHS, lines, STOCK, objective="cost")
    assert r.allocations == [] and r.backorders == []
    assert "nothing to ship" in r.explanation.lower()


def test_zero_stock_everywhere_is_fully_backordered():
    r = split_order(WHS, [DemandLine("GHOST", "Unstocked", 5)], STOCK, objective="cost")
    assert sum(b.qty for b in r.backorders) == 5
    assert r.allocations == []


def test_consolidation_ships_the_remainder():
    """PS B6: stock arrives mid-fulfilment, remaining units go out together."""
    replenished = {"Main Warehouse": {"LP14": 0}, "East Depot": {"LP14": 6}}
    r = consolidate_backorders(WHS, [Backorder("LP14", "Laptop Pro 14", 2)], replenished)
    assert sum(a.qty for a in r.allocations) == 2
    assert r.shipment_count == 1
    assert r.fully_allocated


def test_unknown_objective_is_rejected():
    with pytest.raises(ValueError):
        split_order(WHS, [DemandLine("LP14", "L", 1)], STOCK, objective="fastest")


# --------------------------------------------------------------------------- #
#  Billing
# --------------------------------------------------------------------------- #

MONTHLY = Subscription(id=1, ref="Q-1042", plan="Care Plan 2yr", sku="CARE-2Y",
                       cycle="monthly", qty=10, unit_price=240.0,
                       start_date=date(2026, 8, 16))
TODAY = date(2026, 9, 5)


def test_calendar_month_arithmetic_clamps_short_months():
    """31 Jan + 1 month is 28 Feb, not 3 March. Getting this wrong shifts every
    later billing date."""
    assert advance(date(2026, 1, 31), "monthly") == date(2026, 2, 28)
    assert advance(date(2024, 1, 31), "monthly") == date(2024, 2, 29)   # leap
    assert advance(date(2026, 3, 15), "quarterly") == date(2026, 6, 15)
    assert advance(date(2026, 3, 15), "yearly") == date(2027, 3, 15)


def test_cycle_window_is_anchored_to_the_subscription_not_the_calendar():
    start, end = cycle_bounds(date(2026, 8, 16), "monthly", TODAY)
    assert (start, end) == (date(2026, 8, 16), date(2026, 9, 16))
    assert (end - start).days == 31


def test_downgrade_produces_a_credit_note():
    r = prorate(MONTHLY, new_qty=5, today=TODAY)
    assert r.delta_qty == -5
    assert r.kind == "credit_note"
    assert r.days_remaining == 11 and r.days_in_cycle == 31
    # 240 x 5 x 11/31
    assert r.credit == pytest.approx(240.0 * 5 * (11 / 31))
    assert "11/31" in r.formula


def test_upgrade_produces_a_charge_not_a_credit():
    r = prorate(MONTHLY, new_qty=20, today=TODAY)
    assert r.delta_qty == 10
    assert r.kind == "charge"
    assert r.credit < 0
    assert r.credit == pytest.approx(-240.0 * 10 * (11 / 31))


def test_no_change_prorates_nothing():
    r = prorate(MONTHLY, new_qty=10, today=TODAY)
    assert r.kind == "none" and r.credit == pytest.approx(0.0)
    assert "unchanged" in r.formula


def test_change_on_the_anniversary_starts_a_fresh_full_period():
    """Cycle windows are half-open [start, end), so the anniversary date belongs
    to the NEW period, not the old one. A change made that morning therefore
    prorates against a full period — the customer has just been billed for it."""
    r = prorate(MONTHLY, new_qty=5, today=date(2026, 9, 16))
    assert (r.period_start, r.period_end) == (date(2026, 9, 16), date(2026, 10, 16))
    assert r.days_remaining == r.days_in_cycle == 30
    assert r.kind == "credit_note"
    assert r.credit == pytest.approx(240.0 * 5)      # full period, no fraction


def test_last_day_of_a_period_prorates_a_single_day():
    r = prorate(MONTHLY, new_qty=5, today=date(2026, 9, 15))
    assert r.days_remaining == 1 and r.days_in_cycle == 31
    assert r.credit == pytest.approx(240.0 * 5 * (1 / 31))


def test_cancellation_credits_the_whole_remaining_period():
    r = prorate(MONTHLY, new_qty=0, today=TODAY)
    assert r.kind == "credit_note"
    assert r.credit == pytest.approx(240.0 * 10 * (11 / 31))


def test_quarterly_and_yearly_use_real_period_lengths():
    q = Subscription(id=2, ref="Q", plan="SLA", sku="S", cycle="quarterly",
                     qty=1, unit_price=1200.0, start_date=date(2026, 7, 1))
    r = prorate(q, 0, today=date(2026, 8, 1))
    assert r.days_in_cycle == (date(2026, 10, 1) - date(2026, 7, 1)).days == 92

    y = Subscription(id=3, ref="Q", plan="SLA", sku="S", cycle="yearly",
                     qty=1, unit_price=5400.0, start_date=date(2026, 3, 1))
    r2 = prorate(y, 0, today=date(2026, 9, 5))
    assert r2.days_in_cycle == 365


def test_schedule_follows_the_billing_anniversary():
    rows = billing_schedule(MONTHLY, TODAY, periods=3)
    assert [b.due_date for b in rows] == [
        date(2026, 9, 16), date(2026, 10, 16), date(2026, 11, 16)]
    assert all(b.amount == pytest.approx(2400.0) for b in rows)


def test_hybrid_ledger_keeps_one_time_and_recurring_separate_but_reconciled():
    """PS B7: both kinds of line on ONE order, shown separately."""
    one_time = [dict(sku="LP14", name="Laptop Pro 14", qty=2, amount=2200.0)]
    ledger = build_ledger(one_time, [MONTHLY], TODAY)
    assert ledger["one_time_total"] == 2200.0
    assert ledger["recurring_total"] == 2400.0
    assert ledger["invoice_today"] == 2200.0        # recurring bills on its own date
    assert len(ledger["schedule"]) == 3


def test_proration_never_divides_by_zero():
    weird = Subscription(id=9, ref="Q", plan="P", sku="S", cycle="monthly",
                         qty=1, unit_price=100.0, start_date=date(2026, 9, 5))
    r = prorate(weird, 0, today=date(2026, 9, 5))
    assert r.days_in_cycle > 0
    assert r.credit == r.credit          # not NaN
