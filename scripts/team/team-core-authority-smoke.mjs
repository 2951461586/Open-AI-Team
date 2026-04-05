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

const tlRuntime = fs.readFileSync(new URL('../../src/team/team-tl-runtime.mjs', import.meta.url), 'utf8');
const coreReadme = fs.readFileSync(new URL('../../src/team-core/README.md', import.meta.url), 'utf8');
const coreCommon = fs.readFileSync(new URL('../../src/team-core/common.mjs', import.meta.url), 'utf8');
const coreWorkItem = fs.readFileSync(new URL('../../src/team-core/work-item.mjs', import.meta.url), 'utf8');
const coreDecision = fs.readFileSync(new URL('../../src/team-core/decision.mjs', import.meta.url), 'utf8');
const coreRoleContracts = fs.readFileSync(new URL('../../src/team-core/role-capability-contracts.mjs', import.meta.url), 'utf8');
const coreQueryContract = fs.readFileSync(new URL('../../src/team-core/query-contract.mjs', import.meta.url), 'utf8');
const compatCommon = fs.readFileSync(new URL('../../src/team/tl-runtime/common.mjs', import.meta.url), 'utf8');
const compatWorkItem = fs.readFileSync(new URL('../../src/team/tl-runtime/work-item.mjs', import.meta.url), 'utf8');
const compatDecision = fs.readFileSync(new URL('../../src/team/tl-runtime/decision.mjs', import.meta.url), 'utf8');
const compatRoleContracts = fs.readFileSync(new URL('../../src/team/team-role-capability-contracts.mjs', import.meta.url), 'utf8');
const compatQueryContract = fs.readFileSync(new URL('../../src/team/query-api/query-contract.mjs', import.meta.url), 'utf8');

assert(coreReadme.includes('平台无关') || coreReadme.includes('宿主无关'), 'team-core README declares host-agnostic goal');
assert(coreCommon.includes('export function parseJsonLoose'), 'team-core common is canonical source');
assert(coreWorkItem.includes('export function createTLWorkItemHelpers'), 'team-core work-item is canonical source');
assert(coreDecision.includes('export function createTLDecisionHelpers'), 'team-core decision is canonical source');
assert(coreRoleContracts.includes('export function getRoleCapabilityContract'), 'team-core role contracts is canonical source');
assert(coreQueryContract.includes('export const TEAM_QUERY_API_CONTRACT'), 'team-core query contract is canonical source');

assert(tlRuntime.includes("from '../team-core/common.mjs'"), 'TL runtime imports common from team-core');
assert(tlRuntime.includes("from '../team-core/work-item.mjs'"), 'TL runtime imports work-item from team-core');
assert(tlRuntime.includes("from '../team-core/decision.mjs'"), 'TL runtime imports decision from team-core');
assert(tlRuntime.includes("from '../team-core/role-capability-contracts.mjs'"), 'TL runtime imports role contracts from team-core');
assert(tlRuntime.includes("from '../team-core/execution-safety-contracts.mjs'"), 'TL runtime imports execution safety from team-core');

assert(compatCommon.includes("export * from '../../team-core/common.mjs';"), 'compat common re-exports team-core');
assert(compatWorkItem.includes("export * from '../../team-core/work-item.mjs';"), 'compat work-item re-exports team-core');
assert(compatDecision.includes("export * from '../../team-core/decision.mjs';"), 'compat decision re-exports team-core');
assert(compatRoleContracts.includes("export * from '../team-core/role-capability-contracts.mjs';"), 'compat role contracts re-export team-core');
assert(compatQueryContract.includes("export * from '../../team-core/query-contract.mjs';"), 'compat query-contract re-exports team-core');

console.log(`team core authority summary ${passed}/${passed + failed} passed`);
if (failed > 0) process.exit(1);
