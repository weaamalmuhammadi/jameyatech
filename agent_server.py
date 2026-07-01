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
from orchestrator import handle_event

app = Flask(__name__)
CORS(app)


@app.route('/api/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "groq_key_set": GROQ_KEY_SET})


@app.route('/api/event', methods=['POST'])
def event():
    payload = request.get_json(force=True, silent=True) or {}
    try:
        result = handle_event(payload)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    if "error" in result:
        return jsonify(result), 400
    return jsonify(result)


if __name__ == '__main__':
    app.run(port=5001, debug=False)