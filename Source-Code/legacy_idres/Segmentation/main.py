"""
Terminal test for segmentation engine.

Run:
  cd legacy_idres/Segmentation-new
  python schema_generator.py          ← streaming schema
  python automotive_schema_generator.py ← automotive schema
  python main.py

Commands:
  Type any query + Enter
  Add 'save' at end to save segment
  Type 'test' to run sample queries
  Type 'quit' to exit
"""

import segmentation_uc_bootstrap  # noqa: F401
import json
import sys
import traceback
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

_THIS_DIR  = Path(__file__).resolve().parent
_IDRES_DIR = _THIS_DIR.parent

for p in [
    _THIS_DIR / ".env",
    _THIS_DIR.parent / ".env",
    _THIS_DIR.parent / "backend" / ".env",
]:
    if p.exists():
        load_dotenv(p)
        break

SCHEMA_PATH            = _THIS_DIR / "schema.json"
AUTOMOTIVE_SCHEMA_PATH = _THIS_DIR / "automotive_schema.json"
SEGMENTS_DIR           = _IDRES_DIR / "data" / "ai_segments"
SEGMENTS_DIR.mkdir(parents=True, exist_ok=True)

SEP  = "─" * 60
SEP2 = "═" * 60

# ── Sample queries per domain ─────────────────────────────────
STREAMING_QUERIES = [
    "High LTV sports fans who haven't streamed in 60 days",
    "Active subscribers with high engagement watching kids content",
    "Lapsing customers with medium LTV likely to churn",
    "Low engagement subscribers who opened emails but never streamed",
    "Consented high value customers ready for email activation",
    "Inactive users with documentary or news affinity for win-back",
    "Find all potential Yankees fans",
    "Newsletter subscribers who haven't engaged in 90 days",
]

AUTOMOTIVE_QUERIES = [
    "Find customers who have not replaced battery in 5 years",
    "Find customers with more than 50000 miles and no tire change",
    "Households with multiple vehicles",
    "Customers eligible for premium service upsell",
    "Customers who have not serviced vehicle in 9 months",
]


def load_schema(domain: str) -> dict:
    if domain == "automotive":
        path = AUTOMOTIVE_SCHEMA_PATH
    else:
        path = SCHEMA_PATH

    if not path.exists():
        print(f"❌ schema not found: {path}")
        if domain == "automotive":
            print("   Run: python automotive_schema_generator.py")
        else:
            print("   Run: python schema_generator.py")
        sys.exit(1)

    with open(path, encoding="utf-8") as f:
        return json.load(f)


def select_domain() -> str:
    print(f"\n{SEP2}")
    print("  CDP AI Segmentation Engine")
    print(SEP2)
    print("\n  Select domain:")
    print("  [1] Streaming / Media")
    print("  [2] Automotive")
    print(SEP)

    while True:
        choice = input("\n  Domain (1 or 2): ").strip()
        if choice == "1":
            return "streaming"
        elif choice == "2":
            return "automotive"
        else:
            print("  Please enter 1 or 2")


def flatten_filters(node: dict, chips: list = None) -> list:
    if chips is None:
        chips = []
    if not node:
        return chips

    if "attribute" in node:
        op_map = {
            "EQ":          "=",
            "NEQ":         "≠",
            "IN":          "in",
            "CONTAINS":    "contains",
            "GT":          ">",
            "GTE":         "≥",
            "LT":          "<",
            "LTE":         "≤",
            "IN_LAST":     "in last",
            "NOT_IN_LAST": "not in last",
            "NOT_IN":      "NOT in last",
            "BEFORE":      "before",
            "AFTER":       "after",
        }
        op  = op_map.get(
            node.get("operator", "EQ"),
            node.get("operator", "")
        )
        val = str(node.get("value", ""))
        if node.get("unit"):
            val = f"{val} {node['unit']}"

        chips.append({
            "attribute": node.get("attribute", ""),
            "op":        op,
            "value":     val,
            "table":     node.get("table", ""),
        })

    for c in node.get("conditions", []):
        flatten_filters(c, chips)
    return chips


def run_query(
    query:  str,
    schema: dict,
    domain: str,
    save:   bool = False,
) -> None:
    from segment_generator_gemini import SegmentGenerator
    from sql_generator import SQLGenerator

    if domain == "automotive":
        from automotive_rule_engine import (
            AutomotiveRuleEngine as RuleEngine,
            clear_cache,
        )
    else:
        from rule_engine import RuleEngine, clear_cache

    print(f"\n{SEP2}")
    print(f"  Domain: {domain.upper()}")
    print(f"  Query:  {query}")
    print(SEP2)

    # Step 1: LLM generates rule tree
    segment = SegmentGenerator(schema).generate(query)
    segment["domain"] = domain
    print(f"✓ Generated: {segment.get('name', '')}")
    if segment.get("description"):
        print(f"  {segment['description']}")

    # Step 2: Print rule tree JSON
    print(f"\n📋 Rule Tree JSON:")
    print(SEP)
    print(json.dumps(segment.get("root", {}), indent=2))

    # Step 3: Print filter chips
    print(f"\n🔍 Detected Filters:")
    print(SEP)
    chips = flatten_filters(segment.get("root", {}))
    if chips:
        for chip in chips:
            print(
                f"  {chip['attribute']:35s} "
                f"{chip['op']:12s} "
                f"{chip['value']:20s} "
                f"← {chip['table']}"
            )
    else:
        print("  No filters detected")

    # Step 4: Execute on raw data
    print(f"\n⚙️  Executing on raw data...")
    print(SEP)
    clear_cache()
    engine = RuleEngine()
    result = engine.execute(segment)
    count  = result["count"]
    print(f"\n  Matched: {count} customers")

    # Step 5: SQL VIEW
    print(f"\n  SQL VIEW (saved for Databricks):")
    print(SEP)
    sql_view = SQLGenerator().generate(segment)
    print(sql_view)

    # Step 6: Save outputs
    now = datetime.utcnow().isoformat() + "Z"
    sid = segment["segment_id"]

    export_df = result.get("export_df")

    if export_df is not None and not export_df.empty:
        csv_path = SEGMENTS_DIR / f"{sid}.csv"
        export_df.to_csv(csv_path, index=False)
        print(
            f"\n💾 Saved CSV: "
            f"{csv_path.name} "
            f"({len(export_df)} rows)"
        )

    # Save JSON — rule tree + metadata + SQL view
    meta = {
        "segment_id":     sid,
        "name":           segment.get("name", ""),
        "description":    segment.get("description", ""),
        "query":          query,
        "domain":         domain,
        "root":           segment.get("root", {}),
        "sql_view":       sql_view,
        "count":          count,
        "created_at":     now,
        "last_refreshed": now,
    }
    json_path = SEGMENTS_DIR / f"{sid}.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)
    print(f"💾 Saved JSON: {json_path.name}")

    print(SEP2)


def main():
    domain = select_domain()
    schema = load_schema(domain)

    sample_queries = (
        AUTOMOTIVE_QUERIES
        if domain == "automotive"
        else STREAMING_QUERIES
    )

    print(f"\n{SEP2}")
    print(f"  Domain: {domain.upper()}")
    print(SEP2)

    print("\nData sources:")
    for t, m in schema["tables"].items():
        print(f"  {t:45s} {m['row_count']:,} rows")

    print(f"\nSample queries:")
    for i, q in enumerate(sample_queries, 1):
        print(f"  {i}. {q}")

    print(f"\nCommands:")
    print("  Any natural language query → Enter")
    print("  Add 'save' at end          → saves segment CSV + JSON")
    print("  'test'                     → run all sample queries")
    print("  'quit'                     → exit")
    print(SEP)

    while True:
        try:
            user_input = input("\n🔍 Query: ").strip()

            if not user_input:
                continue

            if user_input.lower() == "quit":
                print("Goodbye!")
                break

            if user_input.lower() == "test":
                for q in sample_queries:
                    try:
                        run_query(q, schema, domain, save=False)
                        input("\nPress Enter for next query...")
                    except Exception as e:
                        print(f"Error: {e}")
                        traceback.print_exc()
                continue

            save  = False
            query = user_input

            if user_input.lower().endswith(" save"):
                save  = True
                query = user_input[:-5].strip()

            run_query(query, schema, domain, save=save)

        except KeyboardInterrupt:
            print("\n\nGoodbye!")
            break
        except Exception as e:
            print(f"\nError: {e}")
            traceback.print_exc()


if __name__ == "__main__":
    main()
