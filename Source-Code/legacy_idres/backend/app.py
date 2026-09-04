
"""EXL CDP — Identity Resolution Engine
Flask API backend wrapping the Python pipeline.
"""

import os
from config_loader import (
    get_config,
    get_databricks_catalog,
    get_databricks_schema,
    get_default_source,
    get_directory,
    get_path,
    get_supported_sources,
)
from payload_loader import get_journey_templates, get_payload_value, get_prebuilt_segments
from data_registry import get_registry
import sys
import json
import csv
import gzip
import re
import sqlite3
import heapq
import subprocess
import threading
import time
import yaml
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from flask import Flask, g, jsonify, request
from flask_cors import CORS
from werkzeug.security import check_password_hash

import jwt
import uuid
from datetime import datetime, timedelta, timezone
from functools import lru_cache, wraps


from consent.consent_api import consent_bp
from consent.consent_segment_filter import filter_segment_by_consent
from consent.segment_classifier import classify_golden_id
from segment_lifecycle import SegmentLifecycleStore


def _missing_connector_dependency(connector_name, error_cls, exc):
    def _raise(*_args, **_kwargs):
        raise error_cls(
            f"{connector_name} connector dependencies are not installed. "
            f"Install backend/requirements.txt. Missing dependency: {exc}"
        )

    return _raise


try:
    from databricks_connector import (
        DatabricksConnectorError,
        config_from_payload as databricks_config_from_payload,
        fetch_table_rows as databricks_fetch_table_rows,
        list_catalogs as databricks_list_catalogs,
        list_schemas as databricks_list_schemas,
        list_tables as databricks_list_tables,
        preview_table as databricks_preview_table,
        table_summary as databricks_table_summary,
    )
except Exception as exc:
    class DatabricksConnectorError(Exception):
        pass

    databricks_config_from_payload = _missing_connector_dependency("Databricks", DatabricksConnectorError, exc)
    databricks_fetch_table_rows = _missing_connector_dependency("Databricks", DatabricksConnectorError, exc)
    databricks_list_catalogs = _missing_connector_dependency("Databricks", DatabricksConnectorError, exc)
    databricks_list_schemas = _missing_connector_dependency("Databricks", DatabricksConnectorError, exc)
    databricks_list_tables = _missing_connector_dependency("Databricks", DatabricksConnectorError, exc)
    databricks_preview_table = _missing_connector_dependency("Databricks", DatabricksConnectorError, exc)
    databricks_table_summary = _missing_connector_dependency("Databricks", DatabricksConnectorError, exc)

try:
    from postgres_connector import (
        PostgresConnectorError,
        config_from_payload as postgres_config_from_payload,
        fetch_table_rows as postgres_fetch_table_rows,
        list_schemas as postgres_list_schemas,
        list_tables as postgres_list_tables,
        preview_table as postgres_preview_table,
        test_connection as postgres_test_connection,
    )
except Exception as exc:
    class PostgresConnectorError(Exception):
        pass

    postgres_config_from_payload = _missing_connector_dependency("PostgreSQL", PostgresConnectorError, exc)
    postgres_fetch_table_rows = _missing_connector_dependency("PostgreSQL", PostgresConnectorError, exc)
    postgres_list_schemas = _missing_connector_dependency("PostgreSQL", PostgresConnectorError, exc)
    postgres_list_tables = _missing_connector_dependency("PostgreSQL", PostgresConnectorError, exc)
    postgres_preview_table = _missing_connector_dependency("PostgreSQL", PostgresConnectorError, exc)
    postgres_test_connection = _missing_connector_dependency("PostgreSQL", PostgresConnectorError, exc)

try:
    from mysql_connector import (
        MySQLConnectorError,
        config_from_payload as mysql_config_from_payload,
        fetch_table_rows as mysql_fetch_table_rows,
        list_schemas as mysql_list_schemas,
        list_tables as mysql_list_tables,
        preview_table as mysql_preview_table,
        test_connection as mysql_test_connection,
    )
except Exception as exc:
    class MySQLConnectorError(Exception):
        pass

    mysql_config_from_payload = _missing_connector_dependency("MySQL", MySQLConnectorError, exc)
    mysql_fetch_table_rows = _missing_connector_dependency("MySQL", MySQLConnectorError, exc)
    mysql_list_schemas = _missing_connector_dependency("MySQL", MySQLConnectorError, exc)
    mysql_list_tables = _missing_connector_dependency("MySQL", MySQLConnectorError, exc)
    mysql_preview_table = _missing_connector_dependency("MySQL", MySQLConnectorError, exc)
    mysql_test_connection = _missing_connector_dependency("MySQL", MySQLConnectorError, exc)

try:
    from rest_api_connector import (
        RestAPIConnectorError,
        config_from_payload as rest_api_config_from_payload,
        fetch_endpoint_rows as rest_api_fetch_endpoint_rows,
        list_endpoints as rest_api_list_endpoints,
        preview_endpoint as rest_api_preview_endpoint,
        test_connection as rest_api_test_connection,
    )
except Exception as exc:
    class RestAPIConnectorError(Exception):
        pass

    rest_api_config_from_payload = _missing_connector_dependency("REST API", RestAPIConnectorError, exc)
    rest_api_fetch_endpoint_rows = _missing_connector_dependency("REST API", RestAPIConnectorError, exc)
    rest_api_list_endpoints = _missing_connector_dependency("REST API", RestAPIConnectorError, exc)
    rest_api_preview_endpoint = _missing_connector_dependency("REST API", RestAPIConnectorError, exc)
    rest_api_test_connection = _missing_connector_dependency("REST API", RestAPIConnectorError, exc)

try:
    from azure_blob_connector import (
        AzureBlobConnectorError,
        config_from_payload as azure_blob_config_from_payload,
        fetch_object_rows as azure_blob_fetch_object_rows,
        list_objects as azure_blob_list_objects,
        preview_object as azure_blob_preview_object,
        test_connection as azure_blob_test_connection,
    )
except Exception as exc:
    class AzureBlobConnectorError(Exception):
        pass

    azure_blob_config_from_payload = _missing_connector_dependency("Azure Blob", AzureBlobConnectorError, exc)
    azure_blob_fetch_object_rows = _missing_connector_dependency("Azure Blob", AzureBlobConnectorError, exc)
    azure_blob_list_objects = _missing_connector_dependency("Azure Blob", AzureBlobConnectorError, exc)
    azure_blob_preview_object = _missing_connector_dependency("Azure Blob", AzureBlobConnectorError, exc)
    azure_blob_test_connection = _missing_connector_dependency("Azure Blob", AzureBlobConnectorError, exc)

try:
    from s3_connector import (
        S3ConnectorError,
        config_from_payload as s3_config_from_payload,
        fetch_object_rows as s3_fetch_object_rows,
        list_objects as s3_list_objects,
        preview_object as s3_preview_object,
        test_connection as s3_test_connection,
    )
except Exception as exc:
    class S3ConnectorError(Exception):
        pass

    s3_config_from_payload = _missing_connector_dependency("Amazon S3", S3ConnectorError, exc)
    s3_fetch_object_rows = _missing_connector_dependency("Amazon S3", S3ConnectorError, exc)
    s3_list_objects = _missing_connector_dependency("Amazon S3", S3ConnectorError, exc)
    s3_preview_object = _missing_connector_dependency("Amazon S3", S3ConnectorError, exc)
    s3_test_connection = _missing_connector_dependency("Amazon S3", S3ConnectorError, exc)

try:
    from databricks_uc_io import (
        DatabricksDataAccessError,
        clear_uc_read_caches,
        read_cluster_complete_customer_profile_page_df,
        read_table_page_df,
        read_table_sample_df,
        read_table_where_in_df,
        search_table_df,
        table_columns,
        table_row_count,
        tables_fast_metadata,
        uc_enabled,
    )
except Exception:
    DatabricksDataAccessError = RuntimeError
    clear_uc_read_caches = None
    table_columns = None
    table_row_count = None
    tables_fast_metadata = None
    read_table_page_df = None
    read_cluster_complete_customer_profile_page_df = None
    read_table_sample_df = None
    read_table_where_in_df = None
    search_table_df = None

    def uc_enabled():
        return False


try:
    from databricks_uc_io import append_existing_table_df, read_existing_table_df
except Exception:
    # Keep the rest of the application importable when the UC auth helpers are
    # unavailable. Authentication fails closed with a controlled 503 response.
    append_existing_table_df = None
    read_existing_table_df = None


sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
_TAGGER_AVAILABLE = True
_tagger_instance = None


def _get_tagger():
    global _TAGGER_AVAILABLE, _tagger_instance
    if _tagger_instance is not None:
        return _tagger_instance
    try:
        from semantic_tagger import SemanticTagger
        _tagger_instance = SemanticTagger()
        return _tagger_instance
    except Exception as e:
        print(f"[WARNING] SemanticTagger not available ({e}). Auto-tagging disabled.")
        _TAGGER_AVAILABLE = False
        return None


# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT = get_directory("legacy_root")
GEN_DIR = get_directory("generated_data")
ENRICHMENT_DIR = get_directory("enrichment")
PRE_DIR = get_directory("preprocessed")
STD_DIR = get_directory("standardized")
GOLDEN_OUTPUT_DIR = get_directory("golden_records_output")
EVALUATION_OUTPUT_DIR = get_directory("evaluation_output")
CLUSTERING_OUTPUT_DIR = get_directory("clustering_output")
MATCHING_OUTPUT_DIR = get_directory("matching_output")
ENHANCED_IDENTITY_CONFIG_DIR = ROOT / "enhanced_identity_config"
_STD_CACHE = None


def _configured_table_path(name):
    path = get_path(name)
    if os.getenv("CODEX_DATA_SOURCE", "local").strip().lower() == "uc":
        return path
    return path.with_suffix(".csv")


BLOCKING_CFG = get_path("blocking_config")
TAG_MAP = get_path("tag_mappings")
SOURCE_PREFS = get_path("source_preferences")
EVAL_REPORT = get_path("evaluation_report")
GOLDEN_SUMMARY = get_path("golden_summary")
GOLDEN_CSV = _configured_table_path("golden_records")
CUSTOMER_PROFILE_EXPORT_CSV = _configured_table_path("customer_profile_export")
ACTIVITY_DETAIL_FIELDS_CSV = _configured_table_path("activity_detail_fields")
SUPERSEDED_CSV = _configured_table_path("superseded_ids")
PROVENANCE_JSON = get_path("provenance")
HOUSEHOLD_CSV = _configured_table_path("household_links")
GROUND_TRUTH = get_path("ground_truth")
DATA_CLASSIFICATION_CFG = get_path("data_classification")
DATA_OVERVIEW_SNAPSHOT = get_path("data_overview_registered_sources")
COPILOT_SEGMENTS_FILE = get_path("copilot_segments")
AI_SEGMENTS_DIR = get_directory("ai_segments")
_DATA_OVERVIEW_SNAPSHOT_LOCK = threading.Lock()




# ---------------------------------------------------------------------------
# Authentication datasets
# ---------------------------------------------------------------------------
# These logical names are resolved through backend/config.yaml. Authentication
# data must never fall back to repository CSV files in a deployed application.
AUTH_USERS_TABLE = "users"
AUTH_SESSIONS_TABLE = "auth_sessions"
AUTH_LOGS_TABLE = "auth_logs"


JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 60


def _jwt_secret_key():
    secret = os.getenv("JWT_SECRET_KEY", "").strip()
    if not secret:
        raise RuntimeError("JWT_SECRET_KEY must be provided by the runtime secret configuration.")
    return secret





# ---------------------------------------------------------------------------
# Cluster source configuration (dynamic: media / sports)
# ---------------------------------------------------------------------------
DEFAULT_CLUSTER_SOURCE = get_default_source()
SUPPORTED_CLUSTER_SOURCES = set(get_supported_sources().keys())
SEGMENT_LIFECYCLE_STORE = SegmentLifecycleStore(
    COPILOT_SEGMENTS_FILE,
    AI_SEGMENTS_DIR,
    default_source=DEFAULT_CLUSTER_SOURCE,
)

source_map = get_payload_value("legacy_runtime.yml", "legacy_runtime", "source_map")


def _source_name_candidates(source_file):
    text = str(source_file or "").strip()
    normalized = text.replace("\\", "/")
    basename = Path(normalized).name
    stem = Path(basename).stem
    candidates = []

    def add(value):
        value = str(value or "").strip()
        if value and value not in candidates:
            candidates.append(value)

    add(text)
    add(normalized)
    add(basename)
    add(stem)

    for value in list(candidates):
        value_stem = Path(str(value).replace("\\", "/")).stem
        for prefix in ("med_", "spt_", "aut_", "auto_", "tel_"):
            if value_stem.startswith(prefix):
                without_prefix = value_stem[len(prefix):]
                add(without_prefix)
                add(f"{without_prefix}.csv")
            else:
                add(f"{prefix}{value_stem}")
                add(f"{prefix}{value_stem}.csv")

    return candidates


@lru_cache(maxsize=256)
def get_source(source_file):
    candidates = {candidate.lower() for candidate in _source_name_candidates(source_file)}
    for _domain, files in (source_map or {}).items():
        if not isinstance(files, dict):
            continue
        lookup = {}
        for key, label in files.items():
            for candidate in _source_name_candidates(key):
                lookup.setdefault(candidate.lower(), label)
        for candidate in candidates:
            if candidate in lookup:
                return lookup[candidate]
    return "Unknown"


def _normalize_cluster_source(source):
    source = (source or DEFAULT_CLUSTER_SOURCE).strip().lower()
    return source if source in SUPPORTED_CLUSTER_SOURCES else DEFAULT_CLUSTER_SOURCE


def _request_source(default=DEFAULT_CLUSTER_SOURCE):
    return _normalize_cluster_source(
        request.args.get("source")
        or request.args.get("source_system")
        or request.args.get("sourceSystem")
        or default
    )


def _enhanced_identity_config_base_path(source):
    src = _normalize_cluster_source(source)
    return ENHANCED_IDENTITY_CONFIG_DIR / f"{src}_identity_config.yaml"


def _enhanced_identity_config_override_path(source):
    src = _normalize_cluster_source(source)
    return ENHANCED_IDENTITY_CONFIG_DIR / f"{src}_identity_config.override.json"


def _enhanced_identity_config_path(source):
    override_path = _enhanced_identity_config_override_path(source)
    if uc_enabled() and override_path.exists():
        return override_path
    return _enhanced_identity_config_base_path(source)


def _use_enhanced_identity(source):
    return _enhanced_identity_config_base_path(source).exists()


def _get_preprocessed_csv(source=None):
    src = _normalize_cluster_source(source)
    scoped = PRE_DIR / src / "all_preprocessed.csv"
    if uc_enabled():
        return scoped
    return scoped if scoped.exists() else PRE_DIR / "all_preprocessed.csv"


def _get_standardized_csv(source=None):
    src = _normalize_cluster_source(source)
    scoped = STD_DIR / src / "all_standardized.csv"
    if uc_enabled():
        return scoped
    return scoped if scoped.exists() else STD_DIR / "all_standardized.csv"


def _get_golden_csv(source=None):
    src = _normalize_cluster_source(source)
    scoped = GOLDEN_OUTPUT_DIR / src / "golden_records.csv"
    if uc_enabled():
        return scoped
    return scoped if scoped.exists() else GOLDEN_CSV


def _get_customer_profile_export_csv(source=None):
    """Return the source-scoped customer-profile export artifact path."""
    src = _normalize_cluster_source(source)
    return GOLDEN_OUTPUT_DIR / src / "customer_profile_export.csv"


def _get_superseded_csv(source=None):
    src = _normalize_cluster_source(source)
    scoped = GOLDEN_OUTPUT_DIR / src / "superseded_ids.csv"
    if uc_enabled():
        return scoped
    return scoped if scoped.exists() else SUPERSEDED_CSV


def _get_provenance_json(source=None):
    src = _normalize_cluster_source(source)
    scoped = GOLDEN_OUTPUT_DIR / src / "golden_record_provenance.json"
    if uc_enabled():
        return scoped
    return scoped if scoped.exists() else PROVENANCE_JSON


def _get_evaluation_report(source=None):
    src = _normalize_cluster_source(source)
    scoped = EVALUATION_OUTPUT_DIR / src / "evaluation_report.json"
    if uc_enabled():
        return scoped
    return scoped if scoped.exists() else EVAL_REPORT


def _get_golden_summary(source=None):
    src = _normalize_cluster_source(source)
    scoped = GOLDEN_OUTPUT_DIR / src / "golden_record_summary.json"
    if uc_enabled():
        return scoped
    return scoped if scoped.exists() else GOLDEN_SUMMARY


def _file_signature(*paths):
    signature = []
    for path in paths:
        try:
            stat = Path(path).stat()
            signature.append((str(path), stat.st_mtime_ns, stat.st_size))
        except OSError:
            signature.append((str(path), 0, 0))
    return tuple(signature)


def _indexed_cluster_nodes(source, cluster_id):
    db_path = _get_cluster_index_db(source)
    if not db_path.exists():
        return []
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT payload FROM cluster_nodes WHERE cluster_id = ? ORDER BY record_id",
                (cluster_id,),
            ).fetchall()
        return [json.loads(row["payload"]) for row in rows]
    except Exception:
        return []


def _indexed_cluster_list(source):
    db_path = _get_cluster_index_db(source)
    if not db_path.exists():
        return None
    try:
        with sqlite3.connect(db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                """
                SELECT cluster_id, unique_node_count, source_count, sample_email, sample_name
                FROM clusters
                ORDER BY source_count DESC, unique_node_count DESC, cluster_id
                """
            ).fetchall()
        return [
            {
                "cluster_id": row["cluster_id"],
                "size": row["unique_node_count"],
                "sample_email": row["sample_email"] or "",
                "sample_name": row["sample_name"] or "",
                "golden_id": row["cluster_id"].replace("-CL-", "-GR-"),
                "household_id": "",
                "source_count": row["source_count"],
                "edge_count": 0,
                "tier_variety": 0,
            }
            for row in rows
        ]
    except Exception:
        return None


def _get_clustered_csv(source=None):
    src = _normalize_cluster_source(source)
    return CLUSTERING_OUTPUT_DIR / src / "clustered_records.csv"


def _get_cluster_summary(source=None):
    src = _normalize_cluster_source(source)
    return CLUSTERING_OUTPUT_DIR / src / "cluster_summary.json"


def _get_cluster_index(source=None):
    src = _normalize_cluster_source(source)
    return CLUSTERING_OUTPUT_DIR / src / "cluster_index.json"


def _get_cluster_index_db(source=None):
    src = _normalize_cluster_source(source)
    return CLUSTERING_OUTPUT_DIR / src / "cluster_index.sqlite"


# Keep default paths for any legacy/default usage
CLUSTER_SUMMARY = _get_cluster_summary(DEFAULT_CLUSTER_SOURCE)
CLUSTERED_CSV = _get_clustered_csv(DEFAULT_CLUSTER_SOURCE)

def _get_candidate_pairs_csv(source=None):
    src = _normalize_cluster_source(source)
    return MATCHING_OUTPUT_DIR / src / "candidate_pairs.csv"


def _get_household_links_csv(source=None):
    src = _normalize_cluster_source(source)
    return CLUSTERING_OUTPUT_DIR / src / "household_links.csv"


CANDIDATE_PAIRS =  _get_candidate_pairs_csv(DEFAULT_CLUSTER_SOURCE)
_AUTOMOTIVE_GRAPH_CACHE = None
_TELECOM_GRAPH_CACHE = None
_AUTOMOTIVE_CONTEXT_CACHE = None
_CLUSTER_LIST_CACHE = {}


def _norm_identity_value(value):
    return str(value or "").strip().upper()


def _raw_record_id(row, source_name, index):
    for key in row.keys():
        if key.endswith("_id") and row.get(key):
            return str(row.get(key)).strip()
    return f"{Path(source_name).stem.upper()}-{index:06d}"


def _automotive_source_files():
    files = []
    if GEN_DIR.exists():
        files.extend(p for p in GEN_DIR.glob("aut_*.csv") if p.is_file())
    auto_dir = GEN_DIR / "automotive"
    if auto_dir.exists():
        files.extend(p for p in auto_dir.glob("aut_*.csv") if p.is_file())
    return sorted(files)


def _automotive_csv_path(filename):
    for candidate in [GEN_DIR / "automotive" / filename, GEN_DIR / filename]:
        if candidate.exists():
            return candidate
    return GEN_DIR / "automotive" / filename


def _automotive_customer_context():
    global _AUTOMOTIVE_CONTEXT_CACHE
    if _AUTOMOTIVE_CONTEXT_CACHE is not None:
        return _AUTOMOTIVE_CONTEXT_CACHE

    profiles = {}
    vehicle_owner = {}

    def profile_for(customer_id):
        customer_id = _norm_identity_value(customer_id)
        if not customer_id:
            return None
        return profiles.setdefault(customer_id, {"customer_id": customer_id})

    customers_csv = _automotive_csv_path("aut_customers.csv")
    if customers_csv.exists():
        with open(customers_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                profile = profile_for(row.get("customer_id"))
                if not profile:
                    continue
                first_name = _first_value(row, ["first_name", "given_name"])
                last_name = _first_value(row, ["last_name", "surname", "family_name"])
                full_name = _first_value(row, ["full_name", "name"]) or " ".join(
                    part for part in [first_name, last_name] if part
                )
                profile.update(
                    {
                        "first_name": first_name,
                        "last_name": last_name,
                        "full_name": full_name,
                        "name": full_name,
                        "date_of_birth": _first_value(row, ["date_of_birth", "birth_date", "dob"]),
                        "household_id": _first_value(row, ["household_id"]),
                        "city": _first_value(row, ["primary_city", "city"]),
                        "state": _first_value(row, ["primary_state_province", "state"]),
                    }
                )

    contacts_csv = _automotive_csv_path("aut_customer_contacts.csv")
    if contacts_csv.exists():
        with open(contacts_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                profile = profile_for(row.get("customer_id"))
                if not profile:
                    continue
                contact_type = str(row.get("contact_type", "")).strip().lower()
                contact_value = str(row.get("contact_value", "")).strip()
                if not contact_value:
                    continue
                if "email" in contact_type and not profile.get("email"):
                    profile["email"] = _normalize_demo_email(
                        contact_value,
                        profile.get("first_name", ""),
                        profile.get("last_name", ""),
                        profile.get("customer_id", ""),
                    )
                elif "phone" in contact_type and not profile.get("phone"):
                    profile["phone"] = _normalize_demo_phone(contact_value)

    addresses_csv = _automotive_csv_path("aut_customer_addresses.csv")
    if addresses_csv.exists():
        with open(addresses_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                profile = profile_for(row.get("customer_id"))
                if not profile:
                    continue
                is_primary = str(row.get("is_primary", "")).strip().lower() in {"true", "1", "yes", "y"}
                if profile.get("address") and not is_primary:
                    continue
                profile.update(
                    {
                        "address": _first_value(row, ["line1", "address", "address_line1"]),
                        "city": _first_value(row, ["city"]) or profile.get("city", ""),
                        "state": _first_value(row, ["state_province", "state"]) or profile.get("state", ""),
                        "zip": _first_value(row, ["postal_code", "zip"]) or profile.get("zip", ""),
                    }
                )

    ownership_csv = _automotive_csv_path("aut_vehicle_ownership.csv")
    if ownership_csv.exists():
        with open(ownership_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                vehicle_id = _norm_identity_value(row.get("vehicle_id"))
                customer_id = _norm_identity_value(row.get("customer_id"))
                if not vehicle_id or not customer_id:
                    continue
                is_current = str(row.get("is_current_owner", "")).strip().lower() in {"true", "1", "yes", "y"}
                if is_current or vehicle_id not in vehicle_owner:
                    vehicle_owner[vehicle_id] = customer_id

    _AUTOMOTIVE_CONTEXT_CACHE = (profiles, vehicle_owner)
    return _AUTOMOTIVE_CONTEXT_CACHE


def _merge_missing_identity_fields(node, profile):
    if not profile:
        return node
    for key in [
        "customer_id",
        "email",
        "phone",
        "first_name",
        "last_name",
        "full_name",
        "name",
        "date_of_birth",
        "address",
        "city",
        "state",
        "zip",
        "household_id",
    ]:
        if not node.get(key) and profile.get(key):
            node[key] = profile[key]
    return node


def _enrich_automotive_node(node, customer_profiles, vehicle_owner):
    customer_id = _norm_identity_value(node.get("customer_id"))
    vehicle_id = _norm_identity_value(node.get("vehicle_id") or node.get("device_id"))

    if not customer_id and vehicle_id:
        customer_id = vehicle_owner.get(vehicle_id, "")
        if customer_id:
            node["customer_id"] = customer_id

    profile = customer_profiles.get(customer_id)
    return _merge_missing_identity_fields(node, profile)


def _automotive_node(row, source_file, index):
    rid = _raw_record_id(row, source_file, index)
    first_name = _first_value(row, ["first_name", "given_name"])
    last_name = _first_value(row, ["last_name", "surname", "family_name"])
    full_name = _first_value(row, ["full_name", "name"]) or " ".join(p for p in [first_name, last_name] if p)
    rel_source = source_file.replace("\\", "/")
    vehicle_id = _first_value(row, ["vehicle_id", "vin"])

    return {
        "id": rid,
        "source_record_id": rid,
        "source": _source_display_name(rel_source),
        "source_label": _source_display_name(rel_source),
        "source_file": rel_source,
        "customer_id": _first_value(row, ["customer_id"]),
        "fan_id": "",
        "account_id": _first_value(row, ["account_id", "loyalty_account_id"]),
        "loyalty_id": _first_value(row, ["loyalty_id", "loyalty_account_id"]),
        "email": _first_value(row, ["email", "contact_email"]),
        "phone": _first_value(row, ["phone", "contact_phone"]),
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "name": full_name,
        "date_of_birth": _first_value(row, ["date_of_birth", "birth_date", "dob"]),
        "zip": _first_value(row, ["zip", "postal_code"]),
        "address": _first_value(row, ["address", "address_line1", "line1"]),
        "city": _first_value(row, ["city", "primary_city"]),
        "state": _first_value(row, ["state", "state_province", "primary_state_province"]),
        "vehicle_id": vehicle_id,
        "device_id": _first_value(row, ["device_id"]) or vehicle_id,
        "ip_address": _first_value(row, ["ip_address"]),
        "household_id": _first_value(row, ["household_id"]),
    }


def _automotive_graph_data():
    global _AUTOMOTIVE_GRAPH_CACHE
    if _AUTOMOTIVE_GRAPH_CACHE is not None:
        return _AUTOMOTIVE_GRAPH_CACHE

    nodes = []
    key_groups = {}
    customer_profiles, vehicle_owner = _automotive_customer_context()

    def add_key(key, node_id):
        if not key:
            return
        value = key.split(":", 1)[1] if ":" in key else key
        if not value or ("||" in value and any(not part for part in value.split("||"))):
            return
        key_groups.setdefault(key, []).append(node_id)

    for path in _automotive_source_files():
        rel_source = path.relative_to(GEN_DIR).as_posix()
        try:
            with open(path, "r", encoding="utf-8") as f:
                for idx, row in enumerate(csv.DictReader(f), start=1):
                    node = _automotive_node(row, rel_source, idx)
                    node = _enrich_automotive_node(node, customer_profiles, vehicle_owner)
                    nodes.append(node)
                    name = _norm_identity_value(node.get("full_name"))
                    dob = _norm_identity_value(node.get("date_of_birth"))
                    zip_code = _norm_identity_value(node.get("zip"))
                    email = _norm_identity_value(node.get("email"))
                    phone = _norm_identity_value(node.get("phone"))
                    customer_id = _norm_identity_value(node.get("customer_id"))

                    add_key(f"customer_id:{customer_id}", node["id"])
                    add_key(f"email:{email}", node["id"])
                    add_key(f"phone:{phone}", node["id"])
                    add_key(f"email_phone:{email}||{phone}", node["id"])
                    add_key(f"customer_email_phone:{customer_id}||{email}||{phone}", node["id"])
                    add_key(f"name_dob_zip:{name}||{dob}||{zip_code}", node["id"])
                    add_key(f"phone_zip:{phone}||{zip_code}", node["id"])
        except OSError:
            continue

    parent = {node["id"]: node["id"] for node in nodes}

    def find(node_id):
        while parent[node_id] != node_id:
            parent[node_id] = parent[parent[node_id]]
            node_id = parent[node_id]
        return node_id

    def union(a, b):
        root_a, root_b = find(a), find(b)
        if root_a != root_b:
            parent[root_b] = root_a

    edge_map = {}
    strategy_fields = {
        "customer_id": ("customer_id", "exact", 100),
        "email": ("email", "medium", 74),
        "phone": ("phone", "medium", 72),
        "email_phone": ("email|phone", "strong", 88),
        "customer_email_phone": ("customer_id|email|phone", "exact", 96),
        "name_dob_zip": ("full_name|date_of_birth|zip", "strong", 84),
        "phone_zip": ("phone|zip", "strong", 82),
    }

    for key, ids in key_groups.items():
        clean_ids = list(dict.fromkeys(node_id for node_id in ids if node_id in parent))
        if len(clean_ids) < 2:
            continue
        strategy = key.split(":", 1)[0]
        matched_fields, tier, score = strategy_fields.get(strategy, ("", "weak", 60))
        base_id = clean_ids[0]
        for other_id in clean_ids[1:50]:
            union(base_id, other_id)
            edge_key = tuple(sorted([base_id, other_id]))
            if edge_key not in edge_map:
                edge_map[edge_key] = {
                    "source": edge_key[0],
                    "target": edge_key[1],
                    "score": score,
                    "tier": tier,
                    "matched_fields": matched_fields,
                    "blocking_strategy": strategy.replace("_", " ").title(),
                }

    clusters = {}
    for node in nodes:
        root = find(node["id"])
        clusters.setdefault(root, []).append(node)

    cluster_nodes = {}
    node_cluster = {}
    sorted_clusters = sorted(
        [members for members in clusters.values() if len(members) >= 2],
        key=len,
        reverse=True,
    )
    for idx, members in enumerate(sorted_clusters, start=1):
        cluster_id = f"AUT-CL-{idx:06d}"
        cluster_nodes[cluster_id] = members
        for node in members:
            node_cluster[node["id"]] = cluster_id

    cluster_edges = {cid: [] for cid in cluster_nodes}
    for edge in edge_map.values():
        cid = node_cluster.get(edge["source"])
        if cid and cid == node_cluster.get(edge["target"]):
            cluster_edges[cid].append(edge)

    _AUTOMOTIVE_GRAPH_CACHE = {
        "clusters": cluster_nodes,
        "edges": cluster_edges,
    }
    return _AUTOMOTIVE_GRAPH_CACHE


def _telecom_source_files():
    tel_dir = GEN_DIR / "telecom"
    files = []
    if GEN_DIR.exists():
        files.extend(p for p in GEN_DIR.glob("tel_*.csv") if p.is_file())
    if tel_dir.exists():
        files.extend(p for p in tel_dir.glob("tel_*.csv") if p.is_file())
    return sorted(files)


def _telecom_node(row, source_file, index):
    rid = _raw_record_id(row, source_file, index)
    first_name = _first_value(row, ["first_name"])
    last_name = _first_value(row, ["last_name"])
    full_name = _first_value(row, ["full_name"]) or " ".join(p for p in [first_name, last_name] if p)
    rel_source = source_file.replace("\\", "/")

    return {
        "id": rid,
        "source_record_id": rid,
        "source": _source_display_name(rel_source),
        "source_label": _source_display_name(rel_source),
        "source_file": rel_source,
        "customer_id": _first_value(row, ["customer_id"]),
        "fan_id": "",
        "account_id": _first_value(row, ["account_id"]),
        "loyalty_id": _first_value(row, ["loyalty_id"]),
        "email": _first_value(row, ["email", "billing_email"]),
        "phone": _first_value(row, ["phone", "billing_phone"]),
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "name": full_name,
        "date_of_birth": _first_value(row, ["date_of_birth", "birth_date", "dob"]),
        "zip": _first_value(row, ["zip", "billing_zip"]),
        "address": _first_value(row, ["address"]),
        "city": _first_value(row, ["city"]),
        "state": _first_value(row, ["state"]),
        "device_id": _first_value(row, ["device_id"]),
        "ip_address": _first_value(row, ["ip_address"]),
        "household_id": _first_value(row, ["household_id"]),
    }


def _telecom_graph_data():
    global _TELECOM_GRAPH_CACHE
    if _TELECOM_GRAPH_CACHE is not None:
        return _TELECOM_GRAPH_CACHE

    nodes = []
    key_groups = {}

    def add_key(key, node_id):
        if not key:
            return
        value = key.split(":", 1)[1] if ":" in key else key
        if not value or ("||" in value and any(not part for part in value.split("||"))):
            return
        key_groups.setdefault(key, []).append(node_id)

    for path in _telecom_source_files():
        rel_source = path.relative_to(GEN_DIR).as_posix()
        try:
            with open(path, "r", encoding="utf-8") as f:
                for idx, row in enumerate(csv.DictReader(f), start=1):
                    node = _telecom_node(row, rel_source, idx)
                    nodes.append(node)
                    customer_id = _norm_identity_value(node.get("customer_id"))
                    account_id = _norm_identity_value(node.get("account_id"))
                    email = _norm_identity_value(node.get("email"))
                    phone = _norm_identity_value(node.get("phone"))
                    device_id = _norm_identity_value(node.get("device_id"))
                    name = _norm_identity_value(node.get("full_name"))
                    dob = _norm_identity_value(node.get("date_of_birth"))
                    zip_code = _norm_identity_value(node.get("zip"))

                    add_key(f"customer_id:{customer_id}", node["id"])
                    add_key(f"account_id:{account_id}", node["id"])
                    add_key(f"email:{email}", node["id"])
                    add_key(f"phone:{phone}", node["id"])
                    add_key(f"device_id:{device_id}", node["id"])
                    add_key(f"email_phone:{email}||{phone}", node["id"])
                    add_key(f"customer_email_phone:{customer_id}||{email}||{phone}", node["id"])
                    add_key(f"name_dob_zip:{name}||{dob}||{zip_code}", node["id"])
                    add_key(f"phone_zip:{phone}||{zip_code}", node["id"])
        except OSError:
            continue

    parent = {node["id"]: node["id"] for node in nodes}

    def find(node_id):
        while parent[node_id] != node_id:
            parent[node_id] = parent[parent[node_id]]
            node_id = parent[node_id]
        return node_id

    def union(a, b):
        root_a, root_b = find(a), find(b)
        if root_a != root_b:
            parent[root_b] = root_a

    edge_map = {}
    strategy_fields = {
        "customer_id": ("customer_id", "exact", 100),
        "account_id": ("account_id", "strong", 84),
        "email": ("email", "medium", 74),
        "phone": ("phone", "medium", 72),
        "device_id": ("device_id", "weak", 62),
        "email_phone": ("email|phone", "strong", 90),
        "customer_email_phone": ("customer_id|email|phone", "exact", 97),
        "name_dob_zip": ("full_name|date_of_birth|zip", "strong", 86),
        "phone_zip": ("phone|zip", "strong", 82),
    }

    for key, ids in key_groups.items():
        clean_ids = list(dict.fromkeys(node_id for node_id in ids if node_id in parent))
        if len(clean_ids) < 2:
            continue
        strategy = key.split(":", 1)[0]
        matched_fields, tier, score = strategy_fields.get(strategy, ("", "weak", 60))
        base_id = clean_ids[0]
        for other_id in clean_ids[1:60]:
            union(base_id, other_id)
            edge_key = tuple(sorted([base_id, other_id]))
            if edge_key not in edge_map:
                edge_map[edge_key] = {
                    "source": edge_key[0],
                    "target": edge_key[1],
                    "score": score,
                    "tier": tier,
                    "matched_fields": matched_fields,
                    "blocking_strategy": strategy.replace("_", " ").title(),
                }

    clusters = {}
    for node in nodes:
        root = find(node["id"])
        clusters.setdefault(root, []).append(node)

    cluster_nodes = {}
    node_cluster = {}
    sorted_clusters = sorted(
        [members for members in clusters.values() if len(members) >= 2],
        key=len,
        reverse=True,
    )
    for idx, members in enumerate(sorted_clusters, start=1):
        cluster_id = f"TEL-CL-{idx:06d}"
        cluster_nodes[cluster_id] = members
        for node in members:
            node_cluster[node["id"]] = cluster_id

    cluster_edges = {cid: [] for cid in cluster_nodes}
    for edge in edge_map.values():
        cid = node_cluster.get(edge["source"])
        if cid and cid == node_cluster.get(edge["target"]):
            cluster_edges[cid].append(edge)

    _TELECOM_GRAPH_CACHE = {
        "clusters": cluster_nodes,
        "edges": cluster_edges,
    }
    return _TELECOM_GRAPH_CACHE


def _first_value(row, keys):
    for key in keys:
        value = row.get(key, "")
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def _split_name(row):
    first_name = _first_value(row, ["first_name", "given_name"])
    last_name = _first_value(row, ["last_name", "surname", "family_name"])
    full_name = _first_value(row, ["full_name", "name", "profile_name"])

    if (not first_name or not last_name) and full_name:
        parts = full_name.split()
        if not first_name and parts:
            first_name = parts[0]
        if not last_name and len(parts) > 1:
            last_name = " ".join(parts[1:])

    if not full_name:
        full_name = " ".join(p for p in [first_name, last_name] if p)

    return first_name, last_name, full_name


def _identity_node(row):
    first_name, last_name, full_name = _split_name(row)
    source_file = row.get("source_file", "")
    source_system = _source_system_for_file(source_file)
    contact_type = str(row.get("contact_type", "")).strip().lower()
    contact_value = str(row.get("contact_value", "")).strip()
    contact_email = contact_value if "email" in contact_type else ""
    contact_phone = contact_value if "phone" in contact_type else ""
    vehicle_id = _first_value(row, ["vehicle_id", "vin"])
    if source_system == "automotive" and not vehicle_id:
        vehicle_id = _first_value(row, ["device_id"])

    node = {
        "id": row.get("record_id", ""),
        "source_record_id": row.get("record_id", ""),
        "source": get_source(source_file),
        "source_label": get_source(source_file),
        "source_file": source_file,
        "customer_id": _first_value(row, [
            "customer_id", "commerce_customer_id", "subscriber_id",
            "authenticated_user_id", "resolved_profile_id",
        ]),
        "fan_id": _first_value(row, ["fan_id", "linked_fan_account_id", "player_affinity_id"]),
        "account_id": _first_value(row, [
            "account_id", "ticket_account_id", "linked_ticketing_account_id",
            "streaming_account_id", "oauth_user_id", "username", "loyalty_account_id",
        ]),
        "loyalty_id": _first_value(row, ["loyalty_id", "loyalty_member_id", "membership_id", "loyalty_account_id"]),
        "email": _first_value(row, ["email", "email_relay", "contact_email"]) or contact_email,
        "phone": _first_value(row, ["phone", "contact_phone"]) or contact_phone,
        "email_standardized": _first_value(row, ["email_standardized", "cleaned_email"]),
        "phone_standardized": _first_value(row, ["phone_standardized", "normalized_phone"]),
        "first_name": first_name,
        "last_name": last_name,
        "full_name": full_name,
        "name": full_name,
        "date_of_birth": _first_value(row, ["date_of_birth", "dob", "birth_date"]),
        "zip": _first_value(row, ["zip", "shipping_zip", "billing_zip", "postal_code"]),
        "address": _first_value(row, ["address", "shipping_address", "line1", "address_line1"]),
        "address_standardized": _first_value(row, ["address_standardized", "standardized_address"]),
        "city": _first_value(row, ["city", "shipping_city"]),
        "state": _first_value(row, ["state", "state_province", "state_of_residence", "shipping_state"]),
        "vehicle_id": vehicle_id,
        "device_id": _first_value(row, ["device_id", "advertising_id"]) or (vehicle_id if source_system == "automotive" else ""),
        "ip_address": _first_value(row, ["ip_address", "geo_ip"]),
        "household_id": _first_value(row, ["household_id"]),
        "activity_timestamp": _get_activity_timestamp(row),
    }

    if source_system == "automotive":
        customer_profiles, vehicle_owner = _automotive_customer_context()
        node = _enrich_automotive_node(node, customer_profiles, vehicle_owner)
        node["phone"] = _normalize_demo_phone(node.get("phone", ""))
        node["email"] = _normalize_demo_email(
            node.get("email", ""),
            node.get("first_name", ""),
            node.get("last_name", ""),
            node.get("customer_id", ""),
        )

    return node


def _annotate_resolved_node_names(nodes, governed_name=""):
    """Add display-only names from unambiguous peer identity evidence.

    Raw source-level ``name`` and ``full_name`` fields are never overwritten.
    An unnamed node receives ``display_name`` only when exactly one named peer
    in the same graph shares its normalized email, or (secondarily) its
    normalized ten-digit phone number. If raw peers disagree, the governed
    golden-profile name is authoritative. If it is unavailable, one unique
    valid name across the already-resolved identity cluster is the final safe
    display fallback for event-only App and Streaming nodes.
    """
    email_names = {}
    phone_names = {}
    cluster_names = {}

    def email_match_key(node):
        for candidate in (
            node.get("email_standardized"),
            node.get("email"),
        ):
            cleaned = _clean_display_email(candidate)
            if cleaned:
                return cleaned.casefold()
        return ""

    def phone_match_key(node):
        for candidate in (
            node.get("phone_standardized"),
            node.get("phone"),
        ):
            digits = _normalize_identity_phone(candidate)
            if len(digits) != 10:
                continue
            if len(set(digits)) < 3 or digits in {"0123456789", "1234567890"}:
                continue
            return digits
        return ""

    def add_candidate(index, key, name):
        if not key or not name:
            return
        normalized_name = " ".join(str(name).split()).casefold()
        index.setdefault(key, {})[normalized_name] = " ".join(str(name).split())

    for node in nodes or []:
        _first, _last, direct_name = _split_name(node)
        direct_name = _clean_profile_text(direct_name)
        if not direct_name or _looks_like_machine_identity_name(direct_name):
            continue
        email_key = email_match_key(node)
        phone_key = phone_match_key(node)
        add_candidate(email_names, email_key, direct_name)
        if phone_key:
            add_candidate(phone_names, phone_key, direct_name)
        normalized_name = " ".join(str(direct_name).split()).casefold()
        cluster_names[normalized_name] = " ".join(str(direct_name).split())

    cluster_consensus_name = (
        next(iter(cluster_names.values()))
        if len(cluster_names) == 1
        else ""
    )
    governed_display_name = _clean_profile_text(governed_name)
    if _looks_like_machine_identity_name(governed_display_name):
        governed_display_name = ""

    resolved_nodes = []
    for source_node in nodes or []:
        node = dict(source_node)
        _first, _last, direct_name = _split_name(node)
        direct_name = _clean_profile_text(direct_name)
        if direct_name and not _looks_like_machine_identity_name(direct_name):
            node["display_name"] = direct_name
            node["name_resolution"] = "direct"
            resolved_nodes.append(node)
            continue

        email_key = email_match_key(node)
        email_matches = email_names.get(email_key, {}) if email_key else {}
        if len(email_matches) == 1:
            node["display_name"] = next(iter(email_matches.values()))
            node["name_resolution"] = "matched_email"
            resolved_nodes.append(node)
            continue

        phone_key = phone_match_key(node)
        phone_matches = phone_names.get(phone_key, {}) if phone_key else {}
        if len(phone_matches) == 1:
            node["display_name"] = next(iter(phone_matches.values()))
            node["name_resolution"] = "matched_phone"
        elif governed_display_name:
            node["display_name"] = governed_display_name
            node["name_resolution"] = "governed_profile"
        elif cluster_consensus_name:
            node["display_name"] = cluster_consensus_name
            node["name_resolution"] = "cluster_consensus"
        else:
            node["display_name"] = ""
            node["name_resolution"] = "unavailable"
        resolved_nodes.append(node)

    return resolved_nodes


def _first_pipe_value(value):
    for part in str(value or "").split("|"):
        cleaned = part.strip()
        if cleaned:
            return cleaned
    return ""


_PROFILE_PLACEHOLDER_VALUES = {
    "-",
    "—",
    "\u00e2\u20ac\u201d",
    "n/a",
    "na",
    "nan",
    "none",
    "null",
    "not available",
    "unnamed customer",
}


def _clean_profile_text(value):
    """Return an optional profile value without placeholder text."""
    cleaned = str(value or "").strip()
    return "" if cleaned.casefold() in _PROFILE_PLACEHOLDER_VALUES else cleaned


def _clean_display_email(value):
    """Return the first well-formed display email without repairing source data."""
    for raw_candidate in str(value or "").split("|"):
        candidate = _clean_profile_text(raw_candidate)
        if not candidate or len(candidate) > 254 or candidate.count("@") != 1:
            continue
        local, domain = candidate.rsplit("@", 1)
        if not local or not domain or "." not in domain or any(ch.isspace() for ch in candidate):
            continue
        if domain.startswith((".", "-")) or domain.endswith((".", "-")):
            continue
        if not re.fullmatch(
            r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+",
            candidate,
        ):
            continue
        return candidate
    return ""


def _looks_like_machine_identity_name(value):
    """Detect names previously inferred from DT/device identifier tokens."""
    words = _clean_profile_text(value).split()
    if len(words) < 2 or words[0].casefold() not in {"dt", "device"}:
        return False
    tail = "".join(words[1:]).casefold()
    return len(tail) >= 8 and all(ch in "0123456789abcdef" for ch in tail)


def _sanitize_profile_identity(row, source=None, clean_email=True):
    """Clean display identity fields while preserving genuine source absence."""
    source = _normalize_cluster_source(
        source or row.get("source_system") or DEFAULT_CLUSTER_SOURCE
    )
    cleaned = dict(row or {})

    if clean_email:
        cleaned["email"] = _clean_display_email(
            "|".join(
                value
                for value in (
                    str(cleaned.get("email") or ""),
                    str(cleaned.get("all_emails") or ""),
                )
                if value
            )
        )

    for field in ("full_name", "name", "profile_name", "first_name", "last_name"):
        if field in cleaned:
            cleaned[field] = _clean_profile_text(cleaned.get(field))

    for field in ("full_name", "name", "profile_name"):
        if _looks_like_machine_identity_name(cleaned.get(field)):
            cleaned[field] = ""

    joined_name = " ".join(
        value
        for value in (
            _clean_profile_text(cleaned.get("first_name")),
            _clean_profile_text(cleaned.get("last_name")),
        )
        if value
    )
    if _looks_like_machine_identity_name(joined_name):
        cleaned["first_name"] = ""
        cleaned["last_name"] = ""

    return cleaned


def _profile_identity_is_limited(row):
    """Return true when no readable name or contact survives sanitization."""
    return not any(
        _clean_profile_text(row.get(field))
        for field in (
            "full_name",
            "first_name",
            "last_name",
            "email",
            "phone",
        )
    )


def _normalize_demo_phone(value):
    raw = str(value or "").strip()
    if not raw:
        return ""

    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]

    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"

    # Some generated automotive contacts are +1-AAA-NNNN (7 local digits).
    # Keep the area/line values but synthesize a realistic exchange for display.
    if len(digits) == 8 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) == 7:
        area = digits[:3]
        line = digits[3:]
        exchange = 200 + (int(line or "0") % 700)
        return f"{area}-{exchange:03d}-{line}"

    return raw


def _email_token(value):
    return "".join(ch.lower() for ch in str(value or "") if ch.isalnum())


def _normalize_demo_email(value, first_name="", last_name="", customer_id=""):
    raw = _clean_profile_text(value)
    if not raw:
        return ""

    lower = raw.lower()
    local, domain = lower.split("@", 1) if "@" in lower else (lower, "")
    common_domains = {
        "gmail.ca": "gmail.com",
        "outlook.ca": "outlook.com",
        "hotmail.ca": "hotmail.com",
        "yahoo.ca": "yahoo.com",
        "icloud.ca": "icloud.com",
    }
    domain = common_domains.get(domain, domain)

    first = _email_token(first_name)
    last = _email_token(last_name)
    digits = "".join(ch for ch in str(customer_id or local) if ch.isdigit())
    suffix = digits[-2:] if digits else ""

    if local.startswith("cust") and first and last:
        domain_pool = ["gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "icloud.com"]
        domain = domain_pool[int(suffix or "0") % len(domain_pool)]
        return _clean_display_email(f"{first}.{last}{suffix}@{domain}")
    if local.startswith("cust"):
        return ""

    return _clean_display_email(f"{local}@{domain}" if domain else "")


def _normalize_golden_row(row, source=None):
    source = _normalize_cluster_source(source or row.get("source_system") or DEFAULT_CLUSTER_SOURCE)
    normalized = dict(row)

    if source == "automotive":
        customer_profiles, _vehicle_owner = _automotive_customer_context()
        profile = customer_profiles.get(normalized.get("customer_id", ""))
        if profile:
            _merge_missing_identity_fields(normalized, profile)

    if not normalized.get("email"):
        normalized["email"] = _first_pipe_value(normalized.get("all_emails", ""))
    if not normalized.get("phone"):
        normalized["phone"] = _first_pipe_value(normalized.get("all_phones", ""))
    if source == "automotive" and normalized.get("phone"):
        normalized["phone"] = _normalize_demo_phone(normalized.get("phone", ""))
    if not normalized.get("full_name"):
        normalized["full_name"] = _first_pipe_value(normalized.get("all_names", ""))

    normalized = _sanitize_profile_identity(
        normalized,
        source,
        clean_email=source != "automotive",
    )
    first_name, last_name, full_name = _split_name(normalized)
    normalized["first_name"] = normalized.get("first_name") or first_name
    normalized["last_name"] = normalized.get("last_name") or last_name
    normalized["full_name"] = full_name
    normalized["name"] = full_name

    if source == "automotive" and normalized.get("email"):
        normalized["email"] = _normalize_demo_email(
            normalized.get("email", ""),
            normalized.get("first_name", ""),
            normalized.get("last_name", ""),
            normalized.get("customer_id", ""),
        )

    normalized = _sanitize_profile_identity(normalized, source, clean_email=True)

    dob = normalized.get("date_of_birth") or normalized.get("dob") or ""
    normalized["date_of_birth"] = dob
    normalized["dob"] = normalized.get("dob") or dob

    return normalized


def _first_cluster_value(cluster_rows, *field_names):
    """Return the first non-empty source value without inventing an attribute."""
    for field_name in field_names:
        for row in cluster_rows:
            value = str(row.get(field_name) or "").strip()
            if value:
                return value
    return ""


def _synthesize_cluster_profile_row(cluster_id, cluster_rows, source):
    """Build a limited-attribute profile for a cluster absent from golden CSV."""
    source = _normalize_cluster_source(source)
    source_files = sorted(
        {
            str(row.get("source_file") or "").strip()
            for row in cluster_rows
            if str(row.get("source_file") or "").strip()
        }
    )
    first_name = _first_cluster_value(cluster_rows, "first_name")
    last_name = _first_cluster_value(cluster_rows, "last_name")
    full_name = _first_cluster_value(cluster_rows, "full_name", "profile_name")
    if not full_name:
        full_name = " ".join(value for value in (first_name, last_name) if value).strip()

    row = {
        "cluster_id": cluster_id,
        "golden_id": str(cluster_id).replace("-CL-", "-GR-"),
        "source_system": source,
        "full_name": full_name,
        "first_name": first_name,
        "last_name": last_name,
        "email": _first_cluster_value(cluster_rows, "email"),
        "phone": _first_cluster_value(cluster_rows, "phone"),
        "address": _first_cluster_value(
            cluster_rows, "address", "line1", "shipping_address"
        ),
        "city": _first_cluster_value(cluster_rows, "city", "shipping_city"),
        "state": _first_cluster_value(
            cluster_rows, "state", "state_of_residence", "shipping_state"
        ),
        "zip": _first_cluster_value(cluster_rows, "zip", "shipping_zip"),
        "dob": _first_cluster_value(cluster_rows, "dob"),
        "household_id": _first_cluster_value(cluster_rows, "household_id"),
        "customer_id": _first_cluster_value(cluster_rows, "customer_id"),
        "account_id": _first_cluster_value(
            cluster_rows, "account_id", "ticket_account_id"
        ),
        "loyalty_id": _first_cluster_value(cluster_rows, "loyalty_id"),
        "fan_account_id": _first_cluster_value(cluster_rows, "fan_account_id"),
        "ticketing_account_id": _first_cluster_value(
            cluster_rows, "ticketing_account_id", "ticket_account_id"
        ),
        "loyalty_member_id": _first_cluster_value(
            cluster_rows, "loyalty_member_id"
        ),
        "commerce_customer_id": _first_cluster_value(
            cluster_rows, "commerce_customer_id"
        ),
        "streaming_account_id": _first_cluster_value(
            cluster_rows, "streaming_account_id"
        ),
        "authenticated_user_id": _first_cluster_value(
            cluster_rows, "authenticated_user_id"
        ),
        "resolved_profile_id": _first_cluster_value(
            cluster_rows, "resolved_profile_id"
        ),
        "username": _first_cluster_value(cluster_rows, "username"),
        "device_id": _first_cluster_value(cluster_rows, "device_id"),
        "subscription_tier": _first_cluster_value(
            cluster_rows, "subscription_tier", "subscription_tier_code"
        ),
        "membership_tier": _first_cluster_value(cluster_rows, "membership_tier"),
        "record_count": len(cluster_rows),
        "diversity_score": len(source_files),
        "source_files": "|".join(source_files),
        "all_emails": _first_cluster_value(cluster_rows, "email"),
        "all_phones": _first_cluster_value(cluster_rows, "phone"),
        "all_names": full_name,
        "all_devices": _first_cluster_value(cluster_rows, "device_id"),
        "profile_scope": "cluster_singleton",
        "limited_attributes": True,
    }
    return _normalize_golden_row(row, source)


def _complete_golden_profile_rows(source=None, cluster_rows_by_id=None):
    """Return one profile row for every source-scoped identity cluster."""
    source = _normalize_cluster_source(source)
    golden_csv = _get_golden_csv(source)
    if cluster_rows_by_id is None:
        cluster_rows_by_id = _load_cluster_rows_by_cluster_id(source)

    rows = []
    represented_clusters = set()
    if golden_csv.exists():
        with open(golden_csv, "r", encoding="utf-8") as handle:
            for raw_row in csv.DictReader(handle):
                row = _normalize_golden_row(raw_row, source)
                cluster_id = str(row.get("cluster_id") or "").strip()
                if not cluster_id or cluster_id in represented_clusters:
                    continue
                cluster_rows = cluster_rows_by_id.get(cluster_id, [])
                if cluster_rows:
                    source_files = sorted(
                        {
                            str(item.get("source_file") or "").strip()
                            for item in cluster_rows
                            if str(item.get("source_file") or "").strip()
                        }
                    )
                    row["record_count"] = len(cluster_rows)
                    row["source_files"] = "|".join(source_files)
                    row["diversity_score"] = len(source_files)
                row["profile_scope"] = "golden_artifact"
                row["limited_attributes"] = False
                rows.append(row)
                represented_clusters.add(cluster_id)

    for cluster_id in sorted(cluster_rows_by_id):
        if cluster_id in represented_clusters:
            continue
        rows.append(
            _synthesize_cluster_profile_row(
                cluster_id,
                cluster_rows_by_id.get(cluster_id, []),
                source,
            )
        )
    return rows

def _find_first_csv_row(path, predicate):
    path = Path(path)
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            if predicate(row):
                return row
    return None


def _automotive_profile_enrichment(golden_record, cluster_rows=None):
    cluster_rows = cluster_rows or []
    customer_id = golden_record.get("customer_id", "") or _first_cluster_value(
        cluster_rows,
        "customer_id",
    )
    vehicle_id = (
        golden_record.get("vehicle_id")
        or _first_cluster_value(cluster_rows, "vehicle_id")
        or golden_record.get("device_id", "")
    )
    if not customer_id and not vehicle_id:
        return None

    if uc_enabled():
        # Customer Profile is an interactive surface. Resolve only the selected
        # customer's keys in Unity Catalog instead of opening whole source
        # tables through the CSV compatibility layer.
        def _uc_rows(table, column_values, limit=25):
            return _uc_lookup_rows(
                table,
                "automotive",
                column_values,
                limit=limit,
            )

        if not vehicle_id and customer_id:
            ownership_rows = _uc_rows(
                "aut_vehicle_ownership",
                {"customer_id": [customer_id]},
                limit=100,
            )
            ownership = next(
                (
                    row
                    for row in ownership_rows
                    if str(row.get("is_current_owner", "") or "").strip().lower()
                    in {"true", "1", "yes", "y"}
                ),
                ownership_rows[0] if ownership_rows else None,
            )
            if ownership:
                vehicle_id = ownership.get("vehicle_id", "")

        profile_keys = {
            "customer_id": [customer_id] if customer_id else [],
            "vehicle_id": [vehicle_id] if vehicle_id else [],
        }
        vehicle_rows = (
            _uc_rows("aut_vehicles", {"vehicle_id": [vehicle_id]})
            if vehicle_id
            else []
        )
        telematics_rows = _uc_rows(
            "aut_telematics_monthly_summary",
            profile_keys,
        )
        loyalty_rows = (
            _uc_rows("aut_loyalty_accounts", {"customer_id": [customer_id]})
            if customer_id
            else []
        )
        service_rows = _uc_rows("aut_service_orders", profile_keys)
        campaign_rows = _uc_rows("aut_campaign_eligibility", profile_keys)
        vehicle = vehicle_rows[0] if vehicle_rows else None
        telematics = telematics_rows[0] if telematics_rows else None
        loyalty = loyalty_rows[0] if loyalty_rows else None
        service = service_rows[0] if service_rows else None
        campaign = campaign_rows[0] if campaign_rows else None
    else:
        if not vehicle_id and customer_id:
            ownership = _find_first_csv_row(
                _source_path("automotive/aut_vehicle_ownership.csv"),
                lambda row: row.get("customer_id") == customer_id and str(row.get("is_current_owner", "")).lower() == "true",
            )
            if ownership:
                vehicle_id = ownership.get("vehicle_id", "")

        vehicle = _find_first_csv_row(
            _source_path("automotive/aut_vehicles.csv"),
            lambda row: row.get("vehicle_id") == vehicle_id,
        )
        telematics = _find_first_csv_row(
            _source_path("automotive/aut_telematics_monthly_summary.csv"),
            lambda row: row.get("customer_id") == customer_id or row.get("vehicle_id") == vehicle_id,
        )
        loyalty = _find_first_csv_row(
            _source_path("automotive/aut_loyalty_accounts.csv"),
            lambda row: row.get("customer_id") == customer_id,
        )
        service = _find_first_csv_row(
            _source_path("automotive/aut_service_orders.csv"),
            lambda row: row.get("customer_id") == customer_id or row.get("vehicle_id") == vehicle_id,
        )
        campaign = _find_first_csv_row(
            _source_path("automotive/aut_campaign_eligibility.csv"),
            lambda row: row.get("customer_id") == customer_id or row.get("vehicle_id") == vehicle_id,
        )

    enrichment = {}
    if vehicle:
        enrichment["vehicle"] = {
            "source": "Vehicle Master",
            "party": "1P",
            "match_key": "vehicle_id",
            "vehicle_id": vehicle.get("vehicle_id"),
            "vin": vehicle.get("vin"),
            "brand": vehicle.get("brand"),
            "model": " ".join(part for part in [vehicle.get("model_year"), vehicle.get("model_name"), vehicle.get("trim")] if part),
            "powertrain": vehicle.get("powertrain_type"),
            "current_mileage": vehicle.get("current_mileage"),
            "vehicle_status": vehicle.get("vehicle_status"),
        }
    if telematics:
        enrichment["telematics"] = {
            "source": "Connected Vehicle",
            "party": "1P",
            "match_key": "customer_id/vehicle_id",
            "safety_score": telematics.get("safety_score"),
            "miles_driven": telematics.get("miles_driven"),
            "trip_count": telematics.get("trip_count"),
            "avg_trip_miles": telematics.get("avg_trip_miles"),
            "hard_brake_count": telematics.get("hard_brake_count"),
            "nighttime_trip_count": telematics.get("nighttime_trip_count"),
        }
    if loyalty:
        enrichment["loyalty"] = {
            "source": "My GM Rewards",
            "party": "1P",
            "match_key": "customer_id",
            "loyalty_account_id": loyalty.get("loyalty_account_id"),
            "program_name": loyalty.get("program_name"),
            "tier": loyalty.get("tier"),
            "points_balance": loyalty.get("points_balance"),
            "lifetime_points": loyalty.get("lifetime_points"),
            "account_status": loyalty.get("account_status"),
        }
    if service:
        enrichment["service"] = {
            "source": "Dealer Service",
            "party": "1P",
            "match_key": "customer_id/vehicle_id",
            "service_order_id": service.get("service_order_id"),
            "opened_date": service.get("opened_date"),
            "ro_status": service.get("ro_status"),
            "odometer": service.get("odometer"),
            "total_amount": service.get("total_amount"),
            "currency_code": service.get("currency_code"),
        }
    if campaign:
        enrichment["campaign"] = {
            "source": "Campaign Eligibility",
            "party": "ML",
            "match_key": "customer_id/vehicle_id",
            "campaign_type": campaign.get("campaign_type"),
            "campaign_id": campaign.get("campaign_id"),
            "eligible_flag": campaign.get("eligible_flag"),
            "eligibility_reason": campaign.get("eligibility_reason"),
            "replacement_scenario": campaign.get("replacement_scenario"),
            "latest_battery_health_pct": campaign.get("latest_battery_health_pct"),
        }

    sections = [
        {
            "key": "vehicle",
            "label": "Vehicle Signals",
            "fields": [
                {"k": "vehicle_id", "l": "Vehicle ID"},
                {"k": "vin", "l": "VIN"},
                {"k": "brand", "l": "Brand"},
                {"k": "model", "l": "Model"},
                {"k": "powertrain", "l": "Powertrain"},
                {"k": "current_mileage", "l": "Mileage"},
                {"k": "vehicle_status", "l": "Status"},
            ],
        },
        {
            "key": "telematics",
            "label": "Connected Vehicle",
            "fields": [
                {"k": "safety_score", "l": "Safety Score"},
                {"k": "miles_driven", "l": "Miles Driven"},
                {"k": "trip_count", "l": "Trips"},
                {"k": "avg_trip_miles", "l": "Avg Trip Miles"},
                {"k": "hard_brake_count", "l": "Hard Brakes"},
                {"k": "nighttime_trip_count", "l": "Night Trips"},
            ],
        },
        {
            "key": "loyalty",
            "label": "Loyalty",
            "fields": [
                {"k": "loyalty_account_id", "l": "Loyalty ID"},
                {"k": "program_name", "l": "Program"},
                {"k": "tier", "l": "Tier"},
                {"k": "points_balance", "l": "Points"},
                {"k": "lifetime_points", "l": "Lifetime Points"},
                {"k": "account_status", "l": "Status"},
            ],
        },
        {
            "key": "service",
            "label": "Service",
            "fields": [
                {"k": "service_order_id", "l": "Service Order"},
                {"k": "opened_date", "l": "Opened"},
                {"k": "ro_status", "l": "Status"},
                {"k": "odometer", "l": "Odometer"},
                {"k": "total_amount", "l": "Amount"},
                {"k": "currency_code", "l": "Currency"},
            ],
        },
        {
            "key": "campaign",
            "label": "Campaign Eligibility",
            "fields": [
                {"k": "campaign_type", "l": "Campaign Type"},
                {"k": "campaign_id", "l": "Campaign ID"},
                {"k": "eligible_flag", "l": "Eligible"},
                {"k": "eligibility_reason", "l": "Reason"},
                {"k": "replacement_scenario", "l": "Scenario"},
                {"k": "latest_battery_health_pct", "l": "Battery Health"},
            ],
        },
    ]

    return {
        "enrichment": enrichment,
        "sections": sections,
        "sources_matched": list(enrichment.keys()),
        "sources_available": [section["key"] for section in sections],
    }


def _golden_id_variants(golden_id):
    """Return source-scoped and legacy forms of a golden-record identifier."""
    normalized = str(golden_id or "").strip().upper()
    variants = []

    def add(value):
        value = str(value or "").strip().upper()
        if value and value not in variants:
            variants.append(value)

    add(normalized)
    marker = normalized.find("GR-")
    if marker >= 0:
        add(normalized[marker:])
    return variants


def _uc_lookup_rows(
    path_or_name,
    source,
    column_values,
    limit=100,
    *,
    raise_on_error=False,
):
    """Run a bounded, indexed-style UC lookup using only columns that exist."""
    if not uc_enabled() or read_table_where_in_df is None or table_columns is None:
        return []
    try:
        available = {
            str(column).strip().lower(): str(column).strip()
            for column in table_columns(path_or_name, source=source)
            if str(column).strip()
        }
        lookup_columns = []
        lookup_values = []
        for requested_column, values in (column_values or {}).items():
            actual_column = available.get(str(requested_column).strip().lower())
            if not actual_column:
                continue
            cleaned_values = [
                str(value).strip()
                for value in (values if isinstance(values, (list, tuple, set)) else [values])
                if str(value or "").strip()
            ]
            if not cleaned_values:
                continue
            lookup_columns.append(actual_column)
            lookup_values.extend(cleaned_values)
        if not lookup_columns or not lookup_values:
            return []
        frame = read_table_where_in_df(
            path_or_name,
            lookup_columns,
            lookup_values,
            source=source,
            limit=limit,
            required=False,
        )
        if frame.empty:
            return []
        return frame.fillna("").to_dict(orient="records")
    except Exception as exc:
        print(
            f"[WARN] Optional UC lookup failed for {path_or_name} "
            f"(source={source}): {exc}",
            flush=True,
        )
        if raise_on_error:
            if isinstance(exc, DatabricksDataAccessError):
                raise
            raise DatabricksDataAccessError(
                f"UC lookup failed for {path_or_name} (source={source})"
            ) from exc
        return []


def _household_member_payload(row, relationship="Household Member"):
    normalized = dict(row or {})
    full_name = _first_value(normalized, ["full_name", "name"]) or " ".join(
        part
        for part in [
            _first_value(normalized, ["first_name"]),
            _first_value(normalized, ["last_name"]),
        ]
        if part
    )
    full_name = _clean_profile_text(full_name)
    if _looks_like_machine_identity_name(full_name):
        full_name = ""
    return {
        "golden_id": _first_value(
            normalized,
            ["golden_id", "household_golden_id", "member_golden_id"],
        ),
        "full_name": full_name,
        "email": _clean_display_email(_first_value(normalized, ["email"])),
        "address": _first_value(normalized, ["address", "address_line1"]),
        "zip": _first_value(normalized, ["zip", "postal_code"]),
        "relationship": _first_value(normalized, ["relationship"]) or relationship,
    }


def _profile_rows_for_cluster_ids(source, cluster_ids):
    """Resolve same-source profile attributes for a bounded set of clusters."""
    source = _normalize_cluster_source(source)
    requested = {
        str(cluster_id or "").strip().upper()
        for cluster_id in cluster_ids or []
        if str(cluster_id or "").strip()
    }
    if not requested:
        return {}

    golden_rows = []
    clustered_rows = []
    if uc_enabled():
        golden_rows = _uc_lookup_rows(
            "golden_records",
            source,
            {"cluster_id": sorted(requested)},
            limit=max(16, len(requested) * 4),
        )
        clustered_rows = _uc_lookup_rows(
            "clustered_records",
            source,
            {"cluster_id": sorted(requested)},
            limit=max(1000, len(requested) * 500),
        )
    else:
        golden_csv = _get_golden_csv(source)
        if golden_csv.exists():
            with open(golden_csv, "r", encoding="utf-8") as handle:
                golden_rows = [
                    row
                    for row in csv.DictReader(handle)
                    if str(row.get("cluster_id") or "").strip().upper() in requested
                ]
        clustered_csv = _get_clustered_csv(source)
        if clustered_csv.exists():
            with open(clustered_csv, "r", encoding="utf-8") as handle:
                clustered_rows = [
                    row
                    for row in csv.DictReader(handle)
                    if str(row.get("cluster_id") or "").strip().upper() in requested
                ]

    rows_by_cluster = {}
    for raw_row in golden_rows:
        row = _normalize_golden_row(raw_row, source)
        cluster_key = str(row.get("cluster_id") or "").strip().upper()
        if cluster_key in requested:
            rows_by_cluster[cluster_key] = row

    clustered_by_id = {}
    for row in clustered_rows:
        cluster_key = str(row.get("cluster_id") or "").strip().upper()
        if cluster_key in requested:
            clustered_by_id.setdefault(cluster_key, []).append(row)

    for cluster_key in requested:
        source_rows = clustered_by_id.get(cluster_key, [])
        if not source_rows:
            continue
        fallback = _synthesize_cluster_profile_row(cluster_key, source_rows, source)
        existing = rows_by_cluster.get(cluster_key)
        if existing is None:
            rows_by_cluster[cluster_key] = fallback
            continue
        for field, value in fallback.items():
            if not str(existing.get(field) or "").strip() and str(value or "").strip():
                existing[field] = value

    return rows_by_cluster


def _profile_metrics_for_profile(source, golden_row, cluster_rows):
    """Return the governed profile-level metrics used across profile APIs.

    The individual profile header and its enrichment response must never derive
    customer value independently. A metric is exposed as ``ltv`` only when the
    selected source has a governed monetary lifetime-value measure. Propensity
    scores and monthly value proxies remain separate enrichment attributes.
    """
    source = _normalize_cluster_source(source)
    metrics = {
        "ltv_available": False,
        "ltv_source_system": source,
    }

    if source == "sports":
        seen_transactions = set()
        realized_ltv = 0.0
        ticket_value = 0.0
        commerce_value = 0.0
        transaction_count = 0
        excluded_transaction_count = 0
        excluded_commerce_statuses = {
            "CANCELLED",
            "RETURNED",
            "REFUNDED",
            "VOIDED",
        }

        for index, row in enumerate(cluster_rows or []):
            source_file = str(row.get("source_file") or "").strip()
            if source_file not in {
                "spt_ticket_orders.csv",
                "spt_commerce_orders.csv",
            }:
                continue

            record_id = str(row.get("record_id") or "").strip() or f"row-{index}"
            transaction_key = f"{source_file}|{record_id}"
            if transaction_key in seen_transactions:
                continue
            seen_transactions.add(transaction_key)

            if source_file == "spt_ticket_orders.csv":
                try:
                    value = float(row.get("transaction_amount"))
                except (TypeError, ValueError):
                    value = 0.0
                if value > 0:
                    ticket_value += value
                    realized_ltv += value
                    transaction_count += 1
                else:
                    excluded_transaction_count += 1
                continue

            status = str(row.get("order_status_code") or "").strip().upper()
            try:
                value = float(row.get("order_total_amount"))
            except (TypeError, ValueError):
                value = 0.0
            if status not in excluded_commerce_statuses and value > 0:
                commerce_value += value
                realized_ltv += value
                transaction_count += 1
            else:
                excluded_transaction_count += 1

        if realized_ltv > 0:
            metrics.update(
                {
                    "ltv": round(realized_ltv, 2),
                    "ltv_available": True,
                    "ltv_label": "Historical Realized Customer Lifetime Value",
                    "ltv_basis": "historical_realized",
                    "ltv_currency": "USD",
                    "ltv_source": "Ticket Orders and Commerce Orders",
                    "ltv_transaction_count": transaction_count,
                    "ltv_excluded_transaction_count": excluded_transaction_count,
                    "ltv_source_totals": {
                        "Ticket Orders": round(ticket_value, 2),
                        "Commerce Orders": round(commerce_value, 2),
                    },
                    "ltv_formula": (
                        "Sum of positive linked Ticket Order transaction amounts "
                        "plus positive linked Commerce Order totals after excluding "
                        "returned, cancelled, refunded, and voided orders. Each "
                        "source transaction is counted once."
                    ),
                }
            )
        else:
            metrics["ltv_unavailable_reason"] = (
                "No qualifying linked ticket or commerce transaction is available "
                "for this customer profile."
            )
        return metrics

    if source == "automotive" and golden_row:
        customer_id = str(golden_row.get("customer_id") or "").strip()
        if customer_id and uc_enabled():
            customer_rows = _uc_lookup_rows(
                "aut_customers",
                "automotive",
                {"customer_id": [customer_id]},
                limit=1,
            )
            customer_row = customer_rows[0] if customer_rows else None
        else:
            customer_row = (
                _find_first_csv_row(
                    ROOT / "generated_data" / "automotive" / "aut_customers.csv",
                    lambda row: str(row.get("customer_id") or "").strip()
                    == customer_id,
                )
                if customer_id
                else None
            )
        if customer_row:
            try:
                estimated_clv = float(customer_row.get("estimated_clv"))
            except (TypeError, ValueError):
                estimated_clv = None
            if estimated_clv is not None and estimated_clv >= 0:
                metrics.update(
                    {
                        "ltv": round(estimated_clv, 2),
                        "ltv_available": True,
                        "ltv_label": "Estimated Customer Lifetime Value",
                        "ltv_basis": "estimated_clv",
                        "ltv_currency": "USD",
                        "ltv_source": "Customer Value Master",
                        "ltv_source_field": "estimated_clv",
                        "ltv_formula": (
                            "Profile-level estimated CLV supplied by the governed "
                            "Customer Value Master and joined by customer ID; no "
                            "additional value is inferred in reporting."
                        ),
                    }
                )
                return metrics
        metrics["ltv_unavailable_reason"] = (
            "No governed estimated CLV is linked to this customer profile."
        )
        return metrics

    metrics["ltv_unavailable_reason"] = (
        "This source does not provide a governed monetary lifetime-value field. "
        "Propensity scores and monthly value proxies are not relabelled as LTV."
    )
    return metrics


def _profile_context_for_golden_id(source, golden_id):
    """Load one profile and its cluster without scanning the full cluster estate.

    The SQLite cluster index is the production read path. CSV scanning remains a
    compatibility fallback for environments where the index has not yet been
    generated.
    """
    source = _normalize_cluster_source(source)
    golden_id = str(golden_id or "").strip().upper()
    if uc_enabled():
        golden_matches = _uc_lookup_rows(
            "golden_records",
            source,
            {"golden_id": _golden_id_variants(golden_id)},
            limit=1,
        )
        golden_row = (
            _normalize_golden_row(golden_matches[0], source)
            if golden_matches
            else None
        )
        cluster_id = str((golden_row or {}).get("cluster_id") or "").strip()
        if not cluster_id:
            cluster_id = golden_id.replace("-GR-", "-CL-")
        cluster_rows = _uc_lookup_rows(
            "clustered_records",
            source,
            {"cluster_id": [cluster_id]},
            limit=10000,
        )
        if golden_row is None and cluster_rows:
            golden_row = _synthesize_cluster_profile_row(
                cluster_id,
                cluster_rows,
                source,
            )
        return golden_row, cluster_id, cluster_rows

    golden_csv = _get_golden_csv(source)
    golden_row = None
    cluster_id = ""

    if golden_csv.exists():
        with open(golden_csv, "r", encoding="utf-8") as handle:
            for raw_row in csv.DictReader(handle):
                if str(raw_row.get("golden_id") or "").strip().upper() != golden_id:
                    continue
                golden_row = _normalize_golden_row(raw_row, source)
                cluster_id = str(raw_row.get("cluster_id") or "").strip()
                break

    if not cluster_id:
        cluster_id = golden_id.replace("-GR-", "-CL-")

    clustered_csv = _get_clustered_csv(source)
    cluster_index = _get_cluster_index_db(source)
    index_is_current = cluster_index.exists() and (
        not clustered_csv.exists()
        or cluster_index.stat().st_mtime_ns >= clustered_csv.stat().st_mtime_ns
    )
    cluster_rows = (
        _indexed_cluster_nodes(source, cluster_id)
        if index_is_current
        else []
    )
    if not cluster_rows:
        if clustered_csv.exists():
            with open(clustered_csv, "r", encoding="utf-8") as handle:
                cluster_rows = [
                    row
                    for row in csv.DictReader(handle)
                    if str(row.get("cluster_id") or "").strip() == cluster_id
                ]

    if golden_row is None and cluster_rows:
        golden_row = _synthesize_cluster_profile_row(
            cluster_id,
            cluster_rows,
            source,
        )

    return golden_row, cluster_id, cluster_rows

def _source_household_members(source, golden_id, target_row=None):
    source = _normalize_cluster_source(source)

    if uc_enabled():
        golden_variants = _golden_id_variants(golden_id)
        target = dict(target_row or {})
        if not target:
            matches = _uc_lookup_rows(
                "golden_records",
                source,
                {"golden_id": golden_variants},
                limit=1,
            )
            target = _normalize_golden_row(matches[0], source) if matches else {}
        household_id = _first_value(target, ["household_id"])

        link_lookup = {
            "golden_id": golden_variants,
            "household_golden_id": golden_variants,
            "member_golden_id": golden_variants,
        }
        if household_id:
            link_lookup["household_id"] = [household_id]
        link_rows = _uc_lookup_rows(
            "household_links",
            source,
            link_lookup,
            limit=100,
        )

        member_ids = []
        members = []
        for row in link_rows:
            row_ids = [
                _first_value(row, ["golden_id"]),
                _first_value(row, ["household_golden_id", "member_golden_id"]),
            ]
            member_id = next(
                (
                    candidate
                    for candidate in row_ids
                    if candidate
                    and candidate.upper() not in {value.upper() for value in golden_variants}
                ),
                "",
            )
            payload = _household_member_payload(
                {**row, "golden_id": member_id or _first_value(row, ["golden_id"])},
            )
            if payload["full_name"] or payload["email"]:
                members.append(payload)
            elif member_id:
                member_ids.append(member_id)

        if member_ids:
            member_rows = _uc_lookup_rows(
                "golden_records",
                source,
                {"golden_id": member_ids},
                limit=max(8, len(member_ids)),
            )
            members.extend(_household_member_payload(row) for row in member_rows)

        # Some domains do not persist a separate household-link table.  The
        # household_id on golden records remains authoritative in that case.
        if not members and household_id:
            household_rows = _uc_lookup_rows(
                "golden_records",
                source,
                {"household_id": [household_id]},
                limit=12,
            )
            members.extend(
                _household_member_payload(row)
                for row in household_rows
                if _first_value(row, ["golden_id"]).upper() != str(golden_id).upper()
            )

        # A small number of sports records share a verified postal address even
        # when the upstream pipeline assigned unique household IDs. Use that
        # address only as a bounded, exact-match fallback.
        target_address = _first_value(target, ["address", "address_line1"])
        if not members and target_address:
            address_rows = _uc_lookup_rows(
                "golden_records",
                source,
                {"address": [target_address]},
                limit=12,
            )
            members.extend(
                _household_member_payload(row, relationship="Same Address")
                for row in address_rows
                if _first_value(row, ["golden_id"]).upper() != str(golden_id).upper()
            )

        return _dedupe_household_members(members, golden_id)[:8]

    golden_csv = _get_golden_csv(source)
    if not golden_csv.exists():
        return []

    target = target_row
    rows = []
    with open(golden_csv, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            normalized = _normalize_golden_row(row, source)
            rows.append(normalized)
            if normalized.get("golden_id", "").upper() == golden_id.upper():
                target = normalized

    if not target:
        return []

    if source == "automotive":
        customer_id = target.get("customer_id", "")
        if customer_id:
            customer_profiles, _vehicle_owner = _automotive_customer_context()
            profile = customer_profiles.get(customer_id, {})
            raw_household_id = profile.get("household_id", "")
            if raw_household_id:
                golden_by_customer = {row.get("customer_id", ""): row for row in rows if row.get("customer_id")}
                raw_household_members = []
                for other_customer_id, other_profile in customer_profiles.items():
                    if other_customer_id == customer_id or other_profile.get("household_id") != raw_household_id:
                        continue
                    linked = golden_by_customer.get(other_customer_id, {})
                    raw_household_members.append(
                        {
                            "golden_id": linked.get("golden_id", ""),
                            "full_name": other_profile.get("full_name", ""),
                            "email": other_profile.get("email", ""),
                            "address": other_profile.get("address", ""),
                            "zip": other_profile.get("zip", ""),
                            "relationship": "Household Member",
                        }
                    )
                    if len(raw_household_members) >= 8:
                        break
                if raw_household_members:
                    return _dedupe_household_members(raw_household_members, golden_id)[:8]

    household_members = []
    household_id = target.get("household_id", "")
    if household_id:
        for row in rows:
            if row.get("golden_id", "").upper() == golden_id.upper():
                continue
            if row.get("household_id") != household_id:
                continue
            household_members.append(
                {
                    "golden_id": row.get("golden_id", ""),
                    "full_name": row.get("full_name", ""),
                    "email": row.get("email", ""),
                    "address": row.get("address", ""),
                    "zip": row.get("zip", ""),
                    "relationship": "Household Member",
                }
            )
            if len(household_members) >= 8:
                break

    return _dedupe_household_members(household_members, golden_id)[:8]



# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = Flask(__name__)
app.register_blueprint(consent_bp)
from segmentation_routes import segmentation_bp
app.register_blueprint(segmentation_bp)
CORS(app)

def _configured_pipeline_steps():
    steps = get_payload_value("legacy_runtime.yml", "legacy_runtime", "PIPELINE_STEPS")
    if os.getenv("CODEX_DATA_SOURCE", "local").strip().lower() != "uc":
        csv_outputs = {
            "all_preprocessed",
            "all_standardized",
            "candidate_pairs",
            "clustered_records",
            "golden_records",
            "superseded_ids",
        }
        for step in steps:
            step["outputs"] = [
                f"{output}.csv" if Path(output).name in csv_outputs else output
                for output in step.get("outputs", [])
            ]
    return steps


PIPELINE_STEPS = _configured_pipeline_steps()
_run_status = {}
_enhanced_pipeline_lock = threading.Lock()
ENHANCED_IDENTITY_PIPELINE_STEPS = (
    ("step2b", "enhanced_prepare_matching_fields.py"),
    ("step3", "enhanced_candidate_pair_scoring.py"),
    ("step4", "enhanced_clustering.py"),
    ("step5", "enhanced_golden_records.py"),
)

PIPELINE_SOURCE_SYSTEMS = set(get_supported_sources().keys())


def _requested_source_system():
    payload = request.get_json(silent=True) or {}
    source = (
        payload.get("source_system")
        or payload.get("sourceSystem")
        or request.args.get("source_system")
        or request.args.get("sourceSystem")
        or ""
    )
    source = str(source).strip().lower()
    return source if source in PIPELINE_SOURCE_SYSTEMS else None


def _enhanced_step_script(step, source_system):
    if not source_system or not _use_enhanced_identity(source_system):
        return None
    return {
        "step2b": "enhanced_prepare_matching_fields.py",
        "step3": "enhanced_candidate_pair_scoring.py",
        "step4": "enhanced_clustering.py",
        "step5": "enhanced_golden_records.py",
    }.get(step["id"])


def _run_pipeline_step_script(step, source_system=None):
    if source_system and step["id"] == "step1" and source_system not in {"media", "sports"}:
        return subprocess.CompletedProcess(
            args=[sys.executable, str(ROOT / step["script"])],
            returncode=0,
            stdout=(
                f"Skipped Semantic Tagging for {source_system}: "
                "this dataset uses source-aware preprocessing aliases.\n"
            ),
            stderr="",
        )

    env = os.environ.copy()
    try:
        step_timeout = max(
            60,
            int(os.getenv("CODEX_IDENTITY_STEP_TIMEOUT_SECONDS", "3600")),
        )
    except ValueError:
        step_timeout = 3600

    enhanced_script = _enhanced_step_script(step, source_system)

    def run_script(script_name, *, enhanced=False):
        cmd = [sys.executable, str(ROOT / script_name)]
        if source_system:
            enhanced_config = _enhanced_identity_config_path(source_system)
            if enhanced and enhanced_config.exists():
                cmd.extend(["--config", str(enhanced_config)])
            elif step["id"] == "step1":
                env["SOURCE_SYSTEMS"] = source_system
            else:
                cmd.extend(["--source-systems", source_system])
        return subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=str(ROOT),
            timeout=step_timeout,
            env=env,
        )

    # A complete Media/Sports run must first refresh all_standardized and only
    # then prepare the enhanced matching fields.  Previously step2b was
    # replaced by the enhanced preparer, leaving the standardized snapshot
    # capped/stale even after a successful "full" run.
    if enhanced_script and step["id"] == "step2b":
        standardization = run_script(step["script"])
        if standardization.returncode != 0:
            return standardization
        preparation = run_script(enhanced_script, enhanced=True)
        return subprocess.CompletedProcess(
            args=[standardization.args, preparation.args],
            returncode=preparation.returncode,
            stdout=standardization.stdout + preparation.stdout,
            stderr=standardization.stderr + preparation.stderr,
        )

    return run_script(enhanced_script or step["script"], enhanced=bool(enhanced_script))


def _purge_standardization_report_snapshot(source_system):
    """Remove the persisted source report after a successful data refresh."""
    normalized_source = _normalize_cluster_source(source_system)
    report_path = (
        ROOT
        / "standardization_reports"
        / normalized_source
        / "cleaning_standardization_report.json"
    )
    try:
        report_path.unlink(missing_ok=True)
    except (OSError, RuntimeError) as exc:
        app.logger.warning(
            "Unable to invalidate %s report snapshot: %s",
            normalized_source,
            exc,
        )
    purge_unified_snapshots = app.extensions.get("codex_purge_report_snapshots")
    if callable(purge_unified_snapshots):
        purge_unified_snapshots(normalized_source)


def _invalidate_reporting_caches(source_system=None):
    """Notify the unified backend that source artifacts changed."""
    normalized_source = (
        _normalize_cluster_source(source_system)
        if source_system
        else None
    )
    enrichment_cache = globals().get("_ENRICHMENT_ROWS_CACHE")
    if isinstance(enrichment_cache, dict):
        enrichment_cache.clear()
    subscription_cache = globals().get("_STANDARDIZED_SUBSCRIPTIONS_CACHE")
    if isinstance(subscription_cache, dict):
        if source_system:
            subscription_cache.pop(
                _normalize_cluster_source(source_system),
                None,
            )
        else:
            subscription_cache.clear()
    if callable(clear_uc_read_caches):
        clear_uc_read_caches()
    for cache_name in (
        "_STANDARDIZATION_REPORT_CACHE",
        "_QUALITY_RECORD_INDEX_CACHE",
    ):
        report_cache = globals().get(cache_name)
        if not isinstance(report_cache, dict):
            continue
        if normalized_source:
            report_cache.pop(normalized_source, None)
        else:
            report_cache.clear()
    callback = app.extensions.get("codex_clear_reporting_caches")
    if callable(callback):
        callback(source_system)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _read_json(path):
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def _csv_row_count(path):
    if uc_enabled() and table_row_count is not None:
        return table_row_count(str(path), source=_source_system_for_file(str(path)))
    if not path.exists():
        return 0
    with open(path, "r", encoding="utf-8") as f:
        return sum(1 for _ in f) - 1


def _csv_columns(path):
    if uc_enabled() and table_columns is not None:
        return table_columns(str(path), source=_source_system_for_file(str(path)))
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8") as f:
        return next(csv.reader(f), [])


def _csv_preview(path, limit=100):
    if not path.exists():
        return {"columns": [], "rows": []}
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames or []
        for i, row in enumerate(reader):
            if i >= limit:
                break
            rows.append(row)
    return {"columns": cols, "rows": rows}


def _csv_search(path, column, value, limit=200):
    if uc_enabled() and search_table_df is not None:
        frame = search_table_df(
            str(path),
            str(column),
            str(value),
            source=_source_system_for_file(str(path)),
            limit=limit,
            required=False,
        )
        if frame.empty:
            return {"columns": list(frame.columns), "rows": []}
        frame = frame.fillna("")
        return {
            "columns": list(frame.columns),
            "rows": frame.to_dict(orient="records"),
        }
    if not path.exists():
        return {"columns": [], "rows": []}
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames or []
        for row in reader:
            if value.upper() in row.get(column, "").upper():
                rows.append(row)
                if len(rows) >= limit:
                    break
    return {"columns": cols, "rows": rows}


# ---------------------------------------------------------------------------
# Data Classification helpers
# ---------------------------------------------------------------------------
def _get_classification():
    data = _read_json(DATA_CLASSIFICATION_CFG)
    return data.get("classification", {}) if data else {}


# Hardcoded enrichment source classifications based on actual data provenance
# Fan scores and LTV propensity are internal ML scoring — not external vendor data
_ENRICHMENT_OVERRIDES = {
    f"{name}.csv": settings
    for name, settings in get_payload_value(
        "legacy_runtime.yml",
        "legacy_runtime",
        "_ENRICHMENT_OVERRIDES",
    ).items()
}

# These governed Media tables support reporting, consent, content, and activity
# enrichment, but they are deliberately outside the five-table identity input
# contract.  Registering them for Data Overview must never make them eligible
# for matching simply because the generic first-party default is identity=True.
_NON_IDENTITY_RAW_SOURCE_OVERRIDES = {
    "med_customer_accounts.csv": {
        "party": "1P",
        "source_type": "Master Data",
        "owner": "Internal",
        "use_for_identity": False,
        "use_for_enrichment": True,
        "description": "Governed Media customer account reference data.",
    },
    "med_campaigns.csv": {
        "party": "1P",
        "source_type": "Marketing Reference",
        "owner": "Internal",
        "use_for_identity": False,
        "use_for_enrichment": True,
        "description": "Governed Media campaign reference data.",
    },
    "med_consent_events.csv": {
        "party": "1P",
        "source_type": "Consent & Privacy",
        "owner": "Internal",
        "use_for_identity": False,
        "use_for_enrichment": True,
        "description": "Governed Media consent audit events.",
    },
    "med_content_catalog.csv": {
        "party": "1P",
        "source_type": "Content Reference",
        "owner": "Internal",
        "use_for_identity": False,
        "use_for_enrichment": True,
        "description": "Governed Media content catalog reference data.",
    },
    "med_subscription_billing_history.csv": {
        "party": "1P",
        "source_type": "Transactional",
        "owner": "Internal",
        "use_for_identity": False,
        "use_for_enrichment": True,
        "description": "Governed Media subscription billing history used for realized value reporting.",
    },
    "med_web_events.csv": {
        "party": "1P",
        "source_type": "Behavioural",
        "owner": "Internal",
        "use_for_identity": False,
        "use_for_enrichment": True,
        "description": "Governed Media web activity events.",
    },
}


def _source_classification_keys(fname):
    text = str(fname or "").replace("\\", "/")
    basename = Path(text).name
    stem = Path(basename).stem
    keys = [text, basename, stem, f"{stem}.csv"]
    seen = set()
    return [key for key in keys if key and not (key in seen or seen.add(key))]


def _classify_source(fname):
    # Check hardcoded overrides first (correct provenance regardless of JSON config)
    for key in _source_classification_keys(fname):
        if key in _ENRICHMENT_OVERRIDES:
            return _ENRICHMENT_OVERRIDES[key]
        if key in _NON_IDENTITY_RAW_SOURCE_OVERRIDES:
            return _NON_IDENTITY_RAW_SOURCE_OVERRIDES[key]
    cfg = _get_classification()
    for key in _source_classification_keys(fname):
        if key in cfg:
            return cfg[key]
    return cfg.get(
        fname,
        {
            "party": "1P",
            "source_type": "Internal",
            "owner": "Internal",
            "use_for_identity": True,
            "use_for_enrichment": True,
            "description": "",
        },
    )


# ---------------------------------------------------------------------------
# Enhancement #1 helper: Load all 2P/3P enrichment data keyed by golden_id
# Sources:
#   2p_fan_scores.csv      match: email         → fan_score, fan_score_band
#   2p_location_data.csv   match: golden_id     → home_dma, stadium_visits_12m
#   3p_demographics.csv    match: golden_id_ref → estimated_age_range, estimated_income_band
#   3p_ltv_propensity.csv  match: golden_id_ref → ltv_band, segment_code, churn_propensity_score
# ---------------------------------------------------------------------------
def _load_enrichment_by_golden_id():
    # Build email → golden_id index from golden records
    email_to_gid = {}
    if GOLDEN_CSV.exists():
        with open(GOLDEN_CSV, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                gid = row.get("golden_id", row.get("record_id", ""))
                email = row.get("email", "").strip().upper()
                if gid and email:
                    email_to_gid[email] = gid

    result = {}

    # 2P: SportsIQ fan scores (match on email)
    fan_path = ENRICHMENT_DIR / "2p_fan_scores.csv"
    if fan_path.exists():
        with open(fan_path, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                email = row.get("email", "").strip().upper()
                gid = email_to_gid.get(email)
                if not gid:
                    continue
                score = float(row.get("fan_score", 0) or 0)
                result.setdefault(gid, {}).update(
                    {
                        "fan_score": score,
                        "fan_score_band": "35+" if score >= 35 else "20-35" if score >= 20 else "<20",
                        "preferred_team": row.get("preferred_team", ""),
                        "content_affinity": row.get("content_affinity", ""),
                    }
                )

    # 2P: GeoSignal location (match on golden_id directly)
    loc_path = ENRICHMENT_DIR / "2p_location_data.csv"
    if loc_path.exists():
        with open(loc_path, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                gid = row.get("golden_id", "").strip()
                if not gid:
                    continue
                result.setdefault(gid, {}).update(
                    {
                        "home_dma": row.get("home_dma", ""),
                        "home_zip": row.get("home_zip", ""),
                        "stadium_visits_12m": row.get("stadium_visits_12m", ""),
                        "frequent_venue_type": row.get("frequent_venue_type", ""),
                    }
                )

    # 3P: DataBridge demographics (match on golden_id_ref)
    demo_path = ENRICHMENT_DIR / "3p_demographics.csv"
    if demo_path.exists():
        with open(demo_path, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                gid = row.get("golden_id_ref", "").strip()
                if not gid:
                    continue
                result.setdefault(gid, {}).update(
                    {
                        "estimated_age_range": row.get("estimated_age_range", ""),
                        "estimated_income_band": row.get("estimated_income_band", ""),
                        "household_size": row.get("household_size", ""),
                        "education_level": row.get("education_level", ""),
                    }
                )

    # 3P: TrueSignal LTV propensity (match on golden_id_ref)
    ltv_path = ENRICHMENT_DIR / "3p_ltv_propensity.csv"
    if ltv_path.exists():
        with open(ltv_path, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                gid = row.get("golden_id_ref", "").strip()
                if not gid:
                    continue
                result.setdefault(gid, {}).update(
                    {
                        "ltv_band": row.get("ltv_band", ""),
                        "ltv_score_3p": row.get("ltv_score", ""),
                        "churn_propensity_score": float(row.get("churn_propensity_score", 0) or 0),
                        "upsell_propensity_score": float(row.get("upsell_propensity_score", 0) or 0),
                        "segment_code": row.get("segment_code", ""),
                        "predicted_annual_value": row.get("predicted_annual_value", ""),
                    }
                )

    return result


# ---------------------------------------------------------------------------
# API: Pipeline
# ---------------------------------------------------------------------------
@app.route("/api/pipeline/steps", methods=["GET"])
def pipeline_steps():
    result = []
    use_uc = os.getenv("CODEX_DATA_SOURCE", "local").strip().lower() == "uc"
    for step in PIPELINE_STEPS:
        with _enhanced_pipeline_lock:
            run = dict(_run_status.get(step["id"], {}))
        # Path.exists() is backed by DESCRIBE TABLE in UC mode. Polling this
        # endpoint every few seconds must never issue warehouse statements.
        outputs_exist = (
            run.get("status") == "done"
            if use_uc
            else all((ROOT / output).exists() for output in step["outputs"])
        )
        result.append(
            {
                "id": step["id"],
                "name": step["name"],
                "script": step["script"],
                "outputs_ready": outputs_exist,
                "run_status": run.get("status", "idle"),
                "log": run.get("log", ""),
                "run_id": run.get("run_id"),
                "source_system": run.get("source_system"),
                "started_at": run.get("started_at"),
                "completed_at": run.get("completed_at"),
                "duration_seconds": run.get("duration_seconds"),
            }
        )
    return jsonify(result)


@app.route("/api/pipeline/run/<step_id>", methods=["POST"])
def run_step(step_id):
    step = next((s for s in PIPELINE_STEPS if s["id"] == step_id), None)
    if not step:
        return jsonify({"error": f"Unknown step: {step_id}"}), 404
    if _run_status.get(step_id, {}).get("status") == "running":
        return jsonify({"error": "Step already running"}), 409

    source_system = _requested_source_system()
    _run_status[step_id] = {"status": "running", "log": ""}

    def _run():
        try:
            result = _run_pipeline_step_script(step, source_system)
            log = f"Source system: {source_system or 'default'}\n" + result.stdout + result.stderr
            if result.returncode == 0 and step_id == "step5":
                try:
                    field_rows = _rebuild_activity_detail_fields()
                    log += (
                        f"\nActivity detail fields regenerated: "
                        f"{ACTIVITY_DETAIL_FIELDS_CSV.relative_to(ROOT)} ({field_rows} rows)"
                    )
                except Exception as exc:
                    log += f"\nActivity detail fields regeneration failed: {exc}"
            _run_status[step_id] = {
                "status": "done" if result.returncode == 0 else "error",
                "log": log,
            }
        except Exception as e:
            _run_status[step_id] = {"status": "error", "log": str(e)}

    threading.Thread(target=_run, daemon=True).start()
    return jsonify({"message": f"Started {step['name']}"})


@app.route("/api/pipeline/run-all", methods=["POST"])
def run_all():
    source_system = _requested_source_system()
    run_id = uuid.uuid4().hex
    queued_at = datetime.now(timezone.utc).isoformat()

    with _enhanced_pipeline_lock:
        active_step = next(
            (
                step
                for step in _run_status.values()
                if step.get("status") in {"queued", "running"}
            ),
            None,
        )
        if active_step:
            return jsonify(
                {
                    "error": (
                        "An identity pipeline is already running for "
                        f"{active_step.get('source_system') or 'the selected source'}"
                    ),
                    "run_id": active_step.get("run_id"),
                }
            ), 409

        for step in PIPELINE_STEPS:
            _run_status[step["id"]] = {
                "status": "queued",
                "log": "",
                "source_system": source_system,
                "run_id": run_id,
                "script": step["script"],
                "queued_at": queued_at,
            }

    def _run_all():
        pipeline_failed = False
        try:
            for index, step in enumerate(PIPELINE_STEPS):
                sid = step["id"]
                started_monotonic = time.monotonic()
                started_at = datetime.now(timezone.utc).isoformat()
                with _enhanced_pipeline_lock:
                    _run_status[sid] = {
                        **_run_status.get(sid, {}),
                        "status": "running",
                        "started_at": started_at,
                    }
                try:
                    result = _run_pipeline_step_script(step, source_system)
                    status = "done" if result.returncode == 0 else "error"
                    completed_at = datetime.now(timezone.utc).isoformat()
                    with _enhanced_pipeline_lock:
                        _run_status[sid] = {
                            **_run_status.get(sid, {}),
                            "status": status,
                            "log": (
                                f"Source system: {source_system or 'default'}\n"
                                + result.stdout
                                + result.stderr
                            ),
                            "completed_at": completed_at,
                            "duration_seconds": round(
                                time.monotonic() - started_monotonic,
                                1,
                            ),
                        }
                    if result.returncode != 0:
                        pipeline_failed = True
                except Exception as exc:
                    completed_at = datetime.now(timezone.utc).isoformat()
                    with _enhanced_pipeline_lock:
                        _run_status[sid] = {
                            **_run_status.get(sid, {}),
                            "status": "error",
                            "log": str(exc),
                            "completed_at": completed_at,
                            "duration_seconds": round(
                                time.monotonic() - started_monotonic,
                                1,
                            ),
                        }
                    pipeline_failed = True
                if pipeline_failed:
                    with _enhanced_pipeline_lock:
                        for pending in PIPELINE_STEPS[index + 1:]:
                            pending_id = pending["id"]
                            _run_status[pending_id] = {
                                **_run_status.get(pending_id, {}),
                                "status": "error",
                                "log": (
                                    f"{pending['name']} was not run because "
                                    f"{step['name']} failed."
                                ),
                                "completed_at": completed_at,
                                "duration_seconds": 0,
                            }
                    break

            if not pipeline_failed:
                final_step_id = PIPELINE_STEPS[-1]["id"]
                try:
                    rows = _build_customer_profile_rows(source=source_system)
                    export_path = _write_customer_profile_export(
                        rows,
                        source=source_system,
                    )
                    export_log = (
                        f"\nCustomer Profile export regenerated: "
                        f"{export_path.relative_to(ROOT)} ({len(rows)} rows)"
                    )
                    try:
                        field_rows = _rebuild_activity_detail_fields()
                        export_log += (
                            f"\nActivity detail fields regenerated: "
                            f"{ACTIVITY_DETAIL_FIELDS_CSV.relative_to(ROOT)} ({field_rows} rows)"
                        )
                    except Exception as exc:
                        export_log += f"\nActivity detail fields regeneration failed: {exc}"
                    with _enhanced_pipeline_lock:
                        _run_status[final_step_id]["log"] = (
                            _run_status[final_step_id].get("log", "") + export_log
                        )
                except Exception as exc:
                    pipeline_failed = True
                    with _enhanced_pipeline_lock:
                        _run_status[final_step_id] = {
                            **_run_status.get(final_step_id, {}),
                            "status": "error",
                            "log": (
                                _run_status.get(final_step_id, {}).get("log", "")
                                + f"\nCustomer Profile export failed: {exc}"
                            ),
                        }
        finally:
            _CLUSTER_LIST_CACHE.clear()
            _invalidate_reporting_caches(source_system)
            if not pipeline_failed:
                _purge_standardization_report_snapshot(source_system)

    threading.Thread(target=_run_all, daemon=True).start()
    return jsonify(
        {
            "message": "Started full pipeline run",
            "source_system": source_system,
            "run_id": run_id,
            "steps": [step["id"] for step in PIPELINE_STEPS],
        }
    ), 202


@app.route("/api/pipeline/runs/<run_id>", methods=["GET"])
def pipeline_run_status(run_id):
    """Return one legacy pipeline run without touching Unity Catalog."""
    with _enhanced_pipeline_lock:
        steps = [
            {
                "id": step["id"],
                "name": step["name"],
                **dict(_run_status.get(step["id"], {})),
            }
            for step in PIPELINE_STEPS
            if _run_status.get(step["id"], {}).get("run_id") == run_id
        ]

    if not steps:
        return jsonify({"error": f"Pipeline run not found: {run_id}"}), 404

    statuses = {step.get("status", "queued") for step in steps}
    if "error" in statuses:
        status = "error"
    elif statuses == {"done"}:
        status = "done"
    elif "running" in statuses:
        status = "running"
    else:
        status = "queued"
    return jsonify(
        {
            "run_id": run_id,
            "source_system": steps[0].get("source_system"),
            "status": status,
            "steps": steps,
        }
    )


@app.route("/api/pipeline/run-id-graph-pipeline", methods=["POST"])
def run_id_graph_pipeline():
    """Run all pipeline steps sequentially in background."""
    source_system = _requested_source_system()

    def _run_id_graph_pipeline():
        pipeline_failed = False
        try:
            for step in PIPELINE_STEPS[3:]:
                sid = step["id"]
                _run_status[sid] = {"status": "running", "log": ""}
                try:
                    result = _run_pipeline_step_script(step, source_system)
                    _run_status[sid] = {
                        "status": "done" if result.returncode == 0 else "error",
                        "log": (f"Source system: {source_system or 'default'}\n" + result.stdout + result.stderr),
                    }
                    if result.returncode != 0:
                        pipeline_failed = True
                        break
                except Exception as e:
                    _run_status[sid] = {"status": "error", "log": str(e)}
                    pipeline_failed = True
                    break

            if not pipeline_failed:
                final_step_id = PIPELINE_STEPS[-1]["id"]
                try:
                    rows = _build_customer_profile_rows(source=source_system)
                    export_path = _write_customer_profile_export(
                        rows,
                        source=source_system,
                    )
                    export_log = (
                        f"\nCustomer Profile export regenerated: "
                        f"{export_path.relative_to(ROOT)} ({len(rows)} rows)"
                    )
                    try:
                        field_rows = _rebuild_activity_detail_fields()
                        export_log += (
                            f"\nActivity detail fields regenerated: "
                            f"{ACTIVITY_DETAIL_FIELDS_CSV.relative_to(ROOT)} ({field_rows} rows)"
                        )
                    except Exception as exc:
                        export_log += f"\nActivity detail fields regeneration failed: {exc}"
                    _run_status[final_step_id]["log"] = _run_status[final_step_id].get("log", "") + export_log
                except Exception as e:
                    pipeline_failed = True
                    _run_status[final_step_id] = {
                        "status": "error",
                        "log": _run_status.get(final_step_id, {}).get("log", "") + f"\nCustomer Profile export failed: {e}",
                    }
        finally:
            _CLUSTER_LIST_CACHE.clear()
            _invalidate_reporting_caches(source_system)
            if not pipeline_failed:
                _purge_standardization_report_snapshot(source_system)

    threading.Thread(target=_run_id_graph_pipeline, daemon=True).start()
    return jsonify({"message": "Started full pipeline run"})


# ---------------------------------------------------------------------------
# API: Data Sources
# ---------------------------------------------------------------------------
_EXCLUDED_FILES = {"ground_truth.json", "identity_graph.csv"}


def _data_overview_snapshot_entry(
    source,
    catalog,
    schema,
    live_metadata,
):
    """Return validated last-successful row counts for a cold SQL warehouse."""
    try:
        payload = _read_json(DATA_OVERVIEW_SNAPSHOT)
    except Exception:
        return None
    if not isinstance(payload, dict) or payload.get("version") != 1:
        return None
    snapshots = payload.get("sources")
    entry = snapshots.get(source) if isinstance(snapshots, dict) else None
    if not isinstance(entry, dict):
        return None
    if (
        str(entry.get("catalog") or "") != str(catalog or "")
        or str(entry.get("schema") or "") != str(schema or "")
    ):
        return None

    confirmed_keys = {
        key
        for key, item in live_metadata.items()
        if item.get("exists") is True
    }
    rows_by_key = entry.get("rows")
    if not isinstance(rows_by_key, dict) or set(rows_by_key) != confirmed_keys:
        return None

    validated = {}
    for key in confirmed_keys:
        try:
            row_count = int(rows_by_key[key])
        except (TypeError, ValueError):
            return None
        if row_count < 0:
            return None
        validated[key] = row_count
    return {
        "rows": validated,
        "metadata_as_of": entry.get("metadata_as_of"),
    }


def _persist_data_overview_snapshot(source, catalog, schema, metadata):
    """Persist only fully resolved, live-derived source row counts."""
    rows_by_key = {
        key: int(item["row_count"])
        for key, item in metadata.items()
        if item.get("exists") is True and item.get("row_count") is not None
    }
    confirmed_keys = {
        key for key, item in metadata.items() if item.get("exists") is True
    }
    if set(rows_by_key) != confirmed_keys:
        return

    with _DATA_OVERVIEW_SNAPSHOT_LOCK:
        try:
            payload = _read_json(DATA_OVERVIEW_SNAPSHOT)
        except Exception:
            payload = None
        if not isinstance(payload, dict) or payload.get("version") != 1:
            payload = {"version": 1, "sources": {}}
        if not isinstance(payload.get("sources"), dict):
            payload["sources"] = {}
        existing_entry = payload["sources"].get(source)
        if (
            isinstance(existing_entry, dict)
            and str(existing_entry.get("catalog") or "") == str(catalog or "")
            and str(existing_entry.get("schema") or "") == str(schema or "")
            and existing_entry.get("rows") == rows_by_key
        ):
            return
        payload["sources"][source] = {
            "catalog": str(catalog or ""),
            "schema": str(schema or ""),
            "metadata_as_of": datetime.now(timezone.utc).isoformat(),
            "rows": rows_by_key,
        }
        try:
            DATA_OVERVIEW_SNAPSHOT.write_text(
                json.dumps(payload, indent=2),
                encoding="utf-8",
            )
        except Exception as exc:
            print(
                f"[WARNING] Unable to persist Data Overview metadata snapshot: {exc}",
                flush=True,
            )


def _configured_uc_registry_refs():
    try:
        from data_registry import get_registry

        return list(get_registry().all())
    except Exception as exc:
        raise DatabricksDataAccessError(
            f"Unable to load configured Unity Catalog source registry: {exc}"
        ) from exc


def _configured_uc_sources():
    if not uc_enabled():
        return []
    source_schema = get_databricks_schema("sources")
    sources = []
    for ref in _configured_uc_registry_refs():
        source = str(getattr(ref, "source", "") or "").strip().lower()
        table = str(getattr(ref, "table", "") or "").strip()
        if (
            getattr(ref, "schema", None) == source_schema
            and source in SUPPORTED_CLUSTER_SOURCES
            and table
        ):
            sources.append(f"{source}/{table}")
    return sorted(set(sources))


def _configured_uc_enrichment_sources():
    if not uc_enabled():
        return []
    source_schema = get_databricks_schema("sources")
    sources = []
    for ref in _configured_uc_registry_refs():
        table = str(getattr(ref, "table", "") or "").strip()
        if (
            getattr(ref, "schema", None) == source_schema
            and getattr(ref, "source", None) is None
            and table.lower().startswith(("2p_", "3p_", "ml_"))
        ):
            sources.append(table)
    return sorted(set(sources))


def _discover_sources():
    if uc_enabled():
        return _configured_uc_sources()
    if not GEN_DIR.exists():
        return []
    sources = []
    for f in GEN_DIR.rglob("*.csv"):
        if not f.is_file() or f.name in _EXCLUDED_FILES:
            continue
        rel = f.relative_to(GEN_DIR)
        if any("backup" in part.lower() for part in rel.parts):
            continue
        try:
            f.relative_to(ENRICHMENT_DIR)
            continue
        except ValueError:
            pass
        sources.append(rel.as_posix())
    return sorted(sources)


def _discover_enrichment_sources():
    if uc_enabled():
        return _configured_uc_enrichment_sources()
    if not ENRICHMENT_DIR.exists():
        return []
    return sorted(f.name for f in ENRICHMENT_DIR.iterdir() if f.suffix == ".csv")


def _source_display_name(fname):
    import re

    name = Path(fname).name.replace(".csv", "").replace("_", " ")
    # Strip leading party prefix (2p, 3p, ml) — shown separately as category badge
    name = re.sub(r"^(2p|3p|ml|aut|auto|med|spt|tel)\s+", "", name, flags=re.IGNORECASE).strip()
    name = name.title()
    # Fix common acronym casing
    name = name.replace("Ltv", "LTV").replace("Dma", "DMA")
    return name


def _source_system_for_file(fname):
    normalized = str(fname or "").replace("\\", "/").lower()
    base = Path(normalized).name
    scoped_path = f"/{normalized.strip('/')}"
    if (
        normalized.startswith("automotive/")
        or "/automotive/" in scoped_path
        or base.startswith(("aut_", "auto_"))
    ):
        return "automotive"
    if (
        normalized.startswith("telecom/")
        or "/telecom/" in scoped_path
        or base.startswith("tel_")
    ):
        return "telecom"
    if (
        normalized.startswith("sports/")
        or "/sports/" in scoped_path
        or base.startswith("spt_")
    ):
        return "sports"
    if (
        normalized.startswith("media/")
        or "/media/" in scoped_path
        or base.startswith("med_")
    ):
        return "media"
    return DEFAULT_CLUSTER_SOURCE


def _source_path_candidates(name):
    """Return candidate paths for a source CSV, vertical folders before root copies.

    :param name: Source CSV filename or relative path.
    :type name: str
    :returns: Ordered list of candidate paths.
    :rtype: list[Path]
    """
    rel = Path(name)
    return [
        GEN_DIR / "media" / rel,
        GEN_DIR / "sports" / rel,
        GEN_DIR / "automotive" / rel,
        GEN_DIR / "telecom" / rel,
        GEN_DIR / rel,
        ENRICHMENT_DIR / rel,
    ]


def _source_path(name):
    """Resolve the first existing path for a source CSV file.

    :param name: Source CSV filename or relative path.
    :type name: str
    :returns: Resolved path to the source file.
    :rtype: Path
    """
    for path in _source_path_candidates(name):
        try:
            resolved = path.resolve()
            if resolved.exists() and (
                resolved.is_relative_to(GEN_DIR.resolve())
                or resolved.is_relative_to(ENRICHMENT_DIR.resolve())
            ):
                return resolved
        except (OSError, ValueError):
            continue
    return GEN_DIR / Path(name)


def _source_id_column(fname):
    """Resolve the primary key column for a source CSV filename.

    :param fname: Source CSV filename or relative path.
    :type fname: str
    :returns: Column name used as the record identifier in that file.
    :rtype: str
    """
    base = Path(str(fname or "").replace("\\", "/")).name.lower()
    lookup_base = base if base.endswith(".csv") else f"{base}.csv"
    known = {
        "subscription_billing.csv": "subscription_id",
        "med_subscription_billing.csv": "subscription_id",
        "streaming_activity.csv": "session_id",
        "med_streaming_activity.csv": "session_id",
        "app_events.csv": "event_id",
        "med_app_events.csv": "event_id",
        "customer_support.csv": "ticket_id",
        # Keep the source table's established primary key for generic raw
        # searches. Activity details add ticket_number as an explicit,
        # cluster-lineage fallback for pipeline-generated record ids.
        "med_customer_support.csv": "ticket_id",
        "email_engagement.csv": "engagement_id",
        "med_email_engagement.csv": "engagement_id",
        "med_customer_accounts.csv": "account_id",
        "med_campaigns.csv": "campaign_id",
        "med_consent_events.csv": "consent_event_id",
        "med_content_catalog.csv": "content_id",
        "med_subscription_billing_history.csv": "billing_history_id",
        "med_web_events.csv": "web_event_id",
    }
    if lookup_base in known:
        return known[lookup_base]
    sports_ids = {
        "spt_ticket_orders.csv": "ticket_order_id",
        "spt_ott_streaming_sessions.csv": "streaming_session_id",
        "spt_app_events.csv": "digital_session_id",
        "spt_fan_accounts.csv": "fan_account_id",
        "spt_loyalty_members.csv": "loyalty_member_id",
        "spt_commerce_orders.csv": "commerce_order_id",
    }
    if lookup_base in sports_ids:
        return sports_ids[lookup_base]
    automotive_ids = {
        "aut_campaign_interactions.csv": "campaign_interaction_id",
        "aut_connected_services_subscriptions.csv": "subscription_id",
        "aut_sales_transactions.csv": "sales_transaction_id",
        "aut_service_orders.csv": "service_order_id",
        "aut_service_appointments.csv": "service_appointment_id",
        "aut_support_cases.csv": "support_case_id",
        "aut_mobile_app_sessions.csv": "app_session_id",
        "aut_vehicle_ownership.csv": "ownership_id",
        "aut_vehicle_health_reports.csv": "health_report_id",
    }
    if lookup_base in automotive_ids:
        return automotive_ids[lookup_base]
    cols = _csv_columns(_source_path(fname))
    return cols[0] if cols else "record_id"


PREFIX_TO_SOURCE = {
    prefix: f"{source}.csv"
    for prefix, source in get_payload_value(
        "legacy_runtime.yml",
        "legacy_runtime",
        "PREFIX_TO_SOURCE",
    ).items()
}


def _source_for_record_id(record_id):
    for prefix, source in PREFIX_TO_SOURCE.items():
        if record_id.upper().startswith(prefix):
            return source
    return None


def _search_raw_by_record_id(record_id, limit=1):
    source_name, raw_id = _parse_activity_record_ref(record_id)
    if source_name:
        path = _source_path(source_name)
        id_col = _source_id_column(source_name)
        data = _csv_search(path, id_col, raw_id, limit=limit)
        if data["rows"]:
            return data, source_name

    record_id = str(record_id or "").strip().upper()
    source = _source_for_record_id(record_id)
    if source:
        id_col = _source_id_column(source)
        return _csv_search(_source_path(source), id_col, record_id, limit=limit), source
    for fname in _discover_sources():
        id_col = _source_id_column(fname)
        data = _csv_search(_source_path(fname), id_col, record_id, limit=limit)
        if data["rows"]:
            return data, fname
    return {"columns": [], "rows": []}, None


@app.route("/api/sources", methods=["GET"])
def list_sources():
    requested_source = (
        request.args.get("source")
        or request.args.get("source_system")
        or request.args.get("sourceSystem")
        or ""
    )
    source_filter = _normalize_cluster_source(requested_source) if requested_source else ""
    source_files = [
        fname
        for fname in _discover_sources()
        if not source_filter or _source_system_for_file(fname) == source_filter
    ]
    enrichment_files = [
        fname
        for fname in _discover_enrichment_sources()
        if not source_filter or _source_system_for_file(fname) == source_filter
    ]

    metadata = {}
    metadata_source = "live"
    metadata_as_of = None
    if uc_enabled() and tables_fast_metadata is not None:
        config = get_config()
        catalog = str(config.get("databricks", {}).get("catalog") or "").strip()
        source_schema = get_databricks_schema("sources")
        requests = []
        for fname in [*source_files, *enrichment_files]:
            source_system = _source_system_for_file(fname)
            basename = Path(fname).name
            requests.append(
                {
                    "key": f"{source_system}/{basename}".lower(),
                    "name": basename,
                    "source": source_system,
                    "catalog": catalog,
                    "schema": source_schema,
                }
            )
        metadata = tables_fast_metadata(requests)
        unknown_catalog_entries = [
            key
            for key, item in metadata.items()
            if item.get("exists") is None
        ]
        if unknown_catalog_entries:
            return jsonify(
                {
                    "error": (
                        "Unity Catalog source inventory is temporarily unavailable."
                    ),
                    "retryable": True,
                    "retry_after_seconds": 3,
                    "source_system": source_filter or None,
                }
            ), 503

        deferred_counts = [
            key
            for key, item in metadata.items()
            if item.get("exists") is True and item.get("row_count") is None
        ]
        if deferred_counts:
            snapshot = (
                _data_overview_snapshot_entry(
                    source_filter,
                    catalog,
                    source_schema,
                    metadata,
                )
                if source_filter
                else None
            )
            if snapshot is None:
                return jsonify(
                    {
                        "error": (
                            "Source metadata is warming while the SQL warehouse starts."
                        ),
                        "retryable": True,
                        "retry_after_seconds": 3,
                        "source_system": source_filter or None,
                    }
                ), 503
            for key, row_count in snapshot["rows"].items():
                metadata[key]["row_count"] = row_count
            metadata_source = "last_successful"
            metadata_as_of = snapshot.get("metadata_as_of")
        elif source_filter:
            _persist_data_overview_snapshot(
                source_filter,
                catalog,
                source_schema,
                metadata,
            )

    def source_entry(fname, enrichment=False):
        path = (ENRICHMENT_DIR if enrichment else GEN_DIR) / fname
        classification = _classify_source(fname)
        source_system = _source_system_for_file(fname)
        if uc_enabled():
            item_metadata = metadata.get(f"{source_system}/{Path(fname).name}".lower(), {})
            if item_metadata.get("exists") is False:
                return None
            row_count = item_metadata.get("row_count")
            try:
                rows = int(row_count) if row_count is not None else 0
            except (TypeError, ValueError):
                rows = 0
            columns = list(item_metadata.get("columns") or [])
            exists = True
            metadata_deferred = metadata_source != "live"
        else:
            rows = _csv_row_count(path)
            columns = _csv_columns(path)
            exists = path.exists()
            metadata_deferred = False

        entry = {
            "name": fname,
            "display_name": _source_display_name(fname),
            "rows": rows,
            "columns": columns,
            "exists": exists,
            "party": classification.get("party", "3P" if enrichment else "1P"),
            "source_type": classification.get("source_type", "Enrichment" if enrichment else "Internal"),
            "owner": classification.get("owner", "External" if enrichment else "Internal"),
            "source_system": source_system,
            "use_for_identity": False if enrichment else classification.get("use_for_identity", True),
            "use_for_enrichment": classification.get("use_for_enrichment", True),
            "metadata_deferred": metadata_deferred,
            "description": classification.get("description", ""),
        }
        if uc_enabled():
            entry["metadata_source"] = metadata_source
            entry["metadata_as_of"] = metadata_as_of
        if enrichment:
            entry["match_key"] = classification.get("match_key", "")
        return entry

    sources = []
    for fname in source_files:
        entry = source_entry(fname)
        if entry is not None:
            sources.append(entry)
    for fname in enrichment_files:
        entry = source_entry(fname, enrichment=True)
        if entry is not None:
            sources.append(entry)
    return jsonify(sources)


@app.route("/api/data-classification", methods=["GET"])
def get_data_classification():
    if not DATA_CLASSIFICATION_CFG.exists():
        base = {
            "classification": {
                "subscription_billing.csv": {
                    "party": "1P",
                    "source_type": "Transactional",
                    "owner": "Internal",
                    "use_for_identity": True,
                    "use_for_enrichment": True,
                },
                "streaming_activity.csv": {
                    "party": "1P",
                    "source_type": "Behavioural",
                    "owner": "Internal",
                    "use_for_identity": True,
                    "use_for_enrichment": True,
                },
                "app_events.csv": {
                    "party": "1P",
                    "source_type": "Behavioural",
                    "owner": "Internal",
                    "use_for_identity": True,
                    "use_for_enrichment": True,
                },
                "customer_support.csv": {
                    "party": "1P",
                    "source_type": "Transactional",
                    "owner": "Internal",
                    "use_for_identity": True,
                    "use_for_enrichment": True,
                },
                "email_engagement.csv": {
                    "party": "1P",
                    "source_type": "Behavioural",
                    "owner": "Internal",
                    "use_for_identity": True,
                    "use_for_enrichment": True,
                },
            }
        }
    else:
        base = _read_json(DATA_CLASSIFICATION_CFG) or {"classification": {}}
    # Always apply enrichment overrides — these take priority over stored JSON
    base["classification"].update(_NON_IDENTITY_RAW_SOURCE_OVERRIDES)
    base["classification"].update(_ENRICHMENT_OVERRIDES)
    return jsonify(base)


@app.route("/api/data-classification", methods=["PUT"])
def update_data_classification():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    with open(DATA_CLASSIFICATION_CFG, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return jsonify({"message": "Classification updated"})


@app.route("/api/sources/<path:name>/preview", methods=["GET"])
def source_preview(name):
    limit = request.args.get("limit", 100, type=int)
    path = _source_path(name)
    if not path.exists():
        return jsonify({"error": "File not found"}), 404
    return jsonify(_csv_preview(path, limit))


@app.route("/api/sources/<path:name>/completeness", methods=["GET"])
def source_completeness(name):
    path = _source_path(name)
    if not path.exists():
        return jsonify({"error": "File not found"}), 404
    total = 0
    col_counts = {}
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames or []
        col_counts = {c: 0 for c in cols}
        for row in reader:
            total += 1
            for c in cols:
                if row.get(c, "").strip():
                    col_counts[c] += 1
    if total == 0:
        return jsonify({"columns": {c: 0.0 for c in cols}, "total_rows": 0})
    return jsonify({"columns": {c: round(cnt / total * 100, 1) for c, cnt in col_counts.items()}, "total_rows": total})


@app.route("/api/sources/<path:name>/random", methods=["GET"])
def source_random(name):
    import random as _rand

    limit = request.args.get("limit", 50, type=int)
    path = _source_path(name)
    if not path.exists():
        return jsonify({"error": "File not found"}), 404
    all_rows = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames or []
        all_rows = list(reader)
    sampled = _rand.sample(all_rows, min(limit, len(all_rows)))
    return jsonify({"columns": cols, "rows": sampled})


# ---------------------------------------------------------------------------
# API: Enrichment Profile Join
# ---------------------------------------------------------------------------
def _uc_profile_enrichment(golden_id, golden_record, source):
    """Load the four optional enrichment blocks with bounded UC lookups."""
    import hashlib

    email = _first_value(golden_record, ["email"]).strip().lower()
    phone = re.sub(r"\D", "", _first_value(golden_record, ["phone"]))
    device_id = _first_value(golden_record, ["device_id"])
    zip_code = _first_value(golden_record, ["zip", "postal_code"])[:5]
    phone_prefix = phone[:3] if len(phone) >= 3 else ""
    email_hash = hashlib.sha256(email.encode()).hexdigest() if email else ""
    golden_variants = _golden_id_variants(golden_id)

    requests = {
        "fan_scores": (
            "2p_fan_scores",
            {"email": [email]},
        ),
        "location": (
            "2p_location_data",
            {
                "golden_id": golden_variants,
                "golden_id_ref": golden_variants,
                "device_id": [device_id],
            },
        ),
        "demographics": (
            "3p_demographics",
            {
                "golden_id": golden_variants,
                "golden_id_ref": golden_variants,
                "zip": [zip_code],
                "phone_prefix": [phone_prefix],
            },
        ),
        "ltv_propensity": (
            "3p_ltv_propensity",
            {
                "golden_id": golden_variants,
                "golden_id_ref": golden_variants,
                "email_sha256": [email_hash],
            },
        ),
    }
    if source == "sports" and email_hash:
        requests["sports_fan_affinity"] = (
            "spt_3p_acxiom_fan_affinity_attributes",
            {"email_hash": [email_hash]},
        )

    def load_one(item):
        key, (table_name, lookups) = item
        rows = _uc_lookup_rows(table_name, source, lookups, limit=5)
        return key, (rows[0] if rows else None)

    if str(os.getenv("CODEX_ENABLE_PARALLEL_PROFILE", "1")).lower() in {"1", "true", "yes"}:
        with ThreadPoolExecutor(max_workers=4) as executor:
            loaded = dict(executor.map(load_one, requests.items()))
    else:
        loaded = dict(load_one(item) for item in requests.items())

    enrichment = {}
    fan_row = loaded.get("fan_scores")
    if not fan_row:
        fan_row = loaded.get("sports_fan_affinity")
    if fan_row:
        enrichment["fan_scores"] = {
            "source": (
                _first_value(fan_row, ["partner_source"])
                or ("Acxiom" if loaded.get("sports_fan_affinity") is fan_row else "SportsIQ")
            ),
            "party": _first_value(fan_row, ["data_party"]) or (
                "3P" if loaded.get("sports_fan_affinity") is fan_row else "2P"
            ),
            "match_key": _first_value(fan_row, ["match_key", "match_key_type"]) or "email",
            "fan_score": fan_row.get("fan_score"),
            "preferred_team": _first_value(fan_row, ["preferred_team", "favorite_team_market"]),
            "content_affinity": _first_value(fan_row, ["content_affinity", "favorite_sport_category"]),
            "venue_visits_12m": fan_row.get("venue_visits_12m"),
            "merchandise_spend_band": fan_row.get("merchandise_spend_band"),
            "fantasy_participation": _first_value(
                fan_row,
                ["fantasy_participation", "fantasy_sports_participant_flag"],
            ),
            "season_ticket_holder": fan_row.get("season_ticket_holder_flag"),
            "sports_streaming_subscriber": fan_row.get("sports_streaming_subscriber_flag"),
        }

    location_row = loaded.get("location")
    if location_row:
        enrichment["location"] = {
            "source": _first_value(location_row, ["partner_source"]) or "GeoSignal",
            "party": _first_value(location_row, ["data_party"]) or "2P",
            "match_key": _first_value(location_row, ["match_key"]) or "golden_id",
            "home_dma": location_row.get("home_dma"),
            "home_zip": location_row.get("home_zip"),
            "stadium_visits_12m": location_row.get("stadium_visits_12m"),
            "travel_radius_miles": location_row.get("travel_radius_miles"),
            "frequent_venue_type": location_row.get("frequent_venue_type"),
            "weekend_sports_visitor": location_row.get("weekend_sports_visitor"),
        }

    demographics_row = loaded.get("demographics")
    if demographics_row:
        enrichment["demographics"] = {
            "source": _first_value(demographics_row, ["partner_source"]) or "DataBridge",
            "party": _first_value(demographics_row, ["data_party"]) or "3P",
            "match_key": _first_value(demographics_row, ["match_key"]) or "golden_id",
            "estimated_age_range": demographics_row.get("estimated_age_range"),
            "estimated_income_band": demographics_row.get("estimated_income_band"),
            "household_size": demographics_row.get("household_size"),
            "education_level": demographics_row.get("education_level"),
            "homeowner_flag": demographics_row.get("homeowner_flag"),
            "presence_of_children": demographics_row.get("presence_of_children"),
        }

    ltv_row = loaded.get("ltv_propensity")
    if ltv_row:
        enrichment["ltv_propensity"] = {
            "source": _first_value(ltv_row, ["partner_source"]) or "TrueSignal",
            "party": _first_value(ltv_row, ["data_party"]) or "3P",
            "match_key": _first_value(ltv_row, ["match_key"]) or "golden_id",
            "ltv_score": ltv_row.get("ltv_score"),
            "ltv_band": ltv_row.get("ltv_band"),
            "churn_propensity_score": ltv_row.get("churn_propensity_score"),
            "upsell_propensity_score": ltv_row.get("upsell_propensity_score"),
            "predicted_annual_value": ltv_row.get("predicted_annual_value"),
            "segment_code": ltv_row.get("segment_code"),
        }

    return {
        "golden_id": str(golden_id).upper(),
        "enrichment": enrichment,
        "sources_matched": list(enrichment.keys()),
        "sources_available": ["fan_scores", "location", "demographics", "ltv_propensity"],
    }


@app.route("/api/enrichment/profile/<golden_id>", methods=["GET"])
def get_enrichment_profile(golden_id):
    import hashlib

    source = _request_source()
    golden_id = golden_id.upper()
    gr, _cluster_id, cluster_rows = _profile_context_for_golden_id(
        source,
        golden_id,
    )
    if not gr:
        return jsonify(
            {
                "golden_id": golden_id,
                "enrichment": {},
                "profile_metrics": {
                    "ltv_available": False,
                    "ltv_source_system": source,
                    "ltv_unavailable_reason": "Customer profile was not found.",
                },
            }
        )

    profile_metrics = _profile_metrics_for_profile(source, gr, cluster_rows)

    if source == "automotive":
        auto_enrichment = _automotive_profile_enrichment(gr) or {
            "enrichment": {},
            "sections": [],
            "sources_matched": [],
            "sources_available": [],
        }
        return jsonify(
            {
                "golden_id": golden_id,
                "profile_metrics": profile_metrics,
                **auto_enrichment,
            }
        )

    if uc_enabled():
        payload = _uc_profile_enrichment(golden_id, gr, source)
        payload["profile_metrics"] = profile_metrics
        return jsonify(payload)

    email = gr.get("email", "").strip().lower()
    phone = gr.get("phone", "").strip().replace("-", "")
    device_id = gr.get("device_id", "").strip()
    zip_code = gr.get("zip", "").strip()[:5]
    phone_prefix = phone[:3] if len(phone) >= 3 else ""
    email_hash = hashlib.sha256(email.encode()).hexdigest() if email else ""
    enrichment = {}

    fan_path = ENRICHMENT_DIR / "2p_fan_scores.csv"
    if fan_path.exists() and email:
        with open(fan_path, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("email", "").strip().lower() == email:
                    enrichment["fan_scores"] = {
                        "source": "SportsIQ",
                        "party": "ML",
                        "match_key": "email",
                        "fan_score": row.get("fan_score"),
                        "preferred_team": row.get("preferred_team"),
                        "content_affinity": row.get("content_affinity"),
                        "venue_visits_12m": row.get("venue_visits_12m"),
                        "merchandise_spend_band": row.get("merchandise_spend_band"),
                        "fantasy_participation": row.get("fantasy_participation"),
                    }
                    break

    loc_path = ENRICHMENT_DIR / "2p_location_data.csv"
    if loc_path.exists() and device_id:
        with open(loc_path, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("device_id", "").strip() == device_id:
                    enrichment["location"] = {
                        "source": "GeoSignal",
                        "party": "3P",
                        "match_key": "device_id",
                        "home_dma": row.get("home_dma"),
                        "stadium_visits_12m": row.get("stadium_visits_12m"),
                        "travel_radius_miles": row.get("travel_radius_miles"),
                        "frequent_venue_type": row.get("frequent_venue_type"),
                        "weekend_sports_visitor": row.get("weekend_sports_visitor"),
                    }
                    break

    demo_path = ENRICHMENT_DIR / "3p_demographics.csv"
    if demo_path.exists() and zip_code and phone_prefix:
        with open(demo_path, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("zip", "") == zip_code and row.get("phone_prefix", "") == phone_prefix:
                    enrichment["demographics"] = {
                        "source": "DataBridge",
                        "party": "3P",
                        "match_key": "zip+phone_prefix",
                        "estimated_age_range": row.get("estimated_age_range"),
                        "estimated_income_band": row.get("estimated_income_band"),
                        "household_size": row.get("household_size"),
                        "education_level": row.get("education_level"),
                        "homeowner_flag": row.get("homeowner_flag"),
                        "presence_of_children": row.get("presence_of_children"),
                    }
                    break

    ltv_path = ENRICHMENT_DIR / "3p_ltv_propensity.csv"
    if ltv_path.exists() and email_hash:
        with open(ltv_path, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("email_sha256", "") == email_hash:
                    enrichment["ltv_propensity"] = {
                        "source": "TrueSignal",
                        "party": "ML",
                        "match_key": "email_sha256",
                        "ltv_score": row.get("ltv_score"),
                        "ltv_band": row.get("ltv_band"),
                        "churn_propensity_score": row.get("churn_propensity_score"),
                        "upsell_propensity_score": row.get("upsell_propensity_score"),
                        "predicted_annual_value": row.get("predicted_annual_value"),
                        "segment_code": row.get("segment_code"),
                    }
                    break

    return jsonify(
        {
            "golden_id": golden_id,
            "enrichment": enrichment,
            "profile_metrics": profile_metrics,
            "sources_matched": list(enrichment.keys()),
            "sources_available": ["fan_scores", "location", "demographics", "ltv_propensity"],
        }
    )

# ---------------------------------------------------------------------------
# API: Preprocessed / Standardized
# ---------------------------------------------------------------------------
@app.route("/api/preprocessed/preview", methods=["GET"])
def preprocessed_preview():
    return jsonify(_csv_preview(_get_preprocessed_csv(_request_source()), request.args.get("limit", 100, type=int)))


@app.route("/api/standardized/preview", methods=["GET"])
def standardized_preview():
    return jsonify(_csv_preview(_get_standardized_csv(_request_source()), request.args.get("limit", 100, type=int)))


@app.route("/api/standardized/sources", methods=["GET"])
def standardized_sources():
    source = _request_source()
    sources = []
    for fname in _discover_sources():
        if _source_system_for_file(fname) != source:
            continue
        safe_name = Path(fname).name
        std_path = STD_DIR / source / f"standardized_{safe_name}"
        pre_path = PRE_DIR / source / f"preprocessed_{safe_name}"
        sources.append(
            {
                "name": fname,
                "display_name": _source_display_name(fname),
                "raw_rows": _csv_row_count(GEN_DIR / fname),
                "preprocessed_rows": _csv_row_count(pre_path),
                "standardized_rows": _csv_row_count(std_path),
                "standardized_columns": _csv_columns(std_path),
            }
        )
    return jsonify(sources)


# ---------------------------------------------------------------------------
# API: Blocking Config
# ---------------------------------------------------------------------------
@app.route("/api/blocking-config", methods=["GET"])
def get_blocking_config():
    data = _read_json(BLOCKING_CFG)
    if data is None:
        return jsonify({"error": "Config not found"}), 404
    return jsonify(data)


@app.route("/api/blocking-config", methods=["PUT"])
def update_blocking_config():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    profile_flag = ROOT / ".profile_mode"
    if profile_flag.exists():
        return jsonify(
            {
                "error": "Identity graph configuration is disabled. A complete customer profile has been ingested — use segmentation directly.",
                "profile_mode": True,
            }
        ), 403
    cls_cfg = _read_json(DATA_CLASSIFICATION_CFG) or {}
    classification = cls_cfg.get("classification", {})
    non_1p = [f for f, c in classification.items() if c.get("party") in ("2P", "3P") and c.get("use_for_identity", False)]
    if non_1p:
        return jsonify(
            {
                "error": f"Validation failed: 2P/3P sources cannot be used for identity resolution — {', '.join(non_1p)}",
                "rejected_sources": non_1p,
            }
        ), 400
    with open(BLOCKING_CFG, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return jsonify({"message": "Blocking config updated", "validated": True})


def _read_enhanced_identity_config(source=None):
    config_path = _enhanced_identity_config_path(source or _request_source())
    if not config_path.exists():
        return None
    with open(config_path, "r", encoding="utf-8") as handle:
        return yaml.safe_load(handle) or {}


def _write_enhanced_identity_config(data, source=None):
    selected_source = source or _request_source()
    config_path = (
        _enhanced_identity_config_override_path(selected_source)
        if uc_enabled()
        else _enhanced_identity_config_base_path(selected_source)
    )
    config_path.parent.mkdir(parents=True, exist_ok=True)
    with open(config_path, "w", encoding="utf-8") as handle:
        if uc_enabled():
            json.dump(data, handle, indent=2)
        else:
            yaml.safe_dump(data, handle, sort_keys=False, allow_unicode=False)


def _validate_enhanced_identity_config(data):
    features = data.get("features") or {}
    weights = []
    for settings in features.values():
        if isinstance(settings, dict) and "weight" in settings:
            try:
                weights.append(float(settings.get("weight") or 0))
            except (TypeError, ValueError):
                return "Feature weights must be numeric"
    if weights and round(sum(weights), 2) != 100:
        return f"Feature weights must add up to 100. Current total is {round(sum(weights), 2)}"
    return None


@app.route("/api/enhanced-identity/config", methods=["GET"])
def get_enhanced_identity_config():
    source = _request_source()
    data = _read_enhanced_identity_config(source)
    if data is None:
        return jsonify({"error": f"Identity config not found for {source}"}), 404
    return jsonify(data)


@app.route("/api/enhanced-identity/config", methods=["PUT"])
def update_enhanced_identity_config():
    source = _request_source()
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    validation_error = _validate_enhanced_identity_config(data)
    if validation_error:
        return jsonify({"error": validation_error}), 400
    _write_enhanced_identity_config(data, source)
    _CLUSTER_LIST_CACHE.clear()
    return jsonify({"message": "Identity config updated", "validated": True})


@app.route("/api/enhanced-identity/run", methods=["POST"])
def run_enhanced_identity_pipeline():
    source = _requested_source_system() or _request_source()
    config_path = _enhanced_identity_config_path(source)
    if not config_path.exists():
        return jsonify({"error": f"Identity config not found for {source}"}), 404

    pipeline_steps = ENHANCED_IDENTITY_PIPELINE_STEPS
    run_id = uuid.uuid4().hex
    queued_at = datetime.now(timezone.utc).isoformat()

    with _enhanced_pipeline_lock:
        active_step = next(
            (
                step_id
                for step_id, _script in pipeline_steps
                if _run_status.get(step_id, {}).get("status") in {"queued", "running"}
            ),
            None,
        )
        if active_step:
            active_run = _run_status.get(active_step, {})
            return jsonify(
                {
                    "error": (
                        "Identity pipeline is already running for "
                        f"{active_run.get('source_system') or source}"
                    ),
                    "step": active_step,
                    "run_id": active_run.get("run_id"),
                }
            ), 409

        for step_id, script in pipeline_steps:
            _run_status[step_id] = {
                "status": "queued",
                "log": "",
                "source_system": source,
                "run_id": run_id,
                "script": script,
                "queued_at": queued_at,
            }

    def _run_enhanced_pipeline():
        env = os.environ.copy()
        for index, (step_id, script) in enumerate(pipeline_steps):
            step_started_monotonic = time.monotonic()
            step_started_at = datetime.now(timezone.utc).isoformat()
            with _enhanced_pipeline_lock:
                _run_status[step_id] = {
                    **_run_status.get(step_id, {}),
                    "status": "running",
                    "started_at": step_started_at,
                }

            try:
                step_timeout = max(
                    60,
                    int(os.getenv("CODEX_IDENTITY_STEP_TIMEOUT_SECONDS", "3600")),
                )
                result = subprocess.run(
                    [sys.executable, str(ROOT / script), "--config", str(config_path)],
                    capture_output=True,
                    text=True,
                    cwd=str(ROOT),
                    timeout=step_timeout,
                    env=env,
                )
                log = f"Source system: {source}\n$ {script}\n{result.stdout}{result.stderr}"
                status = "done" if result.returncode == 0 else "error"
            except Exception as exc:
                log = f"Source system: {source}\n$ {script}\n{exc}"
                status = "error"

            completed_at = datetime.now(timezone.utc).isoformat()
            duration_seconds = round(time.monotonic() - step_started_monotonic, 1)
            with _enhanced_pipeline_lock:
                _run_status[step_id] = {
                    **_run_status.get(step_id, {}),
                    "status": status,
                    "log": log,
                    "completed_at": completed_at,
                    "duration_seconds": duration_seconds,
                }

                if status == "error":
                    for pending_step_id, pending_script in pipeline_steps[index + 1:]:
                        _run_status[pending_step_id] = {
                            **_run_status.get(pending_step_id, {}),
                            "status": "error",
                            "log": (
                                f"Source system: {source}\n"
                                f"{pending_script} was not run because {script} failed."
                            ),
                            "completed_at": completed_at,
                            "duration_seconds": 0,
                        }
                    _CLUSTER_LIST_CACHE.clear()
                    _invalidate_reporting_caches(source)
                    return

        _CLUSTER_LIST_CACHE.clear()
        _invalidate_reporting_caches(source)
        _purge_standardization_report_snapshot(source)

    threading.Thread(target=_run_enhanced_pipeline, daemon=True).start()
    return jsonify(
        {
            "message": f"Started {source} identity pipeline",
            "source_system": source,
            "run_id": run_id,
            "steps": [step_id for step_id, _script in pipeline_steps],
        }
    ), 202


@app.route("/api/enhanced-identity/run/<run_id>", methods=["GET"])
def enhanced_identity_run_status(run_id):
    """Return in-memory run progress without querying Unity Catalog."""
    with _enhanced_pipeline_lock:
        steps = [
            {
                "id": step_id,
                "name": next(
                    (
                        step.get("name")
                        for step in PIPELINE_STEPS
                        if step.get("id") == step_id
                    ),
                    step_id,
                ),
                **dict(_run_status.get(step_id, {})),
            }
            for step_id, _script in ENHANCED_IDENTITY_PIPELINE_STEPS
            if _run_status.get(step_id, {}).get("run_id") == run_id
        ]

    if not steps:
        return jsonify({"error": f"Identity pipeline run not found: {run_id}"}), 404

    statuses = {step.get("status", "queued") for step in steps}
    if "error" in statuses:
        status = "error"
    elif statuses == {"done"}:
        status = "done"
    elif "running" in statuses:
        status = "running"
    else:
        status = "queued"

    return jsonify(
        {
            "run_id": run_id,
            "source_system": steps[0].get("source_system"),
            "status": status,
            "steps": steps,
        }
    )


# ---------------------------------------------------------------------------
# API: Tag Mappings
# ---------------------------------------------------------------------------
@app.route("/api/tag-mappings", methods=["GET"])
def get_tag_mappings():
    data = _read_json(TAG_MAP)
    if data is None:
        return jsonify({"error": "Not found"}), 404
    return jsonify(data)


@app.route("/api/tag-mappings", methods=["PUT"])
def update_tag_mappings():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400
    with open(TAG_MAP, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return jsonify({"message": "Tag mappings saved"})


# ---------------------------------------------------------------------------
# API: Source Preferences
# ---------------------------------------------------------------------------
@app.route("/api/source-preferences", methods=["GET"])
def get_source_preferences():
    if not SOURCE_PREFS.exists():
        return jsonify({})
    data = _read_json(SOURCE_PREFS)
    return jsonify(data if data else {})


@app.route("/api/source-preferences", methods=["PUT"])
def update_source_preferences():
    data = request.get_json()
    if data is None:
        return jsonify({"error": "No data provided"}), 400
    with open(SOURCE_PREFS, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return jsonify({"message": "Source preferences saved"})


@app.route("/api/canonical-tags-sources", methods=["GET"])
def get_canonical_tags_sources():
    mappings = _read_json(TAG_MAP)
    if not mappings:
        return jsonify({})
    tag_sources = {}
    for source_file, col_map in mappings.items():
        for _col, tag in col_map.items():
            if tag not in tag_sources:
                tag_sources[tag] = []
            if source_file not in tag_sources[tag]:
                tag_sources[tag].append(source_file)
    return jsonify(tag_sources)


# ---------------------------------------------------------------------------
# API: Source Upload & Auto-Tag
# ---------------------------------------------------------------------------
_PROFILE_INDICATOR_COLS = {"golden_id", "full_name", "email", "phone", "ltv_score", "engagement_rate"}
_PROFILE_MINIMUM_MATCH = 4


def _is_complete_profile(columns):
    col_set = {c.lower().strip() for c in columns}
    return len(col_set & _PROFILE_INDICATOR_COLS) >= _PROFILE_MINIMUM_MATCH


def _slugify_source_name(value):
    cleaned = re.sub(r"[^a-z0-9]+", "_", str(value or "").strip().lower()).strip("_")
    return cleaned or "databricks_source"


_SOURCE_SYSTEM_PREFIXES = {
    "automotive": "aut_",
    "sports": "spt_",
    "media": "med_",
    "telecom": "tel_",
}


def _normalize_databricks_source_system(value):
    normalized = str(value or "").strip().lower()
    if normalized not in _SOURCE_SYSTEM_PREFIXES:
        raise DatabricksConnectorError("source_system is required and must be one of: automotive, sports, media, telecom")
    return normalized


def _normalize_source_system(value):
    normalized = str(value or "").strip().lower()
    if normalized not in _SOURCE_SYSTEM_PREFIXES:
        raise ValueError("source_system is required and must be one of: automotive, sports, media, telecom")
    return normalized


def _build_connector_source_filename(source_system, source_name, object_name):
    prefix = _SOURCE_SYSTEM_PREFIXES[_normalize_source_system(source_system)]
    base = _slugify_source_name(source_name or object_name)
    if not base.startswith(prefix):
        base = f"{prefix}{base}"
    return f"{base}.csv"


def _build_databricks_source_filename(source_system, source_name, table):
    return _build_connector_source_filename(source_system, source_name, table)


def _write_rows_to_csv(path, columns, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns, extrasaction="ignore")
        writer.writeheader()
        for row in rows:
            writer.writerow({col: row.get(col, "") for col in columns})


def _databricks_payload():
    return request.get_json(silent=True) or {}


def _databricks_error_response(exc):
    return jsonify({"ok": False, "error": str(exc)}), 400


def _registered_databricks_destination(source_system, relative_name):
    try:
        ref = get_registry().get(relative_name, source=source_system, required=False)
    except Exception:
        return None
    if ref is None:
        return None
    return {
        "catalog": get_databricks_catalog(),
        "schema": ref.schema,
        "table": ref.table,
    }


def _same_databricks_table(catalog, schema, table, destination):
    if not destination:
        return False
    return (
        str(catalog).strip().lower(),
        str(schema).strip().lower(),
        str(table).strip().lower(),
    ) == (
        str(destination["catalog"]).strip().lower(),
        str(destination["schema"]).strip().lower(),
        str(destination["table"]).strip().lower(),
    )


def _connector_payload():
    return request.get_json(silent=True) or {}


def _connector_error_response(exc):
    return jsonify({"ok": False, "error": str(exc)}), 400


def _land_connector_rows(source_system, source_name, object_name, columns, rows):
    normalized_source_system = _normalize_source_system(source_system)
    safe_name = _build_connector_source_filename(normalized_source_system, source_name, object_name)
    relative_name = f"{normalized_source_system}/{safe_name}"
    dest = GEN_DIR / normalized_source_system / safe_name
    _write_rows_to_csv(dest, columns, rows)
    is_profile = _is_complete_profile(columns)
    if is_profile:
        flag = ROOT / ".profile_mode"
        flag.write_text(json.dumps({"source": relative_name, "columns": columns}))
    return {
        "name": relative_name,
        "display_name": _source_display_name(safe_name),
        "columns": columns,
        "rows": len(rows),
        "is_complete_profile": is_profile,
        "source_system": normalized_source_system,
    }


@app.route("/api/profile-mode", methods=["GET"])
def get_profile_mode():
    flag = ROOT / ".profile_mode"
    if flag.exists():
        try:
            info = json.loads(flag.read_text())
        except Exception:
            info = {}
        return jsonify({"profile_mode": True, "source": info.get("source", ""), "columns": info.get("columns", [])})
    return jsonify({"profile_mode": False})


@app.route("/api/profile-mode", methods=["DELETE"])
def clear_profile_mode():
    flag = ROOT / ".profile_mode"
    if flag.exists():
        flag.unlink()
    return jsonify({"message": "Profile mode cleared. Identity graph re-enabled."})


@app.route("/api/sources/upload", methods=["POST"])
def upload_source():
    if "file" not in request.files:
        return jsonify({"error": "No file in request"}), 400
    f = request.files["file"]
    if not f.filename or not f.filename.endswith(".csv"):
        return jsonify({"error": "Only .csv files are supported"}), 400
    safe_name = f.filename.replace(" ", "_").lower()
    dest = GEN_DIR / safe_name
    f.save(str(dest))
    cols = _csv_columns(dest)
    rows = _csv_row_count(dest)
    is_profile = _is_complete_profile(cols)
    if is_profile:
        flag = ROOT / ".profile_mode"
        flag.write_text(json.dumps({"source": safe_name, "columns": cols}))
    return jsonify(
        {
            "name": safe_name,
            "display_name": _source_display_name(safe_name),
            "columns": cols,
            "rows": rows,
            "is_complete_profile": is_profile,
            "message": f"Uploaded {safe_name} ({rows} rows, {len(cols)} columns)"
            + (" — Profile Mode activated: identity graph locked." if is_profile else ""),
        }
    )


@app.route("/api/connectors/databricks/test", methods=["POST"])
def databricks_test_connection():
    try:
        config = databricks_config_from_payload(_databricks_payload())
        catalogs = databricks_list_catalogs(config)
        return jsonify({"ok": True, "connector": "databricks", "catalogs": catalogs})
    except DatabricksConnectorError as exc:
        return _databricks_error_response(exc)


@app.route("/api/connectors/databricks/catalogs", methods=["POST"])
def databricks_catalogs():
    try:
        config = databricks_config_from_payload(_databricks_payload())
        return jsonify({"ok": True, "catalogs": databricks_list_catalogs(config)})
    except DatabricksConnectorError as exc:
        return _databricks_error_response(exc)


@app.route("/api/connectors/databricks/schemas", methods=["POST"])
def databricks_schemas():
    body = _databricks_payload()
    try:
        config = databricks_config_from_payload(body)
        catalog = str(body.get("catalog") or "").strip()
        schemas = databricks_list_schemas(config, catalog)
        return jsonify({"ok": True, "catalog": catalog, "schemas": schemas})
    except DatabricksConnectorError as exc:
        return _databricks_error_response(exc)


@app.route("/api/connectors/databricks/tables", methods=["POST"])
def databricks_tables():
    body = _databricks_payload()
    try:
        config = databricks_config_from_payload(body)
        catalog = str(body.get("catalog") or "").strip()
        schema = str(body.get("schema") or "").strip()
        tables = databricks_list_tables(config, catalog, schema)
        return jsonify({"ok": True, "catalog": catalog, "schema": schema, "tables": tables})
    except DatabricksConnectorError as exc:
        return _databricks_error_response(exc)


@app.route("/api/connectors/databricks/preview", methods=["POST"])
def databricks_preview():
    body = _databricks_payload()
    try:
        config = databricks_config_from_payload(body)
        catalog = str(body.get("catalog") or "").strip()
        schema = str(body.get("schema") or "").strip()
        table = str(body.get("table") or "").strip()
        limit = body.get("limit", 50)
        columns, rows = databricks_preview_table(config, catalog, schema, table, limit=limit)
        return jsonify(
            {
                "ok": True,
                "catalog": catalog,
                "schema": schema,
                "table": table,
                "columns": columns,
                "rows": rows,
            }
        )
    except DatabricksConnectorError as exc:
        return _databricks_error_response(exc)


@app.route("/api/connectors/databricks/ingest", methods=["POST"])
def databricks_ingest():
    body = _databricks_payload()
    try:
        config = databricks_config_from_payload(body)
        catalog = str(body.get("catalog") or "").strip()
        schema = str(body.get("schema") or "").strip()
        table = str(body.get("table") or "").strip()
        source_system = _normalize_databricks_source_system(body.get("source_system") or body.get("sourceSystem"))
        source_name = body.get("source_name")
        row_limit = body.get("row_limit")
        safe_name = _build_databricks_source_filename(source_system, source_name, table)
        relative_name = f"{source_system}/{safe_name}"
        destination = _registered_databricks_destination(source_system, relative_name)
        if (
            destination is None
            and str(catalog).strip().lower() == get_databricks_catalog().lower()
            and str(schema).strip().lower() == get_databricks_schema("sources").lower()
            and str(table).strip().lower() == Path(safe_name).stem.lower()
        ):
            destination = {
                "catalog": get_databricks_catalog(),
                "schema": get_databricks_schema("sources"),
                "table": table,
            }

        # The Databricks connector commonly browses the same Unity Catalog
        # source tables that already back Data Overview.  Re-reading the whole
        # table into Flask and overwriting that identical table causes minutes
        # of latency, 504s, and partial-write risk.  Treat it as registration.
        if _same_databricks_table(catalog, schema, table, destination):
            columns, row_count = databricks_table_summary(
                config,
                catalog,
                schema,
                table,
            )
            return jsonify(
                {
                    "ok": True,
                    "already_registered": True,
                    "name": relative_name,
                    "display_name": _source_display_name(safe_name),
                    "columns": columns,
                    "rows": row_count,
                    "is_complete_profile": _is_complete_profile(columns),
                    "catalog": catalog,
                    "schema": schema,
                    "table": table,
                    "source_system": source_system,
                    "message": (
                        f"{catalog}.{schema}.{table} is already connected to "
                        f"{relative_name}; no data copy was required."
                    ),
                }
            )

        columns, rows = databricks_fetch_table_rows(config, catalog, schema, table, limit=row_limit)
        dest = GEN_DIR / source_system / safe_name
        _write_rows_to_csv(dest, columns, rows)
        is_profile = _is_complete_profile(columns)
        if is_profile:
            flag = ROOT / ".profile_mode"
            flag.write_text(json.dumps({"source": relative_name, "columns": columns}))
        return jsonify(
            {
                "ok": True,
                "name": relative_name,
                "display_name": _source_display_name(safe_name),
                "columns": columns,
                "rows": len(rows),
                "is_complete_profile": is_profile,
                "catalog": catalog,
                "schema": schema,
                "table": table,
                "source_system": source_system,
                "message": f"Ingested Databricks table {catalog}.{schema}.{table} into {relative_name}",
            }
        )
    except DatabricksConnectorError as exc:
        return _databricks_error_response(exc)


@app.route("/api/connectors/postgresql/test", methods=["POST"])
def postgresql_test():
    try:
        config = postgres_config_from_payload(_connector_payload())
        return jsonify({"ok": True, **postgres_test_connection(config)})
    except PostgresConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/postgresql/schemas", methods=["POST"])
def postgresql_schemas():
    try:
        config = postgres_config_from_payload(_connector_payload())
        return jsonify({"ok": True, "schemas": postgres_list_schemas(config)})
    except PostgresConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/postgresql/tables", methods=["POST"])
def postgresql_tables():
    body = _connector_payload()
    try:
        config = postgres_config_from_payload(body)
        schema = str(body.get("schema") or "").strip()
        return jsonify({"ok": True, "schema": schema, "tables": postgres_list_tables(config, schema)})
    except PostgresConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/postgresql/preview", methods=["POST"])
def postgresql_preview():
    body = _connector_payload()
    try:
        config = postgres_config_from_payload(body)
        schema = str(body.get("schema") or "").strip()
        table = str(body.get("table") or "").strip()
        limit = body.get("limit", 10)
        columns, rows = postgres_preview_table(config, schema, table, limit=limit)
        return jsonify({"ok": True, "schema": schema, "table": table, "columns": columns, "rows": rows})
    except PostgresConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/postgresql/ingest", methods=["POST"])
def postgresql_ingest():
    body = _connector_payload()
    try:
        config = postgres_config_from_payload(body)
        schema = str(body.get("schema") or "").strip()
        table = str(body.get("table") or "").strip()
        source_system = body.get("source_system") or body.get("sourceSystem")
        source_name = body.get("source_name")
        row_limit = body.get("row_limit")
        columns, rows = postgres_fetch_table_rows(config, schema, table, limit=row_limit)
        landed = _land_connector_rows(source_system, source_name, table, columns, rows)
        return jsonify({"ok": True, "schema": schema, "table": table, **landed, "message": f"Ingested PostgreSQL table {schema}.{table} into {landed['name']}"})
    except (PostgresConnectorError, ValueError) as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/mysql/test", methods=["POST"])
def mysql_test():
    try:
        config = mysql_config_from_payload(_connector_payload())
        return jsonify({"ok": True, **mysql_test_connection(config)})
    except MySQLConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/mysql/schemas", methods=["POST"])
def mysql_schemas():
    try:
        config = mysql_config_from_payload(_connector_payload())
        return jsonify({"ok": True, "schemas": mysql_list_schemas(config)})
    except MySQLConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/mysql/tables", methods=["POST"])
def mysql_tables():
    body = _connector_payload()
    try:
        config = mysql_config_from_payload(body)
        schema = str(body.get("schema") or "").strip()
        return jsonify({"ok": True, "schema": schema, "tables": mysql_list_tables(config, schema)})
    except MySQLConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/mysql/preview", methods=["POST"])
def mysql_preview():
    body = _connector_payload()
    try:
        config = mysql_config_from_payload(body)
        schema = str(body.get("schema") or "").strip()
        table = str(body.get("table") or "").strip()
        limit = body.get("limit", 10)
        columns, rows = mysql_preview_table(config, schema, table, limit=limit)
        return jsonify({"ok": True, "schema": schema, "table": table, "columns": columns, "rows": rows})
    except MySQLConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/mysql/ingest", methods=["POST"])
def mysql_ingest():
    body = _connector_payload()
    try:
        config = mysql_config_from_payload(body)
        schema = str(body.get("schema") or "").strip()
        table = str(body.get("table") or "").strip()
        source_system = body.get("source_system") or body.get("sourceSystem")
        source_name = body.get("source_name")
        row_limit = body.get("row_limit")
        columns, rows = mysql_fetch_table_rows(config, schema, table, limit=row_limit)
        landed = _land_connector_rows(source_system, source_name, table, columns, rows)
        return jsonify({"ok": True, "schema": schema, "table": table, **landed, "message": f"Ingested MySQL table {schema}.{table} into {landed['name']}"})
    except (MySQLConnectorError, ValueError) as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/rest_api/test", methods=["POST"])
def rest_api_test():
    try:
        config = rest_api_config_from_payload(_connector_payload())
        return jsonify({"ok": True, **rest_api_test_connection(config)})
    except RestAPIConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/rest_api/endpoints", methods=["POST"])
def rest_api_endpoints():
    try:
        config = rest_api_config_from_payload(_connector_payload())
        return jsonify({"ok": True, "endpoints": rest_api_list_endpoints(config)})
    except RestAPIConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/rest_api/preview", methods=["POST"])
def rest_api_preview():
    body = _connector_payload()
    try:
        config = rest_api_config_from_payload(body)
        endpoint = str(body.get("endpoint") or "").strip()
        limit = body.get("limit", 10)
        columns, rows = rest_api_preview_endpoint(config, endpoint, limit=limit)
        return jsonify({"ok": True, "endpoint": endpoint, "columns": columns, "rows": rows})
    except RestAPIConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/rest_api/ingest", methods=["POST"])
def rest_api_ingest():
    body = _connector_payload()
    try:
        config = rest_api_config_from_payload(body)
        endpoint = str(body.get("endpoint") or "").strip()
        source_system = body.get("source_system") or body.get("sourceSystem")
        source_name = body.get("source_name")
        columns, rows = rest_api_fetch_endpoint_rows(config, endpoint)
        object_name = endpoint.strip("/").replace("/", "_") or "api_resource"
        landed = _land_connector_rows(source_system, source_name, object_name, columns, rows)
        return jsonify({"ok": True, "endpoint": endpoint, **landed, "message": f"Ingested REST API endpoint {endpoint} into {landed['name']}"})
    except (RestAPIConnectorError, ValueError) as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/azure_blob/test", methods=["POST"])
def azure_blob_test():
    try:
        config = azure_blob_config_from_payload(_connector_payload())
        return jsonify({"ok": True, **azure_blob_test_connection(config)})
    except AzureBlobConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/azure_blob/objects", methods=["POST"])
def azure_blob_objects():
    body = _connector_payload()
    try:
        config = azure_blob_config_from_payload(body)
        prefix = str(body.get("prefix") or config.prefix or "").strip()
        return jsonify({"ok": True, "objects": azure_blob_list_objects(config, prefix=prefix), "prefix": prefix})
    except AzureBlobConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/azure_blob/preview", methods=["POST"])
def azure_blob_preview():
    body = _connector_payload()
    try:
        config = azure_blob_config_from_payload(body)
        object_name = str(body.get("object_name") or "").strip()
        limit = body.get("limit", 10)
        columns, rows = azure_blob_preview_object(config, object_name, limit=limit)
        return jsonify({"ok": True, "object_name": object_name, "columns": columns, "rows": rows})
    except AzureBlobConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/azure_blob/ingest", methods=["POST"])
def azure_blob_ingest():
    body = _connector_payload()
    try:
        config = azure_blob_config_from_payload(body)
        object_name = str(body.get("object_name") or "").strip()
        source_system = body.get("source_system") or body.get("sourceSystem")
        source_name = body.get("source_name")
        columns, rows = azure_blob_fetch_object_rows(config, object_name)
        landed = _land_connector_rows(source_system, source_name, Path(object_name).stem, columns, rows)
        return jsonify({"ok": True, "object_name": object_name, **landed, "message": f"Ingested Azure Blob object {object_name} into {landed['name']}"})
    except (AzureBlobConnectorError, ValueError) as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/amazon_s3/test", methods=["POST"])
def amazon_s3_test():
    try:
        config = s3_config_from_payload(_connector_payload())
        return jsonify({"ok": True, **s3_test_connection(config)})
    except S3ConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/amazon_s3/objects", methods=["POST"])
def amazon_s3_objects():
    body = _connector_payload()
    try:
        config = s3_config_from_payload(body)
        prefix = str(body.get("prefix") or config.prefix or "").strip()
        return jsonify({"ok": True, "objects": s3_list_objects(config, prefix=prefix), "prefix": prefix})
    except S3ConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/amazon_s3/preview", methods=["POST"])
def amazon_s3_preview():
    body = _connector_payload()
    try:
        config = s3_config_from_payload(body)
        object_name = str(body.get("object_name") or "").strip()
        limit = body.get("limit", 10)
        columns, rows = s3_preview_object(config, object_name, limit=limit)
        return jsonify({"ok": True, "object_name": object_name, "columns": columns, "rows": rows})
    except S3ConnectorError as exc:
        return _connector_error_response(exc)


@app.route("/api/connectors/amazon_s3/ingest", methods=["POST"])
def amazon_s3_ingest():
    body = _connector_payload()
    try:
        config = s3_config_from_payload(body)
        object_name = str(body.get("object_name") or "").strip()
        source_system = body.get("source_system") or body.get("sourceSystem")
        source_name = body.get("source_name")
        columns, rows = s3_fetch_object_rows(config, object_name)
        landed = _land_connector_rows(source_system, source_name, Path(object_name).stem, columns, rows)
        return jsonify({"ok": True, "object_name": object_name, **landed, "message": f"Ingested S3 object {object_name} into {landed['name']}"})
    except (S3ConnectorError, ValueError) as exc:
        return _connector_error_response(exc)


@app.route("/api/sources/<path:name>/auto-tag", methods=["POST"])
def auto_tag_source(name):
    path = _source_path(name)
    if not path.exists():
        return jsonify({"error": "Source file not found"}), 404
    threshold = request.args.get("threshold", 0.35, type=float)
    cols = _csv_columns(path)
    tagger = _get_tagger()
    if tagger is None:
        return jsonify({"error": "SemanticTagger not available. Install sentence-transformers."}), 503
    results = tagger.tag_columns(cols, threshold=threshold)
    return jsonify({"source": name, "threshold": threshold, "columns": results, "vocabulary_size": len(tagger.get_vocabulary())})


@app.route("/api/sources/<path:name>/delete", methods=["DELETE"])
def delete_source(name):
    path = _source_path(name)
    if path.exists():
        os.remove(str(path))
    tag_data = _read_json(TAG_MAP) or {}
    if name in tag_data:
        del tag_data[name]
        with open(TAG_MAP, "w", encoding="utf-8") as f:
            json.dump(tag_data, f, indent=2)
    return jsonify({"message": f"Deleted {name}"})


@app.route("/api/tag-vocabulary", methods=["GET"])
def get_tag_vocabulary():
    tagger = _get_tagger()
    if tagger is None:
        return jsonify({"error": "SemanticTagger not available"}), 503
    return jsonify(tagger.get_vocabulary())


# ---------------------------------------------------------------------------
# API: Evaluation / Summary
# ---------------------------------------------------------------------------
@app.route("/api/evaluation", methods=["GET"])
def get_evaluation():
    data = _read_json(_get_evaluation_report(_request_source()))
    if data is None:
        return jsonify({"error": "Run evaluation first"}), 404
    return jsonify(data)


@app.route("/api/summary", methods=["GET"])
def get_summary():
    source = _normalize_cluster_source(request.args.get("source", DEFAULT_CLUSTER_SOURCE))
    return jsonify(
        {
            "cluster_source": source,
            "cluster": _read_json(_get_cluster_summary(source)) or {},
            "golden": _read_json(_get_golden_summary(source)) or {},
            "evaluation": _read_json(_get_evaluation_report(source)) or {},
        }
    )


# ---------------------------------------------------------------------------
# API: Golden Records
# ---------------------------------------------------------------------------
@app.route("/api/golden-records", methods=["GET"])
def get_golden_records():
    source = _request_source()
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 50, type=int)
    search = request.args.get("search", "").upper()
    rows = _complete_golden_profile_rows(source)
    if not rows:
        return jsonify({"columns": [], "rows": [], "total": 0, "page": page})
    cols = list(rows[0].keys())
    if search:
        rows = [
            row
            for row in rows
            if any(search in str(value).upper() for value in row.values())
        ]
    rows.sort(key=lambda r: (int(r.get("diversity_score", 0)), int(r.get("record_count", 0))), reverse=True)
    total = len(rows)
    start = (page - 1) * limit
    return jsonify({"columns": cols, "rows": rows[start:start + limit], "total": total, "page": page, "pages": (total + limit - 1) // limit})


@app.route("/api/golden-records/<golden_id>/superseded", methods=["GET"])
def get_superseded(golden_id):
    source = _request_source()
    superseded_csv = _get_superseded_csv(source)
    if not superseded_csv.exists():
        return jsonify({"columns": [], "rows": []})
    return jsonify(_csv_search(superseded_csv, "golden_id", golden_id, limit=500))


@app.route("/api/golden-records/<golden_id>/provenance", methods=["GET"])
def get_provenance(golden_id):
    data = _read_json(_get_provenance_json(_request_source()))
    if not data:
        return jsonify({"error": "Provenance data not found. Re-run step 5."}), 404
    prov = data.get(golden_id.upper())
    if not prov:
        return jsonify({"error": f"No provenance for {golden_id}"}), 404
    return jsonify(prov)


@app.route("/api/golden-records/<golden_id>/activity/<path:record_id>", methods=["GET"])
def get_activity_detail(golden_id, record_id):
    """Return labeled raw source fields for a single customer activity.

    :param golden_id: Golden record identifier.
    :type golden_id: str
    :param record_id: Source-system record identifier.
    :type record_id: str
    :returns: JSON payload with ordered display fields for the activity modal.
    :rtype: flask.Response
    """
    source = _request_source()
    golden_id = golden_id.upper()
    record_id_raw = str(record_id or "").strip()
    record_id_key = record_id_raw.upper()

    try:
        bridge_row = _lookup_superseded_record(
            golden_id,
            record_id_key,
            source=source,
        )
    except DatabricksDataAccessError:
        return jsonify(
            {
                "error": "Activity details are temporarily unavailable",
                "retryable": True,
                "source_system": source,
            }
        ), 503
    # The bridge proves ownership for the normal path. Only read the profile
    # cluster when the bridge is absent or a generated record id cannot join
    # back to its raw source key.
    clustered_row = None
    if bridge_row is None:
        try:
            clustered_row = _activity_clustered_row_for_golden(
                golden_id,
                record_id_raw,
                source=source,
            )
        except DatabricksDataAccessError:
            return jsonify(
                {
                    "error": "Activity details are temporarily unavailable",
                    "retryable": True,
                    "source_system": source,
                }
            ), 503
        if clustered_row is None:
            return jsonify({"error": "Activity not found for this customer"}), 404

    source_file = (
        str((bridge_row or {}).get("source_file") or "").strip()
        or str((clustered_row or {}).get("source_file") or "").strip()
    )
    raw_row, resolved_source = _fetch_raw_row(
        record_id_raw,
        source_file=source_file or None,
        source=source,
    )
    if not raw_row and clustered_row is None:
        try:
            clustered_row = _activity_clustered_row_for_golden(
                golden_id,
                record_id_raw,
                source=source,
            )
        except DatabricksDataAccessError:
            return jsonify(
                {
                    "error": "Activity details are temporarily unavailable",
                    "retryable": True,
                    "source_system": source,
                }
            ), 503
        if not source_file:
            source_file = str((clustered_row or {}).get("source_file") or "").strip()
    if not raw_row and clustered_row:
        for id_column, alternate_id in _activity_raw_id_candidates(
            clustered_row,
            source_file,
        ):
            # Preserve source-key casing. Some governed string keys are
            # case-sensitive even though ownership comparisons are not.
            if str(alternate_id).strip() == record_id_raw:
                continue
            raw_row, resolved_source = _fetch_raw_row(
                alternate_id,
                source_file=source_file or None,
                source=source,
                id_column=id_column,
            )
            if raw_row:
                break
    if not raw_row:
        # A clustered row is a governed artifact and remains a valid activity
        # detail fallback when its originating raw row is unavailable.
        raw_row = dict(clustered_row or {})
        resolved_source = source_file or resolved_source
    if not raw_row:
        return jsonify({"error": f"No source data found for record {record_id_raw}"}), 404

    resolved_source = resolved_source or Path(str(source_file or "")).name
    config_by_source = _load_activity_detail_fields_by_source()
    field_specs = config_by_source.get(resolved_source, [])
    source_label = (
        field_specs[0].get("source_label", "")
        if field_specs
        else _source_display_name(resolved_source)
    )

    fields = []
    seen_keys = set()
    for spec in field_specs:
        key = str(spec.get("field_key", "") or "").strip()
        if not key or key in seen_keys:
            continue
        value = raw_row.get(key, "")
        if value is None or str(value).strip() == "":
            continue
        seen_keys.add(key)
        fields.append(
            {
                "key": key,
                "label": spec.get("field_label") or _activity_detail_field_label(key),
                "value": str(value).strip(),
            }
        )

    if not fields:
        id_column = _source_id_column(resolved_source)
        for key, value in raw_row.items():
            if not key or key == id_column:
                continue
            if key.lower() in _ACTIVITY_DETAIL_PII_COLUMNS:
                continue
            if value is None or str(value).strip() == "":
                continue
            fields.append(
                {
                    "key": key,
                    "label": _activity_detail_field_label(key),
                    "value": str(value).strip(),
                }
            )

    return jsonify(
        {
            "golden_id": golden_id,
            "record_id": record_id_key,
            "source_file": resolved_source,
            "source_label": source_label or _source_display_name(resolved_source),
            "fields": fields,
        }
    )


# ---------------------------------------------------------------------------
# API: Match Deep Dive
# ---------------------------------------------------------------------------
@app.route("/api/match/sources", methods=["GET"])
def match_sources():
    tables = []
    for fname in _discover_sources():
        if (STD_DIR / f"standardized_{fname}").exists():
            tables.append({"name": fname, "display_name": fname.replace(".csv", "").replace("_", " ").title()})
    return jsonify(tables)


@app.route("/api/match/pairs", methods=["GET"])
def match_pairs():
    source = _request_source()
    source1 = request.args.get("source1", "")
    source2 = request.args.get("source2", "")
    match_type = request.args.get("match_type", "")
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 50, type=int)
    candidate_pairs_csv = _get_candidate_pairs_csv(source)
    if not candidate_pairs_csv.exists():
        return jsonify({"columns": [], "rows": [], "total": 0})
    prefix_map = {
        "subscription_billing.csv": "SB-",
        "streaming_activity.csv": "SA-",
        "app_events.csv": "AE-",
        "customer_support.csv": "CS-",
        "email_engagement.csv": "EE-",
    }
    p1 = prefix_map.get(source1, "")
    p2 = prefix_map.get(source2, "")
    rows = []
    with open(candidate_pairs_csv, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        cols = reader.fieldnames or []
        for row in reader:
            rid1 = row.get("record_id_1", "")
            rid2 = row.get("record_id_2", "")
            if p1 and p2:
                if not ((rid1.startswith(p1) and rid2.startswith(p2)) or (rid1.startswith(p2) and rid2.startswith(p1))):
                    continue
            elif p1:
                if not (rid1.startswith(p1) or rid2.startswith(p1)):
                    continue
            if match_type:
                row_match_type = row.get("relationship_classification") or row.get("edge_type", row.get("match_tier", ""))
                if row_match_type.lower() != match_type.lower():
                    continue
            rows.append(row)
    total = len(rows)
    start = (page - 1) * limit
    return jsonify({"columns": cols, "rows": rows[start:start + limit], "total": total, "page": page, "pages": (total + limit - 1) // limit})


_IDENTITY_FIELDS = get_payload_value("legacy_runtime.yml", "legacy_runtime", "_IDENTITY_FIELDS")
_std_index = None


@app.route("/api/cache/clear", methods=["POST"])
def clear_cache():
    global _std_index
    _std_index = None
    return jsonify({"message": "Cache cleared"})


def _get_std_index():
    global _std_index
    if _std_index is not None:
        return _std_index
    _std_index = {}
    std_path = STD_DIR / "all_standardized.csv"
    if not std_path.exists():
        return _std_index
    with open(std_path, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = row.get("record_id", "")
            if rid:
                _std_index[rid] = {k: v for k, v in row.items() if k in _IDENTITY_FIELDS}
    return _std_index


@app.route("/api/match/pair-detail", methods=["GET"])
def match_pair_detail():
    rid1 = request.args.get("record_id_1", "").upper()
    rid2 = request.args.get("record_id_2", "").upper()
    idx = _get_std_index()
    return jsonify({"record_1": idx.get(rid1, {}), "record_2": idx.get(rid2, {}), "fields": _IDENTITY_FIELDS})


# ---------------------------------------------------------------------------
# API: Record Trace
# ---------------------------------------------------------------------------
def _golden_cluster_record_count(source, cluster_id):
    golden_csv = _get_golden_csv(source)
    if not golden_csv.exists():
        return 0
    target = str(cluster_id or "").upper()
    try:
        with open(golden_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("cluster_id", "").upper() == target:
                    return _safe_int(row.get("record_count"))
    except Exception:
        return 0
    return 0


def _display_tier_from_confidence(score):
    try:
        score = float(score)
    except (TypeError, ValueError):
        return "weak"
    if score >= 83:
        return "exact"
    if score >= 77:
        return "strong"
    if score >= 69:
        return "medium"
    return "weak"


def _populate_cluster_candidate_stats(
    cluster_sizes,
    record_cluster_map,
    candidate_pairs_csv,
):
    """Populate graph-list edge statistics without materializing full CSV rows.

    The result is intentionally equivalent to Karthik's row-by-row candidate
    loop. Selecting only the columns used by the graph list keeps the endpoint
    within the Databricks Apps request window for large candidate artifacts.
    """
    candidate_headers = list(
        pd.read_csv(candidate_pairs_csv, nrows=0).columns.astype(str)
    )
    required_columns = {"record_id_1", "record_id_2"}
    if not required_columns.issubset(candidate_headers):
        return

    optional_columns = {
        "relationship_classification",
        "edge_type",
        "match_tier",
        "final_confidence",
    }
    selected_columns = [
        column
        for column in candidate_headers
        if column in required_columns or column in optional_columns
    ]
    pairs = pd.read_csv(
        candidate_pairs_csv,
        usecols=selected_columns,
        dtype=str,
        low_memory=False,
    ).fillna("")

    if "relationship_classification" in pairs:
        pairs = pairs.loc[
            ~pairs["relationship_classification"].isin(
                {"SAME_HOUSEHOLD", "REVIEW_QUEUE", "NO_MERGE"}
            )
        ].copy()
    if pairs.empty:
        return

    left_clusters = pairs["record_id_1"].map(record_cluster_map)
    right_clusters = pairs["record_id_2"].map(record_cluster_map)
    in_cluster = left_clusters.notna() & left_clusters.eq(right_clusters)
    if not bool(in_cluster.any()):
        return

    pairs = pairs.loc[in_cluster].copy()
    pairs["_cluster_id"] = left_clusters.loc[in_cluster].astype(str)
    tier = pd.Series("", index=pairs.index, dtype="object")
    if "edge_type" in pairs:
        tier = pairs["edge_type"].astype(str)
    if "match_tier" in pairs:
        missing_tier = tier.eq("")
        tier.loc[missing_tier] = pairs.loc[missing_tier, "match_tier"].astype(str)
    missing_tier = tier.eq("")
    if bool(missing_tier.any()):
        if "final_confidence" in pairs:
            tier.loc[missing_tier] = pairs.loc[
                missing_tier,
                "final_confidence",
            ].map(_display_tier_from_confidence)
        else:
            tier.loc[missing_tier] = "weak"
    pairs["_tier"] = tier

    edge_counts = pairs["_cluster_id"].value_counts()
    tier_counts = pairs.groupby("_cluster_id")["_tier"].nunique()
    for cluster_id, edge_count in edge_counts.items():
        cluster = cluster_sizes.get(str(cluster_id))
        if cluster is None:
            continue
        cluster["edge_count"] = int(edge_count)
        cluster["tier_variety"] = int(tier_counts.get(cluster_id, 0))


def _relationship_counts_for_source(source):
    summary = _read_json(_get_cluster_summary(source)) or {}
    counts = summary.get("relationship_counts")
    if counts:
        return {
            "SAME_PERSON": int(counts.get("SAME_PERSON", 0) or 0),
            "SAME_HOUSEHOLD": int(counts.get("SAME_HOUSEHOLD", 0) or 0),
            "REVIEW_QUEUE": int(counts.get("REVIEW_QUEUE", 0) or 0),
            "NO_MERGE": int(counts.get("NO_MERGE", 0) or 0),
        }
    skipped = summary.get("skipped_edge_counts", {}) or {}
    return {
        "SAME_PERSON": int(summary.get("accepted_edge_count", 0) or 0),
        "SAME_HOUSEHOLD": int(summary.get("household_link_count", skipped.get("SAME_HOUSEHOLD", 0)) or 0),
        "REVIEW_QUEUE": int(skipped.get("REVIEW_QUEUE", 0) or 0),
        "NO_MERGE": int(skipped.get("NO_MERGE", 0) or 0),
    }


SPORTS_ACTIVITY_GRAPH_SOURCES = {"Ticketing", "Orders", "Streaming", "App", "Marketing"}


def _graph_node_has_value(value):
    return bool(str(value or "").strip())


def _graph_node_identity_score(node):
    score = 0
    if _graph_node_has_value(node.get("email_standardized") or node.get("email")):
        score += 40
    if _graph_node_has_value(node.get("phone_standardized") or node.get("phone")):
        score += 30
    if _graph_node_has_value(node.get("first_name")) and _graph_node_has_value(node.get("last_name")):
        score += 20
    if _graph_node_has_value(node.get("address_standardized") or node.get("address")) and _graph_node_has_value(node.get("zip")):
        score += 10
    return score


def _graph_activity_timestamp_value(node):
    timestamp = str(node.get("activity_timestamp") or "").strip()
    if not timestamp:
        return datetime.min
    try:
        return datetime.fromisoformat(timestamp.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return datetime.min


def _sports_activity_group_key(node):
    if node.get("source_label") not in SPORTS_ACTIVITY_GRAPH_SOURCES:
        return ""

    source_label = node.get("source_label") or node.get("source") or ""
    email = str(node.get("email_standardized") or node.get("email") or "").strip().lower()
    phone = str(node.get("phone_standardized") or node.get("phone") or "").strip().lower()
    first = str(node.get("first_name") or "").strip().lower()
    last = str(node.get("last_name") or "").strip().lower()
    address = str(node.get("address_standardized") or node.get("address") or "").strip().lower()
    zip_code = str(node.get("zip") or "").strip().lower()

    if email:
        return "|".join([source_label, "email", email])
    if phone:
        return "|".join([source_label, "phone", phone])
    if first and last and zip_code:
        return "|".join([source_label, "name_zip", first, last, zip_code])
    if address and zip_code:
        return "|".join([source_label, "address_zip", address, zip_code])
    return ""


def _choose_sports_activity_representative(nodes):
    return sorted(
        nodes,
        key=lambda node: (_graph_activity_timestamp_value(node), _graph_node_identity_score(node)),
        reverse=True,
    )[0]


def _display_edge_key(edge):
    source_id = str(edge.get("source") or "")
    target_id = str(edge.get("target") or "")
    if not source_id or not target_id:
        return ""
    return "||".join(sorted([source_id, target_id]))


def _display_edge_strength(edge):
    tier_rank = {"exact": 4, "strong": 3, "medium": 2, "weak": 1, "household": 0}
    tier = edge.get("tier") or edge.get("match_tier") or edge.get("edge_type") or "weak"
    return tier_rank.get(tier, 0) * 1000 + float(edge.get("score") or edge.get("final_confidence") or 0)


def _combine_match_field_text(left, right):
    fields = []
    seen = set()
    for value in [left, right]:
        separator = "|" if "|" in str(value or "") else "+"
        for field in str(value or "").split(separator):
            cleaned = field.strip()
            if cleaned and cleaned not in seen:
                seen.add(cleaned)
                fields.append(cleaned)
    return "|".join(fields)


def _group_sports_activity_graph(nodes, edges):
    """Collapse repeated Sports activity rows for graph display only."""
    groups = defaultdict(list)
    display_nodes = []
    record_to_display_id = {}

    for node in nodes:
        group_key = _sports_activity_group_key(node)
        if group_key:
            groups[group_key].append(node)
        else:
            display_nodes.append(node)
            record_to_display_id[node.get("id")] = node.get("id")

    for grouped_nodes in groups.values():
        representative = _choose_sports_activity_representative(grouped_nodes)
        display_node = dict(representative)
        display_node["grouped_record_ids"] = [node.get("id") for node in grouped_nodes if node.get("id")]
        display_node["grouped_record_count"] = len(display_node["grouped_record_ids"])
        display_nodes.append(display_node)
        for node in grouped_nodes:
            if node.get("id"):
                record_to_display_id[node.get("id")] = display_node.get("id")

    display_edges = {}
    for edge in edges:
        source_id = record_to_display_id.get(edge.get("source"), edge.get("source"))
        target_id = record_to_display_id.get(edge.get("target"), edge.get("target"))
        if not source_id or not target_id or source_id == target_id:
            continue

        display_edge = dict(edge)
        display_edge["source"] = source_id
        display_edge["target"] = target_id
        key = _display_edge_key(display_edge)
        if not key:
            continue

        existing = display_edges.get(key)
        if not existing or _display_edge_strength(display_edge) > _display_edge_strength(existing):
            if existing:
                display_edge["matched_fields"] = _combine_match_field_text(
                    existing.get("matched_fields"),
                    display_edge.get("matched_fields"),
                )
            display_edges[key] = display_edge
        elif existing:
            existing["matched_fields"] = _combine_match_field_text(
                existing.get("matched_fields"),
                display_edge.get("matched_fields"),
            )

    return display_nodes, list(display_edges.values())


@app.route("/api/trace/<record_id>", methods=["GET"])
def trace_record(record_id):
    source = _normalize_cluster_source(request.args.get("source", DEFAULT_CLUSTER_SOURCE))
    clustered_csv = _get_clustered_csv(source)
    candidate_pairs_csv = _get_candidate_pairs_csv(source)
    superseded_csv = _get_superseded_csv(source)
    golden_csv = _get_golden_csv(source)

    record_id = record_id.upper()
    result = {"record_id": record_id, "cluster_source": source, "steps": {}}

    gt = _read_json(GROUND_TRUTH) or {}
    customer_id = gt.get(record_id)
    all_records = [rid for rid, cid in gt.items() if cid == customer_id] if customer_id is not None else []
    result["steps"]["ground_truth"] = {"customer_id": customer_id, "total_records": len(all_records), "sibling_records": all_records[:20]}

    raw_data, raw_source = _search_raw_by_record_id(record_id, limit=1)
    if raw_data["rows"]:
        result["steps"]["raw_source"] = {"source_file": raw_source, "data": raw_data["rows"][0]}

    data = _csv_search(PRE_DIR / "all_preprocessed.csv", "record_id", record_id, limit=1)
    if data["rows"]:
        result["steps"]["preprocessed"] = data["rows"][0]

    data = _csv_search(STD_DIR / "all_standardized.csv", "record_id", record_id, limit=1)
    if data["rows"]:
        result["steps"]["standardized"] = data["rows"][0]

    if candidate_pairs_csv.exists():
        pairs = []
        with open(candidate_pairs_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("record_id_1") == record_id or row.get("record_id_2") == record_id:
                    pairs.append(row)
                    if len(pairs) >= 50:
                        break
        result["steps"]["candidate_pairs"] = pairs

    data = _csv_search(clustered_csv, "record_id", record_id, limit=1)
    if data["rows"]:
        cluster_id = data["rows"][0].get("cluster_id", "")
        result["steps"]["cluster"] = {"cluster_id": cluster_id, "record": data["rows"][0]}

    if superseded_csv.exists():
        sup = _csv_search(superseded_csv, "record_id", record_id, limit=1)
        if sup["rows"]:
            gid = sup["rows"][0].get("golden_id", "")
            gr = _csv_search(golden_csv, "golden_id", gid, limit=1)
            result["steps"]["golden_record"] = {"golden_id": gid, "data": gr["rows"][0] if gr["rows"] else {}}

    return jsonify(result)


def _candidate_rows_for_cluster(candidate_pairs_csv, record_ids, chunk_size=100_000):
    """Read in-cluster candidates in source order with a row-wise fallback."""
    if not candidate_pairs_csv.exists() or not record_ids:
        return []

    try:
        reader = pd.read_csv(
            candidate_pairs_csv,
            dtype=str,
            low_memory=False,
            chunksize=chunk_size,
        )
        chunks = [reader] if isinstance(reader, pd.DataFrame) else reader
        rows = []
        for chunk in chunks:
            if not {"record_id_1", "record_id_2"}.issubset(chunk.columns):
                raise ValueError(
                    "Candidate-pair artifact is missing record endpoint columns."
                )
            in_cluster = (
                chunk["record_id_1"].isin(record_ids)
                & chunk["record_id_2"].isin(record_ids)
            )
            if bool(in_cluster.any()):
                rows.extend(
                    chunk.loc[in_cluster].fillna("").to_dict(orient="records")
                )
        return rows
    except Exception:
        rows = []
        with open(candidate_pairs_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if (
                    row.get("record_id_1", "") in record_ids
                    and row.get("record_id_2", "") in record_ids
                ):
                    rows.append(row)
        return rows


# ---------------------------------------------------------------------------
# API: ID Graph
# ---------------------------------------------------------------------------
@app.route("/api/graph/<cluster_id>", methods=["GET"])
def get_graph(cluster_id):
    source = _normalize_cluster_source(request.args.get("source", DEFAULT_CLUSTER_SOURCE))
    clustered_csv = _get_clustered_csv(source)
    candidate_pairs_csv = _get_candidate_pairs_csv(source)




    cluster_id = cluster_id.upper()

    if not clustered_csv.exists() and source in {"automotive", "telecom"}:
        graph = _automotive_graph_data() if source == "automotive" else _telecom_graph_data()
        nodes = _annotate_resolved_node_names(graph["clusters"].get(cluster_id, []))
        edges = graph["edges"].get(cluster_id, [])
        household_id = next((n.get("household_id", "") for n in nodes if n.get("household_id")), "")
        return jsonify({
            "cluster_source": source,
            "nodes": nodes,
            "edges": edges,
            "cluster_id": cluster_id,
            "household_id": household_id,
        })

    if not clustered_csv.exists():
        return jsonify({"cluster_source": source, "nodes": [], "edges": [], "cluster_id": cluster_id, "household_id": ""})

    expected_record_count = _golden_cluster_record_count(source, cluster_id)
    indexed_rows = _indexed_cluster_nodes(source, cluster_id)
    if expected_record_count and indexed_rows and len(indexed_rows) != expected_record_count:
        indexed_rows = []
    if not indexed_rows:
        indexed_cluster = (_read_json(_get_cluster_index(source)) or {}).get(cluster_id, {})
        indexed_rows = indexed_cluster.get("nodes") or []
        if expected_record_count and indexed_rows and len(indexed_rows) != expected_record_count:
            indexed_rows = []
    if indexed_rows:
        records = {"columns": list(indexed_rows[0].keys()), "rows": indexed_rows}
    else:
        records = _csv_search(clustered_csv, "cluster_id", cluster_id, limit=500)
    record_ids = {r["record_id"] for r in records["rows"]}

    #source_map = {"SB": "Billing", "SA": "Streaming", "AE": "App", "CS": "Support", "EE": "Email"}


    node_map = {}
    for r in records["rows"]:
        rid = r.get("record_id", "")
        if rid and rid not in node_map:
            node_map[rid] = _identity_node(r)

    nodes = list(node_map.values())

    edges = []
    for row in _candidate_rows_for_cluster(candidate_pairs_csv, record_ids):
        r1 = row.get("record_id_1", "")
        r2 = row.get("record_id_2", "")
        relationship = row.get("relationship_classification", "")
        if relationship in {"SAME_HOUSEHOLD", "REVIEW_QUEUE", "NO_MERGE"}:
            continue
        score = row.get("final_confidence", row.get("score", 0))
        edge = {
            "source": r1,
            "target": r2,
            "score": float(score or 0),
            "tier": row.get("edge_type") or row.get("match_tier") or _display_tier_from_confidence(score),
            "relationship": row.get("edge_type") or row.get("match_tier") or relationship,
        }
        feature_suffixes = ("_confidence", "_weight", "_contribution")
        edge_detail_keys = [
            key
            for key in row.keys()
            if key.endswith(feature_suffixes)
            or key
            in {
                "raw_confidence",
                "matching_person_feature_count",
                "final_confidence",
                "decision_reason",
            }
        ]
        for key in edge_detail_keys:
            if key in row:
                edge[key] = row.get(key, "")
        for old_key, new_key in [
            ("support_confidence", "probabilistic_confidence"),
            ("support_weight", "probabilistic_weight"),
            ("support_contribution", "probabilistic_contribution"),
        ]:
            if old_key in edge and new_key not in edge:
                edge[new_key] = edge[old_key]
        if row.get("matched_fields"):
            edge["matched_fields"] = row.get("matched_fields", "")
        if row.get("matching_techniques"):
            edge["matching_techniques"] = row.get("matching_techniques", "")
        edges.append(edge)

    household_id = ""
    governed_display_name = ""
    household_links = []
    golden_csv = _get_golden_csv(source)
    if golden_csv.exists():
        with open(golden_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                if row.get("cluster_id", "").upper() == cluster_id:
                    household_id = row.get("household_id", "")
                    governed_display_name = _normalize_golden_row(
                        row,
                        source,
                    ).get("full_name", "")
                    break

    household_links_csv = _get_household_links_csv(source)
    if household_links_csv.exists():
        with open(household_links_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                r1 = row.get("record_id_1", "")
                r2 = row.get("record_id_2", "")
                if r1 in record_ids or r2 in record_ids:
                    household_links.append(
                        {
                            "record_id_1": r1,
                            "record_id_2": r2,
                            "relationship": row.get("relationship_classification", "SAME_HOUSEHOLD"),
                            "address_confidence": row.get("address_confidence", ""),
                            "final_confidence": row.get("final_confidence", ""),
                        }
                    )

    if source == "sports":
        nodes, edges = _group_sports_activity_graph(nodes, edges)

    nodes = _annotate_resolved_node_names(
        nodes,
        governed_name=governed_display_name,
    )

    return jsonify({
        "cluster_source": source,
        "nodes": nodes,
        "edges": edges,
        "cluster_id": cluster_id,
        "record_count": expected_record_count or len(nodes),
        "household_id": household_id,
        "household_links": household_links,
        "household_link_count": len(household_links),
    })



@app.route("/api/clusters", methods=["GET"])
def list_clusters():
    source = _normalize_cluster_source(request.args.get("source", DEFAULT_CLUSTER_SOURCE))
    clustered_csv = _get_clustered_csv(source)

    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 50, type=int)
    min_size = request.args.get("min_size", 2, type=int)
    search = request.args.get("search", "").upper()

    if not clustered_csv.exists() and source in {"automotive", "telecom"}:
        graph = _automotive_graph_data() if source == "automotive" else _telecom_graph_data()
        clusters = []
        for cid, nodes in graph["clusters"].items():
            if len(nodes) < min_size:
                continue
            edges = graph["edges"].get(cid, [])
            sample = nodes[0] if nodes else {}
            clusters.append({
                "cluster_id": cid,
                "size": len(nodes),
                "sample_email": sample.get("email", ""),
                "sample_name": sample.get("full_name", ""),
                "golden_id": cid.replace("CL", "GR"),
                "household_id": next((n.get("household_id", "") for n in nodes if n.get("household_id")), ""),
                "source_count": len({n.get("source", "") for n in nodes if n.get("source")}),
                "edge_count": len(edges),
                "tier_variety": len({e.get("tier", "") for e in edges if e.get("tier")}),
            })
        if search:
            clusters = [
                c for c in clusters
                if search in c["cluster_id"]
                or search in c.get("sample_email", "").upper()
                or search in c.get("sample_name", "").upper()
                or search in c.get("household_id", "").upper()
            ]
        clusters.sort(
            key=lambda x: (
                x.get("tier_variety", 0),
                x.get("source_count", 0),
                x["size"],
                x.get("edge_count", 0),
            ),
            reverse=True,
        )
        total = len(clusters)
        start = (page - 1) * limit
        return jsonify({
            "cluster_source": source,
            "clusters": clusters[start:start + limit],
            "relationship_counts": _relationship_counts_for_source(source),
            "cluster_summary": _read_json(_get_cluster_summary(source)) or {},
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
        })

    if not clustered_csv.exists():
        return jsonify({"cluster_source": source, "clusters": [], "total": 0, "page": page, "pages": 0})

    golden_csv = _get_golden_csv(source)
    candidate_pairs_csv = _get_candidate_pairs_csv(source)
    cluster_index_json = _get_cluster_index(source)

    if source == "automotive" and golden_csv.exists():
        clusters = _indexed_cluster_list(source)
        if clusters is None:
            index_data = _read_json(cluster_index_json) or {}
            clusters = []
            with open(golden_csv, "r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    cid = row.get("cluster_id", "")
                    if not cid:
                        continue
                    source_files = [s for s in row.get("source_files", "").split("|") if s]
                    indexed = index_data.get(cid, {})
                    clusters.append(
                        {
                            "cluster_id": cid,
                            "size": int(indexed.get("unique_node_count") or row.get("record_count", 0) or 0),
                            "sample_email": row.get("email", "") or indexed.get("sample_email", ""),
                            "sample_name": row.get("full_name", "") or indexed.get("sample_name", "") or " ".join(
                                part for part in [row.get("first_name", ""), row.get("last_name", "")] if part
                            ),
                            "golden_id": row.get("golden_id", ""),
                            "household_id": row.get("household_id", ""),
                            "source_count": int(indexed.get("source_count") or len(set(source_files))),
                            "edge_count": 0,
                            "tier_variety": 0,
                        }
                    )
        clusters = [c for c in clusters if c["size"] >= min_size]
        if search:
            clusters = [
                c
                for c in clusters
                if search in c["cluster_id"]
                or search in c.get("golden_id", "").upper()
                or search in c.get("sample_email", "").upper()
                or search in c.get("sample_name", "").upper()
                or search in c.get("household_id", "").upper()
            ]
        clusters.sort(key=lambda x: (x.get("source_count", 0), x["size"]), reverse=True)
        total = len(clusters)
        start = (page - 1) * limit
        return jsonify(
            {
                "cluster_source": source,
                "clusters": clusters[start:start + limit],
                "relationship_counts": _relationship_counts_for_source(source),
                "cluster_summary": _read_json(_get_cluster_summary(source)) or {},
                "total": total,
                "page": page,
                "pages": (total + limit - 1) // limit,
            }
        )

    cache_key = (
        source,
        _file_signature(clustered_csv, candidate_pairs_csv, golden_csv),
    )
    cached = _CLUSTER_LIST_CACHE.get(cache_key)
    if cached is not None:
        clusters = cached
    else:
        golden_household_map = {}
        cluster_golden_map = {}
        if golden_csv.exists():
            with open(golden_csv, "r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    cid = row.get("cluster_id", "")
                    gid = row.get("golden_id", "")
                    hid = row.get("household_id", "")
                    if cid and gid:
                        cluster_golden_map[cid] = gid
                    if gid and hid:
                        golden_household_map[gid] = hid

        cluster_sizes = {}
        record_cluster_map = {}
        with open(clustered_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                cid = row.get("cluster_id", "")
                if not cid:
                    continue
                rid = row.get("record_id", "")
                if rid:
                    record_cluster_map[rid] = cid
                if cid not in cluster_sizes:
                    gid = cluster_golden_map.get(cid, "")
                    cluster_sizes[cid] = {
                        "cluster_id": cid,
                        "size": 0,
                        "sample_email": "",
                        "sample_name": "",
                        "golden_id": gid,
                        "household_id": golden_household_map.get(gid, ""),
                        "source_count": 0,
                        "edge_count": 0,
                        "tier_variety": 0,
                        "_sources": set(),
                        "_tiers": set(),
                    }
                cluster_sizes[cid]["size"] += 1
                if row.get("source_file"):
                    cluster_sizes[cid]["_sources"].add(get_source(row.get("source_file", "")))
                if not cluster_sizes[cid]["sample_email"] and row.get("email"):
                    cluster_sizes[cid]["sample_email"] = row.get("email", "")
                if not cluster_sizes[cid]["sample_name"] and (row.get("full_name") or row.get("first_name") or row.get("last_name")):
                    cluster_sizes[cid]["sample_name"] = row.get("full_name", "") or " ".join(
                        part for part in [row.get("first_name", ""), row.get("last_name", "")] if part
                    )

        if candidate_pairs_csv.exists():
            try:
                _populate_cluster_candidate_stats(
                    cluster_sizes,
                    record_cluster_map,
                    candidate_pairs_csv,
                )
            except Exception:
                # Preserve the reference row-wise behavior for unusual legacy
                # artifacts that cannot be projected through pandas.
                with open(candidate_pairs_csv, "r", encoding="utf-8") as f:
                    for row in csv.DictReader(f):
                        relationship = row.get("relationship_classification", "")
                        if relationship in {"SAME_HOUSEHOLD", "REVIEW_QUEUE", "NO_MERGE"}:
                            continue
                        cid1 = record_cluster_map.get(row.get("record_id_1", ""))
                        cid2 = record_cluster_map.get(row.get("record_id_2", ""))
                        if cid1 and cid1 == cid2 and cid1 in cluster_sizes:
                            cluster_sizes[cid1]["edge_count"] += 1
                            tier = row.get("edge_type") or row.get("match_tier") or _display_tier_from_confidence(row.get("final_confidence", 0))
                            if tier:
                                cluster_sizes[cid1]["_tiers"].add(tier)

        for cluster in cluster_sizes.values():
            cluster["source_count"] = len(cluster["_sources"])
            if not cluster.get("tier_variety"):
                cluster["tier_variety"] = len(cluster["_tiers"])
            del cluster["_sources"]
            del cluster["_tiers"]

        clusters = list(cluster_sizes.values())
        clusters.sort(
            key=lambda x: (
                x.get("tier_variety", 0),
                x.get("source_count", 0),
                x["size"],
                x.get("edge_count", 0),
            ),
            reverse=True,
        )
        _CLUSTER_LIST_CACHE.clear()
        _CLUSTER_LIST_CACHE[cache_key] = clusters

    clusters = [c for c in clusters if c["size"] >= min_size]
    if search:
        clusters = [
            c
            for c in clusters
            if search in c["cluster_id"]
            or search in c.get("sample_email", "").upper()
            or search in c.get("sample_name", "").upper()
            or search in c.get("household_id", "").upper()
        ]
    total = len(clusters)
    start = (page - 1) * limit

    return jsonify(
        {
            "cluster_source": source,
            "clusters": clusters[start:start + limit],
            "relationship_counts": _relationship_counts_for_source(source),
            "cluster_summary": _read_json(_get_cluster_summary(source)) or {},
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
        }
    )

    golden_household_map = {}
    cluster_golden_map = {}
    if GOLDEN_CSV.exists():
        with open(GOLDEN_CSV, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                cid = row.get("cluster_id", "")
                gid = row.get("golden_id", "")
                hid = row.get("household_id", "")
                if cid and gid:
                    cluster_golden_map[cid] = gid
                if gid and hid:
                    golden_household_map[gid] = hid

    cluster_sizes = {}
    with open(clustered_csv, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cid = row.get("cluster_id", "")
            if cid not in cluster_sizes:
                gid = cluster_golden_map.get(cid, "")
                cluster_sizes[cid] = {
                    "cluster_id": cid,
                    "size": 0,
                    "sample_email": "",
                    "sample_name": "",
                    "golden_id": gid,
                    "household_id": golden_household_map.get(gid, ""),
                    "source_count": 0,
                    "edge_count": 0,
                    "tier_variety": 0,
                    "_sources": set(),
                    "_tiers": set(),
                }
            cluster_sizes[cid]["size"] += 1
            if row.get("source_file"):
                cluster_sizes[cid]["_sources"].add(get_source(row.get("source_file", "")))
            if not cluster_sizes[cid]["sample_email"] and row.get("email"):
                cluster_sizes[cid]["sample_email"] = row.get("email", "")
            if not cluster_sizes[cid]["sample_name"] and row.get("full_name"):
                cluster_sizes[cid]["sample_name"] = row.get("full_name", "")

    record_cluster_map = {}
    with open(clustered_csv, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = row.get("record_id", "")
            cid = row.get("cluster_id", "")
            if rid and cid:
                record_cluster_map[rid] = cid

    candidate_pairs_csv = _get_candidate_pairs_csv(source)
    if candidate_pairs_csv.exists():
        with open(candidate_pairs_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                cid1 = record_cluster_map.get(row.get("record_id_1", ""))
                cid2 = record_cluster_map.get(row.get("record_id_2", ""))
                if cid1 and cid1 == cid2 and cid1 in cluster_sizes:
                    cluster_sizes[cid1]["edge_count"] += 1
                    tier = row.get("edge_type", row.get("match_tier", "weak"))
                    if tier:
                        cluster_sizes[cid1]["_tiers"].add(tier)

    for cluster in cluster_sizes.values():
        cluster["source_count"] = len(cluster["_sources"])
        cluster["tier_variety"] = len(cluster["_tiers"])
        del cluster["_sources"]
        del cluster["_tiers"]

    clusters = [c for c in cluster_sizes.values() if c["size"] >= min_size]
    if search:
        clusters = [
            c
            for c in clusters
            if search in c["cluster_id"]
            or search in c.get("sample_email", "").upper()
            or search in c.get("sample_name", "").upper()
            or search in c.get("household_id", "").upper()
        ]
    clusters.sort(
        key=lambda x: (
            x.get("tier_variety", 0),
            x.get("source_count", 0),
            x["size"],
            x.get("edge_count", 0),
        ),
        reverse=True,
    )
    total = len(clusters)
    start = (page - 1) * limit

    return jsonify(
        {
            "cluster_source": source,
            "clusters": clusters[start:start + limit],
            "relationship_counts": _relationship_counts_for_source(source),
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
        }
    )


# ---------------------------------------------------------------------------
# API: Standardization Summary
# ---------------------------------------------------------------------------
def _standardization_rules():
    return [
        {
            "id": "email-hygiene",
            "field": "Email",
            "rule_type": "Correction",
            "template": "Email hygiene",
            "rule": "Fix domain typos, preserve plus addressing, exclude generic patterns, and normalize case",
        },
        {
            "id": "phone-format",
            "field": "Phone",
            "rule_type": "Formatting",
            "template": "US phone",
            "rule": "Strip country code (+1), remove non-digits, and normalize to 000-000-0000 format",
        },
        {
            "id": "name-normalization",
            "field": "Name",
            "rule_type": "Normalization",
            "template": "Person name",
            "rule": "Trim and uppercase names while preserving nicknames for fuzzy matching",
        },
        {
            "id": "address-normalization",
            "field": "Address",
            "rule_type": "Parsing",
            "template": "US address",
            "rule": "Parse addresses, expand common abbreviations, and normalize address, city, and state case",
        },
        {
            "id": "date-iso",
            "field": "Date",
            "rule_type": "Parsing",
            "template": "ISO date",
            "rule": "Parse supported date and timestamp formats and normalize to ISO-8601 (YYYY-MM-DD)",
        },
        {
            "id": "zip-format",
            "field": "ZIP",
            "rule_type": "Formatting",
            "template": "US ZIP",
            "rule": "Strip ZIP+4 suffix, retain digits, and zero-pad to five digits",
        },
    ]


def _standardization_rule_for_field(field):
    if field in {"customer_id", "account_id", "loyalty_id", "vehicle_id", "device_id"}:
        return None
    if field == "email":
        return "Email"
    if field == "phone":
        return "Phone"
    if field in {"full_name", "first_name", "last_name"}:
        return "Name"
    if field in {"address", "city", "state"}:
        return "Address"
    if field == "date_of_birth":
        return "Date"
    if field == "zip":
        return "ZIP"
    return None


def _format_standardization_phone(value):
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) == 11 and digits.startswith("1"):
        digits = digits[1:]
    if len(digits) == 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6:]}"
    return value


def _standardization_display_row(row):
    display_row = dict(row or {})
    if display_row.get("phone"):
        display_row["phone"] = _format_standardization_phone(display_row.get("phone"))
    return display_row


def _standardization_demo_comparisons(source):
    examples = {
        "media": [
            {
                "record_id": "MED-DQ-0001",
                "source": "Subscription Billing",
                "fields": ["email", "full_name", "phone", "address", "city", "state", "zip"],
                "raw": {
                    "email": "samuel.french+spring@gmial.com",
                    "full_name": "sam french",
                    "phone": "+1 (212) 555-0148",
                    "address": "221 W 45th St Apt 8b",
                    "city": "new york",
                    "state": "ny",
                    "zip": "10011-4421",
                },
                "standardized": {
                    "email": "SAMUEL.FRENCH+SPRING@GMAIL.COM",
                    "full_name": "SAM FRENCH",
                    "phone": "2125550148",
                    "address": "221 WEST 45TH STREET APARTMENT 8B",
                    "city": "NEW YORK",
                    "state": "NY",
                    "zip": "10011",
                },
                "changes": {
                    "email": ["Domain fixed", "Plus addressing preserved", "Uppercased"],
                    "full_name": ["Trimmed", "Uppercased"],
                    "phone": ["Country code stripped", "Digits extracted"],
                    "address": ["Abbreviations expanded", "Apartment normalized", "Uppercased"],
                    "city": ["Uppercased"],
                    "state": ["Uppercased"],
                    "zip": ["ZIP+4 stripped"],
                },
            },
            {
                "record_id": "MED-DQ-0002",
                "source": "Streaming Activity",
                "fields": ["email", "full_name", "device_id", "zip"],
                "raw": {
                    "email": "kayla.williams@@outlook.com",
                    "full_name": "Kayla   Williams",
                    "device_id": " roku-7788 ",
                    "zip": "60613-2100",
                },
                "standardized": {
                    "email": "KAYLA.WILLIAMS@OUTLOOK.COM",
                    "full_name": "KAYLA WILLIAMS",
                    "device_id": "ROKU-7788",
                    "zip": "60613",
                },
                "changes": {
                    "email": ["Double @ fixed", "Uppercased"],
                    "full_name": ["Whitespace collapsed", "Uppercased"],
                    "device_id": ["Trimmed", "Uppercased"],
                    "zip": ["ZIP+4 stripped"],
                },
            },
            {
                "record_id": "MED-DQ-0003",
                "source": "App Events",
                "fields": ["email", "first_name", "last_name", "phone", "city", "state", "zip"],
                "raw": {
                    "email": "marco.diaz@hotmial.com",
                    "first_name": "marco",
                    "last_name": "diaz",
                    "phone": "646.555.0199",
                    "city": "brooklyn",
                    "state": "ny",
                    "zip": "11215-0902",
                },
                "standardized": {
                    "email": "MARCO.DIAZ@HOTMAIL.COM",
                    "first_name": "MARCO",
                    "last_name": "DIAZ",
                    "phone": "6465550199",
                    "city": "BROOKLYN",
                    "state": "NY",
                    "zip": "11215",
                },
                "changes": {
                    "email": ["Domain fixed", "Uppercased"],
                    "first_name": ["Uppercased"],
                    "last_name": ["Uppercased"],
                    "phone": ["Digits extracted"],
                    "city": ["Uppercased"],
                    "state": ["Uppercased"],
                    "zip": ["ZIP+4 stripped"],
                },
            },
        ],
        "sports": [
            {
                "record_id": "SPO-DQ-0001",
                "source": "Fan Account",
                "fields": ["customer_id", "account_id", "loyalty_id", "email", "full_name", "date_of_birth", "phone", "zip"],
                "raw": {
                    "customer_id": " fan-102884 ",
                    "account_id": "acc-66014",
                    "loyalty_id": "loy-80122",
                    "email": "gerald.larson109@hotmail,com",
                    "full_name": "Gerald  Larson",
                    "date_of_birth": "11/02/1974",
                    "phone": "(602) 555-0155",
                    "zip": "85004-1182",
                },
                "standardized": {
                    "customer_id": "FAN-102884",
                    "account_id": "ACC-66014",
                    "loyalty_id": "LOY-80122",
                    "email": "GERALD.LARSON109@HOTMAIL.COM",
                    "full_name": "GERALD LARSON",
                    "date_of_birth": "1974-11-02",
                    "phone": "6025550155",
                    "zip": "85004",
                },
                "changes": {
                    "customer_id": ["Trimmed", "Uppercased"],
                    "account_id": ["Uppercased"],
                    "loyalty_id": ["Uppercased"],
                    "email": ["Domain punctuation fixed", "Uppercased"],
                    "full_name": ["Whitespace collapsed", "Uppercased"],
                    "date_of_birth": ["Parsed to ISO date"],
                    "phone": ["Digits extracted"],
                    "zip": ["ZIP+4 stripped"],
                },
            },
            {
                "record_id": "SPO-DQ-0002",
                "source": "Ticket Orders",
                "fields": ["customer_id", "account_id", "email", "first_name", "last_name", "date_of_birth", "phone", "address", "zip"],
                "raw": {
                    "customer_id": "fan-203455",
                    "account_id": " acc-77102 ",
                    "email": "michael.petersen@outlok.com",
                    "first_name": "michael",
                    "last_name": "petersen",
                    "date_of_birth": "19860214",
                    "phone": "+1-480-555-0188",
                    "address": "401 E Jefferson St Ste 12",
                    "zip": "85034-2209",
                },
                "standardized": {
                    "customer_id": "FAN-203455",
                    "account_id": "ACC-77102",
                    "email": "MICHAEL.PETERSEN@OUTLOOK.COM",
                    "first_name": "MICHAEL",
                    "last_name": "PETERSEN",
                    "date_of_birth": "1986-02-14",
                    "phone": "4805550188",
                    "address": "401 EAST JEFFERSON STREET SUITE 12",
                    "zip": "85034",
                },
                "changes": {
                    "customer_id": ["Uppercased"],
                    "account_id": ["Trimmed", "Uppercased"],
                    "email": ["Domain fixed", "Uppercased"],
                    "first_name": ["Uppercased"],
                    "last_name": ["Uppercased"],
                    "date_of_birth": ["Parsed to ISO date"],
                    "phone": ["Country code stripped", "Digits extracted"],
                    "address": ["Abbreviations expanded", "Suite normalized", "Uppercased"],
                    "zip": ["ZIP+4 stripped"],
                },
            },
            {
                "record_id": "SPO-DQ-0003",
                "source": "Loyalty",
                "fields": ["customer_id", "loyalty_id", "email", "full_name", "phone", "device_id", "zip"],
                "raw": {
                    "customer_id": "FAN 331240",
                    "loyalty_id": "LOY- 45011",
                    "email": "tracy.johnson+season@gmial.com",
                    "full_name": "tracy johnson",
                    "phone": "602.555.0174",
                    "device_id": " gaid-0021-8877 ",
                    "zip": "85251-7740",
                },
                "standardized": {
                    "customer_id": "FAN-331240",
                    "loyalty_id": "LOY-45011",
                    "email": "TRACY.JOHNSON+SEASON@GMAIL.COM",
                    "full_name": "TRACY JOHNSON",
                    "phone": "6025550174",
                    "device_id": "GAID-0021-8877",
                    "zip": "85251",
                },
                "changes": {
                    "customer_id": ["Separator normalized", "Uppercased"],
                    "loyalty_id": ["Internal space removed", "Uppercased"],
                    "email": ["Domain fixed", "Plus addressing preserved", "Uppercased"],
                    "full_name": ["Uppercased"],
                    "phone": ["Digits extracted"],
                    "device_id": ["Trimmed", "Uppercased"],
                    "zip": ["ZIP+4 stripped"],
                },
            },
        ],
        "automotive": [
            {
                "record_id": "AUT-DQ-0001",
                "source": "Customer Contacts",
                "fields": ["customer_id", "account_id", "loyalty_id", "vehicle_id", "email", "first_name", "last_name", "date_of_birth", "phone", "zip"],
                "raw": {
                    "customer_id": " cust-101781 ",
                    "account_id": "acct-50611",
                    "loyalty_id": "drive 30767",
                    "vehicle_id": "vin-00000000000627523-23",
                    "email": "maya.patel+dealer@gmial.com",
                    "first_name": "Maya",
                    "last_name": "patel",
                    "date_of_birth": "12/04/1989",
                    "phone": "+1 201.555.1481",
                    "zip": "07030-2231",
                },
                "standardized": {
                    "customer_id": "CUST-101781",
                    "account_id": "ACCT-50611",
                    "loyalty_id": "DRIVE-30767",
                    "vehicle_id": "VIN-00000000000627523-23",
                    "email": "MAYA.PATEL+DEALER@GMAIL.COM",
                    "first_name": "MAYA",
                    "last_name": "PATEL",
                    "date_of_birth": "1989-12-04",
                    "phone": "2015551481",
                    "zip": "07030",
                },
                "changes": {
                    "customer_id": ["Trimmed", "Uppercased"],
                    "account_id": ["Uppercased"],
                    "loyalty_id": ["Separator normalized", "Uppercased"],
                    "vehicle_id": ["Uppercased"],
                    "email": ["Domain fixed", "Plus addressing preserved", "Uppercased"],
                    "first_name": ["Uppercased"],
                    "last_name": ["Uppercased"],
                    "date_of_birth": ["Parsed to ISO date"],
                    "phone": ["Country code stripped", "Digits extracted"],
                    "zip": ["ZIP+4 stripped"],
                },
            },
            {
                "record_id": "AUT-DQ-0002",
                "source": "Sales Transactions",
                "fields": ["customer_id", "account_id", "vehicle_id", "email", "full_name", "phone", "address", "zip"],
                "raw": {
                    "customer_id": "cust 104225",
                    "account_id": " acct-60991 ",
                    "vehicle_id": " vin 5yj3e1ea7kf317000 ",
                    "email": "daniel.hernandez@hotmial.com",
                    "full_name": "daniel hernandez",
                    "phone": "(310)555-7712",
                    "address": "908 Ocean Ave Ste 2",
                    "zip": "90401-3001",
                },
                "standardized": {
                    "customer_id": "CUST-104225",
                    "account_id": "ACCT-60991",
                    "vehicle_id": "VIN-5YJ3E1EA7KF317000",
                    "email": "DANIEL.HERNANDEZ@HOTMAIL.COM",
                    "full_name": "DANIEL HERNANDEZ",
                    "phone": "3105557712",
                    "address": "908 OCEAN AVENUE SUITE 2",
                    "zip": "90401",
                },
                "changes": {
                    "customer_id": ["Separator normalized", "Uppercased"],
                    "account_id": ["Trimmed", "Uppercased"],
                    "vehicle_id": ["Whitespace removed", "Uppercased"],
                    "email": ["Domain fixed", "Uppercased"],
                    "full_name": ["Uppercased"],
                    "phone": ["Digits extracted"],
                    "address": ["Abbreviations expanded", "Suite normalized", "Uppercased"],
                    "zip": ["ZIP+4 stripped"],
                },
            },
            {
                "record_id": "AUT-DQ-0003",
                "source": "Mobile App Sessions",
                "fields": ["customer_id", "vehicle_id", "device_id", "email", "date_of_birth", "phone", "city", "state", "zip"],
                "raw": {
                    "customer_id": "CUST-108440",
                    "vehicle_id": "vin-1HGCM82633A004352",
                    "device_id": " tcu-9481 ",
                    "email": "rachel.osborne@@icloud.com",
                    "date_of_birth": "07-Mar-1991",
                    "phone": "+1 (415) 555 0191",
                    "city": "san francisco",
                    "state": "ca",
                    "zip": "94105-4410",
                },
                "standardized": {
                    "customer_id": "CUST-108440",
                    "vehicle_id": "VIN-1HGCM82633A004352",
                    "device_id": "TCU-9481",
                    "email": "RACHEL.OSBORNE@ICLOUD.COM",
                    "date_of_birth": "1991-03-07",
                    "phone": "4155550191",
                    "city": "SAN FRANCISCO",
                    "state": "CA",
                    "zip": "94105",
                },
                "changes": {
                    "vehicle_id": ["Uppercased"],
                    "device_id": ["Trimmed", "Uppercased"],
                    "email": ["Double @ fixed", "Uppercased"],
                    "date_of_birth": ["Parsed to ISO date"],
                    "phone": ["Country code stripped", "Digits extracted"],
                    "city": ["Uppercased"],
                    "state": ["Uppercased"],
                    "zip": ["ZIP+4 stripped"],
                },
            },
        ],
        "telecom": [
            {
                "record_id": "TEL-DQ-0001",
                "source": "Customer Master",
                "fields": ["customer_id", "account_id", "email", "full_name", "date_of_birth", "phone", "address", "city", "state", "zip"],
                "raw": {
                    "customer_id": " tel-cust-000148 ",
                    "account_id": "tel-acct-000148",
                    "email": "maya.patel+promo@gmial.com",
                    "full_name": "Maya  Patel",
                    "date_of_birth": "12/04/1989",
                    "phone": "+1 201.555.1481",
                    "address": "580 Main St Apt 5b",
                    "city": "hoboken",
                    "state": "nj",
                    "zip": "07030-2231",
                },
                "standardized": {
                    "customer_id": "TEL-CUST-000148",
                    "account_id": "TEL-ACCT-000148",
                    "email": "MAYA.PATEL+PROMO@GMAIL.COM",
                    "full_name": "MAYA PATEL",
                    "date_of_birth": "1989-12-04",
                    "phone": "2015551481",
                    "address": "580 MAIN STREET APARTMENT 5B",
                    "city": "HOBOKEN",
                    "state": "NJ",
                    "zip": "07030",
                },
                "changes": {
                    "customer_id": ["Trimmed", "Uppercased"],
                    "account_id": ["Uppercased"],
                    "email": ["Domain fixed", "Plus addressing preserved", "Uppercased"],
                    "full_name": ["Whitespace collapsed", "Uppercased"],
                    "date_of_birth": ["Parsed to ISO date"],
                    "phone": ["Country code stripped", "Digits extracted"],
                    "address": ["Abbreviations expanded", "Apartment normalized", "Uppercased"],
                    "city": ["Uppercased"],
                    "state": ["Uppercased"],
                    "zip": ["ZIP+4 stripped"],
                },
            },
            {
                "record_id": "TEL-DQ-0002",
                "source": "Billing Account",
                "fields": ["customer_id", "account_id", "email", "phone", "address", "zip"],
                "raw": {
                    "customer_id": "TEL-CUST-000392",
                    "account_id": " tel-acct-000392 ",
                    "email": "daniel.hernandez@hotmal.com",
                    "phone": "(310) 555-7712",
                    "address": "908 Ocean Ave Ste 2",
                    "zip": "90401-3001",
                },
                "standardized": {
                    "customer_id": "TEL-CUST-000392",
                    "account_id": "TEL-ACCT-000392",
                    "email": "DANIEL.HERNANDEZ@HOTMAIL.COM",
                    "phone": "3105557712",
                    "address": "908 OCEAN AVENUE SUITE 2",
                    "zip": "90401",
                },
                "changes": {
                    "account_id": ["Trimmed", "Uppercased"],
                    "email": ["Domain fixed", "Uppercased"],
                    "phone": ["Digits extracted"],
                    "address": ["Abbreviations expanded", "Suite normalized", "Uppercased"],
                    "zip": ["ZIP+4 stripped"],
                },
            },
            {
                "record_id": "TEL-DQ-0003",
                "source": "App Events",
                "fields": ["customer_id", "device_id", "email", "date_of_birth", "phone", "city", "state", "zip"],
                "raw": {
                    "customer_id": "TEL-CUST-000617",
                    "device_id": " tel-dev-000617-1 ",
                    "email": "rachel.osborne@@icloud.com",
                    "date_of_birth": "19910307",
                    "phone": "415.555.0191",
                    "city": "san francisco",
                    "state": "ca",
                    "zip": "94105-4410",
                },
                "standardized": {
                    "customer_id": "TEL-CUST-000617",
                    "device_id": "TEL-DEV-000617-1",
                    "email": "RACHEL.OSBORNE@ICLOUD.COM",
                    "date_of_birth": "1991-03-07",
                    "phone": "4155550191",
                    "city": "SAN FRANCISCO",
                    "state": "CA",
                    "zip": "94105",
                },
                "changes": {
                    "device_id": ["Trimmed", "Uppercased"],
                    "email": ["Double @ fixed", "Uppercased"],
                    "date_of_birth": ["Parsed to ISO date"],
                    "phone": ["Digits extracted"],
                    "city": ["Uppercased"],
                    "state": ["Uppercased"],
                    "zip": ["ZIP+4 stripped"],
                },
            },
        ],
    }
    return examples.get(source, [])


def _standardization_demo_payload(source):
    rules = _standardization_rules()
    comparisons = []
    field_examples = {r["field"]: [] for r in rules}

    for example in _standardization_demo_comparisons(source):
        changes = example.get("changes", {})
        transform_count = len(changes)
        standardized_display = _standardization_display_row(example.get("standardized", {}))
        comparison = {
            **example,
            "standardized": standardized_display,
            "preprocessed": {},
            "talk_track": "Curated data-quality example used by the standardization demo",
            "transform_count": transform_count,
        }
        comparisons.append(comparison)

        for field, labels in changes.items():
            rule_field = _standardization_rule_for_field(field)
            if not rule_field:
                continue
            raw = example.get("raw", {}).get(field, "")
            fixed = standardized_display.get(field, "")
            if raw == "" and fixed == "":
                continue
            label = ", ".join(labels) if isinstance(labels, list) else str(labels)
            field_examples.setdefault(rule_field, []).append(
                {
                    "record_id": example.get("record_id", ""),
                    "raw": raw,
                    "fixed": fixed,
                    "label": label,
                }
            )

    return {"comparisons": comparisons, "rules": rules, "field_examples": field_examples}


def _merge_standardization_examples(source, dynamic_comparisons):
    demo_payload = _standardization_demo_payload(source)
    demo_comparisons = demo_payload.get("comparisons", [])
    if not demo_comparisons:
        return dynamic_comparisons, demo_payload.get("field_examples", {})

    merged = []
    seen = set()
    useful_dynamic = [
        comparison
        for comparison in dynamic_comparisons
        if comparison.get("raw") and int(comparison.get("transform_count") or 0) > 0
    ]
    for comparison in demo_comparisons + useful_dynamic:
        rid = comparison.get("record_id", "")
        if rid and rid in seen:
            continue
        if rid:
            seen.add(rid)
        merged.append(comparison)
    return merged[:8], demo_payload.get("field_examples", {})





def _local_source_asset(*parts):
    path = ROOT.joinpath(*parts)
    return path if path.exists() else None


def _csv_count_rows(path):
    if not path or not Path(path).exists():
        return 0
    with open(path, "r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        next(reader, None)
        return sum(1 for _ in reader)


def _load_csv_map(path, key="record_id"):
    rows = {}
    if not path or not Path(path).exists():
        return rows
    with open(path, "r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            row_key = row.get(key, "")
            if row_key:
                rows[row_key] = row
    return rows


def _metric_csv_path(source, folder, filename):
    local = _local_source_asset(folder, source, filename)
    if local:
        return local
    local = _local_source_asset(folder, filename)
    if local:
        return local
    return None


def _metric_json_path(source, folder, filename):
    local = _local_source_asset(folder, source, filename)
    if local:
        return local
    local = _local_source_asset(filename)
    if local:
        return local
    return None


def _is_blank(value):
    return value is None or str(value).strip() == ""


def _compare_metric_value(value):
    return str(value or "").strip()


def _field_rule_name(field):
    rule = _standardization_rule_for_field(field)
    return rule


_QUALITY_RULE_PRESENTATION = {
    "Email": {
        "name": "Email format validation",
        "expected": "A non-blank email in local-part@domain format with a valid domain.",
    },
    "Phone": {
        "name": "Phone-number standardization",
        "expected": "A 10-digit US number in 000-000-0000 canonical format.",
    },
    "Name": {
        "name": "Name standardization",
        "expected": "A non-blank person name using the configured normalized casing.",
    },
    "Address": {
        "name": "Address standardization",
        "expected": "A non-blank parsed address using canonical abbreviations and casing.",
    },
    "Date": {
        "name": "Date-format validation",
        "expected": "A supported ISO-8601 date or timestamp, beginning YYYY-MM-DD.",
    },
    "ZIP": {
        "name": "ZIP-code validation",
        "expected": "A five-digit US ZIP code.",
    },
}


def _quality_rule_details(field, finding_type=None):
    configured_rule = _field_rule_name(field)
    presentation = _QUALITY_RULE_PRESENTATION.get(
        configured_rule,
        {
            "name": f"{configured_rule or 'Configured field'} validation",
            "expected": "A value satisfying the configured field rule.",
        },
    )
    normalized_type = str(finding_type or "").strip().lower()
    if normalized_type == "missing values":
        return {
            "name": "Mandatory-field validation",
            "expected": f"A populated value. {presentation['expected']}",
        }
    if normalized_type == "rejected records":
        return {
            "name": "Standardization output reconciliation",
            "expected": "A matching standardized output row for the same source record.",
        }
    if normalized_type == "exact duplicate records":
        return {
            "name": "Duplicate-record detection",
            "expected": "A unique business-value combination within the source table.",
        }
    return presentation


def _quality_display_value(field, value):
    """Return useful, masked evidence without exposing customer PII."""
    text = str(value if value is not None else "").strip()
    if not text:
        return "(blank)"
    normalized_field = str(field or "").strip().lower()
    rule = _standardization_rule_for_field(normalized_field)
    if rule == "Email" or "email" in normalized_field:
        if "@" in text:
            local_part, domain = text.split("@", 1)
            visible = local_part[:1] if local_part else "*"
            return f"{visible}***@{domain.replace('@', '[at]')}"
        return f"{text[:1]}*** (missing valid @domain)"
    if rule == "Phone" or "phone" in normalized_field:
        digits = re.sub(r"\D", "", text)
        return f"***-***-{digits[-4:]}" if len(digits) >= 4 else "***"
    if rule == "Name" or normalized_field in {"full_name", "first_name", "last_name"}:
        return f"{text[:1]}***"
    if rule == "Address" and "address" in normalized_field:
        return f"{text[:8]}…" if len(text) > 8 else text
    return text[:80]


def _quality_finding(field, finding_type, reason, value):
    rule = _quality_rule_details(field, finding_type)
    return {
        "type": finding_type,
        "field": field,
        "reason": reason,
        "existing_value": _quality_display_value(field, value),
        "expected_format": rule["expected"],
        "failed_rule": rule["name"],
    }


def _quality_issue_description(field, finding_type, value):
    """Explain a failed quality check using the observed value and exact rule."""
    text = str(value if value is not None else "").strip()
    display_value = _quality_display_value(field, value)
    rule = _standardization_rule_for_field(field)
    normalized_field = str(field or "").strip().lower()
    field_label = normalized_field.replace("_", " ").title() or "Field"
    normalized_type = str(finding_type or "").strip().lower()

    if normalized_type == "missing values":
        return (
            f"{field_label} is blank after standardization, so the record cannot use "
            "this field for matching, contact, or downstream activation."
        )
    if normalized_type == "invalid values":
        if rule == "Email":
            if text == "[EXCLUDED]":
                return "Email is marked [EXCLUDED] and cannot be used for contact or identity matching."
            if any(character.isspace() for character in text):
                return f"Email {display_value} contains spaces, which are not allowed in an email address."
            if text.count("@") != 1:
                return f"Email {display_value} must contain exactly one @ separator."
            if "." not in text.rsplit("@", 1)[-1]:
                return f"Email {display_value} has an incomplete domain; a domain such as example.com is required."
            return f"Email {display_value} is not a usable local-part@domain address."
        if rule == "Phone":
            digit_count = len(re.sub(r"\D", "", text))
            return f"Phone {display_value} contains {digit_count} digits; the configured rule requires exactly 10 digits."
        if rule == "Date":
            return f"Date value {display_value} is not a valid calendar date beginning YYYY-MM-DD (for example, 2026-08-03)."
        if rule == "ZIP":
            digit_count = len(re.sub(r"\D", "", text))
            return f"ZIP value {display_value} contains {digit_count} digits; the configured rule requires exactly five numeric digits."
        if rule == "Address" and normalized_field in {"state", "shipping_state"}:
            return f"State value {display_value} must contain exactly two letters, such as NY or CA."
        if rule == "Address":
            return f"Address value {display_value} does not contain a usable letter or number."
        if rule == "Name":
            return f"Name value {display_value} does not contain a usable letter or number."
        return f"{field_label} value {display_value} does not satisfy its configured validation rule."
    if normalized_type == "inconsistent formats":
        if rule == "Email":
            return f"Email {display_value} is valid but is not stored in the configured uppercase canonical format."
        if rule == "Phone":
            return f"Phone {display_value} has a usable number but is not stored as 000-000-0000."
        if rule == "Date":
            return f"Date value {display_value} is valid but is not stored exactly as YYYY-MM-DD."
        if rule == "ZIP":
            return f"ZIP value {display_value} is not stored as exactly five numeric digits."
        if rule == "Name":
            return f"Name value {display_value} is not stored in the configured uppercase canonical form."
        if rule == "Address":
            return f"{field_label} value {display_value} is not stored using the configured uppercase canonical form."
        return f"{field_label} value {display_value} does not match its configured canonical format."
    return f"{field_label} value {display_value} failed the configured {normalized_type or 'quality'} check."


_QUALITY_EXCLUDED_FIELDS = {
    "record_id",
    "source_file",
    "source_system",
    "cluster_id",
    "golden_id",
}


def _load_metric_rows(path):
    """Load CSV rows without collapsing duplicate record IDs."""
    rows = []
    rows_by_key = {}
    occurrences = {}
    if not path or not Path(path).exists():
        return rows, rows_by_key

    with open(path, "r", encoding="utf-8", newline="") as handle:
        for ordinal, row in enumerate(csv.DictReader(handle)):
            table = Path(str(row.get("source_file", "") or "unknown")).name.lower()
            record_id = str(row.get("record_id", "") or "").strip()
            base_key = (table, record_id or f"__row_{ordinal}")
            occurrence = occurrences.get(base_key, 0)
            occurrences[base_key] = occurrence + 1
            row_key = (base_key[0], base_key[1], occurrence)
            rows.append((row_key, row))
            rows_by_key[row_key] = row
    return rows, rows_by_key


def _quality_business_signature(row):
    """Return an exact, source-backed business-value fingerprint.

    Pipeline identifiers are deliberately excluded: including record_id would
    make every row look unique even when the business payload is duplicated.
    The source table is added by the caller so equal rows from unrelated tables
    are never grouped together.
    """
    values = []
    for raw_field, raw_value in sorted((row or {}).items()):
        field = str(raw_field or "").strip().lower()
        if not field or field in _QUALITY_EXCLUDED_FIELDS or field.startswith("_"):
            continue
        values.append((field, _compare_metric_value(raw_value)))
    return tuple(values)


def _quality_duplicate_keys(pre_row_list, standardized_rows, common_keys):
    """Identify duplicate rows beyond the first exact business-value record."""
    groups = {}
    for row_key, pre_row in pre_row_list:
        row = standardized_rows.get(row_key, pre_row) if row_key in common_keys else pre_row
        table = row_key[0]
        signature = _quality_business_signature(row)
        if not signature:
            # A row with no business columns cannot be compared safely.
            continue
        groups.setdefault((table, signature), []).append(row_key)

    duplicates = set()
    for keys in groups.values():
        if len(keys) > 1:
            duplicates.update(keys[1:])
    return duplicates


def _metric_table_schemas(source, pre_rows):
    """Return monitored schema fields by source table.

    The union CSV contains columns from every table. Reading each table header
    prevents a field that belongs to one table from being treated as missing in
    every other table.
    """
    schemas = {}
    scoped_dir = PRE_DIR / source
    paths = sorted(scoped_dir.glob("preprocessed_*.csv")) if scoped_dir.exists() else []
    if source == DEFAULT_CLUSTER_SOURCE and not paths:
        paths = sorted(PRE_DIR.glob("preprocessed_*.csv"))

    for path in paths:
        source_file = path.name[len("preprocessed_"):] if path.name.startswith("preprocessed_") else path.name
        fields = {
            str(field or "").strip().lower()
            for field in _csv_columns(path)
            if _standardization_rule_for_field(field)
        }
        schemas[Path(source_file).name.lower()] = fields

    observed = {}
    for _, row in pre_rows:
        table = Path(str(row.get("source_file", "") or "unknown")).name.lower()
        # Header-backed schemas are authoritative and already identify every
        # monitored field for known source tables. Re-scanning every wide union
        # row for those tables is both redundant and prohibitively expensive.
        if schemas.get(table):
            continue
        observed_fields = observed.setdefault(table, set())
        for field, value in row.items():
            field_name = str(field or "").strip().lower()
            if _standardization_rule_for_field(field_name) and not _is_blank(value):
                observed_fields.add(field_name)

    for table, fields in observed.items():
        if table not in schemas:
            schemas[table] = fields
        elif not schemas[table]:
            schemas[table].update(fields)
    return schemas


def _quality_value_is_valid(field, value):
    text = str(value or "").strip()
    if not text:
        return False
    rule = _standardization_rule_for_field(field)
    if rule == "Email":
        return text != "[EXCLUDED]" and bool(re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", text))
    if rule == "Phone":
        return len(re.sub(r"\D", "", text)) == 10
    if rule == "Name":
        return bool(re.search(r"[A-Za-z0-9]", text))
    if rule == "Address":
        if str(field).lower() in {"state", "shipping_state"}:
            return bool(re.fullmatch(r"[A-Za-z]{2}", text))
        return bool(re.search(r"[A-Za-z0-9]", text))
    if rule == "Date":
        try:
            datetime.strptime(text[:10], "%Y-%m-%d")
            return True
        except (TypeError, ValueError):
            return False
    if rule == "ZIP":
        return bool(re.fullmatch(r"\d{5}", text))
    return True


def _quality_value_is_consistent(field, value):
    text = str(value or "").strip()
    if not text:
        return False
    rule = _standardization_rule_for_field(field)
    if rule == "Email":
        return text == text.upper() and _quality_value_is_valid(field, text)
    if rule == "Phone":
        return bool(re.fullmatch(r"\d{3}-\d{3}-\d{4}", text))
    if rule in {"Name", "Address"}:
        return text == text.upper()
    if rule == "Date":
        return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", text)) and _quality_value_is_valid(field, text)
    if rule == "ZIP":
        return bool(re.fullmatch(r"\d{5}", text))
    return True


def _new_quality_bucket():
    return {
        "records": 0,
        "applicable": 0,
        "present": 0,
        "valid_evaluated": 0,
        "valid": 0,
        "consistent_evaluated": 0,
        "consistent": 0,
        "active_issues": 0,
        "rejected": 0,
        "affected_records": set(),
    }


def _quality_score(numerator, denominator):
    return round((numerator / denominator) * 100, 1) if denominator else None


def _quality_bucket_payload(bucket):
    completeness = _quality_score(bucket["present"], bucket["applicable"])
    validity = _quality_score(bucket["valid"], bucket["valid_evaluated"])
    consistency = _quality_score(bucket["consistent"], bucket["consistent_evaluated"])
    uniqueness = (
        _quality_score(bucket.get("unique_records"), bucket.get("records"))
        if bucket.get("unique_records") is not None
        else None
    )
    available_scores = [
        score
        for score in (completeness, validity, consistency, uniqueness)
        if score is not None
    ]
    overall = round(sum(available_scores) / len(available_scores), 1) if available_scores else None
    return {
        "score": overall,
        "completeness": completeness,
        "validity": validity,
        "consistency": consistency,
        "uniqueness": uniqueness,
        "accuracy": None,
        "active_issues": bucket["active_issues"],
        "affected_records": len(bucket["affected_records"]),
        "rejected": bucket["rejected"],
    }


def _artifact_job(name, path):
    available = bool(path and Path(path).exists())
    observed_at = None
    if available:
        try:
            observed_at = datetime.fromtimestamp(
                Path(path).stat().st_mtime,
                timezone.utc,
            ).isoformat()
        except OSError:
            # Unity Catalog compatibility paths are logical table references,
            # not local files with an operating-system mtime.
            observed_at = None
    return {
        "name": name,
        "status": "Artifact available" if available else "Artifact missing",
        "completed": None,
        "completed_at": None,
        "artifact_available": available,
        "observed_at": observed_at,
        "evidence_type": "artifact_snapshot",
    }


def _candidate_confidence_metrics(candidate_csv):
    tiers = {
        "Exact Match": 0,
        "High-Confidence Fuzzy Match": 0,
        "Low-Confidence Fuzzy Match": 0,
    }
    if not candidate_csv or not Path(candidate_csv).exists():
        return [{"tier": tier, "value": value} for tier, value in tiers.items()], 0

    total = 0
    with open(candidate_csv, "r", encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            total += 1
            edge_type = str(row.get("edge_type", "") or "").strip().lower()
            if edge_type == "exact":
                tiers["Exact Match"] += 1
            elif edge_type == "strong":
                tiers["High-Confidence Fuzzy Match"] += 1
            else:
                tiers["Low-Confidence Fuzzy Match"] += 1
    return [{"tier": tier, "value": value} for tier, value in tiers.items()], total


_STANDARDIZATION_REPORT_CACHE = {}
_STANDARDIZATION_REPORT_REVISION = 6
_QUALITY_RECORD_INDEX_CACHE = {}
_QUALITY_RECORD_INDEX_REVISION = 6


def _report_cache_seconds(env_name, default=300):
    raw_value = os.getenv(
        env_name,
        os.getenv("CODEX_REPORT_CACHE_SECONDS", os.getenv("CODEX_UC_SQL_CACHE_SECONDS", default)),
    )
    try:
        return min(max(int(str(raw_value).strip()), 0), 3600)
    except (TypeError, ValueError):
        return default


def _report_cache_enabled():
    return str(os.getenv("CODEX_ENABLE_API_CACHE", "1")).strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _report_snapshot_max_age_seconds():
    """Bound restart snapshots independently from the shorter memory-cache TTL."""
    raw_value = os.getenv("CODEX_REPORT_SNAPSHOT_MAX_AGE_SECONDS", "604800")
    try:
        return min(max(int(str(raw_value).strip()), 0), 2592000)
    except (TypeError, ValueError):
        return 604800


def _cached_uc_report(namespace, source, revision, loader, ttl_env):
    """Reuse completed UC report calculations and coalesce concurrent loads."""
    if not uc_enabled():
        return loader()
    cache_loader = app.extensions.get("codex_cached_result")
    if not callable(cache_loader):
        return loader()
    ttl_seconds = _report_cache_seconds(ttl_env)
    return cache_loader(
        f"{namespace}:{source}",
        revision,
        ttl_seconds,
        loader,
        enabled=_report_cache_enabled() and ttl_seconds > 0,
    )


def _standardization_report_snapshot(source, report_path):
    """Return a recent, validated source-backed snapshot when UC restarts."""
    if not uc_enabled():
        return None
    try:
        if not report_path.exists():
            return None
        saved_report = json.loads(report_path.read_text(encoding="utf-8"))
        generated_at = str(
            (saved_report.get("explain_report") or {}).get("generated_at") or ""
        ).strip()
        generated = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
        if generated.tzinfo is None:
            generated = generated.replace(tzinfo=timezone.utc)
        age_seconds = max(
            (datetime.now(timezone.utc) - generated.astimezone(timezone.utc)).total_seconds(),
            0,
        )
        max_age_seconds = _report_snapshot_max_age_seconds()
        if (
            saved_report.get("schema_version") == 2
            and saved_report.get("report_revision") == _STANDARDIZATION_REPORT_REVISION
            and saved_report.get("status") == "success"
            and saved_report.get("data_available") is True
            and str(saved_report.get("source_system") or "").strip().lower() == source
            and max_age_seconds > 0
            and age_seconds <= max_age_seconds
        ):
            return saved_report
    except (OSError, ValueError, TypeError, AttributeError):
        return None
    return None


def _quality_record_index_cache_path(source):
    return ROOT / "standardization_reports" / source / "quality_record_index.json.gz"


def _read_quality_record_index_cache(source, artifact_signature):
    if uc_enabled():
        return None
    path = _quality_record_index_cache_path(source)
    if not path.exists():
        return None
    try:
        with gzip.open(path, "rt", encoding="utf-8") as handle:
            payload = json.load(handle)
        rows = payload.get("rows")
        if (
            payload.get("revision") != _QUALITY_RECORD_INDEX_REVISION
            or payload.get("artifact_signature") != artifact_signature
            or not isinstance(rows, list)
            or any(not isinstance(row, dict) for row in rows)
        ):
            return None
        return rows
    except (OSError, EOFError, json.JSONDecodeError, TypeError, ValueError):
        return None


def _write_quality_record_index_cache(source, artifact_signature, rows):
    if uc_enabled():
        return
    path = _quality_record_index_cache_path(source)
    temp_path = path.with_name(
        f"{path.name}.{os.getpid()}.{threading.get_ident()}.tmp"
    )
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        with gzip.open(temp_path, "wt", encoding="utf-8", compresslevel=5) as handle:
            json.dump(
                {
                    "revision": _QUALITY_RECORD_INDEX_REVISION,
                    "artifact_signature": artifact_signature,
                    "rows": rows,
                },
                handle,
                ensure_ascii=True,
                separators=(",", ":"),
            )
        os.replace(temp_path, path)
    except OSError:
        try:
            temp_path.unlink(missing_ok=True)
        except OSError:
            pass


def _report_artifact_signature(artifacts):
    signature = []
    for name, path in artifacts:
        exists = bool(path and Path(path).exists())
        item = {"name": name, "exists": exists}
        if exists:
            try:
                stat = Path(path).stat()
                item.update({"size": stat.st_size, "mtime_ns": stat.st_mtime_ns})
            except OSError:
                item.update({"size": None, "mtime_ns": None})
        signature.append(item)
    return signature


def _compute_quality_record_index(source):
    """Build a privacy-conscious, record-grain quality index for drill-downs."""
    pre_csv = _metric_csv_path(source, "preprocessed_data", "all_preprocessed.csv")
    std_csv = _metric_csv_path(source, "standardized_data", "all_standardized.csv")
    signature = _report_artifact_signature([
        ("preprocessed", pre_csv),
        ("standardized", std_csv),
    ])
    cache_entry = None if uc_enabled() else _QUALITY_RECORD_INDEX_CACHE.get(source)
    if cache_entry and cache_entry.get("artifact_signature") == signature:
        return cache_entry["rows"]
    disk_rows = _read_quality_record_index_cache(source, signature)
    if disk_rows is not None:
        _QUALITY_RECORD_INDEX_CACHE[source] = {
            "artifact_signature": signature,
            "rows": disk_rows,
        }
        return disk_rows

    pre_row_list, pre_rows = _load_metric_rows(pre_csv)
    _, std_rows = _load_metric_rows(std_csv)
    common_keys = set(pre_rows) & set(std_rows)
    rejected_keys = set(pre_rows) - common_keys
    duplicate_keys = _quality_duplicate_keys(pre_row_list, std_rows, common_keys)
    table_schemas = _metric_table_schemas(source, pre_row_list)
    findings = {row_key: [] for row_key, _ in pre_row_list}
    changed_keys = set()

    for row_key in rejected_keys:
        findings[row_key].append(_quality_finding(
            "Record",
            "Rejected records",
            "No corresponding standardized output record exists for this input record.",
            "No standardized output row",
        ))
    for row_key in duplicate_keys:
        findings[row_key].append(_quality_finding(
            "Record",
            "Exact duplicate records",
            "The record's business values exactly repeat an earlier row in the same source table.",
            "Repeated business-value combination",
        ))

    for row_key in common_keys:
        pre = pre_rows[row_key]
        standardized = std_rows[row_key]
        table = Path(str(
            pre.get("source_file", "")
            or standardized.get("source_file", "")
            or "unknown"
        )).name.lower()
        monitored_fields = table_schemas.get(table, set())
        if not monitored_fields:
            monitored_fields = {
                str(field or "").strip().lower()
                for field in set(pre) | set(standardized)
                if _standardization_rule_for_field(field)
            }

        for field in sorted(monitored_fields):
            pre_value = pre.get(field, "")
            value = standardized.get(field, "")
            if (
                _compare_metric_value(pre_value) != _compare_metric_value(value)
                and not _is_blank(value)
            ):
                changed_keys.add(row_key)
            if _is_blank(value):
                findings[row_key].append(_quality_finding(
                    field,
                    "Missing values",
                    _quality_issue_description(field, "Missing values", value),
                    value,
                ))
                continue
            value_is_valid = _quality_value_is_valid(field, value)
            if not value_is_valid:
                findings[row_key].append(_quality_finding(
                    field,
                    "Invalid values",
                    _quality_issue_description(field, "Invalid values", value),
                    value,
                ))
            elif not _quality_value_is_consistent(field, value):
                findings[row_key].append(_quality_finding(
                    field,
                    "Inconsistent formats",
                    _quality_issue_description(field, "Inconsistent formats", value),
                    value,
                ))

    rows = []
    for ordinal, (row_key, pre) in enumerate(pre_row_list):
        record_findings = findings.get(row_key, [])
        if row_key in rejected_keys:
            status = "needs_review"
        elif record_findings:
            status = "at_risk"
        else:
            status = "healthy"
        record_id = str(pre.get("record_id", "") or "").strip()
        rows.append({
            "record_id": record_id or f"Row {ordinal + 1}",
            "source_table": Path(
                str(pre.get("source_file", "") or row_key[0] or "unknown")
            ).name,
            "status": status,
            "cleansed": row_key in changed_keys,
            "issue_count": len(record_findings),
            "issue_types": sorted({item["type"] for item in record_findings}),
            "reasons": sorted({
                item["reason"]
                for item in record_findings
                if str(item.get("reason") or "").strip()
            }),
            "fields": sorted({
                item["field"]
                for item in record_findings
                if item["field"] and item["field"] != "Record"
            }),
            "findings": record_findings,
        })

    rows.sort(key=lambda item: (-item["issue_count"], item["source_table"], item["record_id"]))
    if not uc_enabled():
        _QUALITY_RECORD_INDEX_CACHE[source] = {
            "artifact_signature": signature,
            "rows": rows,
        }
        _write_quality_record_index_cache(source, signature, rows)
    return rows


def _quality_record_index(source):
    source = _normalize_cluster_source(source)
    return _cached_uc_report(
        "quality-record-index",
        source,
        _QUALITY_RECORD_INDEX_REVISION,
        lambda: _compute_quality_record_index(source),
        "CODEX_STANDARDIZATION_REPORT_CACHE_SECONDS",
    )


def _representative_quality_records(rows, limit, max_blank_examples=2):
    """Choose diverse real findings without allowing blank-only rows to dominate."""
    if limit <= 0 or not rows:
        return []

    issue_priority = {
        "Rejected records": 0,
        "Exact duplicate records": 1,
        "Invalid values": 2,
        "Inconsistent formats": 3,
        "Missing values": 4,
    }
    representative_findings = {}

    def round_robin(candidate_rows, count, excluded_ids=None, finding_filter=None):
        excluded_ids = set(excluded_ids or ())
        finding_filter = finding_filter or (lambda finding: True)
        facets = sorted(
            {
                (
                    str(finding.get("type") or "Other issue"),
                    str(finding.get("field") or "Record"),
                )
                for row in candidate_rows
                for finding in (row.get("findings") or [])
                if finding_filter(finding)
            },
            key=lambda facet: (
                issue_priority.get(facet[0], 99),
                facet[1].lower(),
                facet[0].lower(),
            ),
        )
        buckets = {
            facet: [
                row
                for row in candidate_rows
                if any(
                    finding_filter(finding)
                    and str(finding.get("type") or "Other issue") == facet[0]
                    and str(finding.get("field") or "Record") == facet[1]
                    for finding in (row.get("findings") or [])
                )
            ]
            for facet in facets
        }
        positions = {facet: 0 for facet in facets}
        chosen = []
        chosen_ids = set(excluded_ids)
        while len(chosen) < count:
            added = False
            for facet in facets:
                bucket = buckets[facet]
                position = positions[facet]
                while position < len(bucket) and id(bucket[position]) in chosen_ids:
                    position += 1
                positions[facet] = position
                if position >= len(bucket):
                    continue
                row = bucket[position]
                positions[facet] = position + 1
                chosen.append(row)
                chosen_ids.add(id(row))
                representative_findings[id(row)] = next(
                    finding
                    for finding in (row.get("findings") or [])
                    if finding_filter(finding)
                    and str(finding.get("type") or "Other issue") == facet[0]
                    and str(finding.get("field") or "Record") == facet[1]
                )
                added = True
                if len(chosen) >= count:
                    break
            if not added:
                break
        return chosen

    def is_non_blank(finding):
        return str(finding.get("existing_value") or "").strip() not in {"", "(blank)"}

    non_blank_rows = [
        row
        for row in rows
        if any(is_non_blank(finding) for finding in (row.get("findings") or []))
    ]
    non_blank_ids = {id(row) for row in non_blank_rows}
    blank_only_rows = [row for row in rows if id(row) not in non_blank_ids]
    non_blank_target = (
        limit
        if not blank_only_rows
        else max(limit - min(max_blank_examples, limit), 0)
    )
    selected = round_robin(
        non_blank_rows,
        non_blank_target,
        finding_filter=is_non_blank,
    )
    selected_ids = {id(row) for row in selected}
    selected.extend(
        round_robin(
            blank_only_rows,
            limit - len(selected),
            selected_ids,
            finding_filter=lambda finding: not is_non_blank(finding),
        )
    )
    selected_ids = {id(row) for row in selected}
    for row in rows:
        if id(row) in selected_ids:
            continue
        selected.append(row)
        selected_ids.add(id(row))
        if len(selected) >= limit:
            break

    payload_rows = []
    for row in selected[:limit]:
        payload_row = dict(row)
        representative = representative_findings.get(id(row))
        if representative is None:
            findings = row.get("findings") or []
            representative = next(
                (finding for finding in findings if is_non_blank(finding)),
                None,
            )
            representative = representative or (findings[0] if findings else None)
        payload_row["representative_finding"] = representative
        payload_rows.append(payload_row)
    return payload_rows


@app.route("/api/standardization/quality-records", methods=["GET"])
def standardization_quality_records():
    source = _request_source()
    category = str(request.args.get("category", "affected") or "affected").strip().lower()
    issue_type = str(request.args.get("issue_type", "") or "").strip().lower()
    source_table = Path(
        str(request.args.get("source_table", "") or "").strip()
    ).name
    selection = str(
        request.args.get("selection", "ranked") or "ranked"
    ).strip().lower()
    allowed_categories = {
        "all",
        "cleansed",
        "healthy",
        "at_risk",
        "needs_review",
        "affected",
    }
    if category not in allowed_categories:
        return jsonify({
            "status": "error",
            "message": f"Unsupported record category: {category}",
        }), 400
    if selection not in {"ranked", "representative"}:
        return jsonify({
            "status": "error",
            "message": f"Unsupported record selection: {selection}",
        }), 400

    try:
        offset = max(int(request.args.get("offset", 0)), 0)
        limit = min(max(int(request.args.get("limit", 50)), 1), 100)
    except (TypeError, ValueError):
        return jsonify({
            "status": "error",
            "message": "offset and limit must be integers.",
        }), 400

    indexed_rows = _quality_record_index(source)
    filtered_rows = []
    for row in indexed_rows:
        if category == "cleansed":
            if not row["cleansed"]:
                continue
        elif category == "affected" and row["status"] == "healthy":
            continue
        elif category not in {"all", "affected"} and row["status"] != category:
            continue
        if issue_type and not any(
            issue_type == str(item).strip().lower()
            for item in row["issue_types"]
        ):
            continue
        filtered_rows.append(row)

    table_breakdown_map = {}
    for row in filtered_rows:
        table = row["source_table"]
        aggregate = table_breakdown_map.setdefault(
            table,
            {"source_table": table, "record_count": 0, "issue_count": 0},
        )
        aggregate["record_count"] += 1
        aggregate["issue_count"] += int(row.get("issue_count") or 0)
    table_breakdown = sorted(
        table_breakdown_map.values(),
        key=lambda item: (-item["record_count"], item["source_table"].lower()),
    )
    overall_total = len(filtered_rows)
    if source_table:
        filtered_rows = [
            row
            for row in filtered_rows
            if row["source_table"].strip().lower() == source_table.lower()
        ]
    total = len(filtered_rows)
    if selection == "representative":
        records = _representative_quality_records(
            filtered_rows,
            offset + limit,
            max_blank_examples=5 if not source_table else 2,
        )[offset:offset + limit]
    else:
        records = filtered_rows[offset:offset + limit]
    return jsonify({
        "status": "success",
        "source_system": source,
        "category": category,
        "issue_type": issue_type or None,
        "source_table": source_table or None,
        "selection": selection,
        "offset": offset,
        "limit": limit,
        "total": total,
        "overall_total": overall_total,
        "table_breakdown": table_breakdown,
        "records": records,
        "grain": (
            "Table summary at source-table grain; record details at one measured "
            "finding per physical source record. Sensitive values are masked."
        ),
    })


def _build_standardization_report_metrics(source):
    report_dir = ROOT / "standardization_reports" / source
    report_path = report_dir / "cleaning_standardization_report.json"
    saved_snapshot = _standardization_report_snapshot(source, report_path)
    if saved_snapshot is not None:
        return saved_snapshot

    pre_csv = _metric_csv_path(source, "preprocessed_data", "all_preprocessed.csv")
    std_csv = _metric_csv_path(source, "standardized_data", "all_standardized.csv")
    candidate_csv = _metric_csv_path(source, "matching_output", "candidate_pairs.csv")
    superseded_csv = _metric_csv_path(source, "golden_records_output", "superseded_ids.csv")
    artifact_signature = _report_artifact_signature([
        ("preprocessed", pre_csv),
        ("standardized", std_csv),
        ("candidate_pairs", candidate_csv),
        ("superseded_ids", superseded_csv),
    ])
    cache_entry = None if uc_enabled() else _STANDARDIZATION_REPORT_CACHE.get(source)
    if cache_entry and cache_entry.get("artifact_signature") == artifact_signature:
        return cache_entry["payload"]
    if not uc_enabled() and report_path.exists():
        try:
            saved_report = json.loads(report_path.read_text(encoding="utf-8"))
            if (
                saved_report.get("schema_version") == 2
                and saved_report.get("report_revision") == _STANDARDIZATION_REPORT_REVISION
                and saved_report.get("artifact_signature") == artifact_signature
            ):
                _STANDARDIZATION_REPORT_CACHE[source] = {
                    "artifact_signature": artifact_signature,
                    "payload": saved_report,
                }
                return saved_report
        except (OSError, ValueError, TypeError):
            pass

    pre_row_list, pre_rows = _load_metric_rows(pre_csv)
    std_row_list, std_rows = _load_metric_rows(std_csv)
    records_ingested = len(pre_row_list)
    output_record_count = len(std_row_list)
    common_keys = set(pre_rows) & set(std_rows)
    standardized_records = len(common_keys)
    rejected_keys = set(pre_rows) - common_keys
    rejected_records = len(rejected_keys)
    unexpected_output_records = len(set(std_rows) - set(pre_rows))
    duplicate_keys = _quality_duplicate_keys(pre_row_list, std_rows, common_keys)

    table_schemas = _metric_table_schemas(source, pre_row_list)
    field_stats = {}
    table_stats = {}
    global_quality = _new_quality_bucket()
    global_quality["records"] = records_ingested

    for row_key, pre in pre_row_list:
        table = Path(str(pre.get("source_file", "") or "unknown")).name.lower()
        table_bucket = table_stats.setdefault(table, _new_quality_bucket())
        table_bucket["records"] += 1
        if row_key in rejected_keys:
            table_bucket["rejected"] += 1
            table_bucket["active_issues"] += 1
            table_bucket["affected_records"].add(row_key)
            global_quality["rejected"] += 1
            global_quality["active_issues"] += 1
            global_quality["affected_records"].add(row_key)

        if row_key in duplicate_keys:
            table_bucket["active_issues"] += 1
            table_bucket["affected_records"].add(row_key)
            global_quality["active_issues"] += 1
            global_quality["affected_records"].add(row_key)

    global_quality["unique_records"] = max(records_ingested - len(duplicate_keys), 0)
    duplicate_counts_by_table = {}
    for row_key in duplicate_keys:
        duplicate_counts_by_table[row_key[0]] = duplicate_counts_by_table.get(row_key[0], 0) + 1
    for table, bucket in table_stats.items():
        bucket["unique_records"] = max(
            bucket["records"] - duplicate_counts_by_table.get(table, 0),
            0,
        )

    records_changed_keys = set()
    total_field_changes = 0
    for row_key in common_keys:
        pre = pre_rows[row_key]
        std = std_rows[row_key]
        table = Path(str(pre.get("source_file", "") or std.get("source_file", "") or "unknown")).name.lower()
        table_bucket = table_stats.setdefault(table, _new_quality_bucket())
        monitored_fields = table_schemas.get(table, set())
        if not monitored_fields:
            monitored_fields = {
                str(field or "").strip().lower()
                for field in set(pre) | set(std)
                if _standardization_rule_for_field(field)
            }

        for field in sorted(monitored_fields):
            rule_name = _field_rule_name(field)
            stat = field_stats.setdefault(
                field,
                {
                    "field": field,
                    "rule": rule_name,
                    "applicable": 0,
                    "present": 0,
                    "valid_evaluated": 0,
                    "valid": 0,
                    "consistent_evaluated": 0,
                    "consistent": 0,
                    "corrected": 0,
                    "corrected_valid": 0,
                    "corrected_consistent": 0,
                    "corrected_records": set(),
                    "corrected_consistent_records": set(),
                    "missing": 0,
                    "invalid": 0,
                    "inconsistent": 0,
                    "distinct_values": set(),
                    "affected_records": set(),
                    "tables": set(),
                    "example_values": [],
                },
            )
            stat["tables"].add(table)
            stat["applicable"] += 1
            table_bucket["applicable"] += 1
            global_quality["applicable"] += 1

            pre_value = pre.get(field, "")
            std_value = std.get(field, "")
            changed = (
                _compare_metric_value(pre_value) != _compare_metric_value(std_value)
                and not _is_blank(std_value)
            )
            if changed:
                stat["corrected"] += 1
                stat["corrected_records"].add(row_key)
                total_field_changes += 1
                records_changed_keys.add(row_key)

            if _is_blank(std_value):
                stat["missing"] += 1
                if "(blank)" not in stat["example_values"] and len(stat["example_values"]) < 5:
                    stat["example_values"].append("(blank)")
                stat["affected_records"].add(row_key)
                table_bucket["active_issues"] += 1
                table_bucket["affected_records"].add(row_key)
                global_quality["active_issues"] += 1
                global_quality["affected_records"].add(row_key)
                continue

            stat["present"] += 1
            stat["distinct_values"].add(
                (table, _compare_metric_value(std_value))
            )
            stat["valid_evaluated"] += 1
            stat["consistent_evaluated"] += 1
            table_bucket["present"] += 1
            table_bucket["valid_evaluated"] += 1
            table_bucket["consistent_evaluated"] += 1
            global_quality["present"] += 1
            global_quality["valid_evaluated"] += 1
            global_quality["consistent_evaluated"] += 1

            value_is_valid = _quality_value_is_valid(field, std_value)
            if value_is_valid:
                stat["valid"] += 1
                table_bucket["valid"] += 1
                global_quality["valid"] += 1
                if changed:
                    stat["corrected_valid"] += 1
            else:
                stat["invalid"] += 1
                display_value = _quality_display_value(field, std_value)
                if display_value not in stat["example_values"] and len(stat["example_values"]) < 5:
                    stat["example_values"].append(display_value)
                stat["affected_records"].add(row_key)
                table_bucket["active_issues"] += 1
                table_bucket["affected_records"].add(row_key)
                global_quality["active_issues"] += 1
                global_quality["affected_records"].add(row_key)

            value_is_consistent = _quality_value_is_consistent(field, std_value)
            if value_is_consistent:
                stat["consistent"] += 1
                table_bucket["consistent"] += 1
                global_quality["consistent"] += 1
                if changed:
                    stat["corrected_consistent"] += 1
                    stat["corrected_consistent_records"].add(row_key)
            else:
                stat["inconsistent"] += 1
                display_value = _quality_display_value(field, std_value)
                if display_value not in stat["example_values"] and len(stat["example_values"]) < 5:
                    stat["example_values"].append(display_value)
                stat["affected_records"].add(row_key)
                table_bucket["active_issues"] += 1
                table_bucket["affected_records"].add(row_key)
                global_quality["active_issues"] += 1
                global_quality["affected_records"].add(row_key)

    field_level_stats = []
    score_by_field = []
    for stat in field_stats.values():
        bucket = {
            "records": stat["present"],
            "unique_records": len(stat["distinct_values"]),
            "applicable": stat["applicable"],
            "present": stat["present"],
            "valid_evaluated": stat["valid_evaluated"],
            "valid": stat["valid"],
            "consistent_evaluated": stat["consistent_evaluated"],
            "consistent": stat["consistent"],
            "active_issues": stat["missing"] + stat["invalid"] + stat["inconsistent"],
            "rejected": 0,
            "affected_records": stat["affected_records"],
        }
        quality = _quality_bucket_payload(bucket)
        issue_parts = []
        if stat["missing"]:
            issue_parts.append(f"{stat['missing']:,} blank")
        if stat["invalid"]:
            issue_parts.append(f"{stat['invalid']:,} invalid")
        if stat["inconsistent"]:
            issue_parts.append(f"{stat['inconsistent']:,} non-canonical")
        rule_details = _quality_rule_details(stat["field"])
        field_payload = {
            "attribute": stat["field"],
            "rule": stat["rule"] or "N/A",
            "rule_name": rule_details["name"],
            "expected_format": rule_details["expected"],
            "has_rule": bool(stat["rule"]),
            "conformance": quality["score"],
            "quality_score": quality["score"],
            "completeness": quality["completeness"],
            "validity": quality["validity"],
            "consistency": quality["consistency"],
            "uniqueness": quality["uniqueness"],
            "unique_values": len(stat["distinct_values"]),
            "uniqueness_evaluated": stat["present"],
            "accuracy": None,
            "corrected": stat["corrected"],
            "corrected_valid": stat["corrected_valid"],
            "corrected_consistent": stat["corrected_consistent"],
            "corrected_records": len(stat["corrected_records"]),
            "corrected_consistent_records": len(stat["corrected_consistent_records"]),
            "null": stat["missing"],
            "invalid": stat["invalid"],
            "inconsistent": stat["inconsistent"],
            "active_issues": quality["active_issues"],
            "issue_count": quality["active_issues"],
            "affected_records": quality["affected_records"],
            "impacted_records": quality["affected_records"],
            "total": stat["applicable"],
            "tables": sorted(stat["tables"]),
            "table_names": sorted(stat["tables"]),
            "problem_description": (
                f"{', '.join(issue_parts)} values need attention."
                if issue_parts
                else "No current quality issue was found for this field."
            ),
            "severity": (
                "Unusable" if stat["missing"] or stat["invalid"] else "Review"
            ),
            "example_values": stat["example_values"][:5],
        }
        field_level_stats.append(field_payload)
        score_by_field.append(dict(field_payload))

    field_level_stats.sort(key=lambda item: (item["corrected"], item["total"]), reverse=True)
    score_by_field.sort(key=lambda item: (item["active_issues"], item["total"]), reverse=True)

    score_by_table = []
    for table, bucket in table_stats.items():
        quality = _quality_bucket_payload(bucket)
        score_by_table.append({
            "table": table,
            "records": bucket["records"],
            **quality,
        })
    score_by_table.sort(
        key=lambda item: (item["score"] is None, item["score"] if item["score"] is not None else 101, item["table"])
    )

    global_scores = _quality_bucket_payload(global_quality)
    overall_quality_score = global_scores["score"]
    healthy_records = max(records_ingested - len(global_quality["affected_records"]), 0)
    healthy_records_pct = _quality_score(healthy_records, records_ingested)
    needs_review_records = len(rejected_keys)
    at_risk_record_keys = set(global_quality["affected_records"]) - set(rejected_keys)
    at_risk_records = len(at_risk_record_keys)
    at_risk_records_pct = _quality_score(at_risk_records, records_ingested)
    needs_review_records_pct = _quality_score(needs_review_records, records_ingested)
    records_changed = len(records_changed_keys)
    processing_success_rate = _quality_score(standardized_records, records_ingested)
    records_changed_rate = _quality_score(records_changed, records_ingested)
    rejection_rate = _quality_score(rejected_records, records_ingested)

    rule_totals = {}
    for stat in field_stats.values():
        rule_name = stat["rule"]
        if not rule_name:
            continue
        aggregate = rule_totals.setdefault(
            rule_name,
            {
                "applicable": 0,
                "present": 0,
                "valid_evaluated": 0,
                "valid": 0,
                "consistent_evaluated": 0,
                "consistent": 0,
                "corrected": 0,
                "corrected_valid": 0,
                "corrected_consistent": 0,
                "corrected_records": set(),
                "corrected_consistent_records": set(),
                "missing": 0,
                "fields": set(),
                "affected_records": set(),
            },
        )
        for key in (
            "applicable",
            "present",
            "valid_evaluated",
            "valid",
            "consistent_evaluated",
            "consistent",
            "corrected",
            "corrected_valid",
            "corrected_consistent",
            "missing",
        ):
            aggregate[key] += stat[key]
        aggregate["corrected_records"].update(stat["corrected_records"])
        aggregate["corrected_consistent_records"].update(
            stat["corrected_consistent_records"]
        )
        aggregate["fields"].add(stat["field"])
        aggregate["affected_records"].update(stat["affected_records"])

    rule_stats = []
    rule_templates = []
    rules_by_name = {rule["field"]: rule for rule in _standardization_rules()}
    for rule_name, rule in rules_by_name.items():
        aggregate = rule_totals.get(
            rule_name,
            {
                "applicable": 0,
                "present": 0,
                "valid_evaluated": 0,
                "valid": 0,
                "consistent_evaluated": 0,
                "consistent": 0,
                "corrected": 0,
                "corrected_valid": 0,
                "corrected_consistent": 0,
                "corrected_records": set(),
                "corrected_consistent_records": set(),
                "missing": 0,
                "fields": set(),
                "affected_records": set(),
            },
        )
        bucket = {
            "records": aggregate["applicable"],
            "applicable": aggregate["applicable"],
            "present": aggregate["present"],
            "valid_evaluated": aggregate["valid_evaluated"],
            "valid": aggregate["valid"],
            "consistent_evaluated": aggregate["consistent_evaluated"],
            "consistent": aggregate["consistent"],
            "active_issues": (
                aggregate["missing"]
                + (aggregate["valid_evaluated"] - aggregate["valid"])
                + (aggregate["consistent_evaluated"] - aggregate["consistent"])
            ),
            "rejected": 0,
            "affected_records": aggregate["affected_records"],
        }
        quality = _quality_bucket_payload(bucket)
        active = aggregate["applicable"] > 0
        rule_stats.append({
            "rule": rule_name,
            "name": _quality_rule_details(rule_name)["name"],
            "expected_format": _quality_rule_details(rule_name)["expected"],
            "rule_type": rule["rule_type"],
            "template": rule["template"],
            "description": rule["rule"],
            "active": active,
            "fields": sorted(aggregate["fields"]),
            "processed": aggregate["applicable"],
            "corrected": aggregate["corrected"],
            "corrected_valid": aggregate["corrected_valid"],
            "corrected_consistent": aggregate["corrected_consistent"],
            "corrected_records": len(aggregate["corrected_records"]),
            "corrected_consistent_records": len(
                aggregate["corrected_consistent_records"]
            ),
            "null": aggregate["missing"],
            "issues": bucket["active_issues"],
            "quality_score": quality["score"] if quality["score"] is not None else 0,
        })
        rule_templates.append({
            "id": rule["id"],
            "name": rule["template"],
            "rule_type": rule["rule_type"],
            "description": rule["rule"],
            "active": active,
            "fields": sorted(aggregate["fields"]),
        })

    active_rules = [rule for rule in rule_stats if rule["active"]]
    active_rule_types = sorted({rule["rule_type"] for rule in active_rules})
    jobs = [
        _artifact_job("Preprocessing", pre_csv),
        _artifact_job("Standardization", std_csv),
    ]
    artifact_stages_completed = sum(1 for job in jobs if job["artifact_available"])
    artifact_stages_total = len(jobs)
    completed_jobs = None
    total_jobs = None

    duplicate_match_confidence, candidate_pairs = _candidate_confidence_metrics(candidate_csv)
    duplicate_pairs_merged = _csv_count_rows(superseded_csv)

    top_exceptions = []
    for stat in score_by_field:
        for exception_type, key in (
            ("Missing value", "null"),
            ("Invalid value", "invalid"),
            ("Inconsistent format", "inconsistent"),
        ):
            if stat[key]:
                top_exceptions.append({
                    "attribute": stat["attribute"],
                    "exception_type": exception_type,
                    "count": stat[key],
                    "affected_records": stat["affected_records"],
                })
    top_exceptions.sort(key=lambda item: item["count"], reverse=True)

    quality_dimensions = [
        {
            "key": "completeness",
            "label": "Completeness",
            "score": global_scores["completeness"],
            "numerator": global_quality["present"],
            "denominator": global_quality["applicable"],
            "calculation": "Populated rule-applicable cells / all rule-applicable cells",
            "available": global_scores["completeness"] is not None,
        },
        {
            "key": "validity",
            "label": "Validity",
            "score": global_scores["validity"],
            "numerator": global_quality["valid"],
            "denominator": global_quality["valid_evaluated"],
            "calculation": "Populated values passing field validation / populated values evaluated",
            "available": global_scores["validity"] is not None,
        },
        {
            "key": "consistency",
            "label": "Consistency",
            "score": global_scores["consistency"],
            "numerator": global_quality["consistent"],
            "denominator": global_quality["consistent_evaluated"],
            "calculation": "Populated values in the canonical standard / populated values evaluated",
            "available": global_scores["consistency"] is not None,
        },
        {
            "key": "uniqueness",
            "label": "Uniqueness",
            "score": global_scores["uniqueness"],
            "numerator": global_quality["unique_records"],
            "denominator": records_ingested,
            "calculation": "Records remaining after exact duplicate business rows are removed / records ingested",
            "available": global_scores["uniqueness"] is not None,
        },
        {
            "key": "accuracy",
            "label": "Accuracy",
            "score": None,
            "numerator": None,
            "denominator": None,
            "calculation": "Requires comparison with a trusted reference or verified truth dataset",
            "available": False,
            "reason": "No field-level reference dataset is available for this source system.",
        },
    ]

    metric_definitions = {
        "records_ingested": {
            "label": "Records Ingested",
            "value": records_ingested,
            "calculation": "Physical data rows in the selected source system's preprocessed union file.",
            "source": "preprocessed_data/<source>/all_preprocessed.csv",
        },
        "standardized": {
            "label": "Standardized",
            "value": standardized_records,
            "calculation": "Input records with a matching record ID, source file, and occurrence in standardized output.",
            "source": "standardized_data/<source>/all_standardized.csv",
        },
        "records_changed": {
            "label": "Records Changed",
            "value": records_changed,
            "calculation": "Distinct standardized records where at least one configured cleansing field changed to a non-blank value.",
            "numerator": records_changed,
            "denominator": records_ingested,
        },
        "rejected": {
            "label": "Rejected",
            "value": rejected_records,
            "calculation": "Input records with no matching standardized output record.",
            "numerator": rejected_records,
            "denominator": records_ingested,
        },
        "duplicate_pairs_merged": {
            "label": "Duplicate Pairs Merged",
            "value": duplicate_pairs_merged,
            "calculation": "Record-to-golden merge links written to superseded_ids.csv; each row is one merged source record.",
            "source": "golden_records_output/<source>/superseded_ids.csv",
        },
        "needs_review": {
            "label": "Needs Review",
            "value": len(global_quality["affected_records"]),
            "calculation": "Distinct records that were rejected or contain at least one missing, invalid, or non-canonical monitored value.",
            "numerator": len(global_quality["affected_records"]),
            "denominator": records_ingested,
        },
        "overall_data_quality_score": {
            "label": "Overall Data Quality Score",
            "value": overall_quality_score,
            "calculation": "Arithmetic mean of available Completeness, Validity, Consistency, and record-level Uniqueness scores. Accuracy is excluded while no reference data exists.",
        },
        "active_issues": {
            "label": "Active Issues",
            "value": global_quality["active_issues"],
            "calculation": "Missing, invalid, and inconsistent field findings plus rejected records. One record can have multiple issues.",
        },
        "healthy_records_pct": {
            "label": "Healthy Records %",
            "value": healthy_records_pct,
            "calculation": "Records with zero active issues / records ingested.",
            "numerator": healthy_records,
            "denominator": records_ingested,
        },
        "at_risk_records": {
            "label": "At-Risk Records",
            "value": at_risk_records,
            "calculation": "Distinct standardized records with at least one missing, invalid, inconsistent, or duplicate finding.",
            "numerator": at_risk_records,
            "denominator": records_ingested,
        },
        "needs_review_records": {
            "label": "Needs Review",
            "value": needs_review_records,
            "calculation": "Input records rejected because no corresponding standardized output record exists.",
            "numerator": needs_review_records,
            "denominator": records_ingested,
        },
        "fields_monitored": {
            "label": "Fields Monitored",
            "value": len(field_stats),
            "calculation": "Distinct fields with an applicable cleansing rule in the selected source table schemas.",
            "source": "preprocessed_data/<source>/preprocessed_*.csv",
        },
        "cleansing_rules": {
            "label": "Cleansing Rules",
            "value": len(_standardization_rules()),
            "calculation": "Reusable rule families configured in the standardization engine.",
            "source": "Configured standardization rule catalog",
        },
        "rule_types": {
            "label": "Rule Types",
            "value": len(active_rule_types),
            "calculation": "Distinct rule types with at least one applicable field in the selected source schemas.",
        },
        "rule_templates": {
            "label": "Rule Templates",
            "value": len(rule_templates),
            "calculation": "Reusable governed templates exposed by the configured standardization rule catalog.",
        },
        "active_rules": {
            "label": "Active Rules",
            "value": len(active_rules),
            "calculation": "Configured rule families with at least one applicable field in the selected source schemas.",
        },
        "completed_jobs": {
            "label": "Completed Jobs",
            "value": None,
            "calculation": "Not available: preprocessing and standardization artifacts prove stage output, not durable job executions.",
            "reason": "No durable job-history artifact is persisted for this source system.",
        },
        "artifact_stages_completed": {
            "label": "Artifact Stages Available",
            "value": artifact_stages_completed,
            "calculation": "Required preprocessing and standardization output artifacts currently present.",
            "numerator": artifact_stages_completed,
            "denominator": artifact_stages_total,
        },
        "total_field_changes": {
            "label": "Field Corrections",
            "value": total_field_changes,
            "calculation": "Changed non-blank output cells summed across all applicable cleansing fields.",
        },
        "processing_success_rate": {
            "label": "Processing Success",
            "value": processing_success_rate,
            "calculation": "Input records with a matching standardized output / records ingested.",
            "numerator": standardized_records,
            "denominator": records_ingested,
        },
    }

    conformance_trend = [{
        "date": "Current",
        "records_ingested": records_ingested,
        "conformance": overall_quality_score,
        "rejection_rate": rejection_rate,
    }]

    quality_caveat = None
    if source == "automotive":
        quality_caveat = (
            "Provisional rule output: service-schedule clicks are currently mapped as dates, "
            "open end-dates are counted as missing, and Canadian postal codes need a "
            "locale-safe ZIP rule."
        )

    result = {
        "schema_version": 2,
        "report_revision": _STANDARDIZATION_REPORT_REVISION,
        "artifact_signature": artifact_signature,
        "status": "success",
        "source_system": source,
        "data_available": bool(pre_csv and std_csv and records_ingested),
        "summary": {
            "total_records_ingested": records_ingested,
            "total_standardized": standardized_records,
            "standardized_output_rows": output_record_count,
            "unexpected_output_records": unexpected_output_records,
            "total_rejected": rejected_records,
            "processing_success_rate": processing_success_rate,
            "conformance_score": overall_quality_score,
            "records_changed": records_changed,
            "records_changed_rate": records_changed_rate,
            "total_field_changes": total_field_changes,
            "candidate_pairs": candidate_pairs,
            "duplicate_pair_merged": duplicate_pairs_merged,
            "needs_steward_review": len(global_quality["affected_records"]),
            "needs_review_rate": _quality_score(len(global_quality["affected_records"]), records_ingested),
            "affected_records": len(global_quality["affected_records"]),
            "at_risk_records": at_risk_records,
            "at_risk_records_pct": at_risk_records_pct,
            "needs_review_records": needs_review_records,
            "needs_review_records_pct": needs_review_records_pct,
            "overall_data_quality_score": overall_quality_score,
            "total_records": records_ingested,
            "fields_monitored": len(field_stats),
            "active_issues": global_quality["active_issues"],
            "records_cleansed": records_changed,
            "healthy_records": healthy_records,
            "healthy_records_pct": healthy_records_pct,
            "duplicate_records": len(duplicate_keys),
            "cleansing_rules": len(_standardization_rules()),
            "rule_types": len(active_rule_types),
            "rule_templates": len(rule_templates),
            "active_rules": len(active_rules),
            "completed_jobs": completed_jobs,
            "total_jobs": total_jobs,
            "artifact_stages_completed": artifact_stages_completed,
            "artifact_stages_total": artifact_stages_total,
            "average_quality_score": overall_quality_score,
        },
        "field_standardization": field_level_stats,
        "standardization_rules": rule_stats,
        "rule_templates": rule_templates,
        "rule_types": active_rule_types,
        "jobs": jobs,
        "conformance_trend": conformance_trend,
        "duplicate_match_confidence": duplicate_match_confidence,
        "top_exceptions": top_exceptions[:15],
        "quality_dimensions": quality_dimensions,
        "score_by_table": score_by_table,
        "score_by_field": score_by_field,
        "issue_summary": [
            {
                "type": "Missing values",
                "count": sum(stat["null"] for stat in score_by_field),
                "description": "Rule-applicable cells that are blank after standardization.",
            },
            {
                "type": "Invalid values",
                "count": sum(stat["invalid"] for stat in score_by_field),
                "description": "Populated values that fail field validation.",
            },
            {
                "type": "Inconsistent formats",
                "count": sum(stat["inconsistent"] for stat in score_by_field),
                "description": "Populated values that do not match the canonical format.",
            },
            {
                "type": "Rejected records",
                "count": rejected_records,
                "description": "Input records with no corresponding standardized output.",
            },
            {
                "type": "Exact duplicate records",
                "count": len(duplicate_keys),
                "description": "Records beyond the first exact business-value row within the same source table.",
            },
        ],
        "metric_definitions": metric_definitions,
        "quality_caveat": quality_caveat,
        "explain_report": {
            "title": "How this report is calculated",
            "summary": (
                "Metrics are calculated from the selected source system's preprocessed and standardized "
                "artifacts. Counts use physical rows and record-level issue sets; quality scores use only "
                "fields with configured cleansing rules that belong to each source table."
            ),
            "accuracy_note": (
                "Accuracy is intentionally not scored because the pipeline has no trusted field-level "
                "reference dataset. It is excluded from the overall score instead of being estimated."
            ),
            "history_note": (
                "Only the current snapshot is shown because timestamped historical quality snapshots "
                "are not yet persisted."
            ),
            "identity_resolution_note": (
                "This report does not claim that the source passed an identity-resolution quality gate "
                "because no governed pass/fail threshold or persisted gate decision is available."
            ),
            "job_history_note": (
                "Preprocessing and standardization artifact availability is reported separately. "
                "Completed Jobs remains N/A because no durable execution-history artifact exists."
            ),
            "quality_caveat": quality_caveat,
            "sources": [
                "preprocessed_data/<source>/all_preprocessed.csv",
                "standardized_data/<source>/all_standardized.csv",
                "matching_output/<source>/candidate_pairs.csv",
                "golden_records_output/<source>/superseded_ids.csv",
            ],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
    }
    report_dir.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as handle:
        json.dump(result, handle, indent=2)
    if not uc_enabled():
        _STANDARDIZATION_REPORT_CACHE[source] = {
            "artifact_signature": artifact_signature,
            "payload": result,
        }
    return result


@app.route("/api/standardization/report-metrics", methods=["GET"])
def standardization_report_metrics():
    source = _request_source()
    result = _cached_uc_report(
        "standardization-report",
        source,
        _STANDARDIZATION_REPORT_REVISION,
        lambda: _build_standardization_report_metrics(source),
        "CODEX_STANDARDIZATION_REPORT_CACHE_SECONDS",
    )
    return jsonify(result)




@app.route("/api/standardization/summary", methods=["GET"])
def standardization_summary():
    source = _request_source()
    rules = _standardization_rules()
    if uc_enabled():
        # This view explains the configured rules and transformation examples;
        # it does not require a warehouse-wide scan. Source-specific curated
        # examples keep the page responsive even when the SQL warehouse is cold.
        return jsonify(_standardization_demo_payload(source))
    std_csv = _get_standardized_csv(source)
    if not std_csv.exists():
        result = _standardization_demo_payload(source)
        return jsonify(result)

    std_lookup = {}
    with open(std_csv, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = row.get("record_id", "")
            if rid:
                std_lookup[rid] = row

    media_source_col_maps = {
        "subscription_billing.csv": {
            "id": "subscription_id",
            "email": "billing_email",
            "phone": "contact_phone",
            "name": "subscriber_name",
            "address": "billing_address",
            "zip": "billing_zip",
        },
        "customer_support.csv": {
            "id": "ticket_id",
            "email": "customer_email",
            "phone": "customer_phone",
            "name": "customer_name",
            "address": "customer_address",
            "zip": "customer_zip",
        },
        "email_engagement.csv": {
            "id": "engagement_id",
            "email": "recipient_email",
            "phone": "recipient_phone",
            "name": "recipient_name",
        },
        "app_events.csv": {"id": "event_id", "email": "app_user_email"},
        "streaming_activity.csv": {"id": "session_id", "email": "user_email"},
    }
    automotive_source_col_maps = {
        "automotive/aut_customers.csv": {"id": "customer_id", "name": "first_name", "zip": "primary_postal_code"},
        "automotive/aut_customer_addresses.csv": {"id": "customer_id", "address": "address_type", "zip": "postal_code"},
        "automotive/aut_campaign_eligibility.csv": {"id": "eligibility_id"},
    }
    source_col_maps = automotive_source_col_maps if source == "automotive" else media_source_col_maps

    candidates = []
    for fname, col_map in source_col_maps.items():
        raw_path = _source_path(fname)
        if not raw_path.exists():
            continue
        with open(raw_path, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                raw_id = row.get(col_map["id"], "")
                rid = f"{Path(fname).name}:{raw_id}" if source == "automotive" and raw_id else raw_id
                std = std_lookup.get(rid)
                if not std:
                    continue
                transforms = set()
                talk_parts = []

                if "email" in col_map:
                    raw_e = row.get(col_map["email"], "").strip()
                    std_e = std.get("email", "")
                    if raw_e and std_e:
                        if ".." in raw_e and ".." not in std_e:
                            transforms.add("email_double_dot")
                            talk_parts.append("Double-dot in email fixed")
                        if "@@" in raw_e:
                            transforms.add("email_double_at")
                            talk_parts.append("Double @@ in email fixed")
                        raw_local = raw_e.split("@", 1)[0] if "@" in raw_e else raw_e
                        std_local = std_e.split("@", 1)[0] if "@" in std_e else std_e
                        if "+" in raw_local and "+" in std_local:
                            transforms.add("email_plus_alias_preserved")
                            talk_parts.append("Plus addressing preserved")
                        elif "+" in raw_local and "+" not in std_local:
                            transforms.add("email_plus_alias_review")
                            talk_parts.append("Plus addressing should be preserved")
                        raw_dom = raw_e.split("@")[-1].lower() if "@" in raw_e else ""
                        std_dom = std_e.split("@")[-1].lower() if "@" in std_e else ""
                        if raw_dom and std_dom and raw_dom != std_dom:
                            transforms.add("email_domain_typo")
                            talk_parts.append(f"Domain typo corrected ({raw_dom} -> {std_dom})")

                if "phone" in col_map:
                    raw_p = row.get(col_map["phone"], "").strip()
                    std_p = std.get("phone", "")
                    if raw_p and std_p and raw_p != std_p:
                        if raw_p.startswith("+1"):
                            transforms.add("phone_country_code")
                            talk_parts.append("Country code +1 stripped")
                        if "(" in raw_p:
                            transforms.add("phone_parens")
                            talk_parts.append("Phone parentheses normalized")
                        if "-" in raw_p:
                            transforms.add("phone_dashes")
                            talk_parts.append("Phone dashes removed")

                if "address" in col_map:
                    raw_a = row.get(col_map["address"], "").strip()
                    std_a = std.get("address", "")
                    if raw_a and std_a and raw_a.lower() != std_a.lower():
                        for abbr, full in [
                            ("Blvd", "Boulevard"),
                            ("Rd", "Road"),
                            ("Ave", "Avenue"),
                            ("Dr", "Drive"),
                            ("Ln", "Lane"),
                            ("Ct", "Court"),
                            ("Wy", "Way"),
                        ]:
                            if abbr in raw_a and full.upper() in std_a:
                                transforms.add("addr_abbreviation")
                                talk_parts.append(f"{abbr} expanded to {full}")
                                break
                        if "Apt" in raw_a and "APARTMENT" in std_a:
                            transforms.add("addr_apt_expand")
                            talk_parts.append("Apt expanded to Apartment")
                        if "Suite" in raw_a or "Ste" in raw_a:
                            transforms.add("addr_suite")
                            talk_parts.append("Suite normalization")

                if "zip" in col_map:
                    raw_z = row.get(col_map["zip"], "").strip()
                    std_z = std.get("zip", "")
                    if raw_z and std_z and raw_z != std_z:
                        if "-" in raw_z:
                            transforms.add("zip_plus4")
                            talk_parts.append("ZIP+4 suffix stripped")
                        elif len(raw_z) < 5:
                            transforms.add("zip_zeropad")
                            talk_parts.append("ZIP zero-padded to 5 digits")

                if len(transforms) >= 2:
                    candidates.append(
                        {
                            "score": len(transforms) * 10 + len(talk_parts),
                            "transforms": transforms,
                            "rid": rid,
                            "source": fname,
                            "raw_row": row,
                            "std_row": std,
                            "talk_track": " · ".join(talk_parts),
                        }
                    )

    candidates.sort(key=lambda c: c["score"], reverse=True)
    selected = []
    covered_transforms = set()
    used_sources = set()

    for _ in range(6):
        best = None
        best_new = -1
        for c in candidates:
            if c["rid"] in {s["rid"] for s in selected}:
                continue
            new_count = len(c["transforms"] - covered_transforms)
            total_score = new_count + (2 if c["source"] not in used_sources else 0)
            if total_score > best_new:
                best_new = total_score
                best = c
        if best is None or best_new <= 0:
            break
        selected.append(best)
        covered_transforms |= best["transforms"]
        used_sources.add(best["source"])

    if len(selected) < 4:
        for c in candidates:
            if c["rid"] not in {s["rid"] for s in selected}:
                selected.append(c)
                if len(selected) >= 4:
                    break

    tag_maps = _read_json(TAG_MAP) or {}
    comparisons = []
    if not selected:
        with open(std_csv, "r", encoding="utf-8") as f:
            for row in csv.DictReader(f):
                rid = row.get("record_id", "")
                if not rid:
                    continue
                pre = _csv_search(_get_preprocessed_csv(source), "record_id", rid, limit=1)
                comparisons.append(
                    {
                        "record_id": rid,
                        "source": row.get("source_file", "").replace(".csv", "").replace("_", " ").title(),
                        "raw": {},
                        "preprocessed": pre["rows"][0] if pre["rows"] else {},
                        "standardized": _standardization_display_row(row),
                        "talk_track": "Selected source-system standardized sample",
                        "transform_count": 0,
                    }
                )
                if len(comparisons) >= 6:
                    break

    for sel in selected:
        rid = sel["rid"]
        src_file = sel["source"]
        raw_row = {}
        if src_file in tag_maps:
            for orig_key, value in sel["raw_row"].items():
                raw_row[tag_maps[src_file].get(orig_key, orig_key)] = value
        else:
            raw_row = dict(sel["raw_row"])
        pre = _csv_search(_get_preprocessed_csv(source), "record_id", rid, limit=1)
        comparisons.append(
            {
                "record_id": rid,
                "source": src_file.replace(".csv", "").replace("_", " ").title(),
                "raw": raw_row,
                "preprocessed": pre["rows"][0] if pre["rows"] else {},
                "standardized": _standardization_display_row(sel["std_row"]),
                "talk_track": sel["talk_track"],
                "transform_count": len(sel["transforms"]),
            }
        )

    comparisons, field_examples = _merge_standardization_examples(source, comparisons)
    if not field_examples:
        field_examples = {r["field"]: [] for r in rules}
    result = {"comparisons": comparisons, "rules": rules, "field_examples": field_examples}
    return jsonify(result)


# ---------------------------------------------------------------------------
# API: Enrichment (Customer 360)
# ---------------------------------------------------------------------------
CUSTOMER_PROFILE_EXPORT_FIELDS = get_payload_value(
    "legacy_runtime.yml",
    "legacy_runtime",
    "CUSTOMER_PROFILE_EXPORT_FIELDS",
)


_ACTIVITY_TIMESTAMP_COLUMNS = get_payload_value(
    "legacy_runtime.yml",
    "legacy_runtime",
    "_MARKETING_ENGINE_ACTIVITY_TIMESTAMP_COLUMNS",
)

_RAW_ACTIVITY_TIME_FIELDS = _ACTIVITY_TIMESTAMP_COLUMNS + [
    "stream_ended_at",
    "session_ended_at",
    "resolved_date",
    "appointment_date",
    "order_date_time",
]


def _timestamp_has_clock(value):
    """Return whether a timestamp string includes an HH:MM clock time.

    :param value: Raw timestamp value.
    :type value: str
    :returns: ``True`` when a clock time is present.
    :rtype: bool
    """
    return bool(re.search(r"(?:T|\s)\d{1,2}:\d{2}", str(value or "")))


def _first_clock_timestamp_from_row(row):
    """Return the first value in a row that contains an HH:MM clock time.

    :param row: Source or clustered CSV row.
    :type row: dict
    :returns: Timestamp string with a clock time, if any.
    :rtype: str
    """
    seen = set()
    for col in _RAW_ACTIVITY_TIME_FIELDS:
        val = str(row.get(col, "") or "").strip()
        if not val or val in seen:
            continue
        seen.add(val)
        if _timestamp_has_clock(val):
            return val
    for val in row.values():
        text = str(val or "").strip()
        if not text or text in seen:
            continue
        seen.add(text)
        if _timestamp_has_clock(text):
            return text
    return ""


def _get_activity_timestamp(row):
    """Pick the best activity timestamp column from a clustered row.

    Prefers values that include a clock time (HH:MM) over date-only values.

    :param row: Clustered source row.
    :type row: dict
    :returns: Timestamp string for timeline display and sorting.
    :rtype: str
    """
    clock = _first_clock_timestamp_from_row(row)
    if clock:
        return clock

    candidates = []
    for col in _ACTIVITY_TIMESTAMP_COLUMNS:
        val = str(row.get(col, "") or "").strip()
        if val:
            candidates.append(val)
    return candidates[0] if candidates else ""


def _activity_sort_value(row):
    timestamp = _get_activity_timestamp(row)
    if not timestamp:
        return datetime.min
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%m/%d/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(timestamp[:19], fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(timestamp.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        return datetime.min


def _activity_record_key(row, timestamp):
    return "|".join(
        [
            row.get("source_file", ""),
            row.get("record_id", ""),
            row.get("event_id", ""),
            row.get("session_id", ""),
            row.get("campaign_id", ""),
            row.get("campaign_name", ""),
            row.get("event_type", ""),
            timestamp,
        ]
    )


_ACTIVITY_DETAIL_PII_COLUMNS = {
    "email",
    "billing_email",
    "customer_email",
    "recipient_email",
    "app_user_email",
    "user_email",
    "account_email",
    "phone",
    "customer_phone",
    "contact_phone",
    "recipient_phone",
    "phone_mobile",
    "full_name",
    "first_name",
    "last_name",
    "customer_name",
    "subscriber_name",
    "recipient_name",
    "billing_address",
    "customer_address",
    "address",
    "address_line1",
    "address_line2",
    "billing_city",
    "customer_city",
    "city",
    "billing_state",
    "customer_state",
    "state",
    "state_code",
    "billing_zip",
    "customer_zip",
    "zip",
    "zip_code",
    "dob",
    "birth_date",
}

_activity_detail_fields_cache = {"signature": None, "by_source": {}}


def _activity_detail_field_label(field_key):
    """Convert a CSV column name to a human-readable label.

    :param field_key: Raw column name from a source CSV header.
    :type field_key: str
    :returns: Title-cased label with common acronyms preserved.
    :rtype: str
    """
    label = str(field_key or "").replace("_", " ").strip().title()
    for token, replacement in (
        ("Id", "ID"),
        ("Ip", "IP"),
        ("Os", "OS"),
        ("Url", "URL"),
        ("Ltv", "LTV"),
        ("Dma", "DMA"),
    ):
        label = label.replace(token, replacement)
    return label


def _rebuild_activity_detail_fields():
    """Regenerate ``activity_detail_fields.csv`` from discovered source CSV headers.

  Scans all files returned by :func:`_discover_sources`, maps each column to a
  display label, and writes one row per field for use by the activity detail API.

    :returns: Number of field rows written.
    :rtype: int
    """
    fieldnames = [
        "source_file",
        "source_label",
        "id_column",
        "field_key",
        "field_label",
        "display_order",
    ]
    output_rows = []
    for source_file in _discover_sources():
        path = _source_path(source_file)
        if not path.exists():
            continue
        columns = _csv_columns(path)
        if not columns:
            continue
        base_name = Path(source_file).name
        source_label = _source_display_name(source_file)
        id_column = _source_id_column(base_name)
        order = 0
        for column in columns:
            key = str(column or "").strip()
            if not key or key == id_column:
                continue
            if key.lower() in _ACTIVITY_DETAIL_PII_COLUMNS:
                continue
            order += 1
            output_rows.append(
                {
                    "source_file": base_name,
                    "source_label": source_label,
                    "id_column": id_column,
                    "field_key": key,
                    "field_label": _activity_detail_field_label(key),
                    "display_order": str(order),
                }
            )

    ACTIVITY_DETAIL_FIELDS_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(ACTIVITY_DETAIL_FIELDS_CSV, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(output_rows)

    _activity_detail_fields_cache["signature"] = None
    _activity_detail_fields_cache["by_source"] = {}
    return len(output_rows)


def _load_activity_detail_fields_by_source():
    """Load activity detail field config grouped by ``source_file``.

    Rebuilds the CSV when missing. Uses an mtime-based cache so repeated API
    calls do not re-read the file unless it changed on disk.

    :returns: Mapping of source filename to list of field config dicts.
    :rtype: dict[str, list[dict]]
    """
    if not ACTIVITY_DETAIL_FIELDS_CSV.exists():
        _rebuild_activity_detail_fields()

    signature = _file_signature(ACTIVITY_DETAIL_FIELDS_CSV)
    if _activity_detail_fields_cache["signature"] == signature:
        return _activity_detail_fields_cache["by_source"]

    grouped = {}
    if ACTIVITY_DETAIL_FIELDS_CSV.exists():
        with open(ACTIVITY_DETAIL_FIELDS_CSV, "r", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                source_file = str(row.get("source_file", "") or "").strip()
                if not source_file:
                    continue
                grouped.setdefault(source_file, []).append(row)
        for rows in grouped.values():
            rows.sort(key=lambda item: int(str(item.get("display_order", 0) or 0)))

    _activity_detail_fields_cache["signature"] = signature
    _activity_detail_fields_cache["by_source"] = grouped
    return grouped


def _lookup_superseded_record(golden_id, record_id, source=None):
    """Find a superseded bridge row for a golden record and source record id.

    :param golden_id: Golden record identifier.
    :type golden_id: str
    :param record_id: Source-system record identifier.
    :type record_id: str
    :param source: Optional cluster source system scope.
    :type source: str | None
    :returns: Matching superseded row, if any.
    :rtype: dict | None
    """
    golden_id = golden_id.upper()
    record_id = record_id.upper()
    if uc_enabled():
        golden_variants = set(_golden_id_variants(golden_id))
        rows = _uc_lookup_rows(
            "superseded_ids",
            source,
            {
                "golden_id": golden_variants,
                "record_id": [record_id],
            },
            limit=20,
            raise_on_error=True,
        )
        for row in rows:
            if (
                str(row.get("golden_id") or "").strip().upper() in golden_variants
                and str(row.get("record_id") or "").strip().upper() == record_id
            ):
                return row
        return None

    superseded_csv = _get_superseded_csv(source)
    if not superseded_csv.exists():
        return None
    with open(superseded_csv, "r", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if (
                row.get("golden_id", "").upper() == golden_id
                and row.get("record_id", "").upper() == record_id
            ):
                return row
    return None


def _lookup_clustered_record_for_golden(golden_id, record_id, source=None):
    """Return one source-scoped clustered row owned by a golden profile.

    The row-level lookup is the fallback when a current cluster member is not
    present in ``superseded_ids``. This is common for retained representative
    records and avoids loading an entire cluster merely to recover the
    activity's source table.
    """
    source = _normalize_cluster_source(source)
    golden_id = str(golden_id or "").strip().upper()
    record_id_raw = str(record_id or "").strip()
    record_id_key = _normalize_activity_id(record_id_raw)
    if not golden_id or not record_id_key:
        return None

    cluster_ids = {
        variant.replace("-GR-", "-CL-")
        for variant in _golden_id_variants(golden_id)
    }
    if uc_enabled():
        record_rows = _uc_lookup_rows(
            "clustered_records",
            source,
            # Keep the displayed/generated spelling as well as its normalized
            # variant. The UC implementation compares case-insensitively, while
            # compatible/test backends may retain case-sensitive string keys.
            {"record_id": [record_id_raw, record_id_raw.upper()]},
            limit=20,
            raise_on_error=True,
        )

        def matching_row(rows):
            for row in rows:
                if (
                    _normalize_activity_id(row.get("record_id")) == record_id_key
                    and str(row.get("cluster_id") or "").strip().upper()
                    in cluster_ids
                ):
                    return row
            return None

        matched = matching_row(record_rows)
        if matched is not None:
            return matched

        # A configured golden record may publish a non-derived cluster ID.
        # Resolve it only when the normal GR -> CL convention did not match.
        golden_rows = _uc_lookup_rows(
            "golden_records",
            source,
            {"golden_id": _golden_id_variants(golden_id)},
            limit=20,
            raise_on_error=True,
        )
        cluster_ids.update(
            str(row.get("cluster_id") or "").strip().upper()
            for row in golden_rows
            if str(row.get("cluster_id") or "").strip()
        )
        matched = matching_row(record_rows)
        if matched is not None:
            return matched

        # Some generated activity identifiers are visible in the graph but do
        # not satisfy a row-level lookup after a pipeline refresh. Re-read only
        # the selected customer's source-scoped clusters and validate the ID in
        # memory. This keeps the fallback bounded and prevents a record owned by
        # another golden profile (or source system) from being accepted.
        cluster_rows = _uc_lookup_rows(
            "clustered_records",
            source,
            {"cluster_id": sorted(cluster_ids)},
            limit=10000,
            raise_on_error=True,
        )
        return matching_row(cluster_rows)

    _golden_row, _cluster_id, cluster_rows = _profile_context_for_golden_id(
        source,
        golden_id,
    )
    for row in cluster_rows:
        if _normalize_activity_id(row.get("record_id")) == record_id_key:
            return row
    return None


_ACTIVITY_CLUSTER_ID_FIELDS = (
    "record_id",
    "source_record_id",
    "event_id",
    "session_id",
    "streaming_session_id",
    "digital_session_id",
    "engagement_id",
    "ticket_id",
    "ticket_number",
    "subscription_id",
)


def _normalize_activity_id(value):
    """Normalize an activity identifier for ownership comparisons only."""
    return str(value or "").strip().casefold()


def _activity_clustered_row_for_golden(golden_id, record_id, source=None):
    """Resolve an activity row through direct lookup or its profile cluster.

    The fallback deliberately reuses the same profile context that produced
    the timeline. This guarantees that a displayed event can be revalidated
    case-insensitively without accepting a record from another customer.
    """
    direct = _lookup_clustered_record_for_golden(
        golden_id,
        record_id,
        source=source,
    )
    if direct is not None:
        return direct

    target = _normalize_activity_id(record_id)
    if not target:
        return None
    _golden_row, _cluster_id, cluster_rows = _profile_context_for_golden_id(
        source,
        golden_id,
    )
    for row in cluster_rows or []:
        if any(
            _normalize_activity_id(row.get(field)) == target
            for field in _ACTIVITY_CLUSTER_ID_FIELDS
            if str(row.get(field) or "").strip()
        ):
            return row
    return None


def _activity_raw_id_candidates(clustered_row, source_file):
    """Return source-column/value pairs recoverable from a clustered row."""
    source_name = Path(str(source_file or "").replace("\\", "/")).name.lower()
    primary_column = _source_id_column(source_name)
    field_pairs = [(primary_column, primary_column)]
    field_pairs.extend(
        {
            "med_customer_support.csv": (
                ("ticket_number", "ticket_number"),
                ("ticket_id", "ticket_id"),
            ),
            "spt_ott_streaming_sessions.csv": (
                ("streaming_session_id", "streaming_session_id"),
                ("session_id", "streaming_session_id"),
            ),
        }.get(source_name, ())
    )
    # source_record_id is the standard pipeline-preserved raw-key alias.
    field_pairs.append(("source_record_id", primary_column))

    candidates = []
    seen = set()
    for clustered_field, raw_column in field_pairs:
        value = str((clustered_row or {}).get(clustered_field) or "").strip()
        key = (str(raw_column or "").lower(), _normalize_activity_id(value))
        if not value or key in seen:
            continue
        seen.add(key)
        candidates.append((raw_column, value))
    return candidates


def _record_owned_by_golden(golden_id, record_id, source=None):
    """Verify that a source record belongs to the given golden record.

    Uses ``superseded_ids.csv`` first, then falls back to cluster membership.

    :param golden_id: Golden record identifier.
    :type golden_id: str
    :param record_id: Source-system record identifier.
    :type record_id: str
    :param source: Optional cluster source system scope.
    :type source: str | None
    :returns: ``True`` when the record is linked to the golden id.
    :rtype: bool
    """
    if _lookup_superseded_record(golden_id, record_id, source=source):
        return True

    source = _normalize_cluster_source(source)
    if uc_enabled():
        return (
            _lookup_clustered_record_for_golden(
                golden_id,
                record_id,
                source=source,
            )
            is not None
        )

    golden_csv = _get_golden_csv(source)
    clustered_csv = _get_clustered_csv(source)
    golden_id = golden_id.upper()
    record_id = record_id.upper()
    cluster_id = ""
    if golden_csv.exists():
        with open(golden_csv, "r", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                if row.get("golden_id", "").upper() == golden_id:
                    cluster_id = row.get("cluster_id", "")
                    break
    if not cluster_id or not clustered_csv.exists():
        return False
    with open(clustered_csv, "r", encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            if (
                row.get("cluster_id", "") == cluster_id
                and row.get("record_id", "").upper() == record_id
            ):
                return True
    return False


def _composite_row_index(record_id):
    """Extract the 1-based data-row index from a composite automotive record id.

    :param record_id: Timeline record identifier.
    :type record_id: str
    :returns: Row number when present (``row-296`` -> ``296``), else ``0``.
    :rtype: int
    """
    parts = str(record_id or "").strip().split(":")
    if len(parts) < 3:
        return 0
    suffix = str(parts[-1] or "").strip().lower()
    if not suffix.startswith("row-"):
        return 0
    try:
        return int(suffix.split("-", 1)[1])
    except (IndexError, ValueError):
        return 0


def _composite_source_name(record_id):
    """Return the source CSV filename embedded in a composite record id.

    :param record_id: Timeline record identifier.
    :type record_id: str
    :returns: Lowercased source filename or an empty string.
    :rtype: str
    """
    parts = str(record_id or "").strip().split(":")
    source_token = Path(str(parts[0] or "")).name.lower() if parts else ""
    if source_token.endswith(".csv") or source_token.startswith(
        ("aut_", "auto_", "med_", "spt_", "tel_")
    ):
        return source_token
    return ""


def _fetch_raw_row_by_data_index(source_name, row_index):
    """Load a raw CSV row by 1-based data-row position (``row-N`` composites).

    :param source_name: Source CSV filename.
    :type source_name: str
    :param row_index: 1-based index among data rows (excluding header).
    :type row_index: int
    :returns: Row dict when found.
    :rtype: dict | None
    """
    if row_index <= 0 or not source_name:
        return None
    for path in _source_path_candidates(source_name):
        try:
            resolved = path.resolve()
        except OSError:
            continue
        if not resolved.exists():
            continue
        with open(resolved, "r", encoding="utf-8") as handle:
            for line_no, row in enumerate(csv.DictReader(handle), start=1):
                if line_no == row_index:
                    return row
    return None


def _parse_activity_record_ref(record_id, source_file=None):
    """Resolve source filename and raw primary-key value from a timeline record id.

    Automotive clustered rows use composite ids such as
    ``aut_sales_transactions.csv:DLR00025:row-296`` or
    ``aut_connected_services_subscriptions.csv:SUB00000059:row-1``.

    :param record_id: Timeline or superseded record identifier.
    :type record_id: str
    :param source_file: Optional source file hint from superseded bridge.
    :type source_file: str | None
    :returns: Tuple of source filename and raw id for CSV lookup.
    :rtype: tuple[str | None, str]
    """
    record_id = str(record_id or "").strip()
    hint = Path(str(source_file or "")).name
    parts = record_id.split(":")
    source_token = Path(str(parts[0] or "")).name.lower() if parts else ""
    if len(parts) >= 2 and (
        source_token.endswith(".csv")
        or source_token.startswith(("aut_", "auto_", "med_", "spt_", "tel_"))
    ):
        return source_token, str(parts[1]).strip().upper()
    if hint:
        return hint, record_id.upper()
    return None, record_id.upper()


def _batch_fetch_raw_rows(source_file, record_ids):
    """Fetch multiple raw source rows with a single CSV pass.

    :param source_file: Source CSV filename.
    :type source_file: str
    :param record_ids: Record identifiers to resolve (simple or composite).
    :type record_ids: collections.abc.Iterable[str]
    :returns: Mapping of upper-cased record id to row dict.
    :rtype: dict[str, dict]
    """
    found = {}
    lookup_keys = {}
    source_name = Path(str(source_file or "").replace("\\", "/")).name
    for record_id in record_ids or []:
        record_key = str(record_id or "").strip().upper()
        if not record_key or record_key in found:
            continue
        row_index = _composite_row_index(record_id)
        composite_source = _composite_source_name(record_id) or source_name
        if row_index > 0 and composite_source:
            row = _fetch_raw_row_by_data_index(composite_source, row_index)
            if row:
                found[record_key] = row
                continue
        _source_name, raw_id = _parse_activity_record_ref(record_id, source_file)
        if raw_id:
            lookup_keys[raw_id.upper()] = record_key

    if not lookup_keys or not source_name:
        return found

    id_col = _source_id_column(source_name)
    if uc_enabled():
        rows = _uc_lookup_rows(
            source_name,
            _source_system_for_file(source_name),
            {id_col: list(lookup_keys)},
            limit=max(len(lookup_keys), 1),
        )
        for row in rows:
            raw_id = str(row.get(id_col, "") or "").strip().upper()
            record_key = lookup_keys.get(raw_id)
            if record_key:
                found[record_key] = row
        return found

    needed = set(lookup_keys.keys())
    for path in _source_path_candidates(source_name):
        try:
            resolved = path.resolve()
        except OSError:
            continue
        if not resolved.exists():
            continue
        with open(resolved, "r", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                rid = str(row.get(id_col, "") or "").strip().upper()
                if rid not in needed:
                    continue
                found[lookup_keys[rid]] = row
                needed.discard(rid)
                if not needed:
                    return found
    return found


def _enrich_activity_event_timestamps(events):
    """Attach clock times from raw source rows to timeline events when needed.

    Only scans each source CSV once per batch of pending events.

    :param events: Timeline event dicts (modified in place).
    :type events: list[dict]
    :rtype: None
    """
    pending = {}
    for event in events or []:
        if _timestamp_has_clock(event.get("event_timestamp", "")):
            continue
        source_file = str(event.get("source_file", "") or "").strip()
        record_id = str(event.get("record_id", "") or "").strip()
        if source_file and record_id:
            pending.setdefault(source_file, set()).add(record_id)

    resolved = {}
    for source_file, record_ids in pending.items():
        raw_rows = _batch_fetch_raw_rows(source_file, record_ids)
        for record_key, raw_row in raw_rows.items():
            record_key = str(record_key or "").strip().upper()
            if not record_key or record_key in resolved:
                continue
            clock = _first_clock_timestamp_from_row(raw_row)
            if clock:
                resolved[record_key] = clock

    for event in events or []:
        record_id = str(event.get("record_id", "") or "").strip().upper()
        if record_id in resolved:
            event["event_timestamp"] = resolved[record_id]


def _fetch_raw_row(record_id, source_file=None, source=None, id_column=None):
    """Fetch a single raw source row by record id and optional source file.

    :param record_id: Source-system record identifier.
    :type record_id: str
    :param source_file: Optional originating CSV filename from superseded bridge.
    :type source_file: str | None
    :param source: Optional source-system scope for governed UC resolution.
    :type source: str | None
    :param id_column: Optional source-native key column override.
    :type id_column: str | None
    :returns: Tuple of row dict and resolved source filename.
    :rtype: tuple[dict | None, str | None]
    """
    record_id_raw = str(record_id or "").strip()
    source_name, raw_id = _parse_activity_record_ref(record_id_raw, source_file=source_file)
    row_index = _composite_row_index(record_id_raw)
    composite_source = _composite_source_name(record_id_raw) or source_name

    if uc_enabled():
        lookup_source = source_name or composite_source or _source_for_record_id(record_id_raw)
        if lookup_source:
            source_scope = _normalize_cluster_source(
                source or _source_system_for_file(lookup_source)
            )
            id_col = str(id_column or "").strip() or _source_id_column(lookup_source)
            rows = _uc_lookup_rows(
                lookup_source,
                source_scope,
                {id_col: [raw_id]},
                limit=2,
            )
            for row in rows:
                if str(row.get(id_col, "") or "").strip().upper() == raw_id.upper():
                    return row, Path(lookup_source).name
        return None, Path(lookup_source).name if lookup_source else None

    if source_name and raw_id:
        path = _source_path(source_name)
        id_col = str(id_column or "").strip() or _source_id_column(source_name)
        data = _csv_search(path, id_col, raw_id, limit=2)
        if len(data.get("rows", [])) == 1:
            return data["rows"][0], source_name

    if composite_source and row_index > 0:
        row = _fetch_raw_row_by_data_index(composite_source, row_index)
        if row:
            return row, composite_source

    if source_name and raw_id:
        path = _source_path(source_name)
        id_col = str(id_column or "").strip() or _source_id_column(source_name)
        data = _csv_search(path, id_col, raw_id, limit=1)
        if data["rows"]:
            return data["rows"][0], source_name

    record_id = record_id_raw.upper()
    if source_file:
        path = _source_path(source_file)
        id_col = str(id_column or "").strip() or _source_id_column(Path(source_file).name)
        data = _csv_search(path, id_col, record_id, limit=1)
        if data["rows"]:
            return data["rows"][0], Path(source_file).name

    data, resolved = _search_raw_by_record_id(record_id, limit=1)
    if data["rows"]:
        return data["rows"][0], resolved
    return None, None


def _build_event_summary(row):
    """Build a short human-readable summary for a timeline event.

    :param row: Clustered or standardized source row.
    :type row: dict
    :returns: One-line activity summary for the UI timeline.
    :rtype: str
    """
    source_file = str(row.get("source_file", "") or "").lower()
    parts = []

    if "support" in source_file:
        if row.get("category"):
            parts.append(str(row.get("category", "")).strip())
        if row.get("priority"):
            parts.append(f"{str(row.get('priority', '')).strip()} priority")
        if row.get("status"):
            parts.append(str(row.get("status", "")).strip())
    elif "billing" in source_file or "subscription" in source_file:
        if row.get("subscription_tier"):
            parts.append(str(row.get("subscription_tier", "")).strip())
        amount = row.get("monthly_amount") or row.get("billing_amount")
        if amount:
            parts.append(f"${str(amount).strip()}")
        if row.get("account_status"):
            parts.append(str(row.get("account_status", "")).strip())
    elif "email" in source_file:
        if row.get("campaign_name"):
            parts.append(str(row.get("campaign_name", "")).strip())
        opened = str(row.get("opened", "") or "").strip().lower()
        if opened in {"true", "1", "yes", "y"}:
            parts.append("Opened")
        clicked = str(row.get("clicked", "") or "").strip().lower()
        if clicked in {"true", "1", "yes", "y"}:
            parts.append("Clicked")
    elif "stream" in source_file:
        if row.get("content_type"):
            parts.append(str(row.get("content_type", "")).strip())
        completion = row.get("completion_pct")
        if completion not in (None, ""):
            try:
                completion_value = float(str(completion).strip())
                if 0 <= completion_value <= 1:
                    completion_value = round(completion_value * 100, 1)
                parts.append(f"{completion_value}% completed")
            except ValueError:
                parts.append(f"{str(completion).strip()}% completed")
        platform = row.get("device_platform") or row.get("device_type")
        if platform:
            parts.append(str(platform).strip())
    elif "app" in source_file:
        if row.get("event_type"):
            parts.append(str(row.get("event_type", "")).strip())
        platform = row.get("device_platform") or row.get("device_type")
        if platform:
            parts.append(str(platform).strip())
        if row.get("app_version"):
            parts.append(f"v{str(row.get('app_version', '')).strip()}")
    else:
        if row.get("event_type"):
            parts.append(str(row.get("event_type", "")).strip())
        if row.get("campaign_name"):
            parts.append(str(row.get("campaign_name", "")).strip())
        if row.get("content_type"):
            parts.append(str(row.get("content_type", "")).strip())

    cleaned = [part for part in parts if part]
    if cleaned:
        return " · ".join(cleaned)
    label = Path(str(row.get("source_file", "") or "")).stem.replace("_", " ").title()
    return label or "Activity"


_STANDARDIZED_SUBSCRIPTIONS_CACHE = {}

_SUBSCRIPTION_SOURCE_PATTERNS = get_payload_value(
    "legacy_runtime.yml",
    "legacy_runtime",
    "_MARKETING_ENGINE_SUBSCRIPTION_SOURCE_PATTERNS",
)


def _subscription_source_patterns(source=None):
    """Return filename substrings that identify subscription rows for a source system.

    :param source: Cluster source key (``media``, ``sports``, etc.).
    :type source: str | None
    :returns: Tuple of lowercase filename fragments.
    :rtype: tuple[str, ...]
    """
    src = _normalize_cluster_source(source)
    return _SUBSCRIPTION_SOURCE_PATTERNS.get(
        src,
        tuple(
            pattern
            for patterns in _SUBSCRIPTION_SOURCE_PATTERNS.values()
            for pattern in patterns
        ),
    )


def _is_subscription_cluster_row(row, source=None):
    """Return whether a clustered row represents a subscription record.

    :param row: Clustered CSV row.
    :type row: dict
    :param source: Cluster source key.
    :type source: str | None
    :returns: ``True`` when the row is from a subscription source file.
    :rtype: bool
    """
    source_file = str(row.get("source_file", "") or "").lower()
    record_id = str(row.get("record_id", "") or "").upper()
    if any(pattern in source_file for pattern in _subscription_source_patterns(source)):
        return True
    return record_id.startswith(("SB-", "TEL-SUB-")) or (
        record_id.startswith("SUB") and not record_id.startswith("SUBSCRIBER")
    )


def _first_non_empty_field(row, *keys):
    """Return the first non-empty value among the given row keys.

    :param row: CSV row mapping.
    :type row: dict
    :param keys: Column names to inspect in order.
    :type keys: str
    :returns: Stripped field value or an empty string.
    :rtype: str
    """
    for key in keys:
        value = str(row.get(key, "") or "").strip()
        if value:
            return value
    return ""


def _parse_flexible_datetime(value):
    """Parse common date and datetime strings used across source files.

    :param value: Raw date or datetime text.
    :type value: str
    :returns: Parsed naive datetime, or ``None`` when parsing fails.
    :rtype: datetime | None
    """
    text = str(value or "").strip()
    if not text:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        return parsed
    except ValueError:
        pass
    for fmt in (
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
        "%m/%d/%Y",
        "%d-%m-%Y",
    ):
        try:
            return datetime.strptime(text[:19], fmt)
        except ValueError:
            continue
    return None


def _normalize_subscription_payload(row, source=None):
    """Map a standardized subscription row to a Customer 360 subscription dict.

    :param row: Standardized or clustered subscription row.
    :type row: dict
    :param source: Cluster source key.
    :type source: str | None
    :returns: Normalized subscription metadata for the UI.
    :rtype: dict
    """
    src = _normalize_cluster_source(source)
    source_file = str(row.get("source_file", "") or "").lower()
    subscription_id = _first_non_empty_field(
        row,
        "record_id",
        "source_record_id",
        "subscription_id",
        "fan_account_id",
        "loyalty_member_id",
    )
    if "connected_services_subscriptions" in source_file and ":" in subscription_id:
        subscription_id = _first_non_empty_field(row, "source_record_id") or subscription_id.split(":")[-2]

    subscriber_id = ""
    start_date = ""
    end_date = ""
    status = ""
    plan = ""

    if src == "media" or "subscription_billing" in source_file:
        subscriber_id = _first_non_empty_field(row, "push_token", "subscriber_id")
        start_date = _first_non_empty_field(row, "billing_date")
        status = _first_non_empty_field(row, "account_status", "status")
        plan = _first_non_empty_field(row, "subscription_tier", "subscription_tier_code")
    elif src == "automotive" or "connected_services_subscriptions" in source_file:
        subscriber_id = _first_non_empty_field(row, "customer_id")
        start_date = _first_non_empty_field(
            row, "start_date", "signup_date", "created_date"
        )
        end_date = _first_non_empty_field(row, "end_date", "resolved_date")
        status = _first_non_empty_field(row, "subscription_status", "status")
        plan = _first_non_empty_field(row, "plan_name")
    elif src == "telecom" or "tel_subscriptions" in source_file:
        subscriber_id = _first_non_empty_field(row, "customer_id", "account_id")
        start_date = _first_non_empty_field(row, "activation_date", "billing_date", "created_date")
        end_date = _first_non_empty_field(row, "contract_end_date")
        status = _first_non_empty_field(row, "line_status", "account_status", "status")
        plan = _first_non_empty_field(row, "plan_name", "product_type")
    else:
        subscriber_id = _first_non_empty_field(
            row, "linked_fan_account_id", "subscriber_id", "customer_id", "email"
        )
        start_date = _first_non_empty_field(row, "enrolled_date", "signup_date", "created_date")
        end_date = _first_non_empty_field(row, "resolved_date", "contract_end_date")
        status = _first_non_empty_field(row, "account_status", "status", "line_status")
        plan = _first_non_empty_field(row, "membership_tier", "subscription_tier_code", "plan_name")

    return {
        "subscription_id": subscription_id,
        "subscriber_id": subscriber_id,
        "status": str(status or "").strip().title(),
        "plan": str(plan or "").strip().title(),
        "start_date": start_date,
        "end_date": end_date,
        "source_file": row.get("source_file", ""),
    }


_CLUSTER_IDENTITY_EMAIL_FIELDS = (
    "email",
    "billing_email",
    "customer_email",
    "app_user_email",
    "user_email",
    "recipient_email",
    "member_email",
)
_CLUSTER_IDENTITY_PHONE_FIELDS = (
    "phone",
    "contact_phone",
    "customer_phone",
    "phone_mobile",
    "member_phone",
)
_CLUSTER_IDENTITY_CUSTOMER_FIELDS = (
    "customer_id",
    "commerce_customer_id",
    "subscriber_id",
    "account_id",
    "streaming_account_id",
)


def _normalize_identity_email(value):
    """Normalize an email address for identity matching.

    :param value: Raw email text.
    :type value: str
    :returns: Uppercase email or an empty string.
    :rtype: str
    """
    email = str(value or "").strip().upper()
    return email if email and "@" in email else ""


def _normalize_identity_phone(value):
    """Normalize a phone number to its last ten digits.

    :param value: Raw phone text.
    :type value: str
    :returns: Digit-only phone suffix suitable for matching.
    :rtype: str
    """
    digits = re.sub(r"\D", "", str(value or ""))
    if len(digits) >= 10:
        return digits[-10:]
    return digits


def _cluster_identity_keys(cluster_rows, golden_row=None):
    """Collect emails, phones, and customer identifiers from cluster members.

    :param cluster_rows: Rows belonging to one cluster.
    :type cluster_rows: list[dict]
    :param golden_row: Optional golden record row for the profile.
    :type golden_row: dict | None
    :returns: Tuple of email, phone, and customer-id sets.
    :rtype: tuple[set[str], set[str], set[str]]
    """
    emails, phones, customer_ids = set(), set(), set()
    candidates = list(cluster_rows or [])
    if golden_row:
        candidates.append(golden_row)

    for row in candidates:
        for field in _CLUSTER_IDENTITY_EMAIL_FIELDS:
            email = _normalize_identity_email(row.get(field))
            if email:
                emails.add(email)
        for field in _CLUSTER_IDENTITY_PHONE_FIELDS:
            phone = _normalize_identity_phone(row.get(field))
            if phone:
                phones.add(phone)
        for field in _CLUSTER_IDENTITY_CUSTOMER_FIELDS:
            customer_id = str(row.get(field, "") or "").strip().upper()
            if customer_id:
                customer_ids.add(customer_id)
    return emails, phones, customer_ids


def _load_standardized_subscription_index(source=None):
    """Build lookup indexes of subscription rows for a source system.

    :param source: Cluster source key.
    :type source: str | None
    :returns: Dict with subscription lookup indexes.
    :rtype: dict
    """
    cache_key = _normalize_cluster_source(source)
    if uc_enabled():
        # Never materialize the full standardized UC table on a profile click.
        # `_build_cluster_subscriptions` uses bounded source-table lookups in UC.
        return {
            "by_id": {},
            "by_subscriber": {},
            "by_email": {},
            "by_phone": {},
            "by_customer": {},
        }
    cached = _STANDARDIZED_SUBSCRIPTIONS_CACHE.get(cache_key)
    if cached is not None:
        return cached

    by_id = {}
    by_subscriber = {}
    by_email = {}
    by_phone = {}
    by_customer = {}
    patterns = _subscription_source_patterns(source)
    paths = [_get_standardized_csv(source)]
    scoped_dir = STD_DIR / cache_key
    if scoped_dir.exists():
        paths.extend(sorted(scoped_dir.glob("standardized_*subscription*.csv")))

    seen_ids = set()
    for path in paths:
        if not path.exists():
            continue
        with open(path, "r", encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                source_file = str(row.get("source_file", "") or "").lower()
                if not any(pattern in source_file for pattern in patterns):
                    continue
                payload = _normalize_subscription_payload(row, source)
                subscription_id = str(payload.get("subscription_id", "") or "").strip()
                if not subscription_id:
                    continue
                key = subscription_id.upper()
                if key in seen_ids:
                    continue
                seen_ids.add(key)
                by_id[key] = payload
                subscriber_id = str(payload.get("subscriber_id", "") or "").strip().upper()
                if subscriber_id:
                    by_subscriber.setdefault(subscriber_id, []).append(payload)
                    by_customer.setdefault(subscriber_id, []).append(payload)
                email = _normalize_identity_email(row.get("email"))
                if email:
                    by_email.setdefault(email, []).append(payload)
                phone = _normalize_identity_phone(row.get("phone") or row.get("contact_phone"))
                if phone:
                    by_phone.setdefault(phone, []).append(payload)

    index = {
        "by_id": by_id,
        "by_subscriber": by_subscriber,
        "by_email": by_email,
        "by_phone": by_phone,
        "by_customer": by_customer,
    }
    _STANDARDIZED_SUBSCRIPTIONS_CACHE[cache_key] = index
    return index


def _subscriptions_in_chronological_order(subscriptions):
    """Return subscriptions sorted oldest-to-newest by start date.

    Chronological order is required for activity-to-subscription window logic.

    :param subscriptions: Normalized subscription dicts.
    :type subscriptions: list[dict]
    :returns: Subscriptions sorted by ``start_date`` ascending.
    :rtype: list[dict]
    """
    return sorted(
        subscriptions,
        key=lambda sub: _parse_flexible_datetime(sub.get("start_date")) or datetime.min,
    )


def _subscription_display_sort_key(subscription):
    """Build a sort key for UI lists (active and newest plans first).

    :param subscription: Normalized subscription dict.
    :type subscription: dict
    :returns: Tuple used for descending display sort.
    :rtype: tuple
    """
    start = _parse_flexible_datetime(subscription.get("start_date"))
    status = str(subscription.get("status", "") or "").strip().lower()
    active_rank = 0 if status == "active" else 1
    if start is None:
        date_rank = (1, 0, 0, 0, 0, 0)
    else:
        date_rank = (
            0,
            -start.toordinal(),
            -start.hour,
            -start.minute,
            -start.second,
            -start.microsecond,
        )
    return (
        active_rank,
        *date_rank,
        str(subscription.get("subscription_id", "") or ""),
    )


def _subscriptions_for_display(subscriptions):
    """Return subscriptions for UI: active first, then newest start date.

    :param subscriptions: Normalized subscription dicts.
    :type subscriptions: list[dict]
    :returns: Display-ordered subscription list.
    :rtype: list[dict]
    """
    return sorted(subscriptions, key=_subscription_display_sort_key)


def _finalize_subscription_windows(subscriptions):
    """Derive activity attribution windows and return display-ordered subscriptions.

    Windows are computed on chronological plan order; the returned list is sorted
    for Customer 360 (active and most recent plans first).

    :param subscriptions: Normalized subscription dicts.
    :type subscriptions: list[dict]
    :returns: Subscriptions with window fields, sorted for UI display.
    :rtype: list[dict]
    """
    cleaned = [sub for sub in subscriptions if sub.get("subscription_id")]
    chronological = _subscriptions_in_chronological_order(cleaned)
    for index, subscription in enumerate(chronological):
        subscription["window_start"] = subscription.get("start_date", "")
        next_start = ""
        if index + 1 < len(chronological):
            next_start = chronological[index + 1].get("start_date", "")
        explicit_end = subscription.get("end_date", "")
        if next_start:
            subscription["window_end"] = next_start
        elif explicit_end:
            subscription["window_end"] = explicit_end
        else:
            subscription["window_end"] = ""
        subscription["event_count"] = 0
    return _subscriptions_for_display(chronological)


def _build_cluster_subscriptions(cluster_rows, source=None, golden_row=None):
    """Collect subscription records linked to a cluster, including sibling plans.

    Sibling subscriptions for the same ``subscriber_id`` are included even when only
    one billing row is present in the cluster (common after identity resolution).
    When billing rows are not clustered with activities, subscriptions are resolved
    via shared email, phone, or customer identifiers.

    :param cluster_rows: Rows belonging to one cluster.
    :type cluster_rows: list[dict]
    :param source: Cluster source key.
    :type source: str | None
    :param golden_row: Golden record row for additional identity keys.
    :type golden_row: dict | None
    :returns: Subscription metadata for timeline filtering.
    :rtype: list[dict]
    """
    if not cluster_rows and not golden_row:
        return []

    source = _normalize_cluster_source(source)
    found = {}

    def _store(payload):
        subscription_id = str(payload.get("subscription_id", "") or "").strip()
        if subscription_id:
            found[subscription_id.upper()] = payload

    def _expand_subscriber_siblings(index):
        subscriber_ids = {
            str(payload.get("subscriber_id", "") or "").strip().upper()
            for payload in found.values()
            if payload.get("subscriber_id")
        }
        for subscriber_id in subscriber_ids:
            for payload in index["by_subscriber"].get(subscriber_id, []):
                _store(payload)

    for row in cluster_rows:
        record_id = str(row.get("record_id", "") or "").strip()
        if _is_subscription_cluster_row(row, source):
            payload = _normalize_subscription_payload(row, source)
            _store(payload)

    emails, phones, customer_ids = _cluster_identity_keys(cluster_rows, golden_row)

    if uc_enabled():
        # Query only source tables that can contain a subscription for the
        # selected profile. This replaces the former full all_standardized read.
        tables = {
            "media": ("med_subscription_billing",),
            "sports": ("spt_fan_accounts", "spt_loyalty_members"),
            "automotive": ("aut_connected_services_subscriptions",),
            "telecom": ("tel_subscriptions",),
        }.get(source, ())

        record_ids = {
            str(row.get(field, "") or "").strip()
            for row in cluster_rows
            if _is_subscription_cluster_row(row, source)
            for field in (
                "record_id",
                "source_record_id",
                "subscription_id",
                "fan_account_id",
                "loyalty_member_id",
            )
            if str(row.get(field, "") or "").strip()
        }

        def _lookup_values(extra_customer_ids=()):
            linked_customers = sorted(
                customer_ids
                | {
                    str(value or "").strip().upper()
                    for value in extra_customer_ids
                    if str(value or "").strip()
                }
            )
            return {
                "record_id": sorted(record_ids),
                "source_record_id": sorted(record_ids),
                "subscription_id": sorted(record_ids),
                "fan_account_id": sorted(record_ids),
                "loyalty_member_id": sorted(record_ids),
                "customer_id": linked_customers,
                "subscriber_id": linked_customers,
                "linked_fan_account_id": linked_customers,
                "account_id": linked_customers,
                "push_token": linked_customers,
                "email": sorted(emails),
                "account_email": sorted(emails),
                "member_email": sorted(emails),
                "billing_email": sorted(emails),
                "phone": sorted(phones),
                "phone_mobile": sorted(phones),
                "member_phone": sorted(phones),
                "contact_phone": sorted(phones),
            }

        def _query_tables(column_values):
            for table in tables:
                rows = _uc_lookup_rows(
                    table,
                    source,
                    column_values,
                    limit=500,
                )
                for row in rows:
                    normalized = dict(row)
                    normalized.setdefault("source_file", f"{table}.csv")
                    _store(_normalize_subscription_payload(normalized, source))

        _query_tables(_lookup_values())
        subscriber_ids = {
            str(payload.get("subscriber_id", "") or "").strip().upper()
            for payload in found.values()
            if str(payload.get("subscriber_id", "") or "").strip()
        }
        if subscriber_ids - customer_ids:
            _query_tables(_lookup_values(subscriber_ids))
        return _finalize_subscription_windows(list(found.values()))

    index = _load_standardized_subscription_index(source)
    for row in cluster_rows:
        record_id = str(row.get("record_id", "") or "").strip()
        if _is_subscription_cluster_row(row, source):
            payload = index["by_id"].get(record_id.upper())
            if payload:
                _store(payload)
        elif record_id.upper().startswith(("SB-", "TEL-SUB-")) or record_id.upper().startswith("SUB"):
            payload = index["by_id"].get(record_id.upper())
            if payload:
                _store(payload)

    _expand_subscriber_siblings(index)

    for email in emails:
        for payload in index.get("by_email", {}).get(email, []):
            _store(payload)
    for phone in phones:
        for payload in index.get("by_phone", {}).get(phone, []):
            _store(payload)
    for customer_id in customer_ids:
        for payload in index.get("by_customer", {}).get(customer_id, []):
            _store(payload)

    _expand_subscriber_siblings(index)

    return _finalize_subscription_windows(list(found.values()))


def _resolve_subscription_for_timestamp(timestamp, subscriptions):
    """Pick the subscription whose window contains an activity timestamp.

    :param timestamp: Activity timestamp string.
    :type timestamp: str
    :param subscriptions: Subscription dicts with ``start_date`` values.
    :type subscriptions: list[dict]
    :returns: Matching ``subscription_id`` or an empty string.
    :rtype: str
    """
    event_dt = _parse_flexible_datetime(timestamp)
    if not event_dt or not subscriptions:
        return ""

    chronological = _subscriptions_in_chronological_order(subscriptions)
    for index, subscription in enumerate(chronological):
        start_dt = _parse_flexible_datetime(subscription.get("start_date"))
        if not start_dt or event_dt < start_dt:
            continue
        if index + 1 < len(chronological):
            next_start = _parse_flexible_datetime(chronological[index + 1].get("start_date"))
            if next_start and event_dt >= next_start:
                continue
        return str(subscription.get("subscription_id", "") or "")
    return ""


def _attach_subscription_context(events, subscriptions):
    """Add ``subscription_id`` and per-subscription event counts to timeline events.

    :param events: Timeline event dicts.
    :type events: list[dict]
    :param subscriptions: Subscription metadata list.
    :type subscriptions: list[dict]
    :returns: Timeline events annotated with subscription context.
    :rtype: list[dict]
    """
    if not subscriptions:
        for event in events:
            event["subscription_id"] = ""
        return events

    counts = {str(sub["subscription_id"]).upper(): 0 for sub in subscriptions}
    for event in events:
        subscription_id = _resolve_subscription_for_timestamp(
            event.get("event_timestamp", ""), subscriptions
        )
        event["subscription_id"] = subscription_id
        key = str(subscription_id or "").upper()
        if key in counts:
            counts[key] += 1

    for subscription in subscriptions:
        key = str(subscription.get("subscription_id", "") or "").upper()
        subscription["event_count"] = counts.get(key, 0)
    return events


_AUTOMOTIVE_ACTIVITY_SOURCE_PATTERNS = (
    "aut_campaign_interactions",
    "aut_dtc_events",
    "aut_loyalty_transactions",
    "aut_mobile_app_sessions",
    "aut_nps_surveys",
    "aut_sales_transactions",
    "aut_service_appointments",
    "aut_service_line_items",
    "aut_service_orders",
    "aut_support_cases",
    "aut_telematics_monthly_summary",
    "aut_vehicle_health_reports",
    "aut_warranty_claims",
    "aut_website_sessions",
)


def _is_governed_activity_cluster_row(row, source=None):
    """Return whether a clustered row belongs on the activity timeline.

    Media and Sports retain their established non-subscription behavior. The
    Automotive identity graph contains profile/master records alongside true
    interactions, so it uses an explicit source contract instead of treating
    every linked record as a customer event.
    """
    if _is_subscription_cluster_row(row, source):
        return False
    if _normalize_cluster_source(source) != "automotive":
        return True
    source_file = str(row.get("source_file", "") or "").strip().lower()
    if not source_file:
        source_file = _composite_source_name(row.get("record_id", ""))
    source_name = Path(source_file.replace("\\", "/")).stem.lower()
    return any(
        pattern == source_name or pattern in source_name
        for pattern in _AUTOMOTIVE_ACTIVITY_SOURCE_PATTERNS
    )


def _build_activity_timeline(
    cluster_rows,
    limit=12,
    enrich_timestamps=True,
    source=None,
    subscriptions=None,
    exclude_subscription_sources=True,
):
    """Build a deduplicated activity timeline for a cluster.

    :param cluster_rows: Rows belonging to one cluster.
    :type cluster_rows: list[dict]
    :param limit: Maximum number of timeline events to return.
    :type limit: int | None
    :param enrich_timestamps: When ``True``, batch-load raw clock times for displayed events.
    :type enrich_timestamps: bool
    :param source: Cluster source key used for subscription source detection.
    :type source: str | None
    :param subscriptions: Optional subscription list for ``subscription_id`` attribution.
    :type subscriptions: list[dict] | None
    :param exclude_subscription_sources: When ``True``, omit billing/subscription rows.
    :type exclude_subscription_sources: bool
    :returns: Timeline event dicts for the UI.
    :rtype: list[dict]
    """
    if not cluster_rows:
        return []

    event_limit = max(int(limit or 12), 1)
    scan_limit = min(len(cluster_rows), max(event_limit * 4, event_limit))
    if len(cluster_rows) <= scan_limit:
        candidate_rows = sorted(cluster_rows, key=_activity_sort_value, reverse=True)
    else:
        candidate_rows = heapq.nlargest(scan_limit, cluster_rows, key=_activity_sort_value)

    seen_keys, events = set(), []
    for row in candidate_rows:
        if exclude_subscription_sources and not _is_governed_activity_cluster_row(
            row,
            source,
        ):
            continue
        timestamp = _get_activity_timestamp(row)
        key = _activity_record_key(row, timestamp)
        if key in seen_keys:
            continue
        seen_keys.add(key)
        event_type = _first_non_empty_field(
            row,
            "event_type",
            "interaction_type",
            "transaction_type",
            "campaign_type",
            "service_category",
            "contact_type",
        )
        events.append(
            {
                "record_id": row.get("record_id", ""),
                "event_type": event_type,
                "event_timestamp": timestamp,
                "source_file": row.get("source_file", ""),
                "campaign_name": row.get("campaign_name", ""),
                "content_type": row.get("content_type", ""),
                "summary": _build_event_summary(row),
                "subscription_id": "",
            }
        )
        if len(events) >= event_limit:
            break

    if enrich_timestamps:
        _enrich_activity_event_timestamps(events)
    if subscriptions is not None:
        _attach_subscription_context(events, subscriptions)
    return events


def _dedupe_household_members(members, selected_golden_id=""):
    seen_ids, seen_people, deduped = set(), set(), []
    selected = str(selected_golden_id or "").strip().upper()
    for member in members or []:
        golden_id = str(member.get("golden_id", "") or "").strip()
        if selected and golden_id.upper() == selected:
            continue
        id_key = golden_id.upper()
        name_key = str(member.get("full_name", "") or "").strip().upper()
        person_key = name_key or "|".join(
            value
            for value in [
                str(member.get("email", "") or "").strip().lower(),
                str(member.get("address", "") or "").strip().upper(),
                str(member.get("zip", "") or "").strip(),
            ]
            if value
        )
        if id_key and id_key in seen_ids:
            continue
        if person_key and person_key in seen_people:
            continue
        if id_key:
            seen_ids.add(id_key)
        if person_key:
            seen_people.add(person_key)
        deduped.append(member)
    return deduped


def _profile_linkage_summary(cluster_rows, source):
    """Return source-backed linkage metrics for a single customer profile.

    ``Identities`` counts distinct identifier values, not merely the number of
    identifier categories present. ``total_records`` retains the physical
    source-row grain used by the profile list and golden-record evidence;
    ``unique_linked_records`` separately reports the source-record key grain.
    This prevents exact duplicate facts from silently changing KPI semantics.
    """
    normalized_source = _normalize_cluster_source(source)
    record_keys = set()
    contributing_sources = set()
    identity_values = set()
    identity_types = set()
    linked_identity_keys = set()
    linked_identities = []

    def add_identity(identity_type, value, normalize=lambda item: str(item or "").strip().upper()):
        normalized_value = normalize(value)
        if not normalized_value:
            return
        identity_types.add(identity_type)
        identity_values.add((identity_type, normalized_value))

    for index, row in enumerate(cluster_rows or []):
        identity = _identity_node(row)
        source_file = str(identity.get("source_file") or row.get("source_file") or "").strip()
        record_id = str(
            identity.get("source_record_id")
            or row.get("record_id")
            or row.get("event_id")
            or row.get("session_id")
            or ""
        ).strip()
        if source_file:
            contributing_sources.add(source_file)
        record_keys.add(
            f"{source_file.upper()}|{record_id.upper()}"
            if record_id
            else f"{source_file.upper()}|ROW-{index}"
        )

        add_identity("Email", identity.get("email"), _normalize_identity_email)
        add_identity("Phone", identity.get("phone"), _normalize_identity_phone)
        add_identity("Customer ID", identity.get("customer_id"))
        add_identity("Fan ID", identity.get("fan_id"))
        add_identity("Account ID", identity.get("account_id"))
        add_identity("Loyalty ID", identity.get("loyalty_id"))
        if normalized_source == "automotive":
            add_identity(
                "Vehicle ID",
                identity.get("vehicle_id") or identity.get("device_id"),
            )
        else:
            add_identity("Device ID", identity.get("device_id"))

        name = str(identity.get("full_name") or "").strip()
        email = str(identity.get("email") or "").strip()
        phone = str(identity.get("phone") or "").strip()
        linked_key = f"{source_file.upper()}|{record_id.upper()}|{name.upper()}|{email.upper()}|{phone.upper()}"
        if (not name and not email and not phone) or linked_key in linked_identity_keys:
            continue
        linked_identity_keys.add(linked_key)
        if len(linked_identities) < 24:
            linked_identities.append(
                {
                    "full_name": name,
                    "email": email,
                    "phone": phone,
                    "source_file": source_file,
                    "device_platform": row.get("device_platform", "")
                    or row.get("platform_name", ""),
                }
            )

    return {
        "total_records": len(cluster_rows or []),
        "unique_linked_records": len(record_keys),
        "duplicate_record_rows": max(0, len(cluster_rows or []) - len(record_keys)),
        "contributing_source_count": len(contributing_sources),
        "contributing_sources": sorted(contributing_sources),
        "total_identity_count": len(identity_values),
        "identity_types": sorted(identity_types),
        "total_linked_identity_records": len(linked_identity_keys),
        "linked_identities": linked_identities,
    }


def _load_cluster_rows_by_cluster_id(source=None):
    clustered_csv = _get_clustered_csv(source)
    clusters = {}
    if not clustered_csv.exists():
        return clusters
    with open(clustered_csv, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            cluster_id = row.get("cluster_id", "")
            if cluster_id:
                clusters.setdefault(cluster_id, []).append(row)
    return clusters


def _safe_float(value):
    try:
        return float(str(value or "").replace("%", "").strip())
    except ValueError:
        return 0.0


def _safe_int(value):
    try:
        return int(float(str(value or "").strip()))
    except ValueError:
        return 0


def _most_common_text(values):
    cleaned = [str(v or "").strip() for v in values if str(v or "").strip()]
    if not cleaned:
        return ""
    return max(set(cleaned), key=cleaned.count)


def _media_primary_affinity(rng, cluster_rows):
    content = _most_common_text(
        row.get("content_type") or row.get("content_type_code") or row.get("team")
        for row in cluster_rows
    )
    if content:
        return content.title() if content.islower() or content.isupper() else content

    source_files = " ".join(str(row.get("source_file", "") or "").lower() for row in cluster_rows)
    events = " ".join(str(row.get("event_type", "") or "").lower() for row in cluster_rows)
    if "stream" in source_files or "watch" in events:
        return "Streaming"
    if "email" in source_files or "open" in events or "click" in events:
        return "Email Engagement"
    if "app" in source_files or "login" in events:
        return "App Engagement"
    if "support" in source_files:
        return "Support Sensitive"
    return rng.choice(["Sports", "Movies", "Music", "News", "Kids", "Documentary"])


def _sports_primary_affinity(rng, cluster_rows):
    team = _most_common_text(
        row.get("favorite_team_code") or row.get("primary_team_code") or row.get("primary_team_id") or row.get("team_id")
        for row in cluster_rows
    )
    source_files = " ".join(str(row.get("source_file", "") or "").lower() for row in cluster_rows)
    product_categories = " ".join(str(row.get("product_category_list", "") or "").lower() for row in cluster_rows)
    sport_list = _most_common_text(row.get("sport_list") for row in cluster_rows)
    tier = _most_common_text(row.get("membership_tier") or row.get("subscription_tier_code") for row in cluster_rows)

    if "fantasy" in source_files:
        return "Fantasy / Gaming Fan"
    if "ticket" in source_files:
        return f"{team} Ticket Buyer" if team else "Ticket Buyer"
    if "commerce" in source_files or product_categories:
        return f"{team} Merchandise Buyer" if team else "Merchandise Buyer"
    if "streaming" in source_files or "ott" in source_files:
        return f"{team} Streaming Fan" if team else "Streaming Fan"
    if "loyalty" in source_files or tier:
        return f"{tier.title()} Loyalty Fan" if tier else "Loyalty Fan"
    if team:
        return f"{team} Fan"
    if sport_list:
        return f"{sport_list.title()} Fan"
    return rng.choice(["Game-Day Fan", "Merchandise Buyer", "Streaming Fan", "Fantasy / Gaming Fan", "Loyalty Fan"])


def _automotive_primary_affinity(rng, cluster_rows):
    source_files = " ".join(str(row.get("source_file", "") or "").lower() for row in cluster_rows)
    campaign = " ".join(str(row.get("campaign_type", "") or row.get("campaign_name", "") or "").lower() for row in cluster_rows)
    service_category = " ".join(str(row.get("service_category", "") or row.get("category", "") or "").lower() for row in cluster_rows)
    powertrain = _most_common_text(row.get("powertrain_type") or row.get("powertrain") for row in cluster_rows)
    vehicle_status = _most_common_text(row.get("vehicle_status") for row in cluster_rows)

    if "recall" in source_files or "recall" in campaign:
        return "Recall / Safety"
    if "service" in source_files or service_category:
        return "Service & Maintenance"
    if "telematics" in source_files or "connected" in source_files:
        return "Connected Vehicle"
    if "warranty" in source_files:
        return "Warranty"
    if "insurance" in source_files:
        return "Insurance"
    if "loyalty" in source_files:
        return "Loyalty / Rewards"
    if "campaign" in source_files or "replacement" in campaign:
        return "Replacement / Trade-Up"
    if powertrain:
        return f"{powertrain.title()} Vehicle Owner"
    if vehicle_status:
        return f"{vehicle_status.title()} Vehicle Owner"
    return rng.choice(["Vehicle Owner", "Service & Maintenance", "Connected Vehicle", "Replacement / Trade-Up", "Loyalty / Rewards"])


def _telecom_primary_affinity(golden_row, cluster_rows):
    plan = str(golden_row.get("subscription_tier", "") or "").strip().lower()
    lifecycle = str(golden_row.get("membership_tier", "") or "").strip().lower()
    products = {
        str(row.get("content_type", "") or "").strip().lower()
        for row in cluster_rows
        if row.get("content_type", "")
    }
    categories = " ".join(str(row.get("category", "") or "").lower() for row in cluster_rows)
    campaigns = " ".join(str(row.get("campaign_objective", "") or "").lower() for row in cluster_rows)
    events = " ".join(str(row.get("event_type", "") or "").lower() for row in cluster_rows)
    statuses = " ".join(str(row.get("status", "") or "").lower() for row in cluster_rows)

    data_utilization = max([_safe_float(row.get("data_utilization_pct")) for row in cluster_rows] or [0.0])
    overage_gb = max([_safe_float(row.get("overage_gb")) for row in cluster_rows] or [0.0])
    overage_count = max([_safe_int(row.get("overage_count_3m")) for row in cluster_rows] or [0])
    churn_risk = max([_safe_float(row.get("churn_risk_score")) for row in cluster_rows] or [0.0])
    roaming_gb = max([_safe_float(row.get("roaming_gb")) for row in cluster_rows] or [0.0])
    service_quality = [_safe_float(row.get("service_quality_score")) for row in cluster_rows if row.get("service_quality_score")]
    contract_days = [
        _safe_int(row.get("contract_days_to_expiry"))
        for row in cluster_rows
        if str(row.get("contract_days_to_expiry", "")).strip()
    ]
    product_count = max([_safe_int(row.get("product_count")) for row in cluster_rows] or [0])
    tenure_months = max([_safe_int(row.get("tenure_months")) for row in cluster_rows] or [0])

    if "cancellation" in categories or churn_risk >= 0.68 or "churn_risk_tel" in campaigns:
        return "Churn Save Offer"
    if contract_days and 0 <= min(contract_days) <= 90:
        return "Contract Renewal"
    if data_utilization >= 90 or overage_gb > 0 or overage_count > 0 or "high_data" in campaigns:
        return "High Data / Unlimited Plan"
    if "network" in categories or "coverage" in categories or any(score and score < 60 for score in service_quality):
        return "Network Quality Risk"
    if "fiber" in plan or "broadband" in products or "home internet" in plan:
        return "Fiber Broadband"
    if "family bundle" in plan or product_count >= 3 or len(products) >= 3 or "multi_product" in campaigns:
        return "Family Bundle"
    if roaming_gb >= 3 or "roaming" in categories:
        return "Roaming / International"
    if "upgrade" in events or "plan_compare" in events:
        return "Device Upgrade"
    if lifecycle == "new" or tenure_months <= 3 or "new_joiners" in campaigns:
        return "New Customer Onboarding"
    return "Mobile Plan Optimization"


def _source_primary_affinity(source, rng, golden_row, cluster_rows):
    if source == "telecom":
        return _telecom_primary_affinity(golden_row, cluster_rows)
    if source == "sports":
        return _sports_primary_affinity(rng, cluster_rows)
    if source == "automotive":
        return _automotive_primary_affinity(rng, cluster_rows)
    return _media_primary_affinity(rng, cluster_rows)


def _customer_profile_row(golden_row, source, cluster_rows=None, include_timeline=False):
    """Create the API enrichment shape for one golden record."""
    import random

    normalized_source = _normalize_cluster_source(source)
    row = _normalize_golden_row(dict(golden_row or {}), normalized_source)
    cluster_rows = cluster_rows or []
    rid = row.get("golden_id", row.get("record_id", ""))
    if include_timeline:
        activity_timeline = _build_activity_timeline(
            cluster_rows,
            limit=5,
            enrich_timestamps=False,
        )
        timeline_json = json.dumps(activity_timeline, ensure_ascii=True)
    else:
        timeline_json = "[]"

    rng = random.Random(rid)
    ltv = round(rng.uniform(50, 2000), 2)
    ltv_tier = "High" if ltv >= 1000 else "Medium" if ltv >= 400 else "Low"
    recency = rng.randint(1, 365)
    recency_tier = "Active" if recency <= 30 else "Lapsing" if recency <= 90 else "Inactive"
    engagement = round(rng.uniform(0, 100), 1)
    eng_tier = "High" if engagement >= 70 else "Medium" if engagement >= 35 else "Low"

    return {
        "golden_id": rid,
        "cluster_id": row.get("cluster_id", ""),
        "email": row.get("email", ""),
        "full_name": row.get("full_name", ""),
        "first_name": row.get("first_name", ""),
        "last_name": row.get("last_name", ""),
        "phone": row.get("phone", ""),
        "address": row.get("address", ""),
        "city": row.get("city", ""),
        "state": row.get("state", ""),
        "zip": row.get("zip", ""),
        "household_id": row.get("household_id", ""),
        "customer_id": row.get("customer_id", ""),
        "account_id": row.get("account_id", ""),
        "loyalty_id": row.get("loyalty_id", ""),
        "date_of_birth": row.get("date_of_birth") or row.get("dob", ""),
        "subscription_tier": row.get("subscription_tier", ""),
        "membership_tier": row.get("membership_tier", ""),
        "source_files": row.get("source_files", ""),
        "record_count": _safe_int(row.get("record_count")),
        "source_count": len(
            {
                value.strip()
                for value in str(row.get("source_files") or "").split("|")
                if value.strip()
            }
        ),
        "profile_scope": row.get("profile_scope", "golden_artifact"),
        "limited_attributes": bool(row.get("limited_attributes")),
        "ltv_score": ltv,
        "ltv_tier": ltv_tier,
        "recency_days": recency,
        "recency_tier": recency_tier,
        "engagement_rate": engagement,
        "engagement_tier": eng_tier,
        "primary_affinity": _source_primary_affinity(normalized_source, rng, row, cluster_rows),
        "identity_strength": min(100, rng.randint(40, 100)),
        "activity_timeline": timeline_json,
    }


def _build_customer_profile_rows(search="", source=None, include_timeline=False):
    """Build customer profile list rows for the enrichment API and exports.

    :param search: Optional upper-cased search filter.
    :type search: str
    :param source: Optional cluster source system scope.
    :type source: str | None
    :param include_timeline: When ``True``, build per-row activity timelines (slow).
    :type include_timeline: bool
    :returns: Customer profile row dicts.
    :rtype: list[dict]
    """
    normalized_source = _normalize_cluster_source(source)
    search = (search or "").upper()
    rows = []
    golden_csv = _get_golden_csv(normalized_source)
    if not golden_csv.exists():
        return rows
    cluster_rows_by_id = _load_cluster_rows_by_cluster_id(normalized_source)
    for row in _complete_golden_profile_rows(
        normalized_source,
        cluster_rows_by_id=cluster_rows_by_id,
    ):
        if search and not any(search in str(v).upper() for v in row.values()):
            continue
        rid = row.get("golden_id", row.get("record_id", ""))
        cluster_id = row.get("cluster_id", "")
        cluster_rows = cluster_rows_by_id.get(cluster_id, [])
        if include_timeline:
            activity_timeline = _build_activity_timeline(
                cluster_rows,
                limit=5,
                enrich_timestamps=False,
            )
            timeline_json = json.dumps(activity_timeline, ensure_ascii=True)
        else:
            timeline_json = "[]"
        try:
            record_count = max(0, int(float(row.get("record_count") or 0)))
        except (TypeError, ValueError):
            record_count = 0
        source_count = len(
            {
                value.strip()
                for value in str(row.get("source_files") or "").split("|")
                if value.strip()
            }
        )
        rows.append(
            {
                "golden_id": rid,
                "cluster_id": cluster_id,
                "email": row.get("email", ""),
                "full_name": row.get("full_name", ""),
                "first_name": row.get("first_name", ""),
                "last_name": row.get("last_name", ""),
                "phone": row.get("phone", ""),
                "address": row.get("address", ""),
                "city": row.get("city", ""),
                "state": row.get("state", ""),
                "zip": row.get("zip", ""),
                "household_id": row.get("household_id", ""),
                "customer_id": row.get("customer_id", ""),
                "account_id": row.get("account_id", ""),
                "loyalty_id": row.get("loyalty_id", ""),
                "date_of_birth": row.get("date_of_birth") or row.get("dob", ""),
                "subscription_tier": row.get("subscription_tier", ""),
                "membership_tier": row.get("membership_tier", ""),
                "source_files": row.get("source_files", ""),
                "record_count": record_count,
                "source_count": source_count,
                "profile_scope": row.get("profile_scope", "golden_artifact"),
                "limited_attributes": bool(row.get("limited_attributes")),
                "activity_timeline": timeline_json,
            }
        )
    return rows


def _write_customer_profile_export(rows, source=None):
    export_path = _get_customer_profile_export_csv(source)
    export_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(export_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=CUSTOMER_PROFILE_EXPORT_FIELDS,
                extrasaction="ignore",
            )
            writer.writeheader()
            writer.writerows(rows)
    except PermissionError as exc:
        print(f"[WARN] Could not refresh customer profile export: {exc}")
    return export_path


_ENRICHMENT_ROWS_CACHE = {}


def _enrichment_rows_cache_key(source, search):
    """Build a cache key for scoped customer profile list rows.

    :param source: Cluster source system.
    :type source: str
    :param search: Upper-cased search filter.
    :type search: str
    :returns: Cache key tuple.
    :rtype: tuple
    """
    golden_csv = _get_golden_csv(source)
    clustered_csv = _get_clustered_csv(source)
    return (
        _normalize_cluster_source(source),
        search or "",
        _file_signature(golden_csv, clustered_csv),
    )


def _customer_profile_list_sort_key(row):
    """Mirror the governed golden-table ordering for complete profile rows."""
    return (
        -_safe_int(row.get("record_count")),
        -int(bool(str(row.get("full_name") or "").strip())),
        -int(bool(str(row.get("email") or "").strip())),
        -int(bool(str(row.get("phone") or "").strip())),
        str(row.get("golden_id") or ""),
    )


def _complete_customer_profile_page(source, page, limit, search):
    """Page the truthful cluster-complete profile universe with stable caching."""
    cache_key = _enrichment_rows_cache_key(source, search)
    rows = _ENRICHMENT_ROWS_CACHE.get(cache_key)
    if rows is None:
        rows = _build_customer_profile_rows(search, source)
        rows.sort(key=_customer_profile_list_sort_key)
        _ENRICHMENT_ROWS_CACHE.clear()
        _ENRICHMENT_ROWS_CACHE[cache_key] = rows
    total = len(rows)
    start = (page - 1) * limit
    return rows[start:start + limit], total


def _uc_customer_profile_page(source, page, limit, search):
    """Read one profile-list page in the warehouse instead of materializing all profiles."""
    golden_csv = _get_golden_csv(source)
    offset = (page - 1) * limit
    golden_page = (
        pd.DataFrame()
        if source == "automotive"
        else read_table_page_df(
            str(golden_csv),
            source=source,
            limit=limit,
            offset=offset,
            search=search,
            search_columns=(
                "golden_id",
                "cluster_id",
                "full_name",
                "first_name",
                "last_name",
                "email",
                "phone",
                "customer_id",
                "account_id",
                "loyalty_id",
            ),
            order_by=(
                ("record_count", "NUMERIC_DESC"),
                ("full_name", "NONEMPTY_DESC"),
                ("email", "NONEMPTY_DESC"),
                ("phone", "NONEMPTY_DESC"),
                ("golden_id", "ASC"),
            ),
            required=False,
        )
    )
    if not golden_page.empty:
        filtered_golden_total = (
            _safe_int(golden_page["__codex_total_rows"].iloc[0])
            if "__codex_total_rows" in golden_page.columns
            else 0
        )
        # A response must never claim fewer filtered profiles than the page
        # visibly contains. The UC helper normally supplies the exact count;
        # this lower bound is a final API-contract safeguard.
        filtered_golden_total = max(
            filtered_golden_total,
            offset + len(golden_page),
        )
    else:
        filtered_golden_total = _safe_int(
            golden_page.attrs.get("total_rows")
        )

    cluster_summary = (
        {}
        if source == "automotive"
        else (_read_json(_get_cluster_summary(source)) or {})
    )
    cluster_total = max(0, _safe_int(cluster_summary.get("total_clusters")))
    golden_coverage_total = filtered_golden_total
    if source != "automotive" and cluster_total and (search or golden_page.empty):
        # A filtered page cannot establish whether the underlying golden table
        # covers the complete identity universe.  Use the bounded table count
        # for coverage only; the filtered total still comes from the paged SQL.
        try:
            golden_coverage_total = (
                table_row_count(str(golden_csv), source=source)
                if table_row_count is not None
                else None
            )
        except Exception:
            golden_coverage_total = None

    golden_coverage_incomplete = bool(
        cluster_total
        and (
            golden_coverage_total is None
            or cluster_total > golden_coverage_total
        )
    )
    # Automotive currently publishes a governed golden sample plus the full
    # clustered universe. Always page it from the cluster-authoritative SQL
    # helper so a missing/stale Volume summary cannot silently collapse the
    # Customer Profile list back to the 5,000-row golden sample.
    if source == "automotive" or golden_coverage_incomplete:
        if read_cluster_complete_customer_profile_page_df is None:
            raise DatabricksDataAccessError(
                "The cluster-complete customer profile paging helper is unavailable."
            )
        complete_page = read_cluster_complete_customer_profile_page_df(
            str(_get_clustered_csv(source)),
            str(golden_csv),
            source=source,
            limit=limit,
            offset=offset,
            search=search,
        )
        total = (
            _safe_int(complete_page["__codex_total_rows"].iloc[0])
            if not complete_page.empty
            and "__codex_total_rows" in complete_page.columns
            else _safe_int(complete_page.attrs.get("total_rows"))
        )
        if not complete_page.empty:
            total = max(total, offset + len(complete_page))
        complete_page = complete_page.drop(
            columns=["__codex_total_rows"],
            errors="ignore",
        ).fillna("")
        rows = []
        for raw_row in complete_page.to_dict(orient="records"):
            raw_row = _sanitize_profile_identity(raw_row, source)
            limited_value = raw_row.get("limited_attributes")
            limited_attributes = limited_value is True or str(
                limited_value or ""
            ).strip().lower() in {"1", "true", "yes", "y"}
            limited_attributes = (
                limited_attributes
                or _profile_identity_is_limited(raw_row)
            )
            rows.append(
                {
                    **raw_row,
                    "record_count": _safe_int(raw_row.get("record_count")),
                    "source_count": _safe_int(raw_row.get("source_count")),
                    "limited_attributes": limited_attributes,
                    "activity_timeline": "[]",
                }
            )
        return rows, total

    if golden_page.empty:
        return [], 0

    total = filtered_golden_total
    golden_page = golden_page.drop(
        columns=["__codex_total_rows"],
        errors="ignore",
    ).fillna("")
    golden_rows = golden_page.to_dict(orient="records")
    cluster_ids = [
        str(row.get("cluster_id") or "").strip()
        for row in golden_rows
        if str(row.get("cluster_id") or "").strip()
    ]

    cluster_rows_by_id = {}
    if cluster_ids and read_table_where_in_df is not None:
        clustered_page = read_table_where_in_df(
            str(_get_clustered_csv(source)),
            ("cluster_id",),
            cluster_ids,
            source=source,
            limit=min(max(5000, limit * 100), 50000),
            required=False,
        )
        if not clustered_page.empty:
            for cluster_row in clustered_page.fillna("").to_dict(orient="records"):
                cluster_id = str(cluster_row.get("cluster_id") or "").strip()
                if cluster_id:
                    cluster_rows_by_id.setdefault(cluster_id, []).append(cluster_row)

    rows = []
    for raw_row in golden_rows:
        row = _normalize_golden_row(raw_row, source)
        cluster_id = str(row.get("cluster_id") or "").strip()
        cluster_rows = cluster_rows_by_id.get(cluster_id, [])
        if cluster_rows:
            cluster_profile = _synthesize_cluster_profile_row(
                cluster_id,
                cluster_rows,
                source,
            )
            for key, value in cluster_profile.items():
                if not str(row.get(key) or "").strip() and str(value or "").strip():
                    row[key] = value
            source_files = sorted(
                {
                    str(item.get("source_file") or "").strip()
                    for item in cluster_rows
                    if str(item.get("source_file") or "").strip()
                }
            )
            row["record_count"] = len(cluster_rows)
            row["source_files"] = "|".join(source_files)

        # Every row on this page originated in the governed golden-record
        # table.  Keep that scope, but flag rows whose invalid placeholder
        # identity fields were removed and left no readable name or contact.
        row["profile_scope"] = "golden_artifact"
        row["limited_attributes"] = _profile_identity_is_limited(row)

        rows.append(
            {
                "golden_id": row.get("golden_id", row.get("record_id", "")),
                "cluster_id": cluster_id,
                "email": row.get("email", ""),
                "full_name": row.get("full_name", ""),
                "first_name": row.get("first_name", ""),
                "last_name": row.get("last_name", ""),
                "phone": row.get("phone", ""),
                "address": row.get("address", ""),
                "city": row.get("city", ""),
                "state": row.get("state", ""),
                "zip": row.get("zip", ""),
                "household_id": row.get("household_id", ""),
                "customer_id": row.get("customer_id", ""),
                "account_id": row.get("account_id", ""),
                "loyalty_id": row.get("loyalty_id", ""),
                "date_of_birth": row.get("date_of_birth") or row.get("dob", ""),
                "subscription_tier": row.get("subscription_tier", ""),
                "membership_tier": row.get("membership_tier", ""),
                "source_files": row.get("source_files", ""),
                "record_count": _safe_int(row.get("record_count")),
                "source_count": len(
                    {
                        value.strip()
                        for value in str(row.get("source_files") or "").split("|")
                        if value.strip()
                    }
                ),
                "profile_scope": row.get("profile_scope", "golden_artifact"),
                "limited_attributes": bool(row.get("limited_attributes")),
                "activity_timeline": "[]",
            }
        )
    return rows, total


@app.route("/api/enrichment", methods=["GET"])
def get_enrichment():
    page = max(request.args.get("page", 1, type=int) or 1, 1)
    limit = min(max(request.args.get("limit", 50, type=int) or 50, 1), 5000)
    source = _request_source()
    search = request.args.get("search", "").upper()
    export_path = _get_customer_profile_export_csv(source)

    if uc_enabled() and read_table_page_df is not None:
        rows, total = _uc_customer_profile_page(
            source,
            page,
            limit,
            search,
        )
        return jsonify(
            {
                "rows": rows,
                "total": total,
                "page": page,
                "pages": (total + limit - 1) // limit,
                "export_path": str(export_path.relative_to(ROOT)),
            }
        )

    cache_key = _enrichment_rows_cache_key(source, search)
    rows = _ENRICHMENT_ROWS_CACHE.get(cache_key)
    if rows is None:
        rows = _build_customer_profile_rows(search, source)
        _ENRICHMENT_ROWS_CACHE.clear()
        _ENRICHMENT_ROWS_CACHE[cache_key] = rows
    total = len(rows)
    start = (page - 1) * limit
    return jsonify(
        {
            "rows": rows[start:start + limit],
            "total": total,
            "page": page,
            "pages": (total + limit - 1) // limit,
            "export_path": str(export_path.relative_to(ROOT)),
        }
    )


@app.route("/api/enrichment/export", methods=["POST"])
def export_enrichment():
    source = _request_source()
    rows = _build_customer_profile_rows(source=source, include_timeline=True)
    export_path = _write_customer_profile_export(rows, source=source)
    return jsonify(
        {
            "saved": True,
            "rows": len(rows),
            "path": str(export_path.relative_to(ROOT)),
        }
    )


@app.route("/api/enrichment/upload", methods=["POST"])
def upload_enrichment_source():
    if "file" not in request.files:
        return jsonify({"error": "No file in request"}), 400
    f = request.files["file"]
    if not f.filename or not f.filename.endswith(".csv"):
        return jsonify({"error": "Only .csv files are supported"}), 400
    party = request.form.get("party", "3P")
    owner = request.form.get("owner", "External")
    match_key = request.form.get("match_key", "")
    description = request.form.get("description", "")
    enrich_dir = ROOT / "generated_data" / "enrichment"
    enrich_dir.mkdir(parents=True, exist_ok=True)
    safe_name = f.filename.replace(" ", "_").lower()
    dest = enrich_dir / safe_name
    f.save(str(dest))
    rows = _csv_row_count(dest)
    columns = _csv_columns(dest)
    cfg_data = _read_json(DATA_CLASSIFICATION_CFG) or {"classification": {}}
    cfg_data["classification"][safe_name] = {
        "party": party,
        "source_type": "Enrichment",
        "owner": owner,
        "use_for_identity": False,
        "use_for_enrichment": True,
        "description": description,
        "match_key": match_key,
    }
    with open(DATA_CLASSIFICATION_CFG, "w", encoding="utf-8") as fp:
        json.dump(cfg_data, fp, indent=2)
    return jsonify(
        {
            "name": safe_name,
            "display_name": _source_display_name(safe_name),
            "rows": rows,
            "columns": columns,
            "party": party,
            "owner": owner,
            "match_key": match_key,
            "message": f"Uploaded {safe_name} ({rows} rows) as {party} enrichment source",
        }
    )


# ---------------------------------------------------------------------------
# Pre-built Segments
# ---------------------------------------------------------------------------
PREBUILT_SEGMENTS = get_prebuilt_segments()

def _segment_bucket(rid, segment_id):
    import random

    return random.Random(f"{rid}:{segment_id}").randint(0, 99)


def _segment_safe_int(value, default=0):
    try:
        return int(float(str(value or "").strip()))
    except (TypeError, ValueError):
        return default


def _classify_automotive_record(rid, row):
    tier = str(row.get("membership_tier") or row.get("subscription_tier") or "").strip().upper()
    source_files = str(row.get("source_files") or "").lower()
    record_count = _segment_safe_int(row.get("record_count"))
    diversity_score = _segment_safe_int(row.get("diversity_score"))
    device_count = len([d for d in str(row.get("all_devices") or row.get("device_id") or "").split("|") if d.strip()])
    segs = set()

    if record_count >= 320 or tier in {"GOLD", "PLATINUM"} or _segment_bucket(rid, "auto_high_ltv") < 18:
        segs.add("auto_high_ltv")
    if tier in {"GOLD", "PLATINUM"} or diversity_score >= 5:
        segs.add("auto_loyalty_vip")
    if ("connected_services" in source_files and _segment_bucket(rid, "auto_connected_services") < 72) or _segment_bucket(rid, "auto_connected_services_fallback") < 28:
        segs.add("auto_connected_services")
    if (("service_orders" in source_files or "service_appointments" in source_files) and _segment_bucket(rid, "auto_service_due") < 64) or _segment_bucket(rid, "auto_service_due_fallback") < 35:
        segs.add("auto_service_due")
    if (("vehicle_health" in source_files or "telematics" in source_files) and _segment_bucket(rid, "auto_ev_battery_risk") < 34) or _segment_bucket(rid, "auto_ev_battery_risk_fallback") < 18:
        segs.add("auto_ev_battery_risk")
    if ("trade_ins" in source_files and _segment_bucket(rid, "auto_trade_in_ready") < 42) or _segment_bucket(rid, "auto_trade_in_ready_fallback") < 22:
        segs.add("auto_trade_in_ready")
    if ("insurance_policies" in source_files and _segment_bucket(rid, "auto_insurance_cross_sell") < 46) or _segment_bucket(rid, "auto_insurance_cross_sell_fallback") < 24:
        segs.add("auto_insurance_cross_sell")
    if ("recall" in source_files or _segment_bucket(rid, "auto_recall_open") < 18):
        segs.add("auto_recall_open")
    if ("nps_surveys" in source_files or _segment_bucket(rid, "auto_nps_recovery") < 22):
        segs.add("auto_nps_recovery")
    if ("mobile_app" in source_files or device_count >= 2) and _segment_bucket(rid, "auto_app_engaged") < 66:
        segs.add("auto_app_engaged")
    if ("warranty_claims" in source_files and _segment_bucket(rid, "auto_warranty_service") < 48) or _segment_bucket(rid, "auto_warranty_service_fallback") < 16:
        segs.add("auto_warranty_service")
    if not segs:
        segs.add("auto_service_due")
    return segs


def _classify_record(rid, source=None, row=None):
    import random

    row = row or {}
    source = _normalize_cluster_source(source)
    if source == "automotive":
        return _classify_automotive_record(rid, row)

    rng = random.Random(rid)
    ltv = round(rng.uniform(50, 2000), 2)
    recency = rng.randint(1, 365)
    engagement = round(rng.uniform(0, 100), 1)
    segs = set()

    if ltv >= 1000:
        segs.update(["vip_fans", "sth_active", "active_subs", "multi_product"])
    elif ltv >= 400:
        segs.update(["single_game", "heavy_consumers", "high_data"])
    else:
        segs.update(["digital_fans", "email_nonbuyer", "free_to_paid"])

    if recency <= 30:
        segs.update(["active_subs", "new_joiners", "app_nonbuyer"])
    elif recency <= 90:
        segs.update(["at_risk_subs", "contract_renewal", "sth_firstyear"])
    else:
        segs.update(["churned_subs", "winback_lapsed", "sth_lapsed", "churn_risk_tel"])

    if engagement >= 70:
        segs.update(["heavy_consumers", "fantasy_players", "legacy_fans"])
    elif engagement >= 35:
        segs.update(["merch_buyers", "group_buyers"])
    else:
        segs.update(["email_nonbuyer", "offseason_engagers"])

    if rng.choice(["Sports", "Movies", "Music", "News", "Kids", "Documentary"]) == "Sports":
        segs.update(["playoff_buyers", "away_travelers", "fb_spenders"])

    return segs


def _classify_segment_ids(row, source):
    rid = row.get("golden_id", row.get("record_id", ""))
    if not rid:
        return set()
    source = _normalize_cluster_source(source)
    if source == "media":
        real_segments = set(classify_golden_id(rid))
        if real_segments:
            return real_segments
    return _classify_record(rid, source, row)


SEGMENT_INDUSTRY_SOURCE = get_payload_value(
    "legacy_runtime.yml",
    "legacy_runtime",
    "SEGMENT_INDUSTRY_SOURCE",
)


def _raw_segment_source():
    return (
        request.args.get("source")
        or request.args.get("source_system")
        or request.args.get("sourceSystem")
        or DEFAULT_CLUSTER_SOURCE
    ).strip().lower()


def _segment_source_for_definition(segment):
    for industry in segment.get("industry", []):
        source = SEGMENT_INDUSTRY_SOURCE.get(industry)
        if source:
            return source
    return DEFAULT_CLUSTER_SOURCE


def _segment_source_for_id(segment_id, requested_source=None):
    requested_source = (requested_source or "").strip().lower()
    if requested_source and requested_source != "all":
        return _normalize_cluster_source(requested_source)
    for segment in PREBUILT_SEGMENTS:
        if segment.get("id") == segment_id:
            return _segment_source_for_definition(segment)
    return DEFAULT_CLUSTER_SOURCE


def _count_segments_for_source(source, allowed_ids=None):
    golden_csv = _get_golden_csv(source)
    counts = {s["id"]: 0 for s in PREBUILT_SEGMENTS}
    total_records = 0
    if not golden_csv.exists():
        return counts, total_records
    allowed_ids = set(counts.keys() if allowed_ids is None else allowed_ids)
    with open(golden_csv, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            for sid in _classify_segment_ids(row, source):
                if sid in allowed_ids and sid in counts:
                    counts[sid] += 1
            total_records += 1
    return counts, total_records


def _custom_segment_source(segment):
    raw_source = str(
        segment.get("source_system")
        or segment.get("sourceSystem")
        or ""
    ).strip().lower()
    if raw_source in SUPPORTED_CLUSTER_SOURCES:
        return raw_source
    return "all"


def _custom_segment_key(segment):
    segment_id = str(segment.get("segment_id") or segment.get("id") or "").strip()
    if segment_id:
        return segment_id
    name = str(segment.get("name") or "").strip().lower()
    return f"{_custom_segment_source(segment)}:{name}" if name else ""


def _load_custom_segment_definitions(raw_source):
    custom_segments = []
    for segment in SEGMENT_LIFECYCLE_STORE.list(raw_source, include_extra=False):
        segment_source = _custom_segment_source(segment)
        channels = segment.get("channel") or segment.get("channels") or []
        if not isinstance(channels, list):
            channels = [channels] if channels else []
        custom_segments.append(
            {
                **segment,
                "name": str(segment.get("name") or "Custom Segment").strip(),
                "description": str(
                    segment.get("description") or segment.get("query") or ""
                ).strip(),
                "source_system": segment_source,
                "source_scope": (
                    "Global custom definition"
                    if segment_source == "all"
                    else "Source-scoped custom definition"
                ),
                "definition_type": "custom",
                "channel": channels,
                "count": max(
                    _segment_safe_int(
                        segment.get(
                            "count",
                            segment.get("total", segment.get("_count", 0)),
                        )
                    ),
                    0,
                ),
            }
        )
    return custom_segments


@app.route("/api/segments", methods=["GET"])
def get_segments():
    raw_source = _raw_segment_source()
    source = _normalize_cluster_source(raw_source)
    industry_filter = request.args.get("industry", "")

    if raw_source == "all":
        counts = {s["id"]: 0 for s in PREBUILT_SEGMENTS}
        total_records = 0
        for source_name in sorted(set(SEGMENT_INDUSTRY_SOURCE.values())):
            allowed_ids = [
                s["id"]
                for s in PREBUILT_SEGMENTS
                if _segment_source_for_definition(s) == source_name
                and (not industry_filter or industry_filter in s.get("industry", []))
            ]
            if not allowed_ids:
                continue
            source_counts, source_total = _count_segments_for_source(source_name, allowed_ids)
            total_records += source_total
            for sid in allowed_ids:
                counts[sid] += source_counts.get(sid, 0)
    else:
        counts, total_records = _count_segments_for_source(source)

    result = []
    for s in PREBUILT_SEGMENTS:
        if industry_filter and industry_filter not in s.get("industry", []):
            continue
        count = counts[s["id"]]
        segment_source = _segment_source_for_definition(s)
        result.append(
            {
                **s,
                "source_system": segment_source,
                "count": count,
                "coverage_pct": round(count / total_records * 100, 1) if total_records else 0,
            }
        )
    prebuilt_segment_keys = {
        _custom_segment_key(segment)
        for segment in result
        if _custom_segment_key(segment)
    }
    custom_segments = [
        segment
        for segment in _load_custom_segment_definitions(raw_source)
        if _custom_segment_key(segment) not in prebuilt_segment_keys
    ]
    for segment in custom_segments:
        segment["coverage_pct"] = (
            round(segment["count"] / total_records * 100, 1)
            if total_records
            else 0
        )
    prebuilt_segment_count = len(result)
    custom_segment_count = len(custom_segments)
    return jsonify(
        {
            "segments": result,
            "custom_segments": custom_segments,
            "prebuilt_segment_count": prebuilt_segment_count,
            "custom_segment_count": custom_segment_count,
            "total_segments": prebuilt_segment_count + custom_segment_count,
            "total_records": total_records,
            "segment_count_formula": "prebuilt_segment_count + custom_segment_count",
            "source_system": raw_source if raw_source == "all" else source,
        }
    )


# ---------------------------------------------------------------------------
# Enhancement #1: Segment Members with optional 2P/3P enrichment join
# ---------------------------------------------------------------------------
@app.route("/api/segments/<segment_id>/members", methods=["GET"])
def get_segment_members(segment_id):
    source = _segment_source_for_id(segment_id, _raw_segment_source())
    page = request.args.get("page", 1, type=int)
    limit = request.args.get("limit", 50, type=int)
    channel = request.args.get("channel", "email")
    do_enrich = request.args.get("enrichment", "false").lower() == "true"

    golden_csv = _get_golden_csv(source)
    if not golden_csv.exists():
        return jsonify({"rows": [], "total": 0})

    enrich_lookup = _load_enrichment_by_golden_id() if do_enrich else {}

    rows = []
    with open(golden_csv, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = row.get("golden_id", row.get("record_id", ""))
            if segment_id not in _classify_segment_ids(row, source):
                continue
            full_name = row.get("full_name", "") or " ".join(part for part in [row.get("first_name", ""), row.get("last_name", "")] if part)
            record = {"golden_id": rid, "email": row.get("email", ""), "full_name": full_name}
            if source == "automotive":
                record.update(
                    {
                        "customer_id": row.get("customer_id", ""),
                        "household_id": row.get("household_id", ""),
                        "vehicle_id": row.get("vehicle_id", "") or row.get("device_id", ""),
                        "loyalty_id": row.get("loyalty_id", ""),
                        "membership_tier": row.get("membership_tier", ""),
                        "zip": row.get("zip", ""),
                    }
                )
            if do_enrich and rid in enrich_lookup:
                record.update(enrich_lookup[rid])
            rows.append(record)

    filtered = filter_segment_by_consent(rows, channel=channel)
    eligible = filtered["eligible"]
    start = (page - 1) * limit
    return jsonify(
        {
            "rows": eligible[start:start + limit],
            "total": len(eligible),
            "total_unfiltered": filtered["total"],
            "suppressed": filtered["block"],
            "consent_gate": channel,
            "page": page,
        }
    )


# ---------------------------------------------------------------------------
# Enhancement #2: Dynamic Segment Builder with 1P + 2P/3P filtering
# ---------------------------------------------------------------------------
@app.route("/api/segments/dynamic", methods=["POST"])
def dynamic_segment():
    import random

    rules = request.get_json() or {}
    source = _normalize_cluster_source(rules.get("source_system") or rules.get("sourceSystem") or rules.get("source"))
    rules = {k: v for k, v in rules.items() if k not in {"source", "source_system", "sourceSystem"}}
    golden_csv = _get_golden_csv(source)
    if not golden_csv.exists():
        return jsonify({"rows": [], "total": 0})

    ENRICHMENT_KEYS = {"fan_score_band", "home_dma", "estimated_age_range", "estimated_income_band", "ltv_band", "segment_code"}
    rules_1p = {k: v for k, v in rules.items() if k not in ENRICHMENT_KEYS}
    rules_2p3p = {k: v for k, v in rules.items() if k in ENRICHMENT_KEYS}

    # Always load enrichment — needed for member table display even when no 2P/3P filter rules
    enrich_lookup = _load_enrichment_by_golden_id()

    matched = []
    with open(golden_csv, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = row.get("golden_id", row.get("record_id", ""))
            rng = random.Random(rid)
            ltv = round(rng.uniform(50, 2000), 2)
            recency = rng.randint(1, 365)
            engagement = round(rng.uniform(0, 100), 1)
            record = {
                "golden_id": rid,
                "email": row.get("email", ""),
                "full_name": row.get("full_name", ""),
                "ltv_tier": "High" if ltv >= 1000 else "Medium" if ltv >= 400 else "Low",
                "recency_tier": "Active" if recency <= 30 else "Lapsing" if recency <= 90 else "Inactive",
                "engagement_tier": "High" if engagement >= 70 else "Medium" if engagement >= 35 else "Low",
                "ltv_score": ltv,
                "recency_days": recency,
                "engagement_rate": engagement,
            }
            record.update(enrich_lookup.get(rid, {}))

            if not all(str(record.get(k, "")).lower() == v.lower() for k, v in rules_1p.items()):
                continue
            if not all(str(record.get(k, "")).strip().lower() == v.strip().lower() for k, v in rules_2p3p.items()):
                continue
            matched.append(record)

    return jsonify({"rows": matched[:200], "total": len(matched)})


# ---------------------------------------------------------------------------
# Enhancement #3b: Push segment to CRM/Channel
# ---------------------------------------------------------------------------
@app.route("/api/segments/<segment_id>/activate", methods=["POST"])
def activate_segment(segment_id):
    body = request.get_json() or {}
    requested_source = body.get("source_system") or body.get("sourceSystem") or body.get("source")
    source = _segment_source_for_id(segment_id, requested_source)
    channel = body.get("channel", "crm")
    name = body.get("segment_name", segment_id)
    persisted = SEGMENT_LIFECYCLE_STORE.get(segment_id)
    if persisted is None and isinstance(body.get("segment_definition"), dict):
        definition = {
            **body["segment_definition"],
            "id": segment_id,
            "segment_id": segment_id,
            "name": body["segment_definition"].get("name") or name,
            "source_system": requested_source or source,
        }
        try:
            persisted = SEGMENT_LIFECYCLE_STORE.save_manual(definition)
        except ValueError:
            persisted = None

    count = _segment_safe_int(
        (persisted or {}).get("count", (persisted or {}).get("total", 0))
    )
    if persisted is None:
        golden_csv = _get_golden_csv(source)
        if golden_csv.exists():
            with open(golden_csv, "r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    if segment_id in _classify_segment_ids(row, source):
                        count += 1

    lifecycle_segment = SEGMENT_LIFECYCLE_STORE.activate(
        segment_id,
        source_system=requested_source or source,
        channel=channel,
        queued_count=count,
    )
    print(f"[ACTIVATE] segment={segment_id} name={name} channel={channel} count={count}")
    return jsonify(
        {
            "success": True,
            "segment_id": segment_id,
            "channel": channel,
            "queued_count": count,
            "status": "queued",
            "activation_status": (
                lifecycle_segment.get("activation_status")
                if lifecycle_segment
                else "queued"
            ),
            "segment": lifecycle_segment,
        }
    )


# ---------------------------------------------------------------------------
# Enhancement #4: Save custom segment to JSON file
# ---------------------------------------------------------------------------
@app.route("/api/copilot/segments", methods=["GET", "POST"])
def copilot_segments():
    if request.method == "GET":
        source = request.args.get("source") or request.args.get("source_system") or "all"
        return jsonify(
            SEGMENT_LIFECYCLE_STORE.list(
                source,
                include_extra=False,
            )
        )

    body = request.get_json() or {}
    try:
        saved_segment = SEGMENT_LIFECYCLE_STORE.save_manual(body)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400

    print(
        f"[COPILOT] Saved: {saved_segment['name']} "
        f"({saved_segment['total']} records)"
    )
    return jsonify(
        {
            "success": True,
            "saved": True,
            "segment": saved_segment,
        }
    ), 201


@app.route("/api/segments/published", methods=["GET"])
def published_segments():
    source = (
        request.args.get("source")
        or request.args.get("source_system")
        or request.args.get("sourceSystem")
        or "all"
    )
    segments = SEGMENT_LIFECYCLE_STORE.list(
        source,
        published_only=True,
        include_extra=False,
    )
    return jsonify(
        {
            "segments": segments,
            "total": len(segments),
            "source_system": source,
            "destination": "journey_builder",
        }
    )


@app.route("/api/segments/publish", methods=["POST"])
def publish_segments():
    body = request.get_json() or {}
    segment_ids = body.get("segment_ids") or body.get("segmentIds") or []
    if not isinstance(segment_ids, list) or not [
        value for value in segment_ids if str(value or "").strip()
    ]:
        return jsonify({"error": "segment_ids must contain at least one segment ID"}), 400

    source = (
        body.get("source")
        or body.get("source_system")
        or body.get("sourceSystem")
        or DEFAULT_CLUSTER_SOURCE
    )
    definitions = body.get("segments") if isinstance(body.get("segments"), list) else []
    published, missing = SEGMENT_LIFECYCLE_STORE.publish(
        segment_ids,
        source_system=source,
        destination=body.get("destination") or "journey_builder",
        definitions=definitions,
    )
    if not published:
        return jsonify(
            {
                "success": False,
                "error": "None of the selected segment IDs could be published.",
                "missing_segment_ids": missing,
            }
        ), 404
    return jsonify(
        {
            "success": not missing,
            "segments": published,
            "published_count": len(published),
            "missing_segment_ids": missing,
            "destination": "journey_builder",
            "source_system": source,
        }
    ), 200 if not missing else 207


# ---------------------------------------------------------------------------
# Enhancement #5: Audience Overlap between two segments
# ---------------------------------------------------------------------------
@app.route("/api/segments/overlap", methods=["GET"])
def segment_overlap():
    raw_source = _raw_segment_source()
    seg1 = request.args.get("seg1", "")
    seg2 = request.args.get("seg2", "")
    if not seg1 or not seg2:
        return jsonify({"error": "seg1 and seg2 query params are required"}), 400
    set1, set2 = set(), set()

    def collect_members(segment_id):
        source = _segment_source_for_id(segment_id, raw_source)
        members = set()
        golden_csv = _get_golden_csv(source)
        if golden_csv.exists():
            with open(golden_csv, "r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    rid = row.get("golden_id", row.get("record_id", ""))
                    if segment_id in _classify_segment_ids(row, source):
                        members.add(rid)
        return members

    set1 = collect_members(seg1)
    set2 = collect_members(seg2)
    both = set1 & set2
    union = set1 | set2
    total_a = len(set1)
    total_b = len(set2)
    overlap = len(both)
    return jsonify(
        {
            "seg1": seg1,
            "seg2": seg2,
            "total_a": total_a,
            "total_b": total_b,
            "overlap": overlap,
            "both": overlap,
            "seg1_only": len(set1 - set2),
            "seg2_only": len(set2 - set1),
            "pct_a": round(overlap / total_a * 100, 1) if total_a else 0,
            "pct_b": round(overlap / total_b * 100, 1) if total_b else 0,
            "overlap_pct": round(overlap / len(union) * 100, 1) if union else 0,
        }
    )


# ---------------------------------------------------------------------------
# Journey Templates
# ---------------------------------------------------------------------------
JOURNEY_TEMPLATES = get_journey_templates()


@app.route("/api/journeys", methods=["GET"])
def get_journeys():
    industry_filter = request.args.get("industry", "")
    result = []
    for jid, j in JOURNEY_TEMPLATES.items():
        if industry_filter and j.get("industry", "") != industry_filter:
            continue
        result.append(
            {
                "id": jid,
                "name": j["name"],
                "industry": j["industry"],
                "goal": j["goal"],
                "trigger": j["trigger"],
                "duration": j["duration"],
                "trigger_segment": j["trigger_segment"],
                "touchpoint_count": len(j["touchpoints"]),
            }
        )
    return jsonify({"journeys": result, "industries": sorted(set(j["industry"] for j in JOURNEY_TEMPLATES.values()))})


@app.route("/api/journeys/<journey_id>", methods=["GET"])
def get_journey_detail(journey_id):
    j = JOURNEY_TEMPLATES.get(journey_id)
    if not j:
        return jsonify({"error": "Journey not found"}), 404
    return jsonify({"id": journey_id, **j})


# ---------------------------------------------------------------------------
# API: Customer Profile (Cluster Data)
# ---------------------------------------------------------------------------
@app.route("/api/profile/<golden_id>/cluster-data", methods=["GET"])
def get_profile_cluster_data(golden_id):
    source = _normalize_cluster_source(request.args.get("source", DEFAULT_CLUSTER_SOURCE))
    golden_id = golden_id.upper()
    golden_row, cluster_id, cluster_rows = _profile_context_for_golden_id(
        source,
        golden_id,
    )

    if not cluster_rows and golden_row is None:
        return jsonify(
            {
                "cluster_source": source,
                "events": [],
                "subscriptions": [],
                "linked_identities": [],
                "attributes": {"computed": {}, "behavioral": {}},
                "household_members": [],
                "total_records": 0,
                "total_event_count": 0,
                "total_identity_count": 0,
                "identity_types": [],
                "total_linked_identity_records": 0,
                "contributing_source_count": 0,
                "contributing_sources": [],
                "last_updated": None,
                "profile_metrics": {},
                "profile_scope": "not_found",
                "limited_attributes": True,
            }
        ), 404

    if golden_row is None:
        golden_row = _synthesize_cluster_profile_row(
            cluster_id,
            cluster_rows,
            source,
        )

    subscriptions = _build_cluster_subscriptions(cluster_rows, source, golden_row=golden_row)
    all_events = _build_activity_timeline(
        cluster_rows,
        limit=max(len(cluster_rows), 1),
        enrich_timestamps=False,
        source=source,
        subscriptions=subscriptions,
        exclude_subscription_sources=True,
    )
    total_event_count = len(all_events)
    events = all_events[:50]
    _enrich_activity_event_timestamps(events)
    observed_datetimes = [
        parsed
        for parsed in (
            _parse_flexible_datetime(_get_activity_timestamp(row))
            for row in cluster_rows
        )
        if parsed is not None
    ]
    last_updated = (
        max(observed_datetimes).isoformat()
        if observed_datetimes
        else None
    )

    # The same governed metric contract is returned by both individual-profile
    # endpoints. Propensity scores and value proxies are never substituted for
    # a monetary customer lifetime-value measure.
    profile_metrics = _profile_metrics_for_profile(
        source,
        golden_row,
        cluster_rows,
    )

    def most_frequent(vals):
        vals = [v.strip() for v in vals if v and v.strip()]
        return max(set(vals), key=vals.count) if vals else ""

    if source == "automotive":
        auto_payload = _automotive_profile_enrichment(
            golden_row or {},
            cluster_rows=cluster_rows,
        ) or {}
        auto_enrichment = auto_payload.get("enrichment", {})
        vehicle = auto_enrichment.get("vehicle", {})
        telematics = auto_enrichment.get("telematics", {})
        loyalty = auto_enrichment.get("loyalty", {})
        service = auto_enrichment.get("service", {})
        campaign = auto_enrichment.get("campaign", {})
        computed_candidates = {
            "membership_tier": loyalty.get("tier") or golden_row.get("membership_tier", ""),
            "loyalty_id": loyalty.get("loyalty_account_id") or golden_row.get("loyalty_id", ""),
            "customer_id": golden_row.get("customer_id", ""),
            "vehicle_id": vehicle.get("vehicle_id") or golden_row.get("vehicle_id", "") or golden_row.get("device_id", ""),
            "service_status": service.get("ro_status", ""),
            "campaign_eligible": campaign.get("eligible_flag", ""),
        }
        behavioral_candidates = {
            "model": vehicle.get("model", ""),
            "powertrain_type": vehicle.get("powertrain", ""),
            "current_mileage": vehicle.get("current_mileage", ""),
            "safety_score": telematics.get("safety_score", ""),
            "trip_count": telematics.get("trip_count", ""),
            "campaign_type": campaign.get("campaign_type", ""),
        }
    else:
        computed_candidates = {
            "subscription_tier": most_frequent([r.get("subscription_tier", "") for r in cluster_rows]),
            "account_status": most_frequent([r.get("account_status", "") for r in cluster_rows]),
            "payment_method": most_frequent([r.get("payment_method", "") for r in cluster_rows]),
        }
        behavioral_candidates = {
            "device_platform": most_frequent([r.get("device_platform", "") for r in cluster_rows]),
            "device_type": most_frequent([r.get("device_type", "") for r in cluster_rows]),
            "content_affinity": most_frequent([r.get("content_type", "") for r in cluster_rows]),
            "category": most_frequent([r.get("category", "") for r in cluster_rows]),
        }

    computed = {k: v for k, v in computed_candidates.items() if v}
    behavioral = {k: v for k, v in behavioral_candidates.items() if v}

    linkage = _profile_linkage_summary(cluster_rows, source)

    household_members = []
    if source == "automotive":
        household_members = _source_household_members(source, golden_id, golden_row)
    else:
        enhanced_household_rows = []
        household_links_csv = _get_household_links_csv(source)
        if uc_enabled():
            enhanced_household_rows.extend(
                _uc_lookup_rows(
                    "household_links",
                    source,
                    {"cluster_id_1": [cluster_id]},
                    limit=1000,
                )
            )
            enhanced_household_rows.extend(
                _uc_lookup_rows(
                    "household_links",
                    source,
                    {"cluster_id_2": [cluster_id]},
                    limit=1000,
                )
            )
        elif household_links_csv.exists():
            with open(household_links_csv, "r", encoding="utf-8") as handle:
                enhanced_household_rows = [
                    row
                    for row in csv.DictReader(handle)
                    if cluster_id in {
                        str(row.get("cluster_id_1") or "").strip(),
                        str(row.get("cluster_id_2") or "").strip(),
                    }
                ]

        household_candidates = []
        seen_household_clusters = set()
        for row in enhanced_household_rows:
            first_cluster = str(row.get("cluster_id_1") or "").strip()
            second_cluster = str(row.get("cluster_id_2") or "").strip()
            other_cluster = (
                second_cluster
                if first_cluster.upper() == cluster_id.upper()
                else first_cluster
            )
            cluster_key = other_cluster.upper()
            if not other_cluster or cluster_key in seen_household_clusters:
                continue
            seen_household_clusters.add(cluster_key)
            household_candidates.append((row, other_cluster))
            if len(household_candidates) >= 32:
                break

        resolved_household_profiles = _profile_rows_for_cluster_ids(
            source,
            [other_cluster for _row, other_cluster in household_candidates],
        )
        for row, other_cluster in household_candidates:
            profile = resolved_household_profiles.get(other_cluster.upper(), {})
            if not profile:
                # Do not let a transient/optional lookup failure create an
                # ID-only shell that suppresses the richer household fallback.
                continue
            relationship = row.get(
                "relationship_classification",
                "Household Member",
            )
            member = _household_member_payload(
                {
                    **profile,
                    "golden_id": profile.get("golden_id")
                    or other_cluster.replace("-CL-", "-GR-"),
                    "address": profile.get("address")
                    or row.get("address_standardized", ""),
                    "zip": profile.get("zip") or row.get("zip", ""),
                    "relationship": relationship,
                },
                relationship=relationship,
            )
            member.update(
                {
                    "household_id": row.get("household_id", ""),
                    "confidence": row.get("final_confidence"),
                    "matched_fields": row.get("matched_fields", ""),
                    "decision_reason": row.get("decision_reason", ""),
                }
            )
            household_members.append(member)

        if not household_members and not uc_enabled() and HOUSEHOLD_CSV.exists():
            with open(HOUSEHOLD_CSV, "r", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    if row.get("golden_id", "").upper() == golden_id:
                        household_members.append(
                            {
                                "golden_id": row.get("household_golden_id", ""),
                                "full_name": row.get("full_name", ""),
                                "email": row.get("email", ""),
                                "address": row.get("address", ""),
                                "zip": row.get("zip", ""),
                                "relationship": row.get("relationship", "Household Member"),
                            }
                        )

    if not household_members:
        household_members = _source_household_members(source, golden_id, golden_row)
    household_members = _dedupe_household_members(household_members, golden_id)[:8]

    return jsonify(
        {
            "cluster_source": source,
            "cluster_id": cluster_id,
            "total_records": linkage["total_records"],
            "unique_linked_records": linkage["unique_linked_records"],
            "duplicate_record_rows": linkage["duplicate_record_rows"],
            "total_event_count": total_event_count,
            "total_identity_count": linkage["total_identity_count"],
            "identity_types": linkage["identity_types"],
            "total_linked_identity_records": linkage[
                "total_linked_identity_records"
            ],
            "contributing_source_count": linkage[
                "contributing_source_count"
            ],
            "contributing_sources": linkage["contributing_sources"],
            "events": events,
            "subscriptions": subscriptions,
            "attributes": {"computed": computed, "behavioral": behavioral},
            "linked_identities": linkage["linked_identities"],
            "household_members": household_members,
            "last_updated": last_updated,
            "profile_metrics": profile_metrics,
            "profile_scope": golden_row.get("profile_scope", "golden_artifact"),
            "limited_attributes": bool(golden_row.get("limited_attributes")),
        }
    )


# ---------------------------------------------------------------------------
# API: Segment Consent Summary
# ---------------------------------------------------------------------------
@app.route("/api/segments/<segment_id>/consent-summary", methods=["GET"])
def get_segment_consent_summary(segment_id):
    source = _segment_source_for_id(segment_id, _raw_segment_source())
    channel = request.args.get("channel", "email")
    golden_csv = _get_golden_csv(source)
    if not golden_csv.exists():
        return jsonify({"total": 0, "send": 0, "block": 0})
    rows = []
    with open(golden_csv, "r", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            rid = row.get("golden_id", row.get("record_id", ""))
            if segment_id in _classify_segment_ids(row, source):
                rows.append({"golden_id": rid})
    filtered = filter_segment_by_consent(rows, channel=channel)
    return jsonify(
        {
            "segment_id": segment_id,
            "total": filtered["total"],
            "send": filtered["send"],
            "block": filtered["block"],
            "channel": channel,
            "consent_last_refreshed": filtered.get("consent_last_refreshed"),
        }
    )



# ---------------------------------------------------------------------------
# API: Source Listing
# ---------------------------------------------------------------------------
 
from flask import request, jsonify
import warnings
import pandas as pd   # required for DtypeWarning reference
 
#   Suppress DtypeWarning ONLY for this section
warnings.filterwarnings("ignore", category=pd.errors.DtypeWarning)
 
 
source_listing_map = {
    "media": {
        "med_subscription_billing.csv": "Billing",
        "med_streaming_activity.csv": "Streaming",
        "med_app_events.csv": "App",
        "med_customer_support.csv": "Support",
        "med_email_engagement.csv": "Email"
    },
    "sports": {
        "spt_fan_accounts.csv": "Fan Account",
        "spt_ticket_orders.csv": "Ticketing",
        "spt_loyalty_members.csv": "Loyalty",
        "spt_app_events.csv": "App",
        "spt_commerce_orders.csv": "Orders",
        "spt_ott_streaming_sessions.csv": "Streaming",
        "spt_fantasy_gaming_accounts.csv": "Gamming Account"
    } 
}
 
 
@app.route("/api/source-listing", methods=["GET"])
def get_source_listing_api():
 
    category = request.args.get("category")
 
    if category:
        category = category.lower().strip()
 
        if category not in source_listing_map:
            return jsonify({
                "category": category,
                "total_sources": 0,
                "sources": []
            })
 
        sources = [
            {
                "file_name": file,
                "source_name": name
            }
            for file, name in source_listing_map.get(category, {}).items()
        ]
 
        return jsonify({
            "category": category,
            "total_sources": len(sources),
            "sources": sources
        })
 
    result = {}
 
    for cat, src in source_listing_map.items():
        result[cat] = [
            {
                "file_name": file,
                "source_name": name
            }
            for file, name in src.items()
        ]
 
    return jsonify({
        "total_categories": len(result),
        "data": result
    })


#----------------------------------------------------------------------
#Login API's code 
#----------------------------------------------------------------------

# ------------------------------------------
# Utility helpers
# ------------------------------------------
def now_utc_iso():
    return datetime.now(timezone.utc).isoformat()

def get_expiry_utc_iso():
    return (datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRATION_MINUTES)).isoformat()


def _auth_app_name():
    return (
        os.getenv("DATABRICKS_APP_NAME", "").strip()
        or os.getenv("CODEX_APP_NAME", "").strip()
        or "unknown"
    )


def _normalize_email(value):
    return str(value or "").strip().casefold()


def _auth_text(value):
    if value is None:
        return ""
    try:
        if pd.isna(value):
            return ""
    except (TypeError, ValueError):
        pass
    return str(value).strip()


def _auth_is_active(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    try:
        if pd.isna(value):
            return False
    except (TypeError, ValueError):
        pass
    return str(value).strip().casefold() in {
        "1",
        "true",
        "yes",
        "y",
        "active",
        "enabled",
    }


def _require_auth_data_access():
    if (
        not uc_enabled()
        or read_existing_table_df is None
        or append_existing_table_df is None
    ):
        raise DatabricksDataAccessError(
            "Unity Catalog authentication storage is unavailable."
        )


def _append_auth_record(logical_name, record):
    _require_auth_data_access()
    append_existing_table_df(logical_name, pd.DataFrame([record]))


# ------------------------------------------
# Read a user from the governed UC users table.
# Validates exact role + normalized email + active status + password hash.
# ------------------------------------------
def authenticate(role, email, password):
    _require_auth_data_access()
    normalized_role = str(role or "").strip()
    normalized_email = _normalize_email(email)
    if not normalized_role or not normalized_email or not isinstance(password, str):
        return None

    users = read_existing_table_df(
        AUTH_USERS_TABLE,
        columns=(
            "id",
            "username",
            "full_name",
            "email",
            "role",
            "role_label",
            "password_hash",
            "is_active",
        ),
        filters={"email": normalized_email, "role": normalized_role},
        limit=2,
    )
    matching_users = []
    for row in users.to_dict(orient="records"):
        if _normalize_email(row.get("email")) != normalized_email:
            continue
        if _auth_text(row.get("role")) != normalized_role:
            continue
        if not _auth_is_active(row.get("is_active")):
            continue
        matching_users.append(row)

    if len(matching_users) > 1:
        raise DatabricksDataAccessError(
            "The authentication user record is ambiguous."
        )
    if not matching_users:
        return None

    row = matching_users[0]
    password_hash = _auth_text(row.get("password_hash"))
    if not password_hash:
        return None
    try:
        password_valid = check_password_hash(password_hash, password)
    except (TypeError, ValueError):
        password_valid = False
    if not password_valid:
        return None

    return {
        "id": _auth_text(row.get("id")),
        "username": _auth_text(row.get("username")),
        "full_name": _auth_text(row.get("full_name")),
        "email": normalized_email,
        "role": normalized_role,
        "role_label": _auth_text(row.get("role_label")),
    }


# ------------------------------------------
# Generate JWT token
# ------------------------------------------
def generate_access_token(user):
    jti = str(uuid.uuid4())
    issued_at = datetime.now(timezone.utc)
    expires_at = issued_at + timedelta(minutes=JWT_EXPIRATION_MINUTES)

    payload = {
        "sub": str(user["id"]),
        "iss": _auth_app_name(),
        "username": user["username"],
        "full_name": user["full_name"],
        "email": user["email"],
        "role": user["role"],
        "role_label": user["role_label"],
        "jti": jti,
        "iat": issued_at,
        "exp": expires_at
    }

    access_token = jwt.encode(payload, _jwt_secret_key(), algorithm=JWT_ALGORITHM)
    return access_token, jti, expires_at.isoformat()


# ------------------------------------------
# Decode JWT token
# ------------------------------------------
def decode_access_token(token):
    try:
        payload = jwt.decode(
            token,
            _jwt_secret_key(),
            algorithms=[JWT_ALGORITHM],
            issuer=_auth_app_name(),
            options={"require": ["exp", "iat", "jti", "sub", "iss"]},
        )
        return payload
    except jwt.ExpiredSignatureError:
        return {"error": "Token has expired"}
    except jwt.InvalidTokenError:
        return {"error": "Invalid token"}


# ------------------------------------------
# Append a session event. The JWT itself is never persisted.
# ------------------------------------------
def save_session(user, jti, expires_at_utc, ip_address=None):
    record = {
        "event_id": str(uuid.uuid4()),
        "jti": str(jti),
        "user_id": _auth_text(user.get("id")),
        "username": _auth_text(user.get("username")),
        "email": _normalize_email(user.get("email")),
        "role": _auth_text(user.get("role")),
        "role_label": _auth_text(user.get("role_label")),
        "status": "ACTIVE",
        "event_at_utc": now_utc_iso(),
        "expires_at_utc": _auth_text(expires_at_utc),
        "ip_address": _auth_text(ip_address),
        "app_name": _auth_app_name(),
    }
    _append_auth_record(AUTH_SESSIONS_TABLE, record)
    return record


# ------------------------------------------
# Append an authentication audit event
# ------------------------------------------
def write_auth_log(event, user, ip_address=None, jti=None):
    record = {
        "event_id": str(uuid.uuid4()),
        "event": _auth_text(event),
        "timestamp_utc": now_utc_iso(),
        "user_id": _auth_text(user.get("id")),
        "username": _auth_text(user.get("username")),
        "email": _normalize_email(user.get("email")),
        "role": _auth_text(user.get("role")),
        "role_label": _auth_text(user.get("role_label")),
        "ip_address": _auth_text(ip_address),
        "jti": _auth_text(jti),
        "app_name": _auth_app_name(),
    }
    _append_auth_record(AUTH_LOGS_TABLE, record)
    return record


# ------------------------------------------
# Get the latest append-only session event by jti
# ------------------------------------------
def get_session_by_jti(jti):
    _require_auth_data_access()
    normalized_jti = _auth_text(jti)
    app_name = _auth_app_name()
    if not normalized_jti:
        return None
    events = read_existing_table_df(
        AUTH_SESSIONS_TABLE,
        columns=(
            "event_id",
            "jti",
            "user_id",
            "username",
            "email",
            "role",
            "role_label",
            "status",
            "event_at_utc",
            "expires_at_utc",
            "ip_address",
            "app_name",
        ),
        filters={"jti": normalized_jti, "app_name": app_name},
    )
    matching_events = [
        row
        for row in events.to_dict(orient="records")
        if _auth_text(row.get("jti")) == normalized_jti
        and _auth_text(row.get("app_name")) == app_name
    ]
    if not matching_events:
        return None
    return max(
        matching_events,
        key=lambda row: (
            _auth_text(row.get("event_at_utc")),
            _auth_text(row.get("event_id")),
        ),
    )


# ------------------------------------------
# Append a new status event instead of rewriting session history
# ------------------------------------------
def update_session_status(jti, new_status, ip_address=None):
    current = get_session_by_jti(jti)
    if not current:
        return None
    record = {
        "event_id": str(uuid.uuid4()),
        "jti": _auth_text(jti),
        "user_id": _auth_text(current.get("user_id")),
        "username": _auth_text(current.get("username")),
        "email": _normalize_email(current.get("email")),
        "role": _auth_text(current.get("role")),
        "role_label": _auth_text(current.get("role_label")),
        "status": _auth_text(new_status).upper(),
        "event_at_utc": now_utc_iso(),
        "expires_at_utc": _auth_text(current.get("expires_at_utc")),
        "ip_address": _auth_text(ip_address or current.get("ip_address")),
        "app_name": _auth_app_name(),
    }
    _append_auth_record(AUTH_SESSIONS_TABLE, record)
    return record


# ------------------------------------------
# Check whether token session is ACTIVE
# ------------------------------------------
def is_token_session_active(jti):
    session = get_session_by_jti(jti)
    if not session:
        return False, "Session not found"

    if _auth_text(session.get("status")).upper() != "ACTIVE":
        return False, "Session is not active"

    expires_at_text = _auth_text(session.get("expires_at_utc"))
    if expires_at_text:
        try:
            expires_at = datetime.fromisoformat(expires_at_text.replace("Z", "+00:00"))
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at <= datetime.now(timezone.utc):
                return False, "Session has expired"
        except ValueError:
            return False, "Session is invalid"

    return True, "Session is active"


# ------------------------------------------
# JWT protected route decorator
# ------------------------------------------
def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({
                "status": "error",
                "message": "Authorization header missing or invalid"
            }), 401

        token = auth_header.split(" ")[1].strip()

        payload = decode_access_token(token)
        if "error" in payload:
            return jsonify({
                "status": "error",
                "message": payload["error"]
            }), 401

        jti = payload.get("jti")
        try:
            is_active, message = is_token_session_active(jti)
        except DatabricksDataAccessError:
            app.logger.exception("Authentication session lookup failed")
            return jsonify({
                "status": "error",
                "message": "Authentication service is temporarily unavailable"
            }), 503
        if not is_active:
            return jsonify({
                "status": "error",
                "message": message
            }), 401

        g.current_user = {
            "id": payload.get("sub"),
            "username": payload.get("username"),
            "full_name": payload.get("full_name"),
            "email": payload.get("email"),
            "role": payload.get("role"),
            "role_label": payload.get("role_label"),
        }
        g.current_jti = jti
        g.current_token = token

        return f(*args, **kwargs)

    return decorated


# ------------------------------------------
# Login API
# Validates against the governed users table, persists an append-only session
# event, and writes an audit event before returning the JWT.
# ------------------------------------------
@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    role = data.get("role")
    email = data.get("email")
    password = data.get("password")

    if not role or not email or not password:
        return jsonify({
            "status": "error",
            "message": "role, email and password are required"
        }), 400


    normalized_email = _normalize_email(email)
    normalized_role = str(role or "").strip()
    try:
        user = authenticate(normalized_role, normalized_email, password)
    except DatabricksDataAccessError:
        app.logger.exception("Authentication user lookup failed")
        return jsonify({
            "status": "error",
            "message": "Authentication service is temporarily unavailable"
        }), 503

    if not user:
        attempted_user = {
            "id": "",
            "username": "",
            "email": normalized_email,
            "role": normalized_role,
            "role_label": "",
        }
        try:
            write_auth_log(
                event="login_failed",
                user=attempted_user,
                ip_address=request.remote_addr,
            )
        except DatabricksDataAccessError:
            app.logger.exception("Authentication failure audit append failed")
            return jsonify({
                "status": "error",
                "message": "Authentication service is temporarily unavailable"
            }), 503
        return jsonify({
            "status": "error",
            "message": "Invalid credentials"
        }), 401

    access_token, jti, expires_at_utc = generate_access_token(user)
    try:
        save_session(
            user=user,
            jti=jti,
            expires_at_utc=expires_at_utc,
            ip_address=request.remote_addr,
        )
        try:
            write_auth_log(
                event="login",
                user=user,
                ip_address=request.remote_addr,
                jti=jti,
            )
        except DatabricksDataAccessError:
            # The token has not been returned. Revoke its persisted session so
            # an audit outage cannot leave an undisclosed active credential.
            try:
                update_session_status(jti, "REVOKED", request.remote_addr)
            except DatabricksDataAccessError:
                app.logger.exception(
                    "Authentication session rollback append failed"
                )
            raise
    except DatabricksDataAccessError:
        app.logger.exception("Authentication session persistence failed")
        return jsonify({
            "status": "error",
            "message": "Authentication service is temporarily unavailable"
        }), 503

    return jsonify({
        "status": "success",
        "message": "Login successful",
        "access_token": access_token,
        "token_type": "Bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "full_name": user["full_name"],
            "email": user["email"],
            "role": user["role"],
            "role_label": user["role_label"]
        }
    }), 200


# ------------------------------------------
# Logout API
# Appends LOGGED_OUT session state and an audit event
# ------------------------------------------
@app.route("/api/logout", methods=["POST"])
@token_required
def logout():
    try:
        update_session_status(
            g.current_jti,
            "LOGGED_OUT",
            request.remote_addr,
        )
        write_auth_log(
            event="logout",
            user=g.current_user,
            ip_address=request.remote_addr,
            jti=g.current_jti,
        )
    except DatabricksDataAccessError:
        app.logger.exception("Authentication logout persistence failed")
        return jsonify({
            "status": "error",
            "message": "Authentication service is temporarily unavailable"
        }), 503

    return jsonify({
        "status": "success",
        "message": "Logout successful"
    }), 200




















# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print(f"EXL CDP Backend starting... ROOT={ROOT}")
    app.run(debug=True, port=5001, use_reloader=False)
