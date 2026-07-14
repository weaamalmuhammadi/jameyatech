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
import os

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

app = Flask(__name__)
CORS(app)

# One shared memory instance for the whole server process, so every event
# (regardless of which endpoint or which browser tab triggered it) builds up
# the same picture of each member and the circle. Backed by a JSON file, so
# it also survives a server restart.
memory = JamiyaMemory()


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


if __name__ == '__main__':
    app.run(port=5001, debug=False)