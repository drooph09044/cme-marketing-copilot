"""Provider-agnostic structured LLM invocation.

OpenAI/Azure OpenAI: bind json_mode via llm.bind(response_format={"type":"json_object"})
so the model returns plain JSON text. Parse with _strip_fences/_extract_text/_loads.

Anthropic/Databricks: call ainvoke directly (tool-use default), then apply the same
parse/repair pipeline. Works whether the provider returns text content or tool_calls.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import TypeVar

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

logger = logging.getLogger(__name__)
T = TypeVar("T", bound=BaseModel)

# Retry settings for transient provider errors (429 rate-limit, 5xx server errors).
_MAX_RETRIES = 5
_RETRY_BASE_SECS = 2.0   # wait = base * 2^attempt  →  2s, 4s, 8s, 16s, 32s

# Context-overflow backstop. Conservative across providers (OpenAI 128K, Azure
# deployment-dependent, Anthropic 200K-1M). ~3.5 chars/token, so 500K tokens
# ≈ 1.75M chars. We refuse to send anything larger and surface an actionable
# error rather than letting the provider 400 mid-run. Override via QA_MAX_PROMPT_CHARS.
import os as _os  # noqa: E402
_MAX_PROMPT_CHARS = int(_os.environ.get("QA_MAX_PROMPT_CHARS", str(350_000)))


def _guard_prompt_size(prompt: str, schema_name: str) -> None:
    """Raise a clear error if a prompt is too large, instead of a provider 400."""
    n = len(prompt)
    if n > _MAX_PROMPT_CHARS:
        est_tokens = n // 4
        raise RuntimeError(
            f"Prompt for {schema_name} is too large: ~{est_tokens:,} tokens "
            f"({n:,} chars) exceeds the safe budget of "
            f"~{_MAX_PROMPT_CHARS // 4:,} tokens. Aggregate or chunk the input "
            f"before calling the LLM (raise QA_MAX_PROMPT_CHARS only if your "
            f"model's context window is large enough)."
        )
    if n > _MAX_PROMPT_CHARS * 0.7:
        logger.warning(
            "%s prompt is large: ~%d tokens (%d chars) — approaching the budget.",
            schema_name, n // 4, n,
        )


def _is_retryable(exc: Exception) -> bool:
    """Return True when the exception looks transient and worth retrying.

    Covers:
    - 429 rate-limit, 529 overloaded
    - 5xx server errors (500/502/503/504) — Azure OpenAI in particular returns
      sporadic "Backend returned unexpected response" 500s that succeed on retry.
    - Network-level timeouts / connection resets.
    """
    text = str(exc).lower()
    code = getattr(exc, "status_code", None)
    if code in (429, 500, 502, 503, 504, 529):
        return True
    keywords = (
        "rate_limit", "rate limit", "concurrent", "overloaded", "429", "529",
        "internal_server_error", "internal server error", "server_error",
        "bad gateway", "service unavailable", "gateway timeout",
        "backend returned unexpected response",
        "timeout", "timed out", "connection reset", "connection error",
        "temporarily unavailable",
    )
    if any(kw in text for kw in keywords):
        return True
    return False


async def _invoke_with_retry(coro_fn, *args, **kwargs):
    """Call an async factory function, retrying on rate-limit errors with backoff."""
    last_exc: Exception | None = None
    for attempt in range(_MAX_RETRIES + 1):
        try:
            return await coro_fn(*args, **kwargs)
        except Exception as exc:
            if _is_retryable(exc) and attempt < _MAX_RETRIES:
                wait = _RETRY_BASE_SECS * (2 ** attempt)
                logger.warning(
                    "Rate-limit / overload (attempt %d/%d), retrying in %.0fs: %s",
                    attempt + 1, _MAX_RETRIES, wait, exc,
                )
                await asyncio.sleep(wait)
                last_exc = exc
                continue
            raise
    raise last_exc  # unreachable but satisfies type checker


def _strip_fences(text: str) -> str:
    """Remove optional markdown code fences that some models wrap JSON in."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def _repair_json(text: str) -> str:
    """Best-effort repair for common LLM JSON quirks.

    Handles:
    - Trailing commas before } or ]
    - // line comments and /* block */ comments
    - Smart-quoted property names (rare, but seen with non-English locales)
    - Stray text before/after the JSON object/array
    """
    # Crop to the outermost {…} or […] in case there's preamble/postamble
    first_brace = text.find("{")
    first_bracket = text.find("[")
    if first_brace == -1 and first_bracket == -1:
        return text
    if first_brace == -1 or (first_bracket != -1 and first_bracket < first_brace):
        start, open_c, close_c = first_bracket, "[", "]"
    else:
        start, open_c, close_c = first_brace, "{", "}"
    depth, end = 0, len(text)
    in_str, escape = False, False
    for i in range(start, len(text)):
        ch = text[i]
        if in_str:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == '"':
                in_str = False
            continue
        if ch == '"':
            in_str = True
        elif ch == open_c:
            depth += 1
        elif ch == close_c:
            depth -= 1
            if depth == 0:
                end = i + 1
                break
    text = text[start:end]

    # Strip JS-style comments
    text = re.sub(r"//[^\n]*", "", text)
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
    # Drop trailing commas
    text = re.sub(r",(\s*[}\]])", r"\1", text)
    # Smart quotes → straight quotes (only when used as JSON delimiters)
    text = text.replace("“", '"').replace("”", '"').replace("‘", "'").replace("’", "'")
    return text


def _loads(text: str) -> object:
    """Parse JSON with one repair retry on failure."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return json.loads(_repair_json(text))


def _extract_text(raw: object) -> str:
    """Pull a JSON string out of any LLM response shape.

    Handles:
    1. Plain text content  (Anthropic, OpenAI json_mode)
    2. tool_calls args     (OpenAI / Databricks function_calling)
    3. Already-a-string    (rare passthrough)
    """
    if isinstance(raw, str):
        return raw

    # Priority 1: non-empty text content
    content = getattr(raw, "content", None)
    if content and isinstance(content, str) and content.strip():
        return content

    # Priority 2: OpenAI / Databricks function_calling — args live in tool_calls
    tool_calls = getattr(raw, "tool_calls", None)
    if tool_calls:
        tc = tool_calls[0]
        args = tc.get("args") if isinstance(tc, dict) else getattr(tc, "args", {})
        if isinstance(args, str) and args.strip():
            return args
        if isinstance(args, dict):
            return json.dumps(args)

    # Priority 3: additional_kwargs fallback (some older langchain versions)
    additional = getattr(raw, "additional_kwargs", {})
    fc = additional.get("function_call") or {}
    if fc.get("arguments"):
        return fc["arguments"]

    if content is not None:
        return str(content)
    return str(raw)


async def invoke_structured(llm: BaseChatModel, prompt: str, schema: type[T]) -> T:
    """Invoke the LLM and return a validated Pydantic model.

    OpenAI/Azure OpenAI: binds json_mode directly via llm.bind(response_format=...)
    then runs the proven _strip_fences/_extract_text/_loads/model_validate pipeline.
    Anthropic/Databricks: uses tool-use (default ainvoke) with the same fallback pipeline.
    """
    from app.llm.router import current_provider  # local import avoids circular dep

    _guard_prompt_size(prompt, schema.__name__)
    provider = current_provider()

    if provider in ("openai", "azure_openai"):
        # Bind json_mode directly — bypasses PydanticOutputParser which breaks on
        # strict Literal fields (e.g. Verdict = Literal["pass","warn","fail"]) and
        # can return a dict instead of the schema type, causing a silent fallthrough
        # to a second uninstrumented LLM call below.
        safe_prompt = prompt if "json" in prompt.lower() else (
            prompt + "\n\nReturn the response as a single valid JSON object."
        )
        json_llm = llm.bind(response_format={"type": "json_object"})
        try:
            raw = await _invoke_with_retry(
                json_llm.ainvoke, [HumanMessage(content=safe_prompt)]
            )
        except Exception as exc:
            cls_name = type(exc).__name__
            if "Length" in cls_name or "length" in str(exc).lower():
                raise RuntimeError(
                    f"OpenAI response was truncated by max_tokens. "
                    f"Increase NODE_MODEL_CONFIG['{schema.__name__}']['max_tokens'] "
                    f"or reduce the cohort size hint. ({exc})"
                ) from exc
            raise
        # Test stubs return the Pydantic object directly — skip JSON parsing.
        if isinstance(raw, schema):
            return raw
        # LangChain messages (AIMessage etc.) are BaseModel subclasses, but their
        # content lives in .content not in schema fields. Detect them by duck-typing:
        # every LangChain message sets self.type = "ai" | "human" | ... at class level.
        _is_lc_msg = (
            isinstance(raw, BaseModel)
            and isinstance(getattr(raw, "type", None), str)
            and hasattr(raw, "content")
        )
        if isinstance(raw, BaseModel) and not _is_lc_msg:
            # Compatible domain model (e.g. test stub returning a different Pydantic class)
            return schema.model_validate(raw.model_dump())
        text = _strip_fences(_extract_text(raw))
        try:
            return schema.model_validate_json(text)
        except Exception:
            return schema.model_validate(_loads(text))

    # Anthropic / Databricks — use tool use (default), or fall through to
    # manual extraction if the provider returns plain text.
    if hasattr(llm, "ainvoke"):
        raw = await _invoke_with_retry(llm.ainvoke, [HumanMessage(content=prompt)])
    else:
        raw = llm.invoke(prompt)

    # Already the right type (or a duck-typed Pydantic model from a test stub)
    if isinstance(raw, schema):
        return raw
    _is_lc_msg_anth = (
        isinstance(raw, BaseModel)
        and isinstance(getattr(raw, "type", None), str)
        and hasattr(raw, "content")
    )
    if isinstance(raw, BaseModel) and not _is_lc_msg_anth:
        return schema.model_validate(raw.model_dump())

    text = _strip_fences(_extract_text(raw))
    try:
        return schema.model_validate_json(text)
    except Exception:
        # Last-ditch: repair common LLM JSON quirks and validate from dict
        return schema.model_validate(_loads(text))


async def invoke_json_list(llm: BaseChatModel, prompt: str) -> list[dict]:
    """Invoke the LLM and return a parsed JSON array.

    Used by structure_check and profile_synth which expect lists, not single models.
    """
    _guard_prompt_size(prompt, "invoke_json_list")
    if hasattr(llm, "ainvoke"):
        raw = await _invoke_with_retry(llm.ainvoke, [HumanMessage(content=prompt)])
    else:
        raw = llm.invoke(prompt)

    # Test stubs may return a Python list directly.
    if isinstance(raw, list):
        return raw

    text = _strip_fences(_extract_text(raw))

    # The model might return an object with a list field instead of a bare array.
    parsed = _loads(text)
    if isinstance(parsed, list):
        return parsed
    # Common wrapper patterns: {"items": [...]} or {"findings": [...]}
    for key in ("items", "findings", "results", "data", "profiles"):
        if key in parsed and isinstance(parsed[key], list):
            return parsed[key]
    # Single object — wrap it
    if isinstance(parsed, dict):
        return [parsed]
    return []
