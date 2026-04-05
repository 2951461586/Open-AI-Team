import { tryHandleTeamResidentRoute } from '../../src/routes/team-route-resident.mjs';
import { tryHandleHealthStateRoute } from '../../src/routes/index-routes-health-state.mjs';
import { createAgentLifecycleManager } from '../../src/team/team-agent-lifecycle.mjs';

let passed = 0;
let failed = 0;
function assert(condition, label, detail = '') {
  if (condition) {
    console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
    passed += 1;
  } else {
    console.error(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
    failed += 1;
  }
}

let nowCursor = 1_700_000_000_000;
const now = () => nowCursor;
const agentLifecycle = createAgentLifecycleManager({
  defaultLeaseDurationMs: 1000,
  heartbeatGracePeriodMs: 200,
  now,
});

function sendJson(res, code, body) {
  res.statusCode = code;
  res.body = body;
}

function handleJsonBody(req, res, fn) {
  Promise.resolve(fn(req.__body || {}))
    .then((out) => sendJson(res, out?.ok === false ? 400 : 200, out))
    .catch((err) => sendJson(res, 400, { ok: false, error: String(err?.message || err) }));
}

const baseCtx = {
  isOrchAuthorized: () => true,
  isDashboardAuthorized: () => true,
  sendJson,
  handleJsonBody,
  agentLifecycle,
  teamStore: {
    listTeamsByScope: () => [],
  },
  TEAM_ROLE_DEPLOYMENT: null,
  teamNodeHealth: null,
  teamResidentRuntime: null,
  PORT: 0,
  TEAM_JUDGE_TRUE_EXECUTION: false,
  JUDGE_TRUE_EXECUTION_WIRED: false,
};

async function invokeResidentRoute(method, url, body = {}) {
  const req = { method, url, __body: body };
  const res = {};
  const handled = tryHandleTeamResidentRoute(req, res, baseCtx);
  await Promise.resolve();
  return { handled, statusCode: res.statusCode, body: res.body };
}

function invokeStateRoute(url) {
  const req = { method: 'GET', url };
  const res = {};
  const handled = tryHandleHealthStateRoute(req, res, baseCtx);
  return { handled, statusCode: res.statusCode, body: res.body };
}

const reg = await invokeResidentRoute('POST', '/internal/team/agent/register', {
  agentId: 'agent:route:1',
  role: 'executor',
  node: 'violet',
  capabilities: ['execute'],
});
assert(reg.handled === true, 'register route handled');
assert(reg.statusCode === 200 && reg.body?.ok, 'register route ok');
assert(reg.body?.agent?.agentId === 'agent:route:1', 'register route returns agent');

const hb = await invokeResidentRoute('POST', '/internal/team/agent/heartbeat', {
  agentId: 'agent:route:1',
  currentTaskCount: 3,
  status: 'active',
});
assert(hb.statusCode === 200 && hb.body?.ok, 'heartbeat route ok');
assert(hb.body?.agent?.currentTaskCount === 3, 'heartbeat route updates task count');

const state1 = invokeStateRoute('/state/team/agents?role=executor&node=violet');
assert(state1.handled === true, 'agents state route handled');
assert(state1.statusCode === 200 && state1.body?.ok, 'agents state route ok');
assert(Array.isArray(state1.body?.agents) && state1.body.agents.length === 1, 'agents state returns 1 item');
assert(state1.body?.stats?.count === 1, 'agents state stats count = 1');

const drain = await invokeResidentRoute('POST', '/internal/team/agent/drain', {
  agentId: 'agent:route:1',
});
assert(drain.statusCode === 200 && drain.body?.ok, 'drain route ok');
assert(drain.body?.agent?.status === 'draining', 'drain route sets status');

const state2 = invokeStateRoute('/state/team/agents?activeOnly=true');
assert(Array.isArray(state2.body?.agents) && state2.body.agents.length === 0, 'activeOnly hides draining agents');

const dereg = await invokeResidentRoute('POST', '/internal/team/agent/deregister', {
  agentId: 'agent:route:1',
  reason: 'shutdown',
});
assert(dereg.statusCode === 200 && dereg.body?.ok, 'deregister route ok');
assert((agentLifecycle.snapshot() || []).length === 0, 'deregister route clears registry');

console.log(`\nRESULT ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
