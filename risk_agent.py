import os
import json
from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def assess_risk(member_data: dict) -> dict:
    prompt = f"""You are a risk assessment agent for a Saudi jamiya (rotating savings circle).

Given this member's data, assess their default risk.

Member data:
{json.dumps(member_data, ensure_ascii=False, indent=2)}

Respond ONLY with valid JSON in this exact format, nothing else:
{{
  "risk_level": "green" or "yellow" or "red",
  "reason": "one short sentence explaining why, in Arabic"
}}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )

    raw = response.choices[0].message.content.strip()
    # Models sometimes wrap JSON in ```json fences -- strip those if present
    raw = raw.replace("```json", "").replace("```", "").strip()

    return json.loads(raw)


if __name__ == "__main__":
    # quick manual test
    test_member = {
        "name": "Ahmed",
        "monthly_income": 8000,
        "payment_history": ["on_time", "on_time", "late_3_days", "on_time"],
        "months_in_circle_before": 6
    }

    result = assess_risk(test_member)
    print(json.dumps(result, ensure_ascii=False, indent=2))
