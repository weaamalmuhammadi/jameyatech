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


def test_authenticate_with_correct_phone_and_pin_succeeds(tmp_path, monkeypatch):
    monkeypatch.setattr(accounts, "DB_PATH", str(tmp_path / "accounts.db"))
    accounts.seed_if_empty()
    result = accounts.authenticate("0511111111", "1111")
    assert result is not None
    assert result["phone"] == "0511111111"
    assert result["name_en"] == "Organizer"


def test_authenticate_with_wrong_pin_fails(tmp_path, monkeypatch):
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
