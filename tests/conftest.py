import os
import sys

# risk_agent/turn_agent/yield_agent/mediator_agent/orchestrator all construct
# a Groq client at import time, which raises immediately if GROQ_API_KEY isn't
# set. setdefault (not direct assignment) so a real key already in the
# environment is never clobbered.
os.environ.setdefault("GROQ_API_KEY", "test-key-not-real")

# Make sure the repo root (where the agent modules live) is importable
# regardless of which directory pytest is invoked from.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
