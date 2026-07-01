import os
import json
from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def assign_turns(members: list) -> dict:
    """
    members: list of dicts, each like:
    {
        "name": "Ahmed",
        "salary_date": 25,            # day of month they get paid
        "financial_goal": "buying a laptop, needs money soon"
    }
    Returns an ordered list deciding who gets paid out in which month.
    """
    system_prompt = (
        "You are the Turn Agent for a Saudi jamiya (rotating savings circle). "
        "Your job is to assign the optimal monthly payout order for all members, "
        "based on their salary date and stated financial goal. Members with more "
        "urgent goals should generally get earlier turns, but use good judgment."
    )

    user_prompt = f"""Members:
{json.dumps(members, ensure_ascii=False, indent=2)}

Respond ONLY with valid JSON in this exact format, nothing else:
{{
  "turn_order": [
    {{"month": 1, "name": "...", "reason": "short reason in Arabic"}},
    {{"month": 2, "name": "...", "reason": "short reason in Arabic"}}
  ]
}}
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

    return json.loads(raw)


if __name__ == "__main__":
    test_members = [
        {"name": "Ahmed", "salary_date": 25, "financial_goal": "buying a laptop, needs money soon"},
        {"name": "Sara", "salary_date": 1, "financial_goal": "stable savings, no urgent need"},
        {"name": "Faisal", "salary_date": 27, "financial_goal": "wedding expenses in 3 months"},
    ]

    result = assign_turns(test_members)
    print(json.dumps(result, ensure_ascii=False, indent=2))
