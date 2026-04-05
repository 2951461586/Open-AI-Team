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

const bootstrap = fs.readFileSync(new URL('../../src/index-bootstrap.mjs', import.meta.url), 'utf8');
const tlRuntime = fs.readFileSync(new URL('../../src/team/team-tl-runtime.mjs', import.meta.url), 'utf8');
const tlExecution = fs.readFileSync(new URL('../../src/team/tl-runtime/execution.mjs', import.meta.url), 'utf8');
const tlFollowup = fs.readFileSync(new URL('../../src/team/tl-runtime/followup.mjs', import.meta.url), 'utf8');
const tlRuntimeHarness = fs.readFileSync(new URL('../../src/team/tl-runtime/runtime-harness.mjs', import.meta.url), 'utf8');
const platformRuntimeAdapter = fs.readFileSync(new URL('../../src/team-runtime-adapters/runtime-adapter.mjs', import.meta.url), 'utf8');
const controlPlaneSurface = fs.readFileSync(new URL('../../src/team-runtime-adapters/control-plane.mjs', import.meta.url), 'utf8');
const remoteSessionControlPlane = fs.readFileSync(new URL('../../src/team-runtime-adapters/remote-session-control-plane.mjs', import.meta.url), 'utf8');
const sessionRuntimeAdapter = fs.readFileSync(new URL('../../src/team-runtime-adapters/session-runtime-adapter.mjs', import.meta.url), 'utf8');
const executionAdapter = fs.readFileSync(new URL('../../src/team-runtime-adapters/execution-harness.mjs', import.meta.url), 'utf8');
const safety = fs.readFileSync(new URL('../../src/team-core/execution-safety-contracts.mjs', import.meta.url), 'utf8');
const standaloneRuntime = fs.readFileSync(new URL('../../src/agent-harness-core/standalone-product-runtime.mjs', import.meta.url), 'utf8');

assert(bootstrap.includes('createRemoteSessionHostBootstrap'), 'bootstrap exposes neutral remote-session host bootstrap wrapper');
assert(bootstrap.includes('resolveRemoteSessionHostBootstrap'), 'bootstrap delegates host-specific implementation to optional integration selector');
assert(!bootstrap.includes("from './integrations/openclaw/host-bootstrap.mjs'"), 'bootstrap no longer statically imports OpenClaw integration');
assert(bootstrap.includes('createNoopSessionRuntimeAdapter'), 'bootstrap imports host-agnostic runtime adapter factory');
assert(bootstrap.includes('createStandaloneProductRuntime'), 'bootstrap imports standalone broker runtime');
assert(bootstrap.includes('createRuntimeExecutionAdapter'), 'bootstrap imports execution adapter factory');
assert(bootstrap.includes('export async function createRemoteSessionHostBootstrap'), 'bootstrap exposes async remote-session host bootstrap');
assert(!bootstrap.includes('export function createOpenClawHostBootstrap'), 'bootstrap no longer exposes OpenClaw bootstrap shell');
assert(bootstrap.includes('export function createHostAgnosticBootstrap'), 'bootstrap exposes host-agnostic bootstrap');
assert(bootstrap.includes('export function createStandaloneBrokerBootstrap'), 'bootstrap exposes standalone broker bootstrap');
assert(bootstrap.includes('const hostBootstrap = config.hostBootstrap'), 'bootstrap allows host bootstrap injection');
assert(bootstrap.includes('const sessionSubstrate = await Promise.resolve(hostBootstrap.createSessionSubstrate({ roleDeployment: TEAM_ROLE_DEPLOYMENT }));'), 'bootstrap resolves session substrate from host bootstrap');
assert(bootstrap.includes('config.sessionSubstrate === \'standalone-broker\''), 'bootstrap supports standalone-broker substrate');
assert(bootstrap.includes('const hostConfig = loadHostRuntimeConfig(config);'), 'bootstrap loads host runtime config surface');
assert(bootstrap.includes('const runtimeAdapter = sessionSubstrate.runtimeAdapter;'), 'bootstrap reads runtime adapter from session substrate');
assert(bootstrap.includes('const executionAdapter = sessionSubstrate.executionAdapter;'), 'bootstrap reads execution adapter from session substrate');
assert(bootstrap.includes('runtimeAdapter,'), 'bootstrap passes runtime adapter onward');
assert(bootstrap.includes('executionAdapter,'), 'bootstrap passes execution adapter onward');
assert(!bootstrap.includes('/root/.openclaw/openclaw.json'), 'bootstrap no longer reads openclaw.json directly');
assert(!bootstrap.includes('/root/.openclaw/secrets.json'), 'bootstrap no longer reads secrets.json directly');
assert(!bootstrap.includes('/root/.openclaw/relay/laoda.config.json'), 'bootstrap no longer reads relay host config directly');
assert(!bootstrap.includes('createOpenClawRuntimeAdapter({ multiNodeGateway, roleDeployment, gateway: tlGateway })'), 'bootstrap no longer injects gateway fallback into runtime adapter');
assert(!bootstrap.includes('createRuntimeExecutionAdapter({ runtimeAdapter, gateway: tlGateway })'), 'bootstrap no longer injects gateway fallback into execution adapter');
assert(platformRuntimeAdapter.includes('createRemoteSessionRuntimeAdapter'), 'platform runtime adapter exists');
assert(controlPlaneSurface.includes('createControlPlaneClient'), 'control plane surface exposes neutral factory alias');
assert(remoteSessionControlPlane.includes('createRemoteSessionControlPlane'), 'control plane implementation exists');
assert(remoteSessionControlPlane.includes("provider = 'control-plane-client'"), 'control plane implementation defaults to neutral provider contract');
assert(remoteSessionControlPlane.includes("kind: 'control_plane_client'"), 'control plane implementation exposes neutral kind contract');
assert(!platformRuntimeAdapter.includes('gateway = {}'), 'platform runtime adapter no longer accepts legacy gateway fallback');
assert(!platformRuntimeAdapter.includes('spawnSessionAdapter'), 'platform runtime adapter no longer accepts spawnSessionAdapter fallback');
assert(sessionRuntimeAdapter.includes('export function createSessionRuntimeAdapter'), 'session runtime adapter abstraction exists');
assert(sessionRuntimeAdapter.includes("kind: 'session_runtime_adapter'"), 'session runtime adapter exposes platform-neutral kind');
assert(sessionRuntimeAdapter.includes("error: 'session_substrate_unavailable'"), 'session runtime adapter uses substrate-neutral unavailable contract');
assert(executionAdapter.includes('export function createRuntimeExecutionAdapter'), 'execution adapter exists');
assert(!executionAdapter.includes('gateway = {}'), 'execution adapter no longer accepts gateway fallback');
assert(!executionAdapter.includes('spawnSessionAdapter'), 'execution adapter no longer accepts spawnSessionAdapter fallback');
assert(standaloneRuntime.includes('export async function createStandaloneProductRuntime'), 'standalone product runtime exists');
assert(standaloneRuntime.includes("transport: {\n        kind: 'remote_broker_http'"), 'standalone runtime is broker-first');
assert(standaloneRuntime.includes("import { createOssMinimalWorkflowPack } from './workflow-pack.mjs';"), 'standalone runtime uses productized workflow pack');
assert(standaloneRuntime.includes("import { createOssMinimalPolicyPack } from './policy-pack.mjs';"), 'standalone runtime uses productized policy pack');
assert(standaloneRuntime.includes("from './provider-registry.mjs';"), 'standalone runtime uses productized provider registry');
assert(standaloneRuntime.includes("from './backend-provider.mjs';"), 'standalone runtime uses productized backend provider');
assert(standaloneRuntime.includes("from './remote-broker-runtime-adapter.mjs';"), 'standalone runtime uses productized broker runtime adapter');
assert(standaloneRuntime.includes("const DEFAULT_WORKER_ENTRY = path.resolve(__dirname, './role-worker.mjs');"), 'standalone runtime uses productized worker entry');
assert(standaloneRuntime.includes("const DEFAULT_BROKER_ENTRY = path.resolve(__dirname, './remote-broker-server.mjs');"), 'standalone runtime uses productized broker entry');
assert(tlRuntime.includes('createTLRuntimeExecutionHarness({'), 'TL runtime builds runtime execution harness via helper');
assert(tlRuntime.includes('executionAdapter,'), 'TL runtime accepts execution adapter');
assert(tlRuntime.includes('runtimeAdapter,'), 'TL runtime accepts runtime adapter');
assert(!tlRuntime.includes('gateway = {}'), 'TL runtime no longer accepts gateway fallback surface');
assert(!tlRuntime.includes('spawnSessionAdapter,'), 'TL runtime no longer accepts spawnSessionAdapter fallback');
assert(!tlRuntime.includes('multiNodeGateway,'), 'TL runtime no longer accepts multiNodeGateway direct fallback');
assert(tlRuntime.includes('createTLExecutionHelpers({'), 'TL runtime wires execution helper factory');
assert(tlRuntime.includes('createTLFollowupHelpers({'), 'TL runtime wires followup helper factory');
assert(tlRuntimeHarness.includes('export function createTLRuntimeExecutionHarness'), 'runtime harness helper exists');
assert(tlRuntimeHarness.includes('executionAdapter'), 'runtime harness helper reads execution adapter');
assert(tlRuntimeHarness.includes('runtimeAdapter'), 'runtime harness helper reads runtime adapter');
assert(!tlRuntimeHarness.includes('gateway = {}'), 'runtime harness helper no longer accepts gateway fallback');
assert(!tlRuntimeHarness.includes('spawnSessionAdapter'), 'runtime harness helper no longer accepts spawnSessionAdapter fallback');
assert(tlExecution.includes('runtimeExecutionHarness.spawnForRole'), 'execution helper spawns via runtimeExecutionHarness');
assert(tlExecution.includes('runtimeExecutionHarness.sendToSession'), 'execution helper sends via runtimeExecutionHarness');
assert(tlExecution.includes('runtimeExecutionHarness.listSessionsForSession'), 'execution helper lists sessions via runtimeExecutionHarness');
assert(tlExecution.includes('runtimeExecutionHarness.getSessionHistory'), 'execution helper gets history via runtimeExecutionHarness');
assert(tlFollowup.includes('runtimeExecutionHarness.sendToSession'), 'followup helper sends via runtimeExecutionHarness');
assert(tlRuntime.includes("import { buildSearchEvidenceSafetyPrompt } from '../team-core/execution-safety-contracts.mjs';"), 'TL runtime imports shared search safety helper');
assert(safety.includes('export function buildSearchEvidenceSafetyPrompt'), 'shared execution safety helper exists');

console.log(`harness authority summary ${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
