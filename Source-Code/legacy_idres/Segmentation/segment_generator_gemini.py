"""
segment_generator.py
Google Gemini
NL query → JSON rule tree
Works for any query — no hardcoding
"""

import segmentation_uc_bootstrap  # noqa: F401
import re
import json
import time
import os
from pathlib import Path
from dotenv import load_dotenv

_THIS_DIR = Path(__file__).resolve().parent

for p in [
    _THIS_DIR / ".env",
    _THIS_DIR.parent / ".env",
    _THIS_DIR.parent / "backend" / ".env",
]:
    if p.exists():
        load_dotenv(p)
        break

from google import genai
from google.genai import types


class SegmentGenerator:

    def __init__(self, schema: dict):
        self.schema = schema
        key = (
            os.environ.get("GEMINI_API_KEY2")
            or os.environ.get("GEMINI_API_KEY")
        )
        if not key:
            raise EnvironmentError(
                "GEMINI_API_KEY is not configured for the application"
            )
        try:
            timeout_ms = max(
                15_000,
                min(int(os.environ.get("GEMINI_TIMEOUT_MS", "90000")), 180_000),
            )
        except ValueError:
            timeout_ms = 90_000
        self.client = genai.Client(
            api_key=key,
            http_options=types.HttpOptions(timeout=timeout_ms),
        )
        self.model = (
            os.environ.get("GEMINI_MODEL") or "gemini-2.5-flash-lite"
        ).strip()

    def generate(self, query: str) -> dict:
        prompt   = self._build_prompt(query)
        try:
            max_attempts = max(
                1,
                min(int(os.environ.get("GEMINI_MAX_ATTEMPTS", "2")), 3),
            )
        except ValueError:
            max_attempts = 2

        response = None
        for attempt in range(1, max_attempts + 1):
            try:
                response = self.client.models.generate_content(
                    model=self.model,
                    contents=prompt,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.1,
                        candidate_count=1,
                        max_output_tokens=2048,
                    ),
                )
                break
            except Exception as exc:
                error_text = str(exc).lower()
                status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
                retryable = (
                    status in {429, 500, 502, 503, 504}
                    or any(
                        marker in error_text
                        for marker in (
                            "timeout",
                            "timed out",
                            "deadline",
                            "unavailable",
                            "overloaded",
                            "resource exhausted",
                            "connection reset",
                            "connection error",
                        )
                    )
                )
                if not retryable or attempt >= max_attempts:
                    raise
                time.sleep(min(2 ** (attempt - 1), 4))

        text = str(response.text or "").strip()

        text = re.sub(r"```json\s*", "", text)
        text = re.sub(r"```\s*",     "", text)
        s    = text.find("{")
        e    = text.rfind("}") + 1
        if s < 0 or e <= s:
            raise ValueError("AI service returned an empty or non-JSON response.")
        text = text[s:e]

        try:
            seg = json.loads(text)
        except json.JSONDecodeError as exc:
            raise ValueError("AI service returned invalid JSON.") from exc
        if not isinstance(seg, dict) or not isinstance(seg.get("root"), dict):
            raise ValueError("AI service returned an incomplete segment definition.")
        seg["query"]      = query
        seg["segment_id"] = self._make_id(seg.get("name", "segment"))

        # Validate rule tree against real schema
        warnings = self._validate(seg.get("root", {}))
        if warnings:
            seg["validation_warnings"] = warnings
            print(f"\n⚠️  Validation warnings:")
            for w in warnings:
                print(f"   {w}")

        return seg

    def _make_id(self, name: str) -> str:
        slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
        return f"{slug}_{int(time.time())}"[-60:]

    def _validate(self, node: dict) -> list:
        """
        Validate every condition in rule tree
        against real schema values.
        Catches wrong tables, columns, values.
        """
        warnings = []
        if not node:
            return warnings

        if "attribute" in node:
            table = node.get("table", "")
            attr  = node.get("attribute", "")
            op    = node.get("operator", "").upper()
            value = node.get("value")

            # Check table exists in schema
            if table not in self.schema["tables"]:
                warnings.append(f"Unknown table: '{table}'")
                return warnings

            cols = self.schema["tables"][table]["columns"]

            # Check column exists in table
            if attr not in cols:
                warnings.append(
                    f"Unknown column: '{table}.{attr}'"
                )
                return warnings

            col_meta = cols[attr]
            col_type = col_meta.get("type")

            # For ENUM columns validate value exists
            if col_type == "string":
                valid_vals = col_meta.get("values", [])
                if valid_vals:
                    vals_to_check = (
                        value if isinstance(value, list)
                        else [value]
                    )
                    for v in vals_to_check:
                        if str(v) not in [
                            str(x) for x in valid_vals
                        ]:
                            warnings.append(
                                f"❌ '{v}' is not a valid value "
                                f"for {table}.{attr}. "
                                f"Valid values: {valid_vals}"
                            )
                    if op == "CONTAINS":
                        warnings.append(
                            f"⚠️  {table}.{attr} is categorical. "
                            f"Use EQ or IN not CONTAINS"
                        )

        # Recurse into nested conditions
        for c in node.get("conditions", []):
            warnings.extend(self._validate(c))

        return warnings

    def _build_prompt(self, query: str) -> str:
        return f"""You are a CDP segmentation engine.
Your job is to convert any natural language query
into a minimal and precise JSON rule tree.

ARCHITECTURE:
- customer_profile = profile layer, one row per customer
- Raw tables = behavioral events, multiple rows per customer
- superseded_ids = internal bridge, never reference this

TABLES AND COLUMNS:
{self._compress_schema()}

OPERATORS:
EQ          = exact match
NEQ         = not equal
IN          = value in list
CONTAINS    = partial substring match
GT / GTE    = greater than / greater than or equal
LT / LTE    = less than / less than or equal
IN_LAST     = within last N days (DATE only)
NOT_IN_LAST = not within last N days (DATE only)
NOT_IN      = exclude customers who did this in last N days

HOW TO USE COLUMN TYPES:

[ENUM] columns have fixed allowed values listed
  - ONLY use values from that exact list
  - Use EQ for single value
  - Use IN for multiple values
  - NEVER use CONTAINS on ENUM columns
  - If what user wants is NOT in the enum list
    then skip that column entirely
    and find another column that fits

[TEXT] columns accept any value
  - Always use CONTAINS
  - Extract the exact keyword from user query
  - Example: user says "Ravens fans"
    → team CONTAINS "Ravens"
  - Example: user says "find Packers supporters"
    → team CONTAINS "Packers"

[BOOL] columns have exactly two values listed
  - Use EQ with exact value shown in schema

[DATE] columns are for time based filters
  - Use IN_LAST N for "in last N days"
  - Use NOT_IN_LAST N for "not in last N days"
  - Use NOT_IN N for exclusion logic
    "hasn't streamed in 60 days" =
    NOT_IN 60 on session_start

[NUMERIC] columns are numbers
  - Use GT GTE LT LTE EQ with numeric value

RULES FOR GENERATING CONDITIONS:
1. Only generate conditions user explicitly asked
   Never add extra inferred conditions
2. Always include table for every condition
3. Use exact enum values — never guess or approximate
4. For TEXT columns extract exact keyword from query
5. If user mentions something that does not match
   any column value — skip that column
   find the right column from schema instead
6. potential or likely or similar intent m
7. AND logic when user says "and" or combines concepts
8. Minimum conditions — nothing extra
9. NOT_IN means get customers who did NOT do this
10. don't add value which is not present in query also understand the intent and context.
   
OUTPUT — valid JSON only:
{{
  "name": "Segment Name",
  "description": "What this segment represents",
  "root": {{
    "operator": "AND",
    "conditions": [
      {{
        "table":     "table_name",
        "attribute": "column_name",
        "operator":  "OPERATOR",
        "value":     "value"
      }}
    ]
  }}
}}

For date conditions include unit:
{{
  "table":     "streaming_activity",
  "attribute": "session_start",
  "operator":  "NOT_IN",
  "value":     60,
  "unit":      "days"
}}

QUERY: {query}

Return ONLY valid JSON. No explanation."""

    def _compress_schema(self) -> str:
        """
        Send schema to LLM in clean format.
        ENUM: show all fixed values clearly.
        TEXT: just say CONTAINS.
        BOOL: show exact values.
        DATE: show operators.
        NUMERIC: show range.
        """
        lines = []
        for table, meta in self.schema["tables"].items():
            lines.append(f"\n[{table}]")
            lines.append(f"  {meta['description']}")
            for col, col_meta in meta["columns"].items():
                t = col_meta["type"]

                if t == "string":
                    vals = " | ".join(
                        str(v) for v in col_meta.get("values", [])
                    )
                    lines.append(
                        f"  {col} [ENUM]: {vals}"
                        f"\n    → Use EQ or IN with these exact values only"
                        f"\n    → If user value not in list skip this column"
                    )

                elif t == "text":
                    lines.append(
                        f"  {col} [TEXT]: use CONTAINS"
                        f"\n    → Extract keyword from user query"
                    )

                elif t == "boolean":
                    vals = " or ".join(
                        str(v) for v in col_meta.get("values", [])
                    )
                    lines.append(
                        f"  {col} [BOOL]: {vals}"
                        f"\n    → Use EQ with exact value above"
                    )

                elif t == "date":
                    lines.append(
                        f"  {col} [DATE]: IN_LAST N or NOT_IN_LAST N days"
                    )

                else:
                    r = col_meta.get("range", [0, 0])
                    lines.append(
                        f"  {col} [NUMERIC]: range {r[0]} to {r[1]}"
                    )

        return "\n".join(lines)
