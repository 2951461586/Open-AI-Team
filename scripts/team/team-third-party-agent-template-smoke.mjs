import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

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

const manifestPath = new URL('../../examples/third-party-agent-sample/agent-manifest.json', import.meta.url);
const packagePath = new URL('../../examples/third-party-agent-sample/agent-package.json', import.meta.url);
const readmePath = new URL('../../examples/third-party-agent-sample/README.md', import.meta.url);
const shellPath = new URL('../../examples/third-party-agent-sample/agent-shell.mjs', import.meta.url);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const agentPackage = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const readme = fs.readFileSync(readmePath, 'utf8');
const shellSource = fs.readFileSync(shellPath, 'utf8');

assert(manifest.contractVersion === 'agent-manifest.v1', 'third-party manifest uses productized contract');
assert(manifest.identity?.agentId === agentPackage.identity?.agentId, 'manifest/package agentId aligned', `${manifest.identity?.agentId || ''}`);
assert(manifest.hostContract?.hostAgnostic === true, 'manifest remains host-agnostic');
assert(manifest.hostContract?.requires?.hostRuntime === false, 'manifest does not require host runtime');
assert(Array.isArray(manifest.roles) && manifest.roles.length >= 2, 'manifest exposes at least planner/executor roles', String(manifest.roles?.length || 0));
assert(!!manifest.providers && typeof manifest.providers === 'object', 'manifest declares provider registry surface');

assert(agentPackage.contractVersion === 'agent-package.v2', 'third-party package uses v2 contract');
assert(!!agentPackage.workflowPackId, 'third-party package declares workflowPackId', String(agentPackage.workflowPackId || ''));
assert(!!agentPackage.policyPackId, 'third-party package declares policyPackId', String(agentPackage.policyPackId || ''));
assert(Array.isArray(agentPackage.pluginRefs), 'third-party package declares pluginRefs array', String(agentPackage.pluginRefs?.length || 0));
assert(!!agentPackage.runtimeCapabilityPolicy, 'third-party package declares capability gate');
assert(!!agentPackage.lifecyclePolicy, 'third-party package declares lifecycle policy');
assert(!!agentPackage.productShell, 'third-party package declares product shell');
assert(Array.isArray(agentPackage.productShell?.activationChecklist), 'third-party package exposes activation checklist', String(agentPackage.productShell?.activationChecklist?.length || 0));
assert((agentPackage.productShell?.commands || []).includes('doctor'), 'third-party package exposes doctor command');

assert(shellSource.includes('AGENT_PACKAGE_PATH'), 'third-party sample has shell wrapper');
assert(shellSource.includes('AGENT_RUNS_ROOT'), 'third-party shell wrapper binds runs root');
assert(readme.includes('productized template'), 'sample README calls out productized template');
assert(readme.includes('node examples/third-party-agent-sample/agent-shell.mjs package'), 'sample README includes shell usage');

const validate = spawnSync(process.execPath, ['scripts/team/team-agent-package-validate.mjs', 'examples/third-party-agent-sample/agent-package.json'], {
  cwd: new URL('../../', import.meta.url),
  encoding: 'utf8',
});
assert(validate.status === 0, 'third-party package passes product validator', (validate.stdout || validate.stderr || '').trim().split('\n').slice(-4).join(' | '));

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-third-party-agent-template.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);
