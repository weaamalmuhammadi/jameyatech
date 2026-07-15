"""
Shared helper for the four leaf agents (risk/turn/yield/mediator).

Every agent asks an LLM for a JSON object and has to deal with the same two
failure modes: the model wraps its answer in ```json fences, and occasionally
it returns something that isn't valid JSON at all. Without handling the
second case, one bad generation turns into an uncaught exception that 500s
the Flask endpoint mid-demo.

call_llm_json centralizes: fence stripping, one retry with a stricter
instruction if parsing fails, and a caller-supplied fallback value if it
still fails -- so every agent degrades to something reasonable instead of
crashing.
"""
import json
from typing import Any, Callable, Optional

RETRY_INSTRUCTION = (
    "Your previous response could not be parsed as valid JSON. Respond again "
    "with ONLY the JSON object, no markdown fences, no extra text."
)


def call_llm_json(
    client,
    model: str,
    messages: list,
    temperature: float,
    fallback: Any,
    postprocess: Optional[Callable[[str], str]] = None,
) -> Any:
    """
    Calls client.chat.completions.create(...) and parses the response as JSON.
    On a parse failure, retries once with an appended instruction to return
    clean JSON. If that also fails, returns `fallback` instead of raising.

    postprocess: optional function applied to the raw response text after
    fence-stripping and before json.loads (e.g. mediator_agent's non-Arabic
    character scrub).
    """

    def _attempt(msgs: list) -> Any:
        response = client.chat.completions.create(
            model=model,
            messages=msgs,
            temperature=temperature,
        )
        raw = response.choices[0].message.content.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()
        if postprocess:
            raw = postprocess(raw)
        return json.loads(raw)

    try:
        return _attempt(messages)
    except Exception:
        pass

    try:
        return _attempt(messages + [{"role": "user", "content": RETRY_INSTRUCTION}])
    except Exception:
        return fallback
