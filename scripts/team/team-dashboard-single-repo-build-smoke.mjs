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

const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const dashboardPkg = JSON.parse(fs.readFileSync(new URL('../../dashboard/package.json', import.meta.url), 'utf8'));
const workflow = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const dashboardReadme = fs.readFileSync(new URL('../../dashboard/README.md', import.meta.url), 'utf8');
const releaseCiDoc = fs.readFileSync(new URL('../../docs/architecture/release-engineering-and-ci.md', import.meta.url), 'utf8');
const preflight = fs.readFileSync(new URL('../../docs/architecture/github-open-source-preflight.md', import.meta.url), 'utf8');
const productMap = fs.readFileSync(new URL('../../docs/architecture/product-surface-and-repo-map.md', import.meta.url), 'utf8');
const allowlist = fs.readFileSync(new URL('../../docs/architecture/release-surface-allowlist.md', import.meta.url), 'utf8');
const teamIndex = fs.readFileSync(new URL('../../scripts/team/INDEX.md', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../../scripts/smoke/team-mainline.mjs', import.meta.url), 'utf8');
const gitignore = fs.readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8');

assert(pkg.scripts['dashboard:build'] === 'cd dashboard && npm ci && npm run build', 'root package uses repo-local dashboard build script');
assert(pkg.scripts['dashboard:check-bundle'] === 'cd dashboard && npm run scan:bundle', 'root package exposes repo-local dashboard bundle scan');
assert(dashboardPkg.name === 'ai-team-dashboard', 'dashboard package exists in repo');
assert(fs.existsSync(new URL('../../dashboard/package-lock.json', import.meta.url)), 'dashboard package-lock exists');
assert(fs.existsSync(new URL('../../dashboard/public/manifest.webmanifest', import.meta.url)), 'dashboard public assets exist');
assert(fs.existsSync(new URL('../../dashboard/scripts/scan-bundle-residue.mjs', import.meta.url)), 'dashboard bundle scan script exists');
assert(fs.existsSync(new URL('../../scripts/deploy-dashboard-cloudbase.sh', import.meta.url)), 'repo-local dashboard deploy script exists');

assert(workflow.includes('dashboard-build:'), 'ci workflow defines dashboard-build job');
assert(workflow.includes('working-directory: dashboard'), 'ci workflow builds dashboard from repo-local directory');
assert(workflow.includes('npm run build'), 'ci workflow runs dashboard build');
assert(workflow.includes('npm run scan:bundle'), 'ci workflow runs dashboard bundle scan');

assert(dashboardReadme.includes('single-repo build authority'), 'dashboard README declares single-repo build authority');
assert(dashboardReadme.includes('cd /root/.openclaw/workspace/orchestrator/dashboard'), 'dashboard README documents repo-local dashboard cwd');
assert(!dashboardReadme.includes('sibling `../dashboard` app shell'), 'dashboard README no longer depends on sibling app shell');

assert(releaseCiDoc.includes('repo-local dashboard build authority'), 'release engineering doc declares repo-local dashboard build authority');
assert(releaseCiDoc.includes('dashboard-build'), 'release engineering doc references dashboard-build CI lane');
assert(!releaseCiDoc.includes('workspace-only app builds may still be run by maintainers'), 'release engineering doc removed workspace-only dashboard caveat');

assert(preflight.includes('P7 — Dashboard Single-Repo Build Authority'), 'preflight doc includes P7 section');
assert(productMap.includes('dashboard/src/'), 'product repo map uses repo-local dashboard path');
assert(!productMap.includes('../dashboard/src/'), 'product repo map removed sibling dashboard path');
assert(allowlist.includes('dashboard/src/'), 'release allowlist uses repo-local dashboard path');
assert(!allowlist.includes('../dashboard/src/'), 'release allowlist removed sibling dashboard path');

assert(teamIndex.includes('team-dashboard-single-repo-build-smoke.mjs'), 'team script index includes P7 smoke');
assert(mainline.includes('team-dashboard-single-repo-build-smoke.mjs'), 'mainline includes P7 smoke');
assert(gitignore.includes('/dashboard/.next/'), 'gitignore ignores dashboard next build output');
assert(gitignore.includes('/dashboard/node_modules/'), 'gitignore ignores dashboard node_modules');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-dashboard-single-repo-build.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);
