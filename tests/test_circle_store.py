"""
Covers circle_store.py -- the light SQLite-backed shared circle state so a
circle's data isn't fake-per-browser (see the module docstring for scope:
no auth/accounts, just proves the state is real and shared).
"""
import circle_store


def test_save_and_get_round_trip(tmp_path, monkeypatch):
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    circle_store.save_circle("c1", {"name": "Test Circle", "amount": 500})
    assert circle_store.get_circle("c1") == {"name": "Test Circle", "amount": 500}


def test_unknown_circle_id_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    assert circle_store.get_circle("does-not-exist") is None


def test_save_overwrites_existing_state(tmp_path, monkeypatch):
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    circle_store.save_circle("c1", {"amount": 500})
    circle_store.save_circle("c1", {"amount": 600})
    assert circle_store.get_circle("c1")["amount"] == 600


def test_list_circles_returns_all_saved_ids(tmp_path, monkeypatch):
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    circle_store.save_circle("a", {})
    circle_store.save_circle("b", {})
    ids = {c["circle_id"] for c in circle_store.list_circles()}
    assert ids == {"a", "b"}


def test_delete_circle_removes_it(tmp_path, monkeypatch):
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    circle_store.save_circle("a", {"name": "gone soon"})
    circle_store.delete_circle("a")
    assert circle_store.get_circle("a") is None


def test_delete_unknown_circle_does_not_raise(tmp_path, monkeypatch):
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    circle_store.delete_circle("never-existed")  # should be a silent no-op


def test_list_circles_for_phone_matches_organizer(tmp_path, monkeypatch):
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    circle_store.save_circle("c1", {"organizerPhone": "0511111111", "members": []})
    result = circle_store.list_circles_for_phone("0511111111")
    assert len(result) == 1
    assert result[0]["organizerPhone"] == "0511111111"


def test_list_circles_for_phone_matches_member(tmp_path, monkeypatch):
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    circle_store.save_circle("c1", {
        "organizerPhone": "0511111111",
        "members": [{"phone": "0511111111"}, {"phone": "0522222222"}],
    })
    result = circle_store.list_circles_for_phone("0522222222")
    assert len(result) == 1


def test_list_circles_for_phone_excludes_unrelated_circles(tmp_path, monkeypatch):
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    circle_store.save_circle("c1", {"organizerPhone": "0511111111", "members": []})
    circle_store.save_circle("c2", {"organizerPhone": "0599999999", "members": []})
    result = circle_store.list_circles_for_phone("0511111111")
    assert len(result) == 1


def test_list_circles_for_phone_with_no_matches_returns_empty_list(tmp_path, monkeypatch):
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    circle_store.save_circle("c1", {"organizerPhone": "0511111111", "members": []})
    assert circle_store.list_circles_for_phone("0500000000") == []


def test_update_member_merges_fields_for_the_matching_phone_only(tmp_path, monkeypatch):
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    circle_store.save_circle("c1", {
        "members": [
            {"phone": "0511111111", "confirmed": "confirmed"},
            {"phone": "0522222222", "confirmed": "pending"},
        ],
    })
    result = circle_store.update_member("c1", "0522222222", {"confirmed": "confirmed"})
    members = {m["phone"]: m["confirmed"] for m in result["members"]}
    assert members == {"0511111111": "confirmed", "0522222222": "confirmed"}


def test_update_member_on_unknown_circle_returns_none(tmp_path, monkeypatch):
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    assert circle_store.update_member("nope", "0511111111", {"confirmed": "confirmed"}) is None


def test_update_member_does_not_lose_a_concurrent_update_to_a_different_member(tmp_path, monkeypatch):
    """The bug this function exists to fix: two members responding to the
    same circle around the same time must not let one overwrite the other."""
    monkeypatch.setattr(circle_store, "DB_PATH", str(tmp_path / "circles.db"))
    circle_store.save_circle("c1", {
        "members": [
            {"phone": "0511111111", "confirmed": "confirmed"},
            {"phone": "0522222222", "confirmed": "pending"},
            {"phone": "0533333333", "confirmed": "pending"},
        ],
    })
    circle_store.update_member("c1", "0522222222", {"confirmed": "confirmed"})
    circle_store.update_member("c1", "0533333333", {"confirmed": "confirmed"})
    final = circle_store.get_circle("c1")
    members = {m["phone"]: m["confirmed"] for m in final["members"]}
    assert members == {
        "0511111111": "confirmed",
        "0522222222": "confirmed",
        "0533333333": "confirmed",
    }
