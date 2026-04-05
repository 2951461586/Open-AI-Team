import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const base = process.env.TEAM_API_BASE || 'http://127.0.0.1:19090';
const sourcePath = path.resolve('src/team/team-node-health.mjs');
const source = fs.readFileSync(sourcePath, 'utf8');

const forbiddenMarkers = [
  'TEAM_NODE_HEALTH_DISABLE_REMOTE_GATEWAY_STATS',
  'remoteProbeState',
  'collectRemoteStatsViaGateway',
  'getRemoteMainHistory',
  'buildRemoteStatsProbePrompt',
  'extractProbeResultFromSessions',
  'invokeGatewayTool',
  'parseJsonLoose',
  'normalizeRemoteStats',
  'sessions_spawn',
  'sessions_history',
  'openclawOk',
  'openclawStatus',
];

for (const marker of forbiddenMarkers) {
  assert.equal(source.includes(marker), false, `forbidden marker still present in team-node-health.mjs: ${marker}`);
}

const res = await fetch(`${base}/state/team/nodes`);
assert.equal(res.ok, true, `GET /state/team/nodes failed: ${res.status}`);
const payload = await res.json();

assert.equal(payload?.ok, true, 'nodes.ok');
assert.equal(String(payload?.api?.contract || ''), 'team.governance.query.v1');
assert.equal(String(payload?.api?.route || ''), 'nodes');
assert.ok(payload?.nodes && typeof payload.nodes === 'object', 'nodes payload missing');
assert.ok(payload?.recommendation && typeof payload.recommendation === 'object', 'recommendation missing');

const nodes = payload.nodes || {};
const recommendation = payload.recommendation || {};
const remoteNames = ['violet', 'lebang'];
const diagnostics = {};

if (nodes.laoda) {
  assert.equal(String(nodes.laoda.statsSource || ''), 'local');
  assert.ok(['ok', 'missing', 'unknown'].includes(String(nodes.laoda.statsStatus || '')));
}

for (const name of remoteNames) {
  const node = nodes[name];
  if (!node) continue;
  const statsStatus = String(node.statsStatus || '');
  const statsSource = String(node.statsSource || '');
  const pressureReason = String(node.pressureReason || '');
  const weight = Number(node.weight || 0);

  if (statsStatus === 'disabled') {
    assert.equal(statsSource, 'disabled', `${name}.statsSource`);
    assert.equal(node.stats, null, `${name}.stats should be null when disabled`);
    assert.equal(pressureReason, 'stats_disabled', `${name}.pressureReason`);
    assert.ok(weight <= 45, `${name}.weight should be degraded when stats disabled`);
  } else if (statsStatus === 'missing') {
    assert.ok(['ssh', 'disabled', ''].includes(statsSource), `${name}.statsSource unexpected for missing`);
    assert.equal(node.stats, null, `${name}.stats should be null when missing`);
    assert.equal(pressureReason, 'reachable_no_stats', `${name}.pressureReason`);
    assert.ok(weight <= 45, `${name}.weight should be degraded when stats missing`);
  } else if (statsStatus === 'ok') {
    assert.ok(node.stats && typeof node.stats === 'object', `${name}.stats should exist when statsStatus=ok`);
  }

  diagnostics[name] = {
    reachable: !!node.reachable,
    probe: String(node.probe || ''),
    statsSource,
    statsStatus,
    weight,
    pressureReason,
    recommended: !!node.recommended,
  };
}

if (nodes.laoda && remoteNames.some((name) => String(nodes[name]?.statsStatus || '') === 'disabled')) {
  const selectedNode = String(recommendation.selectedNode || '');
  assert.notEqual(selectedNode, '', 'recommendation.selectedNode missing');
  assert.notEqual(selectedNode, 'violet', 'selectedNode should not prefer disabled-stats violet over healthy local node');
  assert.notEqual(selectedNode, 'lebang', 'selectedNode should not prefer disabled-stats lebang over healthy local node');
}

console.log(JSON.stringify({
  ok: true,
  smoke: 'team-node-health-root-fix.v1',
  summary: {
    sourcePath,
    forbiddenMarkerCount: forbiddenMarkers.length,
    selectedNode: String(recommendation.selectedNode || ''),
    degradedReason: String(recommendation.degradedReason || ''),
    diagnostics,
  },
}, null, 2));
