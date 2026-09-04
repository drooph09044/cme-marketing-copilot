from dataclasses import dataclass
from typing import Any
import csv
import io
import json

from azure.storage.blob import BlobServiceClient


class AzureBlobConnectorError(Exception):
    pass


@dataclass
class AzureBlobConfig:
    container_name: str
    connection_string: str = ""
    account_url: str = ""
    sas_token: str = ""
    prefix: str = ""


def config_from_payload(payload: dict[str, Any] | None) -> AzureBlobConfig:
    body = payload or {}
    container_name = str(body.get("container_name") or "").strip()
    if not container_name:
        raise AzureBlobConnectorError("Missing required field: container_name")
    return AzureBlobConfig(
        container_name=container_name,
        connection_string=str(body.get("connection_string") or "").strip(),
        account_url=str(body.get("account_url") or "").strip(),
        sas_token=str(body.get("sas_token") or "").strip(),
        prefix=str(body.get("prefix") or "").strip(),
    )


def _service_client(config: AzureBlobConfig) -> BlobServiceClient:
    try:
        if config.connection_string:
            return BlobServiceClient.from_connection_string(config.connection_string)
        if config.account_url and config.sas_token:
            credential = config.sas_token.lstrip("?")
            return BlobServiceClient(account_url=config.account_url, credential=credential)
    except Exception as exc:
        raise AzureBlobConnectorError(f"Unable to connect to Azure Blob Storage: {exc}") from exc
    raise AzureBlobConnectorError("Provide either connection_string or account_url + sas_token")


def _parse_blob_content(name: str, content: bytes, limit: int = 10) -> tuple[list[str], list[dict[str, Any]]]:
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
    raise AzureBlobConnectorError("Only CSV and JSON blobs are supported right now")


def test_connection(config: AzureBlobConfig) -> dict[str, Any]:
    try:
        client = _service_client(config)
        container = client.get_container_client(config.container_name)
        container.get_container_properties()
        return {"container_name": config.container_name}
    except AzureBlobConnectorError:
        raise
    except Exception as exc:
        raise AzureBlobConnectorError(f"Unable to connect to Azure Blob container: {exc}") from exc


def list_objects(config: AzureBlobConfig, prefix: str | None = None) -> list[dict[str, Any]]:
    try:
        container = _service_client(config).get_container_client(config.container_name)
        effective_prefix = prefix if prefix is not None else config.prefix
        result = []
        for blob in container.list_blobs(name_starts_with=effective_prefix or None):
            result.append({"name": blob.name, "size": getattr(blob, "size", 0)})
        return result
    except AzureBlobConnectorError:
        raise
    except Exception as exc:
        raise AzureBlobConnectorError(f"Unable to list Azure Blob objects: {exc}") from exc


def preview_object(config: AzureBlobConfig, object_name: str, limit: int = 10) -> tuple[list[str], list[dict[str, Any]]]:
    try:
        blob = _service_client(config).get_blob_client(container=config.container_name, blob=object_name)
        content = blob.download_blob().readall()
        return _parse_blob_content(object_name, content, limit=limit)
    except AzureBlobConnectorError:
        raise
    except Exception as exc:
        raise AzureBlobConnectorError(f"Unable to preview Azure Blob object: {exc}") from exc


def fetch_object_rows(config: AzureBlobConfig, object_name: str) -> tuple[list[str], list[dict[str, Any]]]:
    return preview_object(config, object_name, limit=100000)
