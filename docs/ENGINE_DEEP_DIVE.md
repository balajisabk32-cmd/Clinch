# DealFlow360 — Backend Engine Masterclass & Line-by-Line Guide

This document is an exhaustive, beginner-friendly guide to every file and concept inside `backend/engine/`:
1. **Python Core Concepts & Fundamentals** (e.g., What is `self`? What is an override? What are decorators?)
2. **`billing.py`**: Calendar-accurate subscription proration & unified ledgers
3. **`fulfilment.py`**: Multi-warehouse allocation & exhaustive combinatorial optimization
4. **`recommender.py`**: Association-rule mining (Support, Confidence, Lift) with hard margin filters
5. **`scoring.py`**: Blended risk scoring (S, A, L, Z), exact attribution, and binary-search coaching

---

## Part 1: Python Fundamentals & Core Concepts Explained Simply

Before jumping into the files, here are the foundational programming concepts used repeatedly throughout the engine code.

### 1. What does `self` mean?
In Python, when you define a class (like a blueprint for a house), `self` refers to **the specific instance of that house being built or inspected right now**.
```python
class Dog:
    def bark(self):
        print(f"My name is {self.name}")
```
- If we have two dogs: `d1 = Dog(); d1.name = "Rocky"` and `d2 = Dog(); d2.name = "Bruno"`.
- When you run `d1.bark()`, Python secretly translates it to `Dog.bark(d1)`. Inside that function, `self` represents `d1` ("Rocky").
- **Every method on an object needs `self` as its first parameter** so Python knows *which specific data object* it is working with.

### 2. What is an "Override"?
There are two contexts where "override" appears in this codebase:

#### A. Object-Oriented Override (Code Level)
When a child class replaces a function inherited from a parent class with its own version:
```python
class Animal:
    def speak(self): return "sound"

class Cat(Animal):
    def speak(self): return "meow" # Overrides the parent's speak()
```

#### B. Business Logic "Hard Override" (Governance Level)
In `scoring.py`, a **Hard Override** means a rule that **immediately cuts off normal scoring and forces a decision**.
- Even if a quotation scores 15/100 (which normally qualifies for automatic approval), if a single item is given a 40% unapproved discount, a **Hard Override** triggers:
  *"Stop normal calculations immediately. Send this directly to Finance Review."*

### 3. What is `@dataclass`?
Usually in Python, writing a class requires tedious boilerplate code:
```python
# Old way without dataclass:
class Product:
    def __init__(self, name, price):
        self.name = name
        self.price = price
    def __repr__(self):
        return f"Product(name={self.name}, price={self.price})"
```
`@dataclass` is a **decorator** (a shortcut tag) that instructs Python:
*"Automatically write the `__init__`, `__repr__`, and comparison methods for me behind the scenes based on the field list."*
```python
# Modern way with @dataclass:
@dataclass
class Product:
    name: str
    price: float
```
If you write `@dataclass(frozen=True)`, it makes the object **immutable** (it cannot be altered after creation, making it safe to use as dictionary keys).

### 4. What is `@property`?
A decorator that lets you call a method **like a variable without parentheses `()`**.
```python
class Line:
    qty: int = 5
    price: float = 100.0

    @property
    def total(self) -> float:
        return self.qty * self.price

item = Line()
print(item.total) # Notice no parentheses ()! Calculates 500.0 on the fly.
```
This guarantees that `total` is always dynamically calculated from the latest `qty` and `price`, avoiding stale values.

### 5. What does `from __future__ import annotations` do?
In Python, type hints (like `def score(q: Quote) -> Result:`) normally get evaluated when the file loads. If `Quote` is defined later down the file, Python would crash with `NameError: Quote not defined`.
This import tells Python: *"Treat all type hints as plain text strings while reading the file, and do not crash on circular or forward references."*

### 6. What is `Literal[...]`?
Restricts a variable to an **exact set of string values**:
```python
Cycle = Literal["monthly", "quarterly", "yearly"]
```
If a developer passes `"weekly"`, tools like mypy and IDEs flag it immediately as a compile-time bug before the code runs.

### 7. What is `lambda`?
An anonymous, one-line mini function:
```python
# Normal function:
def get_weight(w): return w.ship_cost_weight

# Exact same thing as a lambda:
lambda w: w.ship_cost_weight
```
Used heavily in sorting, e.g.: `sorted(warehouses, key=lambda w: w.ship_cost_weight)`.

### 8. What are `Counter` and `frozenset`?
- **`Counter`** (from `collections`): A smart dictionary that counts frequencies automatically. If you add `"laptop"`, its count becomes 1; if you add `"laptop"` again, its count becomes 2.
- **`frozenset`**: An unordered group of items that cannot be modified. Unlike a list `['A', 'B']` (where order matters: `['A', 'B'] != ['B', 'A']`), `frozenset(('A', 'B')) == frozenset(('B', 'A'))`. This allows us to track product pairings regardless of which item was added to the cart first.

### 9. What does `**kwargs` or `**dict` unpacking mean?
The double asterisk `**` unpacks a dictionary into keyword arguments:
```python
params = {"name": "Laptop", "price": 1200}
# Product(**params) is identical to: Product(name="Laptop", price=1200)
```

### 10. Why is `today` passed as an argument instead of using `datetime.now()`?
This is the **Pure Function Principle**.
If code calls `datetime.now()` or `date.today()`, its behavior depends on the real-world clock:
- Tests written today might pass, but fail tomorrow.
- You could never test what happens on Feb 29 of a leap year without hacking the computer's system clock.
By passing `today: date` as an argument, any scenario across past, present, or future can be tested deterministically.

---

## Part 2: Deep Dive — `backend/engine/billing.py`

### High-Level Purpose
In enterprise sales, orders mix **one-time purchases** (e.g., laptops, routers) and **recurring subscriptions** (e.g., cloud licenses). When a customer upgrades from 10 to 15 licenses halfway through a month, you must calculate **calendar proration**:
$$\text{credit} = \text{unit\_price} \times \Delta\text{qty} \times \left(\frac{\text{days\_remaining}}{\text{days\_in\_cycle}}\right)$$

### Detailed Walkthrough

#### Lines 1–43: Header, Configuration, and Module Exports
```python
from calendar import monthrange
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any, Literal
```
- `monthrange(year, month)`: Returns `(first_weekday, num_days_in_month)`. Crucial for handling February (28 or 29 days) and 30 vs 31-day months.
- `__all__ = [...]`: Explicit list of function and class names exported when someone imports `*` from this module.
- `Cycle = Literal["monthly", "quarterly", "yearly"]`: Restricts billing intervals to these three valid cycles.

#### Lines 45–56: `_add_months(d: date, months: int) -> date`
Calendar-accurate month addition:
```python
total = d.month - 1 + months
year = d.year + total // 12
month = total % 12 + 1
day = min(d.day, monthrange(year, month)[1])
return date(year, month, day)
```
- **Why this exists**: In Python, `timedelta` only understands days, hours, and seconds. It has no concept of a "month" because months have variable lengths.
- If you start at January 31 and add 1 month:
  - Simple math would produce February 31, which does not exist and throws an error.
  - `monthrange(year, month)[1]` finds that February has 28 days (or 29 in a leap year).
  - `min(d.day, 28)` safely clamps the date to February 28.

#### Lines 58–66: `advance(d: date, cycle: Cycle, periods: int = 1) -> date`
Advances a date by $N$ periods according to the subscription cycle:
- `monthly`: adds `periods` months.
- `quarterly`: adds `3 * periods` months.
- `yearly`: adds `12 * periods` months.
- Throws a `ValueError` if an unrecognized cycle name is passed.

#### Lines 68–83: `cycle_bounds(start: date, cycle: Cycle, today: date) -> tuple[date, date]`
Finds the active `[period_start, period_end)` billing window that covers `today`.
- Walks forward from the customer's original contract start date.
- **Why this matters**: If Customer A subscribed on the 14th of the month, their billing cycle runs 14th-to-14th, not 1st-to-1st. This function calculates boundaries relative to the customer's personal billing anniversary.
- `guard > 600`: Infinite-loop breaker preventing hanging if bad dates are supplied.

#### Lines 84–143: Domain Data Classes
- **`Subscription`**: Holds subscription metadata (`id`, `ref`, `plan`, `sku`, `cycle`, `qty`, `unit_price`, `start_date`, `status`).
- **`BillingLine`**: Represents an individual line on an upcoming invoice (`due_date`, `amount`, `status`, `note`).
- **`ProrationResult`**: Holds the complete audit trail of a mid-cycle change:
  - `credit`: The currency value. If positive, we owe money back or credit to customer; if negative, customer owes an extra charge.
  - `formula`: Plaintext mathematical proof (e.g., `1,200 x 2 x (15/30) = 1,200 charge`) rendered on the screen so finance reviewers can audit the calculation.

#### Lines 145–190: `prorate(sub, new_qty, today, periods_ahead=3)`
The proration calculation:
1. Identifies the current cycle start and end via `cycle_bounds`.
2. Computes `days_in_cycle = (period_end - period_start).days`.
3. Clamps remaining days: `days_remaining = max(0, min(days_in_cycle, (period_end - today).days))`.
4. Calculates `delta = new_qty - sub.qty`.
5. Multiplies: `credit = -delta * sub.unit_price * (days_remaining / days_in_cycle)`.
6. Sets `kind` to `"credit_note"`, `"charge"`, or `"none"`.
7. Builds upcoming future scheduled billing invoices using `billing_schedule()`.

#### Lines 192–239: `build_ledger(...)`
Combines one-time hardware lines and recurring software subscriptions into one unified ledger:
- Sums `one_time_total` and `recurring_total`.
- Shows what is invoiced today (`invoice_today`) versus what will be billed automatically on future cycle due dates.

---

## Part 3: Deep Dive — `backend/engine/fulfilment.py`

### High-Level Purpose
When an order contains multiple physical items, they can be fulfilled from different regional warehouses.
- **Per-unit shipping weight**: Cost per item shipped from Warehouse A.
- **Fixed shipment cost**: The base fee to open and dispatch a delivery truck/box from a warehouse.
- **The Challenge**: A warehouse might have cheap per-unit shipping, but opening a 3rd warehouse just to ship 1 item costs an extra ₹500 base fee. A greedy algorithm fails here. `fulfilment.py` uses combinatorial search to find the provably cheapest split.

### Detailed Walkthrough

#### Lines 46–124: Models
- **`Warehouse(name, ship_cost_weight, fixed_shipment_cost)`**: Data model of a depot. `frozen=True` makes it immutable and hashable.
- **`DemandLine(sku, name, qty, is_physical)`**: Items requested. Non-physical items (support contracts, software licenses) have `is_physical=False` and are skipped.
- **`Allocation(warehouse, sku, name, qty, unit_ship_cost)`**: An assignment of `qty` units of `sku` to a specific `warehouse`. Has a dynamic `@property def cost` returning `qty * unit_ship_cost`.
- **`Backorder(sku, name, qty, status)`**: Items that cannot be fulfilled because all warehouses are out of stock.
- **`SplitResult`**: Contains the chosen allocation plan, total cost, number of shipments, warehouses used, backorders, and diagnostic text.

#### Lines 128–165: `_allocate_within(subset, lines, stock)`
Simulates fulfilling an order using *only* a specific subset of warehouses:
1. Sorts warehouses in `subset` cheapest-per-unit first: `sorted(subset, key=lambda w: w.ship_cost_weight)`.
2. Creates a local temporary copy of warehouse inventory so original stock is not mutated during simulation.
3. For each physical line, consumes available inventory from the cheapest warehouse first.
4. Any quantity that cannot be satisfied is appended to `backorders`.

#### Lines 167–172: `_cost_of(allocations, warehouses)`
Calculates the total financial cost of an allocation:
$$\text{Total Cost} = \sum (\text{unit\_cost} \times \text{units}) + \sum_{\text{warehouses used}} \text{fixed\_shipment\_cost}$$

#### Lines 174–256: `split_order(warehouses, lines, stock, objective="cost")`
Finds the global optimal allocation:
1. Generates all possible subsets of warehouses using `combinations(warehouses, size)` for sizes $1 \dots W$.
2. For each combination:
   - Allocates inventory using `_allocate_within`.
   - Computes total cost via `_cost_of`.
   - Counts backordered units (`unmet`).
3. **Ranking Rules**:
   - **Rule 1 (Customer Satisfaction First)**: A plan with fewer backordered units always beats a plan with more backorders, regardless of cost.
   - **Rule 2 (Objective Sorting)**:
     - If `objective == "cost"`: Rank by `(unmet_units, total_cost, shipment_count)`.
     - If `objective == "shipments"`: Rank by `(unmet_units, shipment_count, total_cost)`.
4. Keeps the overall lowest-ranked candidate and attaches a diagnostic explanation string.

#### Lines 258–272: `consolidate_backorders(...)`
When newly arrived inventory is checked in:
- Takes outstanding `Backorder` objects, converts them back to `DemandLine` objects, and runs `split_order` with `objective="shipments"` to send remaining items in the fewest boxes possible.

---

## Part 4: Deep Dive — `backend/engine/recommender.py`

### High-Level Purpose
A sales rep is assembling a quote. What upsell or cross-sell items should the system suggest?
- **Not a static lookup table**: Recommendations are calculated from historical purchase data using **Association Rule Mining** (Market Basket Analysis).
- **Hard Margin Floor**: High-volume, zero-profit products are blocked from recommendations. The system only recommends items that are statistically correlated *and* preserve profit margin.

### The Three Statistical Pillars
1. **Support**: How popular is item $J$ overall?
   $$\text{Support}(J) = \frac{\text{Orders containing } J}{\text{Total Orders}}$$
2. **Confidence**: When customer buys cart $C$, how often do they also buy $J$?
   $$\text{Confidence}(C \to J) = \frac{\text{Orders containing } C \text{ and } J}{\text{Orders containing } C}$$
3. **Lift**: How much *more* likely is $J$ when $C$ is present, compared to $J$'s normal baseline?
   $$\text{Lift}(C \to J) = \frac{\text{Confidence}(C \to J)}{\text{Support}(J)}$$
   - $\text{Lift} = 1.0$: No relationship (co-occurrence is pure chance).
   - $\text{Lift} > 1.0$: Genuine positive affinity (e.g., laptop $\to$ docking station).

### Detailed Walkthrough

#### Lines 38–85: `CoPurchaseIndex` & `build_index(orders)`
- `build_index`: Takes a list of past orders (baskets of SKUs).
- Uses `Counter()` to count how many times each SKU appeared (`item_counts`).
- Uses `combinations(skus, 2)` to generate all pairs in the order and counts them in `pair_counts` keyed by `frozenset((a, b))`.
- `CoPurchaseIndex` stores these counters and provides quick mathematical helper methods (`support()`, `confidence()`, `lift()`).

#### Lines 88–200: `recommend(...)`
The ranking pipeline:
1. `candidates`: Every item in the catalog not already in the active cart.
2. **Margin Filter (Lines 123–125)**:
   ```python
   if margin_pct < margin_floor_pct:
       filtered += 1
       continue
   ```
   If a product does not yield at least 25% gross margin, it is dropped immediately.
3. **Apriori Statistical Guard (Lines 138–148)**:
   - For each item already in the cart (`anchor`), checks if `(anchor, candidate)` co-occurred at least `min_pair_count` times (default: 5) and has `confidence >= 0.15`.
   - **Why this guard is critical**: A pair that appeared only once in 100 orders can mathematically produce a misleadingly high lift score by random chance. Enforcing minimum historical counts eliminates false noise.
4. **Ranking Formula (Lines 152–166)**:
   $$\text{Rank} = \text{best\_lift} \times \text{margin\_pct} \times (1.15 \text{ if promoted else } 1.0)$$
   - Uses `margin_pct` (percentage rate), not absolute rupees. Ranking by raw rupees would cause expensive hardware to win every recommendation slot regardless of relevance.
5. Sorts descending by `_rank`, takes `top[:limit]`, and strips internal scoring tags before returning.
6. Generates human-readable explanations (e.g., *"68% of orders with Pro Laptop also include this (lift 2.4x)"*).

---

## Part 5: Deep Dive — `backend/engine/scoring.py`

### High-Level Purpose
The centerpiece of Clinch / DealFlow360: **Blended Discount Risk Scoring**.
Traditional discount approval systems only check the single largest discount line. A salesperson can bypass this by giving multiple medium-high discounts across several lines, giving away substantial profit.
Clinch evaluates **4 orthogonal risk signals** and blends them into a 0–100 score:
1. **$S$ (Severity)**: The worst single-line discount breach.
2. **$A$ (Aggregate)**: The revenue-weighted average overage across the entire order.
3. **$L$ (Leakage Ratio)**: Total currency leaked divided by order gross margin.
4. **$Z$ (Behavioural Anomaly)**: Statistical $z$-score comparing this rep's discount against their historical habits.

---

### Detailed Walkthrough

#### Lines 59–73: Numeric Guards
- `clip(x, lo=0.0, hi=1.0)`: Clamps $x$ to stay between `lo` and `hi`.
- `safe_ratio(numerator, denominator, default=0.0)`: Performs division safely. If `denominator == 0`, returns `default` rather than throwing `ZeroDivisionError` or returning `NaN`.
  - **Why this exists**: When a user creates an empty quote, revenue is 0. Without this guard, the system would crash or display `NaN%` on the screen.

#### Lines 76–97: `robust_z(x, history, min_history=5)`
Calculates whether a rep's discount is abnormal using **Median Absolute Deviation (MAD)**:
$$\text{MAD} = \text{median}(|h_i - \text{median}(H)|)$$
$$Z = \frac{x - \text{median}}{1.4826 \times \text{MAD}}$$
- **Why MAD instead of standard deviation?**: Standard deviation is distorted by extreme outliers. If a rep submitted one extreme quote in the past, standard deviation inflates, which would mask subsequent bad quotes. MAD is robust against outlier distortion.
- Returns `None` if history is under 5 quotes or `MAD == 0` (refusing to invent a fake number).

#### Lines 104–146: Domain Models (`Line`, `Quote`)
- `Line`: Holds `qty`, `list_price`, `cost`, `discount_pct`.
  - `gross`: `list_price * qty`.
  - `net`: `gross * (1 - discount_pct / 100)`.
  - `margin`: `(list_price - cost) * qty`.
- `Quote`: Holds `tier` (Bronze, Silver, Gold), `rep_id`, `lines`, and `order_discount_pct`.
  - `effective_discount(line)`: Combines line discount and order-wide discount additively: `min(100.0, line.discount_pct + order_discount_pct)`.

#### Lines 149–227: `Policy` Model
- `ceiling_for(tier, category)`: Returns `min(tier_ceiling, category_ceiling)`.
  - **Core Rule**: Category ceilings *restrict*; they never grant extra headroom above the customer's tier.
- `dead_config_warnings()`: Scans policy rules to detect configurations that will never trigger (e.g., setting a Software category ceiling to 25% when the highest customer tier is capped at 15%).
- `clone(**overrides)`: Duplicates policy in memory with modifications. Used by the **Policy Simulator** to test rule changes across open quotes without saving to the database.

#### Lines 261–402: `score_quote(...)` — The Scoring Engine
1. **Empty Quote Guard (Lines 287–299)**: If lines are empty or revenue is 0, returns a safe zero score.
2. **Per-Line Analysis (Lines 307–331)**:
   - For each line, calculates:
     - `over = max(0.0, given_discount - allowed_ceiling)`
     - `weight = line_gross / order_revenue`
     - `line_leak = (over / 100.0) * line_gross`
   - Accumulates:
     - $S = \max(S, \text{over})$
     - $A = \sum (\text{over} \times \text{weight})$
     - $\text{leaked} = \sum \text{line\_leak}$
3. **Leakage Term $L$ (Lines 333–341)**:
   - $L = \text{leaked} / \text{order\_margin}$.
   - If `order_margin <= 0`, sets $L = 1.0$ (maximum risk) and notes emergency.
4. **Behavioural Term $Z$ (Lines 343–355)**:
   - Computes rep's order-wide effective discount and calculates `robust_z`.
   - Normalizes terms against policy saturation caps:
     - $S_{\text{norm}} = \text{clip}(S / \text{caps}['S'])$
     - $A_{\text{norm}} = \text{clip}(A / \text{caps}['A'])$
     - $Z_{\text{norm}} = \text{clip}\left(\frac{Z - Z_{\text{lo}}}{Z_{\text{hi}} - Z_{\text{lo}}}\right)$
5. **Honest Degradation (Lines 357–372)**:
   - If the rep has insufficient history (`Z is None`), drops $Z$ from the equation and **renormalizes the remaining weights** ($S, A, L$) so they sum to 1.0.
   - **Why this is critical**: If weights were not renormalized, new reps would automatically get lower risk scores simply because $Z$ was missing, creating a loophole to bypass approval rules.
6. **Exact Additive Attribution (Lines 374–376)**:
   $$\text{contribution}_k = 100 \times \text{weight}_k \times \text{term}_k$$
   $$\text{score} = \sum \text{contribution}_k$$
   Because the model is linear-additive, each term's contribution sums directly to the final score, providing exact mathematical attribution (closed-form Shapley values).
7. **Hard Overrides (Lines 378–389)**:
   - If $S \ge \text{hard\_override\_pts}$ (default: 15 points over ceiling), forces `band = "FINANCE"`.
   - If `order_margin <= 0`, forces `band = "FINANCE"`.

#### Lines 413–527: `coach(...)` — Counterfactual Coaching
Instead of merely explaining why a quote was flagged, `coach(...)` answers:
*"What is the smallest concession on a single line that drops this quote into automatic approval?"*

- **Binary Search (Lines 468–477)**:
  - Tests zeroing each line's discount. If auto-approval is reachable, runs a 24-iteration binary search between `0.0%` and `current_discount%` to find the exact boundary threshold down to $10^{-7}$ precision.
- **Actionable Stepping (Line 480)**: Rounds target down to clean 0.5% increments (e.g., 12.5%).
- **Governance Floor (Lines 482–495)**:
  - Caps advice at the line's policy ceiling. The coach will never advise a rep to keep an unapproved discount just because the aggregate average diluted it.
- **Comparator `better(...)` (Lines 448–455)**:
  - Prioritizes cutting a line that actually violates policy over trimming a compliant line.
- Returns a structured recommendation (e.g., *"Drop Onsite Setup to 10% and this quote auto-approves"*).

---

## Summary Matrix

| Module | Core Responsibility | Key Algorithm / Formula | Critical Design Constraint |
| :--- | :--- | :--- | :--- |
| **`billing.py`** | Subscriptions & Proration | $\text{Price} \times \Delta Q \times (\text{Days Rem} / \text{Cycle Days})$ | Pure calendar math; forbids system clock `date.today()`. |
| **`fulfilment.py`** | Multi-Warehouse Routing | Exhaustive subset lattice + cost function | Evaluates fixed truck fees; avoids greedy suboptimal traps. |
| **`recommender.py`** | Upsell & Cross-Sell | $\text{Lift} = \frac{\text{Confidence}}{\text{Support}}$; blended with margin % | Hard margin floor (25%); blocks unprofitable suggestions. |
| **`scoring.py`** | Discount Risk & Governance | Blended score: $100 \times \sum (W_k \times T_k)$ for $S, A, L, Z$ | Zero I/O; enables real-time Policy Simulator replays. |
