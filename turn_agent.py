import os
import json
from typing import Optional
from groq import Groq

from memory import JamiyaMemory

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def assign_turns(members: list, memory: Optional[JamiyaMemory] = None) -> dict:
    """
    members: list of dicts, each like:
    {
        "name": "Ahmed",
        "salary_date": 25,            # day of month they get paid
        "financial_goal": "buying a laptop, needs money soon"
    }
    Returns an ordered list deciding who gets paid out in which month.

    memory: optional JamiyaMemory. When given, each member's past turn
    history is included so the agent doesn't give the same person an
    early turn cycle after cycle -- fairness over time, not just this round.
    """
    enriched_members = list(members)
    history_by_name = {}
    if memory:
        for m in members:
            history_by_name[m["name"]] = memory.get_member_context(m["name"])["past_turn_assignments"]

    system_prompt = (
        "You are the Turn Agent for a Saudi jamiya (rotating savings circle). "
        "Your job is to assign the optimal monthly payout order for all members, "
        "based on their salary date and stated financial goal. Members with more "
        "urgent goals should generally get earlier turns, but use good judgment. "
        "If a member's past turn history is provided, avoid consistently favoring "
        "the same member across cycles unless their need is clearly more urgent."
    )

    user_prompt = f"""Members:
{json.dumps(enriched_members, ensure_ascii=False, indent=2)}
"""
    if history_by_name and any(history_by_name.values()):
        user_prompt += f"""
Past turn assignments per member (for fairness across cycles):
{json.dumps(history_by_name, ensure_ascii=False, indent=2)}
"""

    user_prompt += """
Respond ONLY with valid JSON in this exact format, nothing else:
{
  "turn_order": [
    {"month": 1, "name": "...", "reason": "short reason in Arabic"},
    {"month": 2, "name": "...", "reason": "short reason in Arabic"}
  ]
}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
    )

    raw = response.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()

    result = json.loads(raw)

    if memory:
        for entry in result.get("turn_order", []):
            memory.log_turn_assignment(entry.get("name", "unknown"), entry.get("month"), entry.get("reason", ""))

    return result


if __name__ == "__main__":
    test_members = [
        {"name": "Ahmed", "salary_date": 25, "financial_goal": "buying a laptop, needs money soon"},
        {"name": "Sara", "salary_date": 1, "financial_goal": "stable savings, no urgent need"},
        {"name": "Faisal", "salary_date": 27, "financial_goal": "wedding expenses in 3 months"},
    ]

    mem = JamiyaMemory(path="jamiya_memory.demo.json")
    result = assign_turns(test_members, memory=mem)
    print(json.dumps(result, ensure_ascii=False, indent=2))
