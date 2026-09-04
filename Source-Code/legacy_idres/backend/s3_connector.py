from dataclasses import dataclass
from typing import Any
import csv
import io
import json

import boto3


class S3ConnectorError(Exception):
    pass


@dataclass
class S3Config:
    bucket: str
    region: str
    access_key_id: str
    secret_access_key: str
    session_token: str = ""
    prefix: str = ""


def config_from_payload(payload: dict[str, Any] | None) -> S3Config:
    body = payload or {}
    bucket = str(body.get("bucket") or "").strip()
    region = str(body.get("region") or "").strip()
    access_key_id = str(body.get("access_key_id") or "").strip()
    secret_access_key = str(body.get("secret_access_key") or "").strip()
    if not all([bucket, region, access_key_id, secret_access_key]):
        raise S3ConnectorError("bucket, region, access_key_id, and secret_access_key are required")
    return S3Config(
        bucket=bucket,
        region=region,
        access_key_id=access_key_id,
        secret_access_key=secret_access_key,
        session_token=str(body.get("session_token") or "").strip(),
        prefix=str(body.get("prefix") or "").strip(),
    )


def _client(config: S3Config):
    try:
        return boto3.client(
            "s3",
            region_name=config.region,
            aws_access_key_id=config.access_key_id,
            aws_secret_access_key=config.secret_access_key,
            aws_session_token=config.session_token or None,
        )
    except Exception as exc:
        raise S3ConnectorError(f"Unable to create S3 client: {exc}") from exc


def _parse_content(name: str, content: bytes, limit: int = 10) -> tuple[list[str], list[dict[str, Any]]]:
    lowered = name.lower()
    if lowered.endswith(".csv"):
        text = content.decode("utf-8", errors="replace")
        reader = csv.DictReader(io.StringIO(text))
        rows = []
        for idx, row in enumerate(reader):
            rows.append(row)
            if idx + 1 >= limit:
                break
        return reader.fieldnames or [], rows
    if lowered.endswith(".json"):
        payload = json.loads(content.decode("utf-8", errors="replace"))
        if isinstance(payload, list):
            rows = [item if isinstance(item, dict) else {"value": item} for item in payload[:limit]]
        elif isinstance(payload, dict):
            rows = [payload]
        else:
            rows = [{"value": payload}]
        columns = sorted({key for row in rows for key in row.keys()}) if rows else []
        return columns, rows
    raise S3ConnectorError("Only CSV and JSON objects are supported right now")


def test_connection(config: S3Config) -> dict[str, Any]:
    try:
        client = _client(config)
        client.head_bucket(Bucket=config.bucket)
        return {"bucket": config.bucket}
    except S3ConnectorError:
        raise
    except Exception as exc:
        raise S3ConnectorError(f"Unable to connect to S3 bucket: {exc}") from exc


def list_objects(config: S3Config, prefix: str | None = None) -> list[dict[str, Any]]:
    try:
        client = _client(config)
        response = client.list_objects_v2(Bucket=config.bucket, Prefix=prefix if prefix is not None else config.prefix)
        contents = response.get("Contents", [])
        return [{"name": item["Key"], "size": item.get("Size", 0)} for item in contents]
    except S3ConnectorError:
        raise
    except Exception as exc:
        raise S3ConnectorError(f"Unable to list S3 objects: {exc}") from exc


def preview_object(config: S3Config, object_name: str, limit: int = 10) -> tuple[list[str], list[dict[str, Any]]]:
    try:
        client = _client(config)
        response = client.get_object(Bucket=config.bucket, Key=object_name)
        content = response["Body"].read()
        return _parse_content(object_name, content, limit=limit)
    except S3ConnectorError:
        raise
    except Exception as exc:
        raise S3ConnectorError(f"Unable to preview S3 object: {exc}") from exc


def fetch_object_rows(config: S3Config, object_name: str) -> tuple[list[str], list[dict[str, Any]]]:
    return preview_object(config, object_name, limit=100000)
