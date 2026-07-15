import os
import json
from typing import Optional
from groq import Groq

from memory import JamiyaMemory
from agent_utils import call_llm_json

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Mocked Shariah-compliant money market fund annual rate (for demo purposes)
ANNUAL_YIELD_RATE = 0.03  # 3% annual, mocked


def calculate_yield(pooled_amount: float, months_idle: int, memory: Optional[JamiyaMemory] = None) -> dict:
    """
    pooled_amount: total SAR sitting idle in the circle right now
    months_idle: how many months this money has been waiting for payout

    This is mostly real math (no LLM needed for the number itself),
    but we ask the LLM to generate a friendly Arabic explanation,
    matching the pattern of the other agents.

    memory: optional JamiyaMemory. Updates the circle's running pool
    total and logs each yield event so the circle has an auditable
    history of how the pooled money has grown over time.
    """
    monthly_rate = ANNUAL_YIELD_RATE / 12
    earned_yield = pooled_amount * monthly_rate * months_idle
    new_total = pooled_amount + earned_yield

    system_prompt = (
        "You are the Yield Agent for a Saudi jamiya (rotating savings circle). "
        "You explain, in simple friendly Arabic, how much yield was earned on "
        "idle pooled funds through a Shariah-compliant money market fund."
    )

    user_prompt = f"""Pooled amount: {pooled_amount} SAR
Months idle: {months_idle}
Annual yield rate (mocked): {ANNUAL_YIELD_RATE * 100}%
Yield earned: {earned_yield:.2f} SAR
New total: {new_total:.2f} SAR

Respond ONLY with valid JSON in this exact format, nothing else:
{{
  "yield_earned": {earned_yield:.2f},
  "new_total": {new_total:.2f},
  "explanation": "one short friendly sentence in Arabic explaining the yield earned"
}}
"""

    result = call_llm_json(
        client,
        model="llama-3.3-70b-versatile",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.3,
        fallback={
            "yield_earned": round(earned_yield, 2),
            "new_total": round(new_total, 2),
            "explanation": "تم حساب العائد المتوقع بناءً على المعدل الشهري المتوافق مع الشريعة.",
        },
    )

    if memory:
        memory.update_circle_pool(new_total, 0)  # pool resets idle-clock once paid out/reinvested
        memory.log_yield(result.get("yield_earned", earned_yield), result.get("new_total", new_total))

    return result


if __name__ == "__main__":
    mem = JamiyaMemory(path="jamiya_memory.demo.json")
    result = calculate_yield(pooled_amount=4000, months_idle=3, memory=mem)
    print(json.dumps(result, ensure_ascii=False, indent=2))
