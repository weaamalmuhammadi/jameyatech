"""
Lightweight, file-backed shared memory for the JamiyaTech agents.

Without this, every agent only ever sees the single event it was called
with -- the Risk Agent has no idea a member has been late three times
before, the Turn Agent forgets who already got an early turn last cycle,
the Mediator Agent doesn't know this is the member's second missed
payment ever. This module gives the Orchestrator (and, through it, every
agent) a persistent view of each member and of the circle as a whole
across a whole session/demo.

Storage is deliberately simple (one JSON file) since this is a hackathon
MVP. Swap `_load`/`_save` for a real DB (e.g. Supabase/Postgres) later
without touching the public methods below.
"""
import json
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

DEFAULT_MEMORY_PATH = os.environ.get("JAMIYA_MEMORY_PATH", "jamiya_memory.json")


class JamiyaMemory:
    def __init__(self, path: str = DEFAULT_MEMORY_PATH):
        self.path = path
        self._data = self._load()

    # ---------------------------------------------------------------- io --
    def _load(self) -> Dict[str, Any]:
        if os.path.exists(self.path):
            with open(self.path, "r", encoding="utf-8") as f:
                try:
                    return json.load(f)
                except json.JSONDecodeError:
                    pass  # corrupt/empty file -> start fresh instead of crashing
        return {
            "members": {},
            "circle": {"pooled_amount": 0.0, "months_idle": 0, "yield_log": []},
        }

    def _save(self) -> None:
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)

    def _member(self, name: str) -> Dict[str, Any]:
        return self._data["members"].setdefault(
            name,
            {"risk_history": [], "turn_history": [], "payment_history": [], "mediation_log": []},
        )

    # ----------------------------------------------------------- writers --
    def log_risk_assessment(self, name: str, risk_level: str, reason: str) -> None:
        self._member(name)["risk_history"].append(
            {"ts": datetime.now(timezone.utc).isoformat(), "risk_level": risk_level, "reason": reason}
        )
        self._save()

    def log_turn_assignment(self, name: str, month: int, reason: str) -> None:
        self._member(name)["turn_history"].append(
            {"ts": datetime.now(timezone.utc).isoformat(), "month": month, "reason": reason}
        )
        self._save()

    def log_payment_event(self, name: str, status: str) -> None:
        """status: 'on_time' | 'late' | 'missed'"""
        self._member(name)["payment_history"].append(
            {"ts": datetime.now(timezone.utc).isoformat(), "status": status}
        )
        self._save()

    def log_mediation(self, name: str, options: List[str], contract_note: Optional[str] = None) -> None:
        self._member(name)["mediation_log"].append(
            {
                "ts": datetime.now(timezone.utc).isoformat(),
                "restructuring_options": options,
                "draft_contract_note": contract_note,
            }
        )
        self._save()

    def update_circle_pool(self, pooled_amount: float, months_idle: int) -> None:
        self._data["circle"]["pooled_amount"] = pooled_amount
        self._data["circle"]["months_idle"] = months_idle
        self._save()

    def log_yield(self, yield_earned: float, new_total: float) -> None:
        self._data["circle"]["yield_log"].append(
            {"ts": datetime.now(timezone.utc).isoformat(), "yield_earned": yield_earned, "new_total": new_total}
        )
        self._save()

    # ----------------------------------------------------------- readers --
    def get_member_context(self, name: str) -> Dict[str, Any]:
        """Compact summary handed into an agent's prompt so it reasons with
        real history, not just the single event it was called with."""
        m = self._member(name)
        missed_count = sum(1 for p in m["payment_history"] if p["status"] == "missed")
        return {
            "name": name,
            "past_risk_assessments": m["risk_history"][-3:],
            "missed_payment_count_all_time": missed_count,
            "past_turn_assignments": m["turn_history"],
            "past_mediation_count": len(m["mediation_log"]),
        }

    def get_circle_summary(self) -> Dict[str, Any]:
        return self._data["circle"]

    def reset(self) -> None:
        self._data = {"members": {}, "circle": {"pooled_amount": 0.0, "months_idle": 0, "yield_log": []}}
        self._save()
