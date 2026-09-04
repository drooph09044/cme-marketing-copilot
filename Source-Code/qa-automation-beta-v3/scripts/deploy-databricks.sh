#!/usr/bin/env bash
# deploy-databricks.sh — package the Journey QA Test Console as a Databricks App
# bundle and deploy it via the Databricks CLI.
#
# Usage:
#   ./scripts/deploy-databricks.sh                       # full build + deploy
#   ./scripts/deploy-databricks.sh --bundle-only         # build the bundle, skip deploy
#   ./scripts/deploy-databricks.sh --app-name my-orch    # override app name (default: orchestrate-qa)
#   ./scripts/deploy-databricks.sh --skip-frontend       # reuse existing apps/web/out
#
# Prerequisites:
#   - Databricks CLI ≥ 0.225.0 (`databricks --version`)
#   - `databricks auth login` already completed
#   - pnpm + Python venv at apps/api/.venv with requirements installed
#   - App exists in the workspace:
#       databricks apps create orchestrate-qa --description "Journey QA Test Console"
#
# Reads .env vars (optional):
#   DATABRICKS_APP_NAME  — overrides --app-name default

set -euo pipefail

# ─── Resolve paths ───────────────────────────────────────────────────────
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.."; pwd)"
DEPLOY="$ROOT/deploy"
WEB="$ROOT/apps/web"
API="$ROOT/apps/api"
EXAMPLES="$ROOT/examples"

# ─── Args ────────────────────────────────────────────────────────────────
BUNDLE_ONLY=0
SKIP_FRONTEND=0
APP_NAME="${DATABRICKS_APP_NAME:-orchestrate-qa}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bundle-only)   BUNDLE_ONLY=1; shift ;;
    --skip-frontend) SKIP_FRONTEND=1; shift ;;
    --app-name)      APP_NAME="${2:?--app-name needs a value}"; shift 2 ;;
    -h|--help)
      sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

# ─── Sanity checks ───────────────────────────────────────────────────────
if [[ $BUNDLE_ONLY -eq 0 ]] && ! command -v databricks >/dev/null 2>&1; then
  echo "ERR: 'databricks' CLI not found." >&2
  echo "       Install: brew install databricks   (or https://docs.databricks.com/en/dev-tools/cli/install.html)" >&2
  exit 1
fi

if [[ ! -f "$DEPLOY/app.yaml.tmpl" ]]; then
  echo "ERR: deploy/app.yaml.tmpl is missing — was the deploy/ scaffold removed?" >&2
  exit 1
fi

# ─── Step 1: Clean & scaffold ────────────────────────────────────────────
echo "→ Preparing $DEPLOY/build/"
BUILD="$DEPLOY/build"
rm -rf "$BUILD"
mkdir -p "$BUILD/app" "$BUILD/static" "$BUILD/examples"

# ─── Step 2: Build the Next.js frontend ──────────────────────────────────
if [[ $SKIP_FRONTEND -eq 1 ]]; then
  echo "→ Skipping frontend build (using existing $WEB/out)"
else
  echo "→ Building frontend (Next.js static export)"
  (cd "$ROOT" && NEXT_BUILD_STATIC=1 pnpm --filter @workflow-test/web build)
fi

if [[ ! -d "$WEB/out" ]]; then
  echo "ERR: $WEB/out not found — Next.js must have output: 'export' configured." >&2
  echo "     See docs/databricks-apps-deployment.md §4a." >&2
  exit 1
fi

# ─── Step 3: Assemble bundle ─────────────────────────────────────────────
echo "→ Copying FastAPI package → $BUILD/app/"
cp -R "$API/app/." "$BUILD/app/"

echo "→ Copying requirements.txt"
cp "$API/requirements.txt" "$BUILD/requirements.txt"

echo "→ Copying Next.js static export → $BUILD/static/"
cp -R "$WEB/out/." "$BUILD/static/"

echo "→ Copying examples (journeys + segments) → $BUILD/examples/"
cp -R "$EXAMPLES/." "$BUILD/examples/"

echo "→ Generating app.yaml from template"
sed "s/__APP_NAME__/$APP_NAME/g" "$DEPLOY/app.yaml.tmpl" > "$BUILD/app.yaml"

# ─── Step 4: Report bundle size ──────────────────────────────────────────
BUNDLE_SIZE=$(du -sh "$BUILD" | cut -f1)
FILE_COUNT=$(find "$BUILD" -type f | wc -l | tr -d ' ')
echo "✓ Bundle ready ($BUNDLE_SIZE, $FILE_COUNT files) at $BUILD"

# ─── Step 5: Deploy (unless --bundle-only) ───────────────────────────────
if [[ $BUNDLE_ONLY -eq 1 ]]; then
  echo
  echo "  Bundle-only mode. To deploy:"
  echo "    databricks apps deploy $APP_NAME --source-code-path \"$BUILD\""
  exit 0
fi

echo "→ Deploying to Databricks workspace as '$APP_NAME'"
databricks apps deploy "$APP_NAME" --source-code-path "$BUILD"

# ─── Step 6: Output app URL ──────────────────────────────────────────────
APP_URL=$(databricks apps get "$APP_NAME" --output json 2>/dev/null | \
  python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('url', ''))" 2>/dev/null || true)

cat <<EOF

✓ Deploy complete.
  App name:  $APP_NAME
  App URL:   ${APP_URL:-"(check 'databricks apps get $APP_NAME')"}

  Logs:      databricks apps logs $APP_NAME --follow
  Status:    databricks apps get  $APP_NAME
  Rollback:  databricks apps deployments list $APP_NAME
EOF
