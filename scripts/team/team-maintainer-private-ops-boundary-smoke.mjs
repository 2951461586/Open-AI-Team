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
const gettingStarted = fs.readFileSync(new URL('../../GETTING-STARTED.md', import.meta.url), 'utf8');
const architecture = fs.readFileSync(new URL('../../ARCHITECTURE.md', import.meta.url), 'utf8');
const docsIndex = fs.readFileSync(new URL('../../docs/index.md', import.meta.url), 'utf8');
const scriptsReadme = fs.readFileSync(new URL('../../scripts/README.md', import.meta.url), 'utf8');
const examplesReadme = fs.readFileSync(new URL('../../examples/README.md', import.meta.url), 'utf8');
const releaseAllowlist = fs.readFileSync(new URL('../../docs/architecture/release-surface-allowlist.md', import.meta.url), 'utf8');
const p5Boundary = fs.readFileSync(new URL('../../docs/architecture/maintainer-private-ops-boundary.md', import.meta.url), 'utf8');
const opsReadme = fs.readFileSync(new URL('../../docs/ops/README.md', import.meta.url), 'utf8');
const scriptsOpsReadme = fs.readFileSync(new URL('../../scripts/ops/README.md', import.meta.url), 'utf8');
const configTeamReadme = fs.readFileSync(new URL('../../config/team/README.md', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../../scripts/smoke/team-mainline.mjs', import.meta.url), 'utf8');

assert(p5Boundary.includes('P5 authority document'), 'P5 boundary doc exists as authority');
assert(p5Boundary.includes('docs/ops/'), 'P5 boundary doc classifies docs/ops');
assert(p5Boundary.includes('scripts/ops/'), 'P5 boundary doc classifies scripts/ops');
assert(p5Boundary.includes('config/team/'), 'P5 boundary doc classifies config/team');
assert(p5Boundary.includes('may remain in-tree'), 'P5 boundary doc keeps in-tree-but-secondary rule');

assert(opsReadme.includes('maintainer-oriented operational context'), 'docs/ops has maintainer boundary README');
assert(scriptsOpsReadme.includes('maintainer/private-ops surface'), 'scripts/ops has maintainer boundary README');
assert(configTeamReadme.includes('active runtime inventory / maintainer-facing config authority'), 'config/team has maintainer boundary README');

assert(gettingStarted.includes('Maintainer / private ops — secondary surface'), 'getting started classifies maintainer/private ops as secondary');
assert(gettingStarted.includes('config/team/README.md'), 'getting started links config/team boundary readme');
assert(gettingStarted.includes('scripts/ops/README.md'), 'getting started links scripts/ops boundary readme');
assert(gettingStarted.includes('docs/ops/README.md'), 'getting started links docs/ops boundary readme');

assert(readme.includes('secondary maintainer context') || readme.includes('maintainer/private operational material may also remain in-tree during transition'), 'repo README downgrades maintainer/private material');
assert(architecture.includes('maintainer-private-ops-boundary.md'), 'architecture links maintainer/private boundary authority');
assert(docsIndex.includes('maintainer-private-ops-boundary.md'), 'docs index links maintainer/private boundary authority');
assert(docsIndex.includes('ops/README.md'), 'docs index links ops README before ops directory');

assert(releaseAllowlist.includes('Maintainer / Private / Live-Ops Surface'), 'release allowlist keeps maintainer/private classification');
assert(scriptsReadme.includes('Maintainer / private ops'), 'scripts README classifies maintainer/private ops');
assert(examplesReadme.includes('maintainer/private ops behavior'), 'examples README keeps maintainer/private out of example authority');
assert(mainline.includes('team-maintainer-private-ops-boundary-smoke.mjs'), 'mainline includes P5 boundary smoke');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-maintainer-private-ops-boundary.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);
