from risk_agent import assess_risk
from turn_agent import assign_turns
from yield_agent import calculate_yield
from mediator_agent import mediate_missed_payment


def handle_event(event: dict) -> dict:
    event_type = event.get("event_type")

    if event_type == "new_member":
        member_data = event["member_data"]
        result = assess_risk(member_data)
        return {"handled_by": "risk_agent", "result": result}

    elif event_type == "assign_turns":
        members = event["members"]
        result = assign_turns(members)
        return {"handled_by": "turn_agent", "result": result}

    elif event_type == "calculate_yield":
        pooled_amount = event["pooled_amount"]
        months_idle = event["months_idle"]
        result = calculate_yield(pooled_amount, months_idle)
        return {"handled_by": "yield_agent", "result": result}

    elif event_type == "payment_missed":
        member_data = event["member_data"]
        result = mediate_missed_payment(member_data)
        return {"handled_by": "mediator_agent", "result": result}

    return {"error": f"Unknown event type: {event_type}"}


if __name__ == "__main__":
    # Quick manual test of all four agents through the Orchestrator
    test_events = [
        {
            "event_type": "new_member",
            "member_data": {
                "name": "Ahmed", "monthly_income": 8000,
                "payment_history": ["on_time", "on_time", "late_3_days", "on_time"],
                "months_in_circle_before": 6
            }
        },
        {
            "event_type": "assign_turns",
            "members": [
                {"name": "Ahmed", "salary_date": 25, "financial_goal": "buying a laptop, needs money soon"},
                {"name": "Sara", "salary_date": 1, "financial_goal": "stable savings, no urgent need"},
                {"name": "Faisal", "salary_date": 27, "financial_goal": "wedding expenses in 3 months"},
            ]
        },
        {
            "event_type": "calculate_yield",
            "pooled_amount": 4000,
            "months_idle": 3
        },
        {
            "event_type": "payment_missed",
            "member_data": {
                "name": "Ahmed", "months_in_circle_before": 6,
                "payment_history": ["on_time", "on_time", "missed"],
                "amount_due": 500
            }
        },
    ]

    for event in test_events:
        print(f"\n=== Event: {event['event_type']} ===")
        output = handle_event(event)
        print(json.dumps(output, ensure_ascii=False, indent=2) if False else output)