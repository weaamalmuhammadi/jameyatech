import os
import json
from groq import Groq

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


def mediate_missed_payment(member_data: dict) -> dict:
    """
    member_data: dict like:
    {
        "name": "Ahmed",
        "months_in_circle_before": 6,
        "payment_history": ["on_time", "on_time", "missed"],
        "amount_due": 500
    }
    Returns a private Arabic message + 2-3 restructuring options + a draft
    contract note, matching what the Mediator Agent does in the proposal.
    """
    system_prompt = (
        "You are the Mediator Agent for a Saudi jamiya (rotating savings circle). "
        "When a member misses a payment, you privately and respectfully reach out "
        "to them in Arabic, propose 2-3 fair restructuring options, and draft a "
        "short note describing the agreement once they choose. Be gentle but clear, "
        "and consider their payment history when deciding the tone. "
        "CRITICAL: You must respond ONLY in Arabic. Do NOT use any Chinese, Japanese, "
        "Korean, or any non-Arabic characters. Every single word must be in Arabic only."
    )

    user_prompt = f"""Member who missed a payment:
{json.dumps(member_data, ensure_ascii=False, indent=2)}

Respond ONLY with valid JSON in this exact format, nothing else:
{{
  "message_to_member": "private Arabic message, gentle but clear",
  "restructuring_options": [
    "option 1 in Arabic",
    "option 2 in Arabic",
    "option 3 in Arabic"
  ],
  "draft_contract_note": "short Arabic note describing what the new agreement will cover, to be finalized once member picks an option"
}}
"""

    response = client.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
    )

    raw = response.choices[0].message.content.strip()
    raw = raw.replace("```json", "").replace("```", "").strip()

    # Remove any stray non-Arabic/non-Latin characters (e.g. Chinese glyphs)
    import re
    raw = re.sub(r'[^\u0000-\u007F\u0600-\u06FF\u0750-\u077F\s\d\{\}\[\]\"\'\:\,\.\!\?\-\_\(\)]', '', raw)

    return json.loads(raw)


if __name__ == "__main__":
    test_member = {
        "name": "Ahmed",
        "months_in_circle_before": 6,
        "payment_history": ["on_time", "on_time", "missed"],
        "amount_due": 500
    }

    result = mediate_missed_payment(test_member)
    print(json.dumps(result, ensure_ascii=False, indent=2))