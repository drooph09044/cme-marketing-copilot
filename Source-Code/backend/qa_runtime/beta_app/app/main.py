"""FastAPI entrypoint.

Run locally with:
    uvicorn app.main:app --reload --port 8000

Docs: http://localhost:8000/docs
"""

from __future__ import annotations

import logging
import os

from dotenv import load_dotenv

load_dotenv()  # Read apps/api/.env if present.

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)-8s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
    force=True,
)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import journey, profiles, runs, segments

app = FastAPI(
    title="Workflow Test API",
    description="Backend for the Journey Test Console.",
    version="1.0.0",
)

# CORS: the Next.js dev server proxies through /api, but enable broad CORS for
# direct browser calls during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(journey.router)
app.include_router(profiles.router)
app.include_router(runs.router)
app.include_router(segments.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


# Static frontend mount — used in production (Databricks Apps) where the Next.js
# static export is bundled alongside this package and served from the same
# origin as the API. The mount is registered AFTER all API routers so FastAPI's
# route table matches `/journeys`, `/runs/...`, etc. first; only unmatched paths
# fall through to the static files. `html=True` makes index.html serve as the
# fallback for client-side routes (deep links).
#
# Locally STATIC_DIR doesn't exist → the mount is skipped, dev behaviour is
# unchanged (Next.js dev server serves the UI on :3000).
_STATIC_DIR = os.environ.get("STATIC_DIR", "/app/static")
if os.path.isdir(_STATIC_DIR):
    app.mount("/", StaticFiles(directory=_STATIC_DIR, html=True), name="static")
