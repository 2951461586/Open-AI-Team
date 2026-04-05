#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  safe-evidence-search.sh <output-file> <regex> <search-root> [search-root...]

Example:
  safe-evidence-search.sh \
    /tmp/task-id-search.txt \
    'task:abc123|laoda webhook|team runtime' \
    ./task_workspaces \
    ../workspace-laoda

Behavior:
- Writes output atomically via a temp file, then renames into place.
- Excludes the output file itself and its parent output directory from scanning.
- Skips large/binary/cache/common log dirs to avoid evidence self-ingestion.
- Caps output lines/bytes so accidental full-disk growth cannot recur.
EOF
}

if [[ ${1:-} == "-h" || ${1:-} == "--help" || $# -lt 3 ]]; then
  usage
  exit 0
fi

OUT_FILE=$1
PATTERN=$2
shift 2
ROOTS=("$@")

OUT_DIR=$(cd "$(dirname "$OUT_FILE")" && pwd)
OUT_BASE=$(basename "$OUT_FILE")
TMP_FILE=$(mktemp "${OUT_FILE}.tmp.XXXXXX")
trap 'rm -f "$TMP_FILE"' EXIT

MAX_LINES=${MAX_LINES:-5000}
MAX_BYTES=${MAX_BYTES:-10485760}
MAX_FILE_BYTES=${MAX_FILE_BYTES:-2097152}

should_skip_dir() {
  case "$1" in
    */.git|*/node_modules|*/dist|*/build|*/coverage|*/.cache|*/Cache|*/Code\ Cache|*/GPUCache|*/Default|*/tmp|*/.tmp|*/artifacts/async-ingress-live-evidence|*/agents|*/sessions|*/subagents)
      return 0
      ;;
    "$OUT_DIR")
      return 0
      ;;
  esac
  return 1
}

should_skip_file() {
  local f="$1"
  [[ "$f" == "$OUT_FILE" ]] && return 0
  [[ "$(basename "$f")" == "$OUT_BASE" ]] && return 0
  case "$f" in
    *.sqlite|*.db|*.db-wal|*.db-shm|*.jpg|*.jpeg|*.png|*.gif|*.webp|*.zip|*.tar|*.gz|*.tgz|*.xz|*.so|*.o|*.pyc|*.pdf|*.woff|*.woff2|*.mp3|*.mp4|*.mov|*.avi|*.jsonl)
      return 0
      ;;
  esac
  local size
  size=$(stat -c %s "$f" 2>/dev/null || echo 0)
  (( size > MAX_FILE_BYTES )) && return 0
  return 1
}

line_count=0
byte_count=0
printf '== safe evidence search ==\n' > "$TMP_FILE"
printf 'pattern: %s\n' "$PATTERN" >> "$TMP_FILE"
printf 'roots: %s\n\n' "${ROOTS[*]}" >> "$TMP_FILE"

for root in "${ROOTS[@]}"; do
  [[ -e "$root" ]] || continue
  while IFS= read -r -d '' file; do
    if should_skip_file "$file"; then
      continue
    fi
    while IFS= read -r match; do
      printf '%s\n' "$match" >> "$TMP_FILE"
      line_count=$((line_count + 1))
      byte_count=$(stat -c %s "$TMP_FILE" 2>/dev/null || echo 0)
      if (( line_count >= MAX_LINES || byte_count >= MAX_BYTES )); then
        printf '\n[TRUNCATED] limit reached: lines=%s bytes=%s\n' "$line_count" "$byte_count" >> "$TMP_FILE"
        mv "$TMP_FILE" "$OUT_FILE"
        trap - EXIT
        exit 0
      fi
    done < <(grep -nEI "$PATTERN" "$file" 2>/dev/null | sed "s#^#$file:#")
  done < <(
    find "$root" \
      \( -type d \( -name .git -o -name node_modules -o -name dist -o -name build -o -name coverage -o -name .cache -o -name Cache -o -name 'Code Cache' -o -name GPUCache -o -name Default -o -name tmp -o -name .tmp -o -path "$OUT_DIR" -o -path '*/artifacts/async-ingress-live-evidence' -o -path '*/agents' -o -path '*/sessions' -o -path '*/subagents' \) -prune \) -o \
      -type f -print0 2>/dev/null
  )
done

mv "$TMP_FILE" "$OUT_FILE"
trap - EXIT
printf 'wrote %s\n' "$OUT_FILE"
