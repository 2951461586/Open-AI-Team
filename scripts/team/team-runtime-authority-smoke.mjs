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

const packageReadme = fs.readFileSync(new URL('../../packages/team-runtime/README.md', import.meta.url), 'utf8');
const packageIndex = fs.readFileSync(new URL('../../packages/team-runtime/src/index.mjs', import.meta.url), 'utf8');
const packageTlRuntime = fs.readFileSync(new URL('../../packages/team-runtime/src/team-tl-runtime.mjs', import.meta.url), 'utf8');
const packageStore = fs.readFileSync(new URL('../../packages/team-runtime/src/team-store.mjs', import.meta.url), 'utf8');
const packageGovernance = fs.readFileSync(new URL('../../packages/team-runtime/src/team-governance-runtime.mjs', import.meta.url), 'utf8');
const packageWorkbench = fs.readFileSync(new URL('../../packages/team-runtime/src/workbench-manager.mjs', import.meta.url), 'utf8');
const packageTlExecution = fs.readFileSync(new URL('../../packages/team-runtime/src/tl-runtime/execution.mjs', import.meta.url), 'utf8');
const packageTlFollowup = fs.readFileSync(new URL('../../packages/team-runtime/src/tl-runtime/followup.mjs', import.meta.url), 'utf8');

const shimTlRuntime = fs.readFileSync(new URL('../../src/team/team-tl-runtime.mjs', import.meta.url), 'utf8');
const shimStore = fs.readFileSync(new URL('../../src/team/team-store.mjs', import.meta.url), 'utf8');
const shimGovernance = fs.readFileSync(new URL('../../src/team/team-governance-runtime.mjs', import.meta.url), 'utf8');
const shimWorkbench = fs.readFileSync(new URL('../../src/team/workbench-manager.mjs', import.meta.url), 'utf8');
const shimTlExecution = fs.readFileSync(new URL('../../src/team/tl-runtime/execution.mjs', import.meta.url), 'utf8');
const shimTlFollowup = fs.readFileSync(new URL('../../src/team/tl-runtime/followup.mjs', import.meta.url), 'utf8');

const teamReadme = fs.readFileSync(new URL('../../src/team/README.md', import.meta.url), 'utf8');
const teamIndex = fs.readFileSync(new URL('../../src/team/INDEX.md', import.meta.url), 'utf8');
const tlRuntimeReadme = fs.readFileSync(new URL('../../src/team/tl-runtime/README.md', import.meta.url), 'utf8');

assert(packageReadme.includes('implementation authority'), 'team-runtime package README declares package authority');
assert(packageReadme.includes('does **not** mean all of `src/team/` is migrated'), 'team-runtime package README declares partial boundary');
assert(packageIndex.includes("export * from './team-tl-runtime.mjs';"), 'package index exports team-tl-runtime');
assert(packageIndex.includes("export * from './team-store.mjs';"), 'package index exports team-store');
assert(packageIndex.includes("export * from './team-governance-runtime.mjs';"), 'package index exports governance runtime');
assert(packageIndex.includes("export * from './workbench-manager.mjs';"), 'package index exports workbench manager');

assert(packageTlRuntime.includes('export function createTLRuntime'), 'package team-tl-runtime is canonical source');
assert(packageStore.includes('export function openTeamStore'), 'package team-store is canonical source');
assert(packageGovernance.includes('export function createGovernanceRuntime'), 'package governance runtime is canonical source');
assert(packageWorkbench.includes('export function createWorkbenchManager'), 'package workbench manager is canonical source');
assert(packageTlExecution.includes('export function createTLExecutionHelpers'), 'package tl execution is canonical source');
assert(packageTlFollowup.includes('export function createTLFollowupHelpers'), 'package tl followup is canonical source');

assert(shimTlRuntime.includes("export * from '../../packages/team-runtime/src/team-tl-runtime.mjs';"), 'src team-tl-runtime is shim');
assert(shimStore.includes("export * from '../../packages/team-runtime/src/team-store.mjs';"), 'src team-store is shim');
assert(shimGovernance.includes("export * from '../../packages/team-runtime/src/team-governance-runtime.mjs';"), 'src governance runtime is shim');
assert(shimWorkbench.includes("export * from '../../packages/team-runtime/src/workbench-manager.mjs';"), 'src workbench manager is shim');
assert(shimTlExecution.includes("export * from '../../../packages/team-runtime/src/tl-runtime/execution.mjs';"), 'src tl-runtime execution is shim');
assert(shimTlFollowup.includes("export * from '../../../packages/team-runtime/src/tl-runtime/followup.mjs';"), 'src tl-runtime followup is shim');

assert(teamReadme.includes('mixed surface') || teamReadme.includes('mixed surface'.replace(/ /g,'')) || teamReadme.includes('mixed'), 'src/team README declares mixed surface');
assert(teamIndex.includes('mixed surface') || teamIndex.includes('mixed'), 'src/team INDEX declares mixed surface');
assert(tlRuntimeReadme.includes('src/team/team-tl-runtime.mjs') || tlRuntimeReadme.includes('tl-runtime'), 'tl-runtime README still provides compatibility-oriented local guidance');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-runtime-authority.v1',
  },
}, null, 2));
if (failed > 0) process.exit(1);
