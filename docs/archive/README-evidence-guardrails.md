# Evidence Capture Guardrails

## Problem

Large evidence artifacts can explode in size when a search command:

- scans a root that contains its own output file,
- scans runtime logs that preserve full commands/results,
- appends matches back into the same artifact tree.

This causes **evidence self-ingestion** (self-referential growth), not genuine business data growth.

## Required guardrails

1. **Output outside scan root** when possible.
2. If output must live near artifacts, **explicitly exclude**:
   - the output file itself
   - the output directory
   - agent session logs
   - subagent run logs
   - cache / build / binary / db / jsonl directories
3. **Write atomically** via temp file then rename.
4. **Enforce caps**:
   - max single-file size scanned
   - max output lines
   - max output bytes
5. Prefer **targeted roots** over `/root` or other broad filesystem roots.

## Default helper

Use:

- `orchestrator/scripts/safe-evidence-search.sh`

instead of ad-hoc recursive `find | grep >> out.txt` or raw `os.walk()` dumps.

## Minimal example

```bash
bash orchestrator/scripts/safe-evidence-search.sh \
  /tmp/async-ingress-search.txt \
  'task:abc|node-a webhook|team runtime' \
  /root/.openclaw/workspace/orchestrator/task_workspaces \
  /root/.openclaw/workspace-sample
```

## Anti-patterns

Do **not** do this:

```bash
find /root/.openclaw /root -type f | while read -r f; do
  grep -nE 'pattern' "$f" >> "$OUT"
done
```

Do **not** do this either:

```python
out = open(OUT, 'w')
for dp, dns, fns in os.walk('/root/.openclaw'):
    ...
    out.write(...)
```

when `OUT` is inside the scanned tree and no exclusions/caps are applied.
