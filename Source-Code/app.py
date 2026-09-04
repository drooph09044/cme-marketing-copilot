"""Databricks Apps entrypoint for MarketingEngine."""

from __future__ import annotations

import os
import sys
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent
BACKEND_ROOT = PROJECT_ROOT / "backend"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from backend.app import app


if __name__ == "__main__":
    port = int(os.environ.get("DATABRICKS_APP_PORT", "8080"))
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
