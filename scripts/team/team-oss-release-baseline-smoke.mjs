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
const docsIndex = fs.readFileSync(new URL('../../docs/index.md', import.meta.url), 'utf8');
const architecture = fs.readFileSync(new URL('../../docs/architecture/current-team-runtime-architecture.md', import.meta.url), 'utf8');
const releaseDoc = fs.readFileSync(new URL('../../docs/architecture/standalone-harness-baseline-release.md', import.meta.url), 'utf8');
const onboardingDoc = fs.readFileSync(new URL('../../docs/architecture/independent-agent-onboarding.md', import.meta.url), 'utf8');
const packageReadme = fs.readFileSync(new URL('../../packages/agent-harness/README.md', import.meta.url), 'utf8');
const sampleReadme = fs.readFileSync(new URL('../../examples/oss-minimal/README.md', import.meta.url), 'utf8');
const teamScriptsIndex = fs.readFileSync(new URL('../../scripts/team/INDEX.md', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../../scripts/smoke/team-mainline.mjs', import.meta.url), 'utf8');

assert(readme.includes('AI Team Harness') || readme.includes('standalone runtime for orchestrating multi-agent workflows'), 'repo README declares current harness product surface');
assert(readme.includes('packages/agent-harness/') || architecture.includes('packages/agent-harness/'), 'repo surface points to standalone baseline authority');

assert(docsIndex.includes('current-team-runtime-architecture.md'), 'docs index links current team runtime architecture');
assert(docsIndex.includes('standalone-harness-baseline-release.md'), 'docs index links standalone harness baseline release');
assert(docsIndex.includes('independent-agent-onboarding.md'), 'docs index links independent agent onboarding');

assert(architecture.includes('packages/agent-harness/` = canonical baseline authority') || architecture.includes('packages/agent-harness/ = canonical baseline authority') || architecture.includes('packages/agent-harness/'), 'architecture doc declares package baseline authority');
assert(architecture.includes('wrapper / regression facade / runnable sample'), 'architecture doc declares sample facade boundary');

assert(releaseDoc.includes('黄金基线结论'), 'release doc exists');
assert(releaseDoc.includes('standalone harness canonical baseline authority'), 'release doc declares standalone harness authority');
assert(releaseDoc.includes('run / resume / drain / stream'), 'release doc covers run/resume/drain/stream matrix');
assert(releaseDoc.includes('crash-resume / durable recovery / source-first recovery'), 'release doc covers recovery matrix');
assert(releaseDoc.includes('capability observability'), 'release doc covers capability observability');
assert(releaseDoc.includes('scripts/team/team-oss-release-baseline-smoke.mjs'), 'release doc declares oss baseline smoke gate');

assert(onboardingDoc.includes('Independent Agent Onboarding'), 'onboarding doc is part of release surface');
assert(packageReadme.includes('canonical implementation authority'), 'package README declares canonical baseline authority');
assert(sampleReadme.includes('wrapper / regression facade'), 'sample README declares facade role');

assert(teamScriptsIndex.includes('team-independent-agent-onboarding-smoke.mjs') || mainline.includes('team-independent-agent-onboarding-smoke.mjs'), 'onboarding smoke is discoverable from script surface or mainline');
assert(teamScriptsIndex.includes('team-oss-release-baseline-smoke.mjs') || mainline.includes('team-oss-release-baseline-smoke.mjs'), 'oss release smoke is discoverable from script surface or mainline');
assert(mainline.includes('team-independent-agent-onboarding-smoke.mjs'), 'mainline includes onboarding smoke');
assert(mainline.includes('team-oss-release-baseline-smoke.mjs'), 'mainline includes oss release smoke');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-oss-release-baseline.v2',
  },
}, null, 2));

if (failed > 0) process.exit(1);
