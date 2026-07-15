"""
Covers orchestrator.handle_event() -- the deterministic fast path the live
web UI actually calls via POST /api/event. Each agent is mocked at the
orchestrator level (not the Groq client level) since dispatch correctness,
not agent reasoning, is what's under test here.
"""
from unittest.mock import patch

import orchestrator


def test_new_member_dispatches_to_risk_agent():
    fake = {"risk_level": "green", "reason": "ok", "trust_score": 90, "source": "heuristic"}
    with patch.object(orchestrator, "assess_risk", return_value=fake) as mocked:
        result = orchestrator.handle_event({"event_type": "new_member", "member_data": {"name": "Ahmed"}})
    assert result == {"handled_by": "risk_agent", "result": fake}
    mocked.assert_called_once()


def test_assign_turns_dispatches_to_turn_agent():
    fake = {"turn_order": [{"month": 1, "name": "Ahmed", "reason": "..."}]}
    with patch.object(orchestrator, "assign_turns", return_value=fake):
        result = orchestrator.handle_event(
            {"event_type": "assign_turns", "members": [{"name": "Ahmed", "salary_date": 25}]}
        )
    assert result == {"handled_by": "turn_agent", "result": fake}


def test_calculate_yield_dispatches_to_yield_agent():
    fake = {"yield_earned": 10.0, "new_total": 4010.0, "explanation": "..."}
    with patch.object(orchestrator, "calculate_yield", return_value=fake):
        result = orchestrator.handle_event(
            {"event_type": "calculate_yield", "pooled_amount": 4000, "months_idle": 1}
        )
    assert result == {"handled_by": "yield_agent", "result": fake}


def test_payment_missed_dispatches_to_mediator_agent():
    fake = {"message_to_member": "...", "restructuring_options": [], "draft_contract_note": "..."}
    with patch.object(orchestrator, "mediate_missed_payment", return_value=fake):
        result = orchestrator.handle_event(
            {"event_type": "payment_missed", "member_data": {"name": "Ahmed", "amount_due": 500}}
        )
    assert result == {"handled_by": "mediator_agent", "result": fake}


def test_unknown_event_type_returns_error_not_exception():
    result = orchestrator.handle_event({"event_type": "not_a_real_type"})
    assert "error" in result


def test_missing_event_type_returns_error_not_exception():
    result = orchestrator.handle_event({})
    assert "error" in result


def test_memory_is_threaded_through_to_the_agent():
    """handle_event's memory param must actually reach the agent call, not
    just get silently dropped -- this is the fix for the finding that memory
    logging previously wasn't wired into the live dispatch path."""
    fake_memory = object()
    with patch.object(orchestrator, "assess_risk", return_value={}) as mocked:
        orchestrator.handle_event(
            {"event_type": "new_member", "member_data": {"name": "Ahmed"}}, memory=fake_memory
        )
    mocked.assert_called_once_with({"name": "Ahmed"}, memory=fake_memory)
