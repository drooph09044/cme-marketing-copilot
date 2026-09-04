from __future__ import annotations

import re
from dataclasses import replace


def classify_tables(tables, config: dict):
    classified = []
    category_terms = config.get("dataset_categories") or {}
    for table in tables:
        namespace_text = " ".join([table.catalog, table.schema, table.table])
        column_text = " ".join(c.get("column_name", "") for c in table.columns)
        comment_text = table.comment or ""
        full_text = " ".join([namespace_text, comment_text, column_text]).lower()
        domain = _classify_domain(namespace_text, column_text, comment_text, config)
        if not domain:
            continue
        if not config.get("domains", {}).get(domain, {}).get("enabled", False):
            continue
        category = _classify_category(full_text, category_terms)
        classified.append(replace(table, domain=domain, category=category))
    return classified


def _tokens(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", str(text).lower()))


def _classify_domain(namespace_text: str, column_text: str, comment_text: str, config: dict) -> str | None:
    domains = config.get("domains") or {}
    namespace_tokens = _tokens(namespace_text)
    column_tokens = _tokens(column_text)
    comment_tokens = _tokens(comment_text)

    # Explicit domain markers in catalog/schema/table names take precedence.
    # This handles conventions such as cdp_preprocessed_aut_* and prevents a
    # generic column such as vehicle_count from classifying an unrelated table.
    namespace_scores = {}
    for domain, settings in domains.items():
        aliases = settings.get("namespace_aliases") or [domain]
        namespace_scores[domain] = sum(1 for alias in aliases if str(alias).lower() in namespace_tokens)
    best_namespace_score = max(namespace_scores.values(), default=0)
    if best_namespace_score:
        tied = [domain for domain, score in namespace_scores.items() if score == best_namespace_score]
        if "telecom" in tied:
            return "telecom"
        return tied[0]

    minimum_column_matches = int(
        (config.get("domain_detection") or {}).get("minimum_column_alias_matches", 2)
    )
    best_domain = None
    best_score = 0
    for domain, settings in domains.items():
        aliases = [domain] + list(settings.get("aliases") or [])
        normalized_aliases = {str(alias).lower() for alias in aliases}
        column_hits = normalized_aliases & column_tokens
        comment_hits = normalized_aliases & comment_tokens
        if len(column_hits) < minimum_column_matches and not comment_hits:
            continue
        score = len(column_hits) + (2 * len(comment_hits))
        if score > best_score:
            best_domain = domain
            best_score = score
    return best_domain


def _classify_category(text: str, category_terms: dict) -> str:
    best_category = "transaction"
    best_score = 0
    for category, terms in category_terms.items():
        score = sum(1 for term in terms if str(term).lower() in text)
        if score > best_score:
            best_category = category
            best_score = score
    return best_category

