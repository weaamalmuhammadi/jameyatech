import os
import json
import re
from pathlib import Path
from typing import Optional
from groq import Groq

from memory import JamiyaMemory
from agent_utils import call_llm_json

try:
    import pandas as pd
except ImportError:  # pandas is a soft dependency for the CSV-grounding path only
    pd = None

client = Groq(api_key=os.environ.get("GROQ_API_KEY"))

# Mirrors the Trust Score formula documented in docs/Feature_Engineering.md and
# implemented in scripts/feature_engineering.py, so a member with no prior
# history in data/03_Synthetic_Jamiya_Dataset.csv still gets scored the same
# way the dataset's members were.
GRADE_SCORE = {"A": 25, "B": 20, "C": 15, "D": 10, "E": 5, "F": 0}
DEFAULT_GRADE = "C"  # used when member_data doesn't supply a credit_grade
CLEAN_SLATE_SCORE = 85  # used when there's no negative signal at all -- see compute_trust_score

_CSV_PATH = Path(__file__).parent / "data" / "03_Synthetic_Jamiya_Dataset.csv"


def _load_dataset():
    """Loaded once at import time. Returns None (not an exception) if pandas
    or the CSV isn't available -- assess_risk() falls back to the
    heuristic formula for every member in that case, it never breaks."""
    if pd is None or not _CSV_PATH.exists():
        return None
    try:
        # dtype=str on Phone -- otherwise pandas reads it as an int and
        # silently drops the leading zero (0510433218 -> 510433218), which
        # would break every phone-number match.
        return pd.read_csv(_CSV_PATH, encoding="utf-8-sig", dtype={"Phone": str})
    except Exception:
        return None


_DATASET = _load_dataset()


def _lookup_csv_row_by_phone(phone: str):
    """Exact match against Phone. Phone numbers are unique per row in the
    dataset, so this returns at most one record -- unlike name matching,
    which collides constantly (every name in the seed dataset appears
    2-5 times as different synthetic profiles)."""
    if _DATASET is None or not phone:
        return None
    digits = re.sub(r"\D", "", phone)
    if not digits:
        return None
    matches = _DATASET[_DATASET["Phone"].astype(str) == digits]
    return matches.iloc[0] if len(matches) > 0 else None


def _names_match(entered_name: str, record_name: str) -> bool:
    """Case-insensitive. Treats a first-name-only entry ("Faisal") as a
    match against a full name on record ("Faisal Al-Rashidi") so normal
    partial entry isn't flagged -- only a genuinely different name is."""
    if not entered_name or not record_name:
        return True  # nothing to compare against, don't flag
    a, b = entered_name.strip().lower(), record_name.strip().lower()
    if a == b or a in b or b in a:
        return True
    a_first, b_first = a.split()[:1], b.split()[:1]
    return bool(a_first and b_first and a_first[0] == b_first[0])


def _risk_level(trust_score: float) -> str:
    if trust_score >= 80:
        return "green"
    if trust_score >= 60:
        return "yellow"
    return "red"


def _infer_late_missed_counts(payment_history: list) -> tuple:
    """payment_history: list of strings like 'on_time', 'late_5_days', 'missed'."""
    late = sum(1 for p in payment_history if isinstance(p, str) and p.startswith("late"))
    missed = sum(1 for p in payment_history if p == "missed")
    return late, missed


def compute_trust_score(member_data: dict, history_context: Optional[dict] = None) -> dict:
    """
    Returns {"trust_score": int, "risk_level": "green"|"yellow"|"red",
    "reason_en": str, "source": "csv"|"heuristic", "csv_matched": bool,
    "name_mismatch": bool, "record_name": str|None}.

    Looks the member up by PHONE NUMBER against data/03_Synthetic_Jamiya_
    Dataset.csv (unique per row) rather than by name. If the phone is on
    record under a different name than the one entered, that's flagged as
    name_mismatch -- an unverified identity is a risk signal in its own
    right, not just metadata, so it can never result in a "green" verdict.
    Falls back to the documented deterministic formula when the phone isn't
    found (or wasn't provided), so every assessment is a real computed
    score -- never a pure LLM guess -- except when there's no negative
    signal at all (no late/missed payments, no previous default), in which
    case it short-circuits to a trusted score instead of running the
    formula: that formula is calibrated on members with real credit grades
    and years of tenure, and applied to a brand-new member with neither, it
    can never clear the Green threshold and often lands Red on a clean
    record. Absence of derogatory history is a positive signal, not a gap.
    """
    name = member_data.get("name", "")
    phone = member_data.get("phone", "")
    record = _lookup_csv_row_by_phone(phone)

    if record is not None:
        trust_score = int(record["Trust_Score"])
        risk_level = _risk_level(trust_score)
        record_name = record["Member_Name"]
        name_mismatch = not _names_match(name, record_name)
        reason_en = record["Risk_Reason"]
        if name_mismatch:
            if risk_level == "green":
                risk_level = "yellow"  # unverified identity is never a clean pass
            reason_en = f"phone number is on record under a different name ({record_name}); {reason_en}"
        return {
            "trust_score": trust_score,
            "risk_level": risk_level,
            "reason_en": reason_en,
            "source": "csv",
            "csv_matched": True,
            "name_mismatch": name_mismatch,
            "record_name": record_name if name_mismatch else None,
        }

    payment_history = member_data.get("payment_history", []) or []
    late, missed = _infer_late_missed_counts(payment_history)
    if history_context and history_context.get("missed_payment_count_all_time") is not None:
        # All-time count from memory is more authoritative than this single event.
        missed = max(missed, history_context["missed_payment_count_all_time"])
    previous_default = bool(member_data.get("previous_default", False))

    if late == 0 and missed == 0 and not previous_default:
        # No negative signal at all. The formula below is calibrated on the
        # dataset's real members (real credit grade, real multi-year tenure)
        # -- applied to a brand-new member the app has no data on, its
        # baseline (40 + an assumed-average grade) sits below the Yellow
        # cutoff before any penalty is even applied, and its ceiling for a
        # zero-tenure member never reaches Green at all. That flagged every
        # clean new member as risky. Absence of derogatory history is a
        # positive signal, not "insufficient data" -- treat it as trusted.
        return {
            "trust_score": CLEAN_SLATE_SCORE,
            "risk_level": _risk_level(CLEAN_SLATE_SCORE),
            "reason_en": "clean payment history, no negative signals on file",
            "source": "heuristic",
            "csv_matched": False,
            "name_mismatch": False,
            "record_name": None,
        }

    membership_years = member_data.get("months_in_circle_before", 0) / 12
    grade = member_data.get("credit_grade", DEFAULT_GRADE)

    score = 40 + GRADE_SCORE.get(grade, GRADE_SCORE[DEFAULT_GRADE]) + membership_years * 3
    score -= late * 4 + missed * 12
    if previous_default:
        score -= 15
    trust_score = int(round(max(0, min(100, score))))

    return {
        "trust_score": trust_score,
        "risk_level": _risk_level(trust_score),
        "reason_en": "insufficient history" if missed == 0 and late == 0 else "based on payment history",
        "source": "heuristic",
        "csv_matched": False,
        "name_mismatch": False,
        "record_name": None,
    }


_FALLBACK_REASONS = {
    "green": "لا توجد مؤشرات خطر واضحة بناءً على البيانات المتاحة.",
    "yellow": "بعض التأخير في السجل يستدعي متابعة، دون قلق كبير.",
    "red": "نمط تأخر أو تخلف متكرر عن الدفع في البيانات المتاحة.",
}
_MISMATCH_FALLBACK_SUFFIX = " كما أن رقم الجوال مسجّل باسم مختلف عمّا تم إدخاله، ويُنصح بالتحقق من الهوية."


def assess_risk(member_data: dict, memory: Optional[JamiyaMemory] = None) -> dict:
    """
    member_data: the raw event payload for this member -- name, phone (used
    to look the member up), income, payment_history/months_in_circle_before
    given for THIS event.

    memory: optional JamiyaMemory. When given, the agent also sees the
    member's full history across every past event, not just what was
    passed in this one call.

    The risk_level/trust_score are always a real computed score (grounded in
    data/03_Synthetic_Jamiya_Dataset.csv when the phone number is found
    there, otherwise the same deterministic formula that generated that
    dataset) -- the LLM's job is only to explain that score in one short
    Arabic sentence, not to invent the level itself.
    """
    name = member_data.get("name", "unknown")
    history_context = memory.get_member_context(name) if memory else None

    scored = compute_trust_score(member_data, history_context)
    risk_level = scored["risk_level"]

    prompt = f"""You are a risk assessment agent for a Saudi jamiya (rotating savings circle).

A scoring model has already assessed this member's default risk as "{risk_level}"
(trust score {scored['trust_score']}/100), based on: {scored['reason_en']}.
"""
    if scored["name_mismatch"]:
        prompt += f"""
IMPORTANT: the phone number provided is on record under the name
"{scored['record_name']}", not the name given below. Mention this identity
mismatch explicitly in your explanation as a reason for caution.
"""
    prompt += f"""
Member data (this event):
{json.dumps(member_data, ensure_ascii=False, indent=2)}
"""
    if history_context:
        prompt += f"""
Member's history across the circle so far:
{json.dumps(history_context, ensure_ascii=False, indent=2)}
"""
    prompt += """
Respond ONLY with valid JSON in this exact format, nothing else. Do not
change the risk level -- only explain it:
{
  "reason": "one short sentence in Arabic explaining this risk level"
}
"""

    fallback_reason = _FALLBACK_REASONS[risk_level]
    if scored["name_mismatch"]:
        fallback_reason += _MISMATCH_FALLBACK_SUFFIX

    llm_result = call_llm_json(
        client,
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
        fallback={"reason": fallback_reason},
    )
    reason = llm_result.get("reason") or fallback_reason

    result = {
        "risk_level": risk_level,
        "reason": reason,
        "trust_score": scored["trust_score"],
        "source": scored["source"],
        "name_mismatch": scored["name_mismatch"],
    }
    if scored["record_name"]:
        result["record_name"] = scored["record_name"]

    if memory:
        memory.log_risk_assessment(name, risk_level, reason, trust_score=scored["trust_score"])

    return result


if __name__ == "__main__":
    mem = JamiyaMemory(path="jamiya_memory.demo.json")

    # No phone on record -> heuristic formula.
    test_member = {
        "name": "Ahmed",
        "monthly_income": 8000,
        "payment_history": ["on_time", "on_time", "late_3_days", "on_time"],
        "months_in_circle_before": 6,
    }
    print(json.dumps(assess_risk(test_member, memory=mem), ensure_ascii=False, indent=2))

    if _DATASET is not None and len(_DATASET) > 0:
        sample = _DATASET.iloc[0]
        real_phone, real_name = str(sample["Phone"]), sample["Member_Name"]

        # Phone matches a real record, name matches too -> clean CSV-grounded result.
        matched = {"name": real_name, "phone": real_phone}
        print(json.dumps(assess_risk(matched, memory=mem), ensure_ascii=False, indent=2))

        # Same phone, but a different name -> should be flagged as a mismatch
        # and never come back "green".
        mismatched = {"name": "Someone Else Entirely", "phone": real_phone}
        print(json.dumps(assess_risk(mismatched, memory=mem), ensure_ascii=False, indent=2))
