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
const dashboardLock = fs.readFileSync(new URL('../../dashboard/package-lock.json', import.meta.url), 'utf8');
const ossManifest = JSON.parse(fs.readFileSync(new URL('../../examples/oss-minimal/agent-manifest.json', import.meta.url), 'utf8'));
const thirdPartyManifest = JSON.parse(fs.readFileSync(new URL('../../examples/third-party-agent-sample/agent-manifest.json', import.meta.url), 'utf8'));
const coreManifest = JSON.parse(fs.readFileSync(new URL('../../src/agent-harness-core/oss-agent-manifest.json', import.meta.url), 'utf8'));
const releaseDoc = fs.readFileSync(new URL('../../docs/architecture/release-notes-provenance-and-version-story.md', import.meta.url), 'utf8');
const releaseWorkflow = fs.readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');
const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const docsIndex = fs.readFileSync(new URL('../../docs/index.md', import.meta.url), 'utf8');
const preflight = fs.readFileSync(new URL('../../docs/archive/github-open-source-preflight.md', import.meta.url), 'utf8');
const teamIndex = fs.readFileSync(new URL('../../scripts/team/INDEX.md', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../../scripts/smoke/team-mainline.mjs', import.meta.url), 'utf8');

assert(pkg.scripts['release:notes'] === 'node scripts/team/team-generate-release-notes.mjs', 'package exposes release notes generator');
assert(fs.existsSync(new URL('../../scripts/team/team-generate-release-notes.mjs', import.meta.url)), 'release notes generator exists');
assert(fs.existsSync(new URL('../../docs/architecture/release-notes-provenance-and-version-story.md', import.meta.url)), 'P9 authority doc exists');

assert(pkg.version === dashboardPkg.version, 'dashboard version aligns to repo release track', `${pkg.version} == ${dashboardPkg.version}`);
assert(dashboardLock.includes(`\"version\": \"${pkg.version}\"`), 'dashboard lockfile root version aligns with dashboard package');
assert(thirdPartyManifest.version === pkg.version, 'third-party sample aligns to repo release track', `${thirdPartyManifest.version} == ${pkg.version}`);
assert(ossManifest.version === coreManifest.version, 'oss-minimal aligns to standalone harness track', `${ossManifest.version} == ${coreManifest.version}`);
assert(pkg.version !== coreManifest.version, 'repo track and standalone harness track remain distinct when intended', `${pkg.version} vs ${coreManifest.version}`);

assert(releaseDoc.includes('Dual-Track Version Story'), 'P9 doc defines dual-track version story');
assert(releaseDoc.includes('PROVENANCE.json'), 'P9 doc requires provenance file');
assert(releaseDoc.includes('VERSION-STORY.json'), 'P9 doc requires version story file');
assert(releaseDoc.includes('RELEASE-NOTES.md'), 'P9 doc requires release notes file');

assert(releaseWorkflow.includes('npm run release:notes'), 'release workflow generates release notes');
assert(releaseWorkflow.includes('PROVENANCE.json'), 'release workflow publishes provenance asset');
assert(releaseWorkflow.includes('VERSION-STORY.json'), 'release workflow publishes version-story asset');
assert(releaseWorkflow.includes('RELEASE-NOTES.md'), 'release workflow publishes release notes asset');
assert(releaseWorkflow.includes('body_path: .release-artifacts/RELEASE-NOTES.md'), 'release workflow uses generated release notes as release body');

assert(readme.includes('release-notes-provenance-and-version-story.md'), 'repo README links P9 doc');
assert(docsIndex.includes('architecture/release-notes-provenance-and-version-story.md'), 'docs index links P9 doc');
assert(preflight.includes('P9 — Release Notes, Provenance, and Version Story'), 'preflight doc includes P9 section');
assert(teamIndex.includes('team-release-notes-provenance-version-smoke.mjs'), 'team script index includes P9 smoke');
assert(mainline.includes('team-release-notes-provenance-version-smoke.mjs'), 'mainline includes P9 smoke');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-release-notes-provenance-version.v1',
  },
}, null, 2));

if (failed > 0) process.exit(1);
