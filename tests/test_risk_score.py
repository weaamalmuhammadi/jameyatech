"""
Covers risk_agent.compute_trust_score() -- the deterministic scoring engine
that grounds the Risk Agent in real data (data/03_Synthetic_Jamiya_Dataset.csv,
matched by phone number, when the member is found there, otherwise the
documented Trust Score formula from docs/Feature_Engineering.md) instead of
a pure LLM guess.
"""
import pytest

from risk_agent import compute_trust_score, _DATASET


@pytest.fixture
def known_record():
    """A real (phone, name) pair pulled live from the dataset, so the test
    doesn't hardcode a value that would break if the CSV is regenerated."""
    if _DATASET is None or len(_DATASET) == 0:
        pytest.skip("dataset not available in this environment")
    row = _DATASET.iloc[0]
    return {"phone": row["Phone"], "name": row["Member_Name"]}


def test_high_grade_long_membership_is_green():
    member = {"credit_grade": "A", "months_in_circle_before": 72, "payment_history": []}
    result = compute_trust_score(member)
    assert result["source"] == "heuristic"
    assert result["risk_level"] == "green"
    assert result["trust_score"] >= 80


def test_low_grade_recent_missed_payments_is_red():
    member = {"credit_grade": "F", "months_in_circle_before": 1, "payment_history": ["missed", "missed"]}
    result = compute_trust_score(member)
    assert result["risk_level"] == "red"
    assert result["trust_score"] < 60


def test_previous_default_penalizes_score_by_15():
    # A single late payment keeps both variants on the formula path rather
    # than the "no negative signal at all" clean-slate short-circuit, so the
    # -15 delta below is actually comparing formula output, not the shortcut.
    base = {"credit_grade": "B", "months_in_circle_before": 24, "payment_history": ["late_5_days"]}
    with_default = dict(base, previous_default=True)
    r1 = compute_trust_score(base)
    r2 = compute_trust_score(with_default)
    assert r1["source"] == "heuristic" and r2["source"] == "heuristic"
    assert r2["trust_score"] == r1["trust_score"] - 15


def test_late_payment_costs_4_points_missed_costs_12():
    # Baseline already has one late payment (not a fully clean record) so it
    # goes through the formula path too -- otherwise it'd hit the clean-slate
    # short-circuit and the deltas below wouldn't mean anything.
    baseline = {"credit_grade": "B", "months_in_circle_before": 12, "payment_history": ["late_5_days"]}
    one_more_late = dict(baseline, payment_history=["late_5_days", "late_3_days"])
    with_missed = dict(baseline, payment_history=["late_5_days", "missed"])
    r_base = compute_trust_score(baseline)
    r_more_late = compute_trust_score(one_more_late)
    r_missed = compute_trust_score(with_missed)
    assert r_base["source"] == "heuristic"
    assert r_more_late["trust_score"] == r_base["trust_score"] - 4
    assert r_missed["trust_score"] == r_base["trust_score"] - 12


def test_fully_clean_member_with_no_csv_match_scores_green():
    """The bug this fixes: a brand-new member with a perfectly clean stated
    history (no late/missed payments, no previous default) and no CSV match
    was landing Red/Yellow because the formula's baseline assumes an
    established, multi-year member -- it should default to trusted instead."""
    result = compute_trust_score({
        "name": "Brand New Member",
        "phone": "0599999999",
        "payment_history": ["on_time", "on_time", "on_time"],
        "months_in_circle_before": 1,
    })
    assert result["source"] == "heuristic"
    assert result["risk_level"] == "green"


def test_score_is_clipped_to_0_100_range():
    terrible = {"credit_grade": "F", "months_in_circle_before": 0, "payment_history": ["missed"] * 10}
    result = compute_trust_score(terrible)
    assert 0 <= result["trust_score"] <= 100


def test_score_grounded_in_csv_when_phone_matches(known_record):
    """This phone number exists in data/03_Synthetic_Jamiya_Dataset.csv --
    confirms the Risk Agent reads real historical data by phone, not just
    the heuristic formula, which was the core "docs claim this, code
    doesn't do it" gap this fixes."""
    result = compute_trust_score(known_record)
    assert result["source"] == "csv"
    assert result["csv_matched"] is True
    assert result["name_mismatch"] is False


def test_score_falls_back_to_heuristic_for_a_phone_not_in_the_dataset():
    result = compute_trust_score({"name": "Ahmed", "phone": "0500000000"})
    assert result["source"] == "heuristic"
    assert result["csv_matched"] is False


def test_score_falls_back_to_heuristic_when_no_phone_given():
    """A name alone -- even one that happens to appear in the dataset --
    must NOT ground the score anymore; only the phone number does."""
    result = compute_trust_score({"name": "Faisal Al-Rashidi"})
    assert result["source"] == "heuristic"
    assert result["csv_matched"] is False


def test_matching_phone_with_a_different_name_is_flagged_as_mismatch(known_record):
    mismatched = {"name": "Someone Else Entirely", "phone": known_record["phone"]}
    result = compute_trust_score(mismatched)
    assert result["source"] == "csv"
    assert result["name_mismatch"] is True
    assert result["record_name"] == known_record["name"]


def test_name_mismatch_never_produces_a_green_verdict(known_record):
    """Unverified identity is itself a risk signal -- even if the record on
    file for this phone is Green, a name mismatch must escalate it."""
    mismatched = {"name": "Someone Else Entirely", "phone": known_record["phone"]}
    result = compute_trust_score(mismatched)
    if result["name_mismatch"]:
        assert result["risk_level"] != "green"


def test_first_name_only_entry_is_not_flagged_as_a_mismatch(known_record):
    """Typing just the first name against a full name on record shouldn't
    be treated as a suspicious identity mismatch."""
    first_name = known_record["name"].split()[0]
    result = compute_trust_score({"name": first_name, "phone": known_record["phone"]})
    assert result["name_mismatch"] is False


def test_phone_number_with_formatting_characters_still_matches(known_record):
    phone = known_record["phone"]
    formatted = phone[:3] + "-" + phone[3:6] + " " + phone[6:]
    result = compute_trust_score({"name": known_record["name"], "phone": formatted})
    assert result["source"] == "csv"
    assert result["csv_matched"] is True
