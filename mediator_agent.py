import os
import json
from typing import Optional
from groq import Groq

from memory import JamiyaMemory
from agent_utils import call_llm_json

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# ASCII (Latin/JSON syntax) + Arabic + Arabic Supplement code point ranges.
# Expressed as integer bounds (not a literal regex char class) so the
# ranges can't get mangled by text-encoding round-trips.
_ALLOWED_RANGES = ((0x0000, 0x007F), (0x0600, 0x06FF), (0x0750, 0x077F))


def _scrub_non_arabic(raw: str) -> str:
    """Remove any stray non-Arabic/non-Latin characters (e.g. Chinese glyphs)."""
    return ''.join(ch for ch in raw if any(lo <= ord(ch) <= hi for lo, hi in _ALLOWED_RANGES))


def _fallback_mediation(amount_due) -> dict:
    return {
        "message_to_member": "لاحظنا تأخراً في دفعة هذا الشهر. نتفهم أن الظروف قد تتغير، ونود التواصل معك لإيجاد حل مناسب.",
        "restructuring_options": [
            "دفع المبلغ المتأخر خلال أسبوع إضافي",
            "تقسيط المبلغ على الدفعتين القادمتين",
            "تأجيل الدور إلى نهاية الجمعية مقابل تسوية المبلغ",
        ],
        "draft_contract_note": (
            "سيتم توثيق اتفاق إعادة الجدولة "
            f"على مبلغ {amount_due} ريال بعد اختيار العضو للخيار المناسب."
        ),
    }


def mediate_missed_payment(member_data: dict, memory: Optional[JamiyaMemory] = None) -> dict:
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

    memory: optional JamiyaMemory. When given, the agent is told how many
    times this member has missed a payment and been mediated with before,
    all-time -- so a first-time miss gets a gentler tone than a repeat
    pattern, and it logs this event and this member's missed payment for
    future agents (e.g. the Risk Agent) to see.
    """
    name = member_data.get("name", "unknown")
    history_context = memory.get_member_context(name) if memory else None

    system_prompt = (
        "You are the Mediator Agent for a Saudi jamiya (rotating savings circle). "
        "When a member misses a payment, you privately and respectfully reach out "
        "to them in Arabic, propose 2-3 fair restructuring options, and draft a "
        "short note describing the agreement once they choose. Be gentle but clear, "
        "and consider their payment history when deciding the tone -- a first-time "
        "miss should read more understanding, a repeat pattern should be clear and "
        "firmer while remaining respectful. "
        "CRITICAL: You must respond ONLY in Arabic. Do NOT use any Chinese, Japanese, "
        "Korean, or any non-Arabic characters. Every single word must be in Arabic only."
    )

    user_prompt = f"""Member who missed a payment (this event):
{json.dumps(member_data, ensure_ascii=False, indent=2)}
"""
    if history_context:
        user_prompt += f"""
Member's history across the circle so far (all-time missed payment count
and past mediations -- use this to calibrate tone):
{json.dumps(history_context, ensure_ascii=False, indent=2)}
"""

    user_prompt += """
Respond ONLY with valid JSON in this exact format, nothing else:
{
  "message_to_member": "private Arabic message, gentle but clear",
  "restructuring_options": [
    "option 1 in Arabic",
    "option 2 in Arabic",
    "option 3 in Arabic"
  ],
  "draft_contract_note": "short Arabic note describing what the new agreement will cover, to be finalized once member picks an option"
}
"""

    amount_due = member_data.get("amount_due", "")
    result = call_llm_json(
        client,
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.4,
        fallback=_fallback_mediation(amount_due),
        postprocess=_scrub_non_arabic,
    )

    if memory:
        memory.log_payment_event(name, "missed")
        memory.log_mediation(name, result.get("restructuring_options", []), result.get("draft_contract_note"))

    return result


if __name__ == "__main__":
    test_member = {
        "name": "Ahmed",
        "months_in_circle_before": 6,
        "payment_history": ["on_time", "on_time", "missed"],
        "amount_due": 500,
    }

    mem = JamiyaMemory(path="jamiya_memory.demo.json")
    result = mediate_missed_payment(test_member, memory=mem)
    print(json.dumps(result, ensure_ascii=False, indent=2))
