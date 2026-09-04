from dataclasses import dataclass
from typing import Any
import json

import httpx


class RestAPIConnectorError(Exception):
    pass


@dataclass
class RestAPIConfig:
    base_url: str
    auth_type: str
    api_key: str = ""
    bearer_token: str = ""
    username: str = ""
    password: str = ""
    default_headers: dict[str, Any] | None = None
    endpoints: list[str] | None = None


def config_from_payload(payload: dict[str, Any] | None) -> RestAPIConfig:
    body = payload or {}
    base_url = str(body.get("base_url") or "").strip()
    if not base_url:
        raise RestAPIConnectorError("Missing required field: base_url")
    auth_type = str(body.get("auth_type") or "none").strip().lower() or "none"
    default_headers = body.get("default_headers") or {}
    if isinstance(default_headers, str):
        try:
            default_headers = json.loads(default_headers)
        except Exception as exc:
            raise RestAPIConnectorError(f"default_headers must be valid JSON: {exc}") from exc
    endpoints = body.get("endpoints") or []
    if isinstance(endpoints, str):
        endpoints = [line.strip() for line in endpoints.splitlines() if line.strip()]
    return RestAPIConfig(
        base_url=base_url.rstrip("/"),
        auth_type=auth_type,
        api_key=str(body.get("api_key") or "").strip(),
        bearer_token=str(body.get("bearer_token") or "").strip(),
        username=str(body.get("username") or "").strip(),
        password=str(body.get("password") or "").strip(),
        default_headers=default_headers if isinstance(default_headers, dict) else {},
        endpoints=endpoints if isinstance(endpoints, list) else [],
    )


def _build_headers(config: RestAPIConfig) -> dict[str, str]:
    headers = {str(k): str(v) for k, v in (config.default_headers or {}).items()}
    if config.auth_type == "api_key" and config.api_key:
        headers.setdefault("x-api-key", config.api_key)
    if config.auth_type == "bearer" and config.bearer_token:
        headers["Authorization"] = f"Bearer {config.bearer_token}"
    return headers


def _client(config: RestAPIConfig) -> httpx.Client:
    auth = None
    if config.auth_type == "basic" and config.username:
        auth = (config.username, config.password)
    return httpx.Client(base_url=config.base_url, headers=_build_headers(config), auth=auth, timeout=60.0)


def _normalize_rows(data: Any) -> list[dict[str, Any]]:
    if isinstance(data, list):
        return [item if isinstance(item, dict) else {"value": item} for item in data]
    if isinstance(data, dict):
        for key in ("data", "items", "results", "records"):
            if isinstance(data.get(key), list):
                return [item if isinstance(item, dict) else {"value": item} for item in data[key]]
        return [data]
    return [{"value": data}]


def test_connection(config: RestAPIConfig) -> dict[str, Any]:
    with _client(config) as client:
        try:
            response = client.get("/")
            response.raise_for_status()
            return {"status_code": response.status_code}
        except Exception as exc:
            raise RestAPIConnectorError(f"Unable to connect to REST API: {exc}") from exc


def list_endpoints(config: RestAPIConfig) -> list[str]:
    return [str(item).strip() for item in (config.endpoints or []) if str(item).strip()]


def preview_endpoint(config: RestAPIConfig, endpoint: str, limit: int = 10) -> tuple[list[str], list[dict[str, Any]]]:
    if not endpoint:
        raise RestAPIConnectorError("endpoint is required")
    with _client(config) as client:
        try:
            response = client.get(endpoint)
            response.raise_for_status()
            rows = _normalize_rows(response.json())[: max(1, min(int(limit), 100))]
            columns = sorted({key for row in rows for key in row.keys()}) if rows else []
            return columns, rows
        except Exception as exc:
            raise RestAPIConnectorError(f"REST API preview failed: {exc}") from exc


def fetch_endpoint_rows(config: RestAPIConfig, endpoint: str) -> tuple[list[str], list[dict[str, Any]]]:
    columns, rows = preview_endpoint(config, endpoint, limit=100000)
    return columns, rows
