"""
Covers agent_utils.call_llm_json() -- the retry/fallback wrapper that stops
one malformed LLM generation from 500-ing the Flask endpoint mid-demo.
"""
from unittest.mock import MagicMock

from agent_utils import call_llm_json


def _mock_client(replies):
    """A fake Groq client whose chat.completions.create() returns each of
    `replies` (as .choices[0].message.content) in order, one per call."""
    client = MagicMock()
    responses = []
    for text in replies:
        msg = MagicMock()
        msg.content = text
        resp = MagicMock()
        resp.choices = [MagicMock(message=msg)]
        responses.append(resp)
    client.chat.completions.create.side_effect = responses
    return client


def test_valid_json_on_first_try_does_not_retry():
    client = _mock_client(['{"a": 1}'])
    result = call_llm_json(client, "model", [{"role": "user", "content": "x"}], 0.3, fallback={})
    assert result == {"a": 1}
    assert client.chat.completions.create.call_count == 1


def test_malformed_first_reply_retries_once_and_succeeds():
    client = _mock_client(["not json at all", '{"a": 2}'])
    result = call_llm_json(client, "model", [{"role": "user", "content": "x"}], 0.3, fallback={})
    assert result == {"a": 2}
    assert client.chat.completions.create.call_count == 2


def test_malformed_both_times_returns_fallback_without_raising():
    client = _mock_client(["nope", "still nope"])
    result = call_llm_json(
        client, "model", [{"role": "user", "content": "x"}], 0.3, fallback={"x": "fallback"}
    )
    assert result == {"x": "fallback"}
    assert client.chat.completions.create.call_count == 2


def test_markdown_fences_are_stripped_before_parsing():
    client = _mock_client(['```json\n{"a": 4}\n```'])
    result = call_llm_json(client, "model", [{"role": "user", "content": "x"}], 0.3, fallback={})
    assert result == {"a": 4}


def test_postprocess_hook_runs_before_json_parsing():
    client = _mock_client(['JUNK{"a": 3}JUNK'])
    result = call_llm_json(
        client,
        "model",
        [{"role": "user", "content": "x"}],
        0.3,
        fallback={},
        postprocess=lambda s: s.replace("JUNK", ""),
    )
    assert result == {"a": 3}
