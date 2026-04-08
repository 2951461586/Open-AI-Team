#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
DASHBOARD_DIR="$ROOT_DIR/dashboard"
DEFAULT_ENV_ID="opencloud-8g9e4db2eaac0c79"
LOCAL_STATIC_DIR="${LOCAL_STATIC_DIR:-}"
LOCAL_STATIC_DIR="${LOCAL_STATIC_DIR%/}"
CREDENTIALS_FILE="${TENCENT_CREDENTIALS_FILE:-}"

if [[ -f "$CREDENTIALS_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CREDENTIALS_FILE"
fi

ENV_ID="${TCB_ENV_ID:-${ENV_ID:-$DEFAULT_ENV_ID}}"
AUTO_LOGIN="${TCB_AUTO_LOGIN:-0}"
SKIP_BUILD="${SKIP_BUILD:-0}"
TCB_SECRET_ID="${TCB_SECRET_ID:-${TENCENT_SECRET_ID:-}}"
TCB_SECRET_KEY="${TCB_SECRET_KEY:-${TENCENT_SECRET_KEY:-}}"
ORCH_OVERRIDE_FILE="${ORCH_OVERRIDE_FILE:-}"
NEXT_PUBLIC_API_BASE="${NEXT_PUBLIC_API_BASE:-}"
NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_WS_URL:-}"
NEXT_PUBLIC_DASHBOARD_TOKEN="${NEXT_PUBLIC_DASHBOARD_TOKEN:-${DASHBOARD_TOKEN:-}}"

: "${NEXT_PUBLIC_API_BASE:?NEXT_PUBLIC_API_BASE is required}"
: "${NEXT_PUBLIC_WS_URL:?NEXT_PUBLIC_WS_URL is required}"

if [[ -z "$NEXT_PUBLIC_DASHBOARD_TOKEN" && -f "$ORCH_OVERRIDE_FILE" ]]; then
  NEXT_PUBLIC_DASHBOARD_TOKEN="$(python3 - "$ORCH_OVERRIDE_FILE" <<'PY'
import re, sys
path = sys.argv[1]
text = open(path, 'r', encoding='utf-8', errors='ignore').read()
m = re.search(r'^Environment=DASHBOARD_TOKEN=(.+)$', text, re.M)
print(m.group(1).strip() if m else '')
PY
)"
fi

export NEXT_PUBLIC_API_BASE
export NEXT_PUBLIC_WS_URL
if [[ -n "$NEXT_PUBLIC_DASHBOARD_TOKEN" ]]; then
  export NEXT_PUBLIC_DASHBOARD_TOKEN
fi

if ! command -v tcb >/dev/null 2>&1; then
  echo "[deploy] missing tcb CLI. Install with: npm i -g @cloudbase/cli"
  exit 1
fi

if [[ "$AUTO_LOGIN" == "1" ]]; then
  : "${TCB_SECRET_ID:?TCB_SECRET_ID is required when TCB_AUTO_LOGIN=1}"
  : "${TCB_SECRET_KEY:?TCB_SECRET_KEY is required when TCB_AUTO_LOGIN=1}"
  echo "[deploy] logging in to CloudBase with API key"
  tcb login --apiKeyId "$TCB_SECRET_ID" --apiKey "$TCB_SECRET_KEY" -k
fi

if [[ -z "$ENV_ID" ]]; then
  echo "[deploy] missing TCB_ENV_ID"
  echo "[deploy] see docs/tencent-cloud-credentials-standard.md"
  exit 1
fi

cd "$DASHBOARD_DIR"

TEMP_ENV_BACKUP="$(mktemp)"
TEMP_ENV_LOCAL_BACKUP="$(mktemp)"
cleanup() {
  if [[ -f "$TEMP_ENV_BACKUP" ]]; then
    cp "$TEMP_ENV_BACKUP" .env.production
    rm -f "$TEMP_ENV_BACKUP"
  fi
  if [[ -f "$TEMP_ENV_LOCAL_BACKUP" ]]; then
    if [[ -s "$TEMP_ENV_LOCAL_BACKUP" ]]; then
      cp "$TEMP_ENV_LOCAL_BACKUP" .env.local
    else
      rm -f .env.local
    fi
    rm -f "$TEMP_ENV_LOCAL_BACKUP"
  fi
}
trap cleanup EXIT

if [[ -f .env.production ]]; then
  cp .env.production "$TEMP_ENV_BACKUP"
else
  : > "$TEMP_ENV_BACKUP"
fi

if [[ -f .env.local ]]; then
  cp .env.local "$TEMP_ENV_LOCAL_BACKUP"
else
  : > "$TEMP_ENV_LOCAL_BACKUP"
fi

rm -f .env.local

python3 - <<'PY'
from pathlib import Path
import os
p = Path('.env.production')
lines = p.read_text(encoding='utf-8').splitlines() if p.exists() else []
updates = {
    'NEXT_PUBLIC_API_BASE': os.environ.get('NEXT_PUBLIC_API_BASE', ''),
    'NEXT_PUBLIC_WS_URL': os.environ.get('NEXT_PUBLIC_WS_URL', ''),
    'NEXT_PUBLIC_WORKSPACE': os.environ.get('NEXT_PUBLIC_WORKSPACE', 'main'),
    'NEXT_PUBLIC_ENABLE_REALTIME': os.environ.get('NEXT_PUBLIC_ENABLE_REALTIME', '1'),
}
token = os.environ.get('NEXT_PUBLIC_DASHBOARD_TOKEN', '')
if token:
    updates['NEXT_PUBLIC_DASHBOARD_TOKEN'] = token
new = []
seen = set()
for line in lines:
    replaced = False
    for key, value in updates.items():
        prefix = key + '='
        if line.startswith(prefix):
            new.append(prefix + value)
            seen.add(key)
            replaced = True
            break
    if not replaced:
        new.append(line)
for key, value in updates.items():
    if key not in seen:
        if new and new[-1] != '':
            new.append('')
        new.append(f'{key}={value}')
p.write_text('\n'.join(new) + '\n', encoding='utf-8')
PY

if [[ "$SKIP_BUILD" != "1" ]]; then
  echo "[deploy] npm ci"
  npm ci
  echo "[deploy] npm run build"
  npm run build
else
  echo "[deploy] skip build enabled"
fi

if [[ ! -d out ]]; then
  echo "[deploy] build output ./out not found"
  exit 1
fi

if [[ -n "$LOCAL_STATIC_DIR" ]]; then
  echo "[deploy] syncing static export to $LOCAL_STATIC_DIR"
  install -d -m 755 "$LOCAL_STATIC_DIR"
  rsync -a --delete out/ "$LOCAL_STATIC_DIR"/
else
  echo "[deploy] LOCAL_STATIC_DIR not set; skip local static sync"
fi

tcb hosting deploy out -e "$ENV_ID"

echo "[deploy] done"
