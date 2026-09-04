import argparse
import csv
import itertools
import re
from collections import defaultdict
from pathlib import Path

import yaml

import pipeline_uc_bootstrap  # noqa: F401


ROOT = Path(__file__).resolve().parent
DEFAULT_CONFIG = ROOT / "enhanced_identity_config" / "media_identity_config.yaml"


def load_yaml(path):
    with open(path, "r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def resolve_path(path_text):
    path = Path(path_text)
    return path if path.is_absolute() else ROOT / path


def clean_text(value):
    return " ".join(str(value or "").strip().split())


def feature_settings(config, feature):
    try:
        return config["features"][feature]
    except KeyError as exc:
        raise KeyError(f"Missing config value: features.{feature}") from exc


def comparison_pipeline(config, feature):
    return feature_settings(config, feature).get("comparison_pipeline", [])


def comparison_step(config, feature, method):
    for step in comparison_pipeline(config, feature):
        if step.get("method") == method:
            return step
    raise KeyError(f"Missing config value: features.{feature}.comparison_pipeline method {method}")


def method_confidence(config, feature, method, default=None):
    step = comparison_step(config, feature, method)
    if "confidence" in step:
        return float(step["confidence"])
    if default is not None:
        return float(default)
    raise KeyError(f"Missing config value: features.{feature}.{method}.confidence")


def method_label(config, feature, method):
    return str(comparison_step(config, feature, method).get("label", method.replace("_", " ").title()))


def no_match_confidence(config, feature):
    return float(feature_settings(config, feature).get("no_match", {}).get("confidence", 0.0))


def no_match_label(config, feature):
    return str(feature_settings(config, feature).get("no_match", {}).get("label", f"{feature.title()} No Match"))


def configured_feature_weights(config):
    features = config.get("features", {})
    weights = {
        feature: float(settings["weight"])
        for feature, settings in features.items()
        if "weight" in settings
    }
    overrides = config.get("confidence_scoring", {}).get("feature_weights", {})
    for feature, weight in overrides.items():
        weights[feature] = float(weight)
    return weights


def source_field(config, logical_name):
    field_names = config.get("input", {}).get("field_names", {})
    try:
        return field_names[logical_name]
    except KeyError as exc:
        raise KeyError(f"Missing config value: input.field_names.{logical_name}") from exc


def record_id_value(record, config):
    return record.get(config["input"]["record_id_field"], "")


def source_value(record, config):
    return record.get(config["input"]["source_field"], "")


def output_column(config, logical_name):
    try:
        return config["output"]["column_names"][logical_name]
    except KeyError as exc:
        raise KeyError(f"Missing config value: output.column_names.{logical_name}") from exc


def derived_field(config, logical_name):
    field_names = config.get("matching_field_preparation", {}).get("derived_field_names", {})
    try:
        return field_names[logical_name]
    except KeyError as exc:
        raise KeyError(
            f"Missing config value: matching_field_preparation.derived_field_names.{logical_name}"
        ) from exc


def field_value(record, config, logical_name):
    return record.get(derived_field(config, logical_name), "")


def jaro_winkler(left, right):
    left = clean_text(left)
    right = clean_text(right)
    if left == right:
        return 1.0
    if not left or not right:
        return 0.0

    match_distance = max(len(left), len(right)) // 2 - 1
    left_matches = [False] * len(left)
    right_matches = [False] * len(right)
    matches = 0

    for i, left_char in enumerate(left):
        start = max(0, i - match_distance)
        end = min(i + match_distance + 1, len(right))
        for j in range(start, end):
            if right_matches[j] or left_char != right[j]:
                continue
            left_matches[i] = True
            right_matches[j] = True
            matches += 1
            break

    if matches == 0:
        return 0.0

    transpositions = 0
    k = 0
    for i, matched in enumerate(left_matches):
        if not matched:
            continue
        while not right_matches[k]:
            k += 1
        if left[i] != right[k]:
            transpositions += 1
        k += 1

    transpositions /= 2
    jaro = (
        matches / len(left)
        + matches / len(right)
        + (matches - transpositions) / matches
    ) / 3

    prefix = 0
    for left_char, right_char in zip(left, right):
        if left_char == right_char and prefix < 4:
            prefix += 1
        else:
            break

    return jaro + 0.1 * prefix * (1 - jaro)


def soundex(value):
    value = re.sub(r"[^A-Z]", "", str(value or "").upper())
    if not value:
        return ""

    groups = {
        **dict.fromkeys(list("BFPV"), "1"),
        **dict.fromkeys(list("CGJKQSXZ"), "2"),
        **dict.fromkeys(list("DT"), "3"),
        "L": "4",
        **dict.fromkeys(list("MN"), "5"),
        "R": "6",
    }
    first = value[0]
    encoded = []
    previous = groups.get(first, "")

    for char in value[1:]:
        code = groups.get(char, "")
        if code and code != previous:
            encoded.append(code)
        previous = code

    return (first + "".join(encoded) + "000")[:4]


def load_records(path, config=None):
    with open(path, "r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def candidate_field_name(config, configured_name):
    derived_names = config.get("matching_field_preparation", {}).get("derived_field_names", {})
    return derived_names.get(configured_name, configured_name)


def record_evidence_count(record, config):
    """Prefer richer identity records when a blocking group must be capped."""
    logical_fields = [
        "email_standardized",
        "phone_standardized",
        "first_name",
        "last_name",
        "address_standardized",
        "zip",
    ]
    count = 0
    for logical_name in logical_fields:
        try:
            if clean_text(record.get(derived_field(config, logical_name), "")):
                count += 1
        except KeyError:
            continue
    for item in config.get("matching_field_preparation", {}).get("exact_identifier_fields", []):
        prepared_field = item.get("prepared_field", "")
        if prepared_field and clean_text(record.get(prepared_field, "")):
            count += 1
    return count


def ordered_block_members(members, config):
    return sorted(
        members,
        key=lambda record: (
            -record_evidence_count(record, config),
            source_value(record, config),
            record_id_value(record, config),
        ),
    )


def add_pairs_from_blocks(blocks, strategy_name, pairs, pair_counts, config, compare_same_source_override=None):
    candidate_config = config["candidate_generation"]
    max_block = int(candidate_config["max_block_size"])
    max_pairs = int(candidate_config["max_pairs_per_record"])
    compare_same_source = bool(
        candidate_config["compare_records_from_same_source_file"]
        if compare_same_source_override is None
        else compare_same_source_override
    )
    source_field = config["input"]["source_field"]

    for members in blocks.values():
        if len(members) > max_block:
            continue
        members = ordered_block_members(members, config)
        for left, right in itertools.combinations(members, 2):
            left_id = record_id_value(left, config)
            right_id = record_id_value(right, config)
            if left_id == right_id:
                continue
            if not compare_same_source and left.get(source_field) == right.get(source_field):
                continue
            if pair_counts[left_id] >= max_pairs or pair_counts[right_id] >= max_pairs:
                continue
            pair = tuple(sorted((left_id, right_id)))
            pairs[pair].add(strategy_name)
            pair_counts[left_id] += 1
            pair_counts[right_id] += 1


def add_exact_field_pairs(records, fields, strategy_name, pairs, pair_counts, config, strategy_definition=None):
    blocks = defaultdict(list)

    for record in records:
        values = [clean_text(record.get(candidate_field_name(config, field), "")) for field in fields]
        if all(values):
            blocks["|".join(values)].append(record)

    strategy_definition = strategy_definition or {}
    add_pairs_from_blocks(
        blocks,
        strategy_name,
        pairs,
        pair_counts,
        config,
        strategy_definition.get("compare_records_from_same_source_file"),
    )


def add_name_zip_pairs(records, strategy_definition, pairs, pair_counts, config):
    character_count = int(strategy_definition.get("character_count", 3))
    first_name_field = candidate_field_name(config, strategy_definition.get("first_name_field", "first_name"))
    last_name_field = candidate_field_name(config, strategy_definition.get("last_name_field", "last_name"))
    zip_field = candidate_field_name(config, strategy_definition.get("zip_field", "zip"))
    blocks = defaultdict(list)

    for record in records:
        first = clean_text(record.get(first_name_field, ""))[:character_count]
        last = clean_text(record.get(last_name_field, ""))[:character_count]
        zip_code = clean_text(record.get(zip_field, ""))
        if first and last and zip_code:
            blocks[f"{first}|{last}|{zip_code}"].append(record)

    add_pairs_from_blocks(
        blocks,
        strategy_definition.get("label", "Name and ZIP Candidate"),
        pairs,
        pair_counts,
        config,
    )


def configured_candidate_strategies(config):
    candidate_config = config["candidate_generation"]
    definitions = candidate_config.get("strategy_definitions", {})
    configured_order = list(candidate_config.get("strategy_order") or definitions.keys())
    strategy_order = configured_order + [
        strategy for strategy in definitions.keys() if strategy not in configured_order
    ]
    return [
        (strategy, definitions[strategy])
        for strategy in strategy_order
        if definitions.get(strategy, {}).get("enabled", False)
    ]


def generate_candidate_pairs(records, config):
    pairs = defaultdict(set)
    pair_counts = defaultdict(int)

    for strategy, definition in configured_candidate_strategies(config):
        active_pair_counts = defaultdict(int) if definition.get("pair_limit_scope") == "strategy" else pair_counts
        strategy_type = definition.get("type", "")
        if strategy_type == "exact_fields":
            add_exact_field_pairs(
                records,
                definition.get("fields", []),
                definition.get("label", strategy),
                pairs,
                active_pair_counts,
                config,
                definition,
            )
        elif strategy_type == "name_zip_prefix":
            add_name_zip_pairs(records, definition, pairs, active_pair_counts, config)

    return pairs


def compare_email(left, right, config):
    left_raw = clean_text(field_value(left, config, "email_raw")).lower()
    right_raw = clean_text(field_value(right, config, "email_raw")).lower()
    for step in comparison_pipeline(config, "email"):
        method = step.get("method")
        if method == "raw_exact" and left_raw and left_raw == right_raw:
            return method_confidence(config, "email", method), method_label(config, "email", method)
        if (
            method == "standardized_exact"
            and field_value(left, config, "email_standardized")
            and field_value(left, config, "email_standardized") == field_value(right, config, "email_standardized")
        ):
            return method_confidence(config, "email", method), method_label(config, "email", method)
        if (
            method == "provider_mismatch"
            and field_value(left, config, "email_provider")
            and field_value(right, config, "email_provider")
            and field_value(left, config, "email_provider") != field_value(right, config, "email_provider")
        ):
            return method_confidence(config, "email", method), method_label(config, "email", method)
    return no_match_confidence(config, "email"), no_match_label(config, "email")


def compare_phone(left, right, config):
    for step in comparison_pipeline(config, "phone"):
        method = step.get("method")
        if (
            method == "standardized_exact"
            and field_value(left, config, "phone_standardized")
            and field_value(left, config, "phone_standardized") == field_value(right, config, "phone_standardized")
        ):
            return method_confidence(config, "phone", method), method_label(config, "phone", method)
    return no_match_confidence(config, "phone"), no_match_label(config, "phone")


def compare_name(left, right, config):
    name_config = feature_settings(config, "name")
    comparison_order = [step.get("method") for step in comparison_pipeline(config, "name")]
    require_initials = bool(name_config["require_initials_before_partial_matches"])
    first_character_count = int(name_config["first_character_count"])
    threshold = float(name_config["similarity_threshold"])
    left_full = f"{field_value(left, config, 'first_name')} {field_value(left, config, 'last_name')}".strip()
    right_full = f"{field_value(right, config, 'first_name')} {field_value(right, config, 'last_name')}".strip()
    full_similarity = jaro_winkler(left_full, right_full)
    max_name_length = max(len(left_full.replace(" ", "")), len(right_full.replace(" ", "")), 1)
    initials_match = bool(
        field_value(left, config, "first_initial")
        and field_value(left, config, "first_initial") == field_value(right, config, "first_initial")
        and field_value(left, config, "last_initial") == field_value(right, config, "last_initial")
    )
    initials_confidence = 0.0
    best_confidence = 0.0
    best_label = ""

    def remember(confidence, label):
        nonlocal best_confidence, best_label
        if confidence > best_confidence:
            best_confidence = confidence
            best_label = label

    def combined_label(*labels):
        seen = []
        for label in labels:
            for part in str(label or "").split("+"):
                clean_part = part.strip()
                if clean_part and clean_part not in seen:
                    seen.append(clean_part)
        return " + ".join(seen)

    for comparison in comparison_order:
        if comparison == "first_name_and_last_name":
            if (
                field_value(left, config, "first_name")
                and field_value(left, config, "last_name")
                and field_value(left, config, "first_name") == field_value(right, config, "first_name")
                and field_value(left, config, "last_name") == field_value(right, config, "last_name")
            ):
                return method_confidence(config, "name", comparison), method_label(config, "name", comparison)
            continue

        if comparison == "initials":
            if initials_match:
                initials_confidence = min(
                    len(field_value(left, config, "first_initial") + field_value(left, config, "last_initial")) / max_name_length,
                    1.0,
                )
                remember(initials_confidence, method_label(config, "name", comparison))
                continue
            if require_initials:
                return no_match_confidence(config, "name"), name_config["no_match"].get("initials_label", no_match_label(config, "name"))
            continue

        if require_initials and not initials_match:
            return no_match_confidence(config, "name"), name_config["no_match"].get("initials_label", no_match_label(config, "name"))

        if comparison == "first_three_characters":
            left_first = field_value(left, config, "first_name")[:first_character_count]
            right_first = field_value(right, config, "first_name")[:first_character_count]
            left_last = field_value(left, config, "last_name")[:first_character_count]
            right_last = field_value(right, config, "last_name")[:first_character_count]
            if left_first and left_last and left_first == right_first and left_last == right_last:
                matched_chars = len(left_first + left_last)
                remember(min(matched_chars / max_name_length, 1.0), method_label(config, "name", comparison))
            continue

        if comparison == "first_initial_and_full_last_name":
            if (
                field_value(left, config, "first_initial")
                and field_value(left, config, "first_initial") == field_value(right, config, "first_initial")
                and field_value(left, config, "last_name")
                and field_value(left, config, "last_name") == field_value(right, config, "last_name")
            ):
                remember(
                    min((len(field_value(left, config, "first_initial")) + len(field_value(left, config, "last_name"))) / max_name_length, 1.0),
                    method_label(config, "name", comparison),
                )
            continue

        if comparison == "full_first_name_and_last_initial":
            if (
                field_value(left, config, "first_name")
                and field_value(left, config, "first_name") == field_value(right, config, "first_name")
                and field_value(left, config, "last_initial")
                and field_value(left, config, "last_initial") == field_value(right, config, "last_initial")
            ):
                remember(
                    min((len(field_value(left, config, "first_name")) + len(field_value(left, config, "last_initial"))) / max_name_length, 1.0),
                    method_label(config, "name", comparison),
                )
            continue

        if comparison == "soundex":
            left_soundex = f"{soundex(field_value(left, config, 'first_name'))} {soundex(field_value(left, config, 'last_name'))}".strip()
            right_soundex = f"{soundex(field_value(right, config, 'first_name'))} {soundex(field_value(right, config, 'last_name'))}".strip()
            if left_soundex and left_soundex == right_soundex and full_similarity >= threshold:
                label = combined_label(best_label, method_label(config, "name", comparison))
                return max(best_confidence, full_similarity), label
            continue

        if comparison == "jaro_winkler":
            if full_similarity >= threshold:
                label = combined_label(best_label, method_label(config, "name", comparison))
                return max(best_confidence, full_similarity), label

    if best_confidence:
        return best_confidence, best_label
    return no_match_confidence(config, "name"), no_match_label(config, "name")


def compare_address(left, right, config):
    if not field_value(left, config, "zip") or field_value(left, config, "zip") != field_value(right, config, "zip"):
        return method_confidence(config, "address", "zip_mismatch"), method_label(config, "address", "zip_mismatch")
    if field_value(left, config, "house_number") and field_value(right, config, "house_number") and field_value(left, config, "house_number") != field_value(right, config, "house_number"):
        return method_confidence(config, "address", "house_number_mismatch"), method_label(config, "address", "house_number_mismatch")
    if field_value(left, config, "address_standardized") and field_value(left, config, "address_standardized") == field_value(right, config, "address_standardized"):
        return method_confidence(config, "address", "zip_house_number_street_exact"), method_label(config, "address", "zip_house_number_street_exact")

    left_street = field_value(left, config, "street_name")
    right_street = field_value(right, config, "street_name")
    if not left_street or not right_street:
        return no_match_confidence(config, "address"), no_match_label(config, "address")

    similarity = jaro_winkler(left_street, right_street)
    threshold = float(feature_settings(config, "address")["street_similarity_threshold"])
    if similarity >= threshold:
        return similarity, method_label(config, "address", "street_similarity")
    return no_match_confidence(config, "address"), no_match_label(config, "address")


def compare_probabilistic(left, right, config):
    probabilistic_config = feature_settings(config, "probabilistic")
    methods = probabilistic_config.get("methods", {})
    device_field = source_field(config, "device_id")
    ip_field = source_field(config, "ip_address")
    same_device = methods.get("same_device", {})
    same_ip = methods.get("same_ip", {})
    if same_device.get("enabled", False) and left.get(device_field) and left.get(device_field) == right.get(device_field):
        return float(same_device.get("confidence", 1.0)), same_device.get("label", "Device ID Match")
    if same_ip.get("enabled", False) and left.get(ip_field) and left.get(ip_field) == right.get(ip_field):
        return float(same_ip.get("confidence", 1.0)), same_ip.get("label", "IP Address Match")
    return no_match_confidence(config, "probabilistic"), no_match_label(config, "probabilistic")


def compare_configured_feature(left, right, config, feature):
    settings = feature_settings(config, feature)
    prepared_field = settings.get("prepared_field") or settings.get("field")
    if not prepared_field:
        return no_match_confidence(config, feature), no_match_label(config, feature)

    left_value = clean_text(left.get(prepared_field, ""))
    right_value = clean_text(right.get(prepared_field, ""))
    if not left_value or not right_value:
        return no_match_confidence(config, feature), no_match_label(config, feature)

    for step in comparison_pipeline(config, feature):
        method = step.get("method")
        if method == "exact" and left_value == right_value:
            return method_confidence(config, feature, method), method_label(config, feature, method)
        if method == "jaro_winkler":
            score = jaro_winkler(left_value, right_value)
            if score >= float(step.get("threshold", settings.get("similarity_threshold", 1.0))):
                return score, method_label(config, feature, method)

    return no_match_confidence(config, feature), no_match_label(config, feature)


def weighted_confidence(confidences, config):
    weights = configured_feature_weights(config)
    contributions = {}
    total = 0.0

    for feature, weight in weights.items():
        contribution = float(confidences.get(f"{feature}_confidence", 0.0)) * float(weight)
        if feature == "probabilistic":
            probabilistic_cap = float(feature_settings(config, "probabilistic").get("maximum_contribution", config["confidence_scoring"]["max_score"]))
            contribution = min(contribution, probabilistic_cap)
        contributions[f"{feature}_contribution"] = round(contribution, 4)
        total += contribution

    return min(total, float(config["confidence_scoring"]["max_score"])), contributions


def display_tier(confidence, config):
    tiers = config["match_classification"]["edge_tiers"]
    try:
        score = float(confidence)
    except (TypeError, ValueError):
        score = 0.0
    for tier, settings in sorted(tiers.items(), key=lambda item: -float(item[1].get("min_score", 0))):
        if score >= float(settings.get("min_score", 0)):
            return tier
    return "unclassified"


def score_pair(left, right, strategy, config):
    built_in_features = {"email", "phone", "name", "address", "probabilistic"}
    email_confidence, email_match = compare_email(left, right, config)
    phone_confidence, phone_match = compare_phone(left, right, config)
    name_confidence, name_match = compare_name(left, right, config)
    address_confidence, address_match = compare_address(left, right, config)
    probabilistic_confidence, probabilistic_match = compare_probabilistic(left, right, config)
    extra_results = {}
    for feature in config.get("features", {}):
        if feature in built_in_features or "weight" not in config["features"].get(feature, {}):
            continue
        confidence, technique = compare_configured_feature(left, right, config, feature)
        extra_results[feature] = {
            "confidence": confidence,
            "technique": technique,
            "available": bool(
                clean_text(left.get(config["features"][feature].get("prepared_field") or config["features"][feature].get("field"), ""))
                and clean_text(right.get(config["features"][feature].get("prepared_field") or config["features"][feature].get("field"), ""))
            ),
        }

    confidences = {
        "email_confidence": email_confidence,
        "phone_confidence": phone_confidence,
        "name_confidence": name_confidence,
        "address_confidence": address_confidence,
        "probabilistic_confidence": probabilistic_confidence,
        "email_available": bool(field_value(left, config, "email_standardized") and field_value(right, config, "email_standardized")),
        "phone_available": bool(field_value(left, config, "phone_standardized") and field_value(right, config, "phone_standardized")),
        "name_available": bool(
            field_value(left, config, "first_initial")
            and field_value(left, config, "last_initial")
            and field_value(right, config, "first_initial")
            and field_value(right, config, "last_initial")
        ),
    }
    for feature, result in extra_results.items():
        confidences[f"{feature}_confidence"] = result["confidence"]
        confidences[f"{feature}_available"] = result["available"]

    matched_fields = []
    matching_techniques = []
    feature_results = [
        ("email", email_confidence, email_match),
        ("phone", phone_confidence, phone_match),
        ("name", name_confidence, name_match),
        ("address", address_confidence, address_match),
        ("probabilistic", probabilistic_confidence, probabilistic_match),
    ]
    feature_results.extend(
        (feature, result["confidence"], result["technique"])
        for feature, result in extra_results.items()
    )

    for feature, confidence, technique in feature_results:
        if confidence > 0:
            if feature == "probabilistic" and technique == feature_settings(config, "probabilistic").get("methods", {}).get("same_device", {}).get("label", "Device ID Match"):
                matched_fields.extend(["probabilistic", source_field(config, "device_id")])
            elif feature == "probabilistic" and technique == feature_settings(config, "probabilistic").get("methods", {}).get("same_ip", {}).get("label", "IP Address Match"):
                matched_fields.extend(["probabilistic", source_field(config, "ip_address")])
            else:
                matched_fields.append(feature)
            matching_techniques.append(f"{feature}: {technique}")
    matched_fields = list(dict.fromkeys(matched_fields))
    raw_confidence, contributions = weighted_confidence(confidences, config)
    matching_person_feature_count = sum(
        1
        for feature in config["confidence_scoring"].get("person_features", [])
        if float(confidences.get(f"{feature}_confidence", 0.0) or 0.0) > 0
    )
    final_confidence = raw_confidence
    match_tier = display_tier(final_confidence, config)
    decision_reasons = config["match_classification"]["decision_reasons"]
    decision_reason = (
        decision_reasons["classified"]
        if match_tier != "unclassified"
        else decision_reasons["unclassified"]
    )

    row = {
        output_column(config, "candidate_record_id_1"): record_id_value(left, config),
        output_column(config, "candidate_record_id_2"): record_id_value(right, config),
        "source_1": source_value(left, config),
        "source_2": source_value(right, config),
        output_column(config, "matched_fields"): "|".join(matched_fields),
        output_column(config, "matching_techniques"): "|".join(matching_techniques),
        output_column(config, "matching_person_feature_count"): str(matching_person_feature_count),
        **{key: f"{value:.4f}" for key, value in confidences.items() if key.endswith("_confidence")},
        **{f"{feature}_weight": f"{float(weight):.2f}" for feature, weight in configured_feature_weights(config).items()},
        **{key: f"{value:.2f}" for key, value in contributions.items()},
        "raw_confidence": f"{raw_confidence:.2f}",
        output_column(config, "final_confidence"): f"{final_confidence:.2f}",
        output_column(config, "edge_type"): match_tier,
        output_column(config, "match_tier"): match_tier,
        output_column(config, "relationship_classification"): match_tier,
        "decision_reason": decision_reason,
    }
    return row


def write_candidate_pairs(records, pairs, config):
    output_path = resolve_path(config["output"]["candidate_pairs"])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    by_id = {record_id_value(record, config): record for record in records}
    fieldnames = config["output"]["candidate_pair_columns"]

    written_count = 0
    with open(output_path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for (left_id, right_id), strategies in pairs.items():
            row = score_pair(by_id[left_id], by_id[right_id], "|".join(sorted(strategies)), config)
            if row.get(output_column(config, "edge_type")) == "unclassified":
                continue
            writer.writerow(row)
            written_count += 1

    return output_path, written_count


def main():
    parser = argparse.ArgumentParser(description="Enhanced candidate generation and pairwise scoring.")
    parser.add_argument("--config", default=str(DEFAULT_CONFIG))
    parser.add_argument("--source-systems", default="")
    args = parser.parse_args()

    config = load_yaml(Path(args.config))
    input_path = resolve_path(config["output"]["prepared_records"])
    if not input_path.exists():
        raise FileNotFoundError(
            f"Prepared records not found: {input_path}. Run enhanced_prepare_matching_fields.py first."
        )
    records = load_records(input_path, config)
    if not records:
        raise RuntimeError(
            "Candidate generation received zero prepared records; "
            "existing identity outputs were not replaced."
        )
    pairs = generate_candidate_pairs(records, config)
    output_path, written_count = write_candidate_pairs(records, pairs, config)

    print(f"Generated {len(pairs)} enhanced candidate pairs")
    print(f"Wrote {written_count} matched pairs to {output_path}")


if __name__ == "__main__":
    main()
