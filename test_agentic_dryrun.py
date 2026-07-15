"""
Dry-run test: mocks the Groq client so we can verify the orchestrator's
tool-calling loop, memory read/write, and JSON parsing logic actually work,
without needing a real GROQ_API_KEY or network access.
"""
import json
import os
import sys
import types
from unittest.mock import MagicMock, patch

os.environ["GROQ_API_KEY"] = "test-key-not-real"
sys.path.insert(0, os.path.dirname(__file__))


def make_message(content=None, tool_calls=None):
    msg = MagicMock()
    msg.content = content
    msg.tool_calls = tool_calls
    return msg


def make_tool_call(id_, name, arguments_dict):
    tc = MagicMock()
    tc.id = id_
    tc.function.name = name
    tc.function.arguments = json.dumps(arguments_dict)
    return tc


def make_response(message):
    resp = MagicMock()
    resp.choices = [MagicMock(message=message)]
    return resp


# ---- Test 1: memory.py in isolation ----
def test_memory():
    from memory import JamiyaMemory

    path = "test_memory_scratch.json"
    if os.path.exists(path):
        os.remove(path)

    mem = JamiyaMemory(path=path)
    mem.log_risk_assessment("Ahmed", "yellow", "تأخر مرة واحدة")
    mem.log_payment_event("Ahmed", "missed")
    mem.log_payment_event("Ahmed", "missed")
    ctx = mem.get_member_context("Ahmed")
    assert ctx["missed_payment_count_all_time"] == 2, ctx
    assert len(ctx["past_risk_assessments"]) == 1, ctx

    mem.update_circle_pool(5000, 2)
    mem.log_yield(30, 5030)
    summary = mem.get_circle_summary()
    assert summary["pooled_amount"] == 5000
    assert len(summary["yield_log"]) == 1

    os.remove(path)
    print("test_memory: PASS")


# ---- Test 2: individual agent functions parse JSON + log to memory ----
def test_agent_logs_to_memory():
    import risk_agent
    from memory import JamiyaMemory

    path = "test_memory_scratch2.json"
    if os.path.exists(path):
        os.remove(path)
    mem = JamiyaMemory(path=path)

    member_data = {"name": "Ahmed", "monthly_income": 8000}
    # risk_level/trust_score are now computed deterministically (see
    # risk_agent.compute_trust_score) before the LLM is ever called -- the
    # LLM's job is just to explain that already-decided level in Arabic, so
    # the mocked reply only needs a "reason".
    expected_level = risk_agent.compute_trust_score(member_data)["risk_level"]
    fake_reply = json.dumps({"reason": "دفعة متأخرة"})
    fake_response = make_response(make_message(content=f"```json\n{fake_reply}\n```"))

    with patch.object(risk_agent.client.chat.completions, "create", return_value=fake_response):
        result = risk_agent.assess_risk(member_data, memory=mem)

    assert result["risk_level"] == expected_level, result
    ctx = mem.get_member_context("Ahmed")
    assert len(ctx["past_risk_assessments"]) == 1, ctx

    os.remove(path)
    print("test_agent_logs_to_memory: PASS")


# ---- Test 3: orchestrator's agentic tool-calling loop (multi-step chain) ----
def test_route_and_handle_chains_two_agents():
    import orchestrator
    from memory import JamiyaMemory

    path = "test_memory_scratch3.json"
    if os.path.exists(path):
        os.remove(path)
    mem = JamiyaMemory(path=path)

    # Step 1: router decides to call mediate_missed_payment
    tool_call_1 = make_tool_call(
        "call_1",
        "mediate_missed_payment",
        {"member_data": {"name": "Ahmed", "months_in_circle_before": 6,
                          "payment_history": ["on_time", "missed"], "amount_due": 500}},
    )
    step1_response = make_response(make_message(content=None, tool_calls=[tool_call_1]))

    # Step 2: router decides to also call assess_risk (chaining)
    tool_call_2 = make_tool_call(
        "call_2", "assess_risk", {"member_data": {"name": "Ahmed", "monthly_income": 8000}}
    )
    step2_response = make_response(make_message(content=None, tool_calls=[tool_call_2]))

    # Step 3: router is satisfied, returns final Arabic summary, no more tool calls
    step3_response = make_response(make_message(content="تم التعامل مع الدفعة المتأخرة وتحديث تقييم المخاطر.", tool_calls=None))

    mediator_fake_result = {
        "message_to_member": "مرحباً أحمد ...",
        "restructuring_options": ["خيار 1", "خيار 2", "خيار 3"],
        "draft_contract_note": "ملاحظة العقد",
    }
    risk_fake_result = {"risk_level": "yellow", "reason": "غياب دفعة"}

    with patch.object(orchestrator.client.chat.completions, "create",
                       side_effect=[step1_response, step2_response, step3_response]), \
         patch.object(orchestrator, "mediate_missed_payment", return_value=mediator_fake_result) as mocked_mediator, \
         patch.object(orchestrator, "assess_risk", return_value=risk_fake_result) as mocked_risk:

        # route_and_handle looks up functions via AGENT_FUNCTIONS dict which
        # was bound at import time -- rebind it to the patched mocks too.
        orchestrator.AGENT_FUNCTIONS["mediate_missed_payment"] = mocked_mediator
        orchestrator.AGENT_FUNCTIONS["assess_risk"] = mocked_risk

        result = orchestrator.route_and_handle("Ahmed missed his payment again, handle it and recheck his risk.", memory=mem)

    assert len(result["steps"]) == 2, result
    assert result["steps"][0]["agent"] == "mediate_missed_payment", result
    assert result["steps"][1]["agent"] == "assess_risk", result
    assert "تم التعامل" in result["summary"], result

    if os.path.exists(path):
        os.remove(path)
    print("test_route_and_handle_chains_two_agents: PASS")


if __name__ == "__main__":
    test_memory()
    test_agent_logs_to_memory()
    test_route_and_handle_chains_two_agents()
    print("\nAll dry-run tests passed.")
