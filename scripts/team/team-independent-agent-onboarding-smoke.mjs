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

const coreReadme = fs.readFileSync(new URL('../../src/agent-harness-core/README.md', import.meta.url), 'utf8');
const onboardingDoc = fs.readFileSync(new URL('../../docs/architecture/independent-agent-onboarding.md', import.meta.url), 'utf8');
const manifest = fs.readFileSync(new URL('../../src/agent-harness-core/oss-agent-manifest.json', import.meta.url), 'utf8');
const agentPackage = fs.readFileSync(new URL('../../src/agent-harness-core/oss-agent-package.json', import.meta.url), 'utf8');
const contracts = fs.readFileSync(new URL('../../src/agent-harness-core/index.mjs', import.meta.url), 'utf8');
const shellEntry = fs.readFileSync(new URL('../../src/agent-harness-core/agent-shell.mjs', import.meta.url), 'utf8');
const sampleReadme = fs.readFileSync(new URL('../../examples/oss-minimal/README.md', import.meta.url), 'utf8');

assert(coreReadme.includes('宿主无关的 Harness SDK 面'), 'core README declares host-agnostic harness sdk surface');
assert(coreReadme.includes('正式产品化的 standalone broker harness runtime'), 'core README declares productized standalone runtime');
assert(coreReadme.includes('OpenHanako 风格的独立 agent 接入面'), 'core README declares OpenHanako-style independent agent access');

assert(onboardingDoc.includes('第三方 Agent'), 'onboarding doc addresses third-party agent integration');
assert(onboardingDoc.includes('不理解 OpenClaw 内部会话模型'), 'onboarding doc makes OpenClaw session model non-required');
assert(onboardingDoc.includes('provider registry'), 'onboarding doc covers provider registry');
assert(onboardingDoc.includes('doctor / activation checklist'), 'onboarding doc covers doctor and activation checklist');
assert(onboardingDoc.includes('scripts/team/team-independent-agent-onboarding-smoke.mjs'), 'onboarding doc declares onboarding smoke gate');

assert(manifest.includes('"kind": "standalone-harness"'), 'manifest declares standalone-harness runtime kind');
assert(manifest.includes('"hostAgnostic": true'), 'manifest declares host-agnostic host contract');
assert(manifest.includes('"hostRuntime": false'), 'manifest does not require host runtime');
assert(manifest.includes('"hostGateway": false'), 'manifest does not require host gateway');
assert(manifest.includes('"hostSessionBus": false'), 'manifest does not require host session bus');
assert(manifest.includes('"hostMemory": false'), 'manifest does not require host memory');

assert(agentPackage.includes('"contractVersion": "agent-package.v2"'), 'agent package uses v2 contract');
assert(agentPackage.includes('"sessionContract"'), 'agent package declares session contract');
assert(agentPackage.includes('"deskContract"'), 'agent package declares desk contract');
assert(agentPackage.includes('"hostLayerContract"'), 'agent package declares host-layer contract');
assert(agentPackage.includes('"bridgePolicy"'), 'agent package declares bridge policy');
assert(agentPackage.includes('"runtimeCapabilityPolicy"'), 'agent package declares capability gate policy');
assert(agentPackage.includes('"productShell"'), 'agent package declares product shell');
assert(agentPackage.includes('"onboardingMode": "productized"'), 'agent package declares productized onboarding mode');
assert(agentPackage.includes('"doctor"') || shellEntry.includes("cmd === 'doctor'"), 'doctor surface exists');

for (const name of [
  'buildWorkerContract',
  'buildSessionContract',
  'buildDeskContract',
  'buildBridgeContract',
  'buildLifecycleContract',
  'buildShellContract',
  'buildPluginContract',
  'buildRuntimeCapabilityContract',
]) {
  assert(contracts.includes(`export function ${name}`), `contract builder exists: ${name}`);
}

for (const cmd of ['package', 'plugins', 'onboarding', 'routes', 'capabilities', 'doctor']) {
  assert(shellEntry.includes(`cmd === '${cmd}'`), `agent shell exposes ${cmd} command`);
}

assert(sampleReadme.includes('wrapper / regression facade / runnable sample'), 'sample README keeps facade wording');
assert(sampleReadme.includes('src/agent-harness-core/'), 'sample README points readers to core authority');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-independent-agent-onboarding.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);
