"""Fast Databricks Apps entrypoint for the MarketingEngine deployment."""

from __future__ import annotations

import os
import sys
import threading
import time
import traceback
from pathlib import Path

from flask import Flask, jsonify, send_from_directory


DEPLOYMENT_ROOT = Path(__file__).resolve().parent
APPLICATION_ROOT = DEPLOYMENT_ROOT / "Source-Code"
BACKEND_ROOT = APPLICATION_ROOT / "backend"
FRONTEND_DIST = APPLICATION_ROOT / "dist"

if not (BACKEND_ROOT / "app.py").is_file():
    raise RuntimeError(
        f"Deployment is incomplete: expected {BACKEND_ROOT / 'app.py'}"
    )
if not (FRONTEND_DIST / "index.html").is_file():
    raise RuntimeError(
        f"Deployment is incomplete: expected {FRONTEND_DIST / 'index.html'}"
    )

sys.path.insert(0, str(APPLICATION_ROOT))
sys.path.insert(0, str(BACKEND_ROOT))
os.environ["CODEX_FRONTEND_DIST"] = str(FRONTEND_DIST)

_started_at = time.perf_counter()
_backend_ready = threading.Event()
_backend_state = {
    "app": None,
    "error": None,
    "stage": "initializing",
    "elapsed_seconds": 0.0,
}


def _load_backend() -> None:
    _backend_state["stage"] = "loading_backend"
    try:
        from backend.app import app as backend_app

        _backend_state["app"] = backend_app
        _backend_state["stage"] = "ready"
        print(
            f"[BOOTSTRAP] Backend ready in "
            f"{time.perf_counter() - _started_at:.1f}s.",
            flush=True,
        )
    except Exception as exc:
        _backend_state["error"] = str(exc)
        _backend_state["stage"] = "failed"
        print("[BOOTSTRAP] Backend failed to initialize.", flush=True)
        traceback.print_exc()
    finally:
        _backend_state["elapsed_seconds"] = round(
            time.perf_counter() - _started_at,
            2,
        )
        _backend_ready.set()


def _warm_sql_warehouse() -> None:
    warehouse_id = str(os.getenv("DATABRICKS_WAREHOUSE_ID") or "").strip()
    if not warehouse_id:
        return
    try:
        from databricks.sdk import WorkspaceClient

        WorkspaceClient().warehouses.start(id=warehouse_id)
        print(
            f"[BOOTSTRAP] SQL warehouse warm-up requested: {warehouse_id}.",
            flush=True,
        )
    except Exception as exc:
        print(f"[BOOTSTRAP] SQL warehouse warm-up failed: {exc}", flush=True)


_bootstrap = Flask("marketing_engine_bootstrap")


@_bootstrap.get("/")
def bootstrap_index():
    response = send_from_directory(FRONTEND_DIST, "index.html")
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return response


@_bootstrap.get("/assets/<path:filename>")
def bootstrap_asset(filename):
    response = send_from_directory(FRONTEND_DIST / "assets", filename)
    response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    return response


@_bootstrap.get("/favicon.ico")
def bootstrap_favicon():
    favicon = FRONTEND_DIST / "favicon.ico"
    if favicon.is_file():
        return send_from_directory(FRONTEND_DIST, "favicon.ico")
    return "", 204


@_bootstrap.route("/api/<path:_api_path>", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
def bootstrap_api(_api_path):
    return (
        jsonify(
            {
                "status": _backend_state["stage"],
                "error": (
                    "Application services are still starting. Please retry shortly."
                    if _backend_state["stage"] != "failed"
                    else "Application services failed to start. Check the App logs."
                ),
                "retryable": _backend_state["stage"] != "failed",
                "elapsed_seconds": round(time.perf_counter() - _started_at, 2),
            }
        ),
        503,
    )


@_bootstrap.get("/<path:frontend_path>")
def bootstrap_frontend(frontend_path):
    requested = FRONTEND_DIST / frontend_path
    if requested.is_file():
        return send_from_directory(FRONTEND_DIST, frontend_path)
    return bootstrap_index()


class LazyBackendApplication:
    """Serve the frontend immediately and dispatch to Flask when it is ready."""

    def __call__(self, environ, start_response):
        backend_app = _backend_state["app"]
        if backend_app is not None:
            return backend_app(environ, start_response)

        path = str(environ.get("PATH_INFO") or "")
        if path.startswith("/api/"):
            try:
                wait_seconds = max(
                    0.0,
                    min(
                        float(os.getenv("CODEX_STARTUP_API_WAIT_SECONDS", "8")),
                        15.0,
                    ),
                )
            except ValueError:
                wait_seconds = 8.0
            if wait_seconds:
                _backend_ready.wait(wait_seconds)
                backend_app = _backend_state["app"]
                if backend_app is not None:
                    return backend_app(environ, start_response)

        return _bootstrap(environ, start_response)


app = LazyBackendApplication()

if str(os.getenv("CODEX_LAZY_BACKEND_AUTOSTART", "1")).lower() in {
    "1",
    "true",
    "yes",
}:
    threading.Thread(
        target=_load_backend,
        name="marketing-engine-backend-loader",
        daemon=True,
    ).start()
    threading.Thread(
        target=_warm_sql_warehouse,
        name="marketing-engine-warehouse-warmup",
        daemon=True,
    ).start()


if __name__ == "__main__":
    from werkzeug.serving import run_simple

    port = int(os.environ.get("DATABRICKS_APP_PORT", "8080"))
    run_simple("0.0.0.0", port, app, use_reloader=False)
