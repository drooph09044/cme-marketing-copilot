#!/usr/bin/env bash
# bundle.sh — zip the repo into a portable archive, skipping build artifacts,
# virtualenvs, and anything else covered by .gitignore.
#
# Usage:
#   ./bundle.sh                  # output to dist/orchestrate-YYYYMMDD-HHMMSS.zip
#   ./bundle.sh my-name          # output to dist/my-name.zip
#   ./bundle.sh --git            # use `git ls-files` (only tracked + untracked-not-ignored)
#
# Requires: zip (preinstalled on macOS, `sudo apt-get install zip` on Debian/Ubuntu).

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")"; pwd)"
cd "$ROOT"

# ─── Resolve output path ─────────────────────────────────────────────────
USE_GIT=0
NAME=""
for arg in "$@"; do
  case "$arg" in
    --git)  USE_GIT=1 ;;
    -h|--help)
      sed -n '2,11p' "$0"
      exit 0
      ;;
    *) NAME="$arg" ;;
  esac
done

TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
NAME="${NAME:-orchestrate-${TIMESTAMP}}"
OUT_DIR="$ROOT/dist"
OUT_FILE="$OUT_DIR/${NAME}.zip"

mkdir -p "$OUT_DIR"

# ─── Sanity checks ───────────────────────────────────────────────────────
if ! command -v zip >/dev/null 2>&1; then
  echo "ERR: 'zip' is not installed. Install with:" >&2
  echo "       macOS:  brew install zip   (usually preinstalled)" >&2
  echo "       Linux:  sudo apt-get install zip" >&2
  exit 1
fi

# Wipe any pre-existing archive of the same name so we don't append.
rm -f "$OUT_FILE"

# ─── Bundle ──────────────────────────────────────────────────────────────
if [[ $USE_GIT -eq 1 ]]; then
  if [[ ! -d .git ]]; then
    echo "ERR: --git requested but this isn't a git repo." >&2
    exit 1
  fi
  echo "→ Bundling tracked + untracked-not-ignored files via git…"
  # -o : show others (untracked); --exclude-standard : honour .gitignore + global
  git ls-files -co --exclude-standard | zip "$OUT_FILE" -@ -q
else
  echo "→ Bundling all files except build artifacts and ignored paths…"
  # Patterns mirror the .gitignore set so the output matches what a fresh clone
  # would produce after a clean install. -r recursive, -x excludes.
  zip -r "$OUT_FILE" . -q \
    -x "*.git/*" \
       ".git/*" \
       "*/node_modules/*" "node_modules/*" \
       "*/.pnpm-store/*" ".pnpm-store/*" \
       "*/.next/*" ".next/*" \
       "*/out/*" "apps/web/out/*" \
       "*/.vercel/*" ".vercel/*" \
       "*/.turbo/*" ".turbo/*" \
       "*/dist/*" "dist/*" \
       "*/build/*" \
       "*/__pycache__/*" "__pycache__/*" \
       "*.pyc" "*.pyo" "*.pyd" \
       "*/.venv/*" ".venv/*" \
       "*/venv/*" "venv/*" \
       "*/.pytest_cache/*" ".pytest_cache/*" \
       "*/.mypy_cache/*" ".mypy_cache/*" \
       "*/.ruff_cache/*" ".ruff_cache/*" \
       "*.egg-info/*" "*.egg-info" \
       "*/coverage/*" "coverage/*" \
       "*/.nyc_output/*" ".nyc_output/*" \
       "*/playwright-report/*" "*/test-results/*" \
       "*.log" "*.tsbuildinfo" \
       ".env" ".env.local" ".env.*.local" \
       "apps/*/.env" "apps/*/.env.local" "apps/*/.env.*.local" \
       "*.bak" "*.tmp" "*.swp" "*.swo" "*.pid" \
       ".DS_Store" "**/.DS_Store" \
       "Thumbs.db" "Desktop.ini" \
       ".idea/*" ".vscode/*" ".fleet/*" ".zed/*" \
       ".claude/settings.local.json" \
       ".cursor/*" ".cline/*" ".aider*" ".continue/*"
fi

# ─── Summary ─────────────────────────────────────────────────────────────
SIZE_BYTES=$(stat -f%z "$OUT_FILE" 2>/dev/null || stat -c%s "$OUT_FILE")
SIZE_HUMAN=$(du -h "$OUT_FILE" | cut -f1)
COUNT=$(unzip -Z1 "$OUT_FILE" | wc -l | tr -d ' ')

cat <<EOF

✓ Created $OUT_FILE
  Size:   $SIZE_HUMAN ($SIZE_BYTES bytes)
  Files:  $COUNT

  Inspect:  unzip -l "$OUT_FILE" | less
  Extract:  unzip "$OUT_FILE" -d <target>
EOF
