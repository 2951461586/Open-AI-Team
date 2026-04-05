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

const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const architectureRoot = fs.readFileSync(new URL('../../ARCHITECTURE.md', import.meta.url), 'utf8');
const docsIndex = fs.readFileSync(new URL('../../docs/index.md', import.meta.url), 'utf8');
const runtimeArchitecture = fs.readFileSync(new URL('../../docs/architecture/current-team-runtime-architecture.md', import.meta.url), 'utf8');
const sessionDoc = fs.readFileSync(new URL('../../docs/architecture/session-capability-and-followup-fallback.md', import.meta.url), 'utf8');
const historicalOpsDoc = fs.readFileSync(new URL('../../docs/ops/p7-p8-session-capability-and-followup-fallback-2026-03-30.md', import.meta.url), 'utf8');
const scriptsIndex = fs.readFileSync(new URL('../../scripts/team/INDEX.md', import.meta.url), 'utf8');
const scriptsReadme = fs.readFileSync(new URL('../../scripts/README.md', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../../scripts/smoke/team-mainline.mjs', import.meta.url), 'utf8');
const followupSmoke = fs.readFileSync(new URL('../../scripts/team/team-followup-fallback-mainline-smoke.mjs', import.meta.url), 'utf8');
const workbenchRoute = fs.readFileSync(new URL('../../src/routes/team-state/workbench.mjs', import.meta.url), 'utf8');
const summaryRoute = fs.readFileSync(new URL('../../src/routes/team-state/summary.mjs', import.meta.url), 'utf8');
const followupRuntime = fs.readFileSync(new URL('../../src/team/tl-runtime/followup.mjs', import.meta.url), 'utf8');
const writeback = fs.readFileSync(new URL('../../src/team/tl-runtime/state-writeback.mjs', import.meta.url), 'utf8');

assert(readme.includes('Session Capability & Follow-up') || readme.includes('session capability and follow-up fallback'), 'repo README links or mentions session capability authority');
assert(architectureRoot.includes('session-capability-and-followup-fallback.md'), 'ARCHITECTURE links session capability authority doc');
assert(docsIndex.includes('session-capability-and-followup-fallback.md'), 'docs index links session capability authority doc');
assert(runtimeArchitecture.includes('session-capability-and-followup-fallback.md'), 'runtime architecture points to session capability authority doc');

assert(sessionDoc.includes('sessionMode') && sessionDoc.includes('sessionPersistent') && sessionDoc.includes('sessionFallbackReason'), 'session capability doc declares canonical capability fields');
assert(sessionDoc.includes('/state/team/summary') && sessionDoc.includes('/state/team/workbench') && sessionDoc.includes('/state/team/board') && sessionDoc.includes('/state/team/dashboard'), 'session capability doc declares route coverage');
assert(sessionDoc.includes('thread=true is unavailable because no channel plugin registered subagent_spawning hooks.'), 'session capability doc records current environment degradation reality');
assert(sessionDoc.includes('followupRoute') && sessionDoc.includes('lastFollowupFallbackReason') && sessionDoc.includes('lastFollowupTargetRole') && sessionDoc.includes('lastFollowupAssignmentId') && sessionDoc.includes('lastFollowupChildTaskId'), 'session capability doc declares task writeback contract');
assert(sessionDoc.includes('TL direct reply') || sessionDoc.includes('TL 直答兜底'), 'session capability doc declares TL direct fallback semantics');
assert(historicalOpsDoc.includes('P7-P8'), 'historical P7-P8 ops note remains present');

assert(followupSmoke.includes('summary exposes sessionMode') && followupSmoke.includes('dashboard card exposes sessionFallbackReason'), 'follow-up fallback smoke guards query-surface capability fields');
assert(workbenchRoute.includes('sessionMode') && workbenchRoute.includes('sessionPersistent') && workbenchRoute.includes('sessionFallbackReason'), 'workbench route still exposes capability fields');
assert(summaryRoute.includes('sessionMode') && summaryRoute.includes('sessionPersistent') && summaryRoute.includes('sessionFallbackReason') && summaryRoute.includes('followupRoute'), 'summary route still exposes capability + route fields');
assert(followupRuntime.includes('empty_member_reply') && followupRuntime.includes('member_session_not_persistent'), 'follow-up runtime preserves fallback triggers');
assert(writeback.includes('lastFollowupFallbackReason') && writeback.includes('lastFollowupTargetRole') && writeback.includes('lastFollowupAssignmentId') && writeback.includes('lastFollowupChildTaskId'), 'state writeback preserves follow-up metadata contract');

assert(scriptsIndex.includes('team-session-capability-doc-boundary-smoke.mjs') || mainline.includes('team-session-capability-doc-boundary-smoke.mjs'), 'session capability doc smoke is discoverable from active script surface');
assert(scriptsReadme.includes('session capability docs') || mainline.includes('team-session-capability-doc-boundary-smoke.mjs'), 'scripts guide or mainline includes session capability docs gate');
assert(mainline.includes('team-followup-fallback-mainline-smoke.mjs'), 'mainline keeps follow-up fallback smoke');
assert(mainline.includes('team-session-capability-doc-boundary-smoke.mjs'), 'mainline includes session capability doc gate');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-session-capability-doc-boundary.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);
