import os
import json
from typing import Optional
from groq import Groq

from memory import JamiyaMemory

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def assess_risk(member_data: dict, memory: Optional[JamiyaMemory] = None) -> dict:
    """
    member_data: the raw event payload for this member (name, income, the
    payment_history/months_in_circle_before given for THIS event).

    memory: optional JamiyaMemory. When given, the agent also sees the
    member's full history across every past event, not just what was
    passed in this one call, so e.g. a member who's been assessed "yellow"
    twice before gets treated differently than a first-timer with the
    same numbers.
    """
    name = member_data.get("name", "unknown")
    history_context = memory.get_member_context(name) if memory else None

    prompt = f"""You are a risk assessment agent for a Saudi jamiya (rotating savings circle).

Given this member's data, assess their default risk.

Member data (this event):
{json.dumps(member_data, ensure_ascii=False, indent=2)}
"""
    if history_context:
        prompt += f"""
Member's history across the circle so far (use this to inform your judgment --
e.g. a repeat pattern of risk should weigh more heavily than a one-off):
{json.dumps(history_context, ensure_ascii=False, indent=2)}
"""

    prompt += """
Respond ONLY with valid JSON in this exact format, nothing else:
{
  "risk_level": "green" or "yellow" or "red",
  "reason": "one short sentence explaining why, in Arabic"
}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )

    raw = response.choices[0].message.content.strip()
    # Models sometimes wrap JSON in ```json fences -- strip those if present
    raw = raw.replace("```json", "").replace("```", "").strip()

    result = json.loads(raw)

    if memory:
        memory.log_risk_assessment(name, result.get("risk_level", "unknown"), result.get("reason", ""))

    return result


if __name__ == "__main__":
    test_member = {
        "name": "Ahmed",
        "monthly_income": 8000,
        "payment_history": ["on_time", "on_time", "late_3_days", "on_time"],
        "months_in_circle_before": 6,
    }

    mem = JamiyaMemory(path="jamiya_memory.demo.json")
    result = assess_risk(test_member, memory=mem)
    print(json.dumps(result, ensure_ascii=False, indent=2))
