"""
Minimal demo accounts store for JameyaTech.

Three fixed demo accounts (Organizer, Member 1, Member 2) so a small group
of real people can log in as different identities and try the app together
-- this is NOT a production auth system (plaintext PIN, no sessions/tokens,
no password hashing, no rate limiting). It's just enough to let three real
logins share real server-side circle data (see circle_store.py) instead of
each browser having its own disconnected copy.
"""
import os
import sqlite3
from typing import Optional

DB_PATH = os.environ.get("JAMIYA_ACCOUNTS_DB_PATH", "accounts.db")

# phone, pin, name_ar, name_en
SEED_ACCOUNTS = [
    ("0511111111", "1111", "المنظّم", "Organizer"),
    ("0522222222", "2222", "عضو ١", "Member 1"),
    ("0533333333", "3333", "عضو ٢", "Member 2"),
]


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS accounts (
            phone TEXT PRIMARY KEY,
            pin TEXT NOT NULL,
            name_ar TEXT NOT NULL,
            name_en TEXT NOT NULL
        )
        """
    )
    return conn


def seed_if_empty() -> None:
    with _connect() as conn:
        count = conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
        if count == 0:
            conn.executemany(
                "INSERT INTO accounts (phone, pin, name_ar, name_en) VALUES (?, ?, ?, ?)",
                SEED_ACCOUNTS,
            )


def authenticate(phone: str, pin: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT phone, name_ar, name_en FROM accounts WHERE phone = ? AND pin = ?",
            (phone, pin),
        ).fetchone()
    if not row:
        return None
    return {"phone": row[0], "name_ar": row[1], "name_en": row[2]}


def get_account(phone: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT phone, name_ar, name_en FROM accounts WHERE phone = ?", (phone,)
        ).fetchone()
    if not row:
        return None
    return {"phone": row[0], "name_ar": row[1], "name_en": row[2]}


def list_accounts() -> list:
    with _connect() as conn:
        rows = conn.execute("SELECT phone, name_ar, name_en FROM accounts").fetchall()
    return [{"phone": r[0], "name_ar": r[1], "name_en": r[2]} for r in rows]


if __name__ == "__main__":
    import json
    seed_if_empty()
    print(json.dumps(list_accounts(), ensure_ascii=False, indent=2))
    print(authenticate("0511111111", "1111"))
    print(authenticate("0511111111", "wrong-pin"))
