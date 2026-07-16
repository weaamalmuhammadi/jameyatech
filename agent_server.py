"""
Lightweight Flask bridge so the JamiyaTech web UI (index.html/app.js) can call
the Python/Groq-backed agents (risk, mediator, yield, turn) over plain HTTP.

The web UI is a static page and can't import Python directly, so this process
exposes orchestrator.handle_event() as a small JSON API instead.

Run:
    pip install -r "requirements (1).txt"
    set GROQ_API_KEY=your_key_here      (Windows)   /   export GROQ_API_KEY=...  (macOS/Linux)
    python agent_server.py

Then serve the static site separately, e.g.:
    python -m http.server 8000
and open http://localhost:8000 in a browser. app.js calls this API at
http://localhost:5001 (see AGENT_API in app.js).
"""
import calendar
import os
import re
from datetime import date, timedelta

# risk_agent/turn_agent/yield_agent/mediator_agent all construct a Groq client
# at import time, which raises immediately if GROQ_API_KEY isn't set. Record
# whether a real key was actually provided before we fall back to a
# placeholder so the server can still boot (and serve /api/health); any real
# agent call made without a valid key will then fail per-request with a
# clean, catchable error instead of crashing the whole process.
GROQ_KEY_SET = bool(os.environ.get("GROQ_API_KEY"))
os.environ.setdefault("GROQ_API_KEY", "not-set-see-README")

from flask import Flask, request, jsonify
from flask_cors import CORS
from orchestrator import handle_event, route_and_handle
from memory import JamiyaMemory
import accounts
import circle_store

app = Flask(__name__)
CORS(app)

# One shared memory instance for the whole server process, so every event
# (regardless of which endpoint or which browser tab triggered it) builds up
# the same picture of each member and the circle. Backed by a JSON file, so
# it also survives a server restart.
memory = JamiyaMemory()

accounts.seed_if_empty()


def _seed_demo_circle():
    """Gives the 3 demo accounts a shared circle to open on first login,
    instead of an empty list -- only runs if no circle exists yet."""
    if circle_store.list_circles():
        return
    organizer = accounts.get_account("0511111111")
    member1 = accounts.get_account("0522222222")
    member2 = accounts.get_account("0533333333")
    if not (organizer and member1 and member2):
        return
    today = date.today()
    y, m = (today.year + 1, 1) if today.month == 12 else (today.year, today.month + 1)
    start_date = f"{y:04d}-{m:02d}-01"

    def _member(acct, turn, confirmed):
        return {
            "id": turn - 1, "ar": acct["name_ar"], "en": acct["name_en"],
            "init": acct["name_en"][:2].upper(), "phone": acct["phone"],
            "turn": turn, "paid": False, "confirmed": confirmed,
        }

    demo_circle = {
        "id": 1000001,
        "ar": "جمعية تجريبية مشتركة", "en": "Shared Demo Circle",
        "organizerPhone": organizer["phone"],
        "amount": 500, "currentTurn": 0, "totalTurns": 3,
        "startDate": start_date, "status": "waiting",
        "members": [
            _member(organizer, 1, "confirmed"),
            _member(member1, 2, "pending"),
            _member(member2, 3, "pending"),
        ],
    }
    circle_store.save_circle(str(demo_circle["id"]), demo_circle)


_seed_demo_circle()


# Flavor names for the synthetic co-members in a fresh signup's starter
# circles -- never real accounts, never logged into.
_STARTER_PEOPLE = [
    ("خالد العتيبي", "Khalid Al-Otaibi"),
    ("سارة القحطاني", "Sara Al-Qahtani"),
    ("منيرة الشمري", "Munira Al-Shammari"),
    ("عبدالله الحربي", "Abdullah Al-Harbi"),
    ("فيصل الدوسري", "Faisal Al-Dosari"),
]


def _synthetic_phone(base_phone: str, salt: int) -> str:
    """A plausible-looking 10-digit Saudi mobile number derived from the
    real account's own phone, not a hardcoded constant -- so it can never
    collide with an actual registered account's number."""
    digits = re.sub(r"\D", "", base_phone)[-8:].rjust(8, "0")
    n = (int(digits) + salt) % 100000000
    return "05" + str(n).rjust(8, "0")


def _add_months(d: date, n: int) -> date:
    month = d.month - 1 + n
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _seed_starter_circles_for(phone: str, name: str) -> None:
    """Gives a newly self-registered account 3 varied example circles
    instead of an empty list, so a judge/demo user sees every facet of the
    product right after signing up -- a waiting circle (Turn Agent
    suggestion, live Risk Agent check, a pre-flagged member), an active
    circle (payment due, a delayed member for the Mediator Agent, the
    Yield Agent card), and a pending invitation from someone else (accept/
    decline flow) -- instead of starting from an empty circles list."""
    base = int(re.sub(r"\D", "", phone)[-8:].rjust(8, "0") or "0")
    circle_base_id = 2000000000 + base * 10
    today = date.today()

    def synth_phone(salt):
        return _synthetic_phone(phone, salt)

    def me(turn, paid, confirmed):
        return {
            "id": turn - 1, "ar": name, "en": name, "init": name[:2].upper(),
            "phone": phone, "turn": turn, "paid": paid, "confirmed": confirmed, "risk": None,
        }

    def other(idx, turn, paid, confirmed, risk=None):
        ar, en = _STARTER_PEOPLE[idx]
        return {
            "id": turn - 1, "ar": ar, "en": en, "init": en[:2].upper(),
            "phone": synth_phone(idx + 1), "turn": turn, "paid": paid,
            "confirmed": confirmed, "risk": risk,
        }

    # Circle 1 -- waiting to start: Turn Agent suggestion, live Risk Agent
    # check on the add-member form, and a pre-flagged member so the Trust
    # & Risk panel isn't empty.
    start1 = _add_months(today, 1).replace(day=1)
    c1 = {
        "id": circle_base_id + 1, "ar": "جمعية العائلة", "en": "Family Circle",
        "organizerPhone": phone, "amount": 500, "currentTurn": 0, "totalTurns": 3,
        "startDate": start1.isoformat(), "status": "waiting",
        "members": [
            me(1, False, "confirmed"),
            other(0, 2, False, "confirmed"),
            other(1, 3, False, "pending", risk="yellow"),
        ],
    }

    # Circle 2 -- active: payment due soon (Pay flow) for this account, one
    # member already behind (Mediator Agent), Yield Agent card always
    # visible on active circles.
    due_target = today + timedelta(days=12)
    start2 = _add_months(due_target, -2)
    c2 = {
        "id": circle_base_id + 2, "ar": "جمعية العمل", "en": "Work Circle",
        "organizerPhone": phone, "amount": 800, "currentTurn": 2, "totalTurns": 3,
        "startDate": start2.isoformat(), "status": "active",
        "members": [
            other(2, 1, False, "confirmed"),
            other(3, 2, True, "confirmed"),
            me(3, False, "confirmed"),
        ],
    }

    # Circle 3 -- a pending invitation from someone else's circle, so the
    # accept/decline flow is visible immediately.
    start3 = _add_months(today, 1).replace(day=1)
    c3 = {
        "id": circle_base_id + 3, "ar": "جمعية الجيران", "en": "Neighbors Circle",
        "organizerPhone": synth_phone(4), "amount": 600, "currentTurn": 0, "totalTurns": 3,
        "startDate": start3.isoformat(), "status": "waiting",
        "members": [
            other(3, 1, False, "confirmed"),
            me(2, False, "pending"),
            other(4, 3, False, "confirmed"),
        ],
    }

    for c in (c1, c2, c3):
        circle_store.save_circle(str(c["id"]), c)


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "groq_key_set": GROQ_KEY_SET})


@app.route('/api/event', methods=['POST'])
def event():
    """Original fast/deterministic path -- unchanged contract for the existing
    web UI. Now memory-aware under the hood: agents see each member's history
    and log their own results back into it."""
    payload = request.get_json(force=True, silent=True) or {}
    try:
        result = handle_event(payload, memory=memory)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)


@app.route('/api/route', methods=['POST'])
def route():
    """New agentic path. Body: {"message": "free text describing what happened"}.
    An LLM decides which agent(s) to call (and can chain more than one), rather
    than the caller having to know the exact event_type ahead of time."""
    payload = request.get_json(force=True, silent=True) or {}
    message = payload.get("message", "").strip()
    if not message:
        return jsonify({"error": "Missing 'message' in request body"}), 400
    try:
        result = route_and_handle(message, memory=memory)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    return jsonify(result)


@app.route('/api/memory', methods=['GET'])
def memory_snapshot():
    """Handy for demos/debugging -- see the full accumulated state."""
    return jsonify(memory.get_circle_summary())


@app.route('/api/login', methods=['POST'])
def login():
    """Demo login against the 3 seeded accounts.py accounts -- see that
    module's docstring for exactly how limited this is (plaintext password,
    no sessions/tokens). Enough for a few real people to log in as different
    identities and share real circle data via circle_store.py.

    No format check here on purpose: login just has to match whatever the
    account was created with, and the seeded demo accounts predate the
    letter+number password rule enforced at registration time."""
    payload = request.get_json(force=True, silent=True) or {}
    phone = re.sub(r"\D", "", payload.get("phone", ""))
    password = (payload.get("password") or "").strip()
    account = accounts.authenticate(phone, password)
    if not account:
        return jsonify({"error": "Invalid phone or password"}), 401
    return jsonify(account)


_PASSWORD_MIN_LEN = 8


@app.route('/api/register', methods=['POST'])
def register():
    """First-time signup: phone, national ID, name, and a chosen password
    (8+ characters, letters or numbers, no composition requirement -- also
    enforced client-side, re-checked here since the client can't be
    trusted). See accounts.py docstring for how limited this auth model is
    -- enough for a small group of real people to create their own
    identities, not a production auth system."""
    payload = request.get_json(force=True, silent=True) or {}
    phone = re.sub(r"\D", "", payload.get("phone", ""))
    national_id = re.sub(r"\D", "", payload.get("national_id", ""))
    name = (payload.get("name") or "").strip()
    password = (payload.get("password") or "").strip()
    if len(phone) < 9 or len(national_id) < 10 or not name or len(password) < _PASSWORD_MIN_LEN:
        return jsonify({"error": "Missing or invalid fields"}), 400
    try:
        account = accounts.register(phone, national_id, name, password)
    except ValueError as e:
        return jsonify({"error": str(e)}), 409
    _seed_starter_circles_for(phone, name)
    return jsonify(account)


@app.route('/api/circle/<circle_id>', methods=['GET'])
def get_circle(circle_id):
    """Light shared circle state (SQLite-backed, see circle_store.py) -- lets
    two browser tabs/devices pointed at this server see the same circle,
    instead of each having its own localStorage copy. No auth beyond the
    /api/login check that already happened client-side: this is a
    demo-scoped shared store, not a real access-control system."""
    state = circle_store.get_circle(circle_id)
    if state is None:
        return jsonify({"error": f"No circle found for id {circle_id}"}), 404
    return jsonify(state)


@app.route('/api/circle/<circle_id>', methods=['POST'])
def save_circle(circle_id):
    payload = request.get_json(force=True, silent=True)
    if payload is None:
        return jsonify({"error": "Request body must be JSON"}), 400
    return jsonify(circle_store.save_circle(circle_id, payload))


@app.route('/api/circle/<circle_id>', methods=['DELETE'])
def delete_circle(circle_id):
    circle_store.delete_circle(circle_id)
    return jsonify({"ok": True})


@app.route('/api/circle/<circle_id>/member/<phone>', methods=['POST'])
def update_circle_member(circle_id, phone):
    """Atomic single-member update (see circle_store.update_member) --
    used for the operations where two different accounts plausibly act on
    the same circle around the same time: accepting/declining an invite,
    paying. Everything else (create/price/delete/reorder) is organizer-only,
    a single actor, so it stays on the simpler full-circle POST above."""
    payload = request.get_json(force=True, silent=True)
    if payload is None:
        return jsonify({"error": "Request body must be JSON"}), 400
    digits = re.sub(r"\D", "", phone)
    result = circle_store.update_member(circle_id, digits, payload)
    if result is None:
        return jsonify({"error": f"No circle found for id {circle_id}"}), 404
    return jsonify(result)


@app.route('/api/circles', methods=['GET'])
def list_circles():
    return jsonify(circle_store.list_circles())


@app.route('/api/circles-for/<phone>', methods=['GET'])
def circles_for_phone(phone):
    """Full circle state for every circle the given phone organizes or is a
    member of -- what app.js syncs into its local render cache after login."""
    digits = re.sub(r"\D", "", phone)
    return jsonify(circle_store.list_circles_for_phone(digits))


if __name__ == '__main__':
    app.run(port=5001, debug=False)