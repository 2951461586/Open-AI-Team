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

const workflow = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const docsIndex = fs.readFileSync(new URL('../../docs/index.md', import.meta.url), 'utf8');
const gettingStarted = fs.readFileSync(new URL('../../GETTING-STARTED.md', import.meta.url), 'utf8');
const dashboardReadme = fs.readFileSync(new URL('../../dashboard/README.md', import.meta.url), 'utf8');
const releaseCiDoc = fs.readFileSync(new URL('../../docs/architecture/release-engineering-and-ci.md', import.meta.url), 'utf8');
const preflight = fs.readFileSync(new URL('../../docs/architecture/github-open-source-preflight.md', import.meta.url), 'utf8');
const teamIndex = fs.readFileSync(new URL('../../scripts/team/INDEX.md', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../../scripts/smoke/team-mainline.mjs', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));

assert(workflow.includes('mainline:'), 'ci workflow defines mainline job');
assert(workflow.includes('public-contracts:'), 'ci workflow defines public-contracts job');
assert(workflow.includes('dashboard-build:'), 'ci workflow defines dashboard-build job');
assert(workflow.includes('oss-minimal:'), 'ci workflow defines oss-minimal job');
assert(workflow.includes('third-party-template:'), 'ci workflow defines third-party-template job');
assert(workflow.includes("node-version: '22'"), 'ci workflow pins node 22');
assert(workflow.includes("cache: 'npm'"), 'ci workflow enables npm cache');
assert(workflow.includes('npm ci'), 'ci workflow uses npm ci');
assert(workflow.includes('npm run smoke:team'), 'ci workflow runs mainline smoke');
assert(workflow.includes('npm run fixtures:route-derived'), 'ci workflow generates derived fixtures');
assert(workflow.includes('npm run smoke:public-schemas'), 'ci workflow runs public schema smoke');
assert(workflow.includes('npm run smoke:dashboard-public-contract'), 'ci workflow runs dashboard contract smoke');
assert(workflow.includes('working-directory: dashboard'), 'ci workflow builds dashboard from repo-local directory');
assert(workflow.includes('npm run build'), 'ci workflow runs repo-local dashboard build');
assert(workflow.includes('npm run scan:bundle'), 'ci workflow runs dashboard bundle scan');
assert(workflow.includes('npm run smoke:oss-minimal'), 'ci workflow runs oss-minimal smoke');
assert(workflow.includes('npm run demo:oss-minimal'), 'ci workflow runs oss-minimal demo');
assert(workflow.includes('npm run status:oss-minimal'), 'ci workflow runs oss-minimal status');
assert(workflow.includes('npm run doctor:oss-minimal'), 'ci workflow runs oss-minimal doctor');
assert(workflow.includes('npm run validate:agent-package'), 'ci workflow validates oss agent package');
assert(workflow.includes('npm run validate:third-party-agent'), 'ci workflow validates third-party sample');
assert(workflow.includes('npm run smoke:third-party-agent'), 'ci workflow runs third-party smoke');

assert(releaseCiDoc.includes('Dashboard Build Authority'), 'release engineering doc defines dashboard build authority');
assert(releaseCiDoc.includes('repo-local dashboard build authority'), 'release engineering doc keeps repo-local dashboard CI rule');
assert(releaseCiDoc.includes('dashboard-build'), 'release engineering doc distinguishes dashboard build lane');
assert(releaseCiDoc.includes('GitHub Actions is split into layered public-safe jobs'), 'release engineering doc defines layered CI completion bar');

assert(dashboardReadme.includes('Current build boundary'), 'dashboard README declares current build boundary');
assert(dashboardReadme.includes('single-repo build authority'), 'dashboard README describes repo-local build authority');
assert(dashboardReadme.includes('cd /root/.openclaw/workspace/orchestrator/dashboard'), 'dashboard README documents repo-local dashboard cwd');
assert(dashboardReadme.includes('npm run dashboard:build'), 'dashboard README documents repo-local build entrypoint');
assert(!dashboardReadme.includes('sibling `../dashboard` app shell'), 'dashboard README no longer references sibling app shell');

assert(readme.includes('release-engineering-and-ci.md'), 'repo README links release engineering doc');
assert(readme.includes('dashboard/README.md'), 'repo README links dashboard UI surface');
assert(docsIndex.includes('architecture/release-engineering-and-ci.md'), 'docs index links release engineering doc');
assert(gettingStarted.includes('dashboard:build') || gettingStarted.includes('dashboard contract'), 'getting started still points to dashboard validation/build path');
assert(preflight.includes('P6 — Release Engineering and CI'), 'preflight doc includes P6 section');
assert(preflight.includes('P7 — Dashboard Single-Repo Build Authority'), 'preflight doc includes P7 section');

assert(pkg.scripts['smoke:release-engineering'] === 'node scripts/team/team-release-engineering-ci-smoke.mjs', 'package exposes release engineering smoke');
assert(teamIndex.includes('team-release-engineering-ci-smoke.mjs'), 'team script index includes release engineering smoke');
assert(mainline.includes('team-release-engineering-ci-smoke.mjs'), 'mainline includes release engineering smoke');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-release-engineering-ci.v2',
  },
}, null, 2));

if (failed > 0) process.exit(1);
