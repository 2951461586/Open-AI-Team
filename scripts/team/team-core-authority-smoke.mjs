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

const tlRuntime = fs.readFileSync(new URL('../../packages/team-runtime/src/team-tl-runtime.mjs', import.meta.url), 'utf8');
const packageReadme = fs.readFileSync(new URL('../../packages/team-core/README.md', import.meta.url), 'utf8');
const packageIndex = fs.readFileSync(new URL('../../packages/team-core/src/index.mjs', import.meta.url), 'utf8');
const packageCommon = fs.readFileSync(new URL('../../packages/team-core/src/common.mjs', import.meta.url), 'utf8');
const packageWorkItem = fs.readFileSync(new URL('../../packages/team-core/src/work-item.mjs', import.meta.url), 'utf8');
const packageDecision = fs.readFileSync(new URL('../../packages/team-core/src/decision.mjs', import.meta.url), 'utf8');
const packageSafety = fs.readFileSync(new URL('../../packages/team-core/src/execution-safety-contracts.mjs', import.meta.url), 'utf8');
const packageRoleContracts = fs.readFileSync(new URL('../../packages/team-core/src/role-capability-contracts.mjs', import.meta.url), 'utf8');
const packageQueryContract = fs.readFileSync(new URL('../../packages/team-core/src/query-contract.mjs', import.meta.url), 'utf8');
const shimCommon = fs.readFileSync(new URL('../../src/team-core/common.mjs', import.meta.url), 'utf8');
const shimWorkItem = fs.readFileSync(new URL('../../src/team-core/work-item.mjs', import.meta.url), 'utf8');
const shimDecision = fs.readFileSync(new URL('../../src/team-core/decision.mjs', import.meta.url), 'utf8');
const shimSafety = fs.readFileSync(new URL('../../src/team-core/execution-safety-contracts.mjs', import.meta.url), 'utf8');
const shimRoleContracts = fs.readFileSync(new URL('../../src/team-core/role-capability-contracts.mjs', import.meta.url), 'utf8');
const shimQueryContract = fs.readFileSync(new URL('../../src/team-core/query-contract.mjs', import.meta.url), 'utf8');

assert(packageReadme.includes('implementation authority'), 'team-core package README declares package authority');
assert(packageIndex.includes("export * from './common.mjs';"), 'team-core package index exports common');
assert(packageIndex.includes("export * from './work-item.mjs';"), 'team-core package index exports work-item');
assert(packageCommon.includes('export function parseJsonLoose'), 'team-core package common is canonical source');
assert(packageWorkItem.includes('export function createTLWorkItemHelpers'), 'team-core package work-item is canonical source');
assert(packageDecision.includes('export function createTLDecisionHelpers'), 'team-core package decision is canonical source');
assert(packageSafety.includes('export function buildSearchEvidenceSafetyPrompt'), 'team-core package safety contract is canonical source');
assert(packageRoleContracts.includes('export function getRoleCapabilityContract'), 'team-core package role contracts is canonical source');
assert(packageQueryContract.includes('export const TEAM_QUERY_API_CONTRACT'), 'team-core package query contract is canonical source');

assert(shimCommon.includes("export * from '../../packages/team-core/src/common.mjs';"), 'src team-core common is shim');
assert(shimWorkItem.includes("export * from '../../packages/team-core/src/work-item.mjs';"), 'src team-core work-item is shim');
assert(shimDecision.includes("export * from '../../packages/team-core/src/decision.mjs';"), 'src team-core decision is shim');
assert(shimSafety.includes("export * from '../../packages/team-core/src/execution-safety-contracts.mjs';"), 'src team-core safety contract is shim');
assert(shimRoleContracts.includes("export * from '../../packages/team-core/src/role-capability-contracts.mjs';"), 'src team-core role contracts is shim');
assert(shimQueryContract.includes("export * from '../../packages/team-core/src/query-contract.mjs';"), 'src team-core query contract is shim');

assert(tlRuntime.includes("from '../../team-core/src/common.mjs'"), 'TL runtime imports common from team-core surface');
assert(tlRuntime.includes("from '../../team-core/src/work-item.mjs'"), 'TL runtime imports work-item from team-core surface');
assert(tlRuntime.includes("from '../../team-core/src/decision.mjs'"), 'TL runtime imports decision from team-core surface');
assert(tlRuntime.includes("from '../../team-core/src/role-capability-contracts.mjs'"), 'TL runtime imports role contracts from team-core surface');
assert(tlRuntime.includes("from '../../team-core/src/execution-safety-contracts.mjs'"), 'TL runtime imports execution safety from team-core surface');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-core-authority.v2',
  },
}, null, 2));
if (failed > 0) process.exit(1);
