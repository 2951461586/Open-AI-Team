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

const ci = fs.readFileSync(new URL('../../.github/workflows/ci.yml', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
const readme = fs.readFileSync(new URL('../../README.md', import.meta.url), 'utf8');
const docsIndex = fs.readFileSync(new URL('../../docs/index.md', import.meta.url), 'utf8');
const preflight = fs.readFileSync(new URL('../../docs/archive/github-open-source-preflight.md', import.meta.url), 'utf8');
const releaseDoc = fs.readFileSync(new URL('../../docs/architecture/release-artifacts-and-publishing.md', import.meta.url), 'utf8');
const teamIndex = fs.readFileSync(new URL('../../scripts/team/INDEX.md', import.meta.url), 'utf8');
const mainline = fs.readFileSync(new URL('../../scripts/smoke/team-mainline.mjs', import.meta.url), 'utf8');
const gitignore = fs.readFileSync(new URL('../../.gitignore', import.meta.url), 'utf8');

assert(pkg.scripts['release:stage-artifacts'] === 'node scripts/team/team-stage-release-artifacts.mjs', 'package exposes release staging script');
assert(fs.existsSync(new URL('../../scripts/team/team-stage-release-artifacts.mjs', import.meta.url)), 'release staging script exists');
assert(fs.existsSync(new URL('../../docs/architecture/release-artifacts-and-publishing.md', import.meta.url)), 'release artifact authority doc exists');
assert(fs.existsSync(new URL('../../.github/workflows/release.yml', import.meta.url)), 'release workflow exists');

assert(ci.includes('actions/upload-artifact@v4'), 'ci uploads workflow artifacts');
assert(ci.includes('public-contracts-bundle'), 'ci uploads public contracts bundle');
assert(ci.includes('dashboard-static-export-bundle'), 'ci uploads dashboard static export bundle');
assert(ci.includes('oss-minimal-evidence-bundle'), 'ci uploads oss-minimal evidence bundle');
assert(ci.includes('third-party-agent-sample-bundle'), 'ci uploads third-party sample bundle');
assert(ci.includes('source-docs-bundle'), 'ci uploads source docs bundle');

const releaseWorkflow = fs.readFileSync(new URL('../../.github/workflows/release.yml', import.meta.url), 'utf8');
assert(releaseWorkflow.includes('push:'), 'release workflow supports tag-triggered publish');
assert(releaseWorkflow.includes('tags:'), 'release workflow defines tag filters');
assert(releaseWorkflow.includes('workflow_dispatch:'), 'release workflow supports manual dry-run');
assert(releaseWorkflow.includes('npm run release:stage-artifacts'), 'release workflow stages release artifacts');
assert(releaseWorkflow.includes('npm run release:notes'), 'release workflow generates release notes');
assert(releaseWorkflow.includes('softprops/action-gh-release'), 'release workflow publishes GitHub release assets');
assert(releaseWorkflow.includes('SHA256SUMS.txt'), 'release workflow emits checksums');
assert(releaseWorkflow.includes('PROVENANCE.json'), 'release workflow includes provenance asset');
assert(releaseWorkflow.includes('VERSION-STORY.json'), 'release workflow includes version story asset');
assert(releaseWorkflow.includes('RELEASE-NOTES.md'), 'release workflow includes release notes asset');
assert(releaseWorkflow.includes('public-contracts.tar.gz'), 'release workflow packs public contracts archive');
assert(releaseWorkflow.includes('dashboard-static-export.tar.gz'), 'release workflow packs dashboard archive');
assert(releaseWorkflow.includes('oss-minimal-evidence.tar.gz'), 'release workflow packs oss evidence archive');
assert(releaseWorkflow.includes('third-party-agent-sample.tar.gz'), 'release workflow packs third-party archive');
assert(releaseWorkflow.includes('source-docs.tar.gz'), 'release workflow packs source docs archive');

assert(releaseDoc.includes('Release Artifact Classes'), 'release doc defines artifact classes');
assert(releaseDoc.includes('Tag Publish Flow'), 'release doc defines tag publish flow');
assert(releaseDoc.includes('workflow_dispatch'), 'release doc mentions manual dry-run path');
assert(releaseDoc.includes('public-contracts.tar.gz'), 'release doc lists release bundles');
assert(releaseDoc.includes('dashboard-static-export.tar.gz'), 'release doc lists dashboard bundle');
assert(releaseDoc.includes('SHA256SUMS.txt'), 'release doc lists checksums bundle');

assert(readme.includes('release-artifacts-and-publishing.md'), 'repo README links release artifact doc');
assert(docsIndex.includes('architecture/release-artifacts-and-publishing.md'), 'docs index links release artifact doc');
assert(preflight.includes('P8 — Release Artifacts and Publish Pipeline'), 'preflight doc includes P8 section');

assert(teamIndex.includes('team-release-artifact-publish-smoke.mjs'), 'team script index includes P8 smoke');
assert(mainline.includes('team-release-artifact-publish-smoke.mjs'), 'mainline includes P8 smoke');
assert(gitignore.includes('/.release-artifacts/'), 'gitignore ignores staged release artifacts');
assert(gitignore.includes('/.release-bundles/'), 'gitignore ignores packed release bundles');

console.log(JSON.stringify({
  ok: failed === 0,
  summary: {
    ok: failed === 0,
    passed,
    failed,
    boundary: 'team-release-artifact-publish.v2',
  },
}, null, 2));

if (failed > 0) process.exit(1);
