"""
Minimal demo accounts store for JameyaTech.

Three fixed demo accounts (Organizer, Member 1, Member 2) so a small group
of real people can log in as different identities and try the app together
-- this is NOT a production auth system (plaintext password, no
sessions/tokens, no password hashing, no rate limiting). It's just enough
to let real logins share real server-side circle data (see circle_store.py)
instead of each browser having its own disconnected copy.
"""
import os
import sqlite3
from typing import Optional

DB_PATH = os.environ.get("JAMIYA_ACCOUNTS_DB_PATH", "accounts.db")

# phone, password, name_ar, name_en, national_id
SEED_ACCOUNTS = [
    ("0511111111", "1111", "المنظّم", "Organizer", "1000000001"),
    ("0522222222", "2222", "عضو ١", "Member 1", "1000000002"),
    ("0533333333", "3333", "عضو ٢", "Member 2", "1000000003"),
]


_SCHEMA = """
    CREATE TABLE accounts (
        phone TEXT PRIMARY KEY,
        password TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        name_en TEXT NOT NULL,
        national_id TEXT
    )
"""


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    exists = conn.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='accounts'"
    ).fetchone()
    if not exists:
        conn.execute(_SCHEMA)
        return conn

    cols = [row[1] for row in conn.execute("PRAGMA table_info(accounts)")]
    if "national_id" not in cols:
        conn.execute("ALTER TABLE accounts ADD COLUMN national_id TEXT")
        cols.append("national_id")
    if "password" not in cols:
        # Older DBs stored the secret under a column called `pin` (used to
        # be a 4-digit PIN, NOT NULL with no default) -- a plain ADD COLUMN
        # can't fix that constraint in place, and SQLite can't drop a NOT
        # NULL constraint without rebuilding the table, so rebuild it:
        # rename the old table aside, create the current schema, copy the
        # data across under the new column name, drop the old table. This
        # keeps every existing account (and its login secret) working.
        conn.execute("ALTER TABLE accounts RENAME TO accounts_legacy")
        conn.execute(_SCHEMA)
        secret_col = "pin" if "pin" in cols else "password"
        nid_expr = "national_id" if "national_id" in cols else "NULL"
        conn.execute(
            "INSERT INTO accounts (phone, password, name_ar, name_en, national_id) "
            "SELECT phone, {0}, name_ar, name_en, {1} FROM accounts_legacy".format(secret_col, nid_expr)
        )
        conn.execute("DROP TABLE accounts_legacy")
    return conn


def seed_if_empty() -> None:
    with _connect() as conn:
        count = conn.execute("SELECT COUNT(*) FROM accounts").fetchone()[0]
        if count == 0:
            conn.executemany(
                "INSERT INTO accounts (phone, password, name_ar, name_en, national_id) VALUES (?, ?, ?, ?, ?)",
                SEED_ACCOUNTS,
            )


def register(phone: str, national_id: str, name: str, password: str) -> dict:
    """Creates a new self-service account. `name` is used as-is for both
    name_ar and name_en (same convention as elsewhere in the app -- one
    typed name, not separate translations). Raises ValueError if the phone
    is already registered (including the 3 seeded demo accounts)."""
    if get_account(phone) is not None:
        raise ValueError("Phone number already registered")
    with _connect() as conn:
        conn.execute(
            "INSERT INTO accounts (phone, password, name_ar, name_en, national_id) VALUES (?, ?, ?, ?, ?)",
            (phone, password, name, name, national_id),
        )
    return {"phone": phone, "name_ar": name, "name_en": name}


def authenticate(phone: str, password: str) -> Optional[dict]:
    with _connect() as conn:
        row = conn.execute(
            "SELECT phone, name_ar, name_en FROM accounts WHERE phone = ? AND password = ?",
            (phone, password),
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
    print(authenticate("0511111111", "wrong-password"))
