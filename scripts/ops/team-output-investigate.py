#!/usr/bin/env python3
import argparse
import json
import os
import sqlite3
import subprocess
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[2]
DB_PATH = str(Path(REPO_ROOT, 'state', 'team-runtime.db'))
DEFAULT_REMOTE = os.environ.get('TEAM_OUTPUT_AUDIT_REMOTE', '')
DEFAULT_REMOTE_AUDIT_FILE = os.environ.get('TEAM_OUTPUT_AUDIT_FILE', '/opt/napcat-bridge/logs/team-output-rerouted.jsonl')
REMOTE_LABEL = os.environ.get('TEAM_OUTPUT_AUDIT_NODE', 'node-b')
SSH_OPTS = ['-o', 'BatchMode=yes', '-o', 'ConnectTimeout=5']


def parse_args():
    p = argparse.ArgumentParser(description='Investigate team output reroute / delivery chain by traceId or commandId')
    p.add_argument('--trace-id', default='', help='traceId to investigate')
    p.add_argument('--command-id', default='', help='commandId to investigate')
    p.add_argument('--limit', type=int, default=50, help='max rows per local section')
    p.add_argument('--remote', default=DEFAULT_REMOTE, help='ssh target for remote rerouted audit lookup (default: TEAM_OUTPUT_AUDIT_REMOTE)')
    p.add_argument('--remote-file', default=DEFAULT_REMOTE_AUDIT_FILE, help='remote rerouted audit file path')
    args = p.parse_args()
    if not str(args.trace_id).strip() and not str(args.command_id).strip():
        p.error('at least one of --trace-id or --command-id is required')
    args.limit = max(1, min(200, int(args.limit or 50)))
    return args


def run_remote_rerouted_lookup(trace_id: str, command_id: str, limit: int, remote: str, remote_audit_file: str) -> dict[str, Any]:
    if not str(remote or '').strip():
        return {
            'ok': False,
            'auditFilePresent': False,
            'items': [],
            'error': 'remote_not_configured',
            'detail': 'Set TEAM_OUTPUT_AUDIT_REMOTE or pass --remote to enable remote rerouted lookup.',
        }
    trace_arg = str(trace_id or '').strip() or '__EMPTY_TRACE_ID__'
    command_arg = str(command_id or '').strip() or '__EMPTY_COMMAND_ID__'
    remote_py = r'''
import json, pathlib, sys
trace_id = '' if sys.argv[1] == '__EMPTY_TRACE_ID__' else sys.argv[1]
command_id = '' if sys.argv[2] == '__EMPTY_COMMAND_ID__' else sys.argv[2]
limit = max(1, min(200, int(sys.argv[3] or '50')))
p = pathlib.Path(sys.argv[4])
out = {'ok': True, 'auditFilePresent': p.exists(), 'items': []}
if not p.exists():
    print(json.dumps(out, ensure_ascii=False))
    raise SystemExit(0)
items = []
for line in p.read_text().splitlines():
    line = line.strip()
    if not line:
        continue
    try:
        obj = json.loads(line)
    except Exception:
        continue
    if trace_id and str(obj.get('traceId', '')) == trace_id:
        items.append(obj)
        continue
    if command_id and str(obj.get('commandId', '')) == command_id:
        items.append(obj)
out['items'] = items[-limit:]
print(json.dumps(out, ensure_ascii=False))
'''
    proc = subprocess.run(
        ['ssh', *SSH_OPTS, remote, 'python3', '-', trace_arg, command_arg, str(limit), remote_audit_file],
        input=remote_py,
        text=True,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        return {
            'ok': False,
            'auditFilePresent': False,
            'items': [],
            'error': 'ssh_failed',
            'detail': (proc.stderr or proc.stdout or '').strip(),
        }
    try:
        data = json.loads(proc.stdout.strip() or '{}')
        data.setdefault('ok', True)
        data.setdefault('auditFilePresent', False)
        data.setdefault('items', [])
        return data
    except Exception as e:
        return {
            'ok': False,
            'auditFilePresent': False,
            'items': [],
            'error': 'remote_parse_failed',
            'detail': str(e),
            'stdout': proc.stdout.strip(),
        }


def load_rows(conn: sqlite3.Connection, sql: str, params: list[Any] | tuple[Any, ...] = ()) -> list[dict[str, Any]]:
    cur = conn.execute(sql, params)
    cols = [x[0] for x in cur.description]
    out = []
    for row in cur.fetchall():
        out.append({cols[i]: row[i] for i in range(len(cols))})
    return out


def shorten(value: Any, max_chars: int = 500) -> str:
    s = value if isinstance(value, str) else json.dumps(value, ensure_ascii=False)
    s = str(s)
    return s if len(s) <= max_chars else s[:max_chars] + '…'


def term_match_list(text: str, terms: list[tuple[str, str]]) -> list[str]:
    s = str(text or '')
    out = []
    for label, val in terms:
        if val and val in s:
            out.append(f'{label}:{val}')
    return out


def unique_non_empty(values):
    seen = set()
    out = []
    for v in values:
        s = str(v or '').strip()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def search_mailbox(conn, *, team_ids, task_ids, payload_terms, limit):
    rows = []
    seen = set()

    def add(query, params):
        for row in load_rows(conn, query, params):
            mid = str(row.get('message_id') or '')
            if not mid or mid in seen:
                continue
            seen.add(mid)
            rows.append(row)

    if team_ids:
        ph = ','.join(['?'] * len(team_ids))
        add(f"select message_id, team_id, task_id, kind, status, created_at, delivered_at, payload_json from team_mailbox where team_id in ({ph}) order by created_at desc limit ?", [*team_ids, limit])
    if task_ids:
        ph = ','.join(['?'] * len(task_ids))
        add(f"select message_id, team_id, task_id, kind, status, created_at, delivered_at, payload_json from team_mailbox where task_id in ({ph}) order by created_at desc limit ?", [*task_ids, limit])
    for _, val in payload_terms:
        add("select message_id, team_id, task_id, kind, status, created_at, delivered_at, payload_json from team_mailbox where payload_json like ? order by created_at desc limit ?", [f'%{val}%', limit])

    rows.sort(key=lambda x: (int(x.get('created_at') or 0), str(x.get('message_id') or '')), reverse=True)
    out = []
    for row in rows[:limit]:
        matched = []
        if str(row.get('team_id') or '') in team_ids:
            matched.append(f"teamId:{row.get('team_id')}")
        if str(row.get('task_id') or '') in task_ids:
            matched.append(f"taskId:{row.get('task_id')}")
        matched.extend(term_match_list(row.get('payload_json') or '', payload_terms))
        out.append({
            'messageId': row.get('message_id'),
            'teamId': row.get('team_id'),
            'taskId': row.get('task_id'),
            'kind': row.get('kind'),
            'status': row.get('status'),
            'createdAt': row.get('created_at'),
            'deliveredAt': row.get('delivered_at'),
            'matchedBy': unique_non_empty(matched),
            'payloadSnippet': shorten(row.get('payload_json') or ''),
        })
    return out


def search_blackboard(conn, *, team_ids, task_ids, payload_terms, output_request_ids, limit):
    rows = []
    seen = set()

    def add(query, params):
        for row in load_rows(conn, query, params):
            eid = str(row.get('entry_id') or '')
            if not eid or eid in seen:
                continue
            seen.add(eid)
            rows.append(row)

    if team_ids:
        ph = ','.join(['?'] * len(team_ids))
        add(f"select entry_id, team_id, task_id, section, entry_key, updated_at, value_json from team_blackboard where team_id in ({ph}) order by updated_at desc limit ?", [*team_ids, limit])
    if task_ids:
        ph = ','.join(['?'] * len(task_ids))
        add(f"select entry_id, team_id, task_id, section, entry_key, updated_at, value_json from team_blackboard where task_id in ({ph}) order by updated_at desc limit ?", [*task_ids, limit])
    for _, val in payload_terms:
        add("select entry_id, team_id, task_id, section, entry_key, updated_at, value_json from team_blackboard where value_json like ? order by updated_at desc limit ?", [f'%{val}%', limit])
    for oid in output_request_ids:
        add("select entry_id, team_id, task_id, section, entry_key, updated_at, value_json from team_blackboard where entry_key like ? order by updated_at desc limit ?", [f'%{oid}%', limit])

    rows.sort(key=lambda x: (int(x.get('updated_at') or 0), str(x.get('entry_id') or '')), reverse=True)
    out = []
    for row in rows[:limit]:
        matched = []
        if str(row.get('team_id') or '') in team_ids:
            matched.append(f"teamId:{row.get('team_id')}")
        if str(row.get('task_id') or '') in task_ids:
            matched.append(f"taskId:{row.get('task_id')}")
        if any(oid and oid in str(row.get('entry_key') or '') for oid in output_request_ids):
            for oid in output_request_ids:
                if oid and oid in str(row.get('entry_key') or ''):
                    matched.append(f'outputRequestId:{oid}')
        matched.extend(term_match_list(row.get('value_json') or '', payload_terms))
        out.append({
            'entryId': row.get('entry_id'),
            'teamId': row.get('team_id'),
            'taskId': row.get('task_id'),
            'section': row.get('section'),
            'entryKey': row.get('entry_key'),
            'updatedAt': row.get('updated_at'),
            'matchedBy': unique_non_empty(matched),
            'valueSnippet': shorten(row.get('value_json') or ''),
        })
    return out


def fetch_tasks(conn, task_ids):
    if not task_ids:
        return []
    ph = ','.join(['?'] * len(task_ids))
    rows = load_rows(conn, f"select task_id, team_id, title, state, priority, updated_at, metadata_json from team_tasks where task_id in ({ph}) order by updated_at desc", task_ids)
    return [{
        'taskId': r['task_id'],
        'teamId': r['team_id'],
        'title': r['title'],
        'state': r['state'],
        'priority': r['priority'],
        'updatedAt': r['updated_at'],
        'metadataSnippet': shorten(r.get('metadata_json') or '', 240),
    } for r in rows]


def fetch_teams(conn, team_ids):
    if not team_ids:
        return []
    ph = ','.join(['?'] * len(team_ids))
    rows = load_rows(conn, f"select team_id, scope_key, mode, status, updated_at, metadata_json from teams where team_id in ({ph}) order by updated_at desc", team_ids)
    return [{
        'teamId': r['team_id'],
        'scopeKey': r['scope_key'],
        'mode': r['mode'],
        'status': r['status'],
        'updatedAt': r['updated_at'],
        'metadataSnippet': shorten(r.get('metadata_json') or '', 240),
    } for r in rows]


def build_guidance(query, remote, mailbox_hits, blackboard_hits, tasks, teams):
    observations = []
    if remote.get('items'):
        observations.append(f'命中 remote rerouted 审计（默认归类为 {REMOTE_LABEL} compat lane），说明这条链至少经过远端兼容输出面。')
    elif remote.get('error') == 'remote_not_configured':
        observations.append('未配置 remote rerouted 审计查询目标；当前只完成本地 team-runtime 侧排查。')
    else:
        observations.append('未命中 remote rerouted 审计；若问题仍存在，更像主链内正常 output 路径或尚未落盘的旧事件。')

    if mailbox_hits or blackboard_hits:
        observations.append('本地 team-runtime 已找到关联记录，可以继续沿 taskId / teamId / outputRequestId 做闭环反查。')
    else:
        observations.append('本地 team-runtime 未找到明显关联记录，优先排查主链外脚本、手工调用、历史残留进程。')

    next_lookup = None
    if query.get('traceId'):
        next_lookup = {'dimension': 'traceId', 'value': query['traceId']}
    elif query.get('commandId'):
        next_lookup = {'dimension': 'commandId', 'value': query['commandId']}

    checks = []
    if next_lookup:
        checks.append(f"先按 {next_lookup['dimension']}={next_lookup['value']} 对照 rerouted 审计与 output 相关记录。")
    if tasks:
        checks.append('已拿到 taskId，下一步优先看同 task 的 output.request / output.command.emitted / output.delivered 链路。')
    if teams:
        checks.append('已拿到 teamId / scopeKey，可继续看该 team 最近 mailbox / blackboard 是否出现重复模式。')
    if remote.get('items') and not (mailbox_hits or blackboard_hits):
        checks.append('有 remote rerouted 命中但无本地命中，更像 bridge 外部误投；优先排查历史脚本和手工请求来源。')

    return {
        'nextBestLookup': next_lookup,
        'observations': observations,
        'recommendedChecks': checks,
    }


def main():
    args = parse_args()
    query = {
        'traceId': str(args.trace_id or '').strip(),
        'commandId': str(args.command_id or '').strip(),
    }

    remote = run_remote_rerouted_lookup(query['traceId'], query['commandId'], args.limit, args.remote, args.remote_file)
    remote_items = remote.get('items') or []

    seed_trace_ids = unique_non_empty([query['traceId'], *[x.get('traceId') for x in remote_items]])
    seed_command_ids = unique_non_empty([query['commandId'], *[x.get('commandId') for x in remote_items]])
    seed_team_ids = unique_non_empty([x.get('teamId') for x in remote_items])
    seed_task_ids = unique_non_empty([x.get('taskId') for x in remote_items])
    seed_output_request_ids = unique_non_empty([x.get('outputRequestId') for x in remote_items])
    payload_terms = [(k, v) for k, vals in {
        'traceId': seed_trace_ids,
        'commandId': seed_command_ids,
        'outputRequestId': seed_output_request_ids,
    }.items() for v in vals]

    conn = sqlite3.connect(DB_PATH)
    try:
        mailbox_hits = search_mailbox(conn, team_ids=seed_team_ids, task_ids=seed_task_ids, payload_terms=payload_terms, limit=args.limit)
        blackboard_hits = search_blackboard(conn, team_ids=seed_team_ids, task_ids=seed_task_ids, payload_terms=payload_terms, output_request_ids=seed_output_request_ids, limit=args.limit)

        derived_task_ids = unique_non_empty([*seed_task_ids, *[x.get('taskId') for x in mailbox_hits], *[x.get('taskId') for x in blackboard_hits]])
        derived_team_ids = unique_non_empty([*seed_team_ids, *[x.get('teamId') for x in mailbox_hits], *[x.get('teamId') for x in blackboard_hits]])

        tasks = fetch_tasks(conn, derived_task_ids)
        teams = fetch_teams(conn, derived_team_ids)
    finally:
        conn.close()

    summary = {
        'remoteReroutedHitCount': len(remote_items),
        'mailboxHitCount': len(mailbox_hits),
        'blackboardHitCount': len(blackboard_hits),
        'taskCount': len(tasks),
        'teamCount': len(teams),
        'seedTraceIds': seed_trace_ids,
        'seedCommandIds': seed_command_ids,
        'seedTaskIds': derived_task_ids,
        'seedTeamIds': derived_team_ids,
        'seedOutputRequestIds': seed_output_request_ids,
    }

    out = {
        'ok': True,
        'query': query,
        'summary': summary,
        'remoteRerouted': {
            'label': REMOTE_LABEL,
            'remote': args.remote,
            'remoteFile': args.remote_file,
            'ok': remote.get('ok', False),
            'auditFilePresent': remote.get('auditFilePresent', False),
            'items': remote_items,
            'error': remote.get('error', ''),
            'detail': remote.get('detail', ''),
        },
        'localRuntime': {
            'mailboxHits': mailbox_hits,
            'blackboardHits': blackboard_hits,
            'tasks': tasks,
            'teams': teams,
        },
        'guidance': build_guidance(query, remote, mailbox_hits, blackboard_hits, tasks, teams),
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except BrokenPipeError:
        pass
    except Exception as e:
        print(json.dumps({'ok': False, 'error': str(e)}, ensure_ascii=False))
        sys.exit(1)
