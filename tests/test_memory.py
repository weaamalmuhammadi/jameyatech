"""
Covers memory.py's read/write round trip -- the shared history that lets an
agent see a member's past assessments/payments/mediations instead of only
the single event it was called with.
"""
from memory import JamiyaMemory


def test_risk_and_payment_history_round_trip(tmp_path):
    mem = JamiyaMemory(path=str(tmp_path / "mem.json"))
    mem.log_risk_assessment("Ahmed", "yellow", "تأخر مرة", trust_score=65)
    mem.log_payment_event("Ahmed", "missed")
    mem.log_payment_event("Ahmed", "missed")

    ctx = mem.get_member_context("Ahmed")
    assert ctx["missed_payment_count_all_time"] == 2
    assert len(ctx["past_risk_assessments"]) == 1
    assert ctx["past_risk_assessments"][0]["trust_score"] == 65


def test_log_risk_assessment_without_trust_score_stays_backward_compatible(tmp_path):
    mem = JamiyaMemory(path=str(tmp_path / "mem.json"))
    mem.log_risk_assessment("Sara", "green", "لا مشاكل")  # no trust_score arg
    ctx = mem.get_member_context("Sara")
    assert "trust_score" not in ctx["past_risk_assessments"][0]


def test_yield_and_circle_pool_round_trip(tmp_path):
    mem = JamiyaMemory(path=str(tmp_path / "mem.json"))
    mem.update_circle_pool(5000, 2)
    mem.log_yield(30, 5030)

    summary = mem.get_circle_summary()
    assert summary["pooled_amount"] == 5000
    assert len(summary["yield_log"]) == 1


def test_mediation_log_round_trip(tmp_path):
    mem = JamiyaMemory(path=str(tmp_path / "mem.json"))
    mem.log_mediation("Ahmed", ["option 1", "option 2"], "contract note")
    ctx = mem.get_member_context("Ahmed")
    assert ctx["past_mediation_count"] == 1


def test_corrupt_memory_file_starts_fresh_instead_of_crashing(tmp_path):
    path = tmp_path / "corrupt.json"
    path.write_text("{not valid json", encoding="utf-8")
    mem = JamiyaMemory(path=str(path))
    assert mem.get_circle_summary()["pooled_amount"] == 0.0
