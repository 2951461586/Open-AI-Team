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
  TEAM_DB_PATH: path.join(RUN_DIR, 'team-standalone-product-capability-smoke.sqlite'),
});

const run = await ctx.agentHarness.runTask('验证 standalone broker 产品 runtime 已具备 session / desk / plugin / bridge / shell 的产品化能力与证据。');

assert(run?.ok === true, 'standalone product runtime completed');
assert(run?.session?.contractVersion === 'agent-harness-session.v1', 'session contract exists');
assert(run?.session?.capabilities?.threadBus === true, 'session thread bus capability is enabled');
assert(run?.session?.capabilities?.agentMessaging === true, 'session agent messaging capability is enabled');
assert(run?.desk?.contractVersion === 'agent-harness-desk.v1', 'desk contract exists');
assert(run?.desk?.enabled === true, 'desk is enabled');
assert(run?.hostLayer?.contractVersion === 'agent-harness-host-layer.v1', 'host-layer contract exists');
assert(run?.hostLayer?.sessionBusReady === true, 'host-layer session bus is ready');
assert(run?.hostLayer?.deskReady === true, 'host-layer desk is ready');
assert(run?.plugins?.contractVersion === 'agent-harness-plugins.v1', 'plugin contract exists');
assert(Array.isArray(run?.plugins?.refs) && run.plugins.refs.length >= 3, 'plugin refs are productized');
assert(run?.bridge?.contractVersion === 'agent-harness-bridge.v1', 'bridge contract exists');
assert(run?.bridge?.enabled === true, 'bridge is enabled');
assert(run?.shell?.contractVersion === 'agent-shell.v1', 'shell contract exists');
assert(run?.shell?.onboardingReady === true, 'shell onboarding is ready');
assert(run?.authority?.contractVersion === 'agent-harness-authority.v1', 'authority contract exists');
assert(Number(run?.runtimeEvidence?.pluginCount || 0) >= 3, 'runtime evidence includes plugin count');
assert(Number(run?.runtimeEvidence?.pluginInjectedToolCount || 0) >= 3, 'runtime evidence includes injected tools');
assert(Number(run?.runtimeEvidence?.pluginInjectedSkillCount || 0) >= 4, 'runtime evidence includes injected skills');
assert(Number(run?.runtimeEvidence?.bridgeRouteCount || 0) >= 3, 'runtime evidence includes bridge routes');
assert(Number(run?.runtimeEvidence?.bridgeIngressCount || 0) >= 1, 'runtime evidence includes bridge ingress');
assert(Number(run?.runtimeEvidence?.bridgeEgressCount || 0) >= 1, 'runtime evidence includes bridge egress');
assert(Number(run?.runtimeEvidence?.capabilityGateRoleCount || 0) >= 4, 'runtime evidence includes capability gate roles');
assert(run?.summary?.pluginReady === true, 'summary marks plugin ready');
assert(run?.summary?.bridgeReady === true, 'summary marks bridge ready');
assert(run?.summary?.shellReady === true, 'summary marks shell ready');
assert(run?.summary?.authorityReady === true, 'summary marks authority ready');
assert(run?.summary?.hostLayerReady === true, 'summary marks host-layer ready');

console.log(JSON.stringify({
  ok: true,
  summary: {
    ok: true,
    runId: run?.runId || '',
    pluginCount: Number(run?.runtimeEvidence?.pluginCount || 0),
    bridgeRouteCount: Number(run?.runtimeEvidence?.bridgeRouteCount || 0),
    capabilityGateRoleCount: Number(run?.runtimeEvidence?.capabilityGateRoleCount || 0),
  },
}, null, 2));
