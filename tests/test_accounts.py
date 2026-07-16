"""
Covers accounts.py -- the 3 seeded demo accounts (Organizer, Member 1,
Member 2) that let real people log in as different identities and share
real circle data instead of each browser having its own local copy.
"""
import accounts


def test_seed_creates_exactly_the_three_demo_accounts(tmp_path, monkeypatch):
    monkeypatch.setattr(accounts, "DB_PATH", str(tmp_path / "accounts.db"))
    accounts.seed_if_empty()
    phones = {a["phone"] for a in accounts.list_accounts()}
    assert phones == {"0511111111", "0522222222", "0533333333"}


def test_seed_is_idempotent(tmp_path, monkeypatch):
    monkeypatch.setattr(accounts, "DB_PATH", str(tmp_path / "accounts.db"))
    accounts.seed_if_empty()
    accounts.seed_if_empty()
    assert len(accounts.list_accounts()) == 3


def test_authenticate_with_correct_phone_and_password_succeeds(tmp_path, monkeypatch):
    monkeypatch.setattr(accounts, "DB_PATH", str(tmp_path / "accounts.db"))
    accounts.seed_if_empty()
    result = accounts.authenticate("0511111111", "1111")
    assert result is not None
    assert result["phone"] == "0511111111"
    assert result["name_en"] == "Organizer"


def test_authenticate_with_wrong_password_fails(tmp_path, monkeypatch):
    monkeypatch.setattr(accounts, "DB_PATH", str(tmp_path / "accounts.db"))
    accounts.seed_if_empty()
    assert accounts.authenticate("0511111111", "0000") is None


def test_authenticate_with_unknown_phone_fails(tmp_path, monkeypatch):
    monkeypatch.setattr(accounts, "DB_PATH", str(tmp_path / "accounts.db"))
    accounts.seed_if_empty()
    assert accounts.authenticate("0599999999", "1111") is None


def test_get_account_returns_none_for_unknown_phone(tmp_path, monkeypatch):
    monkeypatch.setattr(accounts, "DB_PATH", str(tmp_path / "accounts.db"))
    accounts.seed_if_empty()
    assert accounts.get_account("0599999999") is None


def test_register_creates_an_account_that_can_then_authenticate(tmp_path, monkeypatch):
    monkeypatch.setattr(accounts, "DB_PATH", str(tmp_path / "accounts.db"))
    accounts.seed_if_empty()
    result = accounts.register("0544444444", "1122334455", "Faisal", "9999")
    assert result == {"phone": "0544444444", "name_ar": "Faisal", "name_en": "Faisal"}
    assert accounts.authenticate("0544444444", "9999") is not None


def test_register_with_already_taken_phone_raises(tmp_path, monkeypatch):
    monkeypatch.setattr(accounts, "DB_PATH", str(tmp_path / "accounts.db"))
    accounts.seed_if_empty()
    try:
        accounts.register("0511111111", "1122334455", "Someone Else", "9999")
        assert False, "expected ValueError"
    except ValueError:
        pass


def test_register_works_on_a_pre_existing_db_missing_the_national_id_column(tmp_path, monkeypatch):
    """Guards the migrations: a DB created before national_id and password
    (originally named `pin`) existed must not break registration, and the
    old pin values must carry over so existing accounts can still log in."""
    import sqlite3
    db_path = str(tmp_path / "accounts.db")
    monkeypatch.setattr(accounts, "DB_PATH", db_path)
    conn = sqlite3.connect(db_path)
    conn.execute(
        """
        CREATE TABLE accounts (
            phone TEXT PRIMARY KEY,
            pin TEXT NOT NULL,
            name_ar TEXT NOT NULL,
            name_en TEXT NOT NULL
        )
        """
    )
    conn.execute(
        "INSERT INTO accounts (phone, pin, name_ar, name_en) VALUES (?, ?, ?, ?)",
        ("0511111111", "1111", "المنظّم", "Organizer"),
    )
    conn.commit()
    conn.close()

    result = accounts.register("0544444444", "1122334455", "Faisal", "9999")
    assert result["phone"] == "0544444444"
    assert accounts.authenticate("0511111111", "1111") is not None
