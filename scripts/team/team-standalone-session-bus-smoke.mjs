import path from 'node:path';
import { createAppContext } from '../../src/index-bootstrap.mjs';

const REPO_ROOT = path.resolve(new URL('../../', import.meta.url).pathname);
const WORKSPACE_ROOT = path.resolve(REPO_ROOT, '..');
const RUN_DIR = path.join(REPO_ROOT, 'run');

function assert(condition, label, details = '') {
  if (!condition) throw new Error(`${label}${details ? ` :: ${details}` : ''}`);
  console.log(`✅ ${label}${details ? ` — ${details}` : ''}`);
}

const ctx = await createAppContext({
  root: WORKSPACE_ROOT,
  ENV: {},
  sessionSubstrate: 'standalone-broker',
  TEAM_DB_PATH: path.join(RUN_DIR, 'team-standalone-session-bus-smoke.sqlite'),
});

assert(ctx.sessionSubstrateProvider === 'standalone-broker-productized', 'standalone substrate is active');
assert(ctx.runtimeAdapter?.kind === 'session_runtime_adapter', 'runtime adapter is present');
assert(ctx.executionAdapter?.kind === 'execution_adapter', 'execution adapter is present');

const delegated = await ctx.executionAdapter.spawnForRole({
  role: 'executor',
  task: '输出一条简短的 standalone session-bus probe 结果。',
  objective: '生成一个可用于续聊与历史查询的 child session',
  acceptance: '返回结构化 summary',
  deliverables: ['summary.md'],
});

assert(delegated?.ok === true, 'delegated run succeeded');
const childSessionKey = String(delegated?.childSessionKey || delegated?.sessionKey || '');
assert(childSessionKey, 'child session key exists', childSessionKey);

const send = await ctx.runtimeAdapter.sendToSession({
  sessionKey: childSessionKey,
  role: 'user',
  text: '继续补一句：把结论压成一句中文。',
  payload: {
    channel: 'session-bus',
    source: 'team-standalone-session-bus-smoke',
  },
});
assert(send?.ok === true, 'runtime adapter can send to standalone session bus');

const listed = await ctx.runtimeAdapter.listSessionsForSession({ limit: 20 });
assert(listed?.ok === true, 'runtime adapter can list standalone sessions');
assert(Array.isArray(listed?.sessions) && listed.sessions.some((item) => String(item?.sessionKey || item?.childSessionKey || '') === childSessionKey), 'listed sessions include delegated child session');

const history = await ctx.runtimeAdapter.getSessionHistory({ sessionKey: childSessionKey, limit: 20 });
assert(history?.ok === true, 'runtime adapter can read standalone session history');
assert(Array.isArray(history?.messages) && history.messages.some((item) => String(item?.text || item?.content || '').includes('继续补一句')), 'history includes appended follow-up message');

const run = await ctx.agentHarness.runTask('验证 standalone broker product runtime 的 session bus、history、desk recovery 证据已齐备。');
assert(run?.ok === true, 'standalone product runtime run completed');
assert(run?.hostLayer?.sessionBusReady === true, 'host-layer session bus remains ready');
assert(run?.desk?.enabled === true, 'desk remains enabled');

console.log(JSON.stringify({
  ok: true,
  summary: {
    ok: true,
    substrate: ctx.sessionSubstrateProvider,
    childSessionKey,
    listedSessionCount: Array.isArray(listed?.sessions) ? listed.sessions.length : 0,
    historyCount: Array.isArray(history?.messages) ? history.messages.length : 0,
    hostLayerReady: run?.summary?.hostLayerReady === true,
    deskEnabled: run?.desk?.enabled === true,
  },
}, null, 2));
