#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DASHBOARD_DIR="$ROOT_DIR/dashboard"

fail() {
  echo "[deploy-authority] $*" >&2
  exit 1
}

[[ -d "$DASHBOARD_DIR" ]] || fail "missing dashboard/ source tree"
[[ -f "$DASHBOARD_DIR/package.json" ]] || fail "missing dashboard/package.json — refuse artifact-only deploy"
[[ -d "$DASHBOARD_DIR/src" ]] || fail "missing dashboard/src — refuse artifact-only deploy"
[[ -f "$DASHBOARD_DIR/src/app/page.tsx" || -f "$DASHBOARD_DIR/src/app/page.jsx" ]] || fail "missing dashboard app entry — refuse artifact-only deploy"

cd "$DASHBOARD_DIR"

echo "[deploy-authority] source authority verified"
echo "[deploy-authority] running fresh build from dashboard source"
npm ci
npm run build

if npm run | grep -q 'scan:bundle'; then
  npm run scan:bundle
fi

echo "[deploy-authority] fresh source build complete"
echo "[deploy-authority] publish ./out with your host-specific deployment step"
