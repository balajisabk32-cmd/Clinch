"""Scoring engine tests.

The P0 gate (CLINCH.md 4) is: score_quote() must reproduce the worked example in
PS 10 exactly. If it does not, nothing else in this repo matters. That is
test_ps_section_10_worked_example below, and it is the most important test here.

The second most important is test_aggregate_catches_what_max_would_miss -- the
quote where no single line is badly over, which every max()-based rule on earth
passes and ours flags. That is the differentiator, in assert form.
"""

import copy

import pytest

from engine.scoring import (
    DEFAULT_POLICY,
    Line,
    Policy,
    Quote,
    clip,
    coach,
    robust_z,
    safe_ratio,
    score_quote,
)


# --------------------------------------------------------------------------- #
#  Fixtures — these mirror the seeded demo records (CLINCH.md 9) so the tests
#  and the demo cannot drift apart.
# --------------------------------------------------------------------------- #

@pytest.fixture
def policy() -> Policy:
    return copy.deepcopy(DEFAULT_POLICY)


@pytest.fixture
def q1042() -> Quote:
    """Q-1042 / Acme Corp (Gold) — the PS 10 worked example, verbatim.

    Laptop Pro 14 (Hardware): 12% given, 15% allowed -> fine
    Onsite Setup Service (Services): 18% given, 10% allowed -> 8 pts OVER
    Extended Warranty (Hardware): 15% given, 15% allowed -> fine
    """
    return Quote(
        ref="Q-1042",
        customer="Acme Corp",
        tier="Gold",
        rep_id="rep_rao",
        lines=[
            Line("LP14", "Laptop Pro 14", "Hardware", 2, 1250.0, 812.0, 12.0),
            Line("SVC-ONSITE", "Onsite Setup Service", "Services", 1, 400.0, 260.0, 18.0),
            Line("WAR-EXT", "Extended Warranty", "Hardware", 1, 180.0, 117.0, 15.0),
        ],
    )


@pytest.fixture
def q1039() -> Quote:
    """Q-1039 / Beta Industries (Gold) — the aggregate case.

    Four lines, each only 2-3 points over. S = 3, which looks harmless.
    A = 2.56, which is 2.5x Q-1042's aggregate. This is the quote that proves we
    implemented PS 10's actual requirement rather than a threshold with extra steps.
    """
    return Quote(
        ref="Q-1039",
        customer="Beta Industries",
        tier="Gold",
        rep_id="rep_shah",
        lines=[
            # Hardware ceiling 15 -> 18 given = 3 over
            Line("SRV-RACK", "Rack Server R740", "Hardware", 2, 4200.0, 2940.0, 18.0),
            # Services ceiling 10 -> 12 given = 2 over
            Line("SVC-INST", "Install Service", "Services", 1, 4400.0, 2860.0, 12.0),
            # Subscriptions ceiling 12 -> 15 given = 3 over
            Line("SLA-GOLD", "Support SLA Gold", "Subscriptions", 1, 5400.0, 3240.0, 15.0, True),
            # Hardware ceiling 15 -> 17 given = 2 over
            Line("DOCK-01", "Docking Station", "Hardware", 20, 320.0, 208.0, 17.0),
        ],
    )


# Rep histories (CLINCH.md 9). A. Rao is the disciplined baseline.
RAO_HISTORY = [8.0, 6.0, 10.0, 9.0, 5.0, 12.0, 7.0, 11.0, 8.0, 6.0]  # median 8, MAD 2.0
SHAH_HISTORY = [13.0, 15.0, 11.0, 17.0, 9.0, 14.0, 12.0, 16.0]
NAIR_HISTORY = [7.0, 8.0, 6.5]  # only 3 orders -> insufficient-history branch


# --------------------------------------------------------------------------- #
#  THE P0 GATE
# --------------------------------------------------------------------------- #

def test_ps_section_10_worked_example(policy, q1042):
    """PS 10: the Services line breaks its own stricter limit, so the WHOLE
    quotation is flagged for approval -- even though the customer is Gold and
    15% 'sounds fine on paper'."""
    r = score_quote(policy, q1042, RAO_HISTORY)

    by_sku = {l["sku"]: l for l in r.lines}

    # Laptop: 12% given against a 15% Hardware ceiling -> compliant
    assert by_sku["LP14"]["given"] == 12.0
    assert by_sku["LP14"]["allowed"] == 15.0
    assert by_sku["LP14"]["over"] == 0.0
    assert by_sku["LP14"]["ok"] is True

    # Setup Service: 18% given against a 10% Services ceiling -> 8 points over.
    # This is the exact number PS 10 calls out.
    assert by_sku["SVC-ONSITE"]["given"] == 18.0
    assert by_sku["SVC-ONSITE"]["allowed"] == 10.0
    assert by_sku["SVC-ONSITE"]["over"] == 8.0
    assert by_sku["SVC-ONSITE"]["ok"] is False

    # Warranty: exactly at the ceiling is compliant, not a violation.
    assert by_sku["WAR-EXT"]["over"] == 0.0

    # The whole quote is flagged for approval because of that one line.
    assert r.band != "AUTO", "PS 10 requires this quote to be flagged"
    assert r.band == "MANAGER"

    # Leakage is real currency: 8% of the 400 Services line.
    assert r.leaked_total == pytest.approx(32.0)


def test_gold_tier_alone_does_not_authorise_a_services_line(policy, q1042):
    """The Gold tier allows 15%, but the Services CATEGORY caps at 10%.
    Effective ceiling must be the stricter of the two."""
    assert policy.ceiling_for("Gold", "Services") == 10.0
    assert policy.ceiling_for("Gold", "Hardware") == 15.0
    assert policy.ceiling_for("Gold", "Software") == 15.0   # tier binds
    assert policy.ceiling_for("Bronze", "Software") == 5.0  # tier binds hard


# --------------------------------------------------------------------------- #
#  THE DIFFERENTIATOR
# --------------------------------------------------------------------------- #

def test_aggregate_catches_what_max_would_miss(policy, q1039):
    """PS 10: 'Sometimes no single line is badly over its limit, but many lines
    are each a little over... The blended score looks at the total pattern.'

    Every max()-based rule passes this quote. Ours must not.
    """
    r = score_quote(policy, q1039, SHAH_HISTORY)

    overages = [l["over"] for l in r.lines]
    assert max(overages) == 3.0, "no single line is badly over"
    assert all(o <= 3.0 for o in overages)

    # A naive rule -- "escalate only if some line exceeds by more than 5" --
    # would auto-approve this. That is the failure mode we exist to prevent.
    naive_would_flag = any(o > 5.0 for o in overages)
    assert naive_would_flag is False

    # We flag it anyway, on the strength of the aggregate term.
    assert r.band != "AUTO"
    assert r.contributions["A"] > r.contributions["S"], (
        "the aggregate term must dominate severity on this quote -- "
        "that is the whole point of blending"
    )


def test_aggregate_exceeds_a_single_worse_line(policy, q1039, q1042):
    """Q-1039's worst line (3 pts) is far milder than Q-1042's (8 pts), yet its
    revenue-weighted aggregate is materially higher. Severity and aggregate are
    genuinely orthogonal signals, not two views of the same number."""
    agg = score_quote(policy, q1039, SHAH_HISTORY)
    single = score_quote(policy, q1042, RAO_HISTORY)

    assert agg.terms["S"] < single.terms["S"]     # milder worst line
    assert agg.terms["A"] > single.terms["A"]     # worse overall pattern


# --------------------------------------------------------------------------- #
#  Attribution must be exact (the "is this SHAP?" answer)
# --------------------------------------------------------------------------- #

def test_contributions_sum_exactly_to_score(policy, q1042, q1039):
    """Additive model -> Shapley values reduce in closed form to each term's
    contribution. If this ever fails, the explainability panel is lying."""
    for quote, hist in ((q1042, RAO_HISTORY), (q1039, SHAH_HISTORY)):
        r = score_quote(policy, quote, hist)
        assert sum(r.contributions.values()) == pytest.approx(r.score, abs=0.05)


def test_weights_always_sum_to_one(policy, q1042):
    for hist in (RAO_HISTORY, NAIR_HISTORY, []):
        r = score_quote(policy, q1042, hist)
        assert sum(r.weights_used.values()) == pytest.approx(1.0, abs=1e-6)


# --------------------------------------------------------------------------- #
#  Policy is an ARGUMENT — this is the moat, so it gets its own tests
# --------------------------------------------------------------------------- #

def test_tightening_a_ceiling_changes_the_outcome(policy, q1042):
    """The Policy Simulator in one assertion: same quote, cloned policy with a
    tighter Services ceiling, materially higher score. If this test passes, the
    engine is provably not hardcoded."""
    before = score_quote(policy, q1042, RAO_HISTORY)
    tighter = policy.clone(
        category_ceiling={**policy.category_ceiling, "Services": 8.0}
    )
    after = score_quote(tighter, q1042, RAO_HISTORY)

    assert after.score > before.score
    # 18% against an 8% ceiling is 10 points over, up from 8.
    assert [l for l in after.lines if l["sku"] == "SVC-ONSITE"][0]["over"] == 10.0


def test_simulation_does_not_mutate_the_live_policy(policy, q1042):
    """clone() must be a genuine copy. If the simulator leaks into live policy,
    a judge dragging a slider silently corrupts the demo database."""
    original = dict(policy.category_ceiling)
    tighter = policy.clone(
        category_ceiling={**policy.category_ceiling, "Services": 8.0}
    )
    tighter.category_ceiling["Services"] = 1.0
    tighter.weights["S"] = 0.99

    assert policy.category_ceiling == original
    assert policy.weights["S"] == 0.35


def test_loosening_a_ceiling_can_auto_approve(policy, q1042):
    # Raising ONLY the category ceiling does nothing: Gold still caps at 15%.
    category_only = policy.clone(
        category_ceiling={**policy.category_ceiling, "Services": 20.0}
    )
    assert score_quote(category_only, q1042, RAO_HISTORY).leaked_total > 0

    # Raising both actually clears the violation.
    loose = policy.clone(
        category_ceiling={**policy.category_ceiling, "Services": 20.0},
        tier_ceiling={**policy.tier_ceiling, "Gold": 20.0},
    )
    r = score_quote(loose, q1042, RAO_HISTORY)
    assert r.leaked_total == 0.0
    assert r.band == "AUTO"


# --------------------------------------------------------------------------- #
#  Failure Point 2 (CLINCH.md 5): empty, zero, divide-by-zero.
#  A judge's first click is "+ New Quotation" -> "Submit".
# --------------------------------------------------------------------------- #

def test_empty_quote_does_not_crash(policy):
    r = score_quote(policy, Quote(ref="Q-NEW", tier="Gold", rep_id="rep_rao", lines=[]))
    assert r.score == 0.0
    assert r.band == "AUTO"
    assert "Empty quotation" in r.notes[0]


def test_zero_priced_lines_do_not_divide_by_zero(policy):
    q = Quote(ref="Q-FREE", tier="Gold", rep_id="rep_rao", lines=[
        Line("FREE", "Pilot Unit", "Hardware", 1, 0.0, 0.0, 50.0),
    ])
    r = score_quote(policy, q, RAO_HISTORY)
    assert r.score == 0.0  # zero revenue -> treated as empty, no NaN


def test_negative_margin_forces_finance(policy):
    """Selling below cost is a business emergency, not a scoring edge case."""
    q = Quote(ref="Q-LOSS", tier="Gold", rep_id="rep_rao", lines=[
        Line("LP14", "Laptop Pro 14", "Hardware", 1, 1000.0, 1400.0, 5.0),
    ])
    r = score_quote(policy, q, RAO_HISTORY)
    assert r.band == "FINANCE"
    assert any("margin" in n.lower() for n in r.notes)


def test_new_rep_drops_z_and_renormalises(policy, q1042):
    """S. Nair has 3 closed orders. We must not fabricate a behavioural signal,
    and we must not let the missing weight quietly shrink the score -- that
    would let brand new reps discount freely."""
    r = score_quote(policy, q1042, NAIR_HISTORY)

    assert "Z" not in r.terms
    assert "Z" not in r.weights_used
    assert sum(r.weights_used.values()) == pytest.approx(1.0)
    assert any("Insufficient rep history" in n for n in r.notes)
    # Renormalised, so the surviving terms carry proportionally more weight.
    assert r.weights_used["S"] > policy.weights["S"]


def test_degenerate_history_is_refused(policy):
    assert robust_z(12.0, [8.0] * 10) is None      # MAD == 0
    assert robust_z(12.0, [8.0, 9.0]) is None      # too short
    assert robust_z(12.0, RAO_HISTORY) is not None


def test_no_history_at_all(policy, q1042):
    r = score_quote(policy, q1042, [])
    assert "Z" not in r.terms
    assert r.score > 0


def test_terms_never_exceed_bounds(policy):
    """Absurd input must clamp, not explode off the end of the contribution bar."""
    q = Quote(ref="Q-WILD", tier="Bronze", rep_id="rep_rao", lines=[
        Line("X", "Thing", "Services", 100, 500.0, 50.0, 99.0),
    ])
    r = score_quote(policy, q, RAO_HISTORY)
    for k, v in r.terms.items():
        assert 0.0 <= v <= 1.0, f"term {k} out of bounds: {v}"
    assert 0.0 <= r.score <= 100.0


def test_hard_override_escalates_a_diluted_catastrophe(policy):
    """One line 16 points over, buried in a huge compliant order. The weighted
    average dilutes it to near nothing -- the override must still catch it."""
    q = Quote(ref="Q-DILUTE", tier="Gold", rep_id="rep_rao", lines=[
        Line("BULK", "Bulk Hardware", "Hardware", 500, 1000.0, 650.0, 0.0),
        Line("SVC", "Small Service", "Services", 1, 200.0, 130.0, 26.0),  # 16 over
    ])
    r = score_quote(policy, q, RAO_HISTORY)
    assert r.terms["A"] < 0.01, "the violation is heavily diluted by weighting"
    assert r.band == "FINANCE", "hard override must fire regardless"
    assert any("Hard override" in n for n in r.notes)


def test_guards():
    assert safe_ratio(1, 0) == 0.0
    assert safe_ratio(1, 0, default=1.0) == 1.0
    assert safe_ratio(10, 4) == 2.5
    assert clip(-5) == 0.0 and clip(5) == 1.0 and clip(0.5) == 0.5


# --------------------------------------------------------------------------- #
#  Counterfactual coaching
# --------------------------------------------------------------------------- #

def test_coach_finds_an_actionable_cut(policy, q1042):
    """PS 10's quote should be coachable back to AUTO by pulling the one
    offending Services line down to its ceiling."""
    advice = coach(policy, q1042, RAO_HISTORY, target_band="AUTO")

    assert advice is not None
    assert advice["sku"] == "SVC-ONSITE"
    assert advice["target_discount"] <= 10.0     # at or under the Services ceiling
    assert advice["current_discount"] == 18.0
    assert advice["points_sacrificed"] > 0
    assert advice["to_band"] == "AUTO"


def test_coach_advice_actually_works_when_applied(policy, q1042):
    """The coaching claim must be verifiable -- if we tell a rep 10% auto-approves
    and it doesn't, we have destroyed our credibility with the one user who
    checks."""
    advice = coach(policy, q1042, RAO_HISTORY, target_band="AUTO")
    assert advice is not None

    q1042.lines[advice["line_index"]].discount_pct = advice["target_discount"]
    assert score_quote(policy, q1042, RAO_HISTORY).band == "AUTO"


def test_coach_is_silent_when_already_compliant(policy):
    q = Quote(ref="Q-OK", tier="Gold", rep_id="rep_rao", lines=[
        Line("LP14", "Laptop Pro 14", "Hardware", 2, 1250.0, 812.0, 10.0),
    ])
    assert coach(policy, q, RAO_HISTORY, target_band="AUTO") is None


def test_coach_does_not_mutate_the_quote(policy, q1042):
    """coach() binary-searches by writing to line.discount_pct. It must restore
    every value it touches, or calling the coach silently rewrites the rep's quote."""
    before = [l.discount_pct for l in q1042.lines]
    coach(policy, q1042, RAO_HISTORY, target_band="AUTO")
    assert [l.discount_pct for l in q1042.lines] == before


# --------------------------------------------------------------------------- #
#  Hardware + Software vendor: four ceilings in one order
# --------------------------------------------------------------------------- #

def test_four_category_mixed_order(policy):
    """Our catalogue spans Hardware, Software, Services and Subscriptions. A
    single order can touch all four, and the SAME 16% discount is a 1-point slip
    on Software/Hardware but a 6-point breach on Services."""
    q = Quote(ref="Q-MIX", tier="Gold", rep_id="rep_rao", lines=[
        Line("LP14", "Laptop Pro 14", "Hardware", 5, 1250.0, 812.0, 16.0),
        Line("SW-SUITE", "DesignSuite Licence", "Software", 5, 900.0, 135.0, 16.0),
        Line("SVC-ONSITE", "Onsite Setup", "Services", 1, 400.0, 260.0, 16.0),
        Line("SLA-GOLD", "Support SLA Gold", "Subscriptions", 1, 1200.0, 720.0, 16.0, True),
    ])
    r = score_quote(policy, q, RAO_HISTORY)
    over = {l["sku"]: l["over"] for l in r.lines}

    assert over["SW-SUITE"] == 1.0    # Software 15% (tier-bound) -> 1 over
    assert over["LP14"] == 1.0        # 15% ceiling
    assert over["SLA-GOLD"] == 4.0    # 12% ceiling
    assert over["SVC-ONSITE"] == 6.0  # 10% ceiling
    assert r.band != "AUTO"
