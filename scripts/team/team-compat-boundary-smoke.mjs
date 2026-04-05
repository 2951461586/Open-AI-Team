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

const teamIndex = fs.readFileSync(new URL('../../src/team/INDEX.md', import.meta.url), 'utf8');
const teamReadme = fs.readFileSync(new URL('../../src/team/README.md', import.meta.url), 'utf8');
const rootReadme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const runtimeAdapterSurface = fs.readFileSync(new URL('../../src/team-runtime-adapters/runtime-adapter.mjs', import.meta.url), 'utf8');
const controlPlaneSurface = fs.readFileSync(new URL('../../src/team-runtime-adapters/control-plane.mjs', import.meta.url), 'utf8');
const adapterReadme = fs.readFileSync(new URL('../../src/team-runtime-adapters/README.md', import.meta.url), 'utf8');
const inventoryDoc = fs.readFileSync(new URL('../../docs/architecture/release-preflight-retirement-inventory.md', import.meta.url), 'utf8');
const tlRuntime = fs.readFileSync(new URL('../../src/team/team-tl-runtime.mjs', import.meta.url), 'utf8');
const bootstrap = fs.readFileSync(new URL('../../src/index-bootstrap.mjs', import.meta.url), 'utf8');
const standaloneRuntime = fs.readFileSync(new URL('../../src/agent-harness-core/standalone-product-runtime.mjs', import.meta.url), 'utf8');

const deletedCompatFiles = [
  '../../src/team/team-runtime.mjs',
  '../../src/team/team-agent-harness.mjs',
  '../../src/team/team-multi-node-gateway.mjs',
  '../../src/team-runtime-adapters/openclaw.mjs',
  '../../src/team-runtime-adapters/openclaw-gateway.mjs',
  '../../scripts/smoke/team-output-boundary-revise.mjs',
  '../../scripts/smoke/team-critic-openai-compatible.mjs',
  '../../scripts/smoke/team-judge-openai-compatible.mjs',
  '../../scripts/smoke/team-executor-openai-compatible.mjs',
  '../../scripts/team/team-output-authoritative-live-acceptance.mjs',
].map((rel) => ({ rel, exists: fs.existsSync(new URL(rel, import.meta.url)) }));

assert(teamIndex.includes('`team-tl-runtime.mjs` — **当前唯一 authority + 编排主链**'), 'team index points to TL runtime as mainline');
assert(!teamIndex.includes('retired pipeline stub，仅保留 import contract'), 'team index no longer lists retired runtime stub as active source');
assert(!teamIndex.includes('compat re-export shell'), 'team index no longer lists compat shell as active source');
assert(teamReadme.includes('`team-tl-runtime.mjs` — **当前唯一对话 authority + 任务编排 authority**'), 'team README promotes TL runtime');
assert(!teamReadme.includes('只保留 import contract，不再代表主运行时'), 'team README no longer describes retired runtime stub as kept shell');
assert(!teamReadme.includes('compat re-export shell'), 'team README no longer describes compat shell as retained surface');
assert(rootReadme.includes('`team-tl-runtime.mjs`：**当前唯一对话 authority ＋ 任务编排主运行时**'), 'root README promotes TL runtime as canonical main runtime');
assert(!rootReadme.includes('team-runtime.mjs'), 'root README no longer mentions retired runtime shim');
assert(tlRuntime.includes('export function createTLRuntime'), 'TL runtime remains canonical runtime entry');
assert(bootstrap.includes('createControlPlaneHostBootstrap'), 'bootstrap exposes neutral host bootstrap');
assert(!bootstrap.includes('createOpenClawHostBootstrap'), 'bootstrap no longer exposes OpenClaw bootstrap alias');
assert(runtimeAdapterSurface.includes('createControlPlaneRuntimeAdapter'), 'runtime adapter exposes neutral control-plane alias');
assert(!runtimeAdapterSurface.includes('createOpenClawHarness'), 'runtime adapter surface does not expose OpenClaw harness alias');
assert(controlPlaneSurface.includes('createSessionControlPlane'), 'control plane surface exposes session control-plane alias');
assert(!controlPlaneSurface.includes('createOpenClawMultiNodeGateway'), 'control plane surface no longer exposes OpenClaw gateway alias');
assert(!adapterReadme.includes('openclaw.mjs'), 'adapter README no longer documents removed openclaw re-export shell');
assert(!adapterReadme.includes('openclaw-gateway.mjs'), 'adapter README no longer documents removed openclaw gateway shell');
assert(!adapterReadme.includes('team-agent-harness.mjs'), 'adapter README no longer documents removed compat harness shell');
assert(!adapterReadme.includes('team-multi-node-gateway.mjs'), 'adapter README no longer documents removed compat gateway shell');
assert(inventoryDoc.includes('已执行物理删除'), 'inventory doc records physical cleanup execution');
assert(!standaloneRuntime.includes('examples/oss-minimal'), 'productized standalone runtime does not import from examples');

for (const entry of deletedCompatFiles) {
  assert(!entry.exists, `deleted compat file removed`, entry.rel);
}

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-compat-boundary.v2',
  },
}, null, 2));

if (failed > 0) process.exit(1);
