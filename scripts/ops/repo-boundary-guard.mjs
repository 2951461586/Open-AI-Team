#!/usr/bin/env node
import { execSync } from 'node:child_process';

function listTracked(prefix = '') {
  const safe = String(prefix || '').trim();
  if (!safe) return [];
  try {
    const out = execSync(`git ls-files -- '${safe}'`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return out ? out.split('\n').map((line) => line.trim()).filter(Boolean) : [];
  } catch {
    return [];
  }
}

const rules = [
  {
    key: 'appsDashboard',
    mode: 'allowlist',
    prefix: 'apps/dashboard',
    allow: ['apps/dashboard/README.md', 'apps/dashboard/package.json', 'apps/dashboard/src/index.mjs'],
    reason: 'dashboard authority remains repo-root `dashboard/`; app shell is secondary packaging-only surface.',
  },
  {
    key: 'appsCli',
    mode: 'allowlist',
    prefix: 'apps/cli',
    allow: ['apps/cli/README.md', 'apps/cli/package.json', 'apps/cli/src/index.mjs'],
    reason: 'placeholder CLI surface is retained as a retired secondary scaffold and must not grow into the public mainline without a real owner.',
  },
  {
    key: 'plugins',
    mode: 'deny',
    prefix: 'plugins',
    reason: 'plugin ecosystem is optional/private and must stay out of the public release surface.',
  },
  {
    key: 'services',
    mode: 'deny',
    prefix: 'services',
    reason: 'service sidecars are companion repos / local ops, not core public product surface.',
  },
  {
    key: 'projects',
    mode: 'deny',
    prefix: 'projects',
    reason: 'side projects are not part of the public mainline repository contract.',
  },
  {
    key: 'shared',
    mode: 'deny',
    prefix: 'shared',
    reason: 'shared runtime/artifact surface is local/generated and must not enter the release boundary.',
  },
];

const failures = [];
for (const rule of rules) {
  const tracked = listTracked(rule.prefix);
  if (!tracked.length) continue;
  if (rule.mode === 'allowlist') {
    const allow = new Set(rule.allow || []);
    const blocked = tracked.filter((item) => !allow.has(item));
    if (blocked.length) failures.push({ ...rule, blocked });
    continue;
  }
  failures.push({ ...rule, blocked: tracked });
}

const ok = failures.length === 0;
const summary = {
  ok,
  checkedRules: rules.length,
  failedRules: failures.length,
  blockedPathCount: failures.reduce((sum, item) => sum + item.blocked.length, 0),
  boundary: 'repo-boundary-guard.v1',
};

console.log(JSON.stringify({ ok, summary, failures }, null, 2));
if (!ok) process.exit(1);
