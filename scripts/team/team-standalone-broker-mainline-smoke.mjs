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
  TEAM_DB_PATH: path.join(RUN_DIR, 'team-standalone-broker-mainline-smoke.sqlite'),
});

assert(ctx.sessionSubstrateProvider === 'standalone-broker-productized', 'session substrate provider switched to standalone broker');
assert(ctx.hostBootstrap?.hostKind === 'standalone-broker', 'host bootstrap kind is standalone-broker');
assert(typeof ctx.agentHarness?.runTask === 'function', 'agent harness exposes runTask');
assert(ctx.executionAdapter?.kind === 'execution_adapter', 'execution adapter is wired');
assert(ctx.runtimeAdapter?.kind === 'session_runtime_adapter', 'runtime adapter is platform-neutral');
assert(ctx.sessionControlPlane === null, 'standalone broker path does not depend on remote session control plane');

const run = await ctx.agentHarness.runTask('给出一个最小但强执行的独立 agent harness 交付，并保留 broker / host-layer / plugin / desk 证据。');
assert(run?.ok === true, 'standalone broker harness run completed');
assert(run?.transport?.kind === 'remote_broker_http', 'transport kind is remote_broker_http');
assert(run?.hostContract?.hostAgnostic === true, 'host contract remains host agnostic');
assert(run?.summary?.distributedReady === true, 'distributed execution summary is ready');
assert(run?.summary?.pluginReady === true, 'plugin capability summary is ready');
assert(run?.summary?.bridgeReady === true, 'bridge capability summary is ready');
assert(run?.summary?.authorityReady === true, 'authority summary is ready');
assert(run?.summary?.multiBrokerReady === true, 'multi broker summary is ready');
assert(Number(run?.runtimeEvidence?.brokerStartCount || 0) >= 3, 'broker start evidence exists');
assert(Number(run?.runtimeEvidence?.clusterPlacementCount || 0) >= 1, 'cluster placement evidence exists');
assert(Number(run?.runtimeEvidence?.pluginCount || 0) >= 3, 'plugin evidence exists');
assert(Number(run?.runtimeEvidence?.bridgeRouteCount || 0) >= 3, 'bridge route evidence exists');
assert(Number(run?.runtimeEvidence?.capabilityGateRoleCount || 0) >= 4, 'capability gate evidence exists');
assert(Array.isArray(run?.results) && run.results.length >= 4, 'agent harness produced full core multi-role results');
assert(['planner', 'executor', 'critic', 'judge'].every((role) => run.results.some((item) => item?.role === role)), 'agent harness covers planner/executor/critic/judge');

const roleProbe = await ctx.runtimeAdapter.probeRole('executor');
assert(roleProbe?.ok === true, 'runtime adapter probeRole is available');
assert(String(roleProbe?.deployment?.executionMode || '') === 'remote_broker_http', 'runtime adapter points to broker execution mode');

const delegated = await ctx.executionAdapter.spawnForRole({
  role: 'executor',
  task: '输出一个简短的 broker-first 执行总结',
  objective: '验证 execution adapter 能委派到 standalone broker substrate',
  acceptance: '返回结构化 summary',
  deliverables: ['summary.md'],
});
assert(delegated?.ok === true, 'execution adapter can delegate through standalone broker substrate');
assert(String(delegated?.via || '').includes('remote_broker_http'), 'delegated execution uses broker transport');

console.log(JSON.stringify({
  ok: true,
  summary: {
    ok: true,
    substrate: ctx.sessionSubstrateProvider,
    hostKind: ctx.hostBootstrap?.hostKind || '',
    runId: run?.runId || '',
    brokerCount: Number(run?.transport?.brokerCount || 0),
    resultCount: Array.isArray(run?.results) ? run.results.length : 0,
  },
}, null, 2));
