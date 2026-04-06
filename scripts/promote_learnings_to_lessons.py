#!/usr/bin/env python3
from pathlib import Path
import re

root = Path('/root/.openclaw/workspace')
learnings = root / '.learnings' / 'LEARNINGS.md'
errors = root / '.learnings' / 'ERRORS.md'
out = root / 'memory' / 'playbooks' / 'lessons.md'
out.parent.mkdir(parents=True, exist_ok=True)

items = []
for src in (learnings, errors):
    if not src.exists():
        continue
    text = src.read_text(encoding='utf-8')
    for m in re.finditer(r"## \[(.*?)\].*?### Summary\n(.*?)\n\n### Details\n(.*?)(?:\n\n### Suggested Action\n(.*?))?(?:\n\n### Metadata|\Z)", text, re.S):
        ident, summary, details, action = m.groups()
        items.append((ident.strip(), summary.strip(), (action or '').strip(), details.strip()))

lines = ['# Lessons', '', '## Auto-promoted notes', '']
seen = set()
for ident, summary, action, details in items[-20:]:
    key = summary
    if key in seen:
        continue
    seen.add(key)
    lines.append(f'### {summary}')
    if action:
        lines.append(f'- Action: {action}')
    else:
        lines.append(f'- Note: {details.splitlines()[0]}')
    lines.append(f'- Source: {ident}')
    lines.append('')

out.write_text('\n'.join(lines).rstrip() + '\n', encoding='utf-8')
print(str(out))
