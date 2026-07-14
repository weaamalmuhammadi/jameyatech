"""
Orchestrator for JamiyaTech.

Two ways to route an event to an agent:

1. handle_event(event, memory) -- the original fast path. Event comes in
   with an explicit `event_type` and the orchestrator dispatches with a
   simple lookup. Zero LLM calls, zero latency, can't misroute. This is
   what the existing web UI (index.html/app.js -> agent_server.py) uses,
   and it stays exactly as reliable as before.

2. route_and_handle(user_message, memory) -- the new agentic path. Instead
   of a hardcoded event_type, you give the Orchestrator a natural-language
   description of what happened (e.g. "Ahmed just missed his payment again,
   check if that changes his risk level too"), and an LLM decides which
   agent(s) to call using tool-calling, can chain multiple agents together
   in one turn, and explains its own routing decision. This is the "real"
   agentic behavior: reasoning about *which* tool to use and *when to stop*,
   instead of a human having pre-decided the mapping.

Both paths share the same underlying agent functions and the same
JamiyaMemory instance, so results from one are visible to the other.
"""
import json
import os
from typing import Optional

from groq import Groq

from memory import JamiyaMemory
from risk_agent import assess_risk
from turn_agent import assign_turns
from yield_agent import calculate_yield
from mediator_agent import mediate_missed_payment

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
ROUTER_MODEL = "llama-3.3-70b-versatile"
MAX_AGENT_STEPS = 4  # safety cap so a confused router can't loop forever


# --------------------------------------------------------------------- #
# Path 1: deterministic fast dispatch (unchanged behavior, now memory-aware)
# --------------------------------------------------------------------- #
def handle_event(event: dict, memory: Optional[JamiyaMemory] = None) -> dict:
    event_type = event.get("event_type")

    if event_type == "new_member":
        member_data = event["member_data"]
        result = assess_risk(member_data, memory=memory)
        return {"handled_by": "risk_agent", "result": result}

    elif event_type == "assign_turns":
        members = event["members"]
        result = assign_turns(members, memory=memory)
        return {"handled_by": "turn_agent", "result": result}

    elif event_type == "calculate_yield":
        pooled_amount = event["pooled_amount"]
        months_idle = event["months_idle"]
        result = calculate_yield(pooled_amount, months_idle, memory=memory)
        return {"handled_by": "yield_agent", "result": result}

    elif event_type == "payment_missed":
        member_data = event["member_data"]
        result = mediate_missed_payment(member_data, memory=memory)
        return {"handled_by": "mediator_agent", "result": result}

    return {"error": f"Unknown event type: {event_type}"}


# --------------------------------------------------------------------- #
# Path 2: LLM-driven agentic router with tool-calling
# --------------------------------------------------------------------- #
TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "assess_risk",
            "description": "Assess a member's default risk (green/yellow/red) for the jamiya circle.",
            "parameters": {
                "type": "object",
                "properties": {
                    "member_data": {
                        "type": "object",
                        "description": "name, monthly_income, payment_history (list), months_in_circle_before",
                    }
                },
                "required": ["member_data"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "assign_turns",
            "description": "Decide the monthly payout order for a list of circle members.",
            "parameters": {
                "type": "object",
                "properties": {
                    "members": {
                        "type": "array",
                        "description": "list of {name, salary_date, financial_goal}",
                        "items": {"type": "object"},
                    }
                },
                "required": ["members"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate_yield",
            "description": "Calculate the Shariah-compliant yield earned on the circle's idle pooled funds.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pooled_amount": {"type": "number"},
                    "months_idle": {"type": "integer"},
                },
                "required": ["pooled_amount", "months_idle"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "mediate_missed_payment",
            "description": "Privately reach out to a member who missed a payment and propose restructuring options.",
            "parameters": {
                "type": "object",
                "properties": {
                    "member_data": {
                        "type": "object",
                        "description": "name, months_in_circle_before, payment_history (list), amount_due",
                    }
                },
                "required": ["member_data"],
            },
        },
    },
]

# Maps a tool name the LLM can call to the real Python function.
AGENT_FUNCTIONS = {
    "assess_risk": assess_risk,
    "assign_turns": assign_turns,
    "calculate_yield": calculate_yield,
    "mediate_missed_payment": mediate_missed_payment,
}


def _router_system_prompt(memory: Optional[JamiyaMemory]) -> str:
    circle_summary = memory.get_circle_summary() if memory else None
    prompt = (
        "You are the Orchestrator for JamiyaTech, an AI system managing a Saudi jamiya "
        "(rotating savings circle). You have four specialist agents available as tools: "
        "assess_risk, assign_turns, calculate_yield, and mediate_missed_payment. "
        "Read the user's message, decide which agent(s) are actually needed, and call "
        "them with well-formed arguments. You may call more than one agent in sequence "
        "if the situation calls for it -- for example, after mediating a missed payment "
        "it is often worth re-checking that member's risk level. Do not call an agent "
        "that isn't relevant to the message. Once you have enough information, stop "
        "calling tools and give a short summary in Arabic of what was done and why."
    )
    if circle_summary:
        prompt += f"\n\nCurrent circle state:\n{json.dumps(circle_summary, ensure_ascii=False, indent=2)}"
    return prompt


def route_and_handle(user_message: str, memory: Optional[JamiyaMemory] = None) -> dict:
    """
    user_message: free-text description of what's happening, e.g.
      "Sara just missed her payment for the second time, handle it and
       tell me if her risk level should change."

    Returns a dict with:
      - "steps": ordered log of every agent call the router made and its result
      - "summary": the router's final natural-language (Arabic) summary
    """
    messages = [
        {"role": "system", "content": _router_system_prompt(memory)},
        {"role": "user", "content": user_message},
    ]

    steps = []

    for _ in range(MAX_AGENT_STEPS):
        response = client.chat.completions.create(
            model=ROUTER_MODEL,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
            temperature=0.2,
        )
        choice = response.choices[0].message

        if not choice.tool_calls:
            # Router is done calling agents -- this is its final answer.
            return {"steps": steps, "summary": choice.content}

        # The model asked to call one or more tools. Append its own turn first
        # (required by the API so tool_call_ids line up), then run each tool
        # and feed the real result back in as a "tool" message.
        messages.append(choice)

        for tool_call in choice.tool_calls:
            fn_name = tool_call.function.name
            try:
                fn_args = json.loads(tool_call.function.arguments)
            except json.JSONDecodeError:
                fn_args = {}

            fn = AGENT_FUNCTIONS.get(fn_name)
            if fn is None:
                tool_result = {"error": f"Unknown tool requested: {fn_name}"}
            else:
                try:
                    tool_result = fn(**fn_args, memory=memory)
                except Exception as e:  # a single bad agent call shouldn't kill the whole chain
                    tool_result = {"error": str(e)}

            steps.append({"agent": fn_name, "args": fn_args, "result": tool_result})

            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps(tool_result, ensure_ascii=False),
                }
            )

    # Hit MAX_AGENT_STEPS without the router naturally stopping -- return what
    # we have rather than looping forever or raising.
    return {"steps": steps, "summary": "تم الوصول للحد الأقصى من خطوات المعالجة."}


if __name__ == "__main__":
    mem = JamiyaMemory(path="jamiya_memory.demo.json")

    print("=== Fast path (handle_event) ===")
    test_events = [
        {
            "event_type": "new_member",
            "member_data": {
                "name": "Ahmed",
                "monthly_income": 8000,
                "payment_history": ["on_time", "on_time", "late_3_days", "on_time"],
                "months_in_circle_before": 6,
            },
        },
        {
            "event_type": "assign_turns",
            "members": [
                {"name": "Ahmed", "salary_date": 25, "financial_goal": "buying a laptop, needs money soon"},
                {"name": "Sara", "salary_date": 1, "financial_goal": "stable savings, no urgent need"},
                {"name": "Faisal", "salary_date": 27, "financial_goal": "wedding expenses in 3 months"},
            ],
        },
        {"event_type": "calculate_yield", "pooled_amount": 4000, "months_idle": 3},
        {
            "event_type": "payment_missed",
            "member_data": {
                "name": "Ahmed",
                "months_in_circle_before": 6,
                "payment_history": ["on_time", "on_time", "missed"],
                "amount_due": 500,
            },
        },
    ]
    for event in test_events:
        print(f"\n--- Event: {event['event_type']} ---")
        print(handle_event(event, memory=mem))

    print("\n=== Agentic path (route_and_handle) ===")
    result = route_and_handle(
        "Ahmed just missed his payment again -- handle it with him and check "
        "whether his risk level needs to change.",
        memory=mem,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))
