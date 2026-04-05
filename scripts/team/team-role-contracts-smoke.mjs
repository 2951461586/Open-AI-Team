import { normalizePlannerContract, normalizeCriticContract, normalizeJudgeContract, TEAM_ROLE_CONTRACTS } from '../../src/team/team-role-contracts.mjs';

let pass = 0, fail = 0;
function assert(cond, msg){ if(cond){pass++; console.log('✅', msg);} else {fail++; console.error('❌', msg);} }

const p = normalizePlannerContract({ summary:'x', steps:[], risks:[] });
assert(p.contractVersion === 'planner.plan.v2', 'planner contractVersion v2');
assert(Array.isArray(p.successCriteria) && p.successCriteria.length > 0, 'planner successCriteria');
assert(Array.isArray(p.evidenceRequirements) && p.evidenceRequirements.length > 0, 'planner evidenceRequirements');

const c = normalizeCriticContract({});
assert(c.contractVersion === 'critic.review.v2', 'critic contractVersion v2');
assert(Array.isArray(c.checklist) && c.checklist.length > 0, 'critic checklist');
assert(Array.isArray(c.evidenceRequirements) && c.evidenceRequirements.length > 0, 'critic evidence requirements');

const j = normalizeJudgeContract({});
assert(j.contractVersion === 'judge.decision.v2', 'judge contractVersion v2');
assert(Array.isArray(j.evidenceRequirements) && j.evidenceRequirements.length > 0, 'judge evidence requirements');
assert(!!TEAM_ROLE_CONTRACTS.planner && !!TEAM_ROLE_CONTRACTS.critic && !!TEAM_ROLE_CONTRACTS.judge, 'all contracts exported');

console.log(`RESULT ${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
