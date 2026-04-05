#!/usr/bin/env bash
set -euo pipefail

LIMIT="${1:-20}"
REMOTE="${TEAM_OUTPUT_AUDIT_REMOTE:-${REMOTE:-}}"
REMOTE_FILE="${TEAM_OUTPUT_AUDIT_FILE:-/opt/napcat-bridge/logs/team-output-rerouted.jsonl}"

if [[ -z "$REMOTE" ]]; then
  echo "TEAM_OUTPUT_AUDIT_REMOTE is not set. Example: export TEAM_OUTPUT_AUDIT_REMOTE=root@node-b.internal" >&2
  exit 2
fi

ssh -o BatchMode=yes -o ConnectTimeout=5 "$REMOTE" "python3 - '$LIMIT' '$REMOTE_FILE' <<'PY'
import json, sys, pathlib
limit = int(sys.argv[1])
p = pathlib.Path(sys.argv[2])
if not p.exists():
    print('NO_AUDIT_FILE')
    raise SystemExit(0)
lines = [x for x in p.read_text().splitlines() if x.strip()]
for line in lines[-limit:]:
    try:
        o = json.loads(line)
    except Exception:
        print(line)
        continue
    print(json.dumps({
        'ts': o.get('ts',''),
        'commandId': o.get('commandId',''),
        'traceId': o.get('traceId',''),
        'teamId': o.get('teamId',''),
        'taskId': o.get('taskId',''),
        'outputRequestId': o.get('outputRequestId',''),
        'deliveryTarget': o.get('deliveryTarget',''),
        'scopeKey': o.get('scopeKey','')
    }, ensure_ascii=False))
PY"
