# جمعيتك | JameyaTech

An AI-run rotating savings circle (*jamiya*) app for the Saudi market — a digital, trust-automated version of the informal group-saving practice where members contribute a fixed amount every month and take turns receiving the pooled pot.

A traditional jamiya runs on personal trust and a WhatsApp group: someone has to manually track who paid, decide a fair payout order, and chase down anyone who falls behind. JameyaTech's pitch is that **four AI agents do that work automatically** — screening new members, ordering payouts fairly, projecting Shariah-compliant yield on the idle pooled funds, and mediating missed payments — while a lightweight Nafath-style identity layer and a real shared backend make the circle trustworthy across multiple real people, not just one person's browser.

## The AI Agents

| Agent | File | What it does |
|---|---|---|
| **Risk Agent** | `risk_agent.py` | Scores a new member's trustworthiness. Matches them by phone number against a synthetic dataset (`data/03_Synthetic_Jamiya_Dataset.csv`) when possible; otherwise falls back to a documented heuristic formula. Also flags a phone-number/name mismatch as a fraud signal. |
| **Turn Agent** | `turn_agent.py` | Suggests a fair payout order from each member's salary date and stated financial goal. |
| **Yield Agent** | `yield_agent.py` | Projects Shariah-compliant yield on the circle's idle pooled balance. |
| **Mediator Agent** | `mediator_agent.py` | Handles a missed payment — drafts a neutral outreach message and restructuring options. |
| **Orchestrator** | `orchestrator.py` | Routes to the four agents above two ways: `handle_event()` is a fast, deterministic, zero-LLM dispatch by explicit event type (what the main app UI uses for single actions); `route_and_handle()` is the agentic path — given a plain-language description of what happened, an LLM decides which agent(s) to call via Groq tool-calling, and can chain more than one agent in a single turn. |

All four agents use `agent_utils.call_llm_json()` for retry-then-fallback JSON parsing, so a malformed LLM response degrades to a sensible default instead of a 500 error.

## Architecture note: the agents live in the backend

This is worth being explicit about: **every line of AI-agent logic runs server-side, in Python.** The browser never calls Groq directly, never holds an API key, and contains no agent code — `app.js` only ever calls plain HTTP endpoints on `agent_server.py` and renders whatever JSON comes back.

For judging and demo purposes, we made a deliberate UX choice to **surface each agent's result directly inside the product UI** — a risk verdict appears right where you add a member, a mediator's outreach message appears right where a payment is overdue — as a shared "AI Agent Result" card (agent icon, verdict, reasoning, a timestamped activity trail), rather than in a separate admin panel or server log. That's a presentation decision, not an architectural one: it lets a judge click a button in the actual app and watch an agent think in real time, instead of having to trust that something happened on a server they can't see. The computation itself never leaves the backend.

## Tech stack

**Frontend**
- Vanilla JavaScript (no framework), string-built HTML — `index.html`, `style.css`, `app.js`
- Bilingual: Arabic (RTL, default) and English, full UI translation via a single `T` dictionary
- Installable PWA — `manifest.json` + `service-worker.js` (network-first caching; API calls are never cached)

**Backend**
- Python + Flask (`agent_server.py`) with `flask-cors`, exposing:
  - `/api/login`, `/api/register` — real account auth (see below)
  - `/api/event` — deterministic single-agent dispatch
  - `/api/route` — agentic, LLM-routed, chainable dispatch
  - `/api/circle/*`, `/api/circles*` — shared circle state
  - `/api/memory`, `/api/health`

**AI**
- [Groq](https://groq.com) API via the official `groq` Python SDK, model `llama-3.3-70b-versatile`
- Custom lightweight orchestrator with tool-calling — no agent framework dependency

**Data & persistence**
- SQLite for real accounts (`accounts.py`) and shared circle state (`circle_store.py`, with atomic per-member updates under a lock so two people acting on the same circle at once can't silently overwrite each other)
- A JSON file (`memory.py`) as shared cross-agent history, so agents can reason about a member's or circle's past
- `pandas` + a synthetic dataset (`data/03_Synthetic_Jamiya_Dataset.csv`) grounding the Risk Agent; feature-engineering docs and scripts live in `docs/` and `scripts/`

**Testing**
- `pytest` — 52 tests under `tests/`, with the Groq client mocked so the suite runs without a real API key

**Also in this repo**
- `app.py` — a separate Streamlit-based internal tool for poking at the four agents directly during development. Not the product UI; the real experience is `index.html`/`app.js` + `agent_server.py`.

## Project structure

```
index.html, style.css, app.js     the actual product (static, no build step)
manifest.json, service-worker.js  PWA installability
agent_server.py                   Flask HTTP bridge to the agents/accounts/circles
orchestrator.py                   routes events to the 4 agents (2 dispatch modes)
risk_agent.py, turn_agent.py,
yield_agent.py, mediator_agent.py the 4 AI agents
agent_utils.py                    shared LLM-call helper (retry + fallback)
memory.py                         cross-agent shared history (JSON file)
accounts.py                       real account store (SQLite)
circle_store.py                   shared circle state (SQLite)
data/                             datasets (incl. the Risk Agent's CSV)
docs/                             dataset/feature-engineering documentation
scripts/                          data-prep scripts behind docs/
tests/                            pytest suite
app.py                            legacy Streamlit agent tester (dev tool only)
```

## Getting started

```bash
pip install -r "requirements (1).txt"

# Windows
set GROQ_API_KEY=your_key_here
# macOS/Linux
export GROQ_API_KEY=your_key_here

python agent_server.py          # backend, port 5001
```

In a separate terminal, serve the static frontend:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000` in a browser. `app.js` calls the backend at `http://localhost:5001`.

## Demo accounts

Three seeded accounts share one demo circle out of the box, useful for testing real multi-person collaboration:

| Phone | Password |
|---|---|
| `0511111111` | `1111` |
| `0522222222` | `2222` |
| `0533333333` | `3333` |

Anyone can also self-register (phone, National ID, name, an 8+ character password). A fresh signup lands on **3 automatically generated example circles** — a waiting circle, an active circle with a payment due and a delayed member, and a pending invitation from someone else — so every aspect of the product (payments, all 4 agents, an invite) is visible immediately, with no manual setup.

## Running tests

```bash
pytest tests/
```

## Known limitations

This is a hackathon-stage build, and some things are intentionally simplified rather than production-grade:

- Auth is plaintext-password, no sessions/tokens, no rate limiting — enough for a small group of real people to try the app as different identities, not a real auth system.
- SQLite is a single local file, not scalable infrastructure.
- Nafath identity verification, Open Banking, and payment rails are simulated in the UI/copy, not live-integrated — a defined next step, not something claimed as working today.
