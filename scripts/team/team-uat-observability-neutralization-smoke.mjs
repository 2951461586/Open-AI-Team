import fs from 'node:fs';

let passed = 0;
let failed = 0;
function assert(condition, label, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`✅ ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.error(`❌ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const dashboardTypes = fs.readFileSync(new URL('../../dashboard/src/lib/types.ts', import.meta.url), 'utf8');
const dashboardUtils = fs.readFileSync(new URL('../../dashboard/src/lib/utils.ts', import.meta.url), 'utf8');
const dashboardApi = fs.readFileSync(new URL('../../dashboard/src/lib/api.ts', import.meta.url), 'utf8');
const nodesView = fs.readFileSync(new URL('../../dashboard/src/components/NodesView.tsx', import.meta.url), 'utf8');
const header = fs.readFileSync(new URL('../../dashboard/src/components/Header.tsx', import.meta.url), 'utf8');
const teamConsole = fs.readFileSync(new URL('../../dashboard/src/components/panels/TeamConsolePanel.tsx', import.meta.url), 'utf8');
const nodesRoute = fs.readFileSync(new URL('../../src/routes/team-state/nodes.mjs', import.meta.url), 'utf8');
const nodeHealth = fs.readFileSync(new URL('../../src/team/team-node-health.mjs', import.meta.url), 'utf8');
const architecture = fs.readFileSync(new URL('../../docs/architecture/current-team-runtime-architecture.md', import.meta.url), 'utf8');

assert(dashboardTypes.includes('controlBaseUrl?: string'), 'dashboard node connectivity type exposes controlBaseUrl');
assert(dashboardTypes.includes('controlPlaneStatus?: string'), 'dashboard node stats type exposes controlPlaneStatus');
assert(!dashboardTypes.includes('gatewayBaseUrl?: string\n  gatewayHost?: string\n  gatewayPort?: number\n  tailnetHost'), 'dashboard primary node connectivity type no longer uses gateway* fields');
assert(!dashboardTypes.includes('openclawOk?: boolean\n  openclawStatus?: string\n  host?: string'), 'dashboard primary node stats type no longer uses openclaw* fields');

assert(dashboardUtils.includes("control_http: '控制面探活'"), 'dashboard utils relabel control_http probe');
assert(dashboardUtils.includes('controlPlaneStatus?: string'), 'dashboard utils use controlPlaneStatus label contract');
assert(!dashboardUtils.includes("gateway_http: '网关服务探活'"), 'dashboard utils no longer present gateway_http label');

assert(dashboardApi.includes('normalizeNodeStats'), 'dashboard api normalizes node stats contract');
assert(dashboardApi.includes('normalizeConnectivity'), 'dashboard api normalizes connectivity contract');
assert(dashboardApi.includes("controlBaseUrl: String(raw?.controlBaseUrl || raw?.gatewayBaseUrl || '')"), 'dashboard api bridges legacy gatewayBaseUrl to controlBaseUrl');
assert(dashboardApi.includes("controlPlaneStatus: String(raw?.controlPlaneStatus || raw?.openclawStatus || '')"), 'dashboard api bridges legacy openclawStatus to controlPlaneStatus');

for (const [label, source] of [
  ['nodes view', nodesView],
  ['header', header],
  ['team console', teamConsole],
]) {
  assert(source.includes('controlPlaneStatus'), `${label} consumes controlPlaneStatus`);
  assert(!source.includes('openclawStatus'), `${label} no longer consumes openclawStatus`);
}

assert(nodesView.includes('controlBaseUrl'), 'nodes view uses controlBaseUrl');
assert(nodesView.includes('controlHost'), 'nodes view uses controlHost');
assert(!nodesView.includes('gatewayBaseUrl'), 'nodes view no longer reads gatewayBaseUrl');
assert(!nodesView.includes('gatewayHost'), 'nodes view no longer reads gatewayHost');

assert(nodesRoute.includes('controlBaseUrl'), 'nodes route emits controlBaseUrl');
assert(nodesRoute.includes('controlHost'), 'nodes route emits controlHost');
assert(nodesRoute.includes('controlPort'), 'nodes route emits controlPort');
assert(!nodesRoute.includes('gatewayBaseUrl'), 'nodes route no longer emits gatewayBaseUrl');

assert(nodeHealth.includes('controlPlaneStatus'), 'node health source exposes controlPlaneStatus');
assert(!nodeHealth.includes('openclawStatus'), 'node health source no longer exposes openclawStatus');
assert(architecture.includes('control plane client'), 'architecture doc documents control plane client wording');
assert(!architecture.includes('openclaw-gateway.mjs` 仅保留 compat re-export') || architecture.includes('control-plane.mjs'), 'architecture doc keeps control-plane-neutral runtime wording');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-uat-observability-neutralization.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);
