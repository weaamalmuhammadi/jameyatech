"""
Light shared circle-state store.

A small, real, server-side store (SQLite, one file on disk -- same
operational simplicity as memory.py's JSON file) so a circle's state written
by one logged-in account (see accounts.py) is readable by every other
account that's a member of it. app.js syncs its local render cache from
list_circles_for_phone() and pushes every mutation back via save_circle() --
see syncCirclesFromServer/pushCircleToServer in app.js.

Each circle is stored as an opaque JSON blob (no schema) with two fields
this module cares about for filtering: "organizerPhone" and
"members": [{"phone": ..., ...}, ...]. Everything else is app.js's concern.
Still intentionally minimal: no accounts/auth validation beyond what
accounts.py does at login, no per-field schema.
"""
import json
import os
import sqlite3
import threading
from typing import Any, Optional

DB_PATH = os.environ.get("JAMIYA_CIRCLE_DB_PATH", "circle_state.db")

# Guards update_member()'s read-modify-write cycle. Without this, two
# different accounts acting on the same circle around the same time (e.g.
# two members accepting an invite within moments of each other) can lose
# one of the updates: both read the same pre-change state, both write back
# a full copy, and whichever write lands second silently overwrites the
# first. save_circle()'s full-blob replace is fine for organizer-only,
# single-actor edits (create/price/delete/reorder), but member self-updates
# (confirm/decline, pay) are exactly the multi-account-concurrent case this
# app exists for, so they go through update_member() instead.
_MEMBER_UPDATE_LOCK = threading.Lock()


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS circles (
            circle_id TEXT PRIMARY KEY,
            state_json TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )
    return conn


def save_circle(circle_id: str, state: dict) -> dict:
    """Stores `state` as-is (opaque JSON blob) under `circle_id`, overwriting
    any previous state for that id. Returns the stored state."""
    with _connect() as conn:
        conn.execute(
            """
            INSERT INTO circles (circle_id, state_json, updated_at)
            VALUES (?, ?, datetime('now'))
            ON CONFLICT(circle_id) DO UPDATE SET
                state_json = excluded.state_json,
                updated_at = excluded.updated_at
            """,
            (str(circle_id), json.dumps(state, ensure_ascii=False)),
        )
    return state


def get_circle(circle_id: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT state_json FROM circles WHERE circle_id = ?", (str(circle_id),)
        ).fetchone()
    return json.loads(row[0]) if row else None


def list_circles() -> list:
    """[{"circle_id": ..., "updated_at": ...}, ...] -- handy for demos/debugging,
    not meant to be a real listing API (no pagination, no filtering)."""
    with _connect() as conn:
        rows = conn.execute(
            "SELECT circle_id, updated_at FROM circles ORDER BY updated_at DESC"
        ).fetchall()
    return [{"circle_id": r[0], "updated_at": r[1]} for r in rows]


def list_circles_for_phone(phone: str) -> list:
    """Full circle state (not just ids) for every circle where `phone` is
    the organizer or appears in `members[].phone` -- lets a logged-in
    account fetch everything it's part of in one call. Scans every stored
    circle in Python rather than a SQL/JSON query; fine at demo scale."""
    with _connect() as conn:
        rows = conn.execute("SELECT state_json FROM circles").fetchall()
    result = []
    for (state_json,) in rows:
        state = json.loads(state_json)
        member_phones = [m.get("phone") for m in state.get("members", [])]
        if state.get("organizerPhone") == phone or phone in member_phones:
            result.append(state)
    return result


def delete_circle(circle_id: str) -> None:
    with _connect() as conn:
        conn.execute("DELETE FROM circles WHERE circle_id = ?", (str(circle_id),))


def update_member(circle_id: str, phone: str, updates: dict) -> Optional[dict]:
    """Atomically merges `updates` into the one member matched by `phone`
    within circle `circle_id` -- read, modify, write under a single lock, so
    it can't lose a concurrent update from a different account the way two
    independent fetch-then-later-push cycles can. Returns the updated
    circle, or None if the circle doesn't exist."""
    with _MEMBER_UPDATE_LOCK:
        state = get_circle(circle_id)
        if state is None:
            return None
        for m in state.get("members", []):
            if m.get("phone") == phone:
                m.update(updates)
                break
        return save_circle(circle_id, state)


if __name__ == "__main__":
    save_circle("demo-1", {"name": "Test Circle", "amount": 500, "members": ["Ahmed", "Sara"]})
    print(get_circle("demo-1"))
    print(list_circles())
